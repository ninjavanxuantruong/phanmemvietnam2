// ===== Config =====
const SHEET_URL_L2 = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json"; // dùng sheet tương tự, đổi nếu cần

// ===== State =====
let L2_1_sentences = [];     // [{ text, target, lessonName, unitNum }]
let L2_1_targets = [];       // danh sách target
let L2_1_blankIndices = [];  // index các câu bị che (5 trong 8)
let L2_1_voiceMale = null;
let L2_1_voiceFemale = null;
let L2_1_score = 0;
let L2_1_total = 0;
let L2_1_ready = false;

// ===== Helpers =====
function normalizeUnitId(unitStr) {
  if (!unitStr) return 0;
  const parts = unitStr.split("-");
  if (parts.length < 3) return 0;
  const [cls, lesson, part] = parts;
  return parseInt(cls, 10) * 1000 + parseInt(lesson, 10) * 10 + parseInt(part, 10);
}
function splitTargets(rawTarget) {
  return (rawTarget || "")
    .toLowerCase()
    .split(/[/;,]/)
    .map(t => t.trim())
    .filter(Boolean);
}
function pickRandomIndices(n, k) {
  const arr = Array.from({ length: n }, (_, i) => i);
  arr.sort(() => Math.random() - 0.5);
  return arr.slice(0, Math.min(k, n));
}
function escapeRegExp(s) {
  return String(s).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function getVoices() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}
function speak(text, voice) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  if (voice) u.voice = voice;
  speechSynthesis.speak(u);
}
function updateScoreBoardL2_1() {
  const el = document.getElementById("scoreBoard_L2_1");
  if (el) el.textContent = `🎯 Dạng 1: ${L2_1_score}/${L2_1_total}`;
}
async function fetchGVizRows(url) {
  const res = await fetch(url);
  const txt = await res.text();
  const json = JSON.parse(txt.substring(47).slice(0, -2));
  return json.table?.rows || [];
}
async function getMaxLessonCode() {
  const SHEET_BAI_HOC = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
  const trainerClass = localStorage.getItem("trainerClass")?.trim() || "";

  const res = await fetch(SHEET_BAI_HOC);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const baiList = rows
    .map(r => {
      const lop = r.c[0]?.v?.toString().trim();
      const bai = r.c[2]?.v?.toString().trim();
      return lop === trainerClass && bai ? parseInt(bai, 10) : null;
    })
    .filter(v => typeof v === "number");

  if (baiList.length === 0) return null;
  return Math.max(...baiList);
}

// ===== Extract with filtering (target phải có trong câu) =====
function extractPresentationData_L2_1(rows, maxLessonCode) {
  // B (1): lessonName, C (2): vocabRaw, I (8): presentation
  const items = rows.map(r => {
    const lessonName   = r.c?.[1]?.v?.toString().trim() || "";
    const vocabRaw     = r.c?.[2]?.v?.toString().trim() || "";
    const presentation = r.c?.[8]?.v?.toString().trim() || "";

    const unitNum = normalizeUnitId(lessonName);
    const targets = splitTargets(vocabRaw);
    const mainTarget = targets[0] || "";

    return { lessonName, unitNum, presentation, mainTarget };
  })
  // chỉ giữ những câu có đủ dữ liệu
  .filter(it => it.lessonName && it.presentation && it.mainTarget)
  // lọc thêm: mainTarget phải thực sự xuất hiện trong presentation
  .filter(it => new RegExp(`\\b${escapeRegExp(it.mainTarget)}\\b`, "i").test(it.presentation));

  // Giới hạn theo bài đã học
  const filtered = items.filter(it => it.unitNum >= 3011 && it.unitNum <= maxLessonCode);

  // Group theo bài, random chọn 12 bài, mỗi bài lấy 1 câu
  const unitMap = {};
  filtered.forEach(it => {
    if (!unitMap[it.lessonName]) unitMap[it.lessonName] = [];
    unitMap[it.lessonName].push(it);
  });

  const unitNames = Object.keys(unitMap);
  if (unitNames.length === 0) return [];

  unitNames.sort(() => Math.random() - 0.5);
  const NUM_LESSONS = Math.min(12, unitNames.length);
  const pickedUnits = unitNames.slice(0, NUM_LESSONS);

  const selected = [];
  pickedUnits.forEach(u => {
    const rowsOfUnit = unitMap[u];
    const chosen = rowsOfUnit[Math.floor(Math.random() * rowsOfUnit.length)];
    selected.push(chosen);
  });

  // 🔎 Bổ sung lọc an toàn: chỉ giữ những câu chắc chắn có thể tạo blank
  const safeSelected = selected.filter(it => {
    const rx = new RegExp(`\\b${escapeRegExp(it.mainTarget)}\\b`, "gi");
    return rx.test(it.presentation);
  });

  // Sắp xếp theo unitNum để đoạn văn mượt
  safeSelected.sort((a, b) => a.unitNum - b.unitNum);
  return safeSelected;
}


