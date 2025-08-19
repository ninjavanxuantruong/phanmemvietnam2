import { showCatchEffect } from './pokeball-effect.js'; // 🥎 Import hiệu ứng từ file

const PEXELS_API_KEY = "DsgAHtqZS5lQtujZcSdZsOHIhoa9NtT6GVMQ3Xn7DQiyDJ9FKDhgo2GQ";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

const wordBank = JSON.parse(localStorage.getItem("wordBank")) || [];
let currentIndex = 0;
let roundCount = 0;
let vocabVoice = null;

function getVocabVoice() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}

getVocabVoice().then(voices => {
  vocabVoice = voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("zira"))
             || voices.find(v => v.lang === "en-US");
});

async function fetchVocabularyData() {
  const response = await fetch(SHEET_URL);
  const text = await response.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const allWords = rows.map(row => {
    const word = row.c[2]?.v?.trim() || "";
    const meaning = row.c[24]?.v?.trim() || "";
    return { word, meaning };
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

async function getPhonetic(word) {
  const parts = word.toLowerCase().split(" ");
  const phonetics = [];

  for (const part of parts) {
    try {
      const res = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${part}`);
      const data = await res.json();
      const phonetic = data[0]?.phonetic || "";
      phonetics.push(phonetic);
    } catch {
      phonetics.push("");
    }
  }

  return phonetics.join(" ").trim() || "";
}

async function getImage(word) {
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${word}&per_page=1`, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    const data = await res.json();
    return data.photos[0]?.src.medium || "fallback.jpg";
  } catch {
    return "fallback.jpg";
  }
}

async function displayWord(wordObj) {
  const word = wordObj.word.toUpperCase();
  document.getElementById("vocabWord").textContent = word;
  document.getElementById("vocabMeaning").textContent = wordObj.meaning || "Không có nghĩa";

  const phonetic = await getPhonetic(wordObj.word);
  document.getElementById("vocabPhonetic").textContent = phonetic;

  const imageUrl = await getImage(wordObj.word);
  document.getElementById("vocabImage").src = imageUrl;
}

document.getElementById("playSound").onclick = () => {
  const word = document.getElementById("vocabWord").textContent;
  const utter = new SpeechSynthesisUtterance(word);
  utter.voice = vocabVoice || speechSynthesis.getVoices()[0];
  speechSynthesis.speak(utter);

  const img = document.querySelector("#playSound img");
  img.style.animation = "shake 0.6s ease-in-out 1";
  setTimeout(() => {
    img.style.animation = "";
  }, 700);
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
  }document.getElementById
};

// 🟢 Gọi hiệu ứng Pokéball khi hoàn thành
let hasCaught = false; // ✅ Biến cờ kiểm tra đã bắt chưa

document.getElementById("completeBtn").onclick = () => {
  if (roundCount >= 2 && !hasCaught) {
    showCatchEffect();
    const score = vocabData.length > 0 ? 10 : 0;
    localStorage.setItem("result_vocabulary", JSON.stringify({score, total: 10}));
    hasCaught = true;

    document.getElementById("completeBtn").textContent = "✅ Đã hoàn thành!";
    document.getElementById("completeBtn").disabled = true;
    document.getElementById("completeBtn").style.opacity = "0.6";

    // ⏳ Sau 5s hiện nút chuyển
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

      nextStageBtn.onclick = () => {
        window.location.href = "vocabulary2.html";
      };

      document.body.appendChild(nextStageBtn);
    }, 5000);
  }
};




let vocabData = [];
fetchVocabularyData().then(data => {
  vocabData = data;
  if (vocabData.length > 0) {
    displayWord(vocabData[currentIndex]);
  } else {
    document.getElementById("vocabWord").textContent = "Không có từ";
    document.getElementById("vocabMeaning").textContent = "Danh sách wordBank trống hoặc không khớp với dữ liệu Google Sheet.";
  }
});
