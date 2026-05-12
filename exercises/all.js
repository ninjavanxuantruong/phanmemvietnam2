/**
 * all.js — PokéLearn All-in-One
 * Quy trình: vocabulary → vocabulary2 → image(d1,d2,d3) → pokeword → listening1 → speaking-sentence → overview(d1,d2,d3)
 * Điểm lưu đúng key như các file gốc để summary.js đọc được.
 */

import { showVictoryEffect } from "./effect-win.js";
import { showDefeatEffect }  from "./effect-loose.js";
import { prefetchImagesBatch, getImageFromMap } from "./imageCache.js";

// ─── DANH SÁCH CÁC STAGE (theo thứ tự quy trình) ───────────────────────────
const STAGES = [
  { id: "vocab1",       label: "📘 Từ vựng 1",       emoji: "📘" },
  { id: "vocab2",       label: "🎯 Từ vựng 2",       emoji: "🎯" },
  { id: "image_d1",    label: "🧠 Hình ảnh – Dạng 1", emoji: "🧠" },
  { id: "image_d2",    label: "🖼️ Hình ảnh – Dạng 2", emoji: "🖼️" },
  { id: "image_d3",    label: "🎨 Hình ảnh – Dạng 3", emoji: "🎨" },
  { id: "pokeword",    label: "🔤 PokéWord",           emoji: "🔤" },
  { id: "listening1",  label: "🎧 Nghe",              emoji: "🎧" },
  { id: "speaking",    label: "🎙️ Nói câu",           emoji: "🎙️" },
  { id: "overview_d1", label: "✍️ Tổng quan – Sắp xếp","emoji": "✍️" },
  { id: "overview_d2", label: "🔤 Tổng quan – Dịch từ","emoji": "🔤" },
  { id: "overview_d3", label: "🧱 Tổng quan – Dịch cụm","emoji": "🧱" },
  { id: "communication", label: "💬 Giao tiếp", emoji: "💬" },
];

// ─── STATE TOÀN CỤC ──────────────────────────────────────────────────────────
const wordBank   = JSON.parse(localStorage.getItem("wordBank")) || [];
let vocabData    = [];   // dùng chung cho vocab1, vocab2, image
let stageIndex   = 0;
let vocabVoice   = null;

// Score trackers cho từng stage
const scoreState = {
  vocab1:      { score: 0, total: 0 },
  vocab2:      { score: 0, total: 0 },
  image_d1:    { score: 0, total: 0 },
  image_d2:    { score: 0, total: 0 },
  image_d3:    { score: 0, total: 0 },
  pokeword:    { score: 0, total: 0 },
  listening1:  { score: 0, total: 0 },
  speaking:    { score: 0, total: 0 },
  overview_d1: { score: 0, total: 0 },
  overview_d2: { score: 0, total: 0 },
  overview_d3: { score: 0, total: 0 },
};

