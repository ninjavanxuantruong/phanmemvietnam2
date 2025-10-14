// file: test-mcq.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// Firebase config (yours)
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

// Google Sheets sources (same pattern as bạn dùng)
const SHEET_BAI_HOC =
  "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
const SHEET_TU_VUNG =
  "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

// Helpers: parse Google Visualization JSON
async function fetchGviz(url) {
  const res = await fetch(url);
  const txt = await res.text();
  return JSON.parse(txt.substring(47).slice(0, -2));
}

// Get max lesson for selected class
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

// Fetch vocab up to max lesson; ensure non-duplicate words
async function fetchVocab(maxLessonCode) {
  const json = await fetchGviz(SHEET_TU_VUNG);
  const rows = json.table.rows.slice(1); // skip header row
  const items = [];

  rows.forEach(r => {
    const rawCode = r.c[1]?.v?.toString().trim();  // column B = lesson code
    const word = r.c[2]?.v?.toString().trim();     // column C = word
    const meaning = r.c[24]?.v?.toString().trim(); // column Y(25) = meaning

    const normalizedCode = parseInt(rawCode?.replace(/\D/g, ""), 10);
    if (!normalizedCode || normalizedCode > maxLessonCode) return;
    if (!word || !meaning) return;

    items.push({ word, meaning });
  });

  return items;
}

// Pick N unique words; if not enough, stop at max available (no duplicates)
function pickUniqueQuestions(vocabItems, count) {
  const uniqueByWord = new Map();
  for (const it of vocabItems) {
    if (!uniqueByWord.has(it.word)) uniqueByWord.set(it.word, it);
  }
  const all = Array.from(uniqueByWord.values());
  const shuffled = all.sort(() => Math.random() - 0.5);
  return shuffled.slice(0, count); // if not enough, slice returns fewer (no duplicates)
}

// Build MCQ questions for Firestore
function buildMcq(allRows, picked) {
  // Prepare a pool of other meanings for distractors
  const allMeanings = allRows
    .map(r => r.c[24]?.v?.toString().trim())
    .filter(m => !!m);

  return picked.map((item, idx) => {
    const wrongPool = allMeanings.filter(m => m !== item.meaning);
    const wrongOptions = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [...wrongOptions, item.meaning].sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(item.meaning);

    return {
      id: `q${idx + 1}`,
      prompt: `Nghĩa của "${item.word}" là gì?`,
      choices,
      correctIndex
    };
  });
}

// Compose docId = test-{class}-{ddmmyyyy}
function makeDocId(classId) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `test-${classId}-${dd}${mm}${yyyy}`;
}

async function saveTest() {
  const classId = document.getElementById("classSelect").value;
  const mcqCount = parseInt(document.getElementById("mcqCount").value, 10);

  // 1) Find max lesson for class
  const maxLesson = await fetchMaxLessonCode(classId);
  if (!maxLesson) {
    alert("⚠️ Không tìm thấy bài học hợp lệ cho lớp đã chọn.");
    return;
  }

  // 2) Fetch vocab and full rows for distractors
  const vocabJson = await fetchGviz(SHEET_TU_VUNG);
  const allRows = vocabJson.table.rows.slice(1);
  const vocabItems = allRows
    .map(r => {
      const rawCode = r.c[1]?.v?.toString().trim();
      const word = r.c[2]?.v?.toString().trim();
      const meaning = r.c[24]?.v?.toString().trim();
      const normalizedCode = parseInt(rawCode?.replace(/\D/g, ""), 10);
      return (!normalizedCode || normalizedCode > maxLesson || !word || !meaning)
        ? null
        : { word, meaning };
    })
    .filter(Boolean);

  // 3) Pick unique words up to mcqCount
  const picked = pickUniqueQuestions(vocabItems, mcqCount);
  if (picked.length < mcqCount) {
    alert(`⚠️ Chỉ có ${picked.length} từ không trùng để tạo câu hỏi (yêu cầu ${mcqCount}). Sẽ lưu bấy nhiêu.`);
  }

  // 4) Build MCQ
  const mcq = buildMcq(allRows, picked);

  // 5) Save single doc with expireAt in 48h
  const docId = makeDocId(classId);
  const expireAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);

  await setDoc(doc(db, "test", docId), {
    meta: {
      class: classId,
      date: docId.split("-").pop(), // ddmmyyyy
      createdAt: serverTimestamp(),
      expireAt
    },
    mcq,
    pronunciation: [], // placeholders for later types
    sentence: [],
    listening: [],
    speaking: []
  });

  alert(`✅ Đã lưu đề: ${docId} (MCQ: ${mcq.length} câu)`);
}

async function viewTest() {
  const classId = document.getElementById("classSelect").value;
  const docId = makeDocId(classId);
  const snap = await getDoc(doc(db, "test", docId));
  if (!snap.exists()) {
    alert("❌ Không tìm thấy đề kiểm tra đã lưu.");
    return;
  }
  document.getElementById("resultBox").textContent = JSON.stringify(snap.data(), null, 2);
}

// Wire up buttons
document.getElementById("saveTestBtn").addEventListener("click", () => {
  saveTest().catch(err => {
    console.error(err);
    alert("❌ Lỗi khi lưu đề, kiểm tra console.");
  });
});
document.getElementById("viewTestBtn").addEventListener("click", () => {
  viewTest().catch(err => {
    console.error(err);
    alert("❌ Lỗi khi đọc đề, kiểm tra console.");
  });
});