function buildParagraphAndBlanks_L2_1() {
  L2_1_blankIndices = pickRandomIndices(L2_1_sentences.length, Math.min(5, L2_1_sentences.length));
  L2_1_total = L2_1_blankIndices.length;
}

// ===== Render UI =====
function renderListeningL2_1() {
  const area = document.getElementById("exerciseArea_L2_1");
  const resultBox = document.getElementById("resultBox_L2_1");

  // Map idx -> thứ tự (1..5)
  const blankOrderMap = {};
  let counter = 1;
  L2_1_sentences.forEach((s, idx) => {
    if (L2_1_blankIndices.includes(idx)) {
      blankOrderMap[idx] = counter++;
    }
  });

  // Hiển thị đoạn văn với (n)__
  const renderedParts = L2_1_sentences.map((s, idx) => {
    if (L2_1_blankIndices.includes(idx)) {
      const n = blankOrderMap[idx];
      const rx = new RegExp(`\\b${escapeRegExp(s.target)}\\b`, "gi");
      return s.text.replace(rx, `(${n})__`);
    }
    return s.text;
  });

  const paragraphDisplay = renderedParts.join(". ").replace(/\s+\./g, ".").trim() + ".";
  const paragraphOriginal = L2_1_sentences.map(s => s.text).join(". ").replace(/\s+\./g, ".").trim() + ".";

  area.innerHTML = `
    <div class="dialogue-text">
      <p>🧩 Nghe đoạn văn và điền 5 từ còn thiếu:</p>
      <div id="paragraphBox_L2_1" style="font-size:20px; color:#667; margin-bottom:10px;">${paragraphDisplay}</div>
      <div style="margin-bottom:10px;">
        <button id="playParagraphBtn_L2_1" class="btn primary">▶️ Nghe đoạn văn</button>
      </div>
      <div id="inputsArea_L2_1"></div>
      <div style="margin-top:12px;">
        <button id="submitL2_1Btn" class="btn success">✅ Nộp bài</button>
      </div>
    </div>
  `;

  // Render inputs 1..5
  const inputsArea = document.getElementById("inputsArea_L2_1");
  inputsArea.innerHTML = "";
  Object.entries(blankOrderMap).forEach(([idx, n]) => {
    const row = document.createElement("div");
    row.style.margin = "6px 0";
    row.innerHTML = `
      <label><strong>(${n})</strong></label>
      <input type="text" id="blankInput_L2_1_${n}" placeholder="Điền từ" style="padding:6px; width:220px;" />
    `;
    inputsArea.appendChild(row);
  });

  // Nút nghe: đọc nguyên văn (chỉ đọc khi ấn)
  document.getElementById("playParagraphBtn_L2_1").onclick = () => {
    speak(paragraphOriginal, L2_1_voiceMale);
  };

  // Nút nộp bài
  document.getElementById("submitL2_1Btn").onclick = () => {
    let correct = 0;
    Object.entries(blankOrderMap).forEach(([idx, n]) => {
      const inputVal = (document.getElementById(`blankInput_L2_1_${n}`).value || "").trim().toLowerCase();
      const target = (L2_1_sentences[idx].target || "").trim().toLowerCase();
      if (inputVal && inputVal === target) correct++;
    });
    L2_1_score = correct;
    resultBox.textContent = `✅ Đúng ${correct}/${L2_1_total}`;
    updateScoreBoardL2_1();
    setResultListeningPart(1, L2_1_score, L2_1_total);
    showL2_1Answers();
  };
}

