// overview.js
import { showVictoryEffect } from './effect-win.js';
import { showDefeatEffect } from './effect-loose.js';

// Google Sheets
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1PbWWqgKDBDorh525uecKaGZD21FGSoCeR-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

// Trạng thái phiên (reset 1 lần khi tải trang)
if (!localStorage.getItem("overview_isSessionStarted")) {
  ["score1","score2","score3","total1","total2","total3"].forEach(k => localStorage.removeItem(k));
  localStorage.setItem("overview_isSessionStarted", "true");
}

// Dữ liệu tách cho 3 dạng
let dataWord = [];    // Dạng 2: từ đơn (C, Y)
let dataArrange = []; // Dạng 1: sắp xếp câu (J, L)
let dataChunks = [];  // Dạng 3: dịch theo cụm (D, E)

// Trạng thái dạng đang làm
let mode = 1;
let currentIndex = 0;
let score = 0;

// DOM
const area = document.getElementById("exerciseArea");
const finalBox = document.getElementById("finalBox");

// Utils
function shuffle(arr) { return arr.sort(() => Math.random() - 0.5); }

function normSentence(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,;'\)\(]/g, "")   // bỏ .,;')( như yêu cầu
    .replace(/\s+/g, " ")
    .trim();
}
function tokenizeWords(answer) {
  // tách theo khoảng trắng, bỏ token rỗng
  return normSentence(answer).split(" ").filter(Boolean);
}
function speakEN(text) {
  if (!text) return;
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US"; speechSynthesis.speak(u);
}

function updateScoreBoard() {
  const s1 = +localStorage.getItem("score1") || 0;
  const s2 = +localStorage.getItem("score2") || 0;
  const s3 = +localStorage.getItem("score3") || 0;
  const t1 = +localStorage.getItem("total1") || 0;
  const t2 = +localStorage.getItem("total2") || 0;
  const t3 = +localStorage.getItem("total3") || 0;
  document.getElementById("scoreBoard").innerHTML = `
    <p>🧩 Dạng 1: ${s1}/${t1}</p>
    <p>🔤 Dạng 2: ${s2}/${t2}</p>
    <p>🧱 Dạng 3: ${s3}/${t3}</p>
    <hr />
    <p><strong>🎯 Tổng: ${s1 + s2 + s3}/${t1 + t2 + t3}</strong></p>
    <p class="muted">Hoàn thành cả 3 dạng để xem hiệu ứng bắt Pokémon.</p>
  `;
}

function setResultOverviewPart(m, sc, tot) {
  const raw = localStorage.getItem("result_overview");
  const prev = raw ? JSON.parse(raw) : {};
  const updated = {
    score1: m === 1 ? sc : prev.score1 || 0,
    score2: m === 2 ? sc : prev.score2 || 0,
    score3: m === 3 ? sc : prev.score3 || 0,
    total1: m === 1 ? tot : prev.total1 || 0,
    total2: m === 2 ? tot : prev.total2 || 0,
    total3: m === 3 ? tot : prev.total3 || 0
  };
  const totalScore = updated.score1 + updated.score2 + updated.score3;
  const totalMax = updated.total1 + updated.total2 + updated.total3;
  localStorage.setItem("result_overview", JSON.stringify({
    ...updated,
    score: totalScore,
    total: totalMax
  }));
}

function checkOverviewEnd() {
  const s1 = +localStorage.getItem("score1") || 0;
  const s2 = +localStorage.getItem("score2") || 0;
  const s3 = +localStorage.getItem("score3") || 0;
  const t1 = +localStorage.getItem("total1") || 0;
  const t2 = +localStorage.getItem("total2") || 0;
  const t3 = +localStorage.getItem("total3") || 0;
  if (t1 === 0 || t2 === 0 || t3 === 0) return;

  const totalScore = s1 + s2 + s3;
  const totalMax = t1 + t2 + t3;
  const percent = totalScore / totalMax;

  const container = document.querySelector(".overview-container");
  finalBox.innerHTML = `
    <h2 style="color:hotpink;">🎯 Hoàn tất 3 dạng!</h2>
    <p style="color:hotpink;">Tổng điểm: ${totalScore} / ${totalMax} (${Math.round(percent*100)}%)</p>
    <div style="font-size: 48px; color:hotpink; margin-top: 8px;">✨ Sẵn sàng bắt Pokémon ✨</div>
  `;

  if (totalMax > 0 && percent >= 0.7) {
    showVictoryEffect(container);
  } else {
    showDefeatEffect(container);
  }
}

