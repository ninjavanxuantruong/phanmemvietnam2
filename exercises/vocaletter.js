// ===== VocaLetter – Full JS =====

// ===== Config =====
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
const SHEET_BAI_HOC = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
const IMAGE_API_KEY = "51268254-554135d72f1d226beca834413"; // Pixabay key

const COL = {
  lessonName: 1,   // B
  vocab: 2,        // C
  topic: 5,        // G
  meaning: 24      // Y
};

// ===== State for review =====
let currentReviewList = [];
let reviewTimer = null;

// ===== Boot =====
document.addEventListener("DOMContentLoaded", () => {
  const runBtn = document.getElementById("runBtn");
  const reviewBtn = document.getElementById("reviewBtn");
  const reviewOnlyUnchecked = document.getElementById("reviewOnlyUnchecked"); // optional checkbox if present

  runBtn.onclick = runVocaLetter;
  if (reviewBtn) reviewBtn.onclick = () => startReview(reviewOnlyUnchecked?.checked === true);
});

// ===== Main flow =====
async function runVocaLetter() {
  const statusEl = document.getElementById("status");
  const resultEl = document.getElementById("vocaResult");
  const letterRaw = document.getElementById("letterInput").value.trim();

  resultEl.innerHTML = "";
  setStatus("Đang tải dữ liệu...", statusEl);

  // Validate letter
  if (!letterRaw || !/^[a-z]$/i.test(letterRaw)) {
    setStatus("Nhập một chữ cái A–Z.", statusEl);
    resultEl.innerHTML = `<p class="muted">Ví dụ: nhập B để xem các từ đã học bắt đầu bằng B.</p>`;
    return;
  }
  const letter = letterRaw.toUpperCase();

  try {
    const maxLessonCode = await getMaxLessonCode();
    const rows = await fetchGVizRows(SHEET_URL);
    const words = buildWords(rows, maxLessonCode);

    const filtered = words.filter(it => it.word.charAt(0).toUpperCase() === letter);

    // Lưu danh sách để ôn tập
    currentReviewList = filtered;

    renderTable(letter, filtered, resultEl);
    setStatus(`Sẵn sàng.`, statusEl);
  } catch (err) {
    console.error("❌ VocaLetter error:", err);
    setStatus("Không thể tải dữ liệu.", statusEl);
    resultEl.innerHTML = `<p class="muted">Kiểm tra kết nối mạng hoặc đường dẫn Google Sheet.</p>`;
  }
}

// ===== Data fetchers =====
async function fetchGVizRows(url) {
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  const json = JSON.parse(txt.substring(47).slice(0, -2));
  return json.table?.rows || [];
}

async function getMaxLessonCode() {
  const trainerClass = localStorage.getItem("trainerClass")?.trim() || "";
  try {
    const res = await fetch(SHEET_BAI_HOC, { cache: "no-store" });
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

    if (baiList.length === 0) return Number.MAX_SAFE_INTEGER;
    return Math.max(...baiList);
  } catch (e) {
    console.warn("⚠️ getMaxLessonCode failed, bypass limit.", e);
    return Number.MAX_SAFE_INTEGER;
  }
}

// ===== Builders =====
// GOM theo token đơn: meanings, phrases, lessons dạng Set; sort theo unitNum nhỏ nhất
function buildWords(rows, maxLessonCode) {
  const wordMap = new Map();

  for (const r of rows) {
    const lessonName = safeStr(r.c?.[COL.lessonName]?.v);
    const unitNum = normalizeUnitId(lessonName);
    const vocabRaw = safeStr(r.c?.[COL.vocab]?.v);
    const meaning = safeStr(r.c?.[COL.meaning]?.v);

    if (!lessonName || !vocabRaw || !meaning) continue;
    if (maxLessonCode && unitNum > maxLessonCode) continue;

    // Tách cụm thành tokens theo khoảng trắng
    const tokens = vocabRaw.split(/\s+/).filter(Boolean);

    for (const token of tokens) {
      const word = token.toLowerCase().trim();
      if (!word) continue;

      if (!wordMap.has(word)) {
        wordMap.set(word, {
          word,
          meanings: new Set(),
          phrases: new Set(),
          lessons: new Set(),
          unitNum
        });
      }

      const entry = wordMap.get(word);
      entry.meanings.add(meaning);
      entry.phrases.add(vocabRaw);
      entry.lessons.add(lessonName);
      entry.unitNum = Math.min(entry.unitNum, unitNum); // giữ unit nhỏ nhất để sort
    }
  }

  // Chuyển Set thành mảng để render
  return [...wordMap.values()]
    .map(it => ({
      word: it.word,
      meanings: [...it.meanings],
      phrases: [...dedupeStringsCaseInsensitive([...it.phrases])],
      lessons: [...dedupeStringsCaseInsensitive([...it.lessons])],
      unitNum: it.unitNum
    }))
    .sort((a, b) => a.unitNum - b.unitNum);
}

