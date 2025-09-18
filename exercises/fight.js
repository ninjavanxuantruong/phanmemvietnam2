// ===== Part 1/3 =====

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { 
  getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCCVdzWiiFvcWiHVJN-x33YKarsjyziS8E",
  authDomain: "pokemon-capture-10d03.firebaseapp.com",
  projectId: "pokemon-capture-10d03",
  storageBucket: "pokemon-capture-10d03.firebasestorage.app",
  messagingSenderId: "1068125543917",
  appId: "1:1068125543917:web:57de4365ee56729ea8dbe4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Identity
const trainerName = localStorage.getItem("trainerName") || "player";
const trainerClass = localStorage.getItem("trainerClass") || "X";
const playerName = `${trainerName}-${trainerClass}`;

// UI
const meName = document.getElementById("meName");

const chatBox = document.getElementById("chatBox");

function appendChatBubble(text, isP1) {
  const div = document.createElement("div");
  div.textContent = text;
  div.style.maxWidth = "70%";
  div.style.padding = "8px 12px";
  div.style.borderRadius = "12px";
  div.style.background = isP1 ? "#e0ffe8" : "#e0f0ff";
  div.style.alignSelf = isP1 ? "flex-start" : "flex-end";
  chatBox.appendChild(div);
  chatBox.scrollTop = chatBox.scrollHeight;
}


const levelSelect = document.getElementById("levelSelect");
const joinBtn = document.getElementById("joinBtn");
const leaveBtn = document.getElementById("leaveBtn");
const statusDiv = document.getElementById("status");
const gameArea = document.getElementById("gameArea");
const roomIdSpan = document.getElementById("roomId");
const roomLevelSpan = document.getElementById("roomLevel");
const turnIndexSpan = document.getElementById("turnIndex");
const p1Span = document.getElementById("p1");
const p2Span = document.getElementById("p2");
const currentTurnSpan = document.getElementById("currentTurn");
const questionText = document.getElementById("questionText");
const recordBtn = document.getElementById("recordBtn");
const speechResultDiv = document.getElementById("speechResult");

// Tạo khu vực điểm (nếu chưa có sẵn trong HTML)
let scoreP1El = document.getElementById("scoreP1");
let scoreP2El = document.getElementById("scoreP2");
(function ensureScoreboard() {
  if (!scoreP1El || !scoreP2El) {
    const sb = document.createElement("div");
    sb.id = "scoreboard";
    sb.style.display = "flex";
    sb.style.alignItems = "center";
    sb.style.justifyContent = "space-between";
    sb.style.gap = "16px";
    const left = document.createElement("div");
    left.id = "scoreP1";
    left.className = "score left";
    left.textContent = "0";
    const center = document.createElement("div");
    center.id = "questionArea";
    center.style.flex = "1";
    center.style.textAlign = "center";
    const right = document.createElement("div");
    right.id = "scoreP2";
    right.className = "score right";
    right.textContent = "0";
    sb.appendChild(left);
    sb.appendChild(center);
    sb.appendChild(right);
    gameArea?.prepend(sb);
    // Map questionText to center (use existing questionText as content holder)
    center.appendChild(questionText);
    scoreP1El = left;
    scoreP2El = right;
  }
})();

// Speech
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
let recognition = null;
if (SpeechRecognition) {
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
}

// State
let currentLevel = null;
let currentRoomId = null;
let unsubRoom = null;

// “Đồng hồ chung” và thông số trận
const TURN_MS = 10000;       // 10 giây mỗi lượt
const START_DELAY_MS = 3000; // trễ 3 giây để 2 máy kịp đồng bộ
const QUESTIONS_PER_SIDE = 10;
const TOTAL_TURNS = QUESTIONS_PER_SIDE * 2;
const SCORE_THRESHOLD = 60;  // % từ đúng tối thiểu tính là đúng

let serverStartMs = null;    // startTimestamp (ms) từ server
let clockOffset = 0;         // hiệu chỉnh lệch giờ: serverStart - localNow
let uiTick = null;           // interval update UI theo thời gian
let lastComputedTurn = -1;   // để phát hiện biên lượt
let lastWasMyTurn = false;   // lượt trước có phải của mình
let answeredThisTurn = false;// đã trả lời trong lượt hiện tại chưa

let scoreP1 = 0;
let scoreP2 = 0;

const isMobile = /Mobi|Android/i.test(navigator.userAgent);

// Sheets
const SHEET_BAI_HOC = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
const SHEET_TU_VUNG = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

let questionsP1 = []; // Player1: câu hỏi (J)
let questionsP2 = []; // Player2: câu trả lời (L)
let lastRoomData = null; // snapshot mới nhất

meName.textContent = playerName;

// Helpers
function roomDocRef(level, roomId) {
  return doc(db, String(level), roomId);
}

async function ensureRoomExists(level, roomId) {
  const ref = roomDocRef(level, roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      player1: null,
      player2: null,
      started: false,
      status: null,     // "player_left" | "finished" | null
      winner: null,
      startTimestamp: null,
      questions: null,
      lastUpdated: Date.now(),
      // Dọn sau 160s kể từ khi start (client sẽ chủ động xóa)
      cleanupAt: null
    });
  }
  return ref;
}

