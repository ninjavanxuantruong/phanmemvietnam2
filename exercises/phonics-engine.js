// ✅ Import hiệu ứng PokéBall từ module
import { showCatchEffect } from './pokeball-effect.js';
import { phonicsBank } from './phonics-bank.js';

let filteredBank = [];
let currentQuestion = {};
let currentMode = null;
let usedKeys = new Set();
let selectedPair = [];

let scoreIPA1 = 0;
let scoreIPA2 = 0;
let doneIPA1 = false;
let doneIPA2 = false;

let scoreIPA3 = 0;
let doneIPA3 = false;
let usedWordsIPA3 = new Set();

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
      if (
        (mode === 1 && doneIPA1) ||
        (mode === 2 && doneIPA2) ||
        (mode === 3 && doneIPA3)
      ) return;

      document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
      btn.classList.add("active");

      const oldSummary = document.getElementById("resultSummary");
      if (oldSummary) oldSummary.remove();

      startMode(mode);
    };
  });
});

function startMode(mode) {
  currentMode = mode;
  usedKeys.clear();
  selectedPair = [];

  resetQuizUI();

  if (mode === 1) showIPA1();
  if (mode === 2) showIPA2();
  if (mode === 3) showIPA3();
}

function resetQuizUI() {
  const quizWord = document.getElementById("quizWord");
  const options = document.getElementById("options");
  const result = document.getElementById("result");
  const finalBox = document.getElementById("finalBox");

  if (quizWord) quizWord.innerHTML = "";
  if (options) options.innerHTML = "";
  if (result) result.textContent = "";
  if (finalBox) finalBox.textContent = "";
}

function showIPA1() {
  if (usedKeys.size >= filteredBank.length) {
    doneIPA1 = true;
    showCompletedMessage(1);
    if (doneIPA1 && doneIPA2 && doneIPA3) {
      checkTotalScore();
    }

    return;
  }

  let next;
  do {
    next = filteredBank[Math.floor(Math.random() * filteredBank.length)];
  } while (usedKeys.has(next.key));

  currentQuestion = next;
  usedKeys.add(currentQuestion.key);

  document.getElementById("quizWord").innerHTML = `
    <span>${currentQuestion.word}</span>
    <button class="play-audio-btn" data-word="${currentQuestion.word}" style="margin-left:10px;">🔊</button>
  `;
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

  const audioBtn = document.querySelector('.play-audio-btn');
  if (audioBtn) {
    audioBtn.addEventListener('click', event => {
      event.stopPropagation();
      const word = audioBtn.getAttribute('data-word');
      const utter = new SpeechSynthesisUtterance(word);
      utter.lang = "en-US";
      speechSynthesis.speak(utter);
    });
  }
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

  if (quizArea) quizArea.textContent = "";
  if (resultBox) resultBox.textContent = "";
  if (optionsArea) optionsArea.innerHTML = "";

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
      const resultBox = document.getElementById("result");
      if (resultBox) resultBox.textContent = "✅ Chính xác!";
    } else {
      c1.style.border = "";
      c2.style.border = "";
      const resultBox = document.getElementById("result");
      if (resultBox) resultBox.textContent = "❌ Sai rồi!";
    }

    selectedPair = [];

    const remaining = document.querySelectorAll(".card[data-type='word']:not(.matched)");
    if (remaining.length === 0) {
      doneIPA2 = true;
      showCompletedMessage(2);
      if (doneIPA1 && doneIPA2 && doneIPA3) {
        checkTotalScore();
      }

    }
  }
}

