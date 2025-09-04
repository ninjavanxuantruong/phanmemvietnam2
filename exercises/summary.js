// ✅ RESET DỮ LIỆU SAU 12 TIẾNG
const startTimeGlobal = localStorage.getItem("startTime_global");
const now = Date.now();

if (startTimeGlobal && now - parseInt(startTimeGlobal) > 3 * 60 * 60 * 1000) {
  const keysToReset = Object.keys(localStorage).filter(k =>
    k.startsWith("result_") || k.startsWith("startTime_")
  );
  keysToReset.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem("startTime_global");
}

// ✅ THÔNG TIN HỌC SINH
const studentName = localStorage.getItem("trainerName") || "Không tên";
const studentClass = localStorage.getItem("trainerClass") || "Chưa có lớp";

function normalize(str) {
  return str.trim().toLowerCase();
}

const normalizedName = normalize(studentName);
const normalizedClass = normalize(studentClass);

const selectedLesson = localStorage.getItem("selectedLesson") || "Chưa chọn bài học";

document.getElementById("studentInfo").textContent = `${studentName} (${studentClass})`;

const tableBody = document.getElementById("tableBody");
const parts = [
  { key: "vocabulary",         label: "Từ vựng" },
  { key: "image",              label: "Hình ảnh" },
  { key: "game-word-meaning",  label: "Trò từ & nghĩa" },
  { key: "word-puzzle",        label: "Trò ô chữ" },
  { key: "pokeword",           label: "Trò điền chữ cái" },
  { key: "listening",          label: "Bài tập nghe" },
  { key: "speaking-chunks",    label: "Nói cụm từ" },
  { key: "speaking-sentence",  label: "Nói câu đầy đủ" },
  { key: "speaking-paragraph", label: "Nói đoạn văn" },
  { key: "phonics",            label: "Phonics" },
  { key: "overview",           label: "Tổng quan" },
  { key: "communication",      label: "Chatbot học bài" }
];

let totalScore = 0;
let totalMax = 0;

parts.forEach(({ key, label }, index) => {
  const result = JSON.parse(localStorage.getItem(`result_${key}`));
  const score = result?.score || 0;
  const total = result?.total || 0;
  const percent = total > 0 ? Math.round((score / total) * 100) : 0;
  let rating = "";

  if (percent < 50) rating = "😕 Cần cố gắng";
  else if (percent < 70) rating = "🙂 Khá";
  else if (percent < 90) rating = "😃 Tốt";
  else rating = "🏆 Tuyệt vời";

  totalScore += score;
  totalMax += total;

  if (total === 0 && !localStorage.getItem(`startTime_${key}`)) {
    localStorage.setItem(`startTime_${key}`, Date.now());
  }

  const row = `
    <tr>
      <td>${index + 1}</td>
      <td>${label}</td>
      <td>${score}</td>
      <td>${total}</td>
      <td>${percent}%</td>
      <td class="rating">${rating}</td>
    </tr>
  `;
  tableBody.innerHTML += row;
});

// ✅ DÒNG THỨ 13: Bài tập cấp 2
const grade8Score = parseInt(localStorage.getItem("totalCorrect_grade8") || "0");
const grade8Total = parseInt(localStorage.getItem("totalQuestions_grade8") || "0");
const grade8Percent = grade8Total > 0 ? Math.round((grade8Score / grade8Total) * 100) : 0;

let grade8Rating = "";
if (grade8Percent < 50) grade8Rating = "😕 Cần cố gắng";
else if (grade8Percent < 70) grade8Rating = "🙂 Khá";
else if (grade8Percent < 90) grade8Rating = "😃 Tốt";
else grade8Rating = "🏆 Tuyệt vời";

const grade8Row = `
  <tr>
    <td>13</td>
    <td>Bài tập cấp 2</td>
    <td>${grade8Score}</td>
    <td>${grade8Total}</td>
    <td>${grade8Percent}%</td>
    <td class="rating">${grade8Rating}</td>
  </tr>
`;
tableBody.innerHTML += grade8Row;

totalScore += grade8Score;
totalMax += grade8Total;

// ✅ Xử lý phần đã làm và chưa làm theo nhóm
const completedParts = [];
const zeroParts = [];

const group1 = ["game-word-meaning", "word-puzzle", "pokeword"];
const group2 = ["speaking-chunks", "speaking-sentence", "speaking-paragraph"];

let group1Done = false;
let group2Done = false;
let group1Zero = [];
let group2Zero = [];

parts.forEach(({ key, label }) => {
  const result = localStorage.getItem(`result_${key}`);
  const parsed = result ? JSON.parse(result) : null;
  const hasData = parsed?.total > 0;

  if (group1.includes(key)) {
    if (hasData) group1Done = true;
    else if (!group1Done) group1Zero.push(label);
    return;
  }

  if (group2.includes(key)) {
    if (hasData) group2Done = true;
    else if (!group2Done) group2Zero.push(label);
    return;
  }

  if (hasData) completedParts.push(label);
  else zeroParts.push(label);
});

