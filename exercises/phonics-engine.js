let filteredBank = [];
let currentQuestion = {};
let currentMode = null;
let usedKeys = new Set();
let selectedPair = [];

let scoreIPA1 = 0;
let scoreIPA2 = 0;
let doneIPA1 = false;
let doneIPA2 = false;

window.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(window.location.search);
  const selectedUnits = (params.get("units") || "").split(",");

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

  document.querySelectorAll(".mode-btn").forEach(btn => {
    btn.onclick = () => {
      const mode = parseInt(btn.dataset.mode);
      if ((mode === 1 && doneIPA1) || (mode === 2 && doneIPA2)) return;
      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      startMode(mode);
    };
  });
});

function startMode(mode) {
  currentMode = mode;
  usedKeys.clear();
  selectedPair = [];

  document.getElementById("result").textContent = "";
  document.getElementById("quizWord").innerHTML = "";
  document.getElementById("options").innerHTML = "";
  document.getElementById("finalBox").textContent = "";

  if (mode === 1) showIPA1();
  if (mode === 2) showIPA2();
}

function showIPA1() {
  if (usedKeys.size >= filteredBank.length) {
    doneIPA1 = true;
    showCompletedMessage(1);
    checkTotalScore();
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
    if (!ipaOptions.includes(randIPA)) ipaOptions.push(randIPA);
  }

  shuffleArray(ipaOptions);

  const optionArea = document.getElementById("options");
  optionArea.innerHTML = "";

  ipaOptions.forEach(ipa => {
    const btn = document.createElement("div");
    btn.className = "option-btn";
    btn.textContent = ipa;
    btn.style.color = "red";
    btn.onclick = () => {
      if (ipa === correctIPA) {
        scoreIPA1++;
        document.getElementById("result").textContent = "✅ Chính xác!";
      } else {
        document.getElementById("result").textContent = `❌ Sai rồi! Đáp án là: ${correctIPA}`;
      }
      setTimeout(showIPA1, 1500);
    };
    optionArea.appendChild(btn);
  });
}

function speakWord() {
  if (!currentQuestion || !currentQuestion.word) return;
  const utter = new SpeechSynthesisUtterance(currentQuestion.word);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);
}
function showIPA2() {
  const quizArea = document.getElementById("quizWord");
  const optionsArea = document.getElementById("options");
  const resultBox = document.getElementById("result");

  quizArea.textContent = "";
  resultBox.textContent = "";
  optionsArea.innerHTML = "";

  const wordColumn = document.createElement("div");
  const ipaColumn = document.createElement("div");

  wordColumn.className = "box-word";
  ipaColumn.className = "box-ipa";

  [wordColumn, ipaColumn].forEach(col => {
    col.style.display = "flex";
    col.style.flexWrap = "wrap";
    col.style.gap = "10px";
    col.style.padding = "10px";
    col.style.flexBasis = "50%";
    col.style.boxSizing = "border-box";
  });

  wordColumn.innerHTML = "<h3>📝 Từ</h3>";
  ipaColumn.innerHTML = "<h3>🔤 IPA</h3>";

  optionsArea.style.display = "flex";
  optionsArea.style.flexDirection = "row";
  optionsArea.appendChild(wordColumn);
  optionsArea.appendChild(ipaColumn);

  const wordCards = [];
  const ipaCards = [];

  filteredBank.forEach(item => {
    const cardWord = document.createElement("div");
    cardWord.className = "card";
    cardWord.textContent = item.word;
    cardWord.dataset.ipa = item.ipa;
    cardWord.dataset.type = "word";
    cardWord.style.color = "red";
    cardWord.onclick = () => handleMatchClick(cardWord);
    wordCards.push(cardWord);

    const cardIPA = document.createElement("div");
    cardIPA.className = "card";
    cardIPA.textContent = item.ipa;
    cardIPA.dataset.ipa = item.ipa;
    cardIPA.dataset.type = "ipa";
    cardIPA.style.color = "red";
    cardIPA.onclick = () => handleMatchClick(cardIPA);
    ipaCards.push(cardIPA);
  });

  shuffleArray(wordCards);
  shuffleArray(ipaCards);
  wordCards.forEach(card => wordColumn.appendChild(card));
  ipaCards.forEach(card => ipaColumn.appendChild(card));
}

