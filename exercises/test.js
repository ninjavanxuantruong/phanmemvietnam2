// file: test.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

import { phonicsBank } from "./phonics-bank.js";

const firebaseConfig = {
  apiKey: "AIzaSyBQ1pPmSdBV8M8YdVbpKhw_DOetmzIMwXU",
  authDomain: "lop-hoc-thay-tinh.firebaseapp.com",
  projectId: "lop-hoc-thay-tinh",
  storageBucket: "lop-hoc-thay-tinh.firebasestorage.app",
  messagingSenderId: "391812475288",
  appId: "1:391812475288:web:ca4c275ac776d69deb23ed"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Sheets
const SHEET_BAI_HOC =
  "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
const SHEET_TU_VUNG =
  "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

/* ================= Helpers: sheets ================= */
async function fetchGviz(url) {
  const res = await fetch(url);
  const txt = await res.text();
  return JSON.parse(txt.substring(47).slice(0, -2));
}

async function fetchAllClassIds() {
  const json = await fetchGviz(SHEET_BAI_HOC);
  const rows = json.table.rows;
  const set = new Set();
  rows.forEach(r => {
    const lop = r.c[0]?.v?.toString().trim();
    if (lop) set.add(lop);
  });
  return [...set].sort();
}

async function fetchMaxLessonCode(classId) {
  const json = await fetchGviz(SHEET_BAI_HOC);
  const rows = json.table.rows;
  const baiList = rows
    .map(r => {
      const lop = r.c[0]?.v?.toString().trim();
      const bai = r.c[2]?.v?.toString().trim();
      return lop === classId ? parseInt(bai, 10) : null;
    })
    .filter(n => Number.isFinite(n));
  if (baiList.length === 0) return 0;
  return Math.max(...baiList);
}

async function fetchVocabRows(maxLessonCode) {
  const json = await fetchGviz(SHEET_TU_VUNG);
  const rows = json.table.rows.slice(1);

  const filtered = rows.filter(r => {
    const rawCode = r.c[1]?.v?.toString().trim();   // B: lesson code
    const word = r.c[2]?.v?.toString().trim();      // C: word
    const meaning = r.c[24]?.v?.toString().trim();  // Y: meaning
    const normalizedCode = parseInt(rawCode?.replace(/\D/g, ""), 10);
    return normalizedCode && normalizedCode <= maxLessonCode && !!word && !!meaning;
  });

  const byWord = new Map();
  filtered.forEach(r => {
    const word = r.c[2]?.v?.toString().trim();
    if (!word) return;
    const question = r.c[9]?.v?.toString().trim() || "";   // J
    const answer   = r.c[11]?.v?.toString().trim() || "";  // L
    const meaning  = r.c[24]?.v?.toString().trim() || "";
    byWord.set(word, { question, answer, meaning });
  });

  return { filteredRows: filtered, byWord };
}

/* ================= Helpers: builders (unchanged logic) ================= */
function pickUniqueWords(filteredRows, count) {
  const uniqueWords = [];
  const seen = new Set();
  const shuffled = [...filteredRows].sort(() => Math.random() - 0.5);
  for (const r of shuffled) {
    const w = r.c[2]?.v?.toString().trim();
    if (w && !seen.has(w)) {
      seen.add(w);
      uniqueWords.push(w);
      if (uniqueWords.length >= count) break;
    }
  }
  return uniqueWords;
}

function buildMcq(filteredRows, pickedWords, byWord) {
  const allMeanings = filteredRows.map(r => r.c[24]?.v?.toString().trim()).filter(Boolean);
  return pickedWords.map((word, idx) => {
    const meaning = byWord.get(word)?.meaning || "";
    const wrongPool = allMeanings.filter(m => m && m !== meaning);
    const wrongOptions = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [...wrongOptions, meaning].sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(meaning);
    return { id: `q${idx + 1}`, word, prompt: `Nghĩa của "${word}" là gì?`, choices, correctIndex };
  }).filter(q => q.choices?.length === 4 && q.correctIndex >= 0);
}

function buildListening(filteredRows, pickedWords, byWord) {
  const allWordsPool = filteredRows.map(r => r.c[2]?.v?.toString().trim()).filter(Boolean);
  return pickedWords.map((word, idx) => {
    const meta = byWord.get(word);
    const question = meta?.question || "";
    const answer   = meta?.answer || "";
    if (!question || !answer) return null;
    const wrongPool = allWordsPool.filter(w => w && w !== word);
    const wrongOptions = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [...wrongOptions, word].sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(word);
    return { id: `lq${idx + 1}`, prompt: "Nghe và chọn từ đúng", audioText: word, question, answer, choices, correctIndex };
  }).filter(Boolean);
}

function normSentence(s) {
  return (s || "").toLowerCase().replace(/[.,;'\)\(]/g, "").replace(/\s+/g, " ").trim();
}
function tokenizeWords(answer) {
  return normSentence(answer).split(" ").filter(Boolean);
}
function buildSentence(filteredRows, count) {
  const items = [];
  const seen = new Set();
  filteredRows.forEach(r => {
    const qRaw = r.c[9]?.v?.toString().trim();
    const aRaw = r.c[11]?.v?.toString().trim();
    if (!qRaw || !aRaw) return;
    const aNorm = normSentence(aRaw);
    if (seen.has(aNorm)) return;
    seen.add(aNorm);
    const tokens = tokenizeWords(aRaw);
    if (tokens.length > 1) items.push({ question: qRaw, answer: aRaw, tokens });
  });
  const shuffled = items.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);
  return picked.map((it, idx) => ({ id: `s${idx + 1}`, question: it.question, answer: it.answer, tokens: it.tokens }));
}

function normalizeUnitId(unitStr) {
  if (!unitStr) return 0;
  const parts = unitStr.split("-");
  if (parts.length < 3) return 0;
  const [cls, lesson, part] = parts;
  return parseInt(cls) * 1000 + parseInt(lesson) * 10 + parseInt(part);
}
function buildSpeaking(filteredRows, count) {
  const allItems = filteredRows.map(r => {
    const lessonName = r.c[1]?.v?.toString().trim() || "";
    const presentation = r.c[8]?.v?.toString().trim() || "";
    const unitNum = normalizeUnitId(lessonName);
    return { lessonName, unitNum, presentation };
  }).filter(it => it.lessonName && it.presentation);

  const unitMap = {};
  allItems.forEach(it => {
    if (!unitMap[it.lessonName]) unitMap[it.lessonName] = [];
    unitMap[it.lessonName].push(it);
  });

  const unitNames = Object.keys(unitMap);
  const shuffled = unitNames.sort(() => Math.random() - 0.5);
  const pickedUnits = shuffled.slice(0, count);

  const selectedItems = [];
  pickedUnits.forEach(u => {
    const rows = unitMap[u];
    selectedItems.push(rows[Math.floor(Math.random() * rows.length)]);
  });
  selectedItems.sort((a, b) => a.unitNum - b.unitNum);

  const paragraph = selectedItems.map(it => it.presentation).join(". ").replace(/\s+\./g, ".").trim();
  const finalParagraph = paragraph ? (paragraph.endsWith(".") ? paragraph : paragraph + ".") : "";
  return { paragraph: finalParagraph, count: selectedItems.length };
}

function buildPhonics(bank, count) {
  const filtered = bank.filter(it => !["unit7", "unit8", "unit9", "unit10", "unit11"].includes(it.unit));
  const allIpa = [...new Set(filtered.map(it => it.ipa).filter(Boolean))];
  const shuffled = [...filtered].sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);
  return picked.map((item, idx) => {
    const correct = item.ipa;
    const wrongPool = allIpa.filter(ipa => ipa !== correct);
    const wrongChoices = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [...wrongChoices, correct].sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(correct);
    return { id: `p${idx + 1}`, word: item.word, prompt: `IPA của từ "${item.word}" là gì?`, choices, correctIndex };
  });
}

function makeDocId(classId) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `test-${classId}-${dd}${mm}${yyyy}`;
}
function formatTimestamp(ts) {
  if (!ts?.seconds) return "-";
  const d = new Date(ts.seconds * 1000 + Math.round((ts.nanoseconds || 0) / 1e6));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}
