/**
 * ============================================================================
 * module-1-intro.js — MODULE 1: GIỚI THIỆU TỪ VỰNG
 * ============================================================================
 * Đây là module DUY NHẤT có nhân vật mascot (Live2D). Các module 2-5 không
 * dùng mascot. Sửa gì trong module này thì chỉ sửa file này, không ảnh hưởng
 * module khác.
 *
 * Luồng:
 *  1. Chọn nhân vật hướng dẫn (nếu chưa chọn trong buổi học này)
 *  2. Mascot giới thiệu từng từ (ảnh + từ + nghĩa), Mầm non thì bỏ chữ to
 *  3. Luyện tập theo cấp độ (random 1/2 dạng, trừ Mầm non cố định):
 *     - Mầm non: chạm đúng hình khi nghe từ
 *     - Dễ:      A) Tách âm (phonics) / B) Lặp lại theo mẫu (mic)
 *     - TB:      A) Hội thoại Q&A mẫu / B) Đoán nghĩa qua câu ví dụ vui
 *     - Khó:     A) Từ trong cụm (collocation) / B) Phân biệt từ gần nghĩa
 *  4. Lưu điểm đánh giá vào result_vocabulary (qua saveIntroResult của all-shared)
 * ============================================================================
 */

import {
  LEVELS, speakEN, speakInstructionOnce, askMCQ, askSpeakingAttempt,
  buildDistractors, shuffle, randomPick, createScoreTracker,
  recordQuestionPassed, recordSpeakingAttempt, saveIntroResult,
  showTransition, updateMiniScore, getImageFromMap, isMicrophoneAvailable,
  POSITIVE_FEEDBACK, injectSharedStyles,
} from "./all-shared.js";

// ============================================================================
// A. DANH SÁCH NHÂN VẬT + HẠ TẦNG LIVE2D (chỉ dùng trong module này)
// ============================================================================

const INTRO_BASE = "https://raw.githubusercontent.com/ninjavanxuantruong/Open-LLM-VTuber-main/main/";
const INTRO_CHAR_LIST = [
  ["Chitose",         "live2d-models/Chitose/runtime/chitose.model3.json"],
  ["Haruto",          "live2d-models/haruto/runtime/haruto.model3.json"],
  ["Hibiki",          "live2d-models/Hibiki/runtime/hibiki.model3.json"],
  ["Hiyori",          "live2d-models/hiyori_free/runtime/hiyori_free_t08.model3.json"],
  ["Izumi",           "live2d-models/Izumi/runtime/izumi_illust.model3.json"],
  ["Kei",             "live2d-models/kei_basic_free/runtime/kei_basic_free.model3.json"],
  ["Koharu",          "live2d-models/koharu/runtime/koharu.model3.json"],
  ["Mao",             "live2d-models/mao_pro/runtime/mao_pro.model3.json"],
  ["Mark-kun",        "live2d-models/Mark-kun/runtime/mark_free_t04.model3.json"],
  ["Shizuku",         "live2d-models/shizuku/runtime/shizuku.model3.json"],
  ["Tororo",          "live2d-models/tororo/runtime/tororo.model3.json"],
  ["Unity-chan",      "live2d-models/Unity-chan/runtime/unitychan.model3.json"],
  ["Nito",            "live2d-models/Nito/runtime/nito.model3.json"],
  ["Hijiki",          "live2d-models/hijiki/runtime/hijiki.model3.json"],
];

// --- Audio engine riêng cho mascot (giữ lipsync) ---
const TTS_BASE = "https://googlevoice-tinh.onrender.com";
let audioCtx = null;
const audioCache = new Map();

function getAudioCtx() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  if (audioCtx.state === "suspended") audioCtx.resume();
  return audioCtx;
}
document.addEventListener("touchstart", () => getAudioCtx(), { once: true });
document.addEventListener("mousedown", () => getAudioCtx(), { once: true });

async function fetchMascotAudio(text, lang = "en-US", speed = 0.9) {
  const key = `${lang}|${speed}|${text}`;
  if (audioCache.has(key)) return audioCache.get(key);
  const url = `${TTS_BASE}/tts?q=${encodeURIComponent(text)}&speed=${speed}&lang=${encodeURIComponent(lang)}&voice=`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("TTS fail");
  const ab = await res.arrayBuffer();
  const buf = await getAudioCtx().decodeAudioData(ab);
  audioCache.set(key, buf);
  return buf;
}

