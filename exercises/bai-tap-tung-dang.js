const sheetUrl = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

const ranges = {
  pronunciation: [10, 50],
  verb: [51, 100],
  article: [101, 150],
  preposition: [151, 250],
  pronoun: [251, 300],
  connector: [301, 350],
  rewrite: [351, 400],
  plural: [401, 450],
  wordform: [451, 500],
  vocabulary: [501, 600],
};

let totalScore = 0;
let totalQuestions = 0;
let correctCount = 0;
let wrongCount = 0;

function normalize(text) {
  return text?.trim().toLowerCase();
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

async function loadExercise() {
  // Reset thống kê
  totalScore = 0;
  totalQuestions = 0;
  correctCount = 0;
  wrongCount = 0;
  updateStats();

  // Lấy loại bài và số lượng câu hỏi
  const type = document.getElementById("exerciseType").value;
  const questionLimit = parseInt(document.getElementById("questionCount").value, 10);
  const [start, end] = ranges[type];
  const rows = await fetchSheetData();

  // Lọc các dòng có câu hỏi hợp lệ
  const validRows = [];
  for (let i = start - 1; i < end; i++) {
    const row = rows[i];
    const questionCell = row?.c[35]; // AJ
    if (questionCell && questionCell.v?.trim()) {
      validRows.push(row);
    }
  }

  // Trộn và giới hạn số lượng câu hỏi
  const shuffledQuestions = shuffleArray(validRows).slice(0, questionLimit);
  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  // Hiển thị từng câu hỏi
  shuffledQuestions.forEach((row, index) => {
    const question = row.c[35]?.v || ""; // AJ
    const rawAnswers = [
      { letter: "A", text: row.c[36]?.v || "" }, // AK
      { letter: "B", text: row.c[37]?.v || "" }, // AL
      { letter: "C", text: row.c[38]?.v || "" }, // AM
      { letter: "D", text: row.c[39]?.v || "" }, // AN
    ];
    const correctLetter = normalize(row.c[40]?.v || ""); // AO
    const correctText = rawAnswers.find(a => normalize(a.letter) === correctLetter)?.text || "";

    const shuffledAnswers = shuffleArray(rawAnswers);

    const block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML = `<strong>Câu ${index + 1}:</strong> ${question}`;

    const ul = document.createElement("ul");
    ul.className = "answers";
    shuffledAnswers.forEach((opt, i) => {
      if (opt.text?.trim()) {
        const li = document.createElement("li");
        li.innerText = `${String.fromCharCode(65 + i)}. ${opt.text}`;
        ul.appendChild(li);
      }
    });

    block.appendChild(ul);

    const input = document.createElement("input");
    input.placeholder = "Nhập đáp án ...";
    input.onblur = () => {
      const userAnswer = normalize(input.value);
      const selectedText = shuffledAnswers.find((_, i) => String.fromCharCode(65 + i).toLowerCase() === userAnswer)?.text;

      totalQuestions++;
      if (normalize(selectedText) === normalize(correctText)) {
        input.classList.add("correct");
        totalScore++;
        correctCount++;
      } else {
        input.classList.add("wrong");
        wrongCount++;
      }

      input.disabled = true;
      updateStats();
    };

    block.appendChild(input);
    container.appendChild(block);
  });
}
