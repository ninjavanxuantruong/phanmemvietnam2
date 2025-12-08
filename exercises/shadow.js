/* ===== Shadow Teleprompter — Pokémon Theme (logic) =====
   - Lọc theo chủ đề (cột G)
   - Giới hạn theo max lesson như Speaking 3 (dựa vào trainerClass trong localStorage)
   - Mỗi lessonName lấy 1 câu trước; nếu thiếu thì vòng lại lấy thêm câu khác trong cùng bài, không trùng câu
   - Hiển thị kiểu máy nhắc chữ: 5–7 từ, từ giữa highlight vàng, chạy theo nhịp audio TTS
   - Log chi tiết toàn bộ các bước để debug
========================================================= */

// ===== Config =====
// Service TTS
const TTS_BASE = "https://googlevoice-tinh.onrender.com";

// Sheet chính (giống Speaking 3)
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

// Sheet "Bài học" để lấy max lesson theo lớp (giống Speaking 3)
const SHEET_BAI_HOC = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";

// Mapping cột (0-based)
const COL = {
  lessonName: 1,    // B: mã bài (vd "3-07-2")
  targets: 2,       // C: vocab/từ khóa
  topic: 6,         // G: chủ đề
  presentation: 8,  // I: câu thuyết trình
  meaning: 24       // Y: nghĩa (nếu có)
};

const LOWER_BOUND_UNIT = 3011; // giống Speaking 3
const WINDOW_SIZE = 7;         // hiển thị 5–7 từ

// ===== UI refs =====
const topicSelect = document.getElementById("topicSelect");
const countSelect = document.getElementById("countSelect");
const speedControl = document.getElementById("speedControl");
const startBtn = document.getElementById("startBtn");
const stopBtn = document.getElementById("stopBtn");
const lineInner = document.getElementById("lineInner");
const statusLine = document.getElementById("statusLine");
const toastEl = document.getElementById("shadowToast");

// ===== Audio =====
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let isPlaying = false;
let currentSource = null;
let currentTimer = null;

// Autoplay policy: resume khi có gesture
document.addEventListener("click", async () => {
  if (audioCtx.state !== "running") {
    try { await audioCtx.resume(); } catch {}
  }
}, { once: true });

// ===== Init =====
document.addEventListener("DOMContentLoaded", initShadow);

async function initShadow() {
  bindControls();
  status("Đang tải chủ đề từ Google Sheet...");
  try {
    const rows = await fetchGVizRows(SHEET_URL);
    console.log("📥 SHEET rows (total):", rows.length);
    buildTopicDropdown(rows);
    countSelect.value = localStorage.getItem("shadow_count") || "10";
    const rememberedTopic = localStorage.getItem("shadow_topic");
    if (rememberedTopic) topicSelect.value = rememberedTopic;
    status("Sẵn sàng.");
  } catch (err) {
    console.error("❌ Init error:", err);
    status("❌ Không thể tải dữ liệu từ Google Sheet.");
    toast("Kiểm tra URL/gid và quyền public.");
  }
}

function bindControls() {
  startBtn.onclick = startShadow;
  stopBtn.onclick = stopShadow;
  topicSelect.onchange = () => localStorage.setItem("shadow_topic", topicSelect.value);
  countSelect.onchange = () => localStorage.setItem("shadow_count", countSelect.value);
}


// ===== Config =====
const BATCH_SIZE = 7;       // ghép 6–7 câu một batch
const PAUSE_SEC = 0.6;      // ngắt nghỉ tương đương "1 dấu chấm"
const PAUSE_FACTOR = 2;     // 2 dấu chấm → ngắt dài hơn (nhân đôi)
const USE_DOUBLE_PAUSE = true; // bật/tắt 2 dấu chấm

// ===== Helpers =====
function concatAudioBuffers(audioCtx, buffers) {
  const sampleRate = buffers[0].sampleRate;
  const totalLength = buffers.reduce((sum, b) => sum + b.length, 0);
  const result = audioCtx.createBuffer(1, totalLength, sampleRate);
  let offset = 0;
  for (const b of buffers) {
    result.getChannelData(0).set(b.getChannelData(0), offset);
    offset += b.length;
  }
  return result;
}

