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
  document.getElementById("score").innerHTML = `
    <strong>Điểm:</strong> ${totalScore} |
    <strong>Đã làm:</strong> ${totalQuestions} |
    <strong>Đúng:</strong> ${correctCount} |
    <strong>Sai:</strong> ${wrongCount}
  `;
}

function saveScoreToLocal(type) {
  const newScore = correctCount;
  const newTotal = totalQuestions;

  const oldData = JSON.parse(localStorage.getItem(`score_${type}_grade8`) || "{}");
  const oldScore = oldData.correct || 0;
  const oldTotal = oldData.total || 0;

  const scoreData = { correct: newScore, total: newTotal };
  localStorage.setItem(`score_${type}_grade8`, JSON.stringify(scoreData));

  const prevResult = JSON.parse(localStorage.getItem("result_grade8") || "{}");
  const updatedResult = {
    score: (prevResult.score || 0) - oldScore + newScore,
    total: (prevResult.total || 0) - oldTotal + newTotal
  };

  localStorage.setItem("result_grade8", JSON.stringify(updatedResult));
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

// ===== Main =====
// ===== Main =====
async function loadExercise() {
  const type = document.getElementById("exerciseType").value;
  localStorage.setItem("startTime_grade8", Date.now());

  // Reset điểm
  totalScore = 0;
  totalQuestions = 0;
  correctCount = 0;
  wrongCount = 0;
  updateStats();

  // Reading / Listening / Writing xử lý riêng
  if (type === "reading") {
    if (typeof loadReadingExercise === "function") loadReadingExercise();
    return;
  }
  if (type === "listeningcap2") {
    if (typeof startListeningCap2 === "function") startListeningCap2();
    return;
  }
  if (type === "writingcap2") {
    if (typeof startWritingCap2 === "function") startWritingCap2();
    return;
  }

  // Grammar/Vocab
  const questionLimit = parseInt(document.getElementById("questionCount").value, 10);
  const offset = typeOffsets[type];
  if (offset === undefined) {
    console.error("❌ Không tìm thấy dạng bài:", type);
    return;
  }

  const rows = await fetchSheetData();
  const totalRows = rows.length;

  // Chia thành các block 30 dòng
  const rangeBlocks = buildRangesIndices(totalRows, 1, 30);
  const perRangeCounts = allocateCounts(questionLimit, rangeBlocks.length);

  // Gom câu hỏi
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

  // Nếu chưa đủ thì bổ sung từ toàn bộ pool
  if (selected.length < questionLimit) {
    const globalPool = [];
    for (let i = 1; i < totalRows; i++) {
      const q = readQuestionRow(rows[i], offset);
      if (q) globalPool.push(q);
    }
    const needed = questionLimit - selected.length;
    selected.push(...shuffleArray(globalPool).slice(0, needed));
  }

  // Trộn lại toàn bộ
  const questions = shuffleArray(selected).slice(0, questionLimit);

  // Render
  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  questions.forEach((q, index) => {
    const block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML = `<strong>Câu ${index + 1}:</strong> ${q.question}`;

    const ul = document.createElement("ul");
    ul.className = "answers";

    // Shuffle đáp án
    shuffleArray(q.answers).forEach((opt, i) => {
      if (opt.text?.trim()) {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.className = "answer-btn";
        btn.innerText = `${String.fromCharCode(65 + i)}. ${opt.text}`;

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

          // Disable tất cả nút sau khi chọn
          ul.querySelectorAll("button").forEach(b => b.disabled = true);
          input.disabled = true;

          updateStats();

          if (totalQuestions === questions.length) {
            saveScoreToLocal(type);
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

    // Ô input nhập đáp án thủ công
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

      if (totalQuestions === questions.length) {
        saveScoreToLocal(type);
      }

      if (q.note) {
        const noteEl = document.createElement("div");
        noteEl.style.marginTop = "8px";
        noteEl.style.color = "#666";
        noteEl.innerHTML = `💡 Ghi chú: ${q.note}`;
        block.appendChild(noteEl);
      }
    };

    block.appendChild(input);
    container.appendChild(block);
  });
}