function showL2_1Answers() {
  const area = document.getElementById("exerciseArea_L2_1");
  const resolvedParts = L2_1_sentences.map((s, idx) => {
    const target = s.target;
    if (L2_1_blankIndices.includes(idx)) {
      const highlighted = `<b style="color:#cc3333;">${target}</b>`;
      const rx = new RegExp(`\\b${escapeRegExp(target)}\\b`, "gi");
      return `${s.text.replace(rx, highlighted)}`;
    }
    return s.text;
  });
  const resolvedParagraph = resolvedParts.join(". ").replace(/\s+\./g, ".").trim() + ".";
  const answerBox = document.createElement("div");
  answerBox.style.marginTop = "10px";
  answerBox.innerHTML = `
    <div style="margin-top:10px; font-size:18px;">
      🧠 Đáp án đầy đủ:
      <div style="color:#333; margin-top:6px;">${resolvedParagraph}</div>
    </div>
  `;
  area.appendChild(answerBox);
}

// ===== Lưu điểm tổng Listening (mode 1/2/3 chung một key) =====
function setResultListeningPart(mode, score, total) {
  const raw = localStorage.getItem("result_listeningcap2");
  const prev = raw ? JSON.parse(raw) : {};

  const updated = {
    score1: mode === 1 ? score : prev.score1 || 0,
    score2: mode === 2 ? score : prev.score2 || 0,
    score3: mode === 3 ? score : prev.score3 || 0,
    total1: mode === 1 ? total : prev.total1 || 0,
    total2: mode === 2 ? total : prev.total2 || 0,
    total3: mode === 3 ? total : prev.total3 || 0
  };

  const totalScore = (updated.score1 + updated.score2 + updated.score3);
  const totalMax = (updated.total1 + updated.total2 + updated.total3);

  // ✅ Lưu đúng key result_listeningcap2
  localStorage.setItem("result_listeningcap2", JSON.stringify({
    ...updated,
    score: totalScore,
    total: totalMax
  }));

  // ✅ Đồng bộ vào result_grade8 (tổng điểm chung)
  const prevResult = JSON.parse(localStorage.getItem("result_grade8") || "{}");
  const updatedResult = {
    score: (prevResult.score || 0) - (prev.score || 0) + totalScore,
    total: (prevResult.total || 0) - (prev.total || 0) + totalMax
  };
  localStorage.setItem("result_grade8", JSON.stringify(updatedResult));
}


// ===== Main: start + bootstrapping =====
async function startListeningMode1_L2() {
  try {
    const container = document.getElementById("exerciseArea_L2_1");
    if (!container) {
      console.error("❌ Không tìm thấy #exerciseArea_L2_1 trong HTML");
      return;
    }

    const maxLessonCode = await getMaxLessonCode();
    if (!maxLessonCode) {
      container.innerHTML = "⚠️ Không xác định được bài học lớn nhất cho lớp hiện tại.";
      return;
    }

    const rows = await fetchGVizRows(SHEET_URL_L2);
    const selected = extractPresentationData_L2_1(rows, maxLessonCode);
    if (selected.length < 12) {
      container.innerHTML = "📭 Không đủ dữ liệu câu ở cột I để tạo đoạn văn.";
      return;
    }

    L2_1_sentences = selected.map(it => ({
      text: it.presentation,
      target: it.mainTarget,
      lessonName: it.lessonName,
      unitNum: it.unitNum
    }));


    L2_1_targets = L2_1_sentences.map(s => s.target);

    buildParagraphAndBlanks_L2_1();

    L2_1_ready = true;
    L2_1_score = 0;
    updateScoreBoardL2_1();
    renderListeningL2_1();

    // Không auto speak — chỉ đọc khi người dùng ấn nút
    // const fullParagraph = L2_1_sentences.map(s => s.text).join(". ").replace(/\s+\./g, ".").trim() + ".";
    // speak(fullParagraph, L2_1_voiceMale);

  } catch (err) {
    console.error("Listening L2 Dạng 1 error:", err);
    const container = document.getElementById("exerciseArea_L2_1");
    if (container) {
      container.innerHTML = "❌ Lỗi tải dữ liệu Listening cấp 2 - Dạng 1.";
    }
  }
}


