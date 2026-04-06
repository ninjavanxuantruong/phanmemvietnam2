import { showVictoryEffect } from "./effect-win.js";
import { prefetchImagesBatch, getImageFromMap } from "./imageCache.js";



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
// ===== Fetch vocab data từ link Exec =====
async function fetchVocabularyData() {
  try {
    // Gọi trực tiếp từ window.SHEET_URL (đã khai báo trong googleSheetLinks.js)
    const response = await fetch(window.SHEET_URL);
    const data = await response.json();

    // Lấy mảng dữ liệu (hỗ trợ cả cấu trúc {data: []} hoặc [])
    const rows = data.data || data;

    const allWords = rows.map((r) => {
      // Biến Object thành Array để lấy theo Index cột giống hệt bản cũ
      const col = Object.values(r); 
      const getVal = (idx) => (col[idx] || "").toString().trim();

      return {
        word: getVal(2),          // Cột C
        meaning: getVal(24),       // Cột Y
        extraNote: getVal(30),     // Cột AE
        noteAH: getVal(33),        // Cột AH
        noteAI: getVal(34),        // Cột AI
        syllables: getVal(42),     // Cột AQ
        imageKeyword: getVal(47)   // Cột AV
      };
    });

    // Lọc theo wordBank của người dùng
    const filtered = allWords.filter((item) => wordBank.includes(item.word));

    // Loại bỏ trùng lặp nếu có
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
  } catch (error) {
    console.error("❌ Lỗi Fetch từ Exec:", error);
    return [];
  }
}

// ===== Build image keywords =====
function buildImageKeywords(data) {
  const set = new Set();
  for (const item of data) {
    // Chỉ giữ lại imageKeyword và word để hiện ảnh chính ở trên đầu
    [item.imageKeyword, item.word].forEach((k) => {
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
// ===== Hàm hiển thị từ vựng lên UI =====
async function displayWord(wordObj) {
  if (!wordObj) return;

  // 1. Hiển thị chữ và nghĩa
  document.getElementById("vocabWord").textContent = wordObj.word.toUpperCase();
  document.getElementById("vocabMeaning").textContent = wordObj.meaning || "Không có nghĩa";

  // 2. Lấy phiên âm từ API Dictionary (Giữ nguyên logic cũ)
  const phonetic = await getPhonetic(wordObj.word);
  document.getElementById("vocabPhonetic").textContent = phonetic;

  // 3. Hiển thị ảnh (Dùng imageKeyword nếu có, không thì dùng chính Word)
  const imgEl = document.getElementById("vocabImage");
  const keywordForImage = (wordObj.imageKeyword || wordObj.word).toLowerCase().trim();
  const mainImg = getImageFromMap(keywordForImage);

  if (mainImg) {
    imgEl.src = mainImg;
    imgEl.style.display = "block";
  } else {
    imgEl.style.display = "none";
    console.warn(`⚠️ Không tìm thấy ảnh cho từ: ${keywordForImage}`);
  }

  // 4. Dọn dẹp nội dung Ghi chú (Fun Fact) của từ trước đó
  const funContent = document.getElementById("funContent");
  if (funContent) funContent.innerHTML = "";

  const closeBtn = document.getElementById("closeFunBtn");
  if (closeBtn) closeBtn.style.display = "none";

  // 5. Reset trạng thái nút "Next" (Bắt buộc phải nghe đủ số lần mới cho qua)
  listenCount = 0;
  const nextBtn = document.getElementById("nextBtn");
  if (nextBtn) nextBtn.disabled = true;

  console.log(`📖 Đang hiển thị từ: ${wordObj.word}`);
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

  const syl = wordObj.syllables || ""; 
  const note1 = wordObj.noteAH || "";
  const note2 = wordObj.noteAI || "";

  container.innerHTML = `
    <div style="padding:15px; border:2px dashed #ffcb05; border-radius:15px; background-color: #fffbe6; color: #333;">

      ${syl ? `
        <div style="text-align: center; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #eee;">
          <p style="font-size: 0.8rem; color: #666; margin: 0;">Cách đọc tách vần:</p>
          <h2 style="color: #ff1c1c; letter-spacing: 3px; font-size: 1.6rem; margin: 5px 0;">
            ${syl.toUpperCase().split('-').join(' <span style="color:#ccc">-</span> ')}
          </h2>
        </div>
      ` : ""}

      <h3 style="color: #3b4cca; margin-top: 0; font-size: 1rem;">📌 Ghi chú bổ trợ:</h3>

      <div class="notes-wrapper">
         ${note1 ? `<p style="margin: 8px 0; color: #d35400; font-weight: bold;">• ${note1}</p>` : ""}
         ${note2 ? `<p style="margin: 8px 0; color: #2980b9;">• ${note2}</p>` : ""}
      </div>

      ${(!syl && !note1 && !note2) ? "<p>Chưa có thông tin bổ sung.</p>" : ""}
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
