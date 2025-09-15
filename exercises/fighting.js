import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot } 
from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";


// Firebase config
const firebaseConfig = {
  apiKey: "AIzaSyCCVdzWiiFvcWiHVJN-x33YKarsjyziS8E",
  authDomain: "pokemon-capture-10d03.firebaseapp.com",
  projectId: "pokemon-capture-10d03",
  storageBucket: "pokemon-capture-10d03.firebasestorage.app",
  messagingSenderId: "1068125543917",
  appId: "1:1068125543917:web:57de4365ee56729ea8dbe4"
};

// Init Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Local identity
const trainerName = localStorage.getItem("trainerName") || "player";
const trainerClass = localStorage.getItem("trainerClass") || "X";
const playerName = `${trainerName}-${trainerClass}`;

// UI
const meName = document.getElementById("meName");
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
let turnTimer = null; // hẹn giờ cho lượt

function startTurnTimer() {
  clearTimeout(turnTimer);
  turnTimer = setTimeout(() => {
    autoEndTurn();
  }, 30000); // 30 giây
}

async function autoEndTurn() {
  if (!currentLevel || !currentRoomId) return;
  const ref = roomDocRef(currentLevel, currentRoomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();

  // Chỉ auto-end nếu vẫn là lượt của mình và trận đang chạy
  if (data.currentTurn === playerName && data.started) {
    // Dừng ghi âm nếu đang chạy
    if (recognition) recognition.stop();
    const nextIndex = data.turnIndex + 1;
    const nextTurn = (data.currentTurn === data.player1) ? data.player2 : data.player1;

    await updateDoc(ref, {
      turnIndex: nextIndex,
      currentTurn: nextTurn,
      lastUpdated: Date.now()
    });
  }
}

function stopTurnTimer() {
  clearTimeout(turnTimer);
}


// ====== Lấy câu hỏi từ Google Sheet ======
const SHEET_BAI_HOC = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
const SHEET_TU_VUNG = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

async function getMaxLessonCode() {
  const res = await fetch(SHEET_BAI_HOC);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const baiList = rows
    .map(r => {
      const lop = r.c[0]?.v?.toString().trim();
      const bai = r.c[2]?.v?.toString().trim();
      return lop === trainerClass && bai ? parseInt(bai) : null;
    })
    .filter(v => typeof v === "number");

  if (baiList.length === 0) return null;
  return Math.max(...baiList);
}

async function getQuestionsFromSheet() {
  const maxLessonCode = await getMaxLessonCode();
  if (!maxLessonCode) {
    console.warn("⚠️ Không tìm thấy bài học hợp lệ");
    return { p1: [], p2: [] };
  }

  const res = await fetch(SHEET_TU_VUNG);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows.slice(1);

  const baiTuVung = {};
  rows.forEach(r => {
    const rawCode = r.c[1]?.v?.toString().trim();
    const meaning = r.c[24]?.v?.toString().trim();
    const questionJ = r.c[9]?.v?.toString().trim();  // Cột J
    const answerL   = r.c[11]?.v?.toString().trim(); // Cột L

    const normalizedCode = parseInt(rawCode?.replace(/\D/g, ""));
    if (!normalizedCode || normalizedCode > maxLessonCode || !meaning) return;

    if (!baiTuVung[normalizedCode]) baiTuVung[normalizedCode] = [];
    baiTuVung[normalizedCode].push({ meaning, questionJ, answerL });
  });

  const allCodes = Object.keys(baiTuVung).map(c => parseInt(c)).sort(() => Math.random() - 0.5);

  const usedMeanings = new Set();
  const quizItemsP1 = [];
  const quizItemsP2 = [];

  allCodes.forEach(code => {
    const words = baiTuVung[code];
    if (!words || words.length === 0) return;

    const candidates = words.filter(w => !usedMeanings.has(w.meaning));
    if (candidates.length === 0) return;

    const item = candidates[Math.floor(Math.random() * candidates.length)];
    usedMeanings.add(item.meaning);

    if (item.questionJ && quizItemsP1.length < 10) quizItemsP1.push(item.questionJ);
    if (item.answerL && quizItemsP2.length < 10) quizItemsP2.push(item.answerL);

    if (quizItemsP1.length >= 10 && quizItemsP2.length >= 10) return;
  });

  return { p1: quizItemsP1, p2: quizItemsP2 };
}

// Gọi hàm này khi bắt đầu trận để lấy câu hỏi cho từng người
let questionsP1 = [];
let questionsP2 = [];

(async () => {
  const { p1, p2 } = await getQuestionsFromSheet();
  questionsP1 = p1;
  questionsP2 = p2;

  // Log ra để kiểm tra
  console.log("📋 Danh sách câu hỏi cho Player 1:", questionsP1);
  console.log("📋 Danh sách câu hỏi cho Player 2:", questionsP2);
})();



// Init UI
meName.textContent = playerName;

// Helpers
function roomDocRef(level, roomId) {
  // Collection per level: "2", "3", "4", "5", "6"; docs: "room-1"..."room-30"
  return doc(db, String(level), roomId);
}

async function ensureRoomExists(level, roomId) {
  const ref = roomDocRef(level, roomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    await setDoc(ref, {
      player1: null,
      player2: null,
      currentTurn: null,
      turnIndex: 0,
      started: false,
      lastUpdated: Date.now()
    });
  }
  return ref;
}

function checkAccuracy(userText, referenceText) {
  const cleanRef = referenceText.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const user = userText.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const refWords = cleanRef.split(/\s+/);
  const userWords = user.split(/\s+/);

  let correct = 0;
  for (let word of refWords) {
    if (userWords.includes(word)) correct++;
  }

  const percent = Math.round((correct / refWords.length) * 100);
  speechResultDiv.innerHTML =
    `✅ Bạn nói: "<i>${userText}</i>"<br>🎯 Đúng ${correct}/${refWords.length} từ → <b>${percent}%</b>`;

  // Sau khi chấm xong → tự động hoàn thành lượt
  completeTurn();
}


function renderRoom(data) {
  // Names
  p1Span.textContent = data.player1 || "—";
  p2Span.textContent = data.player2 || "—";

  // Color badges by turn
  const isP1Turn = data.currentTurn && data.player1 && data.currentTurn === data.player1;
  const isP2Turn = data.currentTurn && data.player2 && data.currentTurn === data.player2;

  p1Span.className = "badge " + (isP1Turn ? "red" : (data.player1 ? "green" : ""));
  p2Span.className = "badge " + (isP2Turn ? "red" : (data.player2 ? "green" : ""));

  currentTurnSpan.textContent = data.currentTurn || "—";

  // CHỈ khai báo 1 lần ở đây
  const myQuestions = (playerName === data.player1) ? questionsP1 : questionsP2;

  turnIndexSpan.textContent = Math.min(data.turnIndex, myQuestions.length);

  // Question
  questionText.textContent = data.started ? (myQuestions[data.turnIndex] || "Hết câu hỏi!") : "Chưa bắt đầu.";



  // Buttons
  const myTurn = data.currentTurn === playerName && data.started;
  recordBtn.disabled = !myTurn || data.turnIndex >= myQuestions.length;

  if (myTurn) {
    startTurnTimer();
  } else {
    stopTurnTimer();
  }

  if (myTurn) {
    startTurnTimer();

    // ⬇️ Khởi tạo recognition mỗi lượt (giống speaking.js)
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Thiết bị của bạn không hỗ trợ nhận giọng nói.");
      return;
    }
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recordBtn.onclick = () => {
      speechResultDiv.textContent = "🎙️ Đang nghe...";
      recognition.start();
    };

    recognition.onresult = (event) => {
      if (recognition) recognition.stop(); // dừng ngay khi có kết quả
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      checkAccuracy(transcript, myQuestions[data.turnIndex]);

    };

    recognition.onerror = (event) => {
      speechResultDiv.innerText = `❌ Lỗi: ${event.error}`;
    };
  } else {
    stopTurnTimer();
  }


  // Game area visibility
  gameArea.style.display = (data.player1 || data.player2) ? "block" : "none";
}