// Fetch dữ liệu theo cột yêu cầu
// Lấy danh sách từ đã chọn từ localStorage
const rawWords = JSON.parse(localStorage.getItem("wordBank") || "[]");
const rawWordsSet = new Set(rawWords.map(w => (w || "").trim()));

async function fetchExercises() {
  const res = await fetch(SHEET_URL);
  const txt = await res.text();
  const json = JSON.parse(txt.substring(47).slice(0, -2));
  const rows = json.table.rows || [];

  // Reset mảng dữ liệu
  dataWord = [];
  dataArrange = [];
  dataChunks = [];

  const seenArrange = new Set();

  rows.forEach(r => {
    const word = (r.c[2]?.v || "").trim(); // Cột C
    if (!word || !rawWordsSet.has(word)) return;

    // --- Dạng 2: từ đơn (C, Y) ---
    const vi = (r.c[24]?.v || "").trim(); // Cột Y
    if (word && vi) {
      dataWord.push({ en: word, vi });
    }

    // --- Dạng 1: sắp xếp câu (J, L) ---
    const qRaw = (r.c[9]?.v || "").trim();   // Cột J
    const aRaw = (r.c[11]?.v || "").trim();  // Cột L
    if (qRaw && aRaw) {
      const qNorm = normSentence(qRaw);
      const aNorm = normSentence(aRaw);
      if (!seenArrange.has(aNorm)) {
        seenArrange.add(aNorm);
        dataArrange.push({ question: qNorm, answer: aNorm });
      }
    }

    // --- Dạng 3: dịch theo cụm (D, E) ---
    const enRaw = (r.c[3]?.v || "").trim(); // Cột D
    const viRaw = (r.c[4]?.v || "").trim(); // Cột E
    if (enRaw && viRaw) {
      const enChunks = enRaw.split("/").map(s => normSentence(s)).filter(Boolean);
      const viChunks = viRaw.split("/").map(s => normSentence(s)).filter(Boolean);
      if (enChunks.length && viChunks.length && enChunks.length === viChunks.length) {
        dataChunks.push({ enChunks, viChunks });
      }
    }
  });

  // Có thể xáo trộn nếu muốn
  // dataWord = shuffle(dataWord);
  // dataArrange = shuffle(dataArrange);
  // dataChunks = shuffle(dataChunks);
}



// Gán nút mode
document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    mode = parseInt(btn.dataset.mode);
    startMode(mode);
  });
});

// Reset phiên (xóa điểm 3 dạng và tổng)
document.getElementById("resetSessionBtn").addEventListener("click", () => {
  ["score1","score2","score3","total1","total2","total3","result_overview"].forEach(k => localStorage.removeItem(k));
  currentIndex = 0; score = 0;
  finalBox.innerHTML = "";
  updateScoreBoard();
  startMode(mode);
});

// Khởi động
await fetchExercises();
updateScoreBoard();
startMode(mode);

// Bộ khởi động từng mode
function startMode(m) {
  currentIndex = 0; score = 0; finalBox.innerHTML = "";
  area.innerHTML = "";
  if (m === 1) showArrange();
  if (m === 2) showWordVI2EN();
  if (m === 3) showChunkTranslate();
}

// Placeholder cho 3 dạng (định nghĩa ở các phần sau)

