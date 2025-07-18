const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

let sentences = [];
let collocationBank = [];
let sentenceIndex = 0;
let chunkIndex = 0;
let currentChunks = [];
let voice = null;

// ✅ Từ đã chốt
function getWordBank() {
  return JSON.parse(localStorage.getItem("wordBank"))?.map(w => w.toLowerCase().trim()) || [];
}

// ✅ Collocation từ cột C
function extractCollocations(rows) {
  const list = [];
  for (const r of rows) {
    const raw = r.c[2]?.v?.trim().toLowerCase();
    if (raw) {
      const items = raw.split(/[/;,]/).map(x => x.trim());
      list.push(...items.filter(x => x.includes(" ")));
    }
  }
  return [...new Set(list)];
}

// ✅ Câu hỏi / trả lời + từ chính + nghĩa (cột J/L/C/Y)
function extractSentences(rows, wordBank) {
  const result = [];
  for (const r of rows) {
    const rawTarget = r.c[2]?.v?.trim().toLowerCase();
    const rawMeaning = r.c[24]?.v?.trim();
    const targets = rawTarget?.split(/[/;,]/).map(t => t.trim());
    const match = targets?.some(t => wordBank.includes(t));
    if (match) {
      const targetWord = targets.find(t => wordBank.includes(t)) || rawTarget;
      const q = r.c[9]?.v?.trim();
      const a = r.c[11]?.v?.trim();
      if (q) result.push({ text: q, target: targetWord, meaning: rawMeaning });
      if (a) result.push({ text: a, target: targetWord, meaning: rawMeaning });
    }
  }
  return result;
}

// ✅ Tách câu theo collocation 3 lớp
function chunkSentence(sentence) {
  const tokens = sentence.toLowerCase().replace(/[^\w'\s]/g, "").split(" ");
  const result = [];
  let i = 0;
  const det = ["a", "an", "the", "my", "your", "his", "her", "our", "their"];
  const prep = ["in", "on", "at", "under", "with", "before", "after", "to"];
  while (i < tokens.length) {
    const w1 = tokens[i], w2 = tokens[i+1]||"", w3 = tokens[i+2]||"", w4 = tokens[i+3]||"";
    const base2 = `${w1} ${w2}`, base3 = `${w1} ${w2} ${w3}`, base4 = `${w1} ${w2} ${w3} ${w4}`;
    if (collocationBank.includes(base4)) { result.push(base4); i+=4; continue; }
    if (collocationBank.includes(base3)) { result.push(base3); i+=3; continue; }
    if (collocationBank.includes(base2)) { result.push(base2); i+=2; continue; }
    if (det.includes(w1) && collocationBank.includes(`${w2} ${w3}`)) {
      result.push(`${w1} ${w2} ${w3}`); i+=3; continue;
    }
    if (prep.includes(w1) && det.includes(w2) && collocationBank.includes(`${w3} ${w4}`)) {
      result.push(`${w1} ${w2} ${w3} ${w4}`); i+=4; continue;
    }
    result.push(w1); i++;
  }
  const layered = [];
  for (let j = 1; j <= result.length; j++) {
    layered.push(result.slice(0, j).join(" "));
  }
  return layered;
}

// ✅ Phát âm cụm
function speak(text) {
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.voice = voice;
  speechSynthesis.speak(utter);
}

// ✅ Chuẩn hóa văn bản để chấm điểm
function normalize(text) {
  return text.toLowerCase().replace(/[^a-z0-9'\s]/g, "").trim();
}

// ✅ Chấm điểm sau khi nhận giọng nói
function checkAccuracy(userText) {
  const currentPhrase = normalize(currentChunks[chunkIndex]);
  const userWords = normalize(userText).split(/\s+/);
  const targetWords = currentPhrase.split(/\s+/);
  let correct = 0;
  for (let word of targetWords) {
    if (userWords.includes(word)) correct++;
  }
  const percent = Math.round((correct / targetWords.length) * 100);
  const result = document.getElementById("speechResult");
  result.innerHTML = `✅ Bạn nói: "<i>${userText}</i>"<br>🎯 Đúng ${correct}/${targetWords.length} từ → <b>${percent}%</b>`;
}

// ✅ Giao diện luyện nói + nút ghi âm
function renderChunk(autoSpeak = true, target = "", meaning = "") {
  const phrase = currentChunks[chunkIndex];
  const area = document.getElementById("speakingArea");
  area.innerHTML = `
    <div style="font-size:20px; margin-bottom:8px;">🔤 Từ chính: <b>${target}</b> (${meaning})</div>
    <div style="font-size:26px; margin-bottom:14px;">🧩 Luyện cụm: <b>${phrase}</b></div>
    <button id="playBtn">🔊 Nghe lại</button>
    <button id="recordBtn">🎤 Bấm để bắt đầu nói</button>
    <button id="nextBtn" style="margin-left:12px;">⏩ Tiếp theo</button>
    <div id="speechResult" style="margin-top:16px;"></div>
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
        area.innerHTML = `<div style="font-size:24px;">🏁 Bạn đã luyện hết toàn bộ nội dung!</div>`;
      }
    }
  };

  // ✅ Ghi âm bằng Web Speech API
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Thiết bị của bạn không hỗ trợ nhận giọng nói trực tiếp.");
    return;
  }

  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  const recordBtn = document.getElementById("recordBtn");
  recordBtn.onclick = () => {
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

// ✅ Bắt đầu câu mới
function startSentence() {
  const { text, target, meaning } = sentences[sentenceIndex];
  currentChunks = chunkSentence(text);
  chunkIndex = 0;
  renderChunk(true, target, meaning);
}

// ✅ Voice hệ thống
function getVoices() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}

// ✅ Khởi động
getVoices().then(v => {
  voice = v.find(v => v.lang === "en-US") || v[0];
  const wordBank = getWordBank();
  fetch(SHEET_URL).then(res => res.text()).then(txt => {
    const json = JSON.parse(txt.substring(47).slice(0, -2));
    const rows = json.table.rows;
    collocationBank = extractCollocations(rows);
    sentences = extractSentences(rows, wordBank);
    sentenceIndex = 0;
    if (sentences.length > 0) {
      startSentence();
    } else {
      document.getElementById("speakingArea").innerHTML = `<div style="font-size:20px;">⚠️ Không có bài luyện phù hợp với từ bạn đã chọn.</div>`;
    }
  });
});
