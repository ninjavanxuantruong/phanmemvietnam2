import { getRandomResponse, speakResponse } from './library.js';
import { showCatchEffect } from './pokeball-effect.js';
function triggerVictoryEffect() {
  console.log("✅ Người chơi đã hoàn tất Overview!");
  showCatchEffect();

  localStorage.setItem("result_overview", JSON.stringify({
    score: correctCount,
    total: answeredQuestions.size
  }));
}



console.log("Overview module loaded");

// ── CÁC BIẾN TOÀN CỤC ──
let score = 0,
    correctCount = 0,
    wrongCount = 0;
let rawWords = JSON.parse(localStorage.getItem("wordBank")) || [];
let uniqueWords = [...new Set(rawWords)];

// Các biến điều hướng bài tập
let studyMode = "word"; // "word": học theo từng từ; "exercise": học theo dạng bài
let exercises = [];     // Dữ liệu bài tập theo từng từ (mode "word")
let groupedExercises = []; // Dữ liệu bài tập theo dạng (mode "exercise")
let currentExerciseIndex = 0;
let exerciseTaskIndex = 0; // Dành cho mode "word"
let answeredQuestions = new Set();

// ── HÀM XỬ LÝ SO SÁNH ĐÁP ÁN ──
function normalize(str) {
  return str.toLowerCase()
            .replace(/[.?]/g, "")
            .replace(/[\u2019]/g, "'")
            .trim();
}

function checkAlternative(userInput, alt) {
  const normUser = normalize(userInput);
  if (alt.startsWith('"') && alt.endsWith('"')) {
    const parts = [];
    const regex = /"([^"]+)"/g;
    let match;
    while (match = regex.exec(alt)) {
      parts.push(normalize(match[1]));
    }
    // Yêu cầu câu trả lời phải chứa tất cả các phần được trích xuất
    return parts.length > 0 && parts.every(part => normUser.includes(part));
  } else {
    return normUser === normalize(alt);
  }
}