function esc(s) {
  return (s || "").toString().replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
}

/* ================= Text-to-speech ================= */
function speak(text) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.92;
  window.speechSynthesis.speak(u);
}

/* ================= Word-match scoring (for sentence & speaking) ================= */
function wordMatch(targetText, spokenText) {
  const t = normSentence(targetText).split(" ").filter(Boolean);
  const s = normSentence(spokenText).split(" ").filter(Boolean);
  const pool = {};
  s.forEach(w => { pool[w] = (pool[w] || 0) + 1; });
  let matched = 0;
  const matchArr = t.map(w => {
    if (pool[w] > 0) { pool[w]--; matched++; return true; }
    return false;
  });
  return { fraction: t.length ? matched / t.length : 0, matchArr, targetWords: t };
}

/* ================= Tabs ================= */
const tabs = document.querySelectorAll(".tab");
tabs.forEach(btn => {
  btn.addEventListener("click", () => {
    tabs.forEach(b => { b.classList.remove("active"); b.setAttribute("aria-selected", "false"); });
    btn.classList.add("active"); btn.setAttribute("aria-selected", "true");
    document.querySelectorAll(".view").forEach(v => v.classList.remove("active"));
    document.getElementById(btn.dataset.view).classList.add("active");
  });
});

/* ================= Class picker ================= */
const classSelect = document.getElementById("classSelect");
(async function initClasses() {
  try {
    const ids = await fetchAllClassIds();
    classSelect.innerHTML = ids.length
      ? ids.map(id => `<option value="${esc(id)}">${esc(id)}</option>`).join("")
      : `<option value="">— không có lớp —</option>`;
  } catch (e) {
    console.error(e);
    classSelect.innerHTML = `<option value="">— lỗi tải lớp —</option>`;
  }
})();

