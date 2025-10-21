import { showVictoryEffect } from './effect-win.js';
import { showDefeatEffect } from './effect-loose.js';
import { prefetchImagesBatch, getImageFromMap } from './imageCache.js';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
const wordBank = JSON.parse(localStorage.getItem("wordBank")) || [];

let vocabData = [];
let caughtCount = 0;
let isFlashcardActive = false;

// ✅ Load dữ liệu từ Google Sheet
async function fetchVocabularyData() {
  const response = await fetch(SHEET_URL);
  const text = await response.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const allWords = rows.map(row => {
    const word = row.c[2]?.v?.trim() || "";
    const meaning = row.c[24]?.v?.trim() || "";
    const question = row.c[9]?.v?.trim() || "";
    return { word, meaning, question };
  });

  const filtered = allWords.filter(item => wordBank.includes(item.word));
  const uniqueByWord = [];
  const seen = new Set();

  for (let item of filtered) {
    const key = item.word.toLowerCase();
    if (!seen.has(key)) {
      seen.add(key);
      uniqueByWord.push(item);
    }
  }

  return uniqueByWord;
}

// ✅ Tạo danh sách từ khóa ảnh
function buildImageKeywords(data) {
  return [...new Set(data.map(item => item.word.toLowerCase().trim()).filter(Boolean))];
}

// ✅ Hiển thị flashcard
async function showFlashcard(item, ballElement) {
  if (isFlashcardActive) return;
  isFlashcardActive = true;

  const flashcard = document.getElementById("flashcard");
  const flashMeaning = document.getElementById("flashMeaning");
  const flashImage = document.getElementById("flashImage");

  flashImage.src = getImageFromMap(item.word); // ✅ dùng ảnh từ cache
  flashcard.style.display = "block";

  if (item.question) {
    const utter = new SpeechSynthesisUtterance(item.question);
    utter.lang = "en-US";
    speechSynthesis.speak(utter);
  }

  const speakBall = document.createElement("img");
  speakBall.src = "https://cdn-icons-png.flaticon.com/512/361/361998.png";
  speakBall.style.width = "64px";
  speakBall.style.cursor = "pointer";
  speakBall.title = "🎤 Bấm để luyện nói";
  flashcard.appendChild(speakBall);

  const timeout = setTimeout(() => {
    if (isFlashcardActive) {
      flashcard.style.display = "none";
      ballElement.remove();
      speakBall.remove();
      isFlashcardActive = false;
      handleCatch();
    }
  }, 10000);

  speakBall.onclick = () => {
    clearTimeout(timeout);
    startSpeakingPractice(item.word, () => {
      flashcard.style.display = "none";
      ballElement.remove();
      speakBall.remove();
      isFlashcardActive = false;
      handleCatch();
    });
  };
}

// ✅ Hàm lưu kết quả Vocabulary (V1, V2)
function setResultVocabulary(part, score, total) {
  const raw = localStorage.getItem("result_vocabulary");
  const prev = raw ? JSON.parse(raw) : {};

  const updated = {
    scoreV1: prev.scoreV1 || 0,
    totalV1: prev.totalV1 || 0,
    scoreV2: part === "V2" ? score : prev.scoreV2 || 0,
    totalV2: part === "V2" ? total : prev.totalV2 || 0
  };

  const totalScore = updated.scoreV1 + updated.scoreV2;
  const totalMax = updated.totalV1 + updated.totalV2;

  localStorage.setItem("result_vocabulary", JSON.stringify({
    ...updated,
    score: totalScore,
    total: totalMax
  }));
}

// ✅ Xử lý khi bắt được Pokéball
function handleCatch() {
  caughtCount++;
  const remaining = vocabData.length - caughtCount;
  document.getElementById("ballCounter").textContent = `Còn lại: ${remaining} Pokéball`;

  if (caughtCount === vocabData.length) {
    const speakingScore = parseInt(localStorage.getItem("speaking_score") || "0");
    const speakingTotal = vocabData.length * 2;
    const percent = speakingScore / speakingTotal;

    if (percent >= 0.7) {
      showVictoryEffect();
    } else {
      showDefeatEffect();
    }

    // ✅ Lưu kết quả Vocabulary 2 (chỉ tính điểm nói, không cộng thêm 10)
    setResultVocabulary("V2", speakingScore, speakingTotal);


    localStorage.removeItem("speaking_score");
  }
}

// ✅ Ghi âm luyện nói
function startSpeakingPractice(targetWord, callback) {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Thiết bị không hỗ trợ ghi âm.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const resultArea = document.getElementById("speechResult");
  resultArea.textContent = "🎙️ Đang nghe...";
  recognition.start();

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    const cleanTarget = targetWord.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
    const cleanUser = transcript.toLowerCase().replace(/[^a-z0-9'\s]/g, "");

    const score = cleanUser.includes(cleanTarget) ? 2 : 0;
    resultArea.innerHTML = `🗣️ Bạn nói: "<i>${transcript}</i>"<br>🎯 Kết quả: ${score} điểm`;

    const prevScore = parseInt(localStorage.getItem("speaking_score") || "0");
    localStorage.setItem("speaking_score", prevScore + score);

    callback();
  };

  recognition.onerror = (event) => {
    resultArea.innerText = `❌ Lỗi: ${event.error}`;
    callback();
  };
}

// ✅ Di chuyển Pokéball
function movePokeball(ball) {
  const size = parseInt(ball.style.width);
  const top = Math.floor(Math.random() * (window.innerHeight - size));
  const left = Math.floor(Math.random() * (window.innerWidth - size));
  ball.style.top = `${top}px`;
  ball.style.left = `${left}px`;
}

// ✅ Tạo Pokéball từ danh sách từ
function renderPokeballs(data) {
  const container = document.getElementById("pokeContainer");
  container.innerHTML = "";
  container.style.position = "relative";

  data.forEach(item => {
    const ball = document.createElement("div");
    ball.className = "pokeball";
    ball.setAttribute("data-word", item.word);

    const size = Math.floor(Math.random() * 20) + 30;
    ball.style.width = `${size}px`;
    ball.style.height = `${size}px`;

    movePokeball(ball);
    container.appendChild(ball);

    ball.addEventListener("click", () => {
      showFlashcard(item, ball);
    });

    const interval = setInterval(() => {
      if (document.body.contains(ball)) {
        movePokeball(ball);
      } else {
        clearInterval(interval);
      }
    }, 5000);
  });
}

// ✅ Khởi động
fetchVocabularyData().then(async data => {
  vocabData = data;
  if (vocabData.length > 0) {
    const keywords = buildImageKeywords(vocabData);
    await prefetchImagesBatch(keywords); // ✅ gọi proxy 1 lần

    renderPokeballs(vocabData);
    document.getElementById("ballCounter").textContent = `Còn lại: ${vocabData.length} Pokéball`;
  } else {
    document.getElementById("pokeContainer").innerHTML = "<p>Không có từ nào để hiển thị.</p>";
  }
});
