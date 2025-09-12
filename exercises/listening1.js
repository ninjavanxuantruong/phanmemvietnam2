import { showVictoryEffect } from './effect-win.js';
import { showDefeatEffect } from './effect-loose.js';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

let listeningData = [];
let currentIndex = 0;
let score = 0;
let voiceMale = null;
let voiceFemale = null;

function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9]/gi, "").trim();
}

function cleanText(text) {
  return text.replace(/\([^)]*\)/g, "").trim();
}

function getVoices() {
  return new Promise(resolve => {
    let voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}

function speak(text, voice) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.voice = voice;
  speechSynthesis.speak(utter);
}

async function fetchListeningData() {
  const res = await fetch(SHEET_URL);
  const txt = await res.text();
  const json = JSON.parse(txt.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const wordBank = JSON.parse(localStorage.getItem("wordBank")) || [];
  const uniqueWords = [...new Set(wordBank)];

  const parsed = rows.map(row => {
    const rawQuestion = row.c[9]?.v?.trim() || "";
    const rawAnswer = row.c[11]?.v?.trim() || "";
    const target = row.c[2]?.v?.trim() || "";
    const question = cleanText(rawQuestion);
    const answer = cleanText(rawAnswer);
    return { question, answer, target };
  }).filter(item =>
    item.question && item.answer &&
    uniqueWords.includes(item.target)
  );

  return parsed;
}

function updateScoreBoard() {
  document.getElementById("scoreBoard").textContent = `🎯 Điểm: ${score}/${currentIndex}`;
}

function nextListening1() {
  const item = listeningData[currentIndex];
  const question = item.question;
  const answer = item.answer;
  const correct = item.target;

  const regex = new RegExp(`\\b${correct}\\b`, "gi");
  const displayQuestion = question.replace(regex, "___");
  const displayAnswer = answer.replace(regex, "___");

  document.getElementById("exerciseArea").innerHTML = `
    <div class="dialogue-text">
      <div class="line" style="font-size:24px; margin-bottom:12px;">🗣 ${displayQuestion}</div>
      <div class="line" style="font-size:24px;">🗣 ${displayAnswer}</div>
    </div>
  `;

  document.getElementById("inputWord").value = "";
  document.getElementById("resultBox").textContent = "";

  speak(question, voiceMale);
  setTimeout(() => speak(answer, voiceFemale), 1200);

  document.getElementById("playBtn").onclick = () => {
    speak(question, voiceMale);
    setTimeout(() => speak(answer, voiceFemale), 1200);
  };

  document.getElementById("submitBtn").onclick = () => {
    const input = document.getElementById("inputWord").value;
    const resultBox = document.getElementById("resultBox");

    if (normalize(input) === normalize(correct)) {
      score++;
      resultBox.textContent = "✅ Chính xác!";
    } else {
      resultBox.textContent = `❌ Sai rồi. Đáp án là: ${correct}`;
    }

    speak(correct, voiceFemale);
    currentIndex++;
    updateScoreBoard();

    setTimeout(() => {
      if (currentIndex >= listeningData.length) {
        showSummary();
      } else {
        nextListening1();
      }
    }, 1800);
  };
}

function showSummary() {
  const total = listeningData.length;
  const percent = score / total;
  const passed = percent >= 0.7;
  const area = document.getElementById("exerciseArea");

  // ✅ Ghi điểm vào localStorage theo dạng 1
  setResultListeningPart(1, score, total);

  let html = `
    <div class="dialogue-text">
      🏁 Bạn đã luyện xong ${total} câu
      <br>✅ Trả lời đúng ${score} câu!
  `;

  console.log("📊 Tổng câu:", total);
  console.log("📊 Số câu đúng:", score);
  console.log("📊 Tỷ lệ đúng:", (percent * 100).toFixed(2) + "%");

  if (passed) {
    html += `<br>🎉 Chuẩn Legendary! Bạn đã bắt được Pokémon!`;
    area.innerHTML = html + `</div>`;
    showVictoryEffect(area);
  } else {
    html += `<br>🚫 Bạn chưa bắt được Pokémon nào! Hãy luyện thêm để đạt tối thiểu 70%.`;
    area.innerHTML = html + `</div>`;
    showDefeatEffect(area);
  }

  document.getElementById("resultBox").textContent = "";
}


function setResultListeningPart(mode, score, total) {
  const raw = localStorage.getItem("result_listening");
  const prev = raw ? JSON.parse(raw) : {};

  const updated = {
    score1: mode === 1 ? score : prev.score1 || 0,
    score2: mode === 2 ? score : prev.score2 || 0,
    score3: mode === 3 ? score : prev.score3 || 0,
    total1: mode === 1 ? total : prev.total1 || 0,
    total2: mode === 2 ? total : prev.total2 || 0,
    total3: mode === 3 ? total : prev.total3 || 0
  };


  const totalScore = updated.score1 + updated.score2 + updated.score3;
  const totalMax = updated.total1 + updated.total2 + updated.total3;

  localStorage.setItem("result_listening", JSON.stringify({
    ...updated,
    score: totalScore,
    total: totalMax
  }));
}

function startListeningMode1() {
  currentIndex = 0;
  score = 0;
  updateScoreBoard();
  nextListening1();
}

getVoices().then(voices => {
  voiceMale = voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("david")) ||
              voices.find(v => v.lang === "en-US");

  voiceFemale = voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("zira")) ||
                voices.find(v => v.lang === "en-US");

  fetchListeningData().then(res => {
    listeningData = res;
    if (listeningData.length) {
      startListeningMode1();
    } else {
      document.getElementById("exerciseArea").innerHTML = "📭 Không tìm thấy dữ liệu từ vựng đã học.";
    }
  });
});
