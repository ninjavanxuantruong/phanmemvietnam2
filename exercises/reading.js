const readingSheetUrl2 = "https://docs.google.com/spreadsheets/d/17JUJya5fIL3BfH4-Ysfm1MKbfFFtOmgYQ9C6aiCo5S0/gviz/tq?tqx=out:json";

async function fetchReadingData() {
  const res = await fetch(readingSheetUrl2);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table.rows;
}

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

function saveReadingScore() {
  const key = "score_reading_grade8";
  const saved = JSON.parse(localStorage.getItem(key) || "{}");

  const newData = {
    correct: (saved.correct || 0) + correctCount,
    total: (saved.total || 0) + totalQuestions
  };

  localStorage.setItem(key, JSON.stringify(newData));
}

async function loadReadingExercise() {
  // ✅ Ghi lại thời điểm bắt đầu làm bài đọc
  localStorage.setItem("startTime_grade8", Date.now());
  totalScore = 0;
  totalQuestions = 0;
  correctCount = 0;
  wrongCount = 0;
  updateStats();

  const rows = await fetchReadingData();

  const lessonNumbers = [...new Set(rows.map(r => r.c[0]?.v).filter(v => v !== undefined))];
  const selectedLesson = lessonNumbers[Math.floor(Math.random() * lessonNumbers.length)];
  const lessonRows = rows.filter(r => r.c[0]?.v === selectedLesson);
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

  // ✅ Tách vùng hiển thị
  const passageContainer = document.getElementById("readingPassageContainer");
  const questionsContainer = document.getElementById("readingQuestionsContainer");

  passageContainer.innerHTML = `<div class="passage"><strong>📘 Bài đọc:</strong><br>${passage}</div>`;
  questionsContainer.innerHTML = "";

  questions.forEach((q, index) => {
    const block = document.createElement("div");
    block.className = "question-block";
    block.innerHTML = `<strong>Câu ${index + 1}:</strong> ${q.question}`;

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

      if (totalQuestions === questions.length) {
        saveReadingScore();
      }
    };

    block.appendChild(input);
    questionsContainer.appendChild(block);
  });
}