// ─── HELPERS ─────────────────────────────────────────────────────────────────
function shuffle(arr) { return [...arr].sort(() => Math.random() - 0.5); }
function normSentence(s) {
  return (s || "").toLowerCase().replace(/[.,;'\)\(]/g,"").replace(/\s+/g," ").trim();
}
function speak(text, rate = 1) {
  if (!text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang  = "en-US";
  u.voice = vocabVoice;
  u.rate  = rate;
  window.speechSynthesis.speak(u);
}

// ─── VOICE INIT ───────────────────────────────────────────────────────────────
function initVoice() {
  return new Promise(resolve => {
    const v = speechSynthesis.getVoices();
    if (v.length) { applyVoice(v); return resolve(); }
    speechSynthesis.onvoiceschanged = () => { applyVoice(speechSynthesis.getVoices()); resolve(); };
  });
}
function applyVoice(voices) {
  vocabVoice =
    voices.find(v => v.lang === "en-US" && v.name?.toLowerCase().includes("zira")) ||
    voices.find(v => v.lang === "en-US") || null;
}

// ─── PROGRESS UI ─────────────────────────────────────────────────────────────
function updateProgress() {
  const pct = Math.round((stageIndex / STAGES.length) * 100);
  const progressBar = document.getElementById("progressBar");
  if (progressBar) progressBar.style.width = pct + "%";

  const wrap = document.getElementById("progressSteps");
  wrap.innerHTML = STAGES.map((s, i) => {
    const cls = i < stageIndex ? "done" : i === stageIndex ? "active" : "";

    // Lấy tên rút gọn (bỏ phần sau dấu gạch ngang nếu có)
    const shortLabel = s.label.split("–")[0].trim();

    return `<span class="step-dot ${cls}" 
                  onclick="jumpToStage(${i})" 
                  style="cursor:pointer;" 
                  title="Nhấn để nhảy đến: ${s.label}">
              ${s.emoji} ${shortLabel}
            </span>`;
  }).join("");

  const label = document.getElementById("stageLabel");
  if (label) label.textContent = STAGES[stageIndex]?.label || "✅ Hoàn thành!";
}
window.jumpToStage = async function(idx) {
  // Nếu bấm vào chính Stage đang học thì không làm gì
  if (idx === stageIndex) return; 

  const targetStage = STAGES[idx];
  if (confirm(`Bạn muốn nhảy thẳng tới phần: ${targetStage.label}?`)) {
    // Lưu chỉ số Stage muốn tới vào localStorage
    localStorage.setItem("jump_to_stage_idx", idx);

    // Hiển thị màn hình chuyển cảnh trước khi reload
    await showTransition(targetStage.emoji, "🚀 Dịch chuyển", `Đang đưa bạn đến ${targetStage.label}...`);

    // Tải lại trang để reset toàn bộ hệ thống voice/mic/state
    location.reload();
  }
};

function updateMiniScore(score, total) {
  document.getElementById("miniScore").textContent = `🎯 ${score}/${total}`;
}

// ─── TRANSITION SCREEN ───────────────────────────────────────────────────────
function showTransition(emoji, title, desc) {
  return new Promise(resolve => {
    const ts = document.getElementById("transitionScreen");
    document.getElementById("transEmoji").textContent  = emoji;
    document.getElementById("transTitle").textContent   = title;
    document.getElementById("transDesc").textContent    = desc;
    ts.classList.add("show");
    document.getElementById("nextStageBtn").onclick = () => {
      ts.classList.remove("show");
      resolve();
    };
  });
}

// ─── RENDER HELPER ───────────────────────────────────────────────────────────
function setCard(html) {
  document.getElementById("mainCard").innerHTML = html;
}

// ─── FETCH DATA ───────────────────────────────────────────────────────────────
async function fetchAllVocabData() {
  // 1. Kiểm tra xem trong máy đã có dữ liệu chưa
  const cachedData = localStorage.getItem("vocab_data_cache");
  if (cachedData) {
    console.log("🚀 Dùng dữ liệu từ Cache (Local)");
    return JSON.parse(cachedData);
  }

  try {
    console.log("🌐 Đang tải dữ liệu từ Google Sheets...");
    const res = await fetch(window.SHEET_URL);
    const data = await res.json();
    const rows = data.data || data;

    const allWords = rows.map(r => {
      const col = Object.values(r);
      const getVal = idx => (col[idx] != null ? col[idx].toString().trim() : "");
      return {
        word: getVal(2),
        meaning: getVal(24),
        extraNote: getVal(30),
        noteAH: getVal(33),
        noteAI: getVal(34),
        imageKeyword: getVal(47),
        question: getVal(9),
        answerRaw: getVal(11),
        enChunk: getVal(3),
        viChunk: getVal(4),
      };
    });

    const filtered = allWords.filter(it => it.word && wordBank.includes(it.word));
    const seen = new Set();
    const finalData = filtered.filter(it => {
      const k = it.word.toLowerCase();
      if (seen.has(k)) return false;
      seen.add(k); return true;
    });

    // 2. LƯU VÀO CACHE để lần sau không phải tải nữa
    localStorage.setItem("vocab_data_cache", JSON.stringify(finalData));

    return finalData;
  } catch(e) {
    console.error("fetchAllVocabData Error:", e);
    return [];
  }
}

async function getMaxLessonCode() {
  const trainerClass = localStorage.getItem("trainerClass")?.trim() || "";
  try {
    const res  = await fetch(window.SHEET_BAI_HOC);
    const rows = await res.json();
    const list = rows.map(r => {
      const lop = (r[0] || "").toString().trim();
      const bai = (r[2] || "").toString().trim();
      return lop === trainerClass && bai ? parseInt(bai, 10) : null;
    }).filter(v => typeof v === "number" && !isNaN(v));
    return list.length ? Math.max(...list) : 0;
  } catch { return 0; }
}

// ─── PHONETIC ────────────────────────────────────────────────────────────────
async function getPhonetic(phrase) {
  if (!phrase) return "";
  const words = phrase.trim().split(/\s+/);
  const fetch1 = async w => {
    try {
      const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${w.toLowerCase()}`);
      if (!r.ok) return "";
      const d = await r.json();
      return d?.[0]?.phonetic || d?.[0]?.phonetics?.find(p => p.text)?.text || "";
    } catch { return ""; }
  };
  const results = await Promise.all(words.map(fetch1));
  return results.filter(Boolean).join(" ");
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 1 — VOCABULARY 1 (Bản chuẩn cho giao diện All-in-One)
// ═══════════════════════════════════════════════════════════════════════════
async function runVocab1() {
  const data = vocabData;
  let idx = 0;
  let roundCount = 0;
  let listenCount = 0;
  const REQUIRED = 1;

  const saveResult = (sc, tot) => {
    const raw = localStorage.getItem("result_vocabulary");
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem("result_vocabulary", JSON.stringify({
      ...prev, scoreV1: sc, totalV1: tot,
      score: sc + (prev.scoreV2 || 0),
      total: tot + (prev.totalV2 || 0)
    }));
  };

  const render = async () => {
    const w = data[idx];
    const cleanWord = w.word.trim();
    const phonetic = await getPhonetic(cleanWord);
    const imgKey = (w.imageKeyword || cleanWord).toLowerCase().trim();
    const imgSrc = getImageFromMap(imgKey) || "";

    // Lấy ghi chú bổ trợ
    const note1 = w.noteAH || "";
    const note2 = w.noteAI || "";

    const wordsHTML = cleanWord.split(" ").map(part =>
      `<span data-word="${part}" class="vocab-tap">${part.toUpperCase()}</span>`
    ).join("");

    // Render giao diện vào #mainCard
    setCard(`
      <div style="margin-bottom:12px;color:var(--poke-yellow);font-size:13px;font-weight:bold;">
        📘 PHẦN 1: TỪ VỰNG &nbsp;|&nbsp; ${idx+1}/${data.length} &nbsp;|&nbsp; Vòng ${roundCount+1}
      </div>
      <div class="vocab-row">
        <div class="vocab-image-frame">
          <img class="main-img" src="${imgSrc}" alt="" ${imgSrc ? "" : "style='display:none'"} />
          <img class="corner-ball tl" src="https://cdn-icons-png.flaticon.com/512/361/361998.png"/>
          <img class="corner-ball tr" src="https://cdn-icons-png.flaticon.com/512/361/361998.png"/>
          <img class="corner-ball bl" src="https://cdn-icons-png.flaticon.com/512/361/361998.png"/>
          <img class="corner-ball br" src="https://cdn-icons-png.flaticon.com/512/361/361998.png"/>
        </div>

        <div class="vocab-info">
          <div class="vocab-word-area" id="vw1WordArea">${wordsHTML}</div>

          <style>
            #v1PhonicsContainer .syllable-wrapper {
              flex: 0 0 auto !important; /* Tuyệt đối không cho co lại */
              min-width: 100px !important; /* Chiều ngang tối thiểu để chữ rõ ràng */
              margin: 5px !important;
              transform: scale(1) !important; /* Giữ kích thước chuẩn */
            }
            #v1PhonicsContainer .sound-unit {
              width: 100% !important;
              padding: 8px !important;
            }
          </style>

          <div id="v1PhonicsContainer" style="display:flex; flex-wrap:wrap; gap:8px; margin-bottom:15px; justify-content: flex-start;"></div>

          <div class="vocab-phonetic">${phonetic || "/.../"}</div>
          <div class="vocab-meaning">${w.meaning || "Chưa có nghĩa"}</div>

          ${(note1 || note2) ? `
            <div style="margin-top:15px; padding:12px; border-radius:12px; background:rgba(255,255,255,0.05); border:1px dashed var(--poke-yellow); text-align: left;">
              ${note1 ? `<p style="margin:4px 0; color:#ff7675; font-size:14px; font-weight:bold;">💡 ${note1}</p>` : ""}
              ${note2 ? `<p style="margin:4px 0; color:#74b9ff; font-size:14px; font-style:italic;">✨ ${note2}</p>` : ""}
            </div>
          ` : ""}

          <div style="margin-top:18px; display:flex; gap:12px; align-items:center; justify-content: flex-start;">
            <button class="poke-btn yellow" id="v1PlayBtn">🔊 Nghe</button>
            <button class="poke-btn red" id="v1NextBtn" disabled>⏭️ Next</button>
          </div>
        </div>
      </div>
    `);

    // Kích hoạt máy tách âm ngay khi card vừa dựng xong
    const pContainer = document.getElementById("v1PhonicsContainer");
    if (pContainer && window.handleSplit) {
      window.handleSplit(cleanWord.toLowerCase(), pContainer, null);
    }

    listenCount = 0;

    // Click từng từ đọc chậm (0.3 rate)
    document.querySelectorAll(".vocab-tap").forEach(span => {
      span.onclick = () => {
        if (typeof speak === "function") speak(span.dataset.word, 0.3);
        else {
           const u = new SpeechSynthesisUtterance(span.dataset.word);
           u.rate = 0.3;
           speechSynthesis.cancel();
           speechSynthesis.speak(u);
        }
      };
    });

    // Nút nghe chính
    document.getElementById("v1PlayBtn").onclick = () => {
      const u = new SpeechSynthesisUtterance(cleanWord);
      u.voice = (typeof vocabVoice !== 'undefined') ? vocabVoice : null;
      u.onend = () => {
        listenCount++;
        if (listenCount >= REQUIRED) document.getElementById("v1NextBtn").disabled = false;
      };
      window.speechSynthesis.cancel();
      window.speechSynthesis.speak(u);
    };

    // Nút chuyển từ
    document.getElementById("v1NextBtn").onclick = async () => {
      idx++;
      if (idx >= data.length) { idx = 0; roundCount++; }

      if (roundCount >= 2) {
        const sc = data.length > 0 ? 10 : 0;
        if (typeof scoreState !== "undefined") scoreState.vocab1 = { score: sc, total: 10 };
        saveResult(sc, 10);
        updateMiniScore(sc, 10);
        await showTransition("🎉", "Hoàn thành Từ vựng 1!", "Chuẩn bị sang phần tiếp theo nhé!");
        if (window._resolveVocab1) { window._resolveVocab1(); window._resolveVocab1 = null; }
        return;
      }
      render();
    };

    updateMiniScore(roundCount * data.length + idx, data.length * 2);
  };

  return new Promise(resolve => {
    window._resolveVocab1 = resolve;
    render();
  });
}


// ═══════════════════════════════════════════════════════════════════════════
// STAGE 2 — VOCABULARY 2 (Pokéball bắt từ — text mode thay vì animation)
// ═══════════════════════════════════════════════════════════════════════════
async function runVocab2() {
  const data = shuffle(vocabData);
  let caught = 0;
  let speakScore = parseInt(localStorage.getItem("speaking_score_v2") || "0");

  const saveResult = (sc, tot) => {
    const raw  = localStorage.getItem("result_vocabulary");
    const prev = raw ? JSON.parse(raw) : {};
    localStorage.setItem("result_vocabulary", JSON.stringify({
      ...prev, scoreV2: sc, totalV2: tot,
      score: (prev.scoreV1 || 0) + sc,
      total: (prev.totalV1 || 0) + tot
    }));
  };

  return new Promise(resolve => {
    const showItem = () => {
      if (caught >= data.length) {
        const tot = data.length * 2;
        scoreState.vocab2 = { score: speakScore, total: tot };
        saveResult(speakScore, tot);
        localStorage.removeItem("speaking_score_v2");
        updateMiniScore(speakScore, tot);
        showTransition("✅","Hoàn thành Từ vựng 2!","Tiếp tục sang phần Hình ảnh!").then(resolve);
        return;
      }

      const item   = data[caught];
      const imgSrc = getImageFromMap(item.word) || "";

      setCard(`
        <div style="margin-bottom:12px;color:var(--poke-yellow);font-size:13px;">
          🎯 Từ vựng 2 &nbsp;|&nbsp; ${caught+1}/${data.length}
        </div>
        <div style="text-align:center;margin-bottom:16px;">
          ${imgSrc ? `<img src="${imgSrc}" style="max-width:200px;border-radius:12px;"/>` : ""}
          <div style="font-size:20px;margin:10px 0;">${item.meaning || "?"}</div>
          <button class="poke-btn yellow" id="v2ListenBtn">🔊 Nghe câu hỏi</button>
        </div>
        <div style="text-align:center;margin-top:10px;">
          <button class="poke-btn blue" id="v2SpeakBtn">
            <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" style="width:36px;vertical-align:middle"/> 🎤 Nói từ
          </button>
          <button class="poke-btn gray" id="v2SkipBtn" style="margin-left:10px;">⏭ Bỏ qua</button>
        </div>
        <div id="v2SpeechResult" style="margin-top:12px;text-align:center;font-size:16px;color:#ffd54f;"></div>
      `);

      document.getElementById("v2ListenBtn").onclick = () => speak(item.question || item.word);

      document.getElementById("v2SkipBtn").onclick = () => { caught++; showItem(); };

      document.getElementById("v2SpeakBtn").onclick = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) { alert("Thiết bị không hỗ trợ ghi âm."); caught++; showItem(); return; }
        const rec = new SR();
        rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
        document.getElementById("v2SpeechResult").textContent = "🎙️ Đang nghe...";
        rec.start();
        rec.onresult = e => {
          const tr  = e.results[0][0].transcript.toLowerCase().trim();
          const tgt = item.word.toLowerCase().replace(/[^a-z0-9'\s]/g,"");
          const sc  = tr.includes(tgt) ? 2 : 0;
          speakScore += sc;
          localStorage.setItem("speaking_score_v2", speakScore);
          document.getElementById("v2SpeechResult").innerHTML =
            `🗣️ Bạn nói: "<i>${tr}</i>" — ${sc === 2 ? "✅ +2" : "❌ 0"} điểm`;
          setTimeout(() => { caught++; showItem(); }, 1400);
        };
        rec.onerror = () => { caught++; showItem(); };
      };

      updateMiniScore(caught, data.length);
    };

    showItem();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 3-5 — IMAGE D1, D2, D3
// ═══════════════════════════════════════════════════════════════════════════
function saveImageResult(part, sc, tot) {
  const raw  = localStorage.getItem("result_image");
  const prev = raw ? JSON.parse(raw) : {};
  const u = {
    score1: part===1?sc:prev.score1||0, total1: part===1?tot:prev.total1||0,
    score2: part===2?sc:prev.score2||0, total2: part===2?tot:prev.total2||0,
    score3: part===3?sc:prev.score3||0, total3: part===3?tot:prev.total3||0,
  };
  localStorage.setItem("result_image", JSON.stringify({ ...u,
    score: u.score1+u.score2+u.score3, total: u.total1+u.total2+u.total3 }));
}

async function runImageD1() {
  const data = shuffle([...vocabData]);
  let idx = 0, score = 0;

  return new Promise(resolve => {
    const show = () => {
      if (idx >= data.length) {
        scoreState.image_d1 = { score, total: data.length };
        saveImageResult(1, score, data.length);
        updateMiniScore(score, data.length);
        showTransition("🧠","Xong Dạng 1 Hình ảnh!","Tiếp tục Dạng 2...").then(resolve);
        return;
      }
      const cur     = data[idx];
      const wrong   = data.filter(d => d.word !== cur.word);
      const options = shuffle([cur, ...wrong.slice(0,3)]);
      speak(cur.word);

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          🧠 Hình ảnh – Dạng 1 &nbsp;|&nbsp; ${idx+1}/${data.length} &nbsp;|&nbsp; Điểm: ${score}
        </div>
        <button class="poke-btn blue" id="id1Play" style="margin-bottom:14px;">🔊 Nghe lại</button>
        <div class="img-grid" id="id1Grid"></div>
        <div class="result-msg" id="id1Result"></div>
      `);

      document.getElementById("id1Play").onclick = () => speak(cur.word);

      const grid = document.getElementById("id1Grid");
      options.forEach(item => {
        const imgUrl = getImageFromMap(item.word) || "";
        const card = document.createElement("div");
        card.className = "img-card";
        card.innerHTML = `${imgUrl?`<img src="${imgUrl}" alt=""/>`:`<div style="height:100px;background:rgba(255,255,255,0.1);border-radius:8px;"></div>`}<p>${item.meaning}</p>`;
        card.onclick = () => {
          const r = document.getElementById("id1Result");
          if (item.word === cur.word) {
            score++; r.textContent = "✅ Chính xác!"; r.className = "result-msg ok";
          } else {
            r.textContent = `❌ Sai. Đáp án: ${cur.word}`; r.className = "result-msg err";
          }
          grid.querySelectorAll(".img-card").forEach(c => c.onclick = null);
          idx++; setTimeout(show, 1200);
        };
        grid.appendChild(card);
      });
      updateMiniScore(score, idx+1);
    };
    show();
  });
}