if (recognition) {
  recognition.onresult = (event) => {
    if (recognition) recognition.stop(); // ⛔ Dừng ghi âm ngay khi có kết quả
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    const myQuestions = (playerName === data.player1) ? questionsP1 : questionsP2;
    const refText = myQuestions[data.turnIndex]; // câu hiện tại
    checkAccuracy(transcript, refText);


  };


  recognition.onerror = (event) => {
    speechResultDiv.innerText = `❌ Lỗi: ${event.error}`;
  };
}

recordBtn.addEventListener("click", () => {
  if (!recognition) {
    alert("Trình duyệt không hỗ trợ ghi âm.");
    return;
  }
  speechResultDiv.textContent = "🎙️ Đang nghe...";
  recognition.start();
});


async function tryJoinFirstAvailableRoom(level) {
  // scan room-1..room-30; prefer occupy player1 if empty, else player2 if empty
  for (let i = 1; i <= 30; i++) {
    const roomId = `room-${i}`;
    const ref = await ensureRoomExists(level, roomId);
    const snap = await getDoc(ref);
    const data = snap.data();

    // If I'm already in this room (browser rejoin), attach listener and return
    if (data.player1 === playerName || data.player2 === playerName) {
      await attachRoom(level, roomId);
      return { level, roomId };
    }

    // Take slot
    if (!data.player1) {
      await updateDoc(ref, {
        player1: playerName,
        currentTurn: null,
        started: false,
        turnIndex: 0,
        lastUpdated: Date.now()
      });
      await attachRoom(level, roomId);
      return { level, roomId };
    }
    if (!data.player2 && data.player1 !== playerName) {
      await updateDoc(ref, {
        player2: playerName,
        // start match now that 2 players exist
        started: true,
        currentTurn: data.currentTurn || data.player1, // player1 starts
        turnIndex: data.turnIndex || 0,
        lastUpdated: Date.now()
      });
      await attachRoom(level, roomId);
      return { level, roomId };
    }
  }
  throw new Error("Không còn phòng trống trong trình độ này.");
}

