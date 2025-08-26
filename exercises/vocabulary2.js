import { showCatchEffect } from './pokeball-effect.js';

const PEXELS_API_KEY = "DsgAHtqZS5lQtujZcSdZsOHIhoa9NtT6GVMQ3Xn7DQiyDJ9FKDhgo2GQ";
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

const wordBank = JSON.parse(localStorage.getItem("wordBank")) || [];
let vocabData = [];
let caughtCount = 0;
let isFlashcardActive = false;


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
  if (isFlashcardActive) return; // ✅ Đang xử lý từ khác, bỏ qua
  isFlashcardActive = true;

  const flashcard = document.getElementById("flashcard");
  const flashMeaning = document.getElementById("flashMeaning");
  const flashImage = document.getElementById("flashImage");

  flashImage.src = await getImage(item.word);
  flashcard.style.display = "block";

  // ✅ Phát âm câu hỏi từ cột J
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

  // ✅ Tự động đóng sau 10 giây nếu không ghi âm
  const timeout = setTimeout(() => {
    if (isFlashcardActive) {
      flashcard.style.display = "none";
      ballElement.remove();
      speakBall.remove();
      isFlashcardActive = false;

      caughtCount++;
      const remaining = vocabData.length - caughtCount;
      document.getElementById("ballCounter").textContent = `Còn lại: ${remaining} Pokéball`;

      if (caughtCount === vocabData.length) {
        showCatchEffect();

        const speakingScore = parseInt(localStorage.getItem("speaking_score") || "0");
        const speakingTotal = vocabData.length * 2;

        localStorage.setItem("vocabulary2_score", JSON.stringify({
          score: speakingScore,
          total: speakingTotal
        }));

        const combinedScore = speakingScore + 10;
        const combinedTotal = speakingTotal + 10;

        localStorage.setItem("result_vocabulary", JSON.stringify({
          score: combinedScore,
          total: combinedTotal
        }));

        localStorage.removeItem("speaking_score");
      }
    }
  }, 10000); // 10 giây

  speakBall.onclick = () => {
    clearTimeout(timeout); // ✅ Hủy timeout nếu đã ghi âm

    startSpeakingPractice(item.word, () => {
      flashcard.style.display = "none";
      ballElement.remove();
      speakBall.remove();
      isFlashcardActive = false;

      caughtCount++;
      const remaining = vocabData.length - caughtCount;
      document.getElementById("ballCounter").textContent = `Còn lại: ${remaining} Pokéball`;

      if (caughtCount === vocabData.length) {
        showCatchEffect();

        const speakingScore = parseInt(localStorage.getItem("speaking_score") || "0");
        const speakingTotal = vocabData.length * 2;

        localStorage.setItem("vocabulary2_score", JSON.stringify({
          score: speakingScore,
          total: speakingTotal
        }));

        const combinedScore = speakingScore + 10;
        const combinedTotal = speakingTotal + 10;

        localStorage.setItem("result_vocabulary", JSON.stringify({
          score: combinedScore,
          total: combinedTotal
        }));

        localStorage.removeItem("speaking_score");
      }
    });
  };
}


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

    // ✅ Chỉ cần chứa từ là được
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


function movePokeball(ball) {
  const size = parseInt(ball.style.width); // giữ nguyên kích thước hiện tại
  const top = Math.floor(Math.random() * (window.innerHeight - size));
  const left = Math.floor(Math.random() * (window.innerWidth - size));

  ball.style.top = `${top}px`;
  ball.style.left = `${left}px`;
}


function renderPokeballs(data) {
  const container = document.getElementById("pokeContainer");
  container.innerHTML = "";
  container.style.position = "relative";

  data.forEach(item => {
    const ball = document.createElement("div");
    ball.className = "pokeball";
    ball.setAttribute("data-word", item.word);

    const size = Math.floor(Math.random() * 20) + 30; // 30–50px
    ball.style.width = `${size}px`;
    ball.style.height = `${size}px`;

    movePokeball(ball); // đặt vị trí ban đầu
    container.appendChild(ball);

    ball.addEventListener("click", () => {
      showFlashcard(item, ball);
    });

    // 👉 Auto di chuyển mỗi 5 giây
    const interval = setInterval(() => {
      if (document.body.contains(ball)) {
        movePokeball(ball);
      } else {
        clearInterval(interval); // nếu đã bị xóa thì ngừng
      }
    }, 5000);
  });
}



fetchVocabularyData().then(data => {
  vocabData = data;
  if (vocabData.length > 0) {
    renderPokeballs(vocabData);
    document.getElementById("ballCounter").textContent = `Còn lại: ${vocabData.length} Pokéball`;
  } else {
    document.getElementById("pokeContainer").innerHTML = "<p>Không có từ nào để hiển thị.</p>";
  }
});