function makeSilenceBuffer(audioCtx, durationSec) {
  const len = Math.max(1, Math.floor(audioCtx.sampleRate * durationSec));
  const silence = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
  // Mặc định kênh = 0 đã là silence (zero-filled)
  return silence;
}

async function fetchBuffersSequential(sentences, speed) {
  const buffers = [];
  for (let i = 0; i < sentences.length; i++) {
    try {
      const buf = await fetchBuffer(sentences[i].text, speed, "en-US", "");
      console.log(`🎧 Câu ${i + 1} len(samples): ${buf.length}, dur(s): ${buf.duration}`);
      buffers.push(buf);
    } catch (e) {
      console.warn(`⚠️ Câu ${i + 1} lỗi, bỏ qua:`, e);
      // Bỏ câu lỗi để khỏi làm lệch tổng
      // Nếu muốn giữ, có thể tạo dummy + đặt duration giả, nhưng sẽ lệch audio thực
    }
  }
  return buffers;
}

function chunkArray(arr, size) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ===== Core flow =====
async function startShadow() {
  if (isPlaying) return;
  isPlaying = true;
  startBtn.disabled = true;
  stopBtn.disabled = false;

  if (audioCtx.state === "suspended") { try { await audioCtx.resume(); } catch {} }

  try {
    status("Đang chuẩn bị dữ liệu...");
    const topic = topicSelect.value;
    const count = parseInt(countSelect.value, 10);
    const speed = parseFloat(speedControl.value);

    console.log("🎛️ User selection:", { topic, count, speed });

    const maxLessonCode = await getMaxLessonCode();
    const rows = await fetchGVizRows(SHEET_URL);
    const topicRows = filterByTopic(rows, topic);
    const items = extractPresentationData(topicRows, maxLessonCode);
    const sentences = buildSentences(items, count);

    if (sentences.length === 0) {
      toast("📭 Không có câu thuyết trình cho chủ đề này.");
      stopShadow();
      return;
    }

    // 1) Lấy buffer từng câu (tuần tự, tránh giới hạn)
    status("Đang tải audio từng câu...");
    const speechBuffers = await fetchBuffersSequential(sentences, speed);
    if (speechBuffers.length === 0) {
      toast("❌ Không tải được audio nào.");
      stopShadow();
      return;
    }

    // 2) Tạo pause buffer cho mỗi câu
    const pauseSec = PAUSE_SEC * (USE_DOUBLE_PAUSE ? PAUSE_FACTOR : 1);
    const pauseBuf = makeSilenceBuffer(audioCtx, pauseSec);

    // 3) Tạo dữ liệu batch (mỗi câu = speech + pause)
    const batches = [];
    const sentenceMeta = []; // giữ metadata để highlight
    const sampleRate = audioCtx.sampleRate;

    const pairs = []; // mảng các {sentence, speechBuf}
    let bi = 0;
    for (let i = 0; i < sentences.length && bi < speechBuffers.length; i++, bi++) {
      pairs.push({ sentence: sentences[i], speechBuf: speechBuffers[bi] });
    }

    const chunks = chunkArray(pairs, BATCH_SIZE);
    for (const chunk of chunks) {
      const batchBuffers = [];
      const batchMeta = [];
      for (const { sentence, speechBuf } of chunk) {
        // durations theo mẫu để khớp tuyệt đối
        const speechSec = speechBuf.length / speechBuf.sampleRate;
        const pauseSecEff = pauseBuf.length / pauseBuf.sampleRate;

        batchBuffers.push(speechBuf);
        batchBuffers.push(pauseBuf); // thêm ngắt nghỉ sau câu

        batchMeta.push({
          text: sentence.text,
          words: sentence.text.trim().split(/\s+/).filter(Boolean),
          speechSamples: speechBuf.length,
          pauseSamples: pauseBuf.length,
          speechSec,
          pauseSec: pauseSecEff
        });
      }

      const batchBuffer = concatAudioBuffers(audioCtx, batchBuffers);
      batches.push({ batchBuffer, batchMeta });
      sentenceMeta.push(...batchMeta);
    }

    // 4) Phát lần lượt từng batch, highlight tuyệt đối theo mẫu
    status("Bắt đầu đọc mượt theo batch 6–7 câu...");
    await playFromBatches(batches);

    status("Hoàn tất.");
    stopShadow();
  } catch (err) {
    console.error("❌ Start shadow error:", err);
    toast("❌ Lỗi khởi chạy Shadow.");
    stopShadow();
  }
}