function showIPA3() {
  const quizArea = document.getElementById("quizWord");
  const optionsArea = document.getElementById("options");
  const resultBox = document.getElementById("result");

  if (quizArea) quizArea.textContent = "";
  if (resultBox) resultBox.textContent = "";
  if (optionsArea) optionsArea.innerHTML = "";

  const availableWords = filteredBank.filter(item => !usedWordsIPA3.has(item.word));

  if (availableWords.length === 0) {
    doneIPA3 = true;
    showCompletedMessage(3);
    if (doneIPA1 && doneIPA2 && doneIPA3) {
      checkTotalScore();
    }

    return;
  }

  let attempt = 0;
  let correctWord, distractors;

  while (attempt < 10) {
    correctWord = availableWords[Math.floor(Math.random() * availableWords.length)];
    const targetIPA = correctWord.ipa;

    distractors = filteredBank.filter(item =>
      item.unit === correctWord.unit &&
      item.word !== correctWord.word &&
      item.ipa !== targetIPA
    );

    if (distractors.length >= 3) break;
    attempt++;
  }

  if (!correctWord || distractors.length < 3) {
    usedWordsIPA3.add(correctWord.word);
    showIPA3();
    return;
  }

  usedWordsIPA3.add(correctWord.word);

  shuffleArray(distractors);
  const wrongWords = distractors.slice(0, 3);
  const allOptions = [correctWord, ...wrongWords];
  shuffleArray(allOptions);

  playIPAFromText(`/${correctWord.ipa}/`);

  quizArea.innerHTML = `
    <strong>Nghe âm và chọn từ có âm đó:</strong>
    <button class="play-ipa-btn" data-ipa="${correctWord.ipa}" style="margin-left:10px;">🔊 Nghe lại</button>
  `;

  const ipaBtn = document.querySelector('.play-ipa-btn');
  if (ipaBtn) {
    ipaBtn.addEventListener('click', event => {
      event.stopPropagation();
      const ipa = ipaBtn.getAttribute('data-ipa');
      playIPAFromText(`/${ipa}/`);
    });
  }

  allOptions.forEach(item => {
    const btn = document.createElement("div");
    btn.className = "option-btn";
    btn.textContent = item.word;
    btn.style.color = "blue";
    btn.onclick = () => {
      speakWordCustom(item.word);

      const resultBox = document.getElementById("result");
      if (item.word === correctWord.word) {
        scoreIPA3++;
        if (resultBox) resultBox.textContent = "✅ Chính xác!";
      } else {
        if (resultBox) resultBox.textContent = `❌ Sai rồi! Đáp án là: ${correctWord.word}`;
      }

      setTimeout(showIPA3, 1500);
    };
    optionsArea.appendChild(btn);
  });
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
  if (mode === 3) {
    finalBox.innerHTML = `<p style="color:purple;">🎉 Đã hoàn tất dạng 3 (Nghe âm → chọn từ). Điểm: ${scoreIPA3}</p>`;
    document.querySelector("[data-mode='3']").disabled = true;
  }
}

function checkTotalScore() {
  const totalScore = scoreIPA1 + scoreIPA2 + scoreIPA3; // ✅ điểm đúng thực hành
  const maxScore = filteredBank.length * 3;             // ✅ điểm tối đa thực hành
  const theoryScore = parseInt(localStorage.getItem("phonicsTheoryRounded") || "0");

  const finalScore = totalScore + theoryScore;          // ✅ điểm thực tế đạt được
  const finalTotal = maxScore + theoryScore;            // ✅ điểm tối đa có thể đạt


  localStorage.setItem("result_phonics", JSON.stringify({
    score: finalScore,       // ✅ điểm thực tế đạt được
    quiz: totalScore,        // điểm thực hành đúng
    theory: theoryScore,     // điểm lý thuyết
    total: finalTotal        // ✅ điểm tối đa có thể đạt
  }));


  const container = document.querySelector(".quiz-container");

  const resultSummary = document.createElement("div");
  resultSummary.id = "resultSummary";
  resultSummary.innerHTML = `
    <h2 style="color:hotpink;">🎯 Kết quả luyện âm</h2>
    <p style="color:hotpink;">📘 Lý thuyết: ${theoryScore} điểm</p>
    <p style="color:hotpink;">🧪 Thực hành: ${totalScore} / ${maxScore}</p>
    <p style="color:hotpink;">🌟 Tổng điểm: ${finalScore} / ${finalTotal}</p>
  `;


  container.appendChild(resultSummary);

  if (totalScore >= maxScore / 2) {
    showCatchEffect(container);
  }
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function playIPAFromText(text) {
  const match = text.match(/\/([^/]+)\//);
  const ipa = match?.[1];

  if (ipa) {
    const url = `https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/${encodeURIComponent(ipa)}.mp3`;
    const audio = new Audio(url);
    audio.play();
  } else {
    console.warn("Không tìm thấy IPA trong chuỗi:", text);
  }
}
