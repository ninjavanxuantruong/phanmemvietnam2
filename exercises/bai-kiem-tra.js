const sheetUrl = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
const readingSheetUrl = "https://docs.google.com/spreadsheets/d/17JUJya5fIL3BfH4-Ysfm1MKbfFFtOmgYQ9C6aiCo5S0/gviz/tq?tqx=out:json";

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

function normalize(text) {
  return text?.trim().toLowerCase().replace(/[:.,]/g, "");
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

async function startTest() {
  localStorage.setItem("startTime_grade8", Date.now());

  totalScore = 0;
  totalQuestions = 0;
  correctCount = 0;
  wrongCount = 0;
  updateStats();

  const container = document.getElementById("quizContainer");
  container.innerHTML = "";

  const readingPassageContainer = document.getElementById("readingPassageContainer");
  const readingQuestionsContainer = document.getElementById("readingQuestionsContainer");
  readingPassageContainer.innerHTML = "";
  readingQuestionsContainer.innerHTML = "";

  const rows = await fetchSheetData();

  for (const type in config) {
    if (type === "reading") continue;

    const [start, end] = ranges[type];
    const validRows = [];

    for (let i = start - 1; i < end; i++) {
      const row = rows[i];
      const questionCell = row?.c[35];
      if (questionCell && questionCell.v?.trim()) {
        validRows.push(row);
      }
    }

    const selected = shuffleArray(validRows).slice(0, config[type]);

    selected.forEach((row) => {
      const question = row.c[35]?.v || "";
      const rawAnswers = [
        { letter: "A", text: row.c[36]?.v || "" },
        { letter: "B", text: row.c[37]?.v || "" },
        { letter: "C", text: row.c[38]?.v || "" },
        { letter: "D", text: row.c[39]?.v || "" },
      ];
      const correctText = normalize(row.c[40]?.v || "");
      const shuffledAnswers = shuffleArray(rawAnswers);

      const block = document.createElement("div");
      block.className = "question-block";
      block.innerHTML = `<strong>Câu hỏi (${type}):</strong> ${question}`;

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
        totalQuestions++;
        if (userAnswer === correctText) {
          input.classList.add("correct");
          totalScore++;
          correctCount++;
        } else {
          input.classList.add("wrong");
          wrongCount++;
        }
        input.disabled = true;
        updateStats();

        const kiemtraData = {
          correct: correctCount,
          total: totalQuestions
        };
        localStorage.setItem("score_kiemtra_grade8", JSON.stringify(kiemtraData));
      };

      block.appendChild(input);
      container.appendChild(block);
    });
  }

  // ✅ Phần Reading: tách riêng đoạn văn và câu hỏi
  const readingRows = await fetchReadingData();
  const lessonNumbers = [...new Set(readingRows.map(r => r.c[0]?.v).filter(v => v !== undefined))];
  const selectedLesson = lessonNumbers[Math.floor(Math.random() * lessonNumbers.length)];
  const lessonRows = readingRows.filter(r => r.c[0]?.v === selectedLesson);
  const passageRow = lessonRows.find(r => r.c[1]?.v?.trim());
  const passage = passageRow?.c[1]?.v || "";

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
      correct: normalize(r.c[7]?.v || "")
    }));

  const passageBlock = document.createElement("div");
  passageBlock.className = "passage";
  passageBlock.innerHTML = `<strong>📘 Bài đọc:</strong><br>${passage}`;
  readingPassageContainer.appendChild(passageBlock);

  questions.forEach((q, index) => {
    const block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML = `<strong>Câu đọc hiểu ${index + 1}:</strong> ${q.question}`;

    const ul = document.createElement("ul");
    ul.className = "answers";
    const shuffledOptions = shuffleArray(q.options);
    shuffledOptions.forEach((opt, i) => {
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
      totalQuestions++;
      if (userAnswer === q.correct) {
        input.classList.add("correct");
        totalScore++;
        correctCount++;
      } else {
        input.classList.add("wrong");
        wrongCount++;
      }
      input.disabled = true;
      updateStats();

      const kiemtraData = {
        correct: correctCount,
        total: totalQuestions
      };
      localStorage.setItem("score_kiemtra_grade8", JSON.stringify(kiemtraData));
    };

    block.appendChild(input);
    readingQuestionsContainer.appendChild(block);
  });
}