async function playFromBatches(batches) {
  for (let bIndex = 0; bIndex < batches.length; bIndex++) {
    const { batchBuffer, batchMeta } = batches[bIndex];

    // 1) Phát batch
    let source = null;
    try {
      source = audioCtx.createBufferSource();
      source.buffer = batchBuffer;
      source.connect(audioCtx.destination);
      source.start();
      console.log(`🔈 Batch ${bIndex + 1}/${batches.length} start, dur(s):`, batchBuffer.duration);
    } catch (e) {
      console.error("❌ Batch audio start error:", e);
      continue;
    }

    // 2) Tạo mốc thời gian tuyệt đối theo mẫu (speech + pause)
    const sr = batchBuffer.sampleRate;
    const cumulativeEndsSec = []; // mốc kết thúc mỗi câu trong batch (tính cả pause)
    const cumulativeStartsSec = []; // mốc bắt đầu mỗi câu
    let accSamples = 0;

    for (const m of batchMeta) {
      cumulativeStartsSec.push(accSamples / sr);
      accSamples += m.speechSamples;
      accSamples += m.pauseSamples;
      cumulativeEndsSec.push(accSamples / sr);
    }

    // 3) rAF loop: highlight theo elapsed tuyệt đối
    const t0 = audioCtx.currentTime;
    let lastSentenceIdx = -1;
    let lastWordIdx = -1;
    const EPS = 1e-3;

    const frame = () => {
      const elapsed = audioCtx.currentTime - t0;

      // Kết thúc batch: ép từ cuối của câu cuối trong batch
      if (elapsed >= batchBuffer.duration - EPS) {
        const lastIdx = batchMeta.length - 1;
        const words = batchMeta[lastIdx].words;
        renderWindow(words, words.length - 1, WINDOW_SIZE);
        console.log("🏁 Batch audio ended (clamp)");
        return;
      }

      // Xác định câu hiện tại trong batch
      let sIdx = 0;
      for (let i = 0; i < cumulativeEndsSec.length; i++) {
        if (elapsed < cumulativeEndsSec[i] - EPS) { sIdx = i; break; }
      }

      const sStart = cumulativeStartsSec[sIdx];
      const sEnd = cumulativeEndsSec[sIdx];
      const sElapsed = Math.max(0, Math.min(elapsed - sStart, sEnd - sStart));

      // Phần speech của câu hiện tại
      const speechSec = batchMeta[sIdx].speechSec;
      const words = batchMeta[sIdx].words;

      // Nếu đang ở vùng pause cuối câu → giữ từ cuối
      let wIdx;
      if (sElapsed >= speechSec - EPS) {
        wIdx = words.length - 1;
      } else {
        // Chạy đều theo số từ trong phần speech
        const p = sElapsed / Math.max(1e-6, speechSec);
        wIdx = Math.floor(p * words.length);
        if (wIdx >= words.length) wIdx = words.length - 1;
      }

      // Chuyển câu: reset cửa sổ
      if (sIdx !== lastSentenceIdx) {
        status(`Đang đọc câu ${sIdx + 1}/${batchMeta.length} (batch ${bIndex + 1}/${batches.length})`);
        renderWindow(words, 0, WINDOW_SIZE);
        lastSentenceIdx = sIdx;
        lastWordIdx = -1;
      }
      if (wIdx !== lastWordIdx) {
        renderWindow(words, wIdx, WINDOW_SIZE);
        lastWordIdx = wIdx;
      }

      requestAnimationFrame(frame);
    };

    requestAnimationFrame(frame);

    // 4) Chờ batch kết thúc thật sự
    await new Promise((resolve) => {
      source.onended = () => {
        console.log("🏁 Batch source onended");
        resolve();
      };
    });
  }
}




// ===== Stop =====
function stopShadow() {
  isPlaying = false;
  startBtn.disabled = false;
  stopBtn.disabled = true;

  try { currentSource && currentSource.stop(); } catch {}
  currentSource = null;

  if (currentTimer) { clearInterval(currentTimer); currentTimer = null; }
  status("Đã dừng.");
}