// ===== Renderers =====
function renderTable(letter, list, container) {
  if (list.length === 0) {
    container.innerHTML = `<p>📭 Không có từ nào bắt đầu bằng chữ <b>${letter}</b>.</p>`;
    return;
  }

  let html = `<p class="count-line">📊 Có <b>${list.length}</b> từ bắt đầu bằng chữ <b>${letter}</b>.</p>`;
  html += `<table>
    <thead>
      <tr><th>Từ</th><th>Nghĩa</th><th>Cụm gốc</th><th>Bài học</th><th>Thuộc?</th></tr>
    </thead>
    <tbody>`;

  list.forEach(it => {
    const key = tickKey(it.word);
    const checked = localStorage.getItem(key) === "1" ? "checked" : "";
    // Hiển thị theo yêu cầu: token (phrase) — vẫn giữ nghĩa gốc
    const displayWord = `${escapeHTML(it.word)} ${it.phrases.length ? `(${escapeHTML(it.phrases[0])})` : ""}`;
    html += `<tr>
      <td>${displayWord}</td>
      <td>${escapeHTML(it.meanings.join("; "))}</td>
      <td>${escapeHTML(it.phrases.join(" | "))}</td>
      <td>${escapeHTML(it.lessons.join(" | "))}</td>
      <td><input type="checkbox" class="tickBox" data-word="${escapeAttr(it.word)}" ${checked}></td>
    </tr>`;
  });

  html += `</tbody></table>
  <div id="tickSummary" class="count-line"></div>
  <div style="margin-top:10px;" class="muted">Tip: Tick để lưu trạng thái đã thuộc/chưa thuộc (lưu trong trình duyệt).</div>`;
  container.innerHTML = html;

  // Sự kiện tick
  container.querySelectorAll(".tickBox").forEach(box => {
    box.addEventListener("change", () => {
      const word = box.dataset.word;
      localStorage.setItem(tickKey(word), box.checked ? "1" : "0");
      updateTickSummary(container);
    });
  });

  updateTickSummary(container);
}

function updateTickSummary(container) {
  const boxes = container.querySelectorAll(".tickBox");
  let learned = 0;
  let notLearned = 0;
  boxes.forEach(b => {
    if (b.checked) learned++;
    else notLearned++;
  });
  const summary = container.querySelector("#tickSummary");
  summary.textContent = `✅ Đã thuộc: ${learned} | ❌ Chưa thuộc: ${notLearned}`;
}

// ===== Review (Ôn tập 6s/từ, gợi ý + ảnh) =====
function startReview(onlyUnchecked = false) {
  if (!currentReviewList || currentReviewList.length === 0) {
    alert("Hãy thống kê trước rồi mới ôn tập!");
    return;
  }

  const reviewList = onlyUnchecked
    ? currentReviewList.filter(it => localStorage.getItem(tickKey(it.word)) !== "1")
    : currentReviewList;

  if (reviewList.length === 0) {
    alert("Không có từ nào để ôn tập theo lựa chọn hiện tại.");
    return;
  }

  let idx = 0;
  const area = document.getElementById("reviewArea");
  if (!area) {
    console.warn("⚠️ reviewArea không tồn tại trong HTML.");
    return;
  }

  if (reviewTimer) clearInterval(reviewTimer);

  async function showWord() {
    const item = reviewList[idx];
    const hint = buildHint(item.word);
    const imgUrl = await fetchImageForKeyword(item.word);

    area.innerHTML = `
      <div style="font-size:22px; margin-bottom:10px;">🔤 ${hint}</div>
      <div style="margin-bottom:10px;">📖 Nghĩa: ${escapeHTML(item.meanings.join("; "))}</div>
      ${imgUrl ? `<img src="${imgUrl}" alt="${escapeAttr(item.word)}" style="max-width:70vw;max-height:40vh;border-radius:8px;">` : `<div class="muted">Không có minh hoạ</div>`}
    `;

    idx = (idx + 1) % reviewList.length;
  }

  showWord();
  reviewTimer = setInterval(showWord, 6000); // 6s mỗi từ
}

// ===== Image fetch (Pixabay) =====
async function fetchImageForKeyword(keyword) {
  const searchTerm = `${keyword} cartoon`;
  const apiUrl = `https://pixabay.com/api/?key=${IMAGE_API_KEY}&q=${encodeURIComponent(searchTerm)}&image_type=illustration&safesearch=true&per_page=5`;
  try {
    const res = await fetch(apiUrl, { cache: "no-store" });
    const data = await res.json();
    if (data.hits && data.hits.length > 0) {
      const chosen = data.hits[Math.floor(Math.random() * data.hits.length)];
      return chosen.webformatURL;
    }
  } catch (err) {
    console.warn("❌ Pixabay error:", err);
  }
  return null;
}

// ===== Hint builder: "cat" → "c _ _"
function buildHint(word) {
  const tokens = word.split(/\s+/).filter(Boolean);
  return tokens.map(tok => {
    const first = tok.charAt(0);
    const rest = tok.slice(1).replace(/./g, "_");
    return `${first} ${rest.split("").join(" ")}`;
  }).join("   ");
}

// ===== Utils =====
function setStatus(msg, el) { if (el) el.textContent = msg || ""; }
function safeStr(v) { return v == null ? "" : String(v); }
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function escapeAttr(str) {
  return String(str).replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
function dedupeStringsCaseInsensitive(arr) {
  const seen = new Set();
  const out = [];
  for (const s of arr) {
    const k = s.toLowerCase();
    if (!seen.has(k)) {
      seen.add(k);
      out.push(s);
    }
  }
  return out;
}
function normalizeUnitId(unitStr) {
  if (!unitStr) return 0;
  const parts = unitStr.toString().trim().split("-");
  if (parts.length < 3) return 0;
  const [clsStr, lessonStr, partStr] = parts;
  const cls = parseInt(clsStr, 10);
  const lesson = parseInt(lessonStr, 10);
  const part = parseInt(partStr, 10);
  if (Number.isNaN(cls) || Number.isNaN(lesson) || Number.isNaN(part)) return 0;
  return cls * 1000 + lesson * 10 + part;
}
function tickKey(word) {
  if (!word) return "voca_empty";
  return "voca_" + word.toLowerCase().trim();
}