// Lấy đúng cặp J-L, theo đúng trình độ
async function getQuestionsFromSheet() {
  const resBaiHoc = await fetch(SHEET_BAI_HOC);
  const textBaiHoc = await resBaiHoc.text();
  const jsonBaiHoc = JSON.parse(textBaiHoc.substring(47).slice(0, -2));
  const rowsBaiHoc = jsonBaiHoc.table.rows;

  const baiList = rowsBaiHoc
    .map(r => {
      const lopRaw = r.c[0]?.v?.toString().trim();
      const bai = r.c[2]?.v?.toString().trim();
      const lopNum = parseInt(lopRaw?.replace(/\D/g, ""));
      const classNum = parseInt(trainerClass?.replace(/\D/g, ""));
      return lopNum === classNum && bai ? parseInt(bai) : null;
    })
    .filter(v => typeof v === "number");

  if (baiList.length === 0) return { p1: [], p2: [] };
  const maxLessonCode = Math.max(...baiList);

  const resTuVung = await fetch(SHEET_TU_VUNG);
  const textTuVung = await resTuVung.text();
  const jsonTuVung = JSON.parse(textTuVung.substring(47).slice(0, -2));
  const rows = jsonTuVung.table.rows.slice(1);

  const pairs = [];
  rows.forEach(r => {
    const rawCode = r.c[1]?.v?.toString().trim();
    const questionJ = r.c[9]?.v?.toString().trim();  // Cột J
    const answerL   = r.c[11]?.v?.toString().trim(); // Cột L
    const normalizedCode = parseInt(rawCode?.replace(/\D/g, ""));
    if (!normalizedCode || normalizedCode > maxLessonCode) return;
    if (questionJ && answerL) {
      pairs.push({ q: questionJ, a: answerL });
    }
  });

  // Trộn và lấy tối đa QUESTIONS_PER_SIDE
  pairs.sort(() => Math.random() - 0.5);
  const selected = pairs.slice(0, QUESTIONS_PER_SIDE);

  const quizItemsP1 = selected.map(p => p.q); // Player1 nói J
  const quizItemsP2 = selected.map(p => p.a); // Player2 nói L (đáp án đúng của J tương ứng)

  return { p1: quizItemsP1, p2: quizItemsP2 };
}

// Tính trạng thái theo thời gian server (đã hiệu chỉnh)
function computeTurnState() {
  if (!lastRoomData || !serverStartMs) return null;

  const startWithDelay = serverStartMs + START_DELAY_MS;
  const elapsed = Date.now() - startWithDelay;


  if (elapsed < 0) {
    return {
      startedVisually: false,
      turnIndex: 0,
      currentPlayer: lastRoomData.player1
    };
  }

  let turnIndex = Math.floor(elapsed / TURN_MS);
  if (turnIndex < 0) turnIndex = 0;
  if (turnIndex > TOTAL_TURNS) turnIndex = TOTAL_TURNS;

  // Lượt chẵn: player1, lẻ: player2
  const currentPlayer = (turnIndex % 2 === 0) ? lastRoomData.player1 : lastRoomData.player2;

  return {
    startedVisually: true,
    turnIndex,
    currentPlayer
  };
}
// ===== Part 2/3 =====

 // div mới thay cho questionText




