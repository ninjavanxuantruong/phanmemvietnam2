import { showCatchEffect } from './pokeball-effect.js';

const PEXELS_API_KEY = "DsgAHtqZS5lQtujZcSdZsOHIhoa9NtT6GVMQ3Xn7DQiyDJ9FKDhgo2GQ";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

const wordBank = JSON.parse(localStorage.getItem("wordBank")) || [];
let vocabData = [];
let caughtCount = 0;


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

async function showFlashcard(item, ballElement) {
  const flashcard = document.getElementById("flashcard");
  const flashMeaning = document.getElementById("flashMeaning");
  const flashImage = document.getElementById("flashImage");

  flashMeaning.textContent = item.meaning || "Không có nghĩa";
  flashImage.src = await getImage(item.word);
  flashcard.style.display = "block";

  setTimeout(() => {
    flashcard.style.display = "none";
    ballElement.remove();

    caughtCount++;
    if (caughtCount === vocabData.length) {
      showCatchEffect(); // 🥎 Gọi hiệu ứng khi đã bắt hết
    }
  }, 5000);
}


function renderPokeballs(data) {
  const container = document.getElementById("pokeContainer");
  container.innerHTML = "";

  data.forEach(item => {
    const ball = document.createElement("div");
    ball.className = "pokeball";
    ball.setAttribute("data-word", item.word);
    container.appendChild(ball);

    ball.addEventListener("click", () => {
      showFlashcard(item, ball);
    });
  });
}

fetchVocabularyData().then(data => {
  vocabData = data;
  if (vocabData.length > 0) {
    renderPokeballs(vocabData);
  } else {
    document.getElementById("pokeContainer").innerHTML = "<p>Không có từ nào để hiển thị.</p>";
  }
});