/* ================= COMPOSE: generate / preview / save ================= */
let currentDraft = null; // { classId, mcq, listening, sentence, speaking, pronunciation }

const generateBtn = document.getElementById("generateBtn");
const saveBtn = document.getElementById("saveBtn");
const composeStatus = document.getElementById("composeStatus");
const draftPreview = document.getElementById("draftPreview");

function setStatus(el, text, kind) {
  el.textContent = text;
  el.className = "status" + (kind ? " " + kind : "");
}

generateBtn.addEventListener("click", async () => {
  const classId = classSelect.value;
  if (!classId) { setStatus(composeStatus, "⚠️ Hãy chọn lớp trước.", "err"); return; }

  const mcqCount = parseInt(document.getElementById("mcqCount").value, 10) || 0;
  const listeningCount = parseInt(document.getElementById("listeningCount").value, 10) || 0;
  const pronunciationCount = parseInt(document.getElementById("pronunciationCount").value, 10) || 0;
  const sentenceCount = parseInt(document.getElementById("sentenceCount").value, 10) || 0;
  const speakingCount = parseInt(document.getElementById("speakingCount").value, 10) || 0;

  generateBtn.disabled = true;
  saveBtn.disabled = true;
  setStatus(composeStatus, "⏳ Đang tạo đề...", "");
  draftPreview.classList.add("hidden");

  try {
    const maxLesson = await fetchMaxLessonCode(classId);
    if (!maxLesson) {
      setStatus(composeStatus, "⚠️ Không tìm thấy bài học hợp lệ cho lớp đã chọn.", "err");
      return;
    }
    const { filteredRows, byWord } = await fetchVocabRows(maxLesson);

    const pickedForMcq = pickUniqueWords(filteredRows, mcqCount);
    const pickedForListening = pickUniqueWords(filteredRows, listeningCount);

    const mcq = buildMcq(filteredRows, pickedForMcq, byWord);
    const listening = buildListening(filteredRows, pickedForListening, byWord);
    const sentence = buildSentence(filteredRows, sentenceCount);
    const speaking = buildSpeaking(filteredRows, speakingCount);
    const pronunciation = buildPhonics(phonicsBank, pronunciationCount);

    currentDraft = { classId, mcq, listening, sentence, speaking, pronunciation };
    renderDraftPreview(currentDraft);
    saveBtn.disabled = false;
    setStatus(composeStatus, "✅ Đã tạo đề — xem thử bên dưới. Không ưng thì Tạo đề lại.", "ok");
  } catch (e) {
    console.error(e);
    setStatus(composeStatus, "❌ Lỗi khi tạo đề.", "err");
  } finally {
    generateBtn.disabled = false;
  }
});

