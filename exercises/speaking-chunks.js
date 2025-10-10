

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

let sentences = [];
let collocationBank = [];
let sentenceIndex = 0;
let chunkIndex = 0;
let currentChunks = [];
let voice = null;
let totalScore = 0;
let totalChunks = 0;

function chunkSentence(sentence) {
  const doc = nlp(sentence);
  const terms = doc.terms().json();
  const result = [];

  let i = 0;
  while (i < terms.length) {
    const tags = terms[i].terms[0]?.tags || [];
    const word = terms[i].text;

    const wordLower = word.toLowerCase();
    const isStarter = (
      (tags.includes('Verb') &&
       !['be', 'am', 'is', 'are', 'was', 'were'].includes(wordLower))
      || tags.includes('Preposition')
      || tags.includes('Determiner')
      || tags.includes('Possessive')
    );


    if (isStarter) {
      const chunk = [word];
      i++;

      while (i < terms.length) {
        const nextTags = terms[i].terms[0]?.tags || [];
        const nextWord = terms[i].text;

        const isConnector = nextTags.includes('Adjective') ||
                            nextTags.includes('Determiner') ||
                            nextTags.includes('Possessive');

        const isEnder = nextTags.includes('Noun');

        if (isConnector || isEnder) {
          chunk.push(nextWord);
          i++;

          // 🔁 Nếu là Noun → tiếp tục vòng để gom thêm Noun liên tiếp
          if (isEnder) continue;

          continue;
        }

        break;
      }


      result.push(chunk.join(" "));
    } else {
      result.push(word);
      i++;
    }
  }

  const layered = [];
  for (let j = 1; j <= result.length; j++) {
    layered.push(result.slice(0, j).join(" "));
  }
  return layered;
}


// ✅ Test ngay câu glow
console.log("🧪 Test:", chunkSentence("Eat healthy food at home."));
function renderChunk(autoSpeak = true, target = "", meaning = "") {
  const phrase = currentChunks[chunkIndex];
  const area = document.getElementById("speakingArea");
  area.innerHTML = `
    <div style="font-size:24px; margin-bottom:10px; text-align:center;">
      🔤 <b style="color:#cc3333;">${target}</b> <span style="font-size:18px;">(${meaning})</span>
    </div>
    <div style="font-size:30px; font-weight:bold; margin-bottom:18px; text-align:center;">
      ${phrase}
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


  document.getElementById("playBtn").onclick = () => speak(phrase);
  document.getElementById("nextBtn").onclick = () => {
    chunkIndex++;
    if (chunkIndex < currentChunks.length) {
      renderChunk(true, target, meaning);
    } else {
      sentenceIndex++;
      if (sentenceIndex < sentences.length) {
        startSentence();
      } else {
        showFinalResult(1);
      }
    }
  };

  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Thiết bị của bạn không hỗ trợ nhận giọng nói trực tiếp.");
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

  if (autoSpeak) speak(phrase);
}

import { showVictoryEffect } from './effect-win.js';
import { showDefeatEffect } from './effect-loose.js';

function showFinalResult(mode) {
  const area = document.getElementById("speakingArea");
  area.innerHTML = `<div style="font-size:24px;">🏁 Bạn đã luyện hết toàn bộ nội dung!</div>`;

  const percent = totalChunks > 0
    ? Math.round((totalScore / totalChunks) * 100)
    : 0;

  // ✅ Ghi điểm vào localStorage theo dạng part (1,2,3)
  setResultSpeakingPart(mode, totalScore, totalChunks);

  // ✅ Hiển thị kết quả
  area.innerHTML += `
    <div style="margin-top:16px;">
      📊 Tổng điểm: <b>${totalScore}/${totalChunks}</b> → <b>${percent}%</b>
    </div>
  `;

  if (percent >= 50) {
    area.innerHTML += `<br>🎉 Chuẩn Legendary! Bạn đã bắt được Pokémon!`;
    showVictoryEffect(area); // hiệu ứng thắng
  } else {
    area.innerHTML += `<br>🚫 Bạn chưa bắt được Pokémon nào! Hãy luyện thêm để đạt tối thiểu 50%.`;
    showDefeatEffect(area); // hiệu ứng thua
  }
}

function setResultSpeakingPart(mode, score, total) {
  const raw = localStorage.getItem("result_speaking");
  const prev = raw ? JSON.parse(raw) : {};

  const updated = {
    score1: mode === 1 ? score : prev.score1 || 0,
    score2: mode === 2 ? score : prev.score2 || 0,
    score3: mode === 3 ? score : prev.score3 || 0,
    total1: mode === 1 ? total : prev.total1 || 0,
    total2: mode === 2 ? total : prev.total2 || 0,
    total3: mode === 3 ? total : prev.total3 || 0
  };

  const totalScore = (updated.score1 || 0) + (updated.score2 || 0) + (updated.score3 || 0);
  const totalMax   = (updated.total1 || 0) + (updated.total2 || 0) + (updated.total3 || 0);

  localStorage.setItem("result_speaking", JSON.stringify({
    ...updated,
    score: totalScore,
    total: totalMax
  }));
}



function startSentence() {
  const { text, target, meaning } = sentences[sentenceIndex];
  currentChunks = chunkSentence(text);
  chunkIndex = 0;
  renderChunk(true, target, meaning);
}

function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.voice = voice;
  speechSynthesis.speak(utter);
}

function checkAccuracy(userText) {
  const currentPhrase = currentChunks[chunkIndex].toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const userWords = userText.toLowerCase().replace(/[^a-z0-9'\s]/g, "").split(/\s+/);
  const targetWords = currentPhrase.split(/\s+/);
  let correct = 0;
  for (let word of targetWords) {
    if (userWords.includes(word)) correct++;
  }
  const percent = Math.round((correct / targetWords.length) * 100);
  if (percent >= 50) totalScore++;
  totalChunks++;

  const result = document.getElementById("speechResult");
  result.innerHTML = `✅ Bạn nói: "<i>${userText}</i>"<br>🎯 Đúng ${correct}/${targetWords.length} từ → <b>${percent}%</b>`;
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

      collocationBank = [];
      for (const r of rows) {
        const raw = r.c[2]?.v?.trim().toLowerCase();
        if (raw) {
          const items = raw.split(/[/;,]/).map(x => x.trim());
          collocationBank.push(...items.filter(x => x.includes(" ")));
        }
      }

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

      totalScore = 0;      // reset điểm part 1
      totalChunks = 0;     // reset số chunk
      sentenceIndex = 0;   // reset vị trí câu đầu tiên

      if (sentences.length > 0) {
        startSentence();
      } else {
        document.getElementById("speakingArea").innerHTML = `<div style="font-size:20px;">📭 Không tìm thấy dữ liệu từ vựng đã học.</div>`;
      }
    });
});
