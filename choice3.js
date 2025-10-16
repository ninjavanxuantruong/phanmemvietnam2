// choice3.js (phần 1/2)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// Firebase config (giống test.js)
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

// ===== Helpers =====
function makeDocId(classId) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `test-${classId}-${dd}${mm}${yyyy}`;
}

function normalizeText(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,!?;:()"]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

// ===== State =====
let totalScore = 0;
let correctCount = 0;
let wrongCount = 0;
let totalQuestions = 0;
let speakingTarget = "";
let speakingSentenceCount = 0;

// ===== Render MCQ / Listening / Phonics =====
function renderMCQ(container, items, label) {
  const section = document.createElement("div");
  section.innerHTML = `<h2>${label} (${items.length} câu)</h2>`;
  items.forEach((q, idx) => {
    const div = document.createElement("div");
    div.className = "question";
    div.innerHTML = `<p>${q.id}: ${q.prompt}</p>`;
    q.choices.forEach((c, i) => {
      const opt = document.createElement("div");
      opt.className = "option";
      opt.textContent = `${String.fromCharCode(65+i)}. ${c}`;
      opt.onclick = () => {
        if (opt.classList.contains("correct") || opt.classList.contains("wrong")) return;
        if (i === q.correctIndex) {
          opt.classList.add("correct");
          correctCount++; totalScore++;
        } else {
          opt.classList.add("wrong");
          wrongCount++;
        }
        totalQuestions++;
        updateResult();
      };
      div.appendChild(opt);
    });
    section.appendChild(div);
  });
  container.appendChild(section);
}

// ===== Render Sentence =====
function renderSentence(container, items) {
  const section = document.createElement("div");
  section.innerHTML = `<h2>🧩 Ghép câu (${items.length} câu)</h2>`;
  items.forEach(q => {
    const div = document.createElement("div");
    div.className = "question";
    div.innerHTML = `<p>${q.id}: ${q.question}</p>`;
    const input = document.createElement("input");
    input.type = "text"; input.size = 50;
    const btn = document.createElement("button");
    btn.textContent = "Kiểm tra";
    btn.onclick = () => {
      const val = normalizeText(input.value);
      const ans = normalizeText(q.answer);
      if (val === ans) {
        input.style.background = "#c8f7c5";
        correctCount++; totalScore++;
      } else {
        input.style.background = "#f7c5c5";
        wrongCount++;
      }
      totalQuestions++;
      updateResult();
    };
    div.appendChild(input);
    div.appendChild(btn);
    section.appendChild(div);
  });
  container.appendChild(section);
}
// choice3.js (phần 2/2)

// ===== Render Speaking =====
function renderSpeaking(paragraph, count) {
  speakingTarget = paragraph;
  speakingSentenceCount = count;
  document.getElementById("speakingParagraph").textContent = paragraph;
}

// ===== Speaking scoring =====
function scoreSpeaking(transcript, target, totalSentences) {
  const normTranscript = normalizeText(transcript);
  const normTarget = normalizeText(target);
  const transcriptWords = normTranscript.split(" ");
  const targetWords = normTarget.split(" ");

  let matchCount = 0;
  transcriptWords.forEach(w => {
    if (targetWords.includes(w)) matchCount++;
  });

  const percent = (matchCount / targetWords.length) * 100;
  let score = 0;
  if (percent >= 80) score = totalSentences;
  else if (percent >= 50) score = Math.round(totalSentences / 2);
  else score = 0;

  return { score, percent };
}

// ===== Update result =====
function updateResult() {
  document.getElementById("resultBox").textContent =
    `✅ Đúng: ${correctCount} | ❌ Sai: ${wrongCount} | Tổng điểm: ${totalScore}`;
}

// ===== Main =====
async function main() {
  const classId = localStorage.getItem("trainerClass") || "3";
  const docId = makeDocId(classId);
  const snap = await getDoc(doc(db, "test", docId));
  if (!snap.exists()) {
    alert("❌ Không tìm thấy đề kiểm tra hôm nay.");
    return;
  }
  const data = snap.data();
  const container = document.getElementById("testContainer");

  renderMCQ(container, data.mcq || [], "📝 Trắc nghiệm");
  renderMCQ(container, data.listening || [], "🎧 Listening");
  renderSentence(container, data.sentence || []);
  renderMCQ(container, data.pronunciation || [], "🔊 Phonics");
  renderSpeaking(data.speaking?.paragraph || "", data.speaking?.count || 0);

  updateResult();
}

// ===== Speaking record =====
document.getElementById("recordBtn").onclick = () => {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Trình duyệt không hỗ trợ SpeechRecognition");
    return;
  }
  const recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript;
    const { score, percent } = scoreSpeaking(transcript, speakingTarget, speakingSentenceCount);
    totalScore += score;
    document.getElementById("speakingResult").textContent =
      `Bạn nói: "${transcript}"\nĐộ chính xác: ${Math.round(percent)}% → Điểm Speaking: ${score}`;
    updateResult();
  };

  recognition.onerror = (event) => {
    alert("❌ Lỗi ghi âm: " + event.error);
  };

  recognition.start();
};

// Run
main().catch(err => {
  console.error(err);
  alert("❌ Lỗi khi tải đề.");
});