// ✅ BỔ SUNG PHẦN CẤP 2 VÀO completed/zero
if (grade8Total > 0) {
  completedParts.push("Bài tập cấp 2");
} else {
  zeroParts.push("Bài tập cấp 2");
}

if (group1Done) {
  completedParts.push("Trò chơi từ & nghĩa / ô chữ / điền chữ cái");
} else {
  zeroParts.push("Trò chơi");
}

if (group2Done) {
  completedParts.push("Nói cụm / câu / đoạn văn");
} else {
  zeroParts.push("Phần nói");
}


// 👉 Tổng kết cuối
const finalPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;


// ✅ Tính nhóm kỹ năng đã học
const skillGroups = {
  vocabulary: "Từ vựng",
  image: "Hình ảnh",
  "game-word-meaning": "Trò chơi",
  "word-puzzle": "Trò chơi",
  pokeword: "Trò chơi",
  listening: "Nghe",
  "speaking-chunks": "Nói",
  "speaking-sentence": "Nói",
  "speaking-paragraph": "Nói",
  phonics: "Phonics",
  overview: "Tổng quan",
  communication: "Chatbot",
  grade8: "Bài cấp 2"
};

const learnedGroups = new Set();
parts.forEach(({ key }) => {
  const result = JSON.parse(localStorage.getItem(`result_${key}`));
  if (result?.total > 0 && skillGroups[key]) {
    learnedGroups.add(skillGroups[key]);
  }
});
if (grade8Total > 0) learnedGroups.add("Bài cấp 2");

// ✅ Gọi hàm đánh giá
const evaluation = getFullEvaluation({
  totalScore,
  totalMax,
  completedParts,
  learnedGroups
});

document.getElementById("totalRating").textContent =
`📦 Chăm chỉ: ${evaluation.diligence} | 🎯 Hiệu quả: ${evaluation.effectiveness} | 🧠 Kỹ năng: ${evaluation.skill} | 🧾 Đánh giá chung: ${evaluation.overall}`;


const finalRating = evaluation.overall; // ✅ dùng để ghi Firebase


document.getElementById("totalScore").textContent = totalScore;
document.getElementById("totalMax").textContent = totalMax;
document.getElementById("totalPercent").textContent = `${finalPercent}%`;


// 🧠 Mã ngày
const dateStr = new Date();
const day = String(dateStr.getDate()).padStart(2, '0');
const month = String(dateStr.getMonth() + 1).padStart(2, '0');
const year = String(dateStr.getFullYear()).slice(-2);
const dateCode = `${day}${month}${year}`;


const completedCount = completedParts.length;

// ✅ Tính tổng thời gian làm bài
let totalMinutes = 0;
if (startTimeGlobal) {
  const durationMs = Date.now() - parseInt(startTimeGlobal);
  totalMinutes = Math.max(1, Math.floor(durationMs / 60000));
}

const zeroText = zeroParts.length > 0 ? ` (Các phần 0 điểm: ${zeroParts.join(", ")})` : "";
const timeText = totalMinutes > 0 ? ` [ ${totalMinutes} phút]` : "";

const code = `${studentName}-${studentClass}-${selectedLesson}-${dateCode}-${totalScore}/${totalMax}-${completedCount}/${parts.length + 1}-${finalRating}${zeroText}${timeText}`;
document.getElementById("resultCode").textContent = code;

// 📋 Sao chép mã
//function copyResultCode() {
  navigator.clipboard.writeText(code).then(() => {
    alert("✅ Đã sao chép mã kết quả - Hãy dán vào Zalo thầy Tình!");
  });
}

// ✅ LƯU KẾT QUẢ HỌC SINH CHÍNH THỨC (GHI ĐÈ 1 LẦN MỖI NGÀY)
const isVerified = localStorage.getItem("isVerifiedStudent") === "true";

if (isVerified) {
  const historyKey = `history_${studentName}_${studentClass}`;
  const history = JSON.parse(localStorage.getItem(historyKey)) || [];

  const newEntry = {
    name: normalizedName,
    class: normalizedClass,
    score: totalScore,
    max: totalMax,
    doneParts: completedCount,
    rating: finalRating,
    date: dateCode,
    duration: totalMinutes
  };


  const existingIndex = history.findIndex(entry => entry.date === dateCode);
  if (existingIndex >= 0) {
    history[existingIndex] = newEntry;
  } else {
    history.push(newEntry);
  }

  localStorage.setItem(historyKey, JSON.stringify(history));

  // ✅ Ghi dữ liệu lên Firebase Firestore nếu hàm đã được gắn từ HTML
  console.log("📤 Gọi hàm ghi Firebase với:", newEntry);

  if (window.saveStudentResultToFirebase) {
    window.saveStudentResultToFirebase(newEntry).then(() => {
      console.log("📥 Đã gọi xong hàm ghi Firebase.");
    }).catch(err => {
      console.error("❌ Lỗi khi gọi hàm ghi Firebase:", err.message);
    });
  }
}