// --- Live2D state (chỉ 1 nhân vật "main") ---
let pixiApp = null;
let liveModel = null;
let lipRAF = null;

async function ensurePixiApp(canvas, slotEl) {
  if (pixiApp) return;
  try {
    PIXI.live2d.Live2DModel.registerTicker(PIXI.Ticker);
  } catch (e) { /* đã đăng ký rồi */ }
  pixiApp = new PIXI.Application({ view: canvas, autoStart: true, backgroundAlpha: 0, resizeTo: slotEl });
}

function fitModel(slotEl) {
  if (!liveModel || !pixiApp) return;
  const W = pixiApp.renderer.width, H = pixiApp.renderer.height;
  const sc = Math.min(W / liveModel.internalModel.originalWidth, H / liveModel.internalModel.originalHeight) * 0.9;
  liveModel.scale.set(sc);
  liveModel.x = W / 2 - liveModel.width / 2;
  liveModel.y = H / 2 - liveModel.height / 2 + 8;
}

async function loadMascotModel(charInfo, canvas, slotEl) {
  if (!window.PIXI?.live2d) return;
  await ensurePixiApp(canvas, slotEl);
  try {
    const url = INTRO_BASE + charInfo[1].split("/").map(encodeURIComponent).join("/").replace(/%2F/g, "/");
    const model = await PIXI.live2d.Live2DModel.from(url);
    liveModel = model;
    pixiApp.stage.addChild(model);
    fitModel(slotEl);
    try { model.motion("idle"); } catch (e) { /* không có idle motion thì thôi */ }
  } catch (e) {
    console.error("Lỗi tải mascot:", e);
  }
}

function startLipSync(barsEl) {
  if (barsEl) barsEl.classList.add("active");
  const barEls = barsEl ? barsEl.querySelectorAll(".ibar") : [];
  let t = 0;
  const loop = () => {
    t += 1 / 60;
    const vol = Math.max(0, Math.min(1, 0.5 + 0.5 * Math.sin(t * 3.8 * Math.PI * 2) + (Math.random() - 0.5) * 0.3));
    if (liveModel) {
      try {
        const core = liveModel.internalModel.coreModel;
        if (core.setParameterValueById) core.setParameterValueById("ParamMouthOpenY", vol);
        else if (core.setParamFloat) core.setParamFloat("PARAM_MOUTH_OPEN_Y", vol);
      } catch (e) { /* model không có param này */ }
    }
    barEls.forEach((b, i) => {
      const off = Math.abs(3 - i) / 3;
      b.style.height = Math.max(2, vol * (1 - off * 0.5) * 20 + Math.random() * 3) + "px";
    });
    lipRAF = requestAnimationFrame(loop);
  };
  lipRAF = requestAnimationFrame(loop);
}
function stopLipSync(barsEl) {
  if (lipRAF) { cancelAnimationFrame(lipRAF); lipRAF = null; }
  if (barsEl) { barsEl.classList.remove("active"); barsEl.querySelectorAll(".ibar").forEach(b => b.style.height = "2px"); }
  if (liveModel) {
    try {
      const core = liveModel.internalModel.coreModel;
      if (core.setParameterValueById) core.setParameterValueById("ParamMouthOpenY", 0);
      else if (core.setParamFloat) core.setParamFloat("PARAM_MOUTH_OPEN_Y", 0);
    } catch (e) { /* bỏ qua */ }
  }
}

/** Mascot nói + lipsync. LUÔN await xong mới cho tương tác tiếp (đúng quy tắc khoá âm thanh). */
async function mascotSpeak(text, speed = 0.85) {
  const barsEl = document.getElementById("introBars");
  try {
    const buf = await fetchMascotAudio(text, "en-US", speed);
    const ac = getAudioCtx();
    const src = ac.createBufferSource();
    src.buffer = buf; src.connect(ac.destination);
    startLipSync(barsEl);
    src.start();
    await new Promise(r => { src.onended = r; });
  } catch (e) {
    // fallback: dùng browser TTS (không lipsync) nhưng vẫn khoá đúng cách
    await speakEN(text, speed);
  }
  stopLipSync(barsEl);
}