function renderDraftPreview(draft) {
  let html = `<div class="paper-head">
      <h2>📘 Đề thử — Lớp ${esc(draft.classId)}</h2>
      <div class="paper-meta">Bản xem trước (chưa lưu) — hiển thị kèm đáp án để giáo viên kiểm tra</div>
    </div>`;

  html += sectionPreviewMcq("📝 Trắc nghiệm nghĩa từ", "MCQ", draft.mcq);
  html += sectionPreviewListening(draft.listening);
  html += sectionPreviewSentence(draft.sentence);
  html += sectionPreviewSpeaking(draft.speaking);
  html += sectionPreviewMcq("🔊 Phát âm (IPA)", "PHONICS", draft.pronunciation);

  draftPreview.innerHTML = html;
  draftPreview.classList.remove("hidden");
}

function sectionPreviewMcq(title, tag, items) {
  if (!items?.length) return "";
  let html = `<div class="section-block"><div class="section-title">${title} <span class="eyebrow">${items.length} câu</span></div>`;
  items.forEach((q, i) => {
    html += `<div class="q"><div class="q-prompt">${i + 1}. ${esc(q.prompt)}</div>
      <div class="key-choices">${q.choices.map((c, ci) => `<span class="${ci === q.correctIndex ? "right" : ""}">${String.fromCharCode(65 + ci)}. ${esc(c)}</span>`).join(" &nbsp;·&nbsp; ")}</div></div>`;
  });
  html += `</div>`;
  return html;
}
function sectionPreviewListening(items) {
  if (!items?.length) return "";
  let html = `<div class="section-block"><div class="section-title">🎧 Nghe chọn từ <span class="eyebrow">${items.length} câu</span></div>`;
  items.forEach((q, i) => {
    html += `<div class="q"><div class="q-prompt">${i + 1}. (đọc từ: <em>${esc(q.audioText)}</em>) — ${esc(q.question)}</div>
      <div class="key-choices">${q.choices.map((c, ci) => `<span class="${ci === q.correctIndex ? "right" : ""}">${String.fromCharCode(65 + ci)}. ${esc(c)}</span>`).join(" &nbsp;·&nbsp; ")}</div>
      <div class="key-answer">Trả lời mẫu: ${esc(q.answer)}</div></div>`;
  });
  html += `</div>`;
  return html;
}
function sectionPreviewSentence(items) {
  if (!items?.length) return "";
  let html = `<div class="section-block"><div class="section-title">🧩 Ghép câu <span class="eyebrow">${items.length} câu</span></div>`;
  items.forEach((q, i) => {
    html += `<div class="q"><div class="q-prompt">${i + 1}. ${esc(q.question)}</div>
      <div class="key-answer">Đáp án: ${esc(q.answer)}</div></div>`;
  });
  html += `</div>`;
  return html;
}
function sectionPreviewSpeaking(sp) {
  if (!sp?.paragraph) return "";
  return `<div class="section-block"><div class="section-title">🗣 Đoạn nói <span class="eyebrow">ghép từ ${sp.count} câu</span></div>
    <div class="q"><div class="q-prompt">${esc(sp.paragraph)}</div></div></div>`;
}

