// file: test.js (phần 1/2)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore, doc, setDoc, getDoc, serverTimestamp, Timestamp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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

import { phonicsBank } from "./phonics-bank.js";

// Helpers
async function fetchGviz(url) {
  const res = await fetch(url);
  const txt = await res.text();
  return JSON.parse(txt.substring(47).slice(0, -2));
}

// Bài lớn nhất áp dụng chung cho tất cả dạng
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

// Lọc rows theo maxLesson, build map theo từ (word)
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

  // Map theo từ để lấy question/answer/meaning
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

// Pick N unique words
function pickUniqueWords(filteredRows, count) {
  const uniqueWords = [];
  const seen = new Set();
  const shuffled = filteredRows.sort(() => Math.random() - 0.5);
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

// Build MCQ
function buildMcq(filteredRows, pickedWords, byWord) {
  const allMeanings = filteredRows
    .map(r => r.c[24]?.v?.toString().trim())
    .filter(Boolean);

  return pickedWords.map((word, idx) => {
    const meaning = byWord.get(word)?.meaning || "";
    const wrongPool = allMeanings.filter(m => m && m !== meaning);
    const wrongOptions = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [...wrongOptions, meaning].sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(meaning);

    return {
      id: `q${idx + 1}`,
      prompt: `Nghĩa của "${word}" là gì?`,
      choices,
      correctIndex
    };
  }).filter(q => q.choices?.length === 4 && q.correctIndex >= 0);
}

// Build Listening
function buildListening(filteredRows, pickedWords, byWord) {
  const allWordsPool = filteredRows
    .map(r => r.c[2]?.v?.toString().trim())
    .filter(Boolean);

  const items = pickedWords.map((word, idx) => {
    const meta = byWord.get(word);
    const question = meta?.question || "";
    const answer   = meta?.answer || "";
    if (!question || !answer) return null;

    const wrongPool = allWordsPool.filter(w => w && w !== word);
    const wrongOptions = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);
    const choices = [...wrongOptions, word].sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(word);

    return {
      id: `lq${idx + 1}`,
      prompt: "Nghe và chọn từ đúng",
      audioText: word,
      question,
      answer,
      choices,
      correctIndex
    };
  }).filter(Boolean);

  return items;
}

