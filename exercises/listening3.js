// ===== Config =====
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

// ===== State =====
let L3_sentences = []; // [{ text, target, lessonName, unitNum }]
let L3_targets = [];   // danh sách 8 từ vựng cột C (tương ứng từng câu)
let L3_blankIndices = []; // index các câu bị che (5 trong 8)
let L3_voiceMale = null;
let L3_voiceFemale = null;
let L3_score = 0;
let L3_total = 0; // số blank (5)
let L3_ready = false;

// ===== Helpers =====
function normalizeUnitId(unitStr) {
  if (!unitStr) return 0;
  const parts = unitStr.split("-");
  if (parts.length < 3) return 0;
  const [cls, lesson, part] = parts;
  return parseInt(cls, 10) * 1000 + parseInt(lesson, 10) * 10 + parseInt(part, 10);
}
function splitTargets(rawTarget) {
  return (rawTarget || "")
    .toLowerCase()
    .split(/[/;,]/)
    .map(t => t.trim())
    .filter(Boolean);
}
function pickRandomIndices(n, k) {
  // chọn ngẫu nhiên k chỉ số trong [0..n-1]
  const arr = Array.from({ length: n }, (_, i) => i);
  arr.sort(() => Math.random() - 0.5);
  return arr.slice(0, Math.min(k, n));
}
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getVoices() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}
function speak(text, voice) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
function updateScoreBoardL3() {
  const el = document.getElementById("scoreBoard");
  if (el) el.textContent = `🎯 Điểm: ${L3_score}/${L3_total}`;
}
async function fetchGVizRows(url) {
  const res = await fetch(url);
  const txt = await res.text();
  const json = JSON.parse(txt.substring(47).slice(0, -2));
  return json.table?.rows || [];
}

async function getMaxLessonCode() {
  const SHEET_BAI_HOC = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
  const trainerClass = localStorage.getItem("trainerClass")?.trim() || "";

  const res = await fetch(SHEET_BAI_HOC);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const baiList = rows
    .map(r => {
      const lop = r.c[0]?.v?.toString().trim();
      const bai = r.c[2]?.v?.toString().trim();
      return lop === trainerClass && bai ? parseInt(bai, 10) : null;
    })
    .filter(v => typeof v === "number");

  if (baiList.length === 0) return null;
  return Math.max(...baiList);
}

function extractPresentationData(rows, maxLessonCode) {
  // Cột:
  // B (1): lessonName, C (2): vocabRaw, I (8): presentation sentence
  const items = rows.map(r => {
    const lessonName = r.c?.[1]?.v?.toString().trim() || ""; // B
    const vocabRaw   = r.c?.[2]?.v?.toString().trim() || ""; // C
    const presentation = r.c?.[8]?.v?.toString().trim() || ""; // I

    const unitNum = normalizeUnitId(lessonName);
    const targets = splitTargets(vocabRaw); // có thể nhiều từ, lấy từ đầu tiên làm chính
    const mainTarget = targets[0] || ""; // chọn một từ đại diện

    return { lessonName, unitNum, presentation, mainTarget };
  }).filter(it => it.lessonName && it.presentation && it.mainTarget);

  // Lọc phạm vi bài đã học
  const filtered = items.filter(it => it.unitNum >= 3011 && it.unitNum <= maxLessonCode);

  // Group theo bài, random chọn 8 bài, mỗi bài lấy 1 câu
  const unitMap = {};
  filtered.forEach(it => {
    if (!unitMap[it.lessonName]) unitMap[it.lessonName] = [];
    unitMap[it.lessonName].push(it);
  });

  const unitNames = Object.keys(unitMap);
  if (unitNames.length === 0) return [];

  unitNames.sort(() => Math.random() - 0.5);
  const NUM_LESSONS = Math.min(8, unitNames.length);
  const pickedUnits = unitNames.slice(0, NUM_LESSONS);

  const selected = [];
  pickedUnits.forEach(u => {
    const rows = unitMap[u];
    const chosen = rows[Math.floor(Math.random() * rows.length)];
    selected.push(chosen);
  });

  // Sắp xếp theo unitNum để đoạn văn mượt
  selected.sort((a, b) => a.unitNum - b.unitNum);
  return selected; // [{ lessonName, unitNum, presentation, mainTarget }]
}

function buildParagraphAndBlanks() {
  // L3_sentences: 8 câu, mỗi câu có text và target
  // Chọn ngẫu nhiên 5 câu để che từ (blank)
  L3_blankIndices = pickRandomIndices(L3_sentences.length, Math.min(5, L3_sentences.length));
  L3_total = L3_blankIndices.length;
}

