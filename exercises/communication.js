import { startTalking, stopTalking } from "./pikachuTalk.js";

document.addEventListener("DOMContentLoaded", function () {
  const selectionMode = localStorage.getItem("selectionMode"); // thêm
  const selectedUnit = localStorage.getItem("selectedLesson");
  const startUnit = localStorage.getItem("startLesson");
  const endUnit = localStorage.getItem("endLesson");
  const selectedTopic = localStorage.getItem("selectedTopic"); // thêm
  const topicUnits = JSON.parse(localStorage.getItem("topicUnits") || "[]"); // thêm


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

  // ✅ Cache ảnh theo câu hỏi để giảm độ trễ
  const imageCache = {}; // key: question (string), value: { url, keyword }

  // ✅ Hàm gọi ảnh từ Openverse theo keyword
  function fetchImageForKeyword(keyword) {
    const apiKey = "51268254-554135d72f1d226beca834413"; // 🔑 dán key của Anh vào đây
    // ✅ kết hợp illustration + safesearch + cartoon để ra ảnh dễ hiểu, sát nghĩa, an toàn
    const searchTerm = `${keyword} cartoon`; // thêm cartoon để gợi ý phong cách
    const apiUrl = `https://pixabay.com/api/?key=${apiKey}&q=${encodeURIComponent(searchTerm)}&image_type=illustration&safesearch=true&per_page=5`;

    console.log("👉 Fetching image for keyword:", keyword, apiUrl);

    return fetch(apiUrl)
      .then(res => res.json())
      .then(data => {
        console.log("👉 Pixabay response:", data);
        if (data.hits && data.hits.length > 0) {
          const chosen = data.hits[Math.floor(Math.random() * data.hits.length)];
          console.log("👉 Chosen image:", chosen.webformatURL, "for vocab:", keyword);
          return { url: chosen.webformatURL, keyword };
        }
        console.warn("⚠️ No image found for keyword:", keyword);
        return null;
      })
      .catch(err => {
        console.error("❌ Lỗi fetch ảnh Pixabay:", err);
        return null;
      });
  }




  // ✅ Chèn ảnh trực tiếp vào khung chat, kích thước responsive
  function addImage(url, keyword) {
    console.log("👉 Hiển thị ảnh:", url, "ứng với từ vựng:", keyword); // ✅ log rõ ràng
    if (!url) return;
    const wrapper = document.createElement("div");
    wrapper.className = "message bot";

    const img = document.createElement("img");
    img.src = url;
    img.className = "chat-image";
    img.style.maxWidth = "60%";
    img.style.width = "100%";
    img.style.height = "auto";
    img.style.borderRadius = "8px";
    img.style.margin = "6px 0";
    img.style.objectFit = "cover";

    wrapper.appendChild(img);
    chatContainer.appendChild(wrapper);
    chatContainer.scrollTop = chatContainer.scrollHeight;
  }




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

    // 👉 thêm hiệu ứng Pikachu
    utter.onstart = startTalking;
    utter.onend = stopTalking;

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

    // ✅ Hiển thị ảnh từ cache nếu có, nếu chưa có thì thử lấy theo vocabList
    const cached = imageCache[next.question];
    if (cached && cached.url) {
      addImage(cached.url, cached.keyword);

    } else if (next.vocabList && next.vocabList.length > 0) {
      const keyword = next.vocabList[Math.floor(Math.random() * next.vocabList.length)];
      fetchImageForKeyword(keyword).then(img => {
        if (img && img.url) {
          imageCache[next.question] = img;
          addImage(img.url, img.keyword);

        }
      });
    }
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

        let rawQuestions = [];

        rows.forEach(row => {
          if (row.c && row.c[1]?.v && row.c[9]?.v && row.c[10]?.v) {
            const fullUnit = row.c[1].v.trim();
            const unitCode = extractUnitCode(fullUnit);
            const question = row.c[9].v.trim();
            const answer = row.c[10].v.trim();
            const suggestion = row.c[11]?.v?.trim() || "";

            // ✅ Lấy từ vựng ở cột AV (index 47)
            const vocabRaw = row.c[47]?.v?.trim() || "";
            const vocabList = vocabRaw
              ? vocabRaw.split(",").map(s => s.trim()).filter(Boolean)
              : [];

            // 👉 Phân nhánh theo selectionMode
            if (selectionMode === "topic") {
              // lọc theo danh sách unit thuộc chủ đề
              if (topicUnits.includes(fullUnit)) {
                rawQuestions.push({ unit: fullUnit, question, answer, suggestion, vocabList });
              }
            } else {
              // lọc theo dải bài liên tục (auto)
              const startCode = extractUnitCode(startUnit);
              const endCode = extractUnitCode(endUnit);
              if (unitCode >= startCode && unitCode <= endCode) {
                rawQuestions.push({ unit: fullUnit, question, answer, suggestion, vocabList });
              }
            }

            // ✅ Map userQuestion → botAnswer để dùng cho chat
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

      // ✅ Prefetch ảnh và cache theo câu hỏi để giảm độ trễ hiển thị
      const prefetchPromises = questionPool.map(item => {
        if (item.vocabList && item.vocabList.length > 0) {
          const keyword = item.vocabList[Math.floor(Math.random() * item.vocabList.length)];
          return fetchImageForKeyword(keyword).then(img => {
            if (img && img.url) {
              imageCache[item.question] = img;
              item.imageUrl = img.url; // phòng trường hợp cần dùng trực tiếp
            }
          });
        }
        return Promise.resolve();
      });

      Promise.all(prefetchPromises).then(() => {
        addMessage("Bot", `Hello my friend`);
        askNextQuestion();
      });
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

  // ✅ Nút đọc lại nội dung bot nói
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


const popup = document.getElementById("pikachuPopup");
const toggleBtn = document.getElementById("togglePikachuBtn");

if (toggleBtn && popup) {
  toggleBtn.onclick = () => {
    if (popup.style.display === "none") {
      popup.style.display = "flex"; // hiện lại
    } else {
      popup.style.display = "none"; // ẩn đi
    }
  };
}

let isDragging = false;
let offsetX, offsetY;

// PC: kéo bằng chuột
popup.addEventListener("mousedown", (e) => {
  isDragging = true;
  offsetX = e.clientX - popup.offsetLeft;
  offsetY = e.clientY - popup.offsetTop;
});

document.addEventListener("mousemove", (e) => {
  if (isDragging) {
    popup.style.left = (e.clientX - offsetX) + "px";
    popup.style.top = (e.clientY - offsetY) + "px";
    popup.style.bottom = "auto";
    popup.style.right = "auto";
  }
});

document.addEventListener("mouseup", () => {
  isDragging = false;
});

// Mobile: kéo bằng tay
popup.addEventListener("touchstart", (e) => {
  isDragging = true;
  const touch = e.touches[0];
  offsetX = touch.clientX - popup.offsetLeft;
  offsetY = touch.clientY - popup.offsetTop;
});

document.addEventListener("touchmove", (e) => {
  if (isDragging) {
    const touch = e.touches[0];
    popup.style.left = (touch.clientX - offsetX) + "px";
    popup.style.top = (touch.clientY - offsetY) + "px";
    popup.style.bottom = "auto";
    popup.style.right = "auto";
  }
});

document.addEventListener("touchend", () => {
  isDragging = false;
});
