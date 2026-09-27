/**
 * ==========================================================
 * PKM BATTLE NET — cầu nối giữa pkm_battle.js và server relay
 * ==========================================================
 * File này lo:
 *   - Kết nối socket.io tới server (Render)
 *   - Vào hàng đợi, nhận kết quả ghép trận
 *   - Gửi đội hình, nhận trạng thái trận đấu THẬT từ server
 *   - Vòng lặp hỏi-đáp mỗi lượt: hỏi 1 câu (CHÍNH hoặc PHỤ tuỳ vai trò),
 *     luôn tính KN/DV qua PkmScore.recordAnswer() như chế độ đơn,
 *     nhưng chỉ gửi kết quả lên server nếu mình đang là bên CHÍNH
 *   - Tự động nối lại (rejoin) khi rớt mạng giữa trận
 *
 * CẦN CÓ TRƯỚC (thêm vào <head> của pkm_battle.html, trước file này):
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js"></script>
 *   <script src="pkm_battle_net.js"></script>
 *
 * CHƯA LÀM Ở FILE NÀY (bước kế tiếp):
 *   - Vẽ animation ra chưởng lên đúng DOM của pkm_battle.js (cần sửa
 *     pkm_battle.js để đọc dữ liệu từ đây thay vì tự tính damage)
 *   - Màn hình chọn đội hình sau khi ghép trận (file .html riêng)
 * ==========================================================
 */