function handleMatchClick(card) {
  if (card.classList.contains("matched") || selectedPair.includes(card)) return;

  card.style.border = "2px solid yellow";
  selectedPair.push(card);

  if (selectedPair.length === 2) {
    const [c1, c2] = selectedPair;
    const isMatch = c1.dataset.ipa === c2.dataset.ipa && c1.dataset.type !== c2.dataset.type;

    if (isMatch) {
      c1.classList.add("matched");
      c2.classList.add("matched");
      c1.style.visibility = "hidden";
      c2.style.visibility = "hidden";

      const word = c1.dataset.type === "word" ? c1.textContent : c2.textContent;
      speakWordCustom(word);
      scoreIPA2++;
      document.getElementById("result").textContent = "✅ Chính xác!";
    } else {
      c1.style.border = "";
      c2.style.border = "";
      document.getElementById("result").textContent = "❌ Sai rồi!";
    }

    selectedPair = [];

    const remaining = document.querySelectorAll(".card[data-type='word']:not(.matched)");
    if (remaining.length === 0) {
      doneIPA2 = true;
      showCompletedMessage(2);
      checkTotalScore();
    }
  }
}

function speakWordCustom(word) {
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);
}

function showCompletedMessage(mode) {
  const finalBox = document.getElementById("finalBox");
  if (mode === 1) {
    finalBox.innerHTML = `<p style="color:green;">🎉 Đã hoàn tất dạng 1 (Chọn IPA). Điểm: ${scoreIPA1}</p>`;
    document.querySelector("[data-mode='1']").disabled = true;
  }
  if (mode === 2) {
    finalBox.innerHTML = `<p style="color:blue;">🎉 Đã hoàn tất dạng 2 (Ghép IPA). Điểm: ${scoreIPA2}</p>`;
    document.querySelector("[data-mode='2']").disabled = true;
  }
}

function checkTotalScore() {
  if (doneIPA1 && doneIPA2) {
    const totalScore = scoreIPA1 + scoreIPA2;
    const maxScore = filteredBank.length * 2;

    const container = document.querySelector(".quiz-container");
    container.innerHTML = `
      <h2 style="color:hotpink;">🎯 Hoàn thành cả hai chế độ!</h2>
      <p style="color:hotpink;">Tổng điểm: ${totalScore} / ${maxScore}</p>
      <div style="font-size: 60px; color:hotpink;">✨ Sẵn sàng bắt Pokémon ✨</div>
    `;

    if (totalScore >= maxScore / 2) {
      const id = Math.floor(Math.random() * 151) + 1;
      const img = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
      setTimeout(() => showCatchEffect("Pokémon #" + id, img), 1000);
    }
  }
}

function showCatchEffect(name, img) {
  const container = document.createElement("div");
  container.style.position = "fixed";
  container.style.top = "50%";
  container.style.left = "50%";
  container.style.transform = "translate(-50%, -50%)";
  container.style.zIndex = 9999;
  container.style.textAlign = "center";

  container.innerHTML = `
    <div style="
      width: 120px;
      height: 120px;
      margin: auto;
      border-radius: 50%;
      background: radial-gradient(circle at center, #fff 60%, #f44336 100%);
      border: 6px solid black;
      animation: shake 0.8s ease-in-out infinite;
      position: relative;">
      <div style="
        width: 20px;
        height: 20px;
        background: white;
        border: 3px solid black;
        border-radius: 50%;
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
      "></div>
    </div>

    <img src="${img}" style="margin-top: 16px;" />
    <p style="color:#000; font-weight:bold; font-size:18px;">🎉 Bạn đã bắt được ${name}!</p>

    <style>
      @keyframes shake {
        0% { transform: rotate(0deg); }
        25% { transform: rotate(10deg); }
        50% { transform: rotate(-10deg); }
        75% { transform: rotate(10deg); }
        100% { transform: rotate(0deg); }
      }
    </style>
  `;

  document.body.appendChild(container);
  setTimeout(() => container.remove(), 4000);
}


function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}
