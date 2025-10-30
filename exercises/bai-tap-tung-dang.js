// ===== Config =====
const sheetUrl = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?sheet=2&tqx=out:json";

// Mỗi dạng chiếm 7 cột ngang: [question, A, B, C, D, correct, note]
const typeOffsets = {
  pronunciation: 0,   // A–G
  verb: 7,            // H–N
  article: 14,        // O–U
  preposition: 21,    // V–AB
  pronoun: 28,        // AC–AI
  connector: 35,      // AJ–AP
  rewrite: 42,        // AQ–AW
  plural: 49,         // AX–BD
  wordform: 56,       // BE–BK
  vocabulary: 63      // BL–BR
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

async function fetchSheetData() {
  const res = await fetch(sheetUrl);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table.rows;
}

// Tạo phân bổ số câu theo số khoảng
function allocateCounts(totalNeeded, numRanges) {
  if (numRanges <= 0) return [];

  if (numRanges === 1) return [totalNeeded];
  if (numRanges === 2) {
    const half = Math.floor(totalNeeded / 2);
    return [half, totalNeeded - half];
  }
  if (numRanges === 3) {
    const first = Math.round(totalNeeded * 0.3);
    const second = Math.round(totalNeeded * 0.4);
    let third = totalNeeded - first - second;
    if (third < 0) third = 0;
    return [first, second, third];
  }
  if (numRanges === 4) {
    const q = Math.floor(totalNeeded / 4);
    return [q, q, q, totalNeeded - 3 * q];
  }

  // >4 khoảng: chia đều
  const base = Math.floor(totalNeeded / numRanges);
  const counts = Array(numRanges).fill(base);
  let remainder = totalNeeded - base * numRanges;
  for (let i = 0; i < counts.length && remainder > 0; i++) {
    counts[i]++;
    remainder--;
  }
  return counts;
}

// Cắt sheet thành các "khoảng" 30 dòng
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

// Đọc một câu hỏi từ row + offset
function readQuestionRow(row, offset) {
  const question = row?.c?.[offset]?.v || "";
  const ansA = row?.c?.[offset + 1]?.v || "";
  const ansB = row?.c?.[offset + 2]?.v || "";
  const ansC = row?.c?.[offset + 3]?.v || "";
  const ansD = row?.c?.[offset + 4]?.v || "";

  // ✅ Tách nhiều đáp án đúng bằng dấu phẩy
  const correctRaw = row?.c?.[offset + 5]?.v || "";
  const correctArr = correctRaw
    .split(",")
    .map(x => normalize(x))
    .filter(Boolean);

  const note = row?.c?.[offset + 6]?.v || "";

  if (!question?.trim()) return null;

  return {
    question,
    answers: [
      { letter: "A", text: ansA },
      { letter: "B", text: ansB },
      { letter: "C", text: ansC },
      { letter: "D", text: ansD }
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

  // ✅ Nếu là dạng reading → gọi file reading.js xử lý riêng
  if (type === "reading") {
    if (typeof loadReadingExercise === "function") {
      loadReadingExercise();
    }
    return;
  }

  if (type === "listeningcap2") {
    if (typeof startListeningCap2 === "function") {
      startListeningCap2(); // hàm trong listening-cap2.js
    }
    return;
  }

  if (type === "writingcap2") {
    if (typeof startWritingCap2 === "function") {
      startWritingCap2(); // hàm trong writing-cap2.js
    }
    return;
  }


  const questionLimit = parseInt(document.getElementById("questionCount").value, 10);
  const offset = typeOffsets[type];
  if (offset === undefined) {
    console.error("❌ Không tìm thấy dạng bài:", type);
    return;
  }

  const rows = await fetchSheetData();
  const totalRows = rows.length;

  // Xây “khoảng” 30 dòng, bắt đầu từ dòng 2 (index 1)
  const rangeBlocks = buildRangesIndices(totalRows, 1, 30);
  const numRanges = rangeBlocks.length;

  // Phân bổ số câu cần lấy từ mỗi khoảng
  const perRangeCounts = allocateCounts(questionLimit, numRanges);

  // Gom câu hỏi theo từng khoảng
  const selected = [];
  for (let r = 0; r < numRanges; r++) {
    const [startIdx, endIdx] = rangeBlocks[r];
    const countNeeded = perRangeCounts[r];

    const pool = [];
    for (let i = startIdx; i <= endIdx; i++) {
      const q = readQuestionRow(rows[i], offset);
      if (q) pool.push(q);
    }

    if (pool.length === 0 || countNeeded <= 0) continue;

    const picked = shuffleArray(pool).slice(0, countNeeded);
    selected.push(...picked);
  }

  // Nếu chưa đủ → bổ sung từ toàn bộ pool
  if (selected.length < questionLimit) {
    const globalPool = [];
    for (let i = 1; i < totalRows; i++) {
      const q = readQuestionRow(rows[i], offset);
      if (q) globalPool.push(q);
    }
    const needed = questionLimit - selected.length;
    const extra = shuffleArray(globalPool).slice(0, needed);
    selected.push(...extra);
  }

  // Trộn lần nữa cho ngẫu nhiên toàn bộ
  const questions = shuffleArray(selected).slice(0, questionLimit);

  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  // Render từng câu hỏi
  questions.forEach((q, index) => {
    const block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML = `<strong>Câu ${index + 1}:</strong> ${q.question}`;

    const ul = document.createElement("ul");
    ul.className = "answers";

    // Shuffle thứ tự hiển thị đáp án
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
          input.disabled = true; // disable luôn ô nhập

          updateStats();

          if (totalQuestions === questions.length) {
            saveScoreToLocal(type);
          }

          // Hiện ghi chú nếu có
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

    // ✅ Thêm ô input để nhập đáp án thủ công
    const input = document.createElement("input");
    input.placeholder = "Nhập đáp án ...";
    input.onblur = () => {
      if (input.disabled) return; // nếu đã chọn bằng nút thì bỏ qua

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
      ul.querySelectorAll("button").forEach(b => b.disabled = true); // disable nút

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