function mascotCharHTML() {
  const bars = [0, 1, 2, 3, 4, 5, 6].map(() => `<div class="ibar" style="background:#27ae60;"></div>`).join("");
  return `
    <div class="intro-char-slot" id="introSlot">
      <canvas id="introCanvas"></canvas>
      <div id="introBars" class="intro-lipsync-bars">${bars}</div>
    </div>`;
}

// ============================================================================
// B. CHỌN NHÂN VẬT (chỉ hỏi 1 lần / buổi học — không đụng vào ở module khác)
// ============================================================================

function injectModule1Styles() {
  if (document.getElementById("pkl-m1-style")) return;
  const style = document.createElement("style");
  style.id = "pkl-m1-style";
  style.textContent = `
    .intro-scene {
      display:flex; flex-direction:row; align-items:flex-end; border-radius:16px;
      overflow:hidden; min-height:300px; position:relative;
      background:linear-gradient(180deg,#d6e4f0 0%,#c8dbe8 55%,#b5a98a 55%,#a8976e 100%);
    }
    @media (max-width:600px){ .intro-scene{ flex-direction:column; align-items:center; min-height:unset; } }
    .intro-char-slot { position:relative; width:190px; height:280px; flex-shrink:0; }
    @media (max-width:600px){ .intro-char-slot{ width:100%; height:180px; } }
    .intro-char-slot canvas { position:absolute; inset:0; width:100%; height:100%; }
    .intro-lipsync-bars {
      position:absolute; bottom:20px; left:50%; transform:translateX(-50%);
      display:flex; gap:3px; align-items:flex-end; height:18px; opacity:0; transition:opacity .3s; z-index:5;
    }
    .intro-lipsync-bars.active { opacity:1; }
    .intro-lipsync-bars .ibar { width:4px; min-height:2px; border-radius:2px; transition:height .08s; }
    .intro-whiteboard {
      flex:1; background:#fff; border:3px solid #bbb; border-radius:8px;
      box-shadow:2px 4px 16px rgba(0,0,0,.18); padding:16px; display:flex; flex-direction:column;
      align-items:center; gap:10px; min-height:260px; justify-content:center; margin:10px; color:#333;
    }
    @media (max-width:600px){ .intro-whiteboard{ width:calc(100% - 16px); min-height:200px; margin:8px; } }
    .word-tap { cursor:pointer; padding:2px 6px; border-radius:6px; transition:background .15s; display:inline-block; }
    .word-tap:active { background:rgba(0,0,0,.1); }
    .pkl-char-grid {
      display:grid; grid-template-columns:repeat(auto-fill,minmax(90px,1fr)); gap:8px;
      max-height:50vh; overflow-y:auto; padding:4px;
    }
    .pkl-char-item {
      padding:10px 6px; border-radius:10px; cursor:pointer; text-align:center;
      border:2px solid rgba(255,255,255,.15); background:rgba(255,255,255,.05); color:#ccc;
      font-size:13px; transition:all .15s;
    }
    .pkl-char-item.selected { border-color:#2ecc71; background:rgba(46,204,113,.15); color:#2ecc71; font-weight:700; }
  `;
  document.head.appendChild(style);
}

async function pickMascotIfNeeded(rootEl) {
  injectModule1Styles();
  const saved = localStorage.getItem("selected_instructor_idx");
  if (saved !== null) return INTRO_CHAR_LIST[parseInt(saved, 10)] || INTRO_CHAR_LIST[0];

  return new Promise(resolve => {
    let sel = 0;
    const render = () => {
      rootEl.innerHTML = `
        <div style="text-align:center;color:#FFCB05;font-weight:700;margin-bottom:10px;">
          🌸 Choose your teacher for today!
        </div>
        <div class="pkl-char-grid">
          ${INTRO_CHAR_LIST.map((c, i) => `
            <div class="pkl-char-item ${i === sel ? "selected" : ""}" data-i="${i}">${i === sel ? "✔ " : ""}${c[0]}</div>
          `).join("")}
        </div>
        <div style="text-align:center;margin-top:14px;">
          <button class="poke-btn yellow" id="pklStartWithChar">▶ Start with ${INTRO_CHAR_LIST[sel][0]}</button>
        </div>`;
      rootEl.querySelectorAll(".pkl-char-item").forEach(el => {
        el.onclick = () => { sel = parseInt(el.dataset.i, 10); render(); };
      });
      rootEl.querySelector("#pklStartWithChar").onclick = () => {
        localStorage.setItem("selected_instructor_idx", String(sel));
        resolve(INTRO_CHAR_LIST[sel]);
      };
    };
    render();
  });
}

