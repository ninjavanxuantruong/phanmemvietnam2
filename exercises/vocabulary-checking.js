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
    const subTopic = r.c[5]?.v?.toString().trim(); // cột F
    const mainTopic = r.c[6]?.v?.toString().trim(); // cột G
    const normalizedCode = parseInt(rawCode?.replace(/\D/g, ""), 10);

    if (!normalizedCode || normalizedCode > maxLessonCode || !word || !meaning) return;
    if (!baiTuVung[normalizedCode]) baiTuVung[normalizedCode] = [];
    baiTuVung[normalizedCode].push({ word, meaning, subTopic, mainTopic });
  });

  const allCodes = Object.keys(baiTuVung).map(c => parseInt(c, 10));
  const items = [];

  allCodes.forEach(code => {
    const words = baiTuVung[code];
    if (!words || words.length === 0) return;
    words.forEach(w => items.push(w));
  });

  // random thứ tự
  const shuffledItems = items.sort(() => Math.random() - 0.5);

  return { items: shuffledItems, allRows: rows };
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

async function showCurrentReport() {
  const ref = doc(dbPokemon, "vocabulary", docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return;

  const data = snap.data();
  const { overall, mainTopics, subTopics, masteredWords, unmasteredWords } = data;

  let report = `📊 Kết quả gần nhất:\n`;
  report += `• Tổng: ${overall.correct}/${overall.total} (${overall.percent}%) → ${overall.level}\n\n`;

  report += renderTopicStats("Chủ đề lớn", mainTopics) + "\n";
  report += renderTopicStats("Chủ đề nhỏ", subTopics) + "\n";

  report += "\n✅ Đã thuộc:\n";
  masteredWords.forEach(w => {
    report += `- ${w}\n`;
  });

  report += "\n❌ Chưa thuộc:\n";
  unmasteredWords.forEach(raw => {
    const [word, meaning] = raw.split(";");
    report += `- ${word} → ${meaning}\n`;
  });

  const box = document.getElementById("currentReport");
  if (box) box.textContent = report;
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

function startQuiz() {
  currentIndex = 0;
  correctCount = 0;
  wrongCount = 0;
  quizFinished = false;
  masteredWords = [];
  unmasteredWords = [];
  stats = { subTopics: {}, mainTopics: {} };

  const cEl = document.getElementById("correctCount");
  const wEl = document.getElementById("wrongCount");
  if (cEl) cEl.textContent = 0;
  if (wEl) wEl.textContent = 0;

  if (quizItems.length > 0) {
    renderQuestion(quizItems[currentIndex], currentIndex, allRowsGlobal);
  } else {
    alert("❌ Không có dữ liệu từ vựng để tạo quiz.");
  }
}


// Khai báo global
// Khai báo global thêm 2 mảng
let stats = { subTopics: {}, mainTopics: {} };
let masteredWords = [];   // các từ đã thuộc (đúng)
let unmasteredWords = []; // các từ chưa thuộc (sai)

function handleAnswer(selected, correct) {
  const item = quizItems[currentIndex]; // câu hỏi hiện tại
  const total = quizItems.length;

  // cập nhật thống kê
  if (item.subTopic) {
    if (!stats.subTopics[item.subTopic]) stats.subTopics[item.subTopic] = { correct: 0, total: 0 };
    stats.subTopics[item.subTopic].total++;
  }
  if (item.mainTopic) {
    if (!stats.mainTopics[item.mainTopic]) stats.mainTopics[item.mainTopic] = { correct: 0, total: 0 };
    stats.mainTopics[item.mainTopic].total++;
  }

  if (selected === correct) {
    correctCount++;
    masteredWords.push(item); // thêm vào danh sách đã thuộc
    const el = document.getElementById("correctCount");
    if (el) el.textContent = correctCount;
    playerAttack(battle);

    if (item.subTopic) stats.subTopics[item.subTopic].correct++;
    if (item.mainTopic) stats.mainTopics[item.mainTopic].correct++;
  } else {
    wrongCount++;
    unmasteredWords.push(item); // thêm vào danh sách chưa thuộc
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



function getLevel(percent) {
  if (percent >= 90) return "Rất tốt";
  if (percent >= 75) return "Tốt";
  if (percent >= 60) return "Khá";
  if (percent >= 40) return "Trung bình";
  return "Yếu";
}

function renderTopicStats(title, topicStats) {
  let output = `📊 ${title}:\n`;
  for (const [topic, data] of Object.entries(topicStats)) {
    const percent = Math.round((data.correct / data.total) * 100);
    const level = getLevel(percent);
    output += `• ${topic}: ${data.correct}/${data.total} (${percent}%) → ${level}\n`;
  }
  return output;
}

async function finishQuiz() {
  const total = quizItems.length;
  const scorePercent = Math.round((correctCount / total) * 100);

  // Đánh giá tổng thể
  let overallLevel = getLevel(scorePercent);

  // Cộng sao nếu đạt yêu cầu
  if (scorePercent >= 75) {
    stars += 5;
    const starEl = document.getElementById("starCount");
    if (starEl) starEl.textContent = stars;

    const ref = doc(dbPokemon, "bosuutap", docId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    await setDoc(ref, { ...data, stars });
  }

  // Chuẩn bị báo cáo hiển thị
  let report = `📊 Tổng thể: ${correctCount}/${total} (${scorePercent}%) → ${overallLevel}\n\n`;
  report += renderTopicStats("Chủ đề lớn", stats.mainTopics) + "\n";
  report += renderTopicStats("Chủ đề nhỏ", stats.subTopics) + "\n\n";

  report += "✅ Các từ đã thuộc:\n";
  masteredWords.forEach(w => {
    report += `- ${w.word}\n`; // chỉ hiển thị từ tiếng Anh
  });

  report += "\n❌ Các từ chưa thuộc (cần ôn tập):\n";
  unmasteredWords.forEach(w => {
    report += `- ${w.word} → ${w.meaning}\n`;
  });

  // In ra khung kết quả
  const resultBox = document.getElementById("resultBox");
  if (resultBox) resultBox.textContent = report;

  // Khóa không cho chọn đáp án nữa
  const optBox = document.getElementById("optionsBox");
  if (optBox) {
    const options = optBox.querySelectorAll(".option");
    options.forEach(opt => {
      opt.onclick = null;
      opt.style.pointerEvents = "none";
      opt.style.opacity = "0.6";
    });
  }

  // Chuẩn bị dữ liệu để lưu vào Firestore
  const vocabReport = {
    student: studentName,
    class: studentClass,
    overall: {
      correct: correctCount,
      total: total,
      percent: scorePercent,
      level: overallLevel
    },
    mainTopics: stats.mainTopics,
    subTopics: stats.subTopics,
    masteredWords: masteredWords.map(w => w.word), // chỉ lưu từ tiếng Anh
    unmasteredWords: unmasteredWords.map(w => `${w.word};${w.meaning};${w.subTopic};${w.mainTopic}`) // lưu dạng chuỗi
  };

  // Ghi đè document vào collection "vocabulary"
  const vocabRef = doc(dbPokemon, "vocabulary", docId);
  await setDoc(vocabRef, vocabReport);

  const redoBtn = document.getElementById("redoBtn");
  if (redoBtn) {
    redoBtn.style.display = "inline-block";
    redoBtn.onclick = () => redoQuiz();
  }
}


async function redoQuiz() {
  // Lấy dữ liệu từ Firestore
  const ref = doc(dbPokemon, "vocabulary", docId);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    alert("⚠️ Chưa có dữ liệu để làm lại.");
    return;
  }

  const data = snap.data();
  const unmastered = data.unmasteredWords || [];

  if (unmastered.length === 0) {
    alert("🎉 Không còn từ chưa thuộc, bạn đã hoàn thành!");
    return;
  }

  // 👉 Đảm bảo allRowsGlobal có dữ liệu để tạo lựa chọn sai
  if (allRowsGlobal.length === 0) {
    const maxLessonCode = await fetchMaxLessonCode();
    const { allRows } = await fetchVocabItems(maxLessonCode);
    allRowsGlobal = allRows;
  }

  // Chuyển chuỗi thành object để quiz lại
  quizItems = unmastered.map(raw => {
    const [word, meaning, subTopic, mainTopic] = raw.split(";");
    return { word, meaning, subTopic, mainTopic };
  });

  startQuiz(); // reset và bắt đầu quiz
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
  await showCurrentReport();


  // Khởi tạo battlefield (2 Pokémon đứng ở trên)
  battle = initNormalBattle(myPokemonId);

  // Lấy 2 nút chế độ
  const btnAll = document.getElementById("btnAll");
  const btnRedo = document.getElementById("btnRedo");

  const currentBox = document.getElementById("currentReport");

  if (btnAll) {
    btnAll.onclick = async () => {
      // Ẩn phần kết quả hiện tại
      if (currentBox) currentBox.style.display = "none";
      btnAll.style.display = "none";
      if (btnRedo) btnRedo.style.display = "none";

      const maxLessonCode = await fetchMaxLessonCode();
      const { items, allRows } = await fetchVocabItems(maxLessonCode);
      quizItems = items;
      allRowsGlobal = allRows;

      startQuiz();
    };
  }

  if (btnRedo) {
    btnRedo.onclick = async () => {
      // Ẩn phần kết quả hiện tại
      if (currentBox) currentBox.style.display = "none";
      btnRedo.style.display = "none";
      if (btnAll) btnAll.style.display = "none";

      await redoQuiz();
    };
  }

}


// Đợi DOM sẵn sàng rồi mới gọi main
document.addEventListener("DOMContentLoaded", () => {
  main().catch(err => {
    console.error("Lỗi khởi tạo quiz:", err);
    alert("❌ Có lỗi khi khởi tạo quiz. Vui lòng thử lại.");
  });
});