// ========== DẠNG 1: SẮP XẾP TỪ THÀNH CÂU ==========
function showArrange() {
  if (currentIndex >= dataArrange.length) {
    // Lưu điểm dạng 1
    localStorage.setItem("score1", String(score));
    localStorage.setItem("total1", String(dataArrange.length));
    setResultOverviewPart(1, score, dataArrange.length);
    updateScoreBoard();
    finalBox.innerHTML = `<p style="color:green;">🎉 Hoàn tất dạng 1. Điểm: ${score}/${dataArrange.length}</p>`;
    checkOverviewEnd();
    return;
  }

  const item = dataArrange[currentIndex];
  // tokens từ đáp án, trộn thứ tự cho bank
  const tokens = tokenizeWords(item.answer);
  const shuffled = shuffle([...tokens]);

  area.innerHTML = `
    <h3>🧩 Sắp xếp từ thành câu</h3>
    <div class="question-box">Gợi ý: ${item.question || "(Sắp xếp lại để thành câu đúng)"} </div>
    <div style="margin:10px 0;"><strong>Chọn từ:</strong></div>
    <div id="arrangeBank"></div>
    <div style="margin-top:12px;"><strong>Câu của bạn:</strong> <span id="arrangeBuild"></span></div>
    <div style="margin-top:12px;">
      <button class="btn" id="undoBtn">↩️ Hoàn tác</button>
      <button class="btn" id="resetBtn">♻️ Làm lại</button>
      <button class="btn primary" id="submitBtn">✅ Kiểm tra</button>
      <button class="btn" id="skipBtn">⏭ Bỏ qua</button>
    </div>
    <p id="resultMsg" class="muted"></p>
  `;

  const bankEl = document.getElementById("arrangeBank");
  const buildEl = document.getElementById("arrangeBuild");
  const resultEl = document.getElementById("resultMsg");

  const picked = [];
  shuffled.forEach((tok, i) => {
    const chip = document.createElement("button");
    chip.className = "chip";
    chip.textContent = tok;
    chip.dataset.idx = String(i);
    chip.addEventListener("click", () => {
      picked.push(tok);
      chip.classList.add("disabled");
      renderBuild();
    });
    bankEl.appendChild(chip);
  });

  function renderBuild() {
    buildEl.textContent = picked.join(" ");
  }

  document.getElementById("undoBtn").addEventListener("click", () => {
    if (!picked.length) return;
    const last = picked.pop();
    // enable lại 1 chip tương ứng (enable chip đầu tiên còn disabled với text = last)
    const chips = bankEl.querySelectorAll(".chip.disabled");
    for (let c of chips) {
      if (c.textContent === last) { c.classList.remove("disabled"); break; }
    }
    renderBuild();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    picked.length = 0;
    bankEl.querySelectorAll(".chip").forEach(c => c.classList.remove("disabled"));
    renderBuild();
    resultEl.textContent = "";
  });

  document.getElementById("skipBtn").addEventListener("click", () => {
    currentIndex++;
    showArrange();
  });

  document.getElementById("submitBtn").addEventListener("click", () => {
    const user = normSentence(picked.join(" "));
    const ans = normSentence(item.answer);
    if (!user) {
      resultEl.textContent = "⚠️ Hãy ghép câu trước đã.";
      return;
    }
    if (user === ans) {
      score++;
      resultEl.style.color = "green";
      resultEl.textContent = "✅ Chính xác!";
      speakEN(item.answer);
    } else {
      resultEl.style.color = "red";
      resultEl.textContent = `❌ Sai. Đáp án: "${item.answer}"`;
    }
    // chuyển câu
    setTimeout(() => { currentIndex++; showArrange(); }, 900);
  });
}

// ========== DẠNG 2: DỊCH TỪ ĐƠN (VI → EN) ==========
function showWordVI2EN() {
  if (currentIndex >= dataWord.length) {
    // Lưu điểm dạng 2
    localStorage.setItem("score2", String(score));
    localStorage.setItem("total2", String(dataWord.length));
    setResultOverviewPart(2, score, dataWord.length);
    updateScoreBoard();
    finalBox.innerHTML = `<p style="color:blue;">🎉 Hoàn tất dạng 2. Điểm: ${score}/${dataWord.length}</p>`;
    checkOverviewEnd();
    return;
  }

  const item = dataWord[currentIndex];
  let answered = false; // ✅ cờ trạng thái

  area.innerHTML = `
    <h3>🔤 Dịch từ đơn (VI → EN)</h3>
    <div class="question-box">Nghĩa tiếng Việt: <strong>${item.vi}</strong></div>
    <div style="margin-top:12px;">
      <input type="text" id="ansWord" placeholder="Nhập từ tiếng Anh..." />
    </div>
    <div style="margin-top:8px;">
      <button class="btn primary" id="submitWord">✅ Trả lời</button>
      <button class="btn" id="skipWord">⏭ Bỏ qua</button>
      <button class="btn" id="hintWord">💡 Gợi ý</button>
    </div>
    <p id="resultWord" class="muted"></p>
  `;

  const inputEl = document.getElementById("ansWord");
  const resultEl = document.getElementById("resultWord");
  const submitBtn = document.getElementById("submitWord");

  submitBtn.addEventListener("click", () => {
    if (answered) return;   // ✅ chặn spam
    answered = true;
    submitBtn.disabled = true; // ✅ disable nút

    const user = normSentence(inputEl.value);
    const ans = normSentence(item.en);
    if (!user) {
      resultEl.textContent = "⚠️ Hãy nhập câu trả lời.";
      return;
    }
    if (user === ans) {
      score++;
      resultEl.style.color = "green";
      resultEl.textContent = "✅ Chính xác!";
      speakEN(item.en);
    } else {
      resultEl.style.color = "red";
      resultEl.textContent = `❌ Sai. Đáp án: "${item.en}"`;
    }
    setTimeout(() => { currentIndex++; showWordVI2EN(); }, 900);
  });

  document.getElementById("skipWord").addEventListener("click", () => {
    currentIndex++; showWordVI2EN();
  });

  document.getElementById("hintWord").addEventListener("click", () => {
    const first = (item.en || "").charAt(0);
    resultEl.style.color = "#555";
    resultEl.textContent = `💡 Gợi ý: Bắt đầu bằng chữ "${first.toUpperCase()}".`;
  });

  inputEl.focus();
}