function getFullEvaluation({ totalScore, totalMax, completedParts, learnedGroups }) {
  const percentCorrect = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const coveragePercent = Math.round((completedParts.length / 13) * 100);
  const skillPercent = Math.round((learnedGroups.size / 9) * 100); // 9 nhóm kỹ năng

  // 🎯 Hiệu quả
  let effectiveness = "";
  if (percentCorrect < 50) effectiveness = "😕 Cần cố gắng";
  else if (percentCorrect < 70) effectiveness = "🙂 Khá";
  else if (percentCorrect < 90) effectiveness = "😃 Tốt";
  else effectiveness = "🏆 Tuyệt vời";

  // 📦 Chăm chỉ
  let diligence = "";
  if (coveragePercent < 30) diligence = "⚠️ Học quá ít";
  else if (coveragePercent < 60) diligence = "🙂 Học chưa đủ";
  else if (coveragePercent < 90) diligence = "😃 Học khá đầy đủ";
  else diligence = "🏆 Học toàn diện";

  // 🧠 Kỹ năng
  let skill = "";
  if (skillPercent < 40) skill = "⚠️ Thiếu kỹ năng";
  else if (skillPercent < 70) skill = "🙂 Chưa đủ nhóm";
  else if (skillPercent < 90) skill = "😃 Đa kỹ năng";
  else skill = "🏆 Kỹ năng toàn diện";

  // 🧾 Đánh giá chung
  const ratings = [effectiveness, diligence, skill];
  const scoreMap = {
    "😕 Cần cố gắng": 1,
    "⚠️ Học quá ít": 1,
    "⚠️ Thiếu kỹ năng": 1,
    "🙂 Khá": 2,
    "🙂 Học chưa đủ": 2,
    "🙂 Chưa đủ nhóm": 2,
    "😃 Tốt": 3,
    "😃 Học khá đầy đủ": 3,
    "😃 Đa kỹ năng": 3,
    "🏆 Tuyệt vời": 4,
    "🏆 Học toàn diện": 4,
    "🏆 Kỹ năng toàn diện": 4
  };

  const scoreSum = ratings.reduce((sum, r) => sum + scoreMap[r], 0);


  let overall = "";
  if (scoreSum >= 11) overall = "🏆 Tuyệt vời toàn diện";
  else if (scoreSum >= 9) overall = "😃 Rất tốt";
  else if (scoreSum >= 7) overall = "🙂 Tốt";
  else overall = "⚠️ Cần cải thiện";


  return {
    effectiveness,
    diligence,
    skill,
    overall
  };
}


async function renderStudentWeekSummary() {
  const isVerified = localStorage.getItem("isVerifiedStudent") === "true";
  const studentName = localStorage.getItem("trainerName");
  const studentClass = localStorage.getItem("trainerClass");

  if (!isVerified) {
    alert("Bạn chưa được được thầy Tình cấp nick. Không thể xem kết quả tuần.");
    return;
  }

  const { initializeApp, getApp } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js");
  const { getFirestore, collection, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");

  const firebaseConfig = {
    apiKey: "AIzaSyBQ1pPmSdBV8M8YdVbpKhw_DOetmzIMwXU",
    authDomain: "lop-hoc-thay-tinh.firebaseapp.com",
    projectId: "lop-hoc-thay-tinh",
    storageBucket: "lop-hoc-thay-tinh.appspot.com",
    messagingSenderId: "391812475288",
    appId: "1:391812475288:web:ca4c275ac776d69deb23ed"
  };

  let app;
  try {
    app = initializeApp(firebaseConfig);
  } catch (e) {
    app = getApp();
  }

  const db = getFirestore(app);
  const snapshot = await getDocs(collection(db, "hocsinh"));

  const prefix = `${studentName}_${studentClass}_`;
  const entries = [];

  snapshot.forEach(docSnap => {
    if (docSnap.id.startsWith(prefix)) {
      entries.push(docSnap.data());
    }
  });

  const recentEntries = entries
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

  const tbody = document.getElementById("weeklySummaryBody");
  tbody.innerHTML = "";

  // ✅ Chỉ giữ lại đoạn này một lần duy nhất
  recentEntries.forEach(entry => {
    const date = `${entry.date.slice(0,2)}-${entry.date.slice(2,4)}-${entry.date.slice(4)}`;
    const row = `
      <tr>
        <td>${date}</td>
        <td>${entry.score}</td>
        <td>${entry.max}</td>
        <td>${entry.doneParts}</td>
        <td>${entry.rating}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });

  document.getElementById("weeklySummarySection").style.display = "block";



  
}
document.getElementById("weeklySummaryBtn").addEventListener("click", renderStudentWeekSummary);

