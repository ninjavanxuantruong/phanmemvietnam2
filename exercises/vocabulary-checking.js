// collection-training.js
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { initNormalBattle, playerAttack, wildAttack } from "./effect-normal.js";

// Firebase config
const pokemonConfig = {
  apiKey: "AIzaSyCCVdzWiiFvcWiHVJN-x33YKarsjyziS8E",
  authDomain: "pokemon-capture-10d03.firebaseapp.com",
  projectId: "pokemon-capture-10d03",
  storageBucket: "pokemon-capture-10d03.appspot.com",
  messagingSenderId: "1068125543917",
  appId: "1:1068125543917:web:57de4365ee56729ea8dbe4"
};

let pokemonApp;
try { pokemonApp = initializeApp(pokemonConfig, "pokemonApp"); }
catch { pokemonApp = getApp("pokemonApp"); }
const dbPokemon = getFirestore(pokemonApp);

// State
const studentName = localStorage.getItem("trainerName") || "Không tên";
const studentClass = localStorage.getItem("trainerClass") || "Chưa có lớp";
const docId = `${studentName}-${studentClass}`;

let stars = 0;
let myPokemonId = 25;
let battle = null;

let quizItems = [];
let currentIndex = 0;
let correctCount = 0;
let wrongCount = 0;
let allRowsGlobal = [];

let quizFinished = false;

// Helpers: fetch sheets
async function fetchMaxLessonCode() {
  const SHEET_BAI_HOC = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
  const res = await fetch(SHEET_BAI_HOC);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const trainerClass = (localStorage.getItem("trainerClass") || "").trim();
  const baiList = rows
    .map(r => {
      const lop = r.c[0]?.v?.toString().trim();
      const bai = r.c[2]?.v?.toString().trim();
      return lop === trainerClass && bai ? parseInt(bai, 10) : null;
    })
    .filter(v => typeof v === "number");

  if (baiList.length === 0) return 0;
  return Math.max(...baiList);
}

async function fetchVocabItems(maxLessonCode) {
  const SHEET_TU_VUNG = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
  const res = await fetch(SHEET_TU_VUNG);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows.slice(1);

  const baiTuVung = {};
  rows.forEach(r => {
    const rawCode = r.c[1]?.v?.toString().trim();
    const word = r.c[2]?.v?.toString().trim();
    const meaning = r.c[24]?.v?.toString().trim();
    const normalizedCode = parseInt(rawCode?.replace(/\D/g, ""), 10);

    if (!normalizedCode || normalizedCode > maxLessonCode || !word || !meaning) return;
    if (!baiTuVung[normalizedCode]) baiTuVung[normalizedCode] = [];
    baiTuVung[normalizedCode].push({ word, meaning });
  });

  const allCodes = Object.keys(baiTuVung).map(c => parseInt(c, 10));
  const shuffledCodes = allCodes.sort(() => Math.random() - 0.5); // lấy hết

  const usedMeanings = new Set();
  const items = [];

  shuffledCodes.forEach(code => {
    const words = baiTuVung[code];
    if (!words || words.length === 0) return;

    const candidates = words.filter(w => !usedMeanings.has(w.meaning));
    if (candidates.length === 0) return;

    const item = candidates[Math.floor(Math.random() * candidates.length)];
    usedMeanings.add(item.meaning);
    items.push(item);
  });

  return { items, allRows: rows };
}

