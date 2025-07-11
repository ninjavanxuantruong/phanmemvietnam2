const PEXELS_API_KEY = "DsgAHtqZS5lQtujZcSdZsOHIhoa9NtT6GVMQ3Xn7DQiyDJ9FKDhgo2GQ"; // 👈 Gán key Pexels vào đây
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

const wordBank = JSON.parse(localStorage.getItem("wordBank")) || [];
let currentIndex = 0;

// 🎯 Lấy từ + nghĩa tiếng Việt từ Google Sheet
async function fetchVocabularyData() {
  const response = await fetch(SHEET_URL);
  const text = await response.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const allWords = rows.map(row => {
    const word = row.c[2]?.v?.trim() || "";      // Cột C: từ
    const meaning = row.c[24]?.v?.trim() || "";  // Cột Y: nghĩa tiếng Việt
    return { word, meaning };
  });

  return allWords.filter(item => wordBank.includes(item.word));
}

// 📘 Lấy phiên âm từ Dictionary API
async function getPhonetic(word) {
  // Tách từ nếu là cụm
  const parts = word.toLowerCase().split(" ");
  let phonetics = [];

  for (let part of parts) {
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


// 🖼️ Lấy ảnh minh hoạ từ Pexels
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

// 🚀 Hiển thị từ lên giao diện
async function displayWord(wordObj) {
  const word = wordObj.word.toUpperCase();
  document.getElementById("vocabWord").textContent = word;
  document.getElementById("vocabMeaning").textContent = wordObj.meaning || "Không có nghĩa";

  const phonetic = await getPhonetic(wordObj.word);
  document.getElementById("vocabPhonetic").textContent = phonetic;

  const imageUrl = await getImage(wordObj.word);
  document.getElementById("vocabImage").src = imageUrl;
}

// 🔊 Phát âm + rung PokéBall
document.getElementById("playSound").onclick = () => {
  const word = document.getElementById("vocabWord").textContent;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);

  const img = document.querySelector("#playSound img");
  img.style.animation = "shake 0.6s ease-in-out 1";
  setTimeout(() => {
    img.style.animation = "";
  }, 700);
};

// ⏭️ Hiện từ tiếp theo
document.getElementById("nextBtn").onclick = async () => {
  currentIndex = (currentIndex + 1) % vocabData.length;
  await displayWord(vocabData[currentIndex]);
};

// 🔧 Khởi động
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
