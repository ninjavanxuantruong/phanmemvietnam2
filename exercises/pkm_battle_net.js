/**
 * ==========================================================
 * PKM BATTLE NET v2 — chỉ lo phần TRONG TRẬN
 * ==========================================================
 * KHÔNG tự mở kết nối riêng nữa — dùng chung 1 socket với
 * window.PkmPresence (file pkm_presence.js phải include TRƯỚC file này).
 * Việc ghép trận/thách đấu/hiện diện đã do pkm_presence.js lo trên trang
 * trước đó; file này chỉ nhận lại state trận đấu và vòng lặp hỏi-đáp.
 *
 * CẦN CÓ TRƯỚC (trong pkm_battle_online.html):
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js"></script>
 *   <script src="pkm_presence.js"></script>
 *   <script src="pkm_battle_net.js"></script>
 * ==========================================================
 */

window.PkmBattleNet = (() => {
  let roomId = sessionStorage.getItem("pkm_net_room_id") || null;
  let unitsAllowed = 0;
  let opponentId = null;
  let latestState = null;
  let myTeamFinal = null;
  let oppTeamFinal = null;
  let stopped = false;
  let awaitingAnswer = false;

  const listeners = {
    matchFound: [], battleStart: [], stateUpdate: [], battleEnd: [],
    opponentDisconnected: [], opponentReconnected: [], answered: [], needTeamSelect: [],
  };
  function on(ev, cb) { if (listeners[ev]) listeners[ev].push(cb); }
  function emit(ev, data) { (listeners[ev] || []).forEach(cb => cb(data)); }

  function socket() { return window.PkmPresence && window.PkmPresence.getSocket(); }

  function wire() {
    const s = socket();
    if (!s || s._pkmBattleWired) return;
    s._pkmBattleWired = true;

    s.on("match:found", d => { roomId = d.roomId; unitsAllowed = d.unitsAllowed; opponentId = d.opponentId; emit("matchFound", d); });
    s.on("battle:start", d => { myTeamFinal = d.myTeam; oppTeamFinal = d.oppTeam; emit("battleStart", d); });
    s.on("state:update", d => { latestState = d; emit("stateUpdate", d); askNextRoundQuestion(); });
    s.on("battle:end", d => { stopped = true; sessionStorage.removeItem("pkm_net_room_id"); emit("battleEnd", d); });

    s.on("room:rejoin_ok", d => {
      unitsAllowed = d.unitsAllowed;
      if (d.phase === "select") {
        opponentId = d.opponentId;
        emit("needTeamSelect", d); // chưa có trận thật -> để trang tự vẽ lại màn chọn đội hình
        return;
      }
      latestState = d; stopped = false;
      emit("stateUpdate", d);
      askNextRoundQuestion();
    });
    s.on("room:rejoin_failed", () => { sessionStorage.removeItem("pkm_net_room_id"); roomId = null; });
    s.on("opponent:disconnected", () => emit("opponentDisconnected"));
    s.on("opponent:reconnected", () => emit("opponentReconnected"));
  }

  // Gọi ngay khi trang trận đấu load — dùng socket đã có sẵn từ PkmPresence,
  // và nếu trang này được mở thẳng (đã có roomId lưu từ trước) thì tự rejoin.
  function connect() {
    if (!window.PkmPresence) { console.error("Thiếu pkm_presence.js!"); return null; }
    const s = window.PkmPresence.connect();
    wire();
    if (s.connected) tryRejoinIfNeeded();
    else s.once("connect", tryRejoinIfNeeded);
    return s;
  }
  function tryRejoinIfNeeded() {
    const s = socket();
    const savedRoom = sessionStorage.getItem("pkm_net_room_id");
    if (s && savedRoom) s.emit("room:rejoin", { roomId: savedRoom, playerId: window.PkmPresence.getPlayerId() });
  }

  function submitTeam(team) {
    const s = socket();
    if (!s || !roomId) return;
    s.emit("team:submit", { roomId, team });
  }
  function submitAnswer(correct) {
    const s = socket();
    if (!s || !roomId || !latestState) return;
    s.emit("answer:submit", { roomId, correct, turnCounter: latestState.turnCounter });
  }
  function isMyTurnPrimary() {
    return !!(latestState && window.PkmPresence && latestState.primaryId === window.PkmPresence.getPlayerId());
  }
  function getMyPlayerId() { return window.PkmPresence ? window.PkmPresence.getPlayerId() : null; }
  function getState() { return latestState; }
  function getTeams() { return { myTeam: myTeamFinal, oppTeam: oppTeamFinal }; }
  function getRoomInfo() { return { roomId, unitsAllowed, opponentId }; }

  function askNextRoundQuestion() {
    if (stopped || awaitingAnswer || !latestState) return;
    if (!window.QuizManager) return;

    const primary = isMyTurnPrimary();
    const labelEl = document.getElementById("quiz-role-label");
    if (labelEl) {
      labelEl.textContent = primary
        ? "⚔️ Câu hỏi CHÍNH — trả lời đúng để ra chưởng!"
        : "📖 Câu hỏi PHỤ — luyện tập, tính KN/DV, không ảnh hưởng đòn đánh lượt này";
      labelEl.className = primary ? "quiz-role-primary" : "quiz-role-secondary";
    }

    awaitingAnswer = true;
    window.QuizManager.ask((isCorrect) => {
      awaitingAnswer = false;
      if (window.PkmScore) window.PkmScore.recordAnswer(isCorrect);
      if (primary) submitAnswer(isCorrect);
      emit("answered", { correct: isCorrect, wasPrimary: primary });
    });
  }

  return {
    connect, submitTeam, submitAnswer, isMyTurnPrimary,
    getMyPlayerId, getState, getTeams, getRoomInfo, askNextRoundQuestion, on,
  };
})();