function renderListening3() {
  const area = document.getElementById("exerciseArea");
  const resultBox = document.getElementById("resultBox");

  // Tạo map idx -> số thứ tự theo thứ tự xuất hiện
  const blankOrderMap = {};
  let counter = 1;
  L3_sentences.forEach((s, idx) => {
    if (L3_blankIndices.includes(idx)) {
      blankOrderMap[idx] = counter++;
    }
  });

  // Đoạn văn hiển thị với (n)__
  const renderedParts = L3_sentences.map((s, idx) => {
    if (L3_blankIndices.includes(idx)) {
      const n = blankOrderMap[idx];
      const rx = new RegExp(`\\b${escapeRegExp(s.target)}\\b`, "gi");
      return s.text.replace(rx, `(${n})__`);
    }
    return s.text;
  });

  const paragraphDisplay = renderedParts.join(". ").replace(/\s+\./g, ".").trim() + ".";
  const paragraphOriginal = L3_sentences.map(s => s.text).join(". ").replace(/\s+\./g, ".").trim() + ".";

  area.innerHTML = `
    <div class="dialogue-text">
      <p>🧩 Nghe đoạn văn và điền 5 từ còn thiếu:</p>
      <div id="paragraphBox" style="font-size:20px; color:#667; margin-bottom:10px;">${paragraphDisplay}</div>
      <div style="margin-bottom:10px;">
        <button id="playParagraphBtn" class="btn primary">▶️ Nghe đoạn văn</button>
      </div>
      <div id="inputsArea"></div>
      <div style="margin-top:12px;">
        <button id="submitL3Btn" class="btn success">✅ Nộp bài</button>
      </div>
    </div>
  `;

  // Render inputs theo đúng thứ tự 1..5
  const inputsArea = document.getElementById("inputsArea");
  inputsArea.innerHTML = "";
  Object.entries(blankOrderMap).forEach(([idx, n]) => {
    const row = document.createElement("div");
    row.style.margin = "6px 0";
    row.innerHTML = `
      <label><strong>(${n})</strong></label>
      <input type="text" id="blankInput-${n}" placeholder="Điền từ" style="padding:6px; width:220px;" />
    `;
    inputsArea.appendChild(row);
  });

  // Nút nghe: đọc nguyên văn
  document.getElementById("playParagraphBtn").onclick = () => {
    speak(paragraphOriginal, L3_voiceMale);
  };

  // Nút nộp bài
  document.getElementById("submitL3Btn").onclick = () => {
    let correct = 0;
    Object.entries(blankOrderMap).forEach(([idx, n]) => {
      const inputVal = (document.getElementById(`blankInput-${n}`).value || "").trim().toLowerCase();
      const target = (L3_sentences[idx].target || "").trim().toLowerCase();
      if (inputVal && inputVal === target) correct++;
    });
    L3_score = correct;
    resultBox.textContent = `✅ Đúng ${correct}/${L3_total}`;
    updateScoreBoardL3();
    setResultListeningPart(3, L3_score, L3_total);
    showL3Answers();
  };
}


function showL3Answers() {
  // Hiển thị đoạn văn với đáp án đúng được tô màu
  const area = document.getElementById("exerciseArea");
  const resolvedParts = L3_sentences.map((s, idx) => {
    const target = s.target;
    if (L3_blankIndices.includes(idx)) {
      const highlighted = `<b style="color:#cc3333;">${target}</b>`;
      const rx = new RegExp(`\\b${escapeRegExp(target)}\\b`, "gi");
      return `${s.text.replace(rx, highlighted)}`;
    }
    return s.text;
  });
  const resolvedParagraph = resolvedParts.join(". ").replace(/\s+\./g, ".").trim() + ".";
  const answerBox = document.createElement("div");
  answerBox.style.marginTop = "10px";
  answerBox.innerHTML = `
    <div style="margin-top:10px; font-size:18px;">
      🧠 Đáp án đầy đủ:
      <div style="color:#333; margin-top:6px;">${resolvedParagraph}</div>
    </div>
  `;
  area.appendChild(answerBox);
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

  const totalScore = (updated.score1 + updated.score2 + updated.score3);
  const totalMax = (updated.total1 + updated.total2 + updated.total3);

  localStorage.setItem("result_listening", JSON.stringify({
    ...updated,
    score: totalScore,
    total: totalMax
  }));
}

// ===== Main: start + bootstrapping =====
async function startListeningMode3() {
  try {
    const maxLessonCode = await getMaxLessonCode();
    if (!maxLessonCode) {
      document.getElementById("exerciseArea").innerHTML = "⚠️ Không xác định được bài học lớn nhất cho lớp hiện tại.";
      return;
    }

    const rows = await fetchGVizRows(SHEET_URL);
    const selected = extractPresentationData(rows, maxLessonCode);
    if (selected.length < 8) {
      document.getElementById("exerciseArea").innerHTML = "📭 Không đủ dữ liệu câu ở cột I để tạo đoạn văn.";
      return;
    }

    // Chỉ lấy đúng 8 câu đầu (đã sort theo unitNum)
    const eight = selected.slice(0, 8);

    L3_sentences = eight.map(it => ({
      text: it.presentation,
      target: it.mainTarget,
      lessonName: it.lessonName,
      unitNum: it.unitNum
    }));

    L3_targets = L3_sentences.map(s => s.target);

    // Xây dựng blank (chọn 5 câu trong 8 để che)
    buildParagraphAndBlanks();

    // Render UI
    L3_ready = true;
    L3_score = 0;
    updateScoreBoardL3();
    renderListening3();

    // Auto đọc NGUYÊN VĂN sau khi render
    const fullParagraph = L3_sentences.map(s => s.text).join(". ").replace(/\s+\./g, ".").trim() + ".";
    speak(fullParagraph, L3_voiceMale);

  } catch (err) {
    console.error("Listening 3 error:", err);
    document.getElementById("exerciseArea").innerHTML = "❌ Lỗi tải dữ liệu Listening 3.";
  }
}

// ===== Bootstrapping =====
getVoices().then(voices => {
  // Giọng nam
  L3_voiceMale =
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("david")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("alex")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("male")) ||
    voices.find(v => v.lang === "en-US");

  // Giọng nữ
  L3_voiceFemale =
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("zira")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("samantha")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("female")) ||
    voices.find(v => v.lang === "en-US");

  // Vào là chạy luôn (không cần nút bắt đầu)
  startListeningMode3();
});
