let filteredBank = [];
let currentQuestion = {};
let score = 0;
let usedKeys = new Set();

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const selectedUnits = (params.get("units") || "").split(",");

  // Chỉ lấy mỗi key 1 lần duy nhất
  const uniqueKeys = new Set();
  filteredBank = phonicsBank.filter(item => {
    if (selectedUnits.includes(item.unit) && !uniqueKeys.has(item.key)) {
      uniqueKeys.add(item.key);
      return true;
    }
    return false;
  });

  if (filteredBank.length === 0) {
    document.getElementById("quizWord").textContent = "Không tìm thấy dữ liệu!";
    return;
  }

  generateQuestion();
});

function generateQuestion() {
  // Nếu đã dùng hết key âm → kết thúc quiz
  if (usedKeys.size >= filteredBank.length) {
    showFinalScore();
    return;
  }

  let next;
  do {
    next = filteredBank[Math.floor(Math.random() * filteredBank.length)];
  } while (usedKeys.has(next.key));

  currentQuestion = next;
  usedKeys.add(currentQuestion.key);

  document.getElementById("quizWord").textContent = currentQuestion.word;
  document.getElementById("result").textContent = "";
  speakWord();

  const correctIPA = currentQuestion.ipa;
  const ipaOptions = [correctIPA];

  while (ipaOptions.length < 3) {
    const randIPA = filteredBank[Math.floor(Math.random() * filteredBank.length)].ipa;
    if (!ipaOptions.includes(randIPA)) {
      ipaOptions.push(randIPA);
    }
  }

  shuffleArray(ipaOptions);

  const optionArea = document.getElementById("options");
  optionArea.innerHTML = "";

  ipaOptions.forEach(ipa => {
    const btn = document.createElement("div");
    btn.className = "option-btn";
    btn.textContent = ipa;
    btn.onclick = () => {
      if (ipa === correctIPA) {
        score++;
        document.getElementById("result").textContent = "✅ Chính xác!";
      } else {
        document.getElementById("result").textContent = `❌ Sai rồi! Đáp án là: ${correctIPA}`;
      }

      setTimeout(() => generateQuestion(), 1500); // luyện tiếp sau 1.5 giây
    };
    optionArea.appendChild(btn);
  });
}

function showFinalScore() {
  const container = document.querySelector(".quiz-container");
  container.innerHTML = `
    <h2 style="color:hotpink;">🎉 Trainer hoàn thành dạng luyện!</h2>
    <p style="color:hotpink;">Điểm đạt được: ${score} / ${filteredBank.length}</p>
    <div style="font-size: 60px; color:hotpink;">⚡ PokéBall Glow ⚡</div>
  `;
}

function speakWord() {
  if (!currentQuestion || !currentQuestion.word) return;

  const utter = new SpeechSynthesisUtterance(currentQuestion.word);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