// Hiển thị UI theo state
function renderRoom(data) {
  p1Span.textContent = data.player1 || "—";
  p2Span.textContent = data.player2 || "—";

  const state = computeTurnState();
  if (!state) return;

  const isP1Turn = state.currentPlayer === data.player1;
  const isP2Turn = state.currentPlayer === data.player2;

  p1Span.className = "badge " + (isP1Turn ? "red" : (data.player1 ? "green" : ""));
  p2Span.className = "badge " + (isP2Turn ? "red" : (data.player2 ? "green" : ""));

  currentTurnSpan.textContent = state.currentPlayer || "—";

  // Câu hiển thị theo lượt
  const idx = Math.floor(state.turnIndex / 2); // mỗi bên 1 câu/2 lượt
  const myIsP1 = (playerName === data.player1);

  let displayText = "";
  if (!state.startedVisually) {
    displayText = "Chuẩn bị bắt đầu...";
  } else if (state.turnIndex >= TOTAL_TURNS) {
    displayText = "Hết câu hỏi!";
  } else {
    if (state.turnIndex % 2 === 0) {
      // P1 nói (đọc J)
      displayText = questionsP1[idx] || "—";
    } else {
      // P2 nói (đọc L)
      displayText = questionsP2[idx] || "—";
    }

  }

  appendChatBubble(displayText, state.currentPlayer === data.player1);


  // Mic: chỉ bật cho người đang có lượt và còn trong phạm vi câu hỏi
  const myTurn = state.startedVisually && state.turnIndex < TOTAL_TURNS && (state.currentPlayer === playerName);
  recordBtn.disabled = !myTurn || (idx >= QUESTIONS_PER_SIDE);

  // Điểm hiển thị
  scoreP1El.textContent = String(scoreP1);
  scoreP2El.textContent = String(scoreP2);

  // Lượt và chỉ số để người chơi nắm được tiến độ
  turnIndexSpan.textContent = String(state.turnIndex);
}

// Join phòng
async function tryJoinFirstAvailableRoom(level) {
  for (let i = 1; i <= 30; i++) {
    const roomId = `room-${i}`;
    const ref = await ensureRoomExists(level, roomId);
    const snap = await getDoc(ref);
    const data = snap.data();

    if (data.status === "player_left" || data.status === "finished") continue;

    if (data.player1 === playerName || data.player2 === playerName) {
      await attachRoom(level, roomId);
      return { level, roomId };
    }

    if (!data.player1) {
      await updateDoc(ref, {
        player1: playerName,
        started: false,
        status: null,
        winner: null,
        startTimestamp: null,
        questions: null,
        cleanupAt: null,
        lastUpdated: Date.now()
      });
      await attachRoom(level, roomId);
      return { level, roomId };
    }

    if (!data.player2 && data.player1 !== playerName) {
      // Player 2 vào → tạo câu hỏi và start
      const { p1, p2 } = await getQuestionsFromSheet();
      const questions = p1.map((q, idx) => ({ q, a: p2[idx] }));

      await updateDoc(ref, {
        player2: playerName,
        questions,
        started: true,
        startTimestamp: serverTimestamp(),
        status: null,
        winner: null,
        cleanupAt: Date.now() + 260000, // dấu mốc client-side
        lastUpdated: Date.now()
      });

      await attachRoom(level, roomId);
      return { level, roomId };
    }
  }
  throw new Error("Không còn phòng trống trong trình độ này.");
}

// Attach snapshot
async function attachRoom(level, roomId) {
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  currentLevel = String(level);
  currentRoomId = roomId;

  roomIdSpan.textContent = currentRoomId;
  roomLevelSpan.textContent = currentLevel;

  const ref = roomDocRef(level, roomId);

  unsubRoom = onSnapshot(ref, (snap) => {
    if (!snap.exists()) {
      statusDiv.textContent = "⚠️ Phòng đã bị xoá.";
      leaveRoom();
      return;
    }

    const data = snap.data();
    lastRoomData = data;

    // Kết thúc hoặc ai rời
    if (data.status === "player_left" || data.status === "finished") {
      statusDiv.textContent = data.winner
        ? `🏆 ${data.winner} thắng!`
        : "🏆 Đối thủ đã thoát. Bạn thắng!";

      setTimeout(async () => {
        try { await deleteDoc(ref); } catch {}
        await leaveRoom();
      }, 3000);
      return;
    }

    // Đồng bộ câu hỏi
    if (data.questions && Array.isArray(data.questions)) {
      // Player1 nói J, Player2 nói L
      if (playerName === data.player1) {
        questionsP1 = data.questions.map(p => p.q);
        questionsP2 = data.questions.map(p => p.a);
      } else {
        questionsP1 = data.questions.map(p => p.q);
        questionsP2 = data.questions.map(p => p.a);
      }
    }

    // Đồng bộ startTimestamp và clockOffset
    if (data.startTimestamp) {
      serverStartMs = data.startTimestamp.toMillis();
    }


    renderRoom(data);
  });

  // Vòng tick UI
  clearInterval(uiTick);
  uiTick = setInterval(async () => {
    if (!lastRoomData || !serverStartMs) return;

    // Kiểm tra đến hạn cleanupAt (client-side dọn dẹp)
    if (lastRoomData.cleanupAt && Date.now() > lastRoomData.cleanupAt) {
      try { await deleteDoc(roomDocRef(currentLevel, currentRoomId)); } catch {}
      await leaveRoom();
      return;
    }

    const state = computeTurnState();
    if (!state) return;

    // Kết thúc trận khi qua TOTAL_TURNS
    if (state.startedVisually && state.turnIndex >= TOTAL_TURNS) {
      await finishMatch();
      return;
    }

    // Phát hiện sang lượt mới
    if (state.startedVisually && state.turnIndex !== lastComputedTurn) {
      // Nếu lượt trước là của mình mà chưa trả lời → 0 điểm lượt đó (không cộng)
      // Reset trạng thái lượt mới
      answeredThisTurn = false;
      lastComputedTurn = state.turnIndex;
      lastWasMyTurn = (state.currentPlayer === playerName);
    }

    renderRoom(lastRoomData);
  }, 500);
}
// ===== Part 3/3 =====