saveBtn.addEventListener("click", async () => {
  if (!currentDraft) return;
  saveBtn.disabled = true;
  setStatus(composeStatus, "⏳ Đang lưu...", "");
  try {
    const docId = makeDocId(currentDraft.classId);
    const expireAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);
    await setDoc(doc(db, "test", docId), {
      meta: { class: currentDraft.classId, date: docId.split("-").pop(), createdAt: serverTimestamp(), expireAt },
      mcq: currentDraft.mcq,
      listening: currentDraft.listening,
      sentence: currentDraft.sentence,
      speaking: currentDraft.speaking,
      pronunciation: currentDraft.pronunciation
    });
    setStatus(composeStatus, `✅ Đã lưu đề: ${docId}`, "ok");
  } catch (e) {
    console.error(e);
    setStatus(composeStatus, "❌ Lỗi khi lưu đề.", "err");
    saveBtn.disabled = false;
  }
});

/* ================= TAKE TEST: load / render / answer / grade ================= */
const loadTestBtn = document.getElementById("loadTestBtn");
const loadStatus = document.getElementById("loadStatus");
const examPaperEl = document.getElementById("examPaper");
const resultPanelEl = document.getElementById("resultPanel");

let examData = null;
let examMeta = null;
let answers = { mcq: {}, listening: {}, sentence: {}, pronunciation: {}, speaking: { transcript: "" } };

loadTestBtn.addEventListener("click", async () => {
  const classId = classSelect.value;
  if (!classId) { setStatus(loadStatus, "⚠️ Hãy chọn lớp trước.", "err"); return; }
  loadTestBtn.disabled = true;
  setStatus(loadStatus, "⏳ Đang tải đề...", "");
  resultPanelEl.classList.add("hidden");
  examPaperEl.classList.add("hidden");
  try {
    const docId = makeDocId(classId);
    const snap = await getDoc(doc(db, "test", docId));
    if (!snap.exists()) {
      setStatus(loadStatus, "❌ Chưa có đề hôm nay cho lớp này.", "err");
      return;
    }
    examData = snap.data();
    examMeta = { docId };
    answers = { mcq: {}, listening: {}, sentence: {}, pronunciation: {}, speaking: { transcript: "" } };
    renderExamPaper(examData, docId);
    setStatus(loadStatus, "✅ Đã tải đề, chúc làm bài tốt!", "ok");
  } catch (e) {
    console.error(e);
    setStatus(loadStatus, "❌ Lỗi khi tải đề.", "err");
  } finally {
    loadTestBtn.disabled = false;
  }
});

function renderExamPaper(data, docId) {
  let html = `<div class="paper-head">
      <h2>📘 Bài kiểm tra — Lớp ${esc(data.meta?.class)}</h2>
      <div class="paper-meta">Ngày ${esc(data.meta?.date)} · Mã đề ${esc(docId)}</div>
    </div>`;

  if (data.mcq?.length) html += renderMcqBlock("📝 Trắc nghiệm nghĩa từ", "mcq", data.mcq);
  if (data.listening?.length) html += renderListeningBlock(data.listening);
  if (data.sentence?.length) html += renderSentenceBlock(data.sentence);
  if (data.speaking?.paragraph) html += renderSpeakingBlock(data.speaking);
  if (data.pronunciation?.length) html += renderMcqBlock("🔊 Phát âm (IPA)", "pronunciation", data.pronunciation);

  html += `<div class="submit-row"><button type="submit" class="btn btn-pen">✅ Nộp bài</button></div>`;

  examPaperEl.innerHTML = html;
  examPaperEl.classList.remove("hidden");
  wireMcqChoices(examPaperEl);
  wireSentenceBlocks(examPaperEl);
  wireSpeakingBlock(examPaperEl);

  examPaperEl.onsubmit = (e) => { e.preventDefault(); gradeAndShowResults(); };
}