// Build Sentence (Ghép câu)
function normSentence(s) {
  return (s || "")
    .toLowerCase()
    .replace(/[.,;'\)\(]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}
function tokenizeWords(answer) {
  return normSentence(answer).split(" ").filter(Boolean);
}
function buildSentence(filteredRows, count) {
  const items = [];
  const seen = new Set();

  filteredRows.forEach(r => {
    const qRaw = r.c[9]?.v?.toString().trim();   // J
    const aRaw = r.c[11]?.v?.toString().trim();  // L
    if (!qRaw || !aRaw) return;

    const aNorm = normSentence(aRaw);
    if (seen.has(aNorm)) return;
    seen.add(aNorm);

    const tokens = tokenizeWords(aRaw);
    if (tokens.length > 1) {
      items.push({ question: qRaw, answer: aRaw, tokens });
    }
  });

  const shuffled = items.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);

  return picked.map((it, idx) => ({
    id: `s${idx + 1}`,
    question: it.question,
    answer: it.answer,
    tokens: it.tokens
  }));
}

// Build Speaking (ghép N câu thành đoạn văn)
function normalizeUnitId(unitStr) {
  if (!unitStr) return 0;
  const parts = unitStr.split("-");
  if (parts.length < 3) return 0;
  const [cls, lesson, part] = parts;
  return parseInt(cls) * 1000 + parseInt(lesson) * 10 + parseInt(part);
}

function buildSpeaking(filteredRows, count) {
  // Chuẩn hóa dữ liệu
  const allItems = filteredRows.map(r => {
    const lessonName = r.c[1]?.v?.toString().trim() || "";
    const vocabRaw   = r.c[2]?.v?.toString().trim() || "";
    const presentation = r.c[8]?.v?.toString().trim() || "";
    const meaning    = r.c[24]?.v?.toString().trim() || "";
    const unitNum    = normalizeUnitId(lessonName);
    return { lessonName, unitNum, vocabRaw, presentation, meaning };
  }).filter(it => it.lessonName && it.presentation);

  // Group theo bài
  const unitMap = {};
  allItems.forEach(it => {
    if (!unitMap[it.lessonName]) unitMap[it.lessonName] = [];
    unitMap[it.lessonName].push(it);
  });

  // Random chọn count bài
  const unitNames = Object.keys(unitMap);
  const shuffled = unitNames.sort(() => Math.random() - 0.5);
  const pickedUnits = shuffled.slice(0, count);

  // Với mỗi bài, random chọn 1 câu
  const selectedItems = [];
  pickedUnits.forEach(u => {
    const rows = unitMap[u];
    const chosen = rows[Math.floor(Math.random() * rows.length)];
    selectedItems.push(chosen);
  });

  // Sort theo unitNum
  selectedItems.sort((a, b) => a.unitNum - b.unitNum);

  // Ghép thành đoạn văn
  const paragraph = selectedItems.map(it => it.presentation).join(". ").replace(/\s+\./g, ".").trim();
  const finalParagraph = paragraph ? (paragraph.endsWith(".") ? paragraph : paragraph + ".") : "";

  return {
    paragraph: finalParagraph,
    count: selectedItems.length
  };
}

// DocId
function makeDocId(classId) {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `test-${classId}-${dd}${mm}${yyyy}`;
}
// file: test.js (phần 2/2)
// file: test.js (phần 2/2)

// ===== Phonics (Pronunciation) =====
// Mỗi câu: prompt = "IPA của từ 'word' là gì?"; choices = 4 IPA khác nhau (1 đúng + 3 sai); correctIndex = vị trí IPA đúng
function buildPhonics(phonicsBank, count) {
  // Lọc bỏ unit7–unit11
  const filtered = phonicsBank.filter(it => {
    return !["unit7", "unit8", "unit9", "unit10", "unit11"].includes(it.unit);
  });

  // Tập IPA duy nhất (để chọn đáp án sai không trùng)
  const allIpa = [...new Set(filtered.map(it => it.ipa).filter(Boolean))];

  // Shuffle và chọn số lượng mục phonics
  const shuffled = filtered.sort(() => Math.random() - 0.5);
  const picked = shuffled.slice(0, count);

  // Tạo MCQ IPA
  return picked.map((item, idx) => {
    const correct = item.ipa;
    // Lấy 3 IPA sai, khác hoàn toàn IPA đúng
    const wrongPool = allIpa.filter(ipa => ipa !== correct);
    const wrongChoices = wrongPool.sort(() => Math.random() - 0.5).slice(0, 3);

    // Ghép và trộn, đảm bảo 4 IPA đều khác nhau
    const choices = [...wrongChoices, correct].sort(() => Math.random() - 0.5);
    const correctIndex = choices.indexOf(correct);

    return {
      id: `p${idx + 1}`,
      prompt: `IPA của từ "${item.word}" là gì?`,
      choices,        // mảng 4 IPA không trùng nhau
      correctIndex    // vị trí IPA đúng
    };
  });
}

async function saveTest() {
  const classId = document.getElementById("classSelect").value;

  // Đọc số lượng câu hỏi từ từng dropdown
  const mcqCount = parseInt(document.getElementById("mcqCount").value, 10);
  const listeningCount = parseInt(document.getElementById("listeningCount").value, 10);
  const pronunciationCount = parseInt(document.getElementById("pronunciationCount").value, 10);
  const sentenceCount = parseInt(document.getElementById("sentenceCount").value, 10);
  const speakingCount = parseInt(document.getElementById("speakingCount").value, 10);

  // Bài lớn nhất áp dụng chung cho tất cả dạng
  const maxLesson = await fetchMaxLessonCode(classId);
  if (!maxLesson) {
    alert("⚠️ Không tìm thấy bài học hợp lệ cho lớp đã chọn.");
    return;
  }

  // Lọc dữ liệu vocab theo maxLesson
  const { filteredRows, byWord } = await fetchVocabRows(maxLesson);

  // Pick riêng cho từng dạng
  const pickedForMcq = pickUniqueWords(filteredRows, mcqCount);
  const pickedForListening = pickUniqueWords(filteredRows, listeningCount);

  // Build dữ liệu
  const mcq = buildMcq(filteredRows, pickedForMcq, byWord);
  const listening = buildListening(filteredRows, pickedForListening, byWord);
  const sentence = buildSentence(filteredRows, sentenceCount);
  const speaking = buildSpeaking(filteredRows, speakingCount);

  // Phonics: tạo MCQ IPA (1 đúng + 3 sai, tất cả khác nhau)
  // Lưu ý: cần có biến phonicsBank (đã import ở phần 1 nếu Anh đang tách file)
  const phonics = buildPhonics(phonicsBank, pronunciationCount);

  // Lưu Firestore
  const docId = makeDocId(classId);
  const expireAt = Timestamp.fromMillis(Date.now() + 48 * 60 * 60 * 1000);

  await setDoc(doc(db, "test", docId), {
    meta: {
      class: classId,
      date: docId.split("-").pop(),
      createdAt: serverTimestamp(),
      expireAt
    },
    mcq,
    listening,
    sentence,
    speaking,              // { paragraph, count }
    pronunciation: phonics // [{ id, prompt, choices[4 IPA], correctIndex }]
  });

  alert(`✅ Đã lưu đề: ${docId}
- MCQ: ${mcq.length}/${mcqCount}
- Listening: ${listening.length}/${listeningCount}
- Sentence: ${sentence.length}/${sentenceCount}
- Speaking: đoạn văn từ ${speaking.count} câu
- Phonics: ${phonics.length}/${pronunciationCount}`);
}

function formatTimestamp(ts) {
  if (!ts?.seconds) return "-";
  const d = new Date(ts.seconds * 1000 + Math.round(ts.nanoseconds / 1e6));
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${dd}/${mm}/${yyyy} ${hh}:${mi}`;
}

async function viewTest() {
  const classId = document.getElementById("classSelect").value;
  const docId = makeDocId(classId);
  const snap = await getDoc(doc(db, "test", docId));

  const box = document.getElementById("resultBox");
  if (!snap.exists()) {
    box.textContent = "❌ Không tìm thấy đề kiểm tra đã lưu.";
    return;
  }

  const data = snap.data();
  let output = `📘 Đề kiểm tra: ${docId}\n`;
  output += `Lớp: ${data.meta.class} | Ngày: ${data.meta.date}\n`;
  output += `Tạo lúc: ${formatTimestamp(data.meta.createdAt)} | Hết hạn: ${formatTimestamp(data.meta.expireAt)}\n`;
  output += `---------------------------------\n`;

  // MCQ
  output += `📝 Trắc nghiệm (${data.mcq?.length || 0} câu)\n`;
  (data.mcq || []).forEach(q => {
    const correct = q.choices[q.correctIndex];
    output += `\n${q.id}: ${q.prompt}\n`;
    q.choices.forEach((c, i) => {
      output += `   ${i === q.correctIndex ? "👉" : "  "} ${String.fromCharCode(65+i)}. ${c}\n`;
    });
    output += `   ✅ Đáp án đúng: ${correct}\n`;
  });
  output += `\n---------------------------------\n`;

  // Listening
  output += `🎧 Nghe (${data.listening?.length || 0} câu)\n`;
  (data.listening || []).forEach(q => {
    const correct = q.choices[q.correctIndex];
    output += `\n${q.id}: ${q.prompt}\n`;
    if (q.question || q.answer) {
      output += `   🗣 Câu hỏi: ${q.question || "-"}\n`;
      output += `   🗣 Trả lời: ${q.answer || "-"}\n`;
    }
    q.choices.forEach((c, i) => {
      output += `   ${i === q.correctIndex ? "👉" : "  "} ${String.fromCharCode(65+i)}. ${c}\n`;
    });
    output += `   ✅ Đáp án đúng: ${correct}\n`;
  });
  output += `\n---------------------------------\n`;

  // Sentence
  output += `🧩 Ghép câu (${data.sentence?.length || 0} câu)\n`;
  (data.sentence || []).forEach(q => {
    output += `\n${q.id}: ${q.question}\n`;
    output += `   🔤 Tokens: ${q.tokens.join(" | ")}\n`;
    output += `   ✅ Đáp án: ${q.answer}\n`;
  });
  output += `\n---------------------------------\n`;

  // Speaking
  output += `🗣 Nói: đoạn văn từ ${data.speaking?.count || 0} câu\n`;
  if (data.speaking?.paragraph) {
    output += `   📄 ${data.speaking.paragraph}\n`;
  } else {
    output += `   📄 (Chưa có đoạn văn)\n`;
  }
  output += `\n---------------------------------\n`;

  // Phonics (Pronunciation)
  output += `🔊 Phonics: ${data.pronunciation?.length || 0} câu\n`;
  (data.pronunciation || []).forEach(p => {
    const correct = p.choices[p.correctIndex];
    output += `\n${p.id}: ${p.prompt}\n`;
    p.choices.forEach((c, i) => {
      output += `   ${i === p.correctIndex ? "👉" : "  "} ${String.fromCharCode(65+i)}. ${c}\n`;
    });
    output += `   ✅ Đáp án đúng: ${correct}\n`;
  });

  box.textContent = output;
}

// Wire up
document.getElementById("saveTestBtn").addEventListener("click", () => {
  saveTest().catch(err => {
    console.error(err);
    alert("❌ Lỗi khi lưu đề.");
  });
});
document.getElementById("viewTestBtn").addEventListener("click", () => {
  viewTest().catch(err => {
    console.error(err);
    alert("❌ Lỗi khi đọc đề.");
  });
});