// Bắt mic khi nhấn nút (chỉ có tác dụng khi tới lượt mình và không hết câu)
recordBtn.addEventListener("click", () => {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert("Thiết bị của bạn không hỗ trợ nhận giọng nói.");
    return;
  }
  const state = computeTurnState();
  if (!state || !state.startedVisually || state.turnIndex >= TOTAL_TURNS) return;
  if (state.currentPlayer !== playerName) return;

  const idx = Math.floor(state.turnIndex / 2);
  if (idx >= QUESTIONS_PER_SIDE) return;

  const recognitionLocal = new SR();
  recognitionLocal.lang = "en-US";
  recognitionLocal.interimResults = false;
  recognitionLocal.maxAlternatives = 1;

  speechResultDiv.textContent = "🎙️ Đang nghe...";
  recognitionLocal.start();

  recognitionLocal.onresult = (event) => {
    try { recognitionLocal.stop(); } catch {}
    const transcript = event.results[0][0].transcript.toLowerCase().trim();

    // Xác định văn bản tham chiếu đúng cho lượt này
    let referenceText = "";
    if (state.turnIndex % 2 === 0) {
      // Lượt P1 nói J
      referenceText = questionsP1[idx] || "";
    } else {
      // Lượt P2 nói L
      referenceText = questionsP2[idx] || "";
    }

    const { percent, isCorrect } = gradeSpeech(transcript, referenceText);
    speechResultDiv.innerHTML =
      `✅ Bạn nói: "<i>${transcript}</i>"<br>🎯 Đúng ${percent}%`;

    appendChatBubble(`💬 ${transcript}`, (state.turnIndex % 2 === 0));


    // Cập nhật điểm cục bộ
    if (isCorrect) {
      if (state.turnIndex % 2 === 0) {
        // P1 lượt
        scoreP1++;
        scoreP1El.textContent = String(scoreP1);
        flashScore(scoreP1El);
      } else {
        // P2 lượt
        scoreP2++;
        scoreP2El.textContent = String(scoreP2);
        flashScore(scoreP2El);
      }
    }


    answeredThisTurn = true;
  };

  recognitionLocal.onerror = (event) => {
    speechResultDiv.innerText = `❌ Lỗi: ${event.error}`;
  };
});

// So khớp lời nói
function gradeSpeech(userText, referenceText) {
  const cleanRef = referenceText.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const user = userText.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const refWords = cleanRef.split(/\s+/).filter(Boolean);
  const userWords = user.split(/\s+/).filter(Boolean);

  let correct = 0;
  for (let w of refWords) if (userWords.includes(w)) correct++;
  const percent = refWords.length ? Math.round((correct / refWords.length) * 100) : 0;
  const isCorrect = percent >= SCORE_THRESHOLD;
  return { percent, isCorrect };
}

// Hiệu ứng điểm
function flashScore(el) {
  el.style.transition = "transform 0.2s ease, color 0.2s ease";
  const oldColor = el.style.color;
  el.style.transform = "scale(1.2)";
  el.style.color = "#16a34a";
  setTimeout(() => {
    el.style.transform = "scale(1)";
    el.style.color = oldColor || "";
  }, 220);
}

