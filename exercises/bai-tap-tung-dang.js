// ===== Config nguồn dữ liệu =====
const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vTZBSB2UBklxSCr3Q-g6DyJ731csJmsh2-GyZ8ajbdTuYWFrA3KLUdS8SsbHOcENX3PnMknXP2KRpqs/pub?gid=163446275&single=true&output=csv";

// Mỗi dạng chiếm 7 cột ngang: [question, A, B, C, D, correct, note]
const typeOffsets = {
  pronunciation: 0,
  verb: 7,
  article: 14,
  preposition: 21,
  pronoun: 28,
  connector: 35,
  rewrite: 42,
  plural: 49,
  wordform: 56,
  vocabulary: 63
};

let totalScore = 0;
let totalQuestions = 0;
let correctCount = 0;
let wrongCount = 0;

// ===== Helpers =====
function normalize(text) {
  return text?.trim().toLowerCase().replace(/[^a-z0-9'\s]/g, "");
}

function shuffleArray(array) {
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}

function updateStats() {
  const el = document.getElementById("score");
  if (!el) return;
  el.innerHTML = `
    <strong>Điểm:</strong> ${totalScore} |
    <strong>Đã làm:</strong> ${totalQuestions} |
    <strong>Đúng:</strong> ${correctCount} |
    <strong>Sai:</strong> ${wrongCount}
  `;
}

// ===== Tổng hợp Grade 8 từ mọi phần =====
function recomputeGrade8() {
  let sumCorrect = 0, sumTotal = 0;

  // Cộng Grammar/Vocab
  Object.keys(typeOffsets).forEach(t => {
    const data = JSON.parse(localStorage.getItem(`score_${t}_grade8`) || "{}");
    if (typeof data.correct === "number" && typeof data.total === "number") {
      sumCorrect += data.correct;
      sumTotal   += data.total;
    }
  });

  // Cộng Reading
  const reading = JSON.parse(localStorage.getItem("result_reading") || "{}");
  sumCorrect += (reading.score || 0);
  sumTotal   += (reading.total || 0);

  // Cộng Listening
  const listening = JSON.parse(localStorage.getItem("result_listeningcap2") || "{}");
  sumCorrect += (listening.score || 0);
  sumTotal   += (listening.total || 0);

  // Cộng Writing
  const writing = JSON.parse(localStorage.getItem("result_writingcap2") || "{}");
  sumCorrect += (writing.score || 0);
  sumTotal   += (writing.total || 0);

  // Ghi lại tổng grade 8
  localStorage.setItem("result_grade8", JSON.stringify({
    score: sumCorrect,
    total: sumTotal
  }));
}

// ===== Lưu điểm từng dạng Grammar/Vocab + cập nhật tổng Grade 8 =====
function saveScoreToLocal(type, correct, total) {
  // 1) Lưu điểm dạng hiện tại (ghi đè)
  localStorage.setItem(`score_${type}_grade8`, JSON.stringify({ correct, total }));
  // 2) Tính lại tổng Grade 8 từ mọi phần
  recomputeGrade8();
}

// ===== CSV Parser =====
function parseCSV(text) {
  const rows = [];
  let row = [], cell = "", inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const char = text[i], next = text[i+1];
    if (inQuotes) {
      if (char === '"' && next === '"') { cell += '"'; i++; }
      else if (char === '"') { inQuotes = false; }
      else { cell += char; }
    } else {
      if (char === '"') inQuotes = true;
      else if (char === ",") { row.push(cell.trim()); cell = ""; }
      else if (char === "\n") { row.push(cell.trim()); rows.push(row); row = []; cell = ""; }
      else if (char !== "\r") cell += char;
    }
  }
  if (cell.length > 0 || row.length > 0) { row.push(cell.trim()); rows.push(row); }
  return rows;
}

async function fetchSheetData() {
  const res = await fetch(sheetUrl);
  const text = await res.text();
  return parseCSV(text).filter(r => r.length > 0);
}

// ===== Chia khoảng & phân bổ =====
function buildRangesIndices(totalRows, startIndex = 1, blockSize = 30) {
  const effectiveRows = totalRows - startIndex;
  const numRanges = Math.ceil(effectiveRows / blockSize);
  const ranges = [];
  for (let r = 0; r < numRanges; r++) {
    const start = startIndex + r * blockSize;
    const end = Math.min(start + blockSize - 1, totalRows - 1);
    ranges.push([start, end]);
  }
  return ranges;
}

function allocateCounts(totalNeeded, numRanges) {
  if (numRanges <= 0) return [];
  if (numRanges === 1) return [totalNeeded];
  if (numRanges === 2) return [Math.floor(totalNeeded/2), Math.ceil(totalNeeded/2)];
  if (numRanges === 3) {
    const first = Math.round(totalNeeded*0.3);
    const second = Math.round(totalNeeded*0.4);
    return [first, second, totalNeeded-first-second];
  }
  if (numRanges === 4) {
    const q = Math.floor(totalNeeded/4);
    return [q,q,q,totalNeeded-3*q];
  }
  const base = Math.floor(totalNeeded/numRanges);
  const counts = Array(numRanges).fill(base);
  let remainder = totalNeeded - base*numRanges;
  for (let i=0;i<counts.length && remainder>0;i++){counts[i]++; remainder--;}
  return counts;
}

// ===== Đọc 1 câu hỏi theo offset =====
function readQuestionRow(row, offset) {
  if (!row || row.length < offset+6) return null;
  const question = row[offset] || "";
  const ansA = row[offset+1] || "";
  const ansB = row[offset+2] || "";
  const ansC = row[offset+3] || "";
  const ansD = row[offset+4] || "";
  const correctRaw = row[offset+5] || "";
  const correctArr = correctRaw.split(",").map(x=>normalize(x)).filter(Boolean);
  const note = row[offset+6] || "";
  if (!question.trim()) return null;
  return {
    question,
    answers:[
      {letter:"A",text:ansA},
      {letter:"B",text:ansB},
      {letter:"C",text:ansC},
      {letter:"D",text:ansD}
    ],
    correctArr,
    note
  };
}

// ===== Hiển thị container =====
function showOnly(visibleId) {
  const ids = [
    "quizContainer",
    "writingContainer",
    "listeningContainer",
    "readingContainer"
  ];
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (id === visibleId) el.classList.remove("hidden");
    else el.classList.add("hidden");
  });
}