async function runImageD2() {
  const data = shuffle([...vocabData]);
  let idx = 0, score = 0;

  return new Promise(resolve => {
    const show = () => {
      if (idx >= data.length) {
        scoreState.image_d2 = { score, total: data.length };
        saveImageResult(2, score, data.length);
        updateMiniScore(score, data.length);
        showTransition("🖼️","Xong Dạng 2 Hình ảnh!","Tiếp tục Dạng 3 (khó nhất)...").then(resolve);
        return;
      }
      const cur     = data[idx];
      const imgUrl  = getImageFromMap(cur.word) || "";
      const wrong   = data.filter(d => d.word !== cur.word);
      const options = shuffle([cur.word, ...wrong.map(d=>d.word).slice(0,3)]);

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          🖼️ Hình ảnh – Dạng 2 &nbsp;|&nbsp; ${idx+1}/${data.length} &nbsp;|&nbsp; Điểm: ${score}
        </div>
        <div style="text-align:center;margin-bottom:14px;">
          ${imgUrl?`<img src="${imgUrl}" style="max-width:260px;border-radius:12px;"/>`:
          `<div style="width:260px;height:160px;background:rgba(255,255,255,0.1);border-radius:12px;margin:auto;"></div>`}
        </div>
        <button class="poke-btn blue" id="id2Play" style="margin-bottom:10px;">🔊 Nghe từ</button>
        <div class="choice-list" id="id2Choices"></div>
        <div class="result-msg" id="id2Result"></div>
      `);

      document.getElementById("id2Play").onclick = () => speak(cur.word);

      const box = document.getElementById("id2Choices");
      options.forEach((w,i) => {
        const btn = document.createElement("button");
        btn.className = "choice-btn";
        btn.textContent = `${String.fromCharCode(65+i)}. ${w}`;
        btn.onclick = () => {
          const r = document.getElementById("id2Result");
          if (w === cur.word) { score++; r.textContent="✅ Chính xác!"; r.className="result-msg ok"; }
          else { r.textContent=`❌ Sai. Đáp án: ${cur.word}`; r.className="result-msg err"; }
          box.querySelectorAll(".choice-btn").forEach(b => b.onclick=null);
          idx++; setTimeout(show, 1400);
        };
        box.appendChild(btn);
      });
      updateMiniScore(score, idx+1);
    };
    show();
  });
}

async function runImageD3() {
  const data = shuffle([...vocabData]);
  let idx = 0, score = 0;
  let answered = false;

  return new Promise(resolve => {
    const show = () => {
      answered = false;
      if (idx >= data.length) {
        scoreState.image_d3 = { score, total: data.length };
        saveImageResult(3, score, data.length);
        updateMiniScore(score, data.length);
        showTransition("🎨","Xong cả 3 dạng Hình ảnh!","Tiếp tục PokéWord!").then(resolve);
        return;
      }
      const cur    = data[idx];
      const imgUrl = getImageFromMap(cur.word) || "";

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          🎨 Hình ảnh – Dạng 3 &nbsp;|&nbsp; ${idx+1}/${data.length} &nbsp;|&nbsp; Điểm: ${score}
        </div>
        <div style="text-align:center;margin-bottom:14px;">
          <img src="${imgUrl}" id="id3Img" style="max-width:260px;border-radius:12px;filter:blur(4px);transition:0.4s;"/>
        </div>
        <div style="text-align:center;margin-bottom:10px;">
          <input type="text" id="id3Input" placeholder="Gõ từ tiếng Anh..." 
            style="padding:10px;font-size:16px;border-radius:10px;width:70%;max-width:280px;background:rgba(255,255,255,0.1);border:2px solid rgba(255,203,5,0.4);color:#fff;"/>
        </div>
        <div style="text-align:center;">
          <button class="poke-btn yellow" id="id3Submit">✅ Trả lời</button>
          <button class="poke-btn blue"   id="id3Play"   style="margin-left:8px;">🔊</button>
        </div>
        <div class="result-msg" id="id3Result"></div>
      `);

      document.getElementById("id3Play").onclick = () => speak(cur.word);
      document.getElementById("id3Submit").onclick = () => {
        if (answered) return;
        answered = true;
        document.getElementById("id3Submit").disabled = true;
        const val = (document.getElementById("id3Input").value||"").trim().toLowerCase();
        const img = document.getElementById("id3Img");
        if (img) img.style.filter = "none";
        const r = document.getElementById("id3Result");
        if (val === cur.word.toLowerCase()) {
          score++; r.textContent=`✅ Chính xác! ${cur.word}: ${cur.meaning}`; r.className="result-msg ok";
        } else {
          r.innerHTML=`❌ Sai. Đáp án: <b>${cur.word}</b> — ${cur.meaning}`; r.className="result-msg err";
        }
        idx++; setTimeout(show, 2000);
      };
      document.getElementById("id3Input").onkeydown = e => {
        if (e.key === "Enter") document.getElementById("id3Submit").click();
      };
      updateMiniScore(score, idx+1);
    };
    show();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 6 — POKEWORD
// ═══════════════════════════════════════════════════════════════════════════
function saveGameResult(sc, tot) {
  const raw  = localStorage.getItem("result_game");
  const prev = raw ? JSON.parse(raw) : {};
  localStorage.setItem("result_game", JSON.stringify({
    ...prev, scoreGame3: sc, totalGame3: tot,
    score: (prev.scoreGame1||0)+(prev.scoreGame2||0)+sc,
    total: (prev.totalGame1||0)+(prev.totalGame2||0)+tot
  }));
}

async function runPokeword() {
  const raw       = JSON.parse(localStorage.getItem("wordBank")) || [];
  const timeLimit = 20;
  let words       = [];
  let idx         = 0;
  let score       = 0;
  let timerExp    = false;
  let timer;

  // Fetch pokeword words
  try {
    const res  = await fetch(window.SHEET_URL);
    const rows = await res.json();
    const clean = w => w.replace(/[^a-zA-Z]/g,"").toUpperCase();
    const mapped = rows.map(r => ({
      word:    clean((r[2]||"").toString()),
      meaning: (r[24]||"").toString().trim()
    })).filter(it => raw.some(c => clean(c) === it.word));
    const seen = new Set();
    const unique = mapped.filter(it => { if(seen.has(it.word)) return false; seen.add(it.word); return true; });
    words = shuffle([...unique, ...unique]); // double
  } catch(e) { console.error(e); }

  if (!words.length) {
    await showTransition("⚠️","PokéWord","Không có từ. Bỏ qua.");
    return;
  }

  const getMissing = len => shuffle(Array.from({length:len},(_,i)=>i)).slice(0, Math.floor(len/2));

  return new Promise(resolve => {
    const renderWord = () => {
      clearInterval(timer);
      timerExp = false;
      if (idx >= words.length) {
        scoreState.pokeword = { score, total: words.length };
        saveGameResult(score, words.length);
        updateMiniScore(score, words.length);
        showTransition("🔤","Xong PokéWord!","Tiếp tục phần Nghe!").then(resolve);
        return;
      }
      const wObj    = words[idx];
      const letters = wObj.word.split("");
      const missing = getMissing(letters.length);

      const cellsHTML = letters.map((ch,i) => {
        if (missing.includes(i)) {
          return `<div class="pw-cell"><input type="text" maxlength="1" class="pw-input" /></div>`;
        }
        return `<div class="pw-cell">${ch}</div>`;
      }).join("");

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          🔤 PokéWord &nbsp;|&nbsp; ${idx+1}/${words.length} &nbsp;|&nbsp; Điểm: ${score}
        </div>
        <div style="font-size:17px;margin-bottom:6px;">💡 <span id="pwHintBox"></span></div>
        <div style="color:#fdd835;font-size:18px;margin-bottom:10px;">
          ⏱ <span id="pwTimer">${timeLimit}</span>s
        </div>
        <div class="pw-grid">${cellsHTML}</div>
        <div style="margin-top:14px;display:flex;gap:10px;flex-wrap:wrap;">
          <button class="poke-btn green"  id="pwSubmit">✅ Xác nhận</button>
          <button class="poke-btn yellow" id="pwHint">🔍 Gợi ý</button>
        </div>
        <div class="result-msg" id="pwResult"></div>
      `);

      // Tự động focus ô nhập đầu tiên
      const firstInput = document.querySelector(".pw-input");
      if (firstInput) firstInput.focus();

      // Timer
      let sec = timeLimit;
      timer = setInterval(() => {
        sec--;
        const el = document.getElementById("pwTimer");
        if (el) el.textContent = sec;
        if (sec <= 0) { clearInterval(timer); timerExp = true; }
      }, 1000);

      document.getElementById("pwHint").onclick = () => {
        const h = document.getElementById("pwHintBox");
        if (h) h.textContent = `📘 ${wObj.meaning}`;
      };

      const checkAnswer = () => {
        const cells = document.querySelectorAll(".pw-cell");
        let guess = "";
        cells.forEach(cell => {
          const inp = cell.querySelector("input");
          guess += inp ? (inp.value||"_").toUpperCase() : cell.textContent.toUpperCase();
        });
        const r = document.getElementById("pwResult");
        if (guess === wObj.word) {
          if (!timerExp) { score++; r.textContent="✅ Đúng! +1 điểm"; r.className="result-msg ok"; }
          else { r.textContent="✅ Đúng nhưng hết giờ, không cộng điểm."; r.className="result-msg err"; }
        } else {
          r.textContent=`❌ Sai. Đáp án: ${wObj.word}`; r.className="result-msg err";
        }
        clearInterval(timer);
        idx++; setTimeout(renderWord, 1000);
      };

      document.getElementById("pwSubmit").onclick = checkAnswer;

      // Enter để submit
      document.querySelectorAll(".pw-input").forEach((inp, i, all) => {
        inp.oninput = () => { if(inp.value.length===1 && all[i+1]) all[i+1].focus(); };
        inp.onkeydown = e => { if(e.key==="Enter") checkAnswer(); };
      });

      updateMiniScore(score, idx+1);
    };
    renderWord();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 7 — LISTENING 1
// ═══════════════════════════════════════════════════════════════════════════
function saveListeningResult(sc, tot) {
  const raw  = localStorage.getItem("result_listening");
  const prev = raw ? JSON.parse(raw) : {};
  localStorage.setItem("result_listening", JSON.stringify({
    ...prev, score1: sc, total1: tot,
    score: sc+(prev.score2||0)+(prev.score3||0),
    total: tot+(prev.total2||0)+(prev.total3||0)
  }));
}

async function runListening1() {
  let listeningData = [];
  let score = 0;

  try {
    const maxCode = await getMaxLessonCode();
    const res     = await fetch(window.SHEET_URL);
    const rows    = await res.json();
    const wbSet   = new Set(wordBank.map(w=>w.toLowerCase().trim()));

    const normalize = s => (s||"").replace(/\([^)]*\)/g,"").trim();
    const normUnit  = u => { if(!u) return 0; const p=u.split("-"); if(p.length<3) return 0; return parseInt(p[0])*1000+parseInt(p[1])*10+parseInt(p[2]); };

    listeningData = rows.map(r => ({
      q:      normalize((r[9]||"").toString().trim()),
      a:      normalize((r[11]||"").toString().trim()),
      target: (r[2]||"").toString().trim(),
      uNum:   normUnit((r[1]||"").toString().trim())
    })).filter(it =>
      it.q && it.a && it.uNum <= maxCode &&
      wbSet.has(it.target.toLowerCase().trim())
    ).slice(0, 15);
  } catch(e) { console.error("listening fetch:", e); }

  if (!listeningData.length) {
    await showTransition("📭","Listening","Không có dữ liệu. Bỏ qua.");
    return;
  }

  let idx = 0;
  let voiceMale   = vocabVoice;
  let voiceFemale = vocabVoice;

  const voices = speechSynthesis.getVoices();
  voiceMale   = voices.find(v=>v.name.includes("David"))   || vocabVoice;
  voiceFemale = voices.find(v=>v.name.includes("Zira"))    || vocabVoice;

  const speakLine = (text, voice) => {
    if (!text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-US"; u.voice = voice;
    window.speechSynthesis.speak(u);
  };
  const playCon = (q, a) => {
    speakLine(q, voiceMale);
    setTimeout(() => speakLine(a, voiceFemale), 1500);
  };

  return new Promise(resolve => {
    const show = () => {
      if (idx >= listeningData.length) {
        scoreState.listening1 = { score, total: listeningData.length };
        saveListeningResult(score, listeningData.length);
        updateMiniScore(score, listeningData.length);
        showTransition("🎧","Xong phần Nghe!","Tiếp tục phần Luyện nói!").then(resolve);
        return;
      }
      const it = listeningData[idx];
      const regex = new RegExp(`\\b${it.target}\\b`,"gi");
      const dispQ = it.q.replace(regex,"___");
      const dispA = it.a.replace(regex,"___");

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          🎧 Nghe &nbsp;|&nbsp; ${idx+1}/${listeningData.length} &nbsp;|&nbsp; Điểm: ${score}
        </div>
        <div class="dialogue-box">
          <div class="line-q">🗣 ${dispQ}</div>
          <div class="line-a">🗣 ${dispA}</div>
        </div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin-bottom:12px;">
          <button class="poke-btn blue" id="l1Play">🔊 Nghe lại</button>
          <input type="text" id="l1Input" placeholder="Từ bị che là..." 
            style="padding:10px;font-size:16px;border-radius:10px;flex:1;min-width:140px;background:rgba(255,255,255,0.1);border:2px solid rgba(255,203,5,0.4);color:#fff;"/>
          <button class="poke-btn yellow" id="l1Submit">✅ Trả lời</button>
        </div>
        <div class="result-msg" id="l1Result"></div>
      `);

      playCon(it.q, it.a);
      document.getElementById("l1Play").onclick = () => playCon(it.q, it.a);

      const submit = () => {
        const val = (document.getElementById("l1Input").value||"").toLowerCase().replace(/[^a-z0-9]/gi,"").trim();
        const tgt = it.target.toLowerCase().replace(/[^a-z0-9]/gi,"").trim();
        const r   = document.getElementById("l1Result");
        if (val === tgt) { score++; r.textContent="✅ Chính xác!"; r.className="result-msg ok"; }
        else { r.textContent=`❌ Sai. Đáp án: ${it.target}`; r.className="result-msg err"; }
        speakLine(it.target, voiceFemale);
        idx++; setTimeout(show, 2000);
      };

      document.getElementById("l1Submit").onclick = submit;
      document.getElementById("l1Input").onkeydown = e => { if(e.key==="Enter") submit(); };
      updateMiniScore(score, idx+1);
    };
    show();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 8 — SPEAKING SENTENCE
// ═══════════════════════════════════════════════════════════════════════════
function saveSpeakingResult(sc, tot) {
  const raw  = localStorage.getItem("result_speaking");
  const prev = raw ? JSON.parse(raw) : {};
  localStorage.setItem("result_speaking", JSON.stringify({
    ...prev, score2: sc, total2: tot,
    score: (prev.score1||0)+sc+(prev.score3||0),
    total: (prev.total1||0)+tot+(prev.total3||0)
  }));
}

async function runSpeaking() {
  let sentences = [];
  let totalScore = 0;

  const normalizeUnitId = u => { if(!u) return 0; const p=u.split("-"); if(p.length<3) return 0; return parseInt(p[0])*1000+parseInt(p[1])*10+parseInt(p[2]); };

  try {
    const maxCode = await getMaxLessonCode();
    const resBai  = await fetch(window.SHEET_BAI_HOC);
    const rowsBai = await resBai.json();
    const baiList = rowsBai.map(r => { const c=(r[2]||"").toString().trim(); return c?parseInt(c,10):null; }).filter(v=>v!==null&&!isNaN(v));
    const maxLesson = baiList.length ? Math.max(...baiList) : 0;

    const res  = await fetch(window.SHEET_URL);
    const rows = await res.json();
    const wbSet = new Set(wordBank.map(w=>w.toLowerCase().trim()));

    for (const r of rows) {
      const lessonName = (r[1]||"").toString().trim();
      const rawTarget  = (r[2]||"").toString().trim().toLowerCase();
      const rawMeaning = (r[24]||"").toString().trim();
      const q = (r[9]||"").toString().trim();
      const a = (r[11]||"").toString().trim();
      const unitNum = normalizeUnitId(lessonName);
      const targets = rawTarget.split(/[/;,]/).map(t=>t.trim());
      const isLearned  = targets.some(t=>wbSet.has(t));
      const isInLesson = unitNum >= 3011 && unitNum <= maxLesson;
      if (isLearned && isInLesson) {
        const tw = targets.find(t=>wbSet.has(t)) || rawTarget;
        if (q) sentences.push({ text: q, target: tw, meaning: rawMeaning });
        if (a) sentences.push({ text: a, target: tw, meaning: rawMeaning });
      }
    }
  } catch(e) { console.error("speaking fetch:", e); }

  if (!sentences.length) {
    await showTransition("📭","Speaking","Không có câu. Bỏ qua.");
    return;
  }

  let idx = 0;
  return new Promise(resolve => {
    const show = () => {
      if (idx >= sentences.length) {
        scoreState.speaking = { score: totalScore, total: sentences.length };
        saveSpeakingResult(totalScore, sentences.length);
        updateMiniScore(totalScore, sentences.length);
        showTransition("🎙️","Xong phần Nói!","Tiếp tục phần Tổng quan!").then(resolve);
        return;
      }
      const { text, target, meaning } = sentences[idx];
      speak(text);

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          🎙️ Nói câu &nbsp;|&nbsp; ${idx+1}/${sentences.length} &nbsp;|&nbsp; Điểm: ${totalScore}
        </div>
        <div style="font-size:18px;color:#ffd54f;margin-bottom:8px;">
          🔤 <b>${target}</b> <span style="font-size:14px;color:#aaa;">(${meaning})</span>
        </div>
        <div id="allSentenceArea">${text}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;">
          <button class="poke-btn blue" id="spPlay">🔊 Nghe lại</button>
          <button class="poke-btn yellow" id="spRecord">
            <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" style="width:32px;vertical-align:middle"/> Nói
          </button>
          <button class="poke-btn gray" id="spNext">⏩ Tiếp theo</button>
        </div>
        <div class="result-msg" id="spResult" style="margin-top:10px;text-align:center;"></div>
      `);

      document.getElementById("spPlay").onclick = () => speak(text);
      document.getElementById("spNext").onclick = () => { idx++; show(); };

      const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SR) { document.getElementById("spRecord").disabled = true; return; }
      const rec = new SR();
      rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
      document.getElementById("spRecord").onclick = () => {
        document.getElementById("spResult").textContent = "🎙️ Đang nghe...";
        rec.start();
      };
      rec.onresult = e => {
        const tr   = e.results[0][0].transcript.toLowerCase().replace(/[^a-z0-9'\s]/g,"");
        const sent = text.toLowerCase().replace(/[^a-z0-9'\s]/g,"");
        const tw   = sent.split(/\s+/);
        const uw   = tr.split(/\s+/);
        const corr = tw.filter(w=>uw.includes(w)).length;
        const pct  = Math.round((corr/tw.length)*100);
        if (pct >= 50) totalScore++;
        document.getElementById("spResult").innerHTML =
          `🗣️ Bạn: "<i>${tr}</i>" &nbsp; → &nbsp; ${corr}/${tw.length} từ (${pct}%) ${pct>=50?"✅":"❌"}`;
        idx++; setTimeout(show, 2000);
      };
      rec.onerror = () => { idx++; show(); };
      updateMiniScore(totalScore, idx+1);
    };
    show();
  });
}

// ═══════════════════════════════════════════════════════════════════════════
// STAGE 9-11 — OVERVIEW D1, D2, D3
// ═══════════════════════════════════════════════════════════════════════════
let ovData = { word: [], arrange: [], chunks: [] };

async function loadOverviewData() {
  try {
    const res  = await fetch(window.SHEET_URL);
    const data = await res.json();
    const rows = data.data || data;
    const wbSet = new Set(wordBank.map(w=>(w||"").trim()));
    const seenA = new Set();

    ovData.word = []; ovData.arrange = []; ovData.chunks = [];

    rows.forEach(r => {
      const col    = Object.values(r);
      const word   = (col[2]||"").toString().trim();
      if (!word || !wbSet.has(word)) return;

      const vi     = (col[24]||"").toString().trim();
      if (word && vi) ovData.word.push({ en: word, vi });

      const qRaw   = (col[9]||"").toString().trim();
      const aRaw   = (col[11]||"").toString().trim();
      if (qRaw && aRaw) {
        const norm = normSentence(aRaw);
        if (!seenA.has(norm)) { seenA.add(norm); ovData.arrange.push({ q: qRaw, a: norm }); }
      }

      const enRaw  = (col[3]||"").toString().trim();
      const viRaw  = (col[4]||"").toString().trim();
      if (enRaw && viRaw) {
        const ec = enRaw.split("/").map(s=>normSentence(s)).filter(Boolean);
        const vc = viRaw.split("/").map(s=>normSentence(s)).filter(Boolean);
        if (ec.length === vc.length) ovData.chunks.push({ enChunks: ec, viChunks: vc });
      }
    });
  } catch(e) { console.error("loadOverviewData:", e); }
}

function saveOverviewResult(part, sc, tot) {
  const raw  = localStorage.getItem("result_overview");
  const prev = raw ? JSON.parse(raw) : {};
  const u = {
    score1: part===1?sc:prev.score1||0, total1: part===1?tot:prev.total1||0,
    score2: part===2?sc:prev.score2||0, total2: part===2?tot:prev.total2||0,
    score3: part===3?sc:prev.score3||0, total3: part===3?tot:prev.total3||0,
  };
  localStorage.setItem("result_overview", JSON.stringify({ ...u,
    score: u.score1+u.score2+u.score3, total: u.total1+u.total2+u.total3 }));
}

async function runOverviewD1() {
  const data = shuffle(ovData.arrange);
  let idx = 0, score = 0;

  return new Promise(resolve => {
    const show = () => {
      if (idx >= data.length) {
        scoreState.overview_d1 = { score, total: data.length };
        saveOverviewResult(1, score, data.length);
        updateMiniScore(score, data.length);
        showTransition("✍️","Xong Dạng 1 Tổng quan!","Tiếp tục Dạng 2 (Dịch từ)...").then(resolve);
        return;
      }
      const it     = data[idx];
      const tokens = normSentence(it.a).split(" ").filter(Boolean);
      const shuffled = shuffle([...tokens]);

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          ✍️ Sắp xếp câu &nbsp;|&nbsp; ${idx+1}/${data.length} &nbsp;|&nbsp; Điểm: ${score}
        </div>
        <div style="background:rgba(255,255,255,0.07);padding:12px;border-radius:10px;margin-bottom:12px;font-size:17px;">
          💬 ${it.q || "(Sắp xếp thành câu đúng)"}
        </div>
        <div style="margin-bottom:8px;color:#aaa;">Chọn từ để ghép câu:</div>
        <div id="ov1Bank"></div>
        <div style="margin:10px 0;font-size:16px;">📝 Câu của bạn: <span id="ov1Build" style="color:#ffd54f;"></span></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap;">
          <button class="poke-btn yellow"  id="ov1Submit">✅ Kiểm tra</button>
          <button class="poke-btn gray"    id="ov1Undo">↩️ Hoàn tác</button>
          <button class="poke-btn gray"    id="ov1Reset">♻️ Làm lại</button>
          <button class="poke-btn gray"    id="ov1Skip">⏭ Bỏ qua</button>
        </div>
        <div class="result-msg" id="ov1Result"></div>
      `);

      const bankEl  = document.getElementById("ov1Bank");
      const buildEl = document.getElementById("ov1Build");
      const picked  = [];
      let checking  = false;

      shuffled.forEach(tok => {
        const chip = document.createElement("button");
        chip.className = "chip";
        chip.textContent = tok;
        chip.onclick = () => { if(chip.classList.contains("disabled")) return; picked.push(tok); chip.classList.add("disabled"); buildEl.textContent = picked.join(" "); };
        bankEl.appendChild(chip);
      });

      document.getElementById("ov1Undo").onclick = () => {
        if (!picked.length) return;
        const last = picked.pop();
        const chips = bankEl.querySelectorAll(".chip.disabled");
        for (const c of chips) { if (c.textContent===last) { c.classList.remove("disabled"); break; } }
        buildEl.textContent = picked.join(" ");
      };
      document.getElementById("ov1Reset").onclick = () => {
        picked.length = 0;
        bankEl.querySelectorAll(".chip").forEach(c=>c.classList.remove("disabled"));
        buildEl.textContent = "";
      };
      document.getElementById("ov1Skip").onclick = () => { idx++; show(); };
      document.getElementById("ov1Submit").onclick = () => {
        if (checking) return; checking = true;
        document.getElementById("ov1Submit").disabled = true;
        const user = normSentence(picked.join(" "));
        const ans  = normSentence(it.a);
        const r    = document.getElementById("ov1Result");
        if (!user) { r.textContent = "⚠️ Hãy ghép câu trước!"; r.className="result-msg err"; checking=false; document.getElementById("ov1Submit").disabled=false; return; }
        if (user === ans) { score++; r.textContent="✅ Chính xác!"; r.className="result-msg ok"; speak(it.a); }
        else { r.innerHTML=`❌ Sai. Đáp án: <b>${it.a}</b>`; r.className="result-msg err"; }
        idx++; setTimeout(show, 1000);
      };
      updateMiniScore(score, idx+1);
    };
    show();
  });
}

async function runOverviewD2() {
  const data = shuffle(ovData.word);
  let idx = 0, score = 0;

  return new Promise(resolve => {
    const show = () => {
      if (idx >= data.length) {
        scoreState.overview_d2 = { score, total: data.length };
        saveOverviewResult(2, score, data.length);
        updateMiniScore(score, data.length);
        showTransition("🔤","Xong Dạng 2 Tổng quan!","Tiếp tục Dạng 3 (Dịch cụm)...").then(resolve);
        return;
      }
      const it = data[idx];
      let answered = false;

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          🔤 Dịch từ &nbsp;|&nbsp; ${idx+1}/${data.length} &nbsp;|&nbsp; Điểm: ${score}
        </div>
        <div style="background:rgba(255,255,255,0.07);padding:14px;border-radius:10px;font-size:20px;margin-bottom:14px;text-align:center;">
          ${it.vi}
        </div>
        <div style="text-align:center;margin-bottom:10px;">
          <input type="text" id="ov2Input" placeholder="Nhập từ tiếng Anh..." 
            style="padding:10px;font-size:16px;border-radius:10px;width:80%;max-width:300px;background:rgba(255,255,255,0.1);border:2px solid rgba(255,203,5,0.4);color:#fff;"/>
        </div>
        <div style="text-align:center;display:flex;gap:10px;justify-content:center;flex-wrap:wrap;">
          <button class="poke-btn yellow" id="ov2Submit">✅ Trả lời</button>
          <button class="poke-btn gray"   id="ov2Hint">💡 Gợi ý</button>
          <button class="poke-btn gray"   id="ov2Skip">⏭ Bỏ qua</button>
        </div>
        <div class="result-msg" id="ov2Result"></div>
      `);

      const inp = document.getElementById("ov2Input");
      inp.focus();

      const submit = () => {
        if (answered) return; answered = true;
        document.getElementById("ov2Submit").disabled = true;
        const user = normSentence(inp.value);
        const ans  = normSentence(it.en);
        const r    = document.getElementById("ov2Result");
        if (user === ans) { score++; r.textContent="✅ Chính xác!"; r.className="result-msg ok"; speak(it.en); }
        else { r.innerHTML=`❌ Sai. Đáp án: <b>${it.en}</b>`; r.className="result-msg err"; }
        idx++; setTimeout(show, 1000);
      };

      document.getElementById("ov2Submit").onclick = submit;
      inp.onkeydown = e => { if(e.key==="Enter") submit(); };
      document.getElementById("ov2Skip").onclick  = () => { idx++; show(); };
      document.getElementById("ov2Hint").onclick  = () => {
        const r = document.getElementById("ov2Result");
        r.textContent = `💡 Gợi ý: bắt đầu bằng chữ "${(it.en||"").charAt(0).toUpperCase()}"`;
        r.className = "result-msg";
      };
      updateMiniScore(score, idx+1);
    };
    show();
  });
}

async function runOverviewD3() {
  const data = shuffle(ovData.chunks);
  let idx = 0, score = 0;

  return new Promise(resolve => {
    const show = () => {
      if (idx >= data.length) {
        scoreState.overview_d3 = { score, total: data.length };
        saveOverviewResult(3, score, data.length);
        updateMiniScore(score, data.length);
        showTransition("🏆","Hoàn thành tất cả!","Bạn đã xong toàn bộ bài học hôm nay!").then(resolve);
        return;
      }
      const { enChunks, viChunks } = data[idx];
      let answered = false;

      const rowsHTML = viChunks.map((vi, i) =>
        `<div class="pair-row">
          <span class="vi-block">${vi}</span>
          <input class="en-input-ov" type="text" data-ans="${enChunks[i]}" placeholder="Nhập cụm tiếng Anh..." />
        </div>`
      ).join("");

      setCard(`
        <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
          🧱 Dịch cụm &nbsp;|&nbsp; ${idx+1}/${data.length} &nbsp;|&nbsp; Điểm: ${score}
        </div>
        <div>${rowsHTML}</div>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:12px;">
          <button class="poke-btn yellow" id="ov3Submit">✅ Kiểm tra</button>
          <button class="poke-btn gray"   id="ov3Skip">⏭ Bỏ qua</button>
        </div>
        <div class="result-msg" id="ov3Result"></div>
      `);

      document.getElementById("ov3Skip").onclick = () => { idx++; show(); };
      document.getElementById("ov3Submit").onclick = () => {
        if (answered) return; answered = true;
        document.getElementById("ov3Submit").disabled = true;
        const inputs = document.querySelectorAll(".en-input-ov");
        let correct = 0;
        inputs.forEach(inp => {
          const user = normSentence(inp.value);
          const ans  = normSentence(inp.dataset.ans);
          if (user && user === ans) { correct++; inp.classList.add("ok"); }
          else { inp.classList.add("bad"); }
        });
        const ratio = correct / inputs.length;
        const r = document.getElementById("ov3Result");
        if (ratio >= 0.7) { score++; r.textContent=`✅ Đúng ${correct}/${inputs.length} (≥70%) → +1 điểm`; r.className="result-msg ok"; }
        else { r.textContent=`❌ Đúng ${correct}/${inputs.length} (<70%)`; r.className="result-msg err"; }
        idx++; setTimeout(show, 1200);
      };
      updateMiniScore(score, idx+1);
    };
    show();
  });
}
// ═══════════════════════════════════════════════════════════════════════════
// STAGE 12
// ═══════════════════════════════════════════════════════════════════════════
async function runCommunication() {
  const selectedLesson = localStorage.getItem("selectedLesson") || "";
  const toCode = str => (str || "").replace(/[^0-9]/g, "");
  let questionPool = [], score = 0;

  try {
    const res  = await fetch(window.SHEET_URL);
    const rows = await res.json();
    const rawQs = [];
    rows.forEach(row => {
      if (!row || !row[1] || !row[9] || !row[10]) return;
      const fullUnit = row[1].toString().trim();
      if (toCode(fullUnit) !== selectedLesson) return;
      rawQs.push({
        unit:       fullUnit,
        question:   row[9].toString().trim(),
        answer:     row[10].toString().trim(),
        suggestion: row[11] ? row[11].toString().trim() : "",
      });
    });
    const unitMap = new Map();
    rawQs.forEach(item => {
      if (!unitMap.has(item.unit)) unitMap.set(item.unit, []);
      unitMap.get(item.unit).push(item);
    });
    for (const [, qs] of unitMap.entries()) {
      questionPool.push(qs[Math.floor(Math.random() * qs.length)]);
    }
  } catch(e) { console.error("communication fetch:", e); }

  if (!questionPool.length) {
    await showTransition("📭", "Giao tiếp", "Không có câu hỏi cho bài này. Bỏ qua.");
    return;
  }

  setCard(`
    <div style="margin-bottom:10px;color:var(--poke-yellow);font-size:13px;">
      💬 Giao tiếp &nbsp;|&nbsp; 0/${questionPool.length} câu
    </div>
    <div id="commChat" style="background:rgba(255,255,255,0.05);border:2px solid rgba(255,203,5,0.2);
      border-radius:14px;height:300px;overflow-y:auto;padding:14px;margin-bottom:14px;
      font-size:16px;line-height:1.6;display:flex;flex-direction:column;gap:6px;"></div>

    <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
      <button class="poke-btn yellow" id="commRecord" style="font-size:18px;">
        <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" style="width:28px;vertical-align:middle;"/> Trả lời
      </button>
      <button class="poke-btn blue" id="commRepeat">🔊 Đọc lại</button>

      <button class="poke-btn gray" id="commSkip" style="background:#444; color:#ccc; font-size:14px;">⏩ Bỏ qua bài</button>
    </div>
    <div id="commStatus" style="margin-top:8px;font-size:14px;color:#aaa;min-height:20px;"></div>
  `);

  const chatEl      = document.getElementById("commChat");
  const studentName = localStorage.getItem("trainerName") || "Bạn";
  let askedIdx = 0, currentQ = null, waitCorrect = false, lastBotMsg = "";

  const positiveFeedback = ["Great job!", "Well done!", "That's correct!",
    "Excellent!", "Perfect!", "You got it!", "Awesome!", "Spot on!"];
  const normTxt = s => (s || "").trim().replace(/\?$/, "").toLowerCase();

  const addMsg = (sender, text) => {
    const div = document.createElement("div");
    div.style.cssText = `padding:8px 12px;border-radius:10px;max-width:85%;word-wrap:break-word;
      ${sender === "Bot"
        ? "background:rgba(42,117,187,0.25);color:#87ceeb;align-self:flex-start;"
        : "background:rgba(255,203,5,0.15);color:#ffd54f;align-self:flex-end;text-align:right;"}`;
    div.innerHTML = `<b>${sender}:</b> ${text}`;
    chatEl.appendChild(div);
    chatEl.scrollTop = chatEl.scrollHeight;
    if (sender === "Bot") { speak(text, 0.9); lastBotMsg = text; }
  };

  return new Promise(resolve => {
    const askNext = () => {
      if (askedIdx >= questionPool.length) {
        addMsg("Bot", "Congratulations! 🎉 Bạn đã hoàn thành phần Giao tiếp!");
        localStorage.setItem("result_communication", JSON.stringify({ score, total: questionPool.length }));
        updateMiniScore(score, questionPool.length);
        document.getElementById("commRecord").disabled = true;
        setTimeout(async () => {
          await showTransition("🏆", "Xong phần Giao tiếp!", "Bạn đã hoàn thành tất cả!");
          resolve();
        }, 2500);
        return;
      }
      currentQ    = questionPool[askedIdx];
      askedIdx++;
      waitCorrect = false;
      addMsg("Bot", currentQ.question);
      const lbl = document.querySelector("#mainCard div:first-child");
      if (lbl) lbl.textContent = `💬 Giao tiếp | ${askedIdx}/${questionPool.length} câu`;
      updateMiniScore(score, askedIdx);
    };

    const handleInput = input => {
      addMsg(studentName, input);
      const normIn = normTxt(input);

      if (waitCorrect) {
        waitCorrect = false;
        setTimeout(askNext, 500);
        return;
      }

      if (currentQ?.answer) {
        const correctKW = currentQ.answer.split('"')
          .filter((_, i) => i % 2 === 1).map(t => normTxt(t));
        const isOk = correctKW.length > 0
          ? correctKW.some(kw => normIn.includes(kw))
          : normIn.includes(normTxt(currentQ.answer));
        if (isOk) {
          score++;
          addMsg("Bot", positiveFeedback[Math.floor(Math.random() * positiveFeedback.length)]);
          setTimeout(askNext, 800);
          return;
        }
      }

      if (currentQ?.suggestion) {
        addMsg("Bot", `You can say: ${currentQ.suggestion}`);
        waitCorrect = true;
      } else {
        setTimeout(askNext, 500);
      }
    };

    document.getElementById("commRepeat").onclick = () => { if (lastBotMsg) speak(lastBotMsg, 0.9); };

    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SR) {
      const rec = new SR();
      rec.lang = "en-US"; rec.interimResults = false; rec.maxAlternatives = 1;
      document.getElementById("commRecord").onclick = () => {
        document.getElementById("commStatus").textContent = "🎙️ Đang nghe...";
        try { rec.start(); } catch(e) {}
      };
      rec.onresult = e => {
        document.getElementById("commStatus").textContent = "";
        handleInput(e.results[0][0].transcript);
      };
      rec.onerror = e => {
        document.getElementById("commStatus").textContent = `❌ Lỗi mic: ${e.error}`;
      };
    } else {
      document.getElementById("commRecord").disabled = true;
      document.getElementById("commStatus").textContent = "⚠️ Thiết bị không hỗ trợ mic.";
    }

    // Logic cho nút Bỏ qua bài
    document.getElementById("commSkip").onclick = async () => {
      if (confirm("Bạn có chắc chắn muốn bỏ qua phần Giao tiếp này không?")) {
        // Lưu kết quả hiện tại (nếu có)
        localStorage.setItem("result_communication", JSON.stringify({ score, total: questionPool.length }));

        await showTransition("⏩", "Đã bỏ qua!", "Đang chuyển sang phần tiếp theo...");

        // Giải phóng Promise để kết thúc hàm runCommunication
        resolve(); 
      }
    };
    addMsg("Bot", "Hello! Let's practice together! 🎮");
    setTimeout(askNext, 700);
  });
}
// ═══════════════════════════════════════════════════════════════════════════
// ĐIỀU PHỐI CHÍNH
// ═══════════════════════════════════════════════════════════════════════════
const STAGE_RUNNERS = {
  vocab1:       runVocab1,
  vocab2:       runVocab2,
  image_d1:     runImageD1,
  image_d2:     runImageD2,
  image_d3:     runImageD3,
  pokeword:     runPokeword,
  listening1:   runListening1,
  speaking:     runSpeaking,
  overview_d1:  runOverviewD1,
  overview_d2:  runOverviewD2,
  overview_d3:  runOverviewD3,
  communication: runCommunication,
};

async function runAllStages() {
  // KIỂM TRA LỆNH NHẢY BÀI
  const savedIdx = localStorage.getItem("jump_to_stage_idx");
  let startAt = 0;

  if (savedIdx !== null) {
    startAt = parseInt(savedIdx);
    localStorage.removeItem("jump_to_stage_idx"); // Xóa sau khi đã sử dụng
  }

  // Chạy vòng lặp từ vị trí startAt
  for (stageIndex = startAt; stageIndex < STAGES.length; stageIndex++) {
    const stage = STAGES[stageIndex];
    updateProgress();

    const runner = STAGE_RUNNERS[stage.id];
    if (runner) {
        await runner();
    }
  }

  // --- PHẦN KẾT THÚC GIỮ NGUYÊN ---
  stageIndex = STAGES.length;
  updateProgress();
  setCard(`
    <div style="text-align:center;padding:30px;">
      <div style="font-size:64px;">🏆</div>
      <h2 style="color:var(--poke-yellow);">Xuất sắc! Hoàn thành tất cả!</h2>
      <p style="color:#aaa;font-size:16px;">Điểm đã được lưu tự động. Bạn có thể vào Summary để xem tổng kết.</p>
      <a href="summary.html" style="display:inline-block;margin-top:20px;padding:14px 28px;background:var(--poke-yellow);color:#333;font-weight:bold;border-radius:14px;text-decoration:none;font-size:18px;">
        📊 Xem tổng kết
      </a>
    </div>
  `);
  document.getElementById("miniScore").textContent = "🏆 Xong!";
}

// ═══════════════════════════════════════════════════════════════════════════
// KHỞI ĐỘNG
// ═══════════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════════
// KHỞI ĐỘNG
// ═══════════════════════════════════════════════════════════════════════════
(async function init() {
  await initVoice();

  setCard(`<div style="text-align:center;padding:40px;">
    <div style="font-size:48px;animation:bounce 0.8s ease infinite alternate;">📚</div>
    <p style="color:#aaa;margin-top:16px;">Đang tải dữ liệu...</p>
  </div>`);

  if (!wordBank.length) {
    setCard(`<div style="text-align:center;padding:40px;color:#ff6b6b;">
      ⚠️ Chưa có danh sách từ vựng (wordBank).<br/>
      <span style="color:#aaa;font-size:14px;">Hãy chọn từ ở trang danh sách từ trước.</span>
    </div>`);
    return;
  }

  try {
    vocabData = await fetchAllVocabData();
    if (vocabData.length) {
      const keywords = [...new Set(vocabData.flatMap(it => [it.imageKeyword, it.word].filter(Boolean).map(k=>k.toLowerCase().trim())))];
      await prefetchImagesBatch(keywords);
    }
    await loadOverviewData();
  } catch(e) {
    console.error("init error:", e);
  }

  if (!vocabData.length) {
    setCard(`<div style="text-align:center;padding:40px;color:#ff6b6b;">
      ⚠️ Không tải được dữ liệu từ vựng. Kiểm tra kết nối mạng.
    </div>`);
    return;
  }

  // --- SỬA ĐOẠN NÀY ĐỂ KHÔNG HIỆN CHÀO KHI NHẢY BÀI ---
  const isJumping = localStorage.getItem("jump_to_stage_idx"); 

  if (!isJumping) {
    // Chỉ hiện màn chào nếu KHÔNG PHẢI đang thực hiện lệnh nhảy bài
    await showTransition("🎮","Bắt đầu PokéLearn All-in-One!",
      `Hôm nay bạn sẽ học ${vocabData.length} từ qua ${STAGES.length} hoạt động. Sẵn sàng chưa?`);
  }
  // ------------------------------------------------

  await runAllStages();
})();