// ===== Bootstrapping voices for L2 =====
getVoices().then(voices => {
  // Giọng nam
  L2_1_voiceMale =
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("david")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("alex")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("male")) ||
    voices.find(v => v.lang === "en-US");

  // Giọng nữ
  L2_1_voiceFemale =
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("zira")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("samantha")) ||
    voices.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("female")) ||
    voices.find(v => v.lang === "en-US");

  // Tùy Anh gọi start khi cần:
  // startListeningMode1_L2();
});


// ===== Config =====
const listeningSheetUrl2 = "https://docs.google.com/spreadsheets/d/17JUJya5fIL3BfH4-Ysfm1MKbfFFtOmgYQ9C6aiCo5S0/gviz/tq?tqx=out:json";

// ===== State =====
let L2_2_totalQuestions = 0;
let L2_2_correctCount = 0;
let L2_2_wrongCount = 0;

// ===== Helpers =====
async function fetchReadingData_L2_2() {
  const res = await fetch(listeningSheetUrl2);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table.rows;
}
function normalize_L2_2(text) {
  return text?.trim().toLowerCase().replace(/[:.,]/g, "");
}
function shuffleArray_L2_2(array) {
  return array
    .map(value => ({ value, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ value }) => value);
}
function updateStats_L2_2() {
  const el = document.getElementById("scoreBoard_L2_2");
  if (el) {
    el.innerHTML = `
      <strong>Điểm:</strong> ${L2_2_correctCount} |
      <strong>Đã làm:</strong> ${L2_2_totalQuestions} |
      <strong>Đúng:</strong> ${L2_2_correctCount} |
      <strong>Sai:</strong> ${L2_2_wrongCount}
    `;
  }
}

// Lưu điểm vào result_listening (mode=2)
function saveListeningScore_L2_2(totalQ) {
  setResultListeningPart(2, L2_2_correctCount, totalQ);
}