// ===== Teardown =====
function teardownReading() {
  if (typeof stopReadingExercise === "function") stopReadingExercise();
  const rp = document.getElementById("readingPassageContainer");
  const rq = document.getElementById("readingQuestionsContainer");
  if (rp) rp.innerHTML = "";
  if (rq) rq.innerHTML = "";
}

function teardownListening() {
  if (typeof stopListeningCap2 === "function") stopListeningCap2();
  ["exerciseArea_L2_1","listeningPassageContainer_L2_2","listeningQuestionsContainer_L2_2","exerciseArea_L2_3"]
    .forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = "";
    });
}

function teardownWriting() {
  if (typeof stopWritingCap2 === "function") stopWritingCap2();
  const w = document.getElementById("writingContainer");
  if (w) w.innerHTML = "";
}

function teardownQuiz() {
  const qz = document.getElementById("quizContainer");
  if (qz) qz.innerHTML = "";
}
function teardownAll() {
  teardownQuiz();
  teardownWriting();
  teardownListening();
  teardownReading();
}

// ===== Main: Load Exercise =====
async function loadExercise() {
  const type = document.getElementById("exerciseType").value;
  localStorage.setItem("startTime_grade8", Date.now());

  // Reset điểm hiển thị tạm
  totalScore = 0; totalQuestions = 0; correctCount = 0; wrongCount = 0;
  updateStats();

  // Dọn mọi state/dữ liệu cũ trước
  teardownAll();

  // === Reading ===
  if (type === "reading") {
    showOnly("readingContainer");
    // Truyền mode practice để file con lưu riêng và sau đó recompute tổng
    if (typeof loadReadingExercise === "function") {
      loadReadingExercise("practice", () => recomputeGrade8());
    }
    return;
  }

  // === Listening ===
  if (type === "listeningcap2") {
    showOnly("listeningContainer");
    // Truyền mode practice để file con lưu riêng và sau đó recompute tổng
    if (typeof startListeningCap2 === "function") {
      startListeningCap2("practice", () => recomputeGrade8());
    }
    return;
  }

  // === Writing ===
  if (type === "writingcap2") {
    showOnly("writingContainer");
    // Truyền mode practice để file con lưu riêng và sau đó recompute tổng
    if (typeof startWritingCap2 === "function") {
      startWritingCap2("practice", () => recomputeGrade8());
    }
    return;
  }

  // === Grammar/Vocab (CSV) ===
  showOnly("quizContainer");

  const questionLimit = parseInt(document.getElementById("questionCount").value, 10);
  const offset = typeOffsets[type];
  if (offset === undefined) {
    console.error("❌ Không tìm thấy dạng bài:", type);
    return;
  }

  const rows = await fetchSheetData();
  const totalRows = rows.length;

  const rangeBlocks = buildRangesIndices(totalRows, 1, 30);
  const perRangeCounts = allocateCounts(questionLimit, rangeBlocks.length);

  const selected = [];
  for (let r = 0; r < rangeBlocks.length; r++) {
    const [startIdx, endIdx] = rangeBlocks[r];
    const countNeeded = perRangeCounts[r];
    const pool = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const q = readQuestionRow(rows[i], offset);
      if (q) pool.push(q);
    }
    if (pool.length && countNeeded > 0) {
      selected.push(...shuffleArray(pool).slice(0, countNeeded));
    }
  }

  if (selected.length < questionLimit) {
    const globalPool = [];
    for (let i = 1; i < totalRows; i++) {
      const q = readQuestionRow(rows[i], offset);
      if (q) globalPool.push(q);
    }
    const needed = questionLimit - selected.length;
    selected.push(...shuffleArray(globalPool).slice(0, needed));
  }

  const questions = shuffleArray(selected).slice(0, questionLimit);

  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  questions.forEach((q, index) => {
    const block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML = `<strong>Câu ${index + 1}:</strong> ${q.question}`;

    const ul = document.createElement("ul");
    ul.className = "answers";

    shuffleArray(q.answers).forEach((opt, i) => {
      if (opt.text?.trim()) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.className = "answer-btn";
        btn.innerText = `${String.fromCharCode(65 + i)}. ${opt.text}`;

        let inputRef;

        btn.onclick = () => {
          totalQuestions++;
          const userAnswer = normalize(opt.text);

          if (q.correctArr.includes(userAnswer)) {
            btn.classList.add("correct");
            totalScore++;
            correctCount++;
          } else {
            btn.classList.add("wrong");
            wrongCount++;
          }

          ul.querySelectorAll("button").forEach(b => b.disabled = true);
          if (inputRef) inputRef.disabled = true;

          updateStats();

          // Lưu khi làm xong toàn dạng để total khớp max
          if (totalQuestions === questions.length) {
            saveScoreToLocal(type, correctCount, totalQuestions);
          }

          if (q.note) {
            const noteEl = document.createElement("div");
            noteEl.style.marginTop = "8px";
            noteEl.style.color = "#666";
            noteEl.innerHTML = `💡 Ghi chú: ${q.note}`;
            block.appendChild(noteEl);
          }
        };

        li.appendChild(btn);
        ul.appendChild(li);
      }
    });

    block.appendChild(ul);

    const input = document.createElement("input");
    input.placeholder = "Nhập đáp án ...";
    input.onblur = () => {
      if (input.disabled) return;

      const userAnswer = normalize(input.value);
      totalQuestions++;
      if (q.correctArr.includes(userAnswer)) {
        input.classList.add("correct");
        totalScore++;
        correctCount++;
      } else {
        input.classList.add("wrong");
        wrongCount++;
      }

      input.disabled = true;
      ul.querySelectorAll("button").forEach(b => b.disabled = true);

      updateStats();

      // Lưu khi làm xong toàn dạng để total khớp max
      if (totalQuestions === questions.length) {
        saveScoreToLocal(type, correctCount, totalQuestions);
      }

      if (q.note) {
        const noteEl = document.createElement("div");
        noteEl.style.marginTop = "8px";
        noteEl.style.color = "#666";
        noteEl.innerHTML = `💡 Ghi chú: ${q.note}`;
        block.appendChild(noteEl);
      }
    };

    // ref để disable input khi đã chọn đáp án
    inputRef = input;

    block.appendChild(input);
    container.appendChild(block);
  });
}

// ===== (Tuỳ chọn) Gắn sự kiện nút Load =====
// document.getElementById("loadBtn").addEventListener("click", loadExercise);
