import { showCatchEffect } from './pokeball-effect.js';

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

let paragraphs = [];
let voice = null;
let index = 0;
let totalScore = 0;

function renderParagraph(autoSpeak = true) {
  const text = paragraphs[index];
  const area = document.getElementById("paragraphArea");

  area.innerHTML = `
    <div style="font-size:26px; font-weight:bold; margin-bottom:18px; text-align:center;">
      ${text}
    </div>
    <div style="text-align:center;">
      <button id="playBtn">🔊 Nghe lại</button>
      <button id="recordBtn" style="margin:0 8px;">🔥 Nói thử</button>
      <button id="nextBtn">⏩ Tiếp theo</button>
    </div>
    <div id="speechResult" style="margin-top:16px; text-align:center;"></div>
  `;

  document.getElementById("playBtn").onclick = () => speak(text);
  document.getElementById("nextBtn").onclick = () => {
    index++;
    if (index < paragraphs.length) {
      renderParagraph(true);
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
    checkAccuracy(transcript, text);
  };

  recognition.onerror = (event) => {
    document.getElementById("speechResult").innerText = `❌ Lỗi: ${event.error}`;
  };

  if (autoSpeak) speak(text);
}

function checkAccuracy(userText, referenceText) {
  const cleanRef = referenceText.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const user = userText.toLowerCase().replace(/[^a-z0-9'\s]/g, "");

  const refWords = cleanRef.split(/\s+/);
  const userWords = user.split(/\s+/);

  let correct = 0;
  for (let word of refWords) {
    if (userWords.includes(word)) correct++;
  }

  const percent = Math.round((correct / refWords.length) * 100);
  if (percent >= 50) totalScore++;

  const result = document.getElementById("speechResult");
  result.innerHTML = `✅ Bạn nói: "<i>${userText}</i>"<br>🎯 Đúng ${correct}/${refWords.length} từ → <b>${percent}%</b>`;
  // Không gọi hiệu ứng ở đây
}

function showFinalResult() {
  const area = document.getElementById("paragraphArea");
  const percent = paragraphs.length > 0
    ? Math.round((totalScore / paragraphs.length) * 100)
    : 0;

  // ✅ Ghi điểm tổng vào localStorage
  localStorage.setItem("result_speaking-paragraph", JSON.stringify({
    score: totalScore,
    total: paragraphs.length
  }));

  // ✅ Hiển thị kết quả UI
  area.innerHTML = `
    <div style="font-size:24px;">🏁 Bạn đã luyện hết toàn bộ đoạn văn!</div>
    <div style="margin-top:16px;">
      📊 Tổng điểm: <b>${totalScore}/${paragraphs.length}</b> → <b>${percent}%</b>
    </div>
  `;

  if (percent >= 50) {
    area.innerHTML += `<br>🎉 Chuẩn Legendary! Bạn đã bắt được Pokémon!`;
    showCatchEffect(area);
  } else {
    area.innerHTML += `<br>🚫 Bạn chưa bắt được Pokémon nào! Luyện thêm để đạt tối thiểu 50%.`;
  }
}


function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.voice = voice;
  speechSynthesis.speak(utter);
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
  fetch(SHEET_URL)
    .then(res => res.text())
    .then(txt => {
      const json = JSON.parse(txt.substring(47).slice(0, -2));
      const rows = json.table.rows;

      const wordBank = JSON.parse(localStorage.getItem("wordBank"))?.map(w => w.toLowerCase().trim()) || [];

      for (const r of rows) {
        const rawTarget = r.c[2]?.v?.trim().toLowerCase();
        const rawText = r.c[28]?.v?.trim(); // Cột AC là index 28
        const targets = rawTarget?.split(/[/;,]/).map(t => t.trim());
        const match = targets?.some(t => wordBank.includes(t));
        if (match && rawText) {
          const chunks = rawText.split(".").map(s => s.trim()).filter(s => s.length > 4);
          paragraphs.push(...chunks);
        }
      }

      index = 0;
      if (paragraphs.length > 0) {
        renderParagraph(true);
      } else {
        document.getElementById("paragraphArea").innerHTML = `<div style="font-size:20px;">📭 Không tìm thấy dữ liệu đoạn văn phù hợp.</div>`;
      }
    });
});