// ===== TTS =====
// ===== TTS fetchBuffer =====
async function fetchBuffer(text, speed = 1, lang = "en-US", voice = "") {
  const url = `${TTS_BASE}/tts?q=${encodeURIComponent(text)}&speed=${encodeURIComponent(speed)}&lang=${encodeURIComponent(lang)}&voice=${encodeURIComponent(voice)}`;
  console.log("🎧 TTS URL:", url);

  const resp = await fetch(url, { cache: "no-store" });
  if (!resp.ok) throw new Error(`TTS request failed: ${resp.status}`);

  const arrayBuffer = await resp.arrayBuffer();

  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch (e) {
      console.warn("⚠️ AudioContext resume failed before decode:", e);
    }
  }

  const buffer = await audioCtx.decodeAudioData(arrayBuffer);
  console.log("🔊 Audio decoded length(s):", buffer.duration);
  return buffer;
}

async function playFromFullBuffer(sentences, durations, fullBuffer) {
  try {
    currentSource = audioCtx.createBufferSource();
    currentSource.buffer = fullBuffer;
    currentSource.connect(audioCtx.destination);
    currentSource.start();
    console.log("🔈 Full audio start, duration(s):", fullBuffer.duration);
  } catch (e) {
    console.error("❌ Full audio start error:", e);
    currentSource = null;
  }

  // Highlight từng từ trong từng câu theo durations
  let sIdx = 0;

  const runSentence = () => {
    if (sIdx >= sentences.length) return;

    const sentence = sentences[sIdx].text.trim();
    const words = sentence.split(/\s+/).filter(Boolean);
    const totalSec = durations[sIdx] || 4;
    const intervalMs = (totalSec * 1000) / Math.max(1, words.length);

    status(`Đang đọc câu ${sIdx + 1}/${sentences.length}`);
    console.log(`▶️ Highlight [${sIdx + 1}]`, sentence);

    let i = 0;
    renderWindow(words, i, WINDOW_SIZE);

    const timer = setInterval(() => {
      i++;
      if (i < words.length) {
        renderWindow(words, i, WINDOW_SIZE);
      } else {
        clearInterval(timer);
        sIdx++;
        runSentence(); // chuyển sang câu tiếp theo
      }
    }, intervalMs);
  };

  runSentence();

  // Chờ audio kết thúc
  await new Promise((resolve) => {
    currentSource.onended = () => {
      console.log("🏁 Full audio ended");
      resolve();
    };
  });
}




// ===== Teleprompter per sentence =====
async function playSentenceSmooth(sentence, speed = 1) {
  console.log("▶️ playSentenceSmooth: start", { sentence, speed });

  if (audioCtx.state === "suspended") {
    try { await audioCtx.resume(); } catch (e) {
      console.warn("⚠️ AudioContext resume failed at play start:", e);
    }
  }

  let buffer;
  try {
    buffer = await fetchBuffer(sentence, speed, "en-US", ""); // giữ tiếng Anh, bỏ voice nếu backend không hỗ trợ
  } catch (e) {
    console.warn("⚠️ TTS failed, fallback to silent timing:", e);
    buffer = { duration: Math.max(3, sentence.split(/\s+/).length * 0.4) };
  }

  const words = sentence.split(/\s+/).filter(Boolean);
  const totalSec = buffer.duration || 4;
  const intervalMs = (totalSec * 1000) / Math.max(1, words.length);

  if (buffer && buffer instanceof AudioBuffer) {
    try {
      currentSource = audioCtx.createBufferSource();
      currentSource.buffer = buffer;
      currentSource.connect(audioCtx.destination);
      currentSource.start();
      console.log("🔈 Audio start, duration(s):", buffer.duration);
    } catch (e) {
      console.error("❌ Audio start error:", e);
      currentSource = null;
    }
  } else {
    currentSource = null;
    console.log("🔈 Fallback timing (no audio buffer)");
  }

  let i = 0;
  renderWindow(words, i, WINDOW_SIZE);

  await new Promise((resolve) => {
    currentTimer = setInterval(() => {
      i++;
      if (i < words.length) {
        renderWindow(words, i, WINDOW_SIZE);
      } else {
        clearInterval(currentTimer);
        currentTimer = null;
        console.log("⏱️ Timer finished for sentence");
        resolve();
      }
    }, intervalMs);
  });

  const endTimeoutMs = (totalSec * 1000) + 1000;

  if (currentSource) {
    await Promise.race([
      new Promise((r) => {
        currentSource.onended = () => {
          console.log("🏁 Audio onended fired");
          r();
        };
      }),
      new Promise((r) => setTimeout(() => {
        console.warn("⏳ Audio end timeout reached, proceeding");
        r();
      }, endTimeoutMs))
    ]);
  }

  console.log("✅ playSentenceSmooth: done");
}