// ============================================================================
// C. TRÌNH BÀY TỪ VỰNG (mascot giới thiệu từng từ)
// ============================================================================

async function presentWords(rootEl, sessionVocab, level, charInfo) {
  rootEl.innerHTML = `
    <div class="intro-scene">
      ${mascotCharHTML()}
      <div class="intro-whiteboard"><div id="introWB">
        <div style="color:#aaa;font-size:13px;">Loading...</div>
      </div></div>
    </div>
    <div style="text-align:center;margin-top:12px;">
      <button class="poke-btn yellow" id="introNextBtn" disabled>👀 Watching...</button>
    </div>`;

  const canvas = document.getElementById("introCanvas");
  const slotEl = document.getElementById("introSlot");
  await loadMascotModel(charInfo, canvas, slotEl);

  await mascotSpeak(`Hi! I'm ${charInfo[0]}. Today we have ${sessionVocab.length} new words. Let's learn them together!`);

  const isMamNon = level === LEVELS.MAM_NON;

  for (let i = 0; i < sessionVocab.length; i++) {
    const w = sessionVocab[i];
    const imgSrc = getImageFromMap((w.imageKeyword || w.word).toLowerCase().trim()) || "";
    const wb = document.getElementById("introWB");

    await mascotSpeak(`This is... ${w.word}.`);

    wb.innerHTML = `
      <div style="width:100%;display:flex;flex-direction:column;align-items:center;gap:8px;">
        ${imgSrc ? `<img src="${imgSrc}" style="height:${isMamNon ? "140px" : "100px"};max-width:90%;object-fit:contain;border-radius:10px;border:1px solid #eee;cursor:pointer;" id="introWordImg"/>` : ""}
        ${isMamNon ? "" : `
          <div style="display:flex;flex-wrap:wrap;gap:6px;justify-content:center;">
            ${w.word.split(" ").map(p => `<span class="word-tap" data-w="${p}" style="font-size:26px;font-weight:800;color:#1a1a2e;">${p.toUpperCase()}</span>`).join(" ")}
          </div>`}
        <div style="font-size:${isMamNon ? "15px" : "16px"};color:#555;background:#f5f5f5;padding:5px 12px;border-radius:6px;">${w.meaning || ""}</div>
        ${(!isMamNon && w.noteAH) ? `<div style="font-size:13px;color:#e67e22;background:#fff3e0;padding:4px 10px;border-radius:6px;">💡 ${w.noteAH}</div>` : ""}
      </div>`;

    wb.querySelectorAll(".word-tap").forEach(span => { span.onclick = () => speakEN(span.dataset.w, 0.5); });
    const imgEl = document.getElementById("introWordImg");
    if (imgEl) imgEl.onclick = () => mascotSpeak(w.word, 0.7);

    await new Promise(r => setTimeout(r, 1500));
  }

  await mascotSpeak("Great! Now let's practice what we just learned!");
}

// ============================================================================
// D. CÁC DẠNG LUYỆN TẬP THEO CẤP ĐỘ
// ============================================================================

