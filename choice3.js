// choice3.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore, doc, getDoc, setDoc, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { initNormalBattle, playerAttack, wildAttack } from "./exercises/effect-normal.js";

// ===== Firebase config =====
const firebaseConfig = {
  apiKey: "AIzaSyBQ1pPmSdBV8M8YdVbpKhw_DOetmzIMwXU",
  authDomain: "lop-hoc-thay-tinh.firebaseapp.com",
  projectId: "lop-hoc-thay-tinh",
  storageBucket: "lop-hoc-thay-tinh.firebasestorage.app",
  messagingSenderId: "391812475288",
  appId: "1:391812475288:web:ca4c275ac776d69deb23ed"
};
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ===== DOM refs =====
const container = document.getElementById("testContainer");
const speakingSection = document.getElementById("speakingSection");
const speakingParagraphEl = document.getElementById("speakingParagraph");
const speakingResultEl = document.getElementById("speakingResult");
const recordBtn = document.getElementById("recordBtn");
const resultBox = document.getElementById("resultBox");

// ===== Helpers =====
function makeDocId(classId) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `test-${classId}-${dd}${mm}${yyyy}`;
}
function todayStr() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}${mm}${yyyy}`;
}
function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

// ===== TTS voices (nam/nữ) =====
let voiceMale = null;
let voiceFemale = null;
function getVoices() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}
function speak(text, voice) {
  try {
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US";
    if (voice) u.voice = voice;
    u.rate = 1.0;
    speechSynthesis.speak(u);
  } catch {}
}
function speakENBoth(questionText, answerText) {
  // Đọc câu hỏi bằng giọng nam, câu trả lời bằng giọng nữ
  speak(questionText, voiceMale);
  setTimeout(() => speak(answerText, voiceFemale), 1200);
}

// ===== Global state =====
let data = null;
let partOrder = ["mcq", "listening", "sentence", "pronunciation", "speaking"];
let currentPartIndex = 0;
let currentIndex = 0;

let totalScore = 0;
let correctCount = 0;
let wrongCount = 0;

// Hiệu ứng chiến đấu
let battle = null;
let myPokemonId = parseInt(localStorage.getItem("myPokemonId") || "25", 10);

// ===== Load test data =====
async function loadTestData() {
  const classId = localStorage.getItem("trainerClass") || "3";
  const docId = makeDocId(classId);
  const snap = await getDoc(doc(db, "test", docId));
  if (!snap.exists()) {
    alert("❌ Không tìm thấy đề kiểm tra hôm nay.");
    throw new Error("No test doc");
  }
  return snap.data();
}

// ===== Update scoreboard =====
function updateResult() {
  resultBox.textContent = `✅ Đúng: ${correctCount} | ❌ Sai: ${wrongCount} | Tổng điểm: ${totalScore}`;
}

// ===== Navigation =====
function getCurrentPart() {
  return partOrder[currentPartIndex];
}
function getItems(part) {
  switch (part) {
    case "mcq": return data.mcq || [];
    case "listening": return data.listening || [];
    case "sentence": return data.sentence || [];
    case "pronunciation": return data.pronunciation || [];
    case "speaking": return [data.speaking || { paragraph: "", count: 0 }];
    default: return [];
  }
}
function gotoNextQuestion() {
  const part = getCurrentPart();
  const items = getItems(part);

  if (part === "speaking") {
    finishAll();
    return;
  }

  currentIndex++;
  if (currentIndex >= items.length) {
    currentPartIndex++;
    currentIndex = 0;
    if (currentPartIndex >= partOrder.length) {
      finishAll();
      return;
    }
  }
  renderCurrent();
}

// ===== Render dispatcher =====
function renderCurrent() {
  const part = getCurrentPart();
  // Clear view
  container.innerHTML = "";
  speakingParagraphEl.textContent = "";
  speakingResultEl.textContent = "";
  speakingSection.style.display = "none";

  switch (part) {
    case "mcq":
      renderMCQSingle(getItems("mcq")[currentIndex], "📝 Trắc nghiệm");
      break;
    case "listening":
      renderListeningSingle(getItems("listening")[currentIndex]);
      break;
    case "sentence":
      renderSentenceInteractive(getItems("sentence")[currentIndex]);
      break;
    case "pronunciation":
      renderMCQSingle(getItems("pronunciation")[currentIndex], "🔊 Phonics");
      break;
    case "speaking":
      renderSpeakingSingle(getItems("speaking")[0]);
      break;
    default:
      container.textContent = "❌ Không xác định phần.";
  }
  updateResult();
}

// ===== MCQ (single-question) =====
function renderMCQSingle(q, label) {
  if (!q) { gotoNextQuestion(); return; }
  const wrap = document.createElement("div");
  wrap.className = "question";
  const header = document.createElement("h2");
  header.textContent = `${label} (Câu hiện tại)`;
  const prompt = document.createElement("p");
  prompt.textContent = `${q.id}: ${q.prompt}`;

  wrap.appendChild(header);
  wrap.appendChild(prompt);

  q.choices.forEach((c, i) => {
    const opt = document.createElement("button");
    opt.className = "option";
    opt.textContent = `${String.fromCharCode(65 + i)}. ${c}`;
    opt.onclick = () => {
      if (i === q.correctIndex) {
        opt.classList.add("correct");
        correctCount++; totalScore++;
        playerAttack(battle);
      } else {
        opt.classList.add("wrong");
        wrongCount++;
        wildAttack(battle);
      }
      setTimeout(gotoNextQuestion, 700);
    };
    wrap.appendChild(opt);
  });

  container.appendChild(wrap);
}

// ===== Listening (che từ đúng + đọc TTS + A/B/C/D) =====
// Dữ liệu mong đợi mỗi item:
// { id, question, answer, choices: [...], correctIndex }
function renderListeningSingle(q) {
  if (!q) { gotoNextQuestion(); return; }

  const wrap = document.createElement("div");
  wrap.className = "question";

  const header = document.createElement("h2");
  header.textContent = "🎧 Nghe và chọn từ đúng";
  wrap.appendChild(header);

  const correctWord = Array.isArray(q.choices) && q.choices[q.correctIndex] ? q.choices[q.correctIndex] : "";

  // Che từ đúng trong question/answer hiển thị
  let displayQuestion = q.question || "";
  let displayAnswer = q.answer || "";
  if (correctWord) {
    const regex = new RegExp(`\\b${escapeRegExp(correctWord)}\\b`, "gi");
    displayQuestion = displayQuestion.replace(regex, "_____");
    displayAnswer = displayAnswer.replace(regex, "_____");
  }

  // Hiển thị
  const qEl = document.createElement("p");
  qEl.textContent = `🗣 Câu hỏi: ${displayQuestion}`;
  const aEl = document.createElement("p");
  aEl.textContent = `🗣 Trả lời: ${displayAnswer}`;
  wrap.appendChild(qEl);
  wrap.appendChild(aEl);

  // Nút nghe (đọc đầy đủ bản gốc)
  const btnListen = document.createElement("button");
  btnListen.className = "btn primary";
  btnListen.textContent = "▶️ Nghe lại";
  btnListen.onclick = () => {
    const fullQ = q.question || (q.prompt || "");
    const fullA = q.answer || "";
    speakENBoth(fullQ, fullA);
  };
  wrap.appendChild(btnListen);

  // Đáp án A/B/C/D
  q.choices.forEach((c, i) => {
    const opt = document.createElement("button");
    opt.className = "option";
    opt.textContent = `${String.fromCharCode(65 + i)}. ${c}`;
    opt.onclick = () => {
      if (i === q.correctIndex) {
        opt.classList.add("correct");
        correctCount++; totalScore++;
        playerAttack(battle);
      } else {
        opt.classList.add("wrong");
        wrongCount++;
        wildAttack(battle);
      }
      setTimeout(gotoNextQuestion, 900);
    };
    wrap.appendChild(opt);
  });

  container.appendChild(wrap);

  // Auto đọc một lần khi vào câu
  setTimeout(() => {
    const fullQ = q.question || (q.prompt || "");
    const fullA = q.answer || "";
    speakENBoth(fullQ, fullA);
  }, 300);
}
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// ===== Sentence (interactive arrange) =====
function renderSentenceInteractive(item) {
  if (!item) { gotoNextQuestion(); return; }

  const area = document.createElement("div");
  area.className = "question";
  area.innerHTML = `
    <h2>🧩 Sắp xếp từ thành câu</h2>
    <div class="question-box">Gợi ý: ${item.question || "(Sắp xếp lại để thành câu đúng)"}</div>
    <div style="margin:10px 0;"><strong>Chọn từ:</strong></div>
    <div id="arrangeBank"></div>
    <div style="margin-top:12px;"><strong>Câu của bạn:</strong> <span id="arrangeBuild"></span></div>
    <div style="margin-top:12px;">
      <button class="btn" id="undoBtn">↩️ Hoàn tác</button>
      <button class="btn" id="resetBtn">♻️ Làm lại</button>
      <button class="btn primary" id="submitBtn">✅ Kiểm tra</button>
      <button class="btn" id="skipBtn">⏭ Bỏ qua</button>
    </div>
    <p id="resultMsg" class="muted"></p>
  `;
  container.appendChild(area);

  const tokens = (item.tokens && item.tokens.length > 1)
    ? item.tokens.slice()
    : normalizeText(item.answer).split(" ").filter(Boolean);
  const shuffled = shuffle([...tokens]);

  const bankEl = area.querySelector("#arrangeBank");
  const buildEl = area.querySelector("#arrangeBuild");
  const resultEl = area.querySelector("#resultMsg");
  const picked = [];

  shuffled.forEach((tok, i) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = tok;
    chip.dataset.idx = String(i);
    chip.addEventListener("click", () => {
      if (chip.classList.contains("disabled")) return;
      picked.push(tok);
      chip.classList.add("disabled");
      renderBuild();
    });
    bankEl.appendChild(chip);
  });

  function renderBuild() {
    buildEl.textContent = picked.join(" ");
  }

  area.querySelector("#undoBtn").addEventListener("click", () => {
    if (!picked.length) return;
    const last = picked.pop();
    const chips = bankEl.querySelectorAll(".chip.disabled");
    for (let c of chips) {
      if (c.textContent === last) { c.classList.remove("disabled"); break; }
    }
    renderBuild();
  });

  area.querySelector("#resetBtn").addEventListener("click", () => {
    picked.length = 0;
    bankEl.querySelectorAll(".chip").forEach(c => c.classList.remove("disabled"));
    renderBuild();
    resultEl.textContent = "";
  });

  area.querySelector("#skipBtn").addEventListener("click", () => {
    wrongCount++;
    wildAttack(battle);
    gotoNextQuestion();
  });

  area.querySelector("#submitBtn").addEventListener("click", () => {
    const user = normalizeText(picked.join(" "));
    const ans = normalizeText(item.answer);
    if (!user) {
      resultEl.textContent = "⚠️ Hãy ghép câu trước đã.";
      return;
    }
    if (user === ans) {
      resultEl.style.color = "green";
      resultEl.textContent = "✅ Chính xác!";
      correctCount++; totalScore++;
      playerAttack(battle);
      speak(item.answer, voiceFemale);
    } else {
      resultEl.style.color = "red";
      resultEl.textContent = `❌ Sai. Đáp án: "${item.answer}"`;
      wrongCount++;
      wildAttack(battle);
    }
    setTimeout(gotoNextQuestion, 900);
  });
}

// ===== Speaking (ẩn/hiện theo phần) =====
function renderSpeakingSingle(sp) {
  const paragraph = sp.paragraph || "(Chưa có đoạn văn)";
  const count = sp.count || 0;

  // Hiển thị phần speaking khi đến mục này
  speakingSection.style.display = "block";
  speakingParagraphEl.textContent = paragraph;

  recordBtn.onclick = () => startSpeaking(paragraph, count);
}

function scoreSpeaking(transcript, target, totalSentences) {
  const normTranscript = normalizeText(transcript);
  const normTarget = normalizeText(target);
  const tsWords = normTranscript.split(" ").filter(Boolean);
  const tgtWords = normTarget.split(" ").filter(Boolean);

  let match = 0;
  tsWords.forEach(w => { if (tgtWords.includes(w)) match++; });

  const percent = tgtWords.length ? (match / tgtWords.length) * 100 : 0;
  let score = 0;
  if (percent >= 80) score = totalSentences;
  else if (percent >= 50) score = Math.round(totalSentences / 2);
  else score = 0;

  return { score, percent: Math.round(percent) };
}

function startSpeaking(paragraph, count) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) {
    alert("Trình duyệt không hỗ trợ ghi âm (SpeechRecognition).");
    return;
  }
  const recog = new SR();
  recog.lang = "en-US";
  recog.interimResults = false;
  recog.maxAlternatives = 1;

  recog.onresult = (ev) => {
    const transcript = ev.results[0][0].transcript;
    const { score, percent } = scoreSpeaking(transcript, paragraph, count);
    speakingResultEl.textContent = `Bạn nói: "${transcript}" | Độ chính xác: ${percent}% → Điểm Speaking: ${score}`;
    totalScore += score;
    if (percent >= 80) playerAttack(battle); else wildAttack(battle);
    updateResult();
    setTimeout(finishAll, 1000);
  };
  recog.onerror = (e) => alert("❌ Lỗi ghi âm: " + e.error);
  recog.start();
}

// ===== Save result to Firestore at end =====
async function finishAll() {
  try {
    await saveStudentResult();
    alert(`✅ Đã ghi điểm lên hệ thống.\nTổng điểm: ${totalScore}\nĐúng: ${correctCount} | Sai: ${wrongCount}`);
  } catch (e) {
    console.error("Save result error:", e);
    alert("❌ Lỗi ghi điểm lên hệ thống.");
  }
}

async function saveStudentResult() {
  const name = localStorage.getItem("trainerName") || "Không tên";
  const classId = localStorage.getItem("trainerClass") || "Chưa có lớp";
  const dateStr = todayStr();
  const docId = `hocsinh-${classId}-${dateStr}`;
  const ref = doc(db, "test", docId);

  await setDoc(ref, {
    name,
    class: classId,
    date: dateStr,
    score: totalScore,
    correct: correctCount,
    wrong: wrongCount,
    createdAt: serverTimestamp()
  }, { merge: true });
}

// ===== Main =====
(async function main() {
  // Chọn giọng nam/nữ
  const voices = await getVoices();
  voiceMale =
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("david")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("alex")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("male")) ||
    voices.find(v => v.lang === "en-US");
  voiceFemale =
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("zira")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("samantha")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("female")) ||
    voices.find(v => v.lang === "en-US");

  // Khởi tạo battlefield hiệu ứng Normal
  battle = initNormalBattle(myPokemonId);

  try {
    data = await loadTestData();
  } catch (e) {
    console.error(e);
    return;
  }
  if (!data.speaking) data.speaking = { paragraph: "", count: 0 };

  currentPartIndex = 0;
  currentIndex = 0;
  renderCurrent();
})();
