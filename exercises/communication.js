document.addEventListener("DOMContentLoaded", function () {
  const selectedUnit = localStorage.getItem("selectedLesson"); // ví dụ "3-06-2 My house"
  const sheetUrl = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

  const chatContainer = document.getElementById("chatContainer");
  

  let questionPool = [];
  let askedQuestions = [];
  let currentQuestion = null;
  let questionAnswerMap = {}; // lưu các câu hỏi từ cột J và các câu trả lời từ cột L
  let vocabVoice = null;
  let totalPoints = 0;


  function getVocabVoice() {
    return new Promise(resolve => {
      const voices = speechSynthesis.getVoices();
      if (voices.length) return resolve(voices);
      speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
    });
  }

  getVocabVoice().then(voices => {
    vocabVoice = voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("zira"))
               || voices.find(v => v.lang === "en-US");
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

    if (sender === "Bot") {
      speak(text);
    }
  }

  function askNextQuestion() {
    const remaining = questionPool.filter(q => !askedQuestions.includes(q.question));
    if (remaining.length === 0) {
      addMessage("Bot", `Congratulations. You have ${totalPoints} points!`);

      // ✅ Lưu kết quả vào localStorage
      localStorage.setItem("result_communication", JSON.stringify({
        score: totalPoints,
        total: totalPoints
      }));


      // ✅ Hiệu ứng bắt Pokémon
      setTimeout(() => {
        if (typeof showCatchEffect === "function") {
          showCatchEffect(chatContainer);
        }
      }, 600);

      return;
    }



    const next = remaining[Math.floor(Math.random() * remaining.length)];
    askedQuestions.push(next.question);
    currentQuestion = next;
    addMessage("Bot", next.question);
  }


  function extractUnitCode(text) {
    return text.split(" ")[0].trim(); // "3-06-2 My house" → "3-06-2"
  }

  function normalize(text) {
    return text.trim().replace(/\?$/, "").toLowerCase();
  }

  fetch(sheetUrl)
    .then(response => response.text())
    .then(text => {
      const jsonString = text.substring(47).slice(0, -2);
      const data = JSON.parse(jsonString);
      const rows = data.table.rows;

      const selectedCode = extractUnitCode(selectedUnit);
      const startCode = "3-01";

      let rawQuestions = [];
      const unitsSeen = new Set();

      rows.forEach(row => {
        if (
          row.c &&
          row.c[1]?.v &&
          row.c[9]?.v &&
          row.c[10]?.v
        ) {
          const fullUnit = row.c[1].v.trim();
          const unitCode = extractUnitCode(fullUnit);
          const question = row.c[9].v.trim();
          const answer = row.c[10].v.trim();
          const suggestion = row.c[11]?.v?.trim() || "";

          // ✅ Chỉ lấy 1 câu hỏi duy nhất cho mỗi unit
          if (unitCode >= startCode && unitCode <= selectedCode) {
            if (!unitsSeen.has(unitCode)) {
              rawQuestions.push({ unit: fullUnit, question, answer, suggestion });
              unitsSeen.add(unitCode);
            }
          }

          // ✅ Gom các câu hỏi & câu trả lời để nhận diện linh hoạt
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


      questionPool = rawQuestions;

      addMessage("Bot", `welcome to the lesson "${selectedUnit}" `);
      askNextQuestion();
    });

  const positiveFeedback = [
    "Great job!",
    "Well done!",
    "That's correct!",
    "Nice work!",
    "Exactly!",
    "Perfect!",
    "You got it!",
    "That's right!",
    "Awesome!",
    "Spot on!"
  ];

  function removeDiacritics(str) {
    return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  }

  function normalize(text) {
    return text.trim().replace(/\?$/, "").toLowerCase();
  }

  function cleanWord(word) {
    return word.replace(/[.,!?]/g, "").toLowerCase();
  }

  function handleUserInput(input) {
    const studentName = localStorage.getItem("trainerName") || "You";
    addMessage(studentName, input);

    const normalizedInput = normalize(input);

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
      } else {
        const fallbackSuggestions = [];

        questionPool.forEach(item => {
          const normJ = normalize(item.question);
          const normK = normalize(item.answer);

          if (normJ === normalize(currentQuestion.question)) {
            fallbackSuggestions.push(item.suggestion);
          }
        });

        if (fallbackSuggestions.length > 0) {
          const randomSuggestion = fallbackSuggestions[Math.floor(Math.random() * fallbackSuggestions.length)];
          addMessage("Bot", `You can say: ${randomSuggestion}`);
        } else {
          addMessage("Bot", `You can say: ${currentQuestion.suggestion}`);
        }
      }
    }

    askNextQuestion();
  }

  

  // ✅ Bổ sung phần ghi âm bằng PokéBall
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
      totalPoints += 3; // ✅ cộng điểm mỗi lần nói
      handleUserInput(transcript);
    };


    recognition.onerror = (event) => {
      speechResult.innerText = `❌ Error: ${event.error}`;
    };
  }
});
