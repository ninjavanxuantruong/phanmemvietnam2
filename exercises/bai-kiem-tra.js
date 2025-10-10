// ===== Config nguồn dữ liệu =====
const sheetUrl = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?sheet=2&tqx=out:json";
const readingSheetUrl = "https://docs.google.com/spreadsheets/d/17JUJya5fIL3BfH4-Ysfm1MKbfFFtOmgYQ9C6aiCo5S0/gviz/tq?tqx=out:json";

// ===== Offset dạng bài (mỗi dạng chiếm 7 cột ngang) =====
// [question, A, B, C, D, correct, note]
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

// ===== Số lượng câu cho mỗi dạng + số bài đọc =====
const config = {
  pronunciation: 5,
  verb: 5,
  article: 3,
  preposition: 3,
  pronoun: 3,
  connector: 3,
  rewrite: 3,
  plural: 3,
  wordform: 3,
  vocabulary: 3,
  reading: 1
};

let totalScore = 0;
let totalQuestions = 0;
let correctCount = 0;
let wrongCount = 0;

// ===== Helpers chung =====
function normalize(text) {
  // Đồng bộ với baitaptungdang: cho phép chữ, số, khoảng trắng, dấu nháy đơn
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

async function fetchSheetData() {
  const res = await fetch(sheetUrl);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table.rows;
}

async function fetchReadingData() {
  const res = await fetch(readingSheetUrl);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table.rows;
}

// Chia sheet thành các "khoảng" 30 dòng (bắt đầu từ dòng 2 = index 1)
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

// Phân bổ số câu cần lấy theo số khoảng
function allocateCounts(totalNeeded, numRanges) {
  if (numRanges <= 0) return [];
  if (numRanges === 1) return [totalNeeded];
  if (numRanges === 2) return [Math.floor(totalNeeded / 2), Math.ceil(totalNeeded / 2)];
  if (numRanges === 3) {
    const first = Math.round(totalNeeded * 0.3);
    const second = Math.round(totalNeeded * 0.4);
    return [first, second, totalNeeded - first - second];
  }
  if (numRanges === 4) {
    const q = Math.floor(totalNeeded / 4);
    return [q, q, q, totalNeeded - 3 * q];
  }
  // >4 khoảng → chia đều + dồn phần dư
  const base = Math.floor(totalNeeded / numRanges);
  const counts = Array(numRanges).fill(base);
  let remainder = totalNeeded - base * numRanges;
  for (let i = 0; i < counts.length && remainder > 0; i++) {
    counts[i]++;
    remainder--;
  }
  return counts;
}

// Đọc 1 câu hỏi từ một dòng theo offset dạng
function readQuestionRow(row, offset) {
  const question = row?.c?.[offset]?.v || "";
  const ansA = row?.c?.[offset + 1]?.v || "";
  const ansB = row?.c?.[offset + 2]?.v || "";
  const ansC = row?.c?.[offset + 3]?.v || "";
  const ansD = row?.c?.[offset + 4]?.v || "";

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

// ===== Main: startTest (phần 1: reset, dạng thường) =====
async function startTest() {
  // Ghi thời điểm bắt đầu
  localStorage.setItem("startTime_grade8", Date.now());

  // Reset điểm
  totalScore = 0;
  totalQuestions = 0;
  correctCount = 0;
  wrongCount = 0;
  updateStats();

  // Chuẩn bị container
  const container = document.getElementById("quizContainer");
  container.innerHTML = "";
  const readingPassageContainer = document.getElementById("readingPassageContainer");
  const readingQuestionsContainer = document.getElementById("readingQuestionsContainer");
  readingPassageContainer.innerHTML = "";
  readingQuestionsContainer.innerHTML = "";

  // Lấy dữ liệu chính
  const rows = await fetchSheetData();
  const totalRows = rows.length;

  // ===== Render các dạng thường theo cơ chế mới =====
  for (const type in config) {
    if (type === "reading") continue;

    const offset = typeOffsets[type];
    if (offset === undefined) {
      console.error("❌ Không tìm thấy dạng bài:", type);
      continue;
    }

    const questionLimit = config[type];
    const rangeBlocks = buildRangesIndices(totalRows, 1, 30);
    const perRangeCounts = allocateCounts(questionLimit, rangeBlocks.length);

    // Chọn câu theo từng khoảng
    const selected = [];
    for (let r = 0; r < rangeBlocks.length; r++) {
      const [startIdx, endIdx] = rangeBlocks[r];
      const pool = [];
      for (let i = startIdx; i <= endIdx; i++) {
        const q = readQuestionRow(rows[i], offset);
        if (q) pool.push(q);
      }
      if (pool.length > 0 && perRangeCounts[r] > 0) {
        selected.push(...shuffleArray(pool).slice(0, perRangeCounts[r]));
      }
    }

    // Nếu thiếu, bổ sung từ toàn bộ pool
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

    // Render từng câu hỏi dạng thường
    questions.forEach((q) => {
      const block = document.createElement("div");
      block.className = "question-block";
      block.innerHTML = `<strong>Câu hỏi (${type}):</strong> ${q.question}`;

      const ul = document.createElement("ul");
      ul.className = "answers";

      // Nút A/B/C/D kèm nội dung
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

            // Disable hai cách trả lời
            ul.querySelectorAll("button").forEach(b => b.disabled = true);
            input.disabled = true;

            updateStats();
            localStorage.setItem("score_kiemtra_grade8", JSON.stringify({ correct: correctCount, total: totalQuestions }));

            // Ghi chú (nếu có)
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

      // Ô nhập tay (song song)
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
        localStorage.setItem("score_kiemtra_grade8", JSON.stringify({ correct: correctCount, total: totalQuestions }));

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
    // ===== Phần Reading: lấy từ nguồn riêng, render đồng bộ =====
    try {
      const readingRows = await fetchReadingData();

      // Gom theo số bài (cột 0), chọn 1 bài ngẫu nhiên
      const lessonNumbers = [...new Set(readingRows.map(r => r.c[0]?.v).filter(v => v !== undefined))];
      const selectedLesson = lessonNumbers[Math.floor(Math.random() * lessonNumbers.length)];
      const lessonRows = readingRows.filter(r => r.c[0]?.v === selectedLesson);

      // Đoạn văn: cột 1
      const passageRow = lessonRows.find(r => r.c[1]?.v?.trim());
      const passage = passageRow?.c[1]?.v || "";

      const passageBlock = document.createElement("div");
      passageBlock.className = "passage";
      passageBlock.innerHTML = `<strong>📘 Bài đọc:</strong><br>${passage}`;
      readingPassageContainer.appendChild(passageBlock);

      // Câu hỏi: cột 2; đáp án A–D: cột 3–6; đáp án đúng: cột 7 (có thể nhiều, ngăn bằng dấu phẩy)
      const questions = lessonRows
        .filter(r => r.c[2]?.v?.trim())
        .map(r => ({
          question: r.c[2]?.v || "",
          options: [
            { letter: "A", text: r.c[3]?.v || "" },
            { letter: "B", text: r.c[4]?.v || "" },
            { letter: "C", text: r.c[5]?.v || "" },
            { letter: "D", text: r.c[6]?.v || "" },
          ],
          correctArr: (r.c[7]?.v || "")
            .split(",")
            .map(x => normalize(x))
            .filter(Boolean)
        }));

      // Render câu hỏi đọc hiểu
      questions.forEach((q, index) => {
        const block = document.createElement("div");
        block.className = "question-block";
        block.innerHTML = `<strong>Câu đọc hiểu ${index + 1}:</strong> ${q.question}`;

        const ul = document.createElement("ul");
        ul.className = "answers";

        // Nút A/B/C/D
        const shuffledOptions = shuffleArray(q.options);
        shuffledOptions.forEach((opt, i) => {
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

              ul.querySelectorAll("button").forEach(b => b.disabled = true);
              input.disabled = true;

              updateStats();
              localStorage.setItem("score_kiemtra_grade8", JSON.stringify({ correct: correctCount, total: totalQuestions }));
            };

            li.appendChild(btn);
            ul.appendChild(li);
          }
        });

        block.appendChild(ul);

        // Ô nhập tay
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
          localStorage.setItem("score_kiemtra_grade8", JSON.stringify({ correct: correctCount, total: totalQuestions }));
        };

        block.appendChild(input);
        readingQuestionsContainer.appendChild(block);
      });
    } catch (e) {
      console.error("Lỗi tải dữ liệu Reading:", e);
    }
  }