// --- MẦM NON: chạm đúng hình khi nghe từ (cố định, không random) ---
async function practiceMamNon(rootEl, sessionVocab, poolData, tracker) {
  for (const w of sessionVocab) {
    const distractorWords = buildDistractors(w, poolData, { field: "word", count: 2, extra: sessionVocab });
    const options = shuffle([
      { label: w.word, value: w.word, imageUrl: getImageFromMap(w.imageKeyword || w.word) || "" },
      ...distractorWords.map(dw => {
        const found = [...poolData, ...sessionVocab].find(p => p.word === dw);
        return { label: dw, value: dw, imageUrl: getImageFromMap(found?.imageKeyword || dw) || "" };
      }),
    ]);
    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "mamnon-listen-pick",
      instructionText: "Listen and tap the correct picture!",
      questionHTML: `<div style="font-size:40px;">🔊</div>`,
      options, correctValue: w.word,
      speakPromptText: w.word,
      rate: 0.85,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// --- DỄ — A: Tách âm (phonics) ---
async function practiceDe_Phonics(rootEl, sessionVocab, poolData, tracker) {
  for (const w of sessionVocab) {
    rootEl.innerHTML = `
      <div style="text-align:center;">
        <div style="font-size:26px;font-weight:800;color:#FFCB05;margin-bottom:10px;">${w.word.toUpperCase()}</div>
        <div id="pklPhonicsBox" style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;min-height:50px;"></div>
      </div>`;
    const box = document.getElementById("pklPhonicsBox");
    let unitCount = w.word.length > 6 ? 3 : 2; // ước lượng dự phòng nếu không có handleSplit

    await speakInstructionOnce("de-phonics", "Let's break this word into sounds!");
    if (window.handleSplit) {
      try {
        await window.handleSplit(w.word.trim().toLowerCase(), box, null);
        const units = box.querySelectorAll("[data-index]");
        if (units.length) unitCount = units.length;
      } catch (e) { box.innerHTML = `<p style="color:#e74c3c;">No sound data for "${w.word}"</p>`; }
    } else {
      box.innerHTML = `<p style="color:#999;font-size:13px;">(phonics engine chưa được nạp — bỏ qua tách âm chi tiết)</p>`;
    }
    await speakEN(w.word, 0.6);

    // Quiz nhẹ: đếm số âm/số phần vừa nghe
    const correctCount = unitCount;
    const optionCounts = shuffle([correctCount, correctCount + 1, Math.max(1, correctCount - 1)]);
    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "de-phonics-quiz",
      instructionText: "How many sounds did you hear in this word?",
      questionHTML: `<div style="font-size:22px;">🔊 <b>${w.word}</b></div>`,
      options: optionCounts.map(n => ({ label: String(n), value: String(n) })),
      correctValue: String(correctCount),
      speakPromptText: w.word,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// --- DỄ — B: Lặp lại theo mẫu (mic, 1 lần bắt buộc) ---
async function practiceDe_Repeat(rootEl, sessionVocab, tracker) {
  for (const w of sessionVocab) {
    const imgSrc = getImageFromMap(w.imageKeyword || w.word) || "";
    const { isCorrect } = await askSpeakingAttempt({
      container: rootEl,
      instructionKey: "de-repeat",
      instructionText: "Listen and repeat after me!",
      targetText: w.word,
      speakBeforeText: w.word,
      maxRecordMs: 10000,
      promptHTML: `
        ${imgSrc ? `<img src="${imgSrc}" style="height:90px;border-radius:10px;"/><br/>` : ""}
        <div style="font-size:24px;font-weight:800;color:#FFCB05;margin-top:8px;">${w.word.toUpperCase()}</div>`,
    });
    recordSpeakingAttempt(tracker, isCorrect);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// --- TRUNG BÌNH — A: Hội thoại Q&A mẫu ---
async function practiceTB_Dialogue(rootEl, sessionVocab, poolData, tracker) {
  const withQA = sessionVocab.filter(w => w.question && w.answerRaw);
  const list = withQA.length ? withQA : sessionVocab;
  for (const w of list) {
    if (w.question && w.answerRaw) {
      rootEl.innerHTML = `
        <div style="background:#fff;color:#333;border-radius:12px;padding:16px;text-align:center;">
          <div style="color:#27ae60;font-weight:700;">Teacher: ${w.question}</div>
          <div style="color:#8e44ad;font-weight:700;margin-top:8px;">Friend: ${w.answerRaw}</div>
        </div>`;
      await speakInstructionOnce("tb-dialogue", "Listen to this short conversation!");
      await speakEN(w.question, 0.9);
      await new Promise(r => setTimeout(r, 400));
      await speakEN(w.answerRaw, 0.9);
    }
    const distractors = buildDistractors(w, poolData, { field: "word", count: 3, extra: sessionVocab });
    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "tb-dialogue-quiz",
      instructionText: "Which word did you hear in the conversation?",
      questionHTML: `<div style="font-size:16px;">💬 "${w.question || w.answerRaw}"</div>`,
      options: shuffle([w.word, ...distractors]).map(v => ({ label: v, value: v })),
      correctValue: w.word,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// --- TRUNG BÌNH — B: Đoán nghĩa qua câu ví dụ vui ---
async function practiceTB_GuessMeaning(rootEl, sessionVocab, poolData, tracker) {
  for (const w of sessionVocab) {
    const sentence = w.presentSent || w.noteAH || w.noteAI || w.word;
    const distractors = buildDistractors(w, poolData, { field: "meaning", count: 3, extra: sessionVocab });
    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "tb-guess-meaning",
      instructionText: "Listen to the sentence and guess what the word means!",
      questionHTML: `<div style="font-size:17px;">📝 "${sentence}"</div>`,
      options: shuffle([w.meaning, ...distractors]).map(v => ({ label: v, value: v })),
      correctValue: w.meaning,
      speakPromptText: sentence,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// --- KHÓ — A: Từ trong cụm (collocation) ---
async function practiceKho_Chunk(rootEl, sessionVocab, poolData, tracker) {
  const withChunk = sessionVocab.filter(w => w.enChunk && w.viChunk);
  const list = withChunk.length ? withChunk : sessionVocab;
  for (const w of list) {
    const enFirst = (w.enChunk || w.word).split("/")[0].trim();
    const viFirst = (w.viChunk || w.meaning).split("/")[0].trim();
    const distractors = buildDistractors({ ...w, enChunk: enFirst }, poolData, { field: "enChunk", count: 3, extra: sessionVocab });
    const finalOptions = distractors.length >= 3 ? distractors : buildDistractors(w, poolData, { field: "word", count: 3, extra: sessionVocab });
    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "kho-chunk",
      instructionText: "Choose the correct English phrase for this Vietnamese phrase!",
      questionHTML: `<div style="font-size:18px;color:#ffd54f;">"${viFirst}"</div>`,
      options: shuffle([enFirst, ...finalOptions]).map(v => ({ label: v, value: v })),
      correctValue: enFirst,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// --- KHÓ — B: Phân biệt từ gần nghĩa ---
async function practiceKho_Distinguish(rootEl, sessionVocab, poolData, tracker) {
  for (const w of sessionVocab) {
    const distractorWords = buildDistractors(w, poolData, { field: "word", count: 3, extra: sessionVocab });
    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "kho-distinguish",
      instructionText: "Which word matches this meaning?",
      questionHTML: `<div style="font-size:18px;color:#ffd54f;">"${w.meaning}"</div>`,
      options: shuffle([w.word, ...distractorWords]).map(v => ({ label: v, value: v })),
      correctValue: w.word,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// E. HÀM CHÍNH — export để orchestrator gọi
// ============================================================================

export async function runIntroModule(ctx) {
  const { sessionVocab, poolData, level, rootEl } = ctx;
  injectSharedStyles();
  injectModule1Styles();

  // 1. Chọn mascot (chỉ hỏi nếu chưa chọn trong buổi này)
  const charInfo = await pickMascotIfNeeded(rootEl);

  // 2. Trình bày từ vựng
  await presentWords(rootEl, sessionVocab, level, charInfo);

  await showTransition("📘", "Let's practice!", "Time to practice what we just learned.");

  // 3. Chọn dạng luyện tập theo cấp độ
  const tracker = createScoreTracker();

  if (level === LEVELS.MAM_NON) {
    await practiceMamNon(rootEl, sessionVocab, poolData, tracker);
  } else if (level === LEVELS.DE) {
    const micOk = await isMicrophoneAvailable();
    const candidates = micOk
      ? [() => practiceDe_Phonics(rootEl, sessionVocab, poolData, tracker), () => practiceDe_Repeat(rootEl, sessionVocab, tracker)]
      : [() => practiceDe_Phonics(rootEl, sessionVocab, poolData, tracker)];
    await randomPick(candidates)();
  } else if (level === LEVELS.TRUNG_BINH) {
    const candidates = [
      () => practiceTB_Dialogue(rootEl, sessionVocab, poolData, tracker),
      () => practiceTB_GuessMeaning(rootEl, sessionVocab, poolData, tracker),
    ];
    await randomPick(candidates)();
  } else if (level === LEVELS.KHO) {
    const candidates = [
      () => practiceKho_Chunk(rootEl, sessionVocab, poolData, tracker),
      () => practiceKho_Distinguish(rootEl, sessionVocab, poolData, tracker),
    ];
    await randomPick(candidates)();
  }

  // 4. Lưu điểm đánh giá (không tính retry) vào đúng key cũ
  saveIntroResult(tracker.assessScore, tracker.total);

  await showTransition("🎉", "Awesome!", "You've learned all the new words today!");
}