import { showCatchEffect } from './pokeball-effect.js';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

let sentences = [];
let sentenceIndex = 0;
let voice = null;
let totalScore = 0;

function renderSentence(autoSpeak = true, target = "", meaning = "") {
  const { text } = sentences[sentenceIndex];
  const area = document.getElementById("sentenceArea");
  area.innerHTML = `
    <div style="font-size:24px; margin-bottom:10px; text-align:center;">
      🔤 <b style="color:#cc3333;">${target}</b>
      <span style="font-size:18px;">(${meaning})</span>
    </div>
    <div style="font-size:28px; font-weight:bold; margin-bottom:18px; text-align:center;">
      ${text}
    </div>
    <div style="text-align:center;">
      <button id="playBtn">🔊 Nghe lại</button>
      <button id="recordBtn" style="margin:0 8px;">
        <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" alt="PokéBall" style="width:40px; vertical-align:middle;" />
      </button>
      <button id="nextBtn">⏩ Tiếp theo</button>
    </div>
    <div id="speechResult" style="margin-top:16px; text-align:center;"></div>
  `;

  document.getElementById("playBtn").onclick = () => speak(text);
  document.getElementById("nextBtn").onclick = () => {
    sentenceIndex++;
    if (sentenceIndex < sentences.length) {
      startSentence();
    } else {
      showFinalResult();
    }
  };

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Thiết bị của bạn không hỗ trợ nhận giọng nói.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  document.getElementById("recordBtn").onclick = () => {
    document.getElementById("speechResult").textContent = "🎙️ Đang nghe...";
    recognition.start();
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    checkAccuracy(transcript);
  };

  recognition.onerror = (event) => {
    document.getElementById("speechResult").innerText = `❌ Lỗi: ${event.error}`;
  };

  if (autoSpeak) speak(text);
}

function checkAccuracy(userText) {
  const currentSentence = sentences[sentenceIndex].text.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const user = userText.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const targetWords = currentSentence.split(/\s+/);
  const userWords = user.split(/\s+/);

  let correct = 0;
  for (let word of targetWords) {
    if (userWords.includes(word)) correct++;
  }

  const percent = Math.round((correct / targetWords.length) * 100);
  if (percent >= 50) totalScore++;

  const result = document.getElementById("speechResult");
  result.innerHTML = `✅ Bạn nói: "<i>${userText}</i>"<br>🎯 Đúng ${correct}/${targetWords.length} từ → <b>${percent}%</b>`;
  // Không gọi hiệu ứng ở đây — chỉ gọi khi kết thúc toàn bộ
}

function showFinalResult() {
  const area = document.getElementById("sentenceArea");
  const percent = Math.round((totalScore / sentences.length) * 100);
  area.innerHTML = `
    <div style="font-size:24px;">🏁 Bạn đã luyện hết toàn bộ nội dung!</div>
    <div style="margin-top:16px;">
      📊 Tổng điểm: <b>${totalScore}/${sentences.length}</b> → <b>${percent}%</b>
    </div>
  `;

  if (percent >= 50) {
    area.innerHTML += `<br>🎉 Chuẩn Legendary! Bạn đã bắt được Pokémon!`;
    showCatchEffect(area);
  } else {
    area.innerHTML += `<br>🚫 Bạn chưa bắt được Pokémon nào! Hãy luyện thêm để đạt tối thiểu 50%.`;
  }
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.voice = voice;
  speechSynthesis.speak(utter);
}

function startSentence() {
  const { text, target, meaning } = sentences[sentenceIndex];
  renderSentence(true, target, meaning);
}

function getVoices() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}

getVoices().then(v => {
  voice = v.find(v => v.lang === "en-US") || v[0];
  const wordBank = JSON.parse(localStorage.getItem("wordBank"))?.map(w => w.toLowerCase().trim()) || [];

  fetch(SHEET_URL)
    .then(res => res.text())
    .then(txt => {
      const json = JSON.parse(txt.substring(47).slice(0, -2));
      const rows = json.table.rows;

      sentences = [];
      for (const r of rows) {
        const rawTarget = r.c[2]?.v?.trim().toLowerCase();
        const rawMeaning = r.c[24]?.v?.trim();
        const targets = rawTarget?.split(/[/;,]/).map(t => t.trim());
        const match = targets?.some(t => wordBank.includes(t));
        if (match) {
          const targetWord = targets.find(t => wordBank.includes(t)) || rawTarget;
          const q = r.c[9]?.v?.trim();
          const a = r.c[11]?.v?.trim();
          if (q) sentences.push({ text: q, target: targetWord, meaning: rawMeaning });
          if (a) sentences.push({ text: a, target: targetWord, meaning: rawMeaning });
        }
      }

      sentenceIndex = 0;
      if (sentences.length > 0) {
        startSentence();
      } else {
        document.getElementById("sentenceArea").innerHTML = `<div style="font-size:20px;">📭 Không tìm thấy dữ liệu từ vựng đã học.</div>`;
      }
    });
});