// ===== Teleprompter window render =====
function renderWindow(words, currentIndex, windowSize) {
  const half = Math.floor(windowSize / 2);
  const start = Math.max(0, currentIndex - half);
  const end = Math.min(words.length, currentIndex + half + 1);
  const windowWords = words.slice(start, end);

  const html = windowWords.map((w, i) => {
    const realIndex = start + i;
    let cls = "word";
    if (realIndex < currentIndex) cls += " read";
    if (realIndex === currentIndex) cls += " active";
    if (realIndex > currentIndex) cls += " upcoming";
    return `<span class="${cls}">${escapeHTML(w)}</span>`;
  }).join(" ");
  lineInner.innerHTML = html;
}

// ===== GViz fetch =====
async function fetchGVizRows(url) {
  console.log("🔗 Fetching GViz:", url);
  const res = await fetch(url, { cache: "no-store" });
  const txt = await res.text();
  try {
    const json = JSON.parse(txt.substring(47).slice(0, -2));
    const rows = json.table?.rows || [];
    console.log("📥 GViz parsed rows:", rows.length);
    return rows.map(r => r.c.map(cell => (cell ? cell.v : null)));
  } catch (err) {
    console.error("❌ GViz parse error:", err);
    console.log("🧾 Raw head(200):", txt.slice(0, 200));
    throw err;
  }
}

// ===== Topics =====
function buildTopicDropdown(rows) {
  const topics = [...new Set(rows.map(r => r[COL.topic]).filter(Boolean))];
  topics.sort((a, b) => String(a).localeCompare(String(b)));
  topicSelect.innerHTML = topics
    .map(t => `<option value="${escapeHTML(String(t))}">${escapeHTML(String(t))}</option>`)
    .join("");
  console.log("🏷️ Topics built:", topics.length, topics);
}

function filterByTopic(rows, topic) {
  const filtered = rows.filter(r => String(r[COL.topic]).trim() === String(topic).trim());
  const lessons = [...new Set(filtered.map(r => r[COL.lessonName]).filter(Boolean))];
  console.log("🧭 Chủ đề chọn:", topic, "→ lessons:", lessons.length, lessons);
  return filtered;
}

// ===== Lesson code normalize + max lesson =====
function normalizeUnitId(unitStr) {
  if (!unitStr) return 0;
  const parts = unitStr.toString().trim().split("-");
  if (parts.length < 3) return 0;
  const [cls, lesson, part] = parts;
  const c = parseInt(cls, 10);
  const l = parseInt(lesson, 10);
  const p = parseInt(part, 10);
  if (Number.isNaN(c) || Number.isNaN(l) || Number.isNaN(p)) return 0;
  return c * 1000 + l * 10 + p;
}