// Kết thúc trận
async function finishMatch() {
  if (!currentLevel || !currentRoomId || !lastRoomData) return;
  // Tránh gọi nhiều lần
  if (statusDiv.dataset.finished === "1") return;
  statusDiv.dataset.finished = "1";

  let winner = null;
  if (scoreP1 > scoreP2) winner = lastRoomData.player1;
  else if (scoreP2 > scoreP1) winner = lastRoomData.player2;
  else winner = "Hòa";

  // Thông báo điểm của cả hai
  statusDiv.innerHTML = `
    📊 Điểm cuối:<br>
    ${lastRoomData.player1}: ${scoreP1} điểm<br>
    ${lastRoomData.player2}: ${scoreP2} điểm<br>
    ${winner === "Hòa" ? "🤝 Hòa!" : `🏆 ${winner} thắng!`}
  `;

  // Gửi điểm cuối trận lên Firebase 1 lần duy nhất
  await updateDoc(ref, {
    status: "finished",
    winner: (winner === "Hòa") ? null : winner,
    finalScores: { p1: scoreP1, p2: scoreP2 },
    lastUpdated: Date.now()
  });

  // Đợi 5 giây rồi thoát
  setTimeout(async () => {
    try { await deleteDoc(ref); } catch {}
    await leaveRoom();
  }, 5000);

}

// Thoát phòng chuẩn
async function leaveRoom() {
  if (recognition) recognition.stop();
  clearInterval(uiTick);
  if (!currentLevel || !currentRoomId) {
    resetUiAfterLeave();
    return;
  }

  const ref = roomDocRef(currentLevel, currentRoomId);
  try {
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      const updates = {
        lastUpdated: Date.now(),
        started: false
      };

      if (data.player1 === playerName) {
        updates.player1 = null;
      } else if (data.player2 === playerName) {
        updates.player2 = null;
      }

      if ((data.player1 === playerName && !data.player2) ||
          (data.player2 === playerName && !data.player1)) {
        try { await deleteDoc(ref); } catch {}
      } else {
        await updateDoc(ref, updates);
      }
    }
  } catch {}

  if (unsubRoom) { unsubRoom(); unsubRoom = null; }

  resetUiAfterLeave();
}

// Thoát nhanh cho mobile (đánh dấu trạng thái)
async function leaveRoomFast() {
  try {
    if (!currentLevel || !currentRoomId) return;
    const ref = roomDocRef(currentLevel, currentRoomId);
    await updateDoc(ref, {
      status: "player_left",
      lastUpdated: Date.now()
    });
  } catch (e) {
    console.warn("leaveRoomFast error", e);
  }
}

// Reset UI/State sau khi thoát
function resetUiAfterLeave() {
  currentLevel = null;
  currentRoomId = null;
  lastRoomData = null;
  serverStartMs = null;
  clockOffset = 0;
  lastComputedTurn = -1;
  lastWasMyTurn = false;
  answeredThisTurn = false;
  scoreP1 = 0; scoreP2 = 0;
  scoreP1El.textContent = "0";
  scoreP2El.textContent = "0";
  roomIdSpan.textContent = "—";
  roomLevelSpan.textContent = "—";
  p1Span.textContent = "—"; p1Span.className = "badge";
  p2Span.textContent = "—"; p2Span.className = "badge";
  currentTurnSpan.textContent = "—";
  questionText.textContent = "—";
  questionText.classList.remove("left", "right");
  turnIndexSpan.textContent = "0";
  gameArea.style.display = "none";
  statusDiv.textContent = "Đã thoát phòng.";
  delete statusDiv.dataset.finished;
}

// Nút join
joinBtn.addEventListener("click", async () => {
  try {
    const level = levelSelect.value;
    if (currentRoomId) {
      alert("Bạn đã ở trong phòng. Hãy thoát trước khi tham gia phòng khác.");
      return;
    }
    statusDiv.textContent = "Đang tìm phòng trống...";
    const { roomId } = await tryJoinFirstAvailableRoom(level);
    statusDiv.textContent = `Đã tham gia phòng ${roomId}.`;
    gameArea.style.display = "block";
  } catch (e) {
    console.error(e);
    statusDiv.textContent = e.message || "Lỗi tham gia phòng.";
    alert(e.message || "Lỗi tham gia phòng.");
  }
});

// Nút leave
leaveBtn.addEventListener("click", async () => {
  await leaveRoom();
});

// PC: đóng tab/reload → thoát chuẩn
if (!isMobile) {
  window.addEventListener("beforeunload", () => {
    leaveRoom();
  });
}

// Mobile: ẩn tab/app → ân hạn 10s rồi đánh dấu rời
let leaveGraceTimeout = null;
if (isMobile) {
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") {
      clearTimeout(leaveGraceTimeout);
      leaveGraceTimeout = setTimeout(() => {
        leaveRoomFast();
      }, 10000);
    } else {
      clearTimeout(leaveGraceTimeout);
    }
  });

  window.addEventListener("pagehide", () => {
    leaveRoomFast();
  });
}