async function attachRoom(level, roomId) {
  // cleanup previous listener
  if (unsubRoom) {
    unsubRoom();
    unsubRoom = null;
  }
  currentLevel = String(level);
  currentRoomId = roomId;

  roomIdSpan.textContent = currentRoomId;
  roomLevelSpan.textContent = currentLevel;
  

  const ref = roomDocRef(level, roomId);
  unsubRoom = onSnapshot(ref, (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    renderRoom(data);

    // Status message
    if (!data.player2) {
      statusDiv.textContent = "Đang chờ đối thủ...";
    } else if (data.started) {
      statusDiv.textContent = "Trận đấu đã bắt đầu!";
    } else {
      statusDiv.textContent = "Đối thủ đã rời. Chờ người mới...";
    }
  });
}

// Actions
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
  } catch (e) {
    console.error(e);
    statusDiv.textContent = e.message || "Lỗi tham gia phòng.";
    alert(e.message || "Lỗi tham gia phòng.");
  }
});



async function completeTurn() {
  if (!currentLevel || !currentRoomId) return;
  const ref = roomDocRef(currentLevel, currentRoomId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;
  const data = snap.data();

  const nextIndex = data.turnIndex + 1;
  const myQuestions = (playerName === data.player1) ? questionsP1 : questionsP2;
  if (nextIndex >= myQuestions.length) {

    if (recognition) recognition.stop(); // ⛔ Dừng ghi âm khi trận kết thúc

    stopTurnTimer();
    statusDiv.textContent = "🎉 Trận đấu kết thúc!";
    setTimeout(async () => {
      await updateDoc(ref, {
        player1: null,
        player2: null,
        currentTurn: null,
        turnIndex: 0,
        started: false,
        lastUpdated: Date.now()
      });
      if (unsubRoom) { unsubRoom(); unsubRoom = null; }
      currentLevel = null;
      currentRoomId = null;
      gameArea.style.display = "none";
      statusDiv.textContent = "Chọn trình độ để bắt đầu trận mới.";
    }, 5000);
    return;
  }

  const nextTurn = (data.currentTurn === data.player1) ? data.player2 : data.player1;
  await updateDoc(ref, {
    turnIndex: nextIndex,
    currentTurn: nextTurn,
    lastUpdated: Date.now()
  });
}


// Cleanup when leaving
async function leaveRoom() {
  if (recognition) recognition.stop(); // ⛔ Dừng ghi âm khi thoát phòng
  stopTurnTimer(); // ⛔ Dừng hẹn giờ lượt nếu đang chạy
  if (!currentLevel || !currentRoomId) return;
  const ref = roomDocRef(currentLevel, currentRoomId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data();
    const updates = { lastUpdated: Date.now() };

    if (data.player1 === playerName) {
      updates.player1 = null;
    } else if (data.player2 === playerName) {
      updates.player2 = null;
    }

    // If someone leaves, stop the match
    updates.started = false;
    updates.currentTurn = null;

    // If room becomes empty → reset cleanly
    // Nếu mình là người cuối cùng rời phòng → xoá hẳn document
    if ((data.player1 === playerName && !data.player2) ||
        (data.player2 === playerName && !data.player1)) {
      await deleteDoc(ref);
    } else {
      await updateDoc(ref, updates);
    }

  }

  // Unsubscribe and reset UI state
  if (unsubRoom) { unsubRoom(); unsubRoom = null; }
  currentLevel = null;
  currentRoomId = null;
  roomIdSpan.textContent = "—";
  roomLevelSpan.textContent = "—";
  p1Span.textContent = "—"; p1Span.className = "badge";
  p2Span.textContent = "—"; p2Span.className = "badge";
  currentTurnSpan.textContent = "—";
  questionText.textContent = "—";
  turnIndexSpan.textContent = "0";
  
  gameArea.style.display = "none";
  statusDiv.textContent = "Đã thoát phòng.";
}

// Auto cleanup on tab close
window.addEventListener("beforeunload", async (e) => {
  // Best-effort cleanup; may not always complete due to browser timing
  try { await leaveRoom(); } catch {}
});
