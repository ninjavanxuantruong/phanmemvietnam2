// collection-training.js
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { initNormalBattle, playerAttack, wildAttack } from "./effect-normal.js";

// ————————————————————————————————————————————————
// Firebase (project pokemon-capture-10d03) chỉ để đọc/ghi sao và pokemon đã chọn
// ————————————————————————————————————————————————
const pokemonConfig = {
  apiKey: "AIzaSyCCVdzWiiFvcWiHVJN-x33YKarsjyziS8E",
  authDomain: "pokemon-capture-10d03.firebaseapp.com",
  projectId: "pokemon-capture-10d03",
  storageBucket: "pokemon-capture-10d03.appspot.com",
  messagingSenderId: "1068125543917",
  appId: "1:106812475288:web:57de4365ee56729ea8dbe4"
};

let pokemonApp;
try { pokemonApp = initializeApp(pokemonConfig, "pokemonApp"); }
catch { pokemonApp = getApp("pokemonApp"); }
const dbPokemon = getFirestore(pokemonApp);

// ————————————————————————————————————————————————
// State
// ————————————————————————————————————————————————
const studentName = localStorage.getItem("trainerName") || "Không tên";
const studentClass = localStorage.getItem("trainerClass") || "Chưa có lớp";
document.getElementById("studentName").textContent = studentName;
const docId = `${studentName}-${studentClass}`;

let stars = 0;
let myPokemonId = 25;
let battle = null;

let quizItems = [];       // { word, meaning }
let currentIndex = 0;
let correctCount = 0;
const TOTAL_QUESTIONS = 20;

// ————————————————————————————————————————————————
// Helpers: fetch sheets theo đúng flow tham khảo
// ————————————————————————————————————————————————
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
  const rows = json.table.rows.slice(1); // bỏ dòng đầu

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
  const shuffledCodes = allCodes.sort(() => Math.random() - 0.5).slice(0, TOTAL_QUESTIONS);

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

// Lấy selected + stars từ Firestore
async function loadPlayerData() {
  const ref = doc(dbPokemon, "bosuutap", docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  stars = parseInt(data.stars || 0, 10);
  myPokemonId = data.selected || 25;
  document.getElementById("starCount").textContent = stars;
}

// ————————————————————————————————————————————————
// Quiz rendering per-question
// ————————————————————————————————————————————————
function renderQuestion(item, index, allRows) {
  document.getElementById("currentIndex").textContent = index + 1;

  // tạo 3 đáp án sai từ toàn bộ nghĩa khác
  const allMeanings = allRows
    .map(r => r.c[24]?.v?.toString().trim())
    .filter(m => m && m !== item.meaning);
  const wrongOptions = allMeanings.sort(() => Math.random() - 0.5).slice(0, 3);
  const options = [...wrongOptions, item.meaning].sort(() => Math.random() - 0.5);

  const box = document.getElementById("questionBox");
  box.innerHTML = `
    <div><strong>Câu ${index + 1}:</strong> Nghĩa của "<em>${item.word}</em>" là gì?</div>
    ${options.map((opt, i) => `
      <label class="option">
        <input type="radio" name="q${index}" value="${opt}" data-correct="${item.meaning}" />
        ${String.fromCharCode(65 + i)}. ${opt}
      </label>
    `).join("")}
  `;

  document.getElementById("hintBox").textContent = `Gợi ý: đáp án đúng nằm trong ${options.length} lựa chọn.`;
  document.getElementById("nextBtn").disabled = true;
}

function getSelectedValue(index) {
  const checked = document.querySelector(`input[name="q${index}"]:checked`);
  if (!checked) return null;
  return { value: checked.value, correct: checked.dataset.correct };
}

// ————————————————————————————————————————————————
// Flow: init → per-answer effect → next → finish
// ————————————————————————————————————————————————
async function main() {
  await loadPlayerData();

  // Khởi tạo sân đấu Pokémon (đứng yên)
  battle = initNormalBattle(myPokemonId);

  // Lấy dữ liệu bài học và từ vựng
  const maxLessonCode = await fetchMaxLessonCode();
  if (!maxLessonCode) {
    alert("⚠️ Không tìm thấy bài học hợp lệ cho lớp hiện tại.");
    return;
  }
  const { items, allRows } = await fetchVocabItems(maxLessonCode);
  if (!items || items.length === 0) {
    alert("⚠️ Không có từ vựng hợp lệ để tạo quiz.");
    return;
  }

  // Chốt 20 câu (hoặc ít hơn nếu dữ liệu hạn chế)
  quizItems = items.slice(0, TOTAL_QUESTIONS);
  currentIndex = 0;
  correctCount = 0;

  renderQuestion(quizItems[currentIndex], currentIndex, allRows);

  // Sự kiện xác nhận đáp án
  document.getElementById("confirmBtn").onclick = () => {
    const sel = getSelectedValue(currentIndex);
    if (!sel) {
      alert("Vui lòng chọn một đáp án.");
      return;
    }

    const isCorrect = sel.value === sel.correct;
    if (isCorrect) {
      correctCount++;
      document.getElementById("correctCount").textContent = correctCount;
      playerAttack(battle); // đúng → Pokémon của mình tung chiêu
    } else {
      wildAttack(battle);   // sai → Pokémon hoang dã tung chiêu
    }

    // Cho phép Next hoặc Finish
    const isLast = currentIndex === quizItems.length - 1;
    document.getElementById("nextBtn").disabled = isLast;
    document.getElementById("finishBtn").style.display = isLast ? "inline-block" : "none";
  };

  // Sự kiện sang câu tiếp theo
  document.getElementById("nextBtn").onclick = () => {
    currentIndex++;
    renderQuestion(quizItems[currentIndex], currentIndex, allRows);
  };

  // Kết thúc: cộng sao nếu đạt
  document.getElementById("finishBtn").onclick = async () => {
    const total = quizItems.length;
    if (correctCount >= 15) {
      stars = stars + 5;
      document.getElementById("starCount").textContent = stars;

      const ref = doc(dbPokemon, "bosuutap", docId);
      const snap = await getDoc(ref);
      const data = snap.exists() ? snap.data() : {};
      await setDoc(ref, { ...data, stars });

      alert(`✅ Bạn đúng ${correctCount}/${total}. Được cộng thêm 5 sao! ⭐`);
    } else {
      alert(`❌ Bạn đúng ${correctCount}/${total}. Chưa đủ điều kiện để cộng sao.`);
    }
  };
}

// Start
main().catch(err => {
  console.error("Lỗi khởi tạo quiz:", err);
  alert("❌ Có lỗi khi khởi tạo quiz. Vui lòng thử lại.");
});

