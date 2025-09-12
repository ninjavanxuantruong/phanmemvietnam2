document.addEventListener("DOMContentLoaded", function () {
  const selectedUnit = localStorage.getItem("selectedLesson");
  const startUnit = localStorage.getItem("startLesson");
  const endUnit = localStorage.getItem("endLesson");

  const sheetUrl = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
  const chatContainer = document.getElementById("chatContainer");

  let questionPool = [];
  let askedQuestions = [];
  let currentQuestion = null;
  let questionAnswerMap = {};
  let vocabVoice = null;
  let totalPoints = 0;
  let waitingAfterCorrection = false;
  let currentBotResponse = [];

  

  function getVocabVoice() {
    return new Promise(resolve => {
      let voices = speechSynthesis.getVoices();
      if (voices.length) return resolve(voices);

      // Trên điện thoại, đôi khi cần chờ thêm để giọng nói sẵn sàng
      let attempts = 0;
      const maxAttempts = 20;
      const interval = setInterval(() => {
        voices = speechSynthesis.getVoices();
        if (voices.length || attempts >= maxAttempts) {
          clearInterval(interval);
          resolve(voices);
        }
        attempts++;
      }, 100);
    });
  }


  getVocabVoice().then(voices => {
    const preferredVoiceName = localStorage.getItem("selectedVoice");
    vocabVoice = voices.find(v => v.name === preferredVoiceName)
               || voices.find(v => v.lang === "en-US")
               || voices[0]; // fallback nếu không có gì khớp
  });


  function speak(text) {
    if (!vocabVoice) return;
    const utter = new SpeechSynthesisUtterance(text);
    utter.lang = "en-US";
    utter.voice = vocabVoice;
    speechSynthesis.speak(utter);
  }

  function addMessage(sender, text) {
    const msg = document.createElement("div");
    msg.className = "message " + (sender === "Bot" ? "bot" : "user");
    msg.textContent = `${sender}: ${text}`;
    chatContainer.appendChild(msg);
    chatContainer.scrollTop = chatContainer.scrollHeight;
    if (sender === "Bot") speak(text);
  }

  function askNextQuestion() {
    const remaining = questionPool.filter(q => !askedQuestions.includes(q.question));
    if (remaining.length === 0) {
      addMessage("Bot", `Congratulations. You have ${totalPoints} points!`);
      localStorage.setItem("result_communication", JSON.stringify({
        score: totalPoints,
        total: totalPoints
      }));
      setTimeout(() => {
        if (typeof showVictoryEffect === "function") {
          showVictoryEffect(chatContainer);
        }
      }, 600);
      return;
    }
    const next = remaining[Math.floor(Math.random() * remaining.length)];
    askedQuestions.push(next.question);
    currentQuestion = next;
    addMessage("Bot", next.question);
    currentBotResponse = [next.question]; // ✅ thêm dòng này

  }

  function extractUnitCode(text) {
    return text.split(" ")[0].trim();
  }

  function normalize(text) {
    return text.trim().replace(/\?$/, "").toLowerCase();
  }

  function cleanWord(word) {
    return word.replace(/[.,!?]/g, "").toLowerCase();
  }

  fetch(sheetUrl)
    .then(response => response.text())
    .then(text => {
      const jsonString = text.substring(47).slice(0, -2);
      const data = JSON.parse(jsonString);
      const rows = data.table.rows;

      const startCode = extractUnitCode(startUnit);
      const endCode = extractUnitCode(endUnit);

      let rawQuestions = [];
      const unitsSeen = new Set();

      rows.forEach(row => {
        if (row.c && row.c[1]?.v && row.c[9]?.v && row.c[10]?.v) {
          const fullUnit = row.c[1].v.trim();
          const unitCode = extractUnitCode(fullUnit);
          const question = row.c[9].v.trim();
          const answer = row.c[10].v.trim();
          const suggestion = row.c[11]?.v?.trim() || "";

          if (unitCode >= startCode && unitCode <= endCode) {
  rawQuestions.push({ unit: fullUnit, question, answer, suggestion });
}


          const userQuestion = row.c[8]?.v?.trim();
          const botAnswer = row.c[11]?.v?.trim();
          if (userQuestion && botAnswer) {
            const key = normalize(userQuestion);
            if (!questionAnswerMap[key]) {
              questionAnswerMap[key] = [];
            }
            questionAnswerMap[key].push(botAnswer);
          }
        }
      });

      // Gom câu hỏi theo từng unit
      const unitMap = new Map();
      rawQuestions.forEach(item => {
        const unit = item.unit;
        if (!unitMap.has(unit)) {
          unitMap.set(unit, []);
        }
        unitMap.get(unit).push(item);
      });

      // Chọn 1 câu random từ mỗi unit
      questionPool = [];
      for (const [unit, questions] of unitMap.entries()) {
        const randomIndex = Math.floor(Math.random() * questions.length);
        questionPool.push(questions[randomIndex]);
      }

      addMessage("Bot", `Hello my friend`);
      askNextQuestion();
    });

  const positiveFeedback = [
    "Great job!", "Well done!", "That's correct!", "Nice work!",
    "Exactly!", "Perfect!", "You got it!", "That's right!",
    "Awesome!", "Spot on!"
  ];

  function handleUserInput(input) {
    const studentName = localStorage.getItem("trainerName") || "You";
    addMessage(studentName, input);
    const normalizedInput = normalize(input);

    if (waitingAfterCorrection) {
      waitingAfterCorrection = false;

      const normalizedInput = normalize(input);
      const inputWords = normalizedInput.split(" ").map(cleanWord);

      // Dùng lại logic xác định câu hỏi
      const matchedQuestions = [];

      questionPool.forEach(item => {
        const normJ = normalize(item.question);
        const questionWords = normJ.split(" ").map(cleanWord);
        const allWordsPresent = questionWords.every(word => inputWords.includes(word));
        if (allWordsPresent) {
          matchedQuestions.push(item.suggestion);
        }
      });

      if (matchedQuestions.length > 0) {
        const reply = matchedQuestions[Math.floor(Math.random() * matchedQuestions.length)];
        addMessage("Bot", reply);
        currentBotResponse = [reply]; // ✅ thêm dòng này

      }

      // Dù là câu hỏi hay câu trả lời → đều hỏi tiếp câu mới
      askNextQuestion();
      return;
    }



    const matchedQuestions = [];

    questionPool.forEach(item => {
      const normJ = normalize(item.question);
      const questionWords = normJ.split(" ").map(cleanWord);
      const inputWords = normalizedInput.split(" ").map(cleanWord);
      const allWordsPresent = questionWords.every(word => inputWords.includes(word));
      if (allWordsPresent) {
        matchedQuestions.push(item.suggestion);
      }
    });

    if (matchedQuestions.length > 0) {
      const reply = matchedQuestions[Math.floor(Math.random() * matchedQuestions.length)];
      addMessage("Bot", reply);
      askNextQuestion();
      return;
    }

    if (currentQuestion && currentQuestion.answer) {
      const correctAnswers = currentQuestion.answer
        .split('"')
        .filter((text, i) => i % 2 === 1)
        .map(text => normalize(text));

      const isCorrect = correctAnswers.some(keyword =>
        normalizedInput.includes(keyword)
      );

      if (isCorrect) {
        const feedback = positiveFeedback[Math.floor(Math.random() * positiveFeedback.length)];
        addMessage("Bot", feedback);
        askNextQuestion();
      } else {
        const fallbackSuggestions = questionPool
          .filter(item => normalize(item.question) === normalize(currentQuestion.question))
          .map(item => item.suggestion);

        const suggestion = fallbackSuggestions.length > 0
          ? fallbackSuggestions[Math.floor(Math.random() * fallbackSuggestions.length)]
          : currentQuestion.suggestion;

        addMessage("Bot", `You can say: ${suggestion}`);
        currentBotResponse = [`You can say: ${suggestion}`]; // ✅ thêm dòng này

        waitingAfterCorrection = true;
      }
    } else {
      askNextQuestion();
    }
  }


  
  const recordBtn = document.getElementById("recordBtn");
  const speechResult = document.getElementById("speechResult");

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (SpeechRecognition && recordBtn) {
    const recognition = new SpeechRecognition();
    recognition.lang = "en-US";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recordBtn.onclick = () => {
      speechResult.textContent = "🎙️ Listening...";
      recognition.start();
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript.toLowerCase().trim();
      speechResult.textContent = "";
      totalPoints += 3;
      handleUserInput(transcript);
    };

    recognition.onerror = (event) => {
      speechResult.innerText = `❌ Error: ${event.error}`;
    };
  }

  // ✅ Đặt ngay dưới đoạn này:
  const repeatBtn = document.getElementById("repeatBtn");
  if (repeatBtn) {
    repeatBtn.onclick = () => {
      if (currentBotResponse.length > 0) {
        const fullText = currentBotResponse.join(" ");
        speak(fullText);
      } else {
        alert("Chưa có nội dung để đọc lại.");
      }
    };
  }
});