window.PkmBattleNet = (() => {
  // !!! ĐỔI DÒNG DƯỚI THÀNH DOMAIN RENDER THẬT CỦA BẠN SAU KHI DEPLOY !!!
  const SERVER_URL = "https://server-battle.onrender.com/";

  let socket = null;
  let playerId = null;
  let roomId = null;
  let unitsAllowed = 0;
  let opponentId = null;
  let latestState = null;   // state:update mới nhất từ server
  let myTeamFinal = null;
  let oppTeamFinal = null;
  let stopped = false;      // true khi trận đã kết thúc -> ngừng hỏi câu mới
  let awaitingAnswer = false; // đang hiện 1 câu hỏi, tránh hỏi chồng câu khác

  const listeners = {
    matchFound: [], queueTimeout: [], matchCancelled: [],
    battleStart: [], stateUpdate: [], battleEnd: [],
    opponentDisconnected: [], opponentReconnected: [], answered: [],
    lobbyUpdate: [], challengeIncoming: [], challengeSent: [],
    challengeDeclined: [], challengeQueued: [], challengeError: [],
  };
  function on(event, cb) { if (listeners[event]) listeners[event].push(cb); }
  function emit(event, data) { (listeners[event] || []).forEach(cb => cb(data)); }

  function ensurePlayerId() {
    let id = localStorage.getItem("pkm_net_player_id");
    if (!id) {
      id = "p_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
      localStorage.setItem("pkm_net_player_id", id);
    }
    playerId = id;
    return id;
  }

  function connect() {
    if (socket) return socket;
    ensurePlayerId();
    socket = io(SERVER_URL, { transports: ["websocket", "polling"] });

    socket.on("connect", () => {
      // Nếu trước đó đang dở 1 trận (roomId đã lưu) -> tự động nối lại
      const savedRoom = sessionStorage.getItem("pkm_net_room_id");
      if (savedRoom) {
        roomId = savedRoom;
        socket.emit("room:rejoin", { roomId, playerId });
      }
    });

    socket.on("match:found", (data) => {
      roomId = data.roomId;
      unitsAllowed = data.unitsAllowed;
      opponentId = data.opponentId;
      sessionStorage.setItem("pkm_net_room_id", roomId);
      stopped = false;
      emit("matchFound", data);
    });

    socket.on("queue:timeout", () => emit("queueTimeout"));
    socket.on("match:cancelled", (data) => emit("matchCancelled", data));

    socket.on("battle:start", (data) => {
      myTeamFinal = data.myTeam;
      oppTeamFinal = data.oppTeam;
      emit("battleStart", data);
    });

    socket.on("state:update", (data) => {
      latestState = data;
      emit("stateUpdate", data);
      askNextRoundQuestion();
    });

    socket.on("battle:end", (data) => {
      stopped = true;
      sessionStorage.removeItem("pkm_net_room_id");
      emit("battleEnd", data);
    });

    socket.on("room:rejoin_ok", (data) => {
      unitsAllowed = data.unitsAllowed;
      latestState = data;
      stopped = false;
      emit("stateUpdate", data); // vẽ lại đúng trạng thái hiện tại ngay khi nối lại
      askNextRoundQuestion();
    });
    socket.on("room:rejoin_failed", () => {
      sessionStorage.removeItem("pkm_net_room_id");
      roomId = null;
    });

    socket.on("opponent:disconnected", () => emit("opponentDisconnected"));
    socket.on("opponent:reconnected", () => emit("opponentReconnected"));

    // ---------- Khu vực chờ (lobby) + thách đấu ----------
    socket.on("lobby:update", (data) => emit("lobbyUpdate", data));
    socket.on("challenge:incoming", (data) => emit("challengeIncoming", data));
    socket.on("challenge:sent", (data) => emit("challengeSent", data));
    socket.on("challenge:declined", (data) => emit("challengeDeclined", data));
    socket.on("challenge:queued", (data) => emit("challengeQueued", data));
    socket.on("challenge:error", (data) => emit("challengeError", data));

    return socket;
  }

  // Gọi ngay khi vào trang online (trước khi ghép trận) để hiện diện
  // trong danh sách "ai đang online", cho phép người khác thách đấu.
  function joinLobby(className, ownedCount) {
    connect();
    ensurePlayerId();
    const name = localStorage.getItem("trainerName") || "Ẩn danh";
    socket.emit("lobby:join", { playerId, name, className, ownedCount });
  }

  function joinQueue(ownedCount) {
    connect();
    ensurePlayerId();
    const name = localStorage.getItem("trainerName") || "Ẩn danh";
    socket.emit("queue:join", { playerId, ownedCount, name });
  }
  function cancelQueue() { if (socket) socket.emit("queue:cancel"); }

  function sendChallenge(toPlayerId, message) {
    if (!socket) return;
    socket.emit("challenge:send", { toPlayerId, message });
  }
  function acceptChallenge(fromPlayerId) {
    if (!socket) return;
    socket.emit("challenge:accept", { fromPlayerId });
  }
  function declineChallenge() {
    if (!socket) return;
    socket.emit("challenge:decline");
  }

  // team: [{id, name, type, hp, atk, def, sAtk}, ...] tối đa unitsAllowed con
  function submitTeam(team) {
    if (!socket || !roomId) return;
    socket.emit("team:submit", { roomId, team });
  }

  function submitAnswer(correct) {
    if (!socket || !roomId || !latestState) return;
    socket.emit("answer:submit", { roomId, correct, turnCounter: latestState.turnCounter });
  }

  function isMyTurnPrimary() {
    return !!(latestState && latestState.primaryId === playerId);
  }

  function getMyPlayerId() { return playerId; }
  function getState() { return latestState; }
  function getTeams() { return { myTeam: myTeamFinal, oppTeam: oppTeamFinal }; }
  function getRoomInfo() { return { roomId, unitsAllowed, opponentId }; }

  // ============ VÒNG LẶP HỎI-ĐÁP: CHÍNH ảnh hưởng đòn đánh, PHỤ chỉ luyện tập ============
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

      // Luôn tính KN/DV như chế độ đơn, bất kể đang CHÍNH hay PHỤ
      if (window.PkmScore) window.PkmScore.recordAnswer(isCorrect);

      if (primary) {
        submitAnswer(isCorrect); // gửi lên server -> quyết định đòn đánh lượt này
      }
      // Bên PHỤ: không gửi gì cả — chờ state:update kế tiếp (do đối thủ vừa
      // trả lời xong bên CHÍNH, hoặc do hết 25s timeout) để tự hỏi câu mới.

      emit("answered", { correct: isCorrect, wasPrimary: primary }); // cho pkm_battle_online.js hiển thị tally nếu muốn
    });
  }

  return {
    connect, joinLobby, joinQueue, cancelQueue, submitTeam, submitAnswer,
    sendChallenge, acceptChallenge, declineChallenge,
    isMyTurnPrimary, getMyPlayerId, getState, getTeams, getRoomInfo,
    askNextRoundQuestion, on,
  };
})();