// Load player data
async function loadPlayerData() {
  const ref = doc(dbPokemon, "bosuutap", docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  stars = parseInt(data.stars || 0, 10);
  myPokemonId = data.selected || 25;
  const starEl = document.getElementById("starCount");
  if (starEl) starEl.textContent = stars;
}

// Quiz rendering
function renderQuestion(item, index, allRows) {
  const qBox = document.getElementById("questionBox");
  const optBox = document.getElementById("optionsBox");

  if (!qBox || !optBox) return;

  qBox.textContent = `Câu ${index + 1}: Nghĩa của "${item.word}" là gì?`;
  optBox.innerHTML = "";

  const utter = new SpeechSynthesisUtterance(item.word);
  utter.lang = "en-US";
  utter.rate = 0.9;
  speechSynthesis.speak(utter);

  const allMeanings = allRows
    .map(r => r.c[24]?.v?.toString().trim())
    .filter(m => m && m !== item.meaning);
  const wrongOptions = allMeanings.sort(() => Math.random() * 2 - 1).slice(0, 3);
  const options = [...wrongOptions, item.meaning].sort(() => Math.random() * 2 - 1);

  options.forEach(opt => {
    const div = document.createElement("div");
    div.className = "option";
    div.textContent = opt;
    div.onclick = () => handleAnswer(opt, item.meaning);
    optBox.appendChild(div);
  });
}

function handleAnswer(selected, correct) {
  const total = quizItems.length;

  if (selected === correct) {
    correctCount++;
    const el = document.getElementById("correctCount");
    if (el) el.textContent = correctCount;
    playerAttack(battle);
  } else {
    wrongCount++;
    const el = document.getElementById("wrongCount");
    if (el) el.textContent = wrongCount;
    wildAttack(battle);
  }

  currentIndex++;
  if (currentIndex < total) {
    renderQuestion(quizItems[currentIndex], currentIndex, allRowsGlobal);
  } else if (!quizFinished) {
    quizFinished = true;
    finishQuiz();
  }
}

async function finishQuiz() {
  const total = quizItems.length;
  const scorePercent = Math.round((correctCount / total) * 100);

  // Lưu sao nếu đạt yêu cầu
  if (scorePercent >= 75) {
    stars = stars + 5;
    const starEl = document.getElementById("starCount");
    if (starEl) starEl.textContent = stars;

    const ref = doc(dbPokemon, "bosuutap", docId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    await setDoc(ref, { ...data, stars });

    alert(`✅ Bạn đúng ${correctCount}/${total} (${scorePercent}%). Được cộng thêm 5 sao! ⭐`);
  } else {
    alert(`❌ Bạn đúng ${correctCount}/${total} (${scorePercent}%). Chưa đủ điều kiện để cộng sao.`);
  }

  // Đánh giá trình độ theo % đúng
  let level = "";
  if (scorePercent >= 90) level = "Xuất sắc (A1/A2 vững)";
  else if (scorePercent >= 75) level = "Khá (A1/A2 đạt)";
  else if (scorePercent >= 50) level = "Trung bình (cần ôn thêm)";
  else level = "Yếu (cần học lại từ vựng cơ bản)";

  alert(`📊 Đánh giá: ${level}`);
}

// Main flow
// Main flow
async function main() {
  const nameEl = document.getElementById("studentName");
  const starEl = document.getElementById("starCount");
  const cEl = document.getElementById("correctCount");
  const wEl = document.getElementById("wrongCount");

  if (nameEl) nameEl.textContent = studentName;
  if (starEl) starEl.textContent = 0;
  if (cEl) cEl.textContent = 0;
  if (wEl) wEl.textContent = 0;

  await loadPlayerData();

  // Khởi tạo battlefield (2 Pokémon đứng ở trên)
  battle = initNormalBattle(myPokemonId);

  // Lấy dữ liệu quiz
  const maxLessonCode = await fetchMaxLessonCode();
  if (!maxLessonCode) {
    alert("⚠️ Không tìm thấy bài học hợp lệ cho lớp hiện tại.");
    return;
  }

  const { items, allRows } = await fetchVocabItems(maxLessonCode);
  quizItems = items; // lấy toàn bộ từ vựng đến bài học max
  allRowsGlobal = allRows;

  // Reset trạng thái
  currentIndex = 0;
  correctCount = 0;
  wrongCount = 0;
  quizFinished = false;
  if (cEl) cEl.textContent = 0;
  if (wEl) wEl.textContent = 0;

  // Render câu hỏi đầu tiên
  if (quizItems.length > 0) {
    renderQuestion(quizItems[currentIndex], currentIndex, allRowsGlobal);
  } else {
    alert("❌ Không có dữ liệu từ vựng để tạo quiz.");
  }
}

// Đợi DOM sẵn sàng rồi mới gọi main
document.addEventListener("DOMContentLoaded", () => {
  main().catch(err => {
    console.error("Lỗi khởi tạo quiz:", err);
    alert("❌ Có lỗi khi khởi tạo quiz. Vui lòng thử lại.");
  });
});