// ===== Main loader =====
async function startListeningMode2_L2() {
  try {
    // Reset stats
    L2_2_totalQuestions = 0;
    L2_2_correctCount = 0;
    L2_2_wrongCount = 0;
    updateStats_L2_2();

    const rows = await fetchReadingData_L2_2();

    // Chọn một bài (lesson) ngẫu nhiên
    const lessonNumbers = [...new Set(rows.map(r => r.c[0]?.v).filter(v => v !== undefined))];
    const selectedLesson = lessonNumbers[Math.floor(Math.random() * lessonNumbers.length)];
    const lessonRows = rows.filter(r => r.c[0]?.v === selectedLesson);

    // Lấy passage (không hiển thị chữ, chỉ dùng để đọc)
    const passageRow = lessonRows.find(r => r.c[1]?.v?.trim());
    const passage = passageRow?.c[1]?.v || "";

    // Dựng câu hỏi
    let allQuestions = lessonRows
      .filter(r => r.c[2]?.v?.trim())
      .map(r => ({
        question: r.c[2]?.v || "",
        options: [
          { letter: "A", text: r.c[3]?.v || "" },
          { letter: "B", text: r.c[4]?.v || "" },
          { letter: "C", text: r.c[5]?.v || "" },
          { letter: "D", text: r.c[6]?.v || "" },
        ],
        correct: (r.c[7]?.v || "")
      }));

    // Chọn ngẫu nhiên 5 câu nhưng giữ nguyên thứ tự
    if (allQuestions.length > 5) {
      let indices = Array.from({ length: allQuestions.length }, (_, i) => i);
      indices.sort(() => Math.random() - 0.5);
      indices = indices.slice(0, 5).sort((a, b) => a - b);
      allQuestions = indices.map(i => allQuestions[i]);
    }

    const questions = allQuestions;

    // Vùng hiển thị
    const passageContainer = document.getElementById("listeningPassageContainer_L2_2");
    const questionsContainer = document.getElementById("listeningQuestionsContainer_L2_2");

    if (!passageContainer || !questionsContainer) {
      console.error("❌ Thiếu container listening L2_2 trong HTML");
      return;
    }

    // Thay passage bằng nút nghe
    passageContainer.innerHTML = `
      <div style="margin-bottom:10px;">
        <button id="playPassageBtn_L2_2" class="btn primary">▶️ Nghe đoạn văn</button>
      </div>
    `;
    questionsContainer.innerHTML = "";

    // Sự kiện phát âm
    document.getElementById("playPassageBtn_L2_2").onclick = () => {
      const u = new SpeechSynthesisUtterance(passage);
      u.lang = "en-US";
      speechSynthesis.speak(u);
    };

    // Render câu hỏi
    questions.forEach((q, index) => {
      const block = document.createElement("div");
      block.className = "question-block";
      block.innerHTML = `<strong>Câu ${index + 1}:</strong> ${q.question}`;

      const ul = document.createElement("ul");
      ul.className = "answers";

      const correctArr = (q.correct || "")
        .split(",")
        .map(x => normalize_L2_2(x))
        .filter(Boolean);

      const shuffledOptions = shuffleArray_L2_2(q.options);
      shuffledOptions.forEach((opt, i) => {
        if (opt.text?.trim()) {
          const li = document.createElement("li");
          const btn = document.createElement("button");
          btn.className = "answer-btn";
          btn.innerText = `${String.fromCharCode(65 + i)}. ${opt.text}`;

          btn.onclick = () => {
            if (btn.disabled) return;
            L2_2_totalQuestions++;
            const userAnswer = normalize_L2_2(opt.text);

            if (correctArr.includes(userAnswer)) {
              btn.classList.add("correct");
              L2_2_correctCount++;
            } else {
              btn.classList.add("wrong");
              L2_2_wrongCount++;
            }

            ul.querySelectorAll("button").forEach(b => b.disabled = true);
            if (input) input.disabled = true;

            updateStats_L2_2();
            if (L2_2_totalQuestions === questions.length) {
              saveListeningScore_L2_2(questions.length);
            }
          };

          li.appendChild(btn);
          ul.appendChild(li);
        }
      });

      block.appendChild(ul);

      // Ô input nhập tay
      const input = document.createElement("input");
      input.placeholder = "Nhập đáp án ...";
      input.onblur = () => {
        if (input.disabled) return;
        L2_2_totalQuestions++;
        const userAnswer = normalize_L2_2(input.value);

        if (correctArr.includes(userAnswer)) {
          input.classList.add("correct");
          L2_2_correctCount++;
        } else {
          input.classList.add("wrong");
          L2_2_wrongCount++;
        }

        input.disabled = true;
        ul.querySelectorAll("button").forEach(b => b.disabled = true);

        updateStats_L2_2();
        if (L2_2_totalQuestions === questions.length) {
          saveListeningScore_L2_2(questions.length);
        }
      };

      block.appendChild(input);
      questionsContainer.appendChild(block);
    });
  } catch (err) {
    console.error("Listening L2 Dạng 2 error:", err);
    const passageContainer = document.getElementById("listeningPassageContainer_L2_2");
    if (passageContainer) {
      passageContainer.innerHTML = "❌ Lỗi tải dữ liệu Listening cấp 2 - Dạng 2.";
    }
  }
}


// Gọi startListeningMode2_L2() khi cần
// Ví dụ: on tab "Listening Dạng 2" được mở:
// startListeningMode2_L2();
// Hàm tổng để gọi từ bai-tap-tung-dang.js
function startListeningCap2() {
  if (typeof startListeningMode1_L2 === "function") startListeningMode1_L2();
  if (typeof startListeningMode2_L2 === "function") startListeningMode2_L2();
  if (typeof startListeningMode3_L2 === "function") startListeningMode3_L2();
}

