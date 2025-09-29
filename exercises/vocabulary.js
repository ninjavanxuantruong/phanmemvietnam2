// vocabulary.js
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
    const word = row.c[2]?.v?.trim() || "";        // từ
    const meaning = row.c[24]?.v?.trim() || "";     // nghĩa
    const image1 = row.c[29]?.v?.trim() || "";      // AD
    const extraNote = row.c[30]?.v?.trim() || "";   // ghi chú
    const image2 = row.c[32]?.v?.trim() || "";      // AG
    const imageKeyword = row.c[47]?.v?.trim() || word; // AV
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

// ===== Build image keywords from 3 columns =====
function buildImageKeywords(data) {
  const set = new Set();
  for (const item of data) {
    const k1 = (item.image1 || "").trim();
    const k2 = (item.image2 || "").trim();
    const k3 = (item.imageKeyword || item.word || "").trim();
    [k1, k2, k3].forEach((k) => {
      if (k) set.add(k.toLowerCase());
    });
  }
  return Array.from(set);
}

// ===== Phonetic =====
async function getPhonetic(word) {
  const parts = word.toLowerCase().split(" ");
  const phonetics = [];
  for (const part of parts) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${part}`);
      const data = await res.json();
      phonetics.push(data?.[0]?.phonetic || "");
    } catch {
      phonetics.push("");
    }
  }
  return phonetics.join(" ").trim() || "";
}

// ===== Display word (ảnh đọc từ cache) =====
async function displayWord(wordObj) {
  const upper = wordObj.word.toUpperCase();
  document.getElementById("vocabWord").textContent = upper;
  document.getElementById("vocabMeaning").textContent = wordObj.meaning || "Không có nghĩa";

  const phonetic = await getPhonetic(wordObj.word);
  document.getElementById("vocabPhonetic").textContent = phonetic;

  const mainImg = getImageFromMap(wordObj.imageKeyword || wordObj.word);
  document.getElementById("vocabImage").src = mainImg;

  document.getElementById("funContent").innerHTML = "";
  document.getElementById("closeFunBtn").style.display = "none";
}

// ===== Buttons =====
document.getElementById("playSound").onclick = () => {
  const word = document.getElementById("vocabWord").textContent;
  const utter = new SpeechSynthesisUtterance(word);
  utter.voice = vocabVoice || speechSynthesis.getVoices()[0] || null;
  speechSynthesis.speak(utter);

  const img = document.querySelector("#playSound img");
  if (img) {
    img.style.animation = "shake 0.6s ease-in-out 1";
    setTimeout(() => {
      img.style.animation = "";
    }, 700);
  }
};

document.getElementById("nextBtn").onclick = async () => {
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

document.getElementById("completeBtn").onclick = () => {
  if (roundCount >= 2 && !hasCaught) {
    showVictoryEffect();
    const score = vocabData.length > 0 ? 10 : 0;
    localStorage.setItem("result_vocabulary", JSON.stringify({ score, total: 10 }));
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

// ===== Fun panel (ảnh từ cache) =====
document.getElementById("funBtn").onclick = async () => {
  const wordObj = vocabData[currentIndex];
  const container = document.getElementById("funContent");
  const closeBtn = document.getElementById("closeFunBtn");

  const note = wordObj.extraNote || "Không có gì";
  const img1 = getImageFromMap(wordObj.image1 || wordObj.word);
  const img2 = getImageFromMap(wordObj.image2 || wordObj.word);

  container.innerHTML = `
    <div style="padding:10px; border:2px dashed #ccc; border-radius:10px;">
      <h3>📌 Ghi chú thú vị:</h3>
      <p>${note}</p>
      <div class="fun-wrapper">
        <img src="${img1}" alt="Ảnh 1">
        <img src="${img2}" alt="Ảnh 2">
      </div>
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

    const keywords = buildImageKeywords(vocabData);
    await prefetchImagesBatch(keywords); // GỌI BATCH 1 LẦN, cache vào localStorage

    await displayWord(vocabData[currentIndex]);
  } catch (err) {
    console.error("Init error:", err);
    document.getElementById("vocabWord").textContent = "Lỗi khởi tạo";
    document.getElementById("vocabMeaning").textContent = "Vui lòng thử lại sau.";
  }
})();