async function getMaxLessonCode() {
  const trainerClass = localStorage.getItem("trainerClass")?.trim() || "";
  console.log("🎒 trainerClass:", trainerClass || "(chưa đặt)");

  const txt = await (await fetch(SHEET_BAI_HOC, { cache: "no-store" })).text();
  const json = JSON.parse(txt.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const baiList = rows
    .map(r => {
      const lop = r.c[0]?.v?.toString().trim();
      const bai = r.c[2]?.v?.toString().trim();
      return lop === trainerClass && bai ? parseInt(bai, 10) : null;
    })
    .filter(v => typeof v === "number");

  if (baiList.length === 0) {
    console.warn("⚠️ Không tìm thấy bài học nào cho lớp", trainerClass, "→ bỏ qua maxLessonCode filter");
    return Number.MAX_SAFE_INTEGER; // không giới hạn nếu không có dữ liệu
  }
  const maxLessonCode = Math.max(...baiList);
  return maxLessonCode;
}

// ===== Extract presentation data (theo chủ đề + giới hạn max lesson) =====
function extractPresentationData(rows, maxLessonCode) {
  const items = [];
  for (const r of rows) {
    const lessonName = safeStr(r[COL.lessonName]);
    const presentation = safeStr(r[COL.presentation]).replace(/\s+/g, " ").trim();
    const meaning = safeStr(r[COL.meaning]);
    const targetsRaw = safeStr(r[COL.targets]);
    const targets = targetsRaw ? targetsRaw.split(/[,/;|]/).map(s => s.trim()).filter(Boolean) : [];
    const unitNum = normalizeUnitId(lessonName);

    if (!lessonName || !presentation) continue;

    // Áp giới hạn giống Speaking 3: từ LOWER_BOUND_UNIT đến maxLessonCode
    if (unitNum <= maxLessonCode) {
      items.push({ lessonName, unitNum, presentation, meaning, targets });
    }

  }
  // Log nhanh các bài hợp lệ
  const lessonSet = [...new Set(items.map(i => i.lessonName))];
  console.log("🧮 Bài hợp lệ sau filter unit:", lessonSet.length, lessonSet);
  return items;
}

// ===== Build sentences: mỗi bài 1 câu, vòng lại nếu thiếu nhưng không trùng =====
function buildSentences(items, count) {
  const byLesson = new Map();
  for (const it of items) {
    const key = it.lessonName;
    if (!byLesson.has(key)) byLesson.set(key, []);
    byLesson.get(key).push(it);
  }

  // Log các bài và số câu mỗi bài
  console.log("📚 Bản đồ bài → số câu:", [...byLesson.entries()].map(([k, v]) => ({ lesson: k, count: v.length })));

  const picked = [];
  const usedPerLesson = new Map();

  // Lấy mỗi bài 1 câu đầu tiên (random)
  for (const [lesson, arr] of byLesson.entries()) {
    const randomIdx = Math.floor(Math.random() * arr.length);
    const chosen = arr[randomIdx];
    picked.push({
      text: chosen.presentation,
      target: chosen.targets[0] || "",
      meaning: chosen.meaning || "",
      lesson: lesson
    });
    usedPerLesson.set(lesson, new Set([chosen.presentation]));
    if (picked.length >= count) break;
  }
  console.log("🟢 Sau pass đầu (mỗi bài 1 câu):", picked.length);

  // Nếu thiếu, vòng lại lấy thêm câu khác trong cùng bài (không trùng, random)
  let loopCount = 0;
  while (picked.length < count && loopCount < 20) { // tránh vòng vô hạn
    let added = false;
    for (const [lesson, arr] of byLesson.entries()) {
      const used = usedPerLesson.get(lesson) || new Set();
      // lọc ra các câu chưa dùng
      const candidates = arr.filter(it => !used.has(it.presentation));
      if (candidates.length > 0) {
        const randomIdx = Math.floor(Math.random() * candidates.length);
        const next = candidates[randomIdx];
        picked.push({
          text: next.presentation,
          target: next.targets[0] || "",
          meaning: next.meaning || "",
          lesson: lesson
        });
        used.add(next.presentation);
        usedPerLesson.set(lesson, used);
        added = true;
        if (picked.length >= count) break;
      }
    }
    loopCount++;
    if (!added) {
      console.warn("⚠️ Hết câu mới để vòng lại. Tổng câu chọn:", picked.length);
      break;
    }
  }

  // Log danh sách câu cuối cùng
  console.table(picked.map((p, i) => ({ idx: i + 1, lesson: p.lesson, text: p.text })));
  return picked;
}

// ===== TTS fetchBuffer =====



// ===== Utilities =====
function delay(ms) { return new Promise(r => setTimeout(r, ms)); }
function safeStr(v) { return v == null ? "" : String(v); }
function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (ch) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[ch]);
}
function status(msg) { if (statusLine) statusLine.textContent = msg || ""; }
function toast(msg) {
  toastEl.textContent = msg;
  toastEl.style.display = "block";
  setTimeout(() => { toastEl.style.display = "none"; }, 2500);
}
