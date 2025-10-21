import { showVictoryEffect } from "./effect-win.js";
import { prefetchImagesBatch, getImageFromMap } from "./imageCache.js";

const SHEET_URL =
  "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

const wordBank = JSON.parse(localStorage.getItem("wordBank")) || [];

let currentIndex = 0;
let roundCount = 0;
let hasCaught = false;
let vocabVoice = null;
let vocabData = [];

let listenCount = 0;
const REQUIRED_LISTENS = 1;

// ===== Voice =====
function getVocabVoice() {
  return new Promise((resolve) => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}
getVocabVoice().then((voices) => {
  vocabVoice =
    voices.find((v) => v.lang === "en-US" && v.name?.toLowerCase().includes("zira")) ||
    voices.find((v) => v.lang === "en-US") ||
    null;
});

// ===== Fetch vocab data =====
async function fetchVocabularyData() {
  const response = await fetch(SHEET_URL);
  const text = await response.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const allWords = rows.map((row) => {
    const word = row.c[2]?.v?.trim() || "";
    const meaning = row.c[24]?.v?.trim() || "";
    const image1 = row.c[29]?.v?.trim() || "";
    const extraNote = row.c[30]?.v?.trim() || "";
    const image2 = row.c[32]?.v?.trim() || "";
    const imageKeyword = row.c[47]?.v?.trim() || word;
    return { word, meaning, image1, extraNote, image2, imageKeyword };
  });

  const filtered = allWords.filter((item) => wordBank.includes(item.word));
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

// ===== Build image keywords =====
function buildImageKeywords(data) {
  const set = new Set();
  for (const item of data) {
    [item.image1, item.image2, item.imageKeyword, item.word].forEach((k) => {
      if (k) set.add(k.toLowerCase().trim());
    });
  }
  return Array.from(set);
}

// ===== Phonetic =====
async function getPhonetic(word) {
  try {
    const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${word}`);
    const data = await res.json();
    return data?.[0]?.phonetic || "";
  } catch {
    return "";
  }
}

// ===== Hiển thị từ =====
async function displayWord(wordObj) {
  document.getElementById("vocabWord").textContent = wordObj.word.toUpperCase();
  document.getElementById("vocabMeaning").textContent = wordObj.meaning || "Không có nghĩa";

  const phonetic = await getPhonetic(wordObj.word);
  document.getElementById("vocabPhonetic").textContent = phonetic;

  // Ẩn/hiện ảnh
  const imgEl = document.getElementById("vocabImage");
  const mainImg = getImageFromMap(wordObj.imageKeyword || wordObj.word);
  if (mainImg) {
    imgEl.style.display = "block";
    imgEl.src = mainImg;
  } else {
    imgEl.style.display = "none";
  }

  // Reset UI phụ
  document.getElementById("funContent").innerHTML = "";
  document.getElementById("closeFunBtn").style.display = "none";

  // Reset trạng thái nghe
  listenCount = 0;
  document.getElementById("nextBtn").disabled = true;
}

// ===== Nút nghe lại =====
document.getElementById("playSound").onclick = () => {
  const word = document.getElementById("vocabWord").textContent;
  if (!word) return;

  const utter = new SpeechSynthesisUtterance(word);
  utter.voice = vocabVoice || speechSynthesis.getVoices()[0] || null;

  utter.onend = () => {
    listenCount++;
    if (listenCount >= REQUIRED_LISTENS) {
      document.getElementById("nextBtn").disabled = false;
    }
  };

  speechSynthesis.cancel();
  speechSynthesis.speak(utter);

  const img = document.querySelector("#playSound img");
  if (img) {
    img.style.animation = "shake 0.6s ease-in-out 1";
    setTimeout(() => (img.style.animation = ""), 700);
  }
};

// ===== Nút Next =====
document.getElementById("nextBtn").onclick = async () => {
  if (listenCount < REQUIRED_LISTENS) {
    alert(`Bạn cần nghe ít nhất ${REQUIRED_LISTENS} lần trước khi Next!`);
    return;
  }

  currentIndex++;
  if (currentIndex >= vocabData.length) {
    currentIndex = 0;
    roundCount++;
  }

  await displayWord(vocabData[currentIndex]);

  if (roundCount >= 2) {
    const completeBtn = document.getElementById("completeBtn");
    completeBtn.disabled = false;
    completeBtn.style.cursor = "pointer";
    completeBtn.style.backgroundColor = "#2196f3";
    completeBtn.textContent = "🌟 Hoàn thành nhiệm vụ!";
  }
};

// ===== Hàm lưu kết quả Vocabulary =====
function setResultVocabulary(part, score, total) {
  const raw = localStorage.getItem("result_vocabulary");
  const prev = raw ? JSON.parse(raw) : {};

  const updated = {
    scoreV1: part === "V1" ? score : prev.scoreV1 || 0,
    totalV1: part === "V1" ? total : prev.totalV1 || 0,
    scoreV2: part === "V2" ? score : prev.scoreV2 || 0,
    totalV2: part === "V2" ? total : prev.totalV2 || 0
  };

  const totalScore = (updated.scoreV1 + updated.scoreV2);
  const totalMax = (updated.totalV1 + updated.totalV2);

  localStorage.setItem("result_vocabulary", JSON.stringify({
    ...updated,
    score: totalScore,
    total: totalMax
  }));
}

// ===== Hoàn thành =====
document.getElementById("completeBtn").onclick = () => {
  if (roundCount >= 2 && !hasCaught) {
    showVictoryEffect();
    const score = vocabData.length > 0 ? 10 : 0;
    setResultVocabulary("V1", score, 10); // ✅ Lưu kết quả Vocabulary 1
    hasCaught = true;

    const btn = document.getElementById("completeBtn");
    btn.textContent = "✅ Đã hoàn thành!";
    btn.disabled = true;
    btn.style.opacity = "0.6";

    setTimeout(() => {
      const nextStageBtn = document.createElement("button");
      nextStageBtn.textContent = "🎮 Vào khu huấn luyện";
      nextStageBtn.style.marginTop = "20px";
      nextStageBtn.style.padding = "12px 20px";
      nextStageBtn.style.fontSize = "1rem";
      nextStageBtn.style.borderRadius = "8px";
      nextStageBtn.style.backgroundColor = "#e17055";
      nextStageBtn.style.color = "#fff";
      nextStageBtn.style.cursor = "pointer";
      nextStageBtn.onclick = () => (window.location.href = "vocabulary2.html");
      document.body.appendChild(nextStageBtn);
    }, 5000);
  }
};

document.getElementById("funBtn").onclick = () => {
  const wordObj = vocabData[currentIndex];
  const container = document.getElementById("funContent");
  const closeBtn = document.getElementById("closeFunBtn");

  const note = wordObj.extraNote || "Không có gì";
  const img1 = getImageFromMap(wordObj.image1 || wordObj.word);
  const img2 = getImageFromMap(wordObj.image2 || wordObj.word);

  let imgs = "";
  if (img1) imgs += `<img src="${img1}" alt="Ảnh 1">`;
  if (img2) imgs += `<img src="${img2}" alt="Ảnh 2">`;

  container.innerHTML = `
    <div style="padding:10px; border:2px dashed #ccc; border-radius:10px;">
      <h3>📌 Ghi chú thú vị:</h3>
      <p>${note}</p>
      <div class="fun-wrapper">${imgs}</div>
    </div>
  `;
  closeBtn.style.display = "inline-block";
};

document.getElementById("closeFunBtn").onclick = () => {
  document.getElementById("funContent").innerHTML = "";
  document.getElementById("closeFunBtn").style.display = "none";
};

// ===== Init =====
(async function init() {
  try {
    vocabData = await fetchVocabularyData();

    if (vocabData.length === 0) {
      document.getElementById("vocabWord").textContent = "Không có từ";
      document.getElementById("vocabMeaning").textContent =
        "Danh sách wordBank trống hoặc không khớp với dữ liệu Google Sheet.";
      return;
    }

    // Cache trước ảnh để load nhanh hơn (nếu có)
    const keywords = buildImageKeywords(vocabData);
    await prefetchImagesBatch(keywords);

    // Hiển thị từ đầu tiên
    await displayWord(vocabData[currentIndex]);
  } catch (err) {
    console.error("Init error:", err);
    document.getElementById("vocabWord").textContent = "Lỗi khởi tạo";
    document.getElementById("vocabMeaning").textContent = "Vui lòng thử lại sau.";
  }
})();