function isAnswerCorrect(userInput, answerText) {
  const normUser = normalize(userInput);
  if (answerText.includes(",")) {
    const alternatives = answerText.split(",").map(alt => alt.trim());
    return alternatives.some(alt => checkAlternative(userInput, alt));
  } else {
    const quotedMatches = answerText.match(/"([^"]+)"/g);
    if (quotedMatches) {
      const mandatoryParts = quotedMatches.map(s => normalize(s.replace(/"/g, "")));
      return mandatoryParts.every(part => normUser.includes(part));
    }
    return normUser === normalize(answerText);
  }
}

// ── XỬ LÝ CHỌN PHƯƠNG ÁN HỌC ──
const modeSelectionElem = document.getElementById("modeSelection");
const mainContainer = document.getElementById("mainContainer");
document.getElementById("modeWord").addEventListener("click", () => {
  studyMode = "word";
  initStudy();
});
document.getElementById("modeExercise").addEventListener("click", () => {
  studyMode = "exercise";
  initStudy();
});

// Hàm khởi tạo sau khi người dùng chọn phương án học
function initStudy(){
  modeSelectionElem.style.display = "none";
  mainContainer.style.display = "block";
  currentExerciseIndex = 0;
  exerciseTaskIndex = 0;
  score = correctCount = wrongCount = 0;
  answeredQuestions.clear();
  fetchExercises();
  showWordList();
  updateStats();
  // Cập nhật background lần đầu (background sẽ không tự đổi nếu chưa ấn gì tiếp theo)
  window.dispatchEvent(new Event("updateBackgroundRequested"));
}

// ── HÀM FETCH DỮ LIỆU TỪ GOOGLE SHEETS ──
async function fetchExercises() {
  const url = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonData = JSON.parse(text.substring(47).slice(0, -2));
    const rows = jsonData.table.rows;

    // Xây dựng mảng bài tập theo từng từ cho mode "word"
    exercises = [];
    rows.forEach((row, index) => {
      const word = row.c[2]?.v || "";
      if (rawWords.includes(word)) {
        exercises.push({
          word,
          rowIndex: index,
          tasks: [
            { type: "Chọn đáp án đúng",      question: row.c[3]?.v, answer: row.c[4]?.v },
            { type: "Sắp xếp từ thành câu",    question: row.c[5]?.v, answer: row.c[6]?.v },
            { type: "Tìm từ khác loại",         question: row.c[7]?.v, answer: row.c[8]?.v },
            { type: "Trả lời câu hỏi",          question: row.c[9]?.v, answer: row.c[10]?.v },
            { type: "Viết câu hỏi",             question: row.c[11]?.v, answer: row.c[12]?.v },
            { type: "Điền vào chỗ trống",       question: row.c[13]?.v, answer: row.c[14]?.v },
            { type: "Viết chính tả",            question: row.c[15]?.v, answer: row.c[16]?.v },
            { type: "Dịch Anh - Việt",          question: row.c[17]?.v, answer: row.c[18]?.v }
          ]
        });
      }
    });
    // Loại bỏ những bài tập không có bất kỳ câu hỏi nào
    exercises = exercises.filter(ex => 
      ex.tasks.some(t => t.question && t.question.trim() !== "")
    );


    // Nếu mode "exercise", nhóm bài tập theo dạng
    if (studyMode === "exercise") {
      groupedExercises = [];
      for (let taskIndex = 0; taskIndex < 8; taskIndex++) {
        exercises.forEach(ex => {
          let task = ex.tasks[taskIndex];
          if (task.question && task.question.trim() !== "") {
            groupedExercises.push({
              word: ex.word,
              type: task.type,
              question: task.question,
              answer: task.answer
            });
          }
        });
      }

    }

    loadExercise();
  } catch (error) {
    console.error("❌ Lỗi khi lấy dữ liệu: ", error);
  }
}

// ── HIỂN THỊ DANH SÁCH TỪ VỰNG ──
function showWordList() {
  const wordListElem = document.getElementById("wordList");
  if (wordListElem) {
    wordListElem.textContent = uniqueWords.join(", ");
  }
}

// ── HÀM CẬP NHẬT THỐNG KÊ ──
function updateStats() {
  const statsContainer = document.getElementById("statsContainer");
  if (statsContainer) {
    const totalDone = answeredQuestions.size;
    statsContainer.innerHTML = `<p>✅ ${correctCount} | ❌ ${wrongCount} | 📊 Tổng câu đã làm: ${totalDone}</p>`;
  }
}

function checkVictoryCondition() {
  const totalQuestions = studyMode === "word"
    ? exercises.reduce((acc, ex) => acc + ex.tasks.filter(t => t.question?.trim()).length, 0)
    : groupedExercises.length;

  const scorePercent = (correctCount / totalQuestions) * 100;
  const container = document.getElementById("exerciseContainer");
  const currentWordElem = document.getElementById("currentWord");
  currentWordElem.textContent = "";

  if (answeredQuestions.size >= totalQuestions) {
    if (scorePercent >= 50) {
      container.innerHTML = `<h3>🏆 Chúc mừng! Bạn đã bắt được Pokemon!</h3>
                             <p>✅ ${correctCount} | ❌ ${wrongCount} | 📊 Tổng câu đã làm: ${answeredQuestions.size}</p>`;
      triggerVictoryEffect();
    } else {
      container.innerHTML = `<h3>😢 Bạn chưa bắt được Pokemon. Cố gắng lần sau nhé!</h3>
                             <p>✅ ${correctCount} | ❌ ${wrongCount} | 📊 Tổng câu đã làm: ${answeredQuestions.size}</p>`;
    }
  }
}


// ── HÀM LOAD BÀI TẬP HIỆN TẠI ──
// Lưu ý: Không phát sự kiện cập nhật background tại đây, để background chỉ đổi khi chuyển câu.
function loadExercise() {
  const container = document.getElementById("exerciseContainer");
  const currentWordElem = document.getElementById("currentWord");

  const totalQuestions = studyMode === "word"
    ? exercises.reduce((acc, ex) => acc + ex.tasks.length, 0)
    : groupedExercises.length;

  


  if (studyMode === "word") {
    if (currentExerciseIndex >= exercises.length) {
      currentExerciseIndex = 0;
      exerciseTaskIndex = 0;
    }

    const ex = exercises[currentExerciseIndex];
    const key = `${currentExerciseIndex}-${exerciseTaskIndex}`;

    if (answeredQuestions.has(key)) {
      exerciseTaskIndex++;
      if (exerciseTaskIndex >= ex.tasks.length) {
        currentExerciseIndex++;
        exerciseTaskIndex = 0;
      }
      loadExercise();
      return;
    }

    currentWordElem.textContent = ex.word;
    const task = ex.tasks[exerciseTaskIndex];

    if (task.question && task.question.trim() !== "") {
      container.innerHTML = `
        <h3>${task.type}</h3>
        <div class="question-box">${task.question}</div>
        <input type="text" id="userAnswer" placeholder="Nhập câu trả lời" style="font-size: 20px; width: 60%;">
      `;
    } else {
      exerciseTaskIndex++;
      loadExercise();
    }
  }

  else if (studyMode === "exercise") {
    if (currentExerciseIndex >= groupedExercises.length) {
      currentExerciseIndex = 0;
    }

    const key = `${currentExerciseIndex}`;
    const task = groupedExercises[currentExerciseIndex];

    if (answeredQuestions.has(key)) {
      currentExerciseIndex++;
      loadExercise();
      return;
    }

    currentWordElem.textContent = task.word;

    if (task.question && task.question.trim() !== "") {
      container.innerHTML = `
        <h3>${task.type}</h3>
        <div class="question-box">${task.question}</div>
        <input type="text" id="userAnswer" placeholder="Nhập câu trả lời" style="font-size: 20px; width: 60%;">
      `;
    } else {
      currentExerciseIndex++;
      loadExercise();
    }
  }
}


// ── HÀM KIỂM TRA ĐÁP ÁN ──
function showAnswer() {
  const container = document.getElementById("exerciseContainer");
  const userAnswerElem = document.getElementById("userAnswer");
  const userInput = (userAnswerElem?.value || "").trim();
  let correctAnswer = "";
  let resultHTML = "";
  let key = "";
  let isCorrect = false;

  if (studyMode === "word") {
    if (currentExerciseIndex >= exercises.length) return;

    const ex = exercises[currentExerciseIndex];
    const task = ex.tasks[exerciseTaskIndex];
    correctAnswer = task.answer?.trim() || "";
    key = `${currentExerciseIndex}-${exerciseTaskIndex}`;

    if (!answeredQuestions.has(key)) {
      answeredQuestions.add(key);
      if (isAnswerCorrect(userInput, correctAnswer)) {
        score++;
        correctCount++;
        isCorrect = true;
        resultHTML = `<p style="color: green;">✅ Đúng! +1 điểm (Tổng điểm: ${score})</p>`;
      } else {
        wrongCount++;
        resultHTML = `<p style="color: red;">❌ Sai! Đáp án đúng: ${correctAnswer}</p>`;
      }
    } else {
      resultHTML = `<p>📌 Bạn đã làm câu này rồi, kết quả không thay đổi.</p>`;
    }

  } else if (studyMode === "exercise") {
    if (currentExerciseIndex >= groupedExercises.length) return;

    const task = groupedExercises[currentExerciseIndex];
    correctAnswer = task.answer?.trim() || "";
    key = `${currentExerciseIndex}`;

    if (!answeredQuestions.has(key)) {
      answeredQuestions.add(key);
      if (isAnswerCorrect(userInput, correctAnswer)) {
        score++;
        correctCount++;
        isCorrect = true;
        resultHTML = `<p style="color: green;">✅ Đúng! +1 điểm (Tổng điểm: ${score})</p>`;
      } else {
        wrongCount++;
        resultHTML = `<p style="color: red;">❌ Sai! Đáp án đúng: ${correctAnswer}</p>`;
      }
    } else {
      resultHTML = `<p>📌 Bạn đã làm câu này rồi, kết quả không thay đổi.</p>`;
    }
  }

  speakResponse(isCorrect);
  container.innerHTML += resultHTML;
  updateStats();
  checkVictoryCondition(); // 👈 Gọi để hiển thị thông báo thắng/thua sau mỗi lượt
}


// ── HÀM CHUYỂN BÀI TẬP ──
function nextExercise() {
  if (studyMode === "word") {
    const ex = exercises[currentExerciseIndex];
    if (exerciseTaskIndex < ex.tasks.length - 1) {
      exerciseTaskIndex++;
    } else {
      currentExerciseIndex++;
      exerciseTaskIndex = 0;
    }
  } else if (studyMode === "exercise") {
    currentExerciseIndex++;
  }
  loadExercise();
  // Chỉ cập nhật background khi ấn Next
  window.dispatchEvent(new Event("updateBackgroundRequested"));
}

function previousExercise() {
  if (studyMode === "word") {
    if (exerciseTaskIndex > 0) {
      exerciseTaskIndex--;
    } else if (currentExerciseIndex > 0) {
      currentExerciseIndex--;
      exerciseTaskIndex = exercises[currentExerciseIndex].tasks.length - 1;
    }
  } else if (studyMode === "exercise") {
    if (currentExerciseIndex > 0) {
      currentExerciseIndex--;
    }
  }
  loadExercise();
  // Cập nhật background khi ấn Prev
  window.dispatchEvent(new Event("updateBackgroundRequested"));
}

// ── GÁN SỰ KIỆN CHO CÁC NÚT ──
document.getElementById("btnShowAnswer")?.addEventListener("click", showAnswer);
document.getElementById("btnNext")?.addEventListener("click", nextExercise);
document.getElementById("btnPrev")?.addEventListener("click", previousExercise);

export {};