// ========== DẠNG 3: DỊCH THEO CỤM (VI ↔ EN, mặc định VI → EN) ==========
function showChunkTranslate() {
  if (currentIndex >= dataChunks.length) {
    localStorage.setItem("score3", String(score));
    localStorage.setItem("total3", String(dataChunks.length));
    setResultOverviewPart(3, score, dataChunks.length);
    updateScoreBoard();
    finalBox.innerHTML = `<p style="color:purple;">🎉 Hoàn tất dạng 3. Điểm: ${score}/${dataChunks.length}</p>`;
    checkOverviewEnd();
    return;
  }

  const item = dataChunks[currentIndex]; // { enChunks, viChunks }
  let answered = false; // ✅ cờ trạng thái

  // Render từng cặp VI–EN theo hàng
  const rowsHTML = item.viChunks.map((viBlock, i) => {
    const enAns = item.enChunks[i];
    return `
      <div class="pair-row" data-row="${i}">
        <span class="vi-block" data-vi="${i}">${viBlock}</span>
        <input type="text" class="en-input" data-ans="${enAns}" data-en="${i}" placeholder="Nhập cụm tiếng Anh..." />
      </div>
    `;
  }).join("");

  area.innerHTML = `
    <h3>🧱 Dịch theo cụm (VI → EN)</h3>
    <div class="pair-wrap">${rowsHTML}</div>
    <div style="margin-top:12px;">
      <button class="btn primary" id="submitChunk">✅ Kiểm tra</button>
      <button class="btn" id="skipChunk">⏭ Bỏ qua</button>
    </div>
    <p id="resultChunk" class="muted"></p>
  `;

  const resultEl = document.getElementById("resultChunk");
  const submitBtn = document.getElementById("submitChunk");

  // Hàm căn chiều rộng input bằng vi-block
  function alignPairs() {
    const pairs = Array.from(document.querySelectorAll(".pair-row"));
    pairs.forEach(row => {
      const vi = row.querySelector(".vi-block");
      const en = row.querySelector(".en-input");
      if (!vi || !en) return;
      const viRect = vi.getBoundingClientRect();
      en.style.width = Math.ceil(viRect.width) + "px";
      en.style.height = Math.ceil(viRect.height) + "px";
      en.style.lineHeight = (Math.ceil(viRect.height) - 16) + "px";
    });
  }
  requestAnimationFrame(alignPairs);
  window.addEventListener("resize", alignPairs, { passive: true });

  document.getElementById("skipChunk").addEventListener("click", () => {
    window.removeEventListener("resize", alignPairs);
    currentIndex++;
    showChunkTranslate();
  });

  submitBtn.addEventListener("click", () => {
    if (answered) return;   // ✅ chặn spam
    answered = true;
    submitBtn.disabled = true; // ✅ disable nút

    const inputs = Array.from(document.querySelectorAll(".en-input"));
    let correctBlocks = 0;

    inputs.forEach(inp => {
      const user = normSentence(inp.value);
      const ans = normSentence(inp.dataset.ans);
      inp.classList.remove("ok", "bad");
      if (user && user === ans) {
        correctBlocks++;
        inp.classList.add("ok");
      } else {
        inp.classList.add("bad");
      }
    });

    const ratio = correctBlocks / inputs.length;
    if (ratio >= 0.7) {
      score++;
      resultEl.style.color = "green";
      resultEl.textContent = `✅ Đúng ${correctBlocks}/${inputs.length} (≥70%) → +1 điểm`;
    } else {
      resultEl.style.color = "red";
      resultEl.textContent = `❌ Đúng ${correctBlocks}/${inputs.length} (<70%)`;
    }

    setTimeout(() => {
      window.removeEventListener("resize", alignPairs);
      currentIndex++;
      showChunkTranslate();
    }, 1100);
  });
}