function renderMcqBlock(title, sectionKey, items) {
  let html = `<div class="section-block"><div class="section-title">${title} <span class="eyebrow">${items.length} câu</span></div>`;
  items.forEach((q, i) => {
    html += `<div class="q" data-section="${sectionKey}" data-id="${q.id}">
      <div class="q-prompt">${i + 1}. ${esc(q.prompt)}</div>
      <div class="choices">${q.choices.map((c, ci) => `<button type="button" class="choice" data-index="${ci}">${String.fromCharCode(65 + ci)}. ${esc(c)}</button>`).join("")}</div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

function renderListeningBlock(items) {
  let html = `<div class="section-block"><div class="section-title">🎧 Nghe chọn từ <span class="eyebrow">${items.length} câu</span></div>`;
  items.forEach((q, i) => {
    html += `<div class="q" data-section="listening" data-id="${q.id}">
      <div class="q-prompt">${i + 1}. ${esc(q.question)}</div>
      <button type="button" class="play-btn" data-audio="${esc(q.audioText)}">🔊 Nghe từ</button>
      <div class="choices">${q.choices.map((c, ci) => `<button type="button" class="choice" data-index="${ci}">${String.fromCharCode(65 + ci)}. ${esc(c)}</button>`).join("")}</div>
    </div>`;
  });
  html += `</div>`;
  return html;
}

function renderSentenceBlock(items) {
  let html = `<div class="section-block"><div class="section-title">🧩 Ghép câu <span class="eyebrow">${items.length} câu</span></div>`;
  items.forEach((q, i) => {
    const shuffled = [...q.tokens].sort(() => Math.random() - 0.5);
    html += `<div class="q sentence-q" data-section="sentence" data-id="${q.id}" data-tokens='${esc(JSON.stringify(q.tokens))}'>
      <div class="q-prompt">${i + 1}. ${esc(q.question)}</div>
      <div class="sentence-answer" data-role="answer"></div>
      <div class="sentence-bank" data-role="bank">${shuffled.map(t => `<button type="button" class="token">${esc(t)}</button>`).join("")}</div>
      <button type="button" class="mini-reset">↺ làm lại câu này</button>
    </div>`;
  });
  html += `</div>`;
  return html;
}

function renderSpeakingBlock(sp) {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return `<div class="section-block speaking-block" data-section="speaking">
    <div class="section-title">🗣 Nói theo đoạn văn <span class="eyebrow">ghép từ ${sp.count} câu</span></div>
    <div class="q-prompt">Đọc to đoạn văn dưới đây, sau đó bấm micro để chấm điểm phát âm:</div>
    <div class="paragraph-text" data-role="paragraph-display">${sp.paragraph.split(" ").map(w => `<span class="w">${esc(w)}</span>`).join(" ")}</div>
    ${SR ? `
      <div class="rec-controls">
        <button type="button" class="rec-btn" data-role="rec-toggle">🎙️ Bắt đầu ghi âm</button>
        <span class="transcript" data-role="transcript">Chưa ghi âm.</span>
      </div>` : `<div class="no-support">Trình duyệt này không hỗ trợ nhận diện giọng nói (hãy dùng Chrome trên máy tính/điện thoại).</div>`}
  </div>`;
}

/* ---- wiring ---- */
function wireMcqChoices(root) {
  root.querySelectorAll(".q[data-section]").forEach(qEl => {
    const section = qEl.dataset.section;
    if (section === "sentence" || section === "speaking") return;
    qEl.querySelectorAll(".choice").forEach(btn => {
      btn.addEventListener("click", () => {
        qEl.querySelectorAll(".choice").forEach(b => b.classList.remove("selected"));
        btn.classList.add("selected");
        answers[section][qEl.dataset.id] = parseInt(btn.dataset.index, 10);
      });
    });
  });
  root.querySelectorAll(".play-btn").forEach(btn => {
    btn.addEventListener("click", () => speak(btn.dataset.audio));
  });
}

function wireSentenceBlocks(root) {
  root.querySelectorAll(".sentence-q").forEach(qEl => {
    const id = qEl.dataset.id;
    const answerEl = qEl.querySelector('[data-role="answer"]');
    const bankEl = qEl.querySelector('[data-role="bank"]');
    answers.sentence[id] = [];

    function placeToken(tokenBtn, word) {
      tokenBtn.disabled = true;
      const placed = document.createElement("button");
      placed.type = "button";
      placed.className = "token placed";
      placed.textContent = word;
      placed.addEventListener("click", () => {
        placed.remove();
        tokenBtn.disabled = false;
        rebuildFromDom();
      });
      answerEl.appendChild(placed);
      rebuildFromDom();
    }
    function rebuildFromDom() {
      answers.sentence[id] = [...answerEl.querySelectorAll(".token")].map(b => b.textContent);
    }

    bankEl.querySelectorAll(".token").forEach(tokenBtn => {
      tokenBtn.addEventListener("click", () => placeToken(tokenBtn, tokenBtn.textContent));
    });

    qEl.querySelector(".mini-reset").addEventListener("click", () => {
      answerEl.innerHTML = "";
      bankEl.querySelectorAll(".token").forEach(b => b.disabled = false);
      answers.sentence[id] = [];
    });
  });
}

function wireSpeakingBlock(root) {
  const block = root.querySelector('.speaking-block');
  if (!block) return;
  const toggleBtn = block.querySelector('[data-role="rec-toggle"]');
  if (!toggleBtn) return; // not supported
  const transcriptEl = block.querySelector('[data-role="transcript"]');
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const recognizer = new SR();
  recognizer.lang = "en-US";
  recognizer.continuous = true;
  recognizer.interimResults = true;

  let finalTranscript = "";
  let recording = false;

  recognizer.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const chunk = event.results[i][0].transcript;
      if (event.results[i].isFinal) finalTranscript += chunk + " ";
      else interim += chunk;
    }
    answers.speaking.transcript = finalTranscript.trim();
    transcriptEl.textContent = (finalTranscript + interim).trim() || "Đang nghe...";
  };
  recognizer.onend = () => {
    recording = false;
    toggleBtn.textContent = "🎙️ Ghi âm lại";
    toggleBtn.classList.remove("recording");
  };
  recognizer.onerror = () => {
    recording = false;
    toggleBtn.textContent = "🎙️ Ghi âm lại";
    toggleBtn.classList.remove("recording");
  };

  toggleBtn.addEventListener("click", () => {
    if (recording) {
      recognizer.stop();
    } else {
      finalTranscript = "";
      answers.speaking.transcript = "";
      transcriptEl.textContent = "Đang nghe...";
      recording = true;
      toggleBtn.textContent = "⏹️ Dừng ghi âm";
      toggleBtn.classList.add("recording");
      recognizer.start();
    }
  });
}

/* ================= Grading ================= */
function gradeAndShowResults() {
  let earned = 0;
  let total = 0;
  const reviewHtml = [];

  // MCQ
  if (examData.mcq?.length) {
    const { html, correct } = gradeMcqLike(examData.mcq, answers.mcq, "📝 Trắc nghiệm nghĩa từ");
    reviewHtml.push(html);
    earned += correct; total += examData.mcq.length;
  }
  // Listening
  if (examData.listening?.length) {
    const { html, correct } = gradeMcqLike(examData.listening, answers.listening, "🎧 Nghe chọn từ");
    reviewHtml.push(html);
    earned += correct; total += examData.listening.length;
  }
  // Pronunciation
  if (examData.pronunciation?.length) {
    const { html, correct } = gradeMcqLike(examData.pronunciation, answers.pronunciation, "🔊 Phát âm (IPA)");
    reviewHtml.push(html);
    earned += correct; total += examData.pronunciation.length;
  }
  // Sentence
  if (examData.sentence?.length) {
    let sectionScore = 0;
    let block = `<div class="section-block"><div class="section-title">🧩 Ghép câu</div>`;
    examData.sentence.forEach((q, i) => {
      const studentTokens = answers.sentence[q.id] || [];
      const correctTokens = q.tokens;
      let matches = 0;
      correctTokens.forEach((w, idx) => { if (studentTokens[idx] === w) matches++; });
      const frac = correctTokens.length ? matches / correctTokens.length : 0;
      sectionScore += frac;
      const isFull = frac === 1;
      block += `<div class="review-item">
        <span class="mark ${isFull ? "ok" : "no"}">${isFull ? "✓" : "✗"}</span>
        <strong>${i + 1}. ${esc(q.question)}</strong>
        <div class="review-note">Bạn ghép: ${esc(studentTokens.join(" ") || "(bỏ trống)")}</div>
        <div class="key-answer">Đáp án đúng: ${esc(q.answer)} — ${Math.round(frac * 100)}%</div>
      </div>`;
    });
    block += `</div>`;
    reviewHtml.push(block);
    earned += sectionScore; total += examData.sentence.length;
  }
  // Speaking
  if (examData.speaking?.paragraph) {
    const transcript = answers.speaking.transcript || "";
    const { fraction, matchArr, targetWords } = wordMatch(examData.speaking.paragraph, transcript);
    earned += fraction; total += 1;
    const highlighted = targetWords.map((w, i) => `<span class="w ${matchArr[i] ? "matched" : "missed"}">${esc(w)}</span>`).join(" ");
    reviewHtml.push(`<div class="section-block"><div class="section-title">🗣 Nói theo đoạn văn</div>
      <div class="review-note">Bạn đã nói: <em>${esc(transcript) || "(không ghi nhận được)"}</em></div>
      <div class="paragraph-text">${highlighted}</div>
      <div class="key-answer">Khớp: ${Math.round(fraction * 100)}%</div>
    </div>`);
  }

  const scoreOn10 = total ? Math.round((earned / total) * 100) / 10 : 0;
  renderResults(scoreOn10, reviewHtml.join(""));
}

function gradeMcqLike(items, given, title) {
  let correct = 0;
  let html = `<div class="section-block"><div class="section-title">${title}</div>`;
  items.forEach((q, i) => {
    const chosen = given[q.id];
    const isCorrect = chosen === q.correctIndex;
    if (isCorrect) correct++;
    html += `<div class="review-item">
      <span class="mark ${isCorrect ? "ok" : "no"}">${isCorrect ? "✓" : "✗"}</span>
      <strong>${i + 1}. ${esc(q.prompt)}</strong>
      <div class="choices">${q.choices.map((c, ci) => {
        let cls = "choice";
        if (ci === q.correctIndex) cls += " correct-answer";
        else if (ci === chosen) cls += " wrong-answer";
        return `<span class="${cls}">${String.fromCharCode(65 + ci)}. ${esc(c)}</span>`;
      }).join("")}</div>
    </div>`;
  });
  html += `</div>`;
  return { html, correct };
}

function renderResults(scoreOn10, reviewHtml) {
  examPaperEl.classList.add("hidden");
  resultPanelEl.innerHTML = `
    <div class="score-stamp"><span class="num">${scoreOn10}</span><span class="lbl">/ 10</span></div>
    <div class="paper-head"><h2>Kết quả bài làm</h2><div class="paper-meta">Chấm tự động — xem chi tiết từng câu bên dưới</div></div>
    ${reviewHtml}
    <div class="submit-row"><button type="button" class="btn btn-ghost" id="retakeBtn">↺ Làm lại đề này</button></div>
  `;
  resultPanelEl.classList.remove("hidden");
  document.getElementById("retakeBtn").addEventListener("click", () => {
    answers = { mcq: {}, listening: {}, sentence: {}, pronunciation: {}, speaking: { transcript: "" } };
    resultPanelEl.classList.add("hidden");
    renderExamPaper(examData, examMeta.docId);
  });
  resultPanelEl.scrollIntoView({ behavior: "smooth", block: "start" });
}
