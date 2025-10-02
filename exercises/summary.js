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

// Đã được cleanInput từ đầu vào nên ở đây chỉ cần lấy ra
const normalizedName = studentName;
const normalizedClass = studentClass;

const selectedLesson = localStorage.getItem("selectedLesson") || "Chưa chọn bài học";

document.getElementById("studentInfo").textContent = `${studentName} (${studentClass})`;

const tableBody = document.getElementById("tableBody");
const parts = [
  { key: "vocabulary",     label: "Từ vựng" },
  { key: "image",          label: "Hình ảnh" },
  { key: "game",           label: "Trò chơi" },
  { key: "listening",      label: "Bài tập nghe" },
  { key: "speaking",       label: "Bài tập nói" },
  { key: "phonics",        label: "Phát âm" },
  { key: "overview",       label: "Bài viết" },
  { key: "communication",  label: "Giao tiếp" },
  { key: "grade8",         label: "Bài tập cấp 2" }
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

// ✅ Xử lý phần đã làm và chưa làm
const completedParts = [];
const zeroParts = [];

parts.forEach(({ key, label }) => {
  const result = localStorage.getItem(`result_${key}`);
  const parsed = result ? JSON.parse(result) : null;
  const hasData = parsed?.total > 0;

  if (hasData) {
    completedParts.push(label);
  } else {
    zeroParts.push(label);
  }
});

// 👉 Tổng kết cuối
const finalPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;

// ✅ Tính nhóm kỹ năng đã học
const skillGroups = {
  vocabulary: "Từ vựng",
  image: "Hình ảnh",
  game: "Trò chơi",
  listening: "Nghe",
  speaking: "Nói",
  phonics: "Phát âm",
  overview: "Viết",
  communication: "Giao tiếp",
  grade8: "Bài cấp 2"
};

const learnedGroups = new Set();
parts.forEach(({ key }) => {
  const result = JSON.parse(localStorage.getItem(`result_${key}`));
  if (result?.total > 0 && skillGroups[key]) {
    learnedGroups.add(skillGroups[key]);
  }
});

// ✅ Gọi hàm đánh giá
const evaluation = getFullEvaluation({
  totalScore,
  totalMax,
  completedParts,
  learnedGroups
});

document.getElementById("totalRating").textContent =
`📦 Chăm chỉ: ${evaluation.diligence} | 🎯 Hiệu quả: ${evaluation.effectiveness} | 🧠 Kỹ năng: ${evaluation.skill} | 🧾 Đánh giá chung: ${evaluation.overall}`;

const finalRating = evaluation.overall;

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

const code = `${studentName}-${studentClass}-${selectedLesson}-${dateCode}-${totalScore}/${totalMax}-${completedCount}/${parts.length}-${finalRating}${zeroText}${timeText}`;
document.getElementById("resultCode").textContent = code;

// ✅ Lưu local history
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
  duration: totalMinutes,
  parts: completedParts
};

const existingIndex = history.findIndex(entry => entry.date === dateCode);
if (existingIndex >= 0) {
  history[existingIndex] = newEntry;
} else {
  history.push(newEntry);
}
localStorage.setItem(historyKey, JSON.stringify(history));

// ✅ Auto-save một lần sau khi đã có completedParts
saveTodayResult();
// ================== HÀM ĐÁNH GIÁ ==================
function getFullEvaluation({ totalScore, totalMax, completedParts, learnedGroups }) {
  const percentCorrect = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
  const coveragePercent = Math.round((completedParts.length / 8) * 100);
  const skillPercent = Math.round((learnedGroups.size / 8) * 100);

  let effectiveness = "";
  if (percentCorrect < 50) effectiveness = "😕 Cần cố gắng";
  else if (percentCorrect < 70) effectiveness = "🙂 Khá";
  else if (percentCorrect < 90) effectiveness = "😃 Tốt";
  else effectiveness = "🏆 Tuyệt vời";

  let diligence = "";
  if (coveragePercent < 30) diligence = "⚠️ Học quá ít";
  else if (coveragePercent < 60) diligence = "🙂 Học chưa đủ";
  else if (coveragePercent < 90) diligence = "😃 Học khá đầy đủ";
  else diligence = "🏆 Học toàn diện";

  let skill = "";
  if (skillPercent < 40) skill = "⚠️ Thiếu kỹ năng";
  else if (skillPercent < 70) skill = "🙂 Chưa đủ nhóm";
  else if (skillPercent < 90) skill = "😃 Đa kỹ năng";
  else skill = "🏆 Kỹ năng toàn diện";

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

// ================== TẠO ENTRY HÔM NAY (chuẩn hóa + có parts) ==================
function getTodayEntry() {
  const studentName = localStorage.getItem("trainerName") || "";
  const studentClass = localStorage.getItem("trainerClass") || "";

  const normalizedName =
    localStorage.getItem("normalizedTrainerName") ||
    studentName.toLowerCase().trim();
  const normalizedClass =
    localStorage.getItem("normalizedTrainerClass") ||
    studentClass.toLowerCase().trim();

  const dateStr = new Date();
  const day = String(dateStr.getDate()).padStart(2, "0");
  const month = String(dateStr.getMonth() + 1).padStart(2, "0");
  const year = String(dateStr.getFullYear()).slice(-2);
  const dateCode = `${day}${month}${year}`;

  const totalScore = parseInt(document.getElementById("totalScore").textContent) || 0;
  const totalMax   = parseInt(document.getElementById("totalMax").textContent) || 0;
  const finalRating = document
    .getElementById("totalRating")
    .textContent.split(" | ")
    .pop()
    .split(": ")
    .pop();

  const startTimeGlobal = localStorage.getItem("startTime_global");
  const totalMinutes = startTimeGlobal
    ? Math.max(1, Math.floor((Date.now() - parseInt(startTimeGlobal)) / 60000))
    : 0;

  const partsMeta = [
    { key: "vocabulary",    label: "Từ vựng" },
    { key: "image",         label: "Hình ảnh" },
    { key: "game",          label: "Trò chơi" },
    { key: "listening",     label: "Bài tập nghe" },
    { key: "speaking",      label: "Bài tập nói" },
    { key: "phonics",       label: "Phát âm" },
    { key: "overview",      label: "Bài viết" },
    { key: "communication", label: "Giao tiếp" },
    { key: "grade8",        label: "Bài tập cấp 2" }
  ];

  const completedParts = partsMeta
    .filter(({ key }) => {
      const r = JSON.parse(localStorage.getItem(`result_${key}`) || "{}");
      return (r.total || 0) > 0;
    })
    .map(({ label }) => label);

  const completedCount = completedParts.length;

  return {
    name: normalizedName,
    class: normalizedClass,
    score: totalScore,
    max: totalMax,
    doneParts: completedCount,
    rating: finalRating,
    date: dateCode,
    duration: totalMinutes,
    parts: completedParts,
    _displayName: studentName,
    _displayClass: studentClass
  };
}

// ================== LƯU KẾT QUẢ HÔM NAY (DUY NHẤT GỌI FIREBASE) ==================
async function saveTodayResult() {
  const entryBase = getTodayEntry();
  const selectedLesson = localStorage.getItem("selectedLesson") || "Chưa chọn bài học";

  const entry = {
    ...entryBase,
    lesson: selectedLesson
  };

  // Lưu local history (giữ nguyên)
  const historyKey = `history_${entry._displayName}_${entry._displayClass}`;
  const history = JSON.parse(localStorage.getItem(historyKey)) || [];
  const existingIndex = history.findIndex(e => e.date === entry.date);
  if (existingIndex >= 0) {
    history[existingIndex] = entry;
  } else {
    history.push(entry);
  }
  localStorage.setItem(historyKey, JSON.stringify(history));

  // Ghi Firebase (giữ nguyên)
  if (window.saveStudentResultToFirebase) {
    try {
      await window.saveStudentResultToFirebase(entry);
      alert("✅ Kết quả đã được ghi lên hệ thống thành công!");
    } catch (err) {
      console.error("❌ Lỗi khi ghi Firebase:", err.message);
      alert("❌ Ghi không thành công. Vui lòng kiểm tra mạng hoặc ấn gửi lại kết quả.");
    }
  } else {
    alert("⚠️ Hệ thống chưa sẵn sàng để ghi kết quả. Vui lòng thử lại hoặc báo cho giáo viên.");
  }
}

// ================== BẢNG TUẦN TỪ FIREBASE ==================
async function renderStudentWeekSummary() {
  const isVerified = localStorage.getItem("isVerifiedStudent") === "true";
  if (!isVerified) {
    alert("❌ Bạn chưa được xác thực, không thể xem kết quả tuần.");
    return;
  }

  const entryToday = getTodayEntry();

  // Khởi tạo Firebase
  const { initializeApp, getApp } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js");
  const { getFirestore, doc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");

  // Giữ nguyên cấu hình Firebase của Anh (đặt đúng như trong HTML)
  const firebaseConfig = window.__FIREBASE_CONFIG__ || {
    // Nếu Anh đã khởi tạo app ở HTML, có thể dùng getApp() ở dưới
  };

  let app;
  try { app = initializeApp(firebaseConfig); } catch { app = getApp(); }
  const db = getFirestore(app);

  // ✅ Lấy summary chung
  const ref = doc(db, "tonghop", `summary-${entryToday.class}-recent`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    alert("⚠️ Chưa có dữ liệu tổng hợp cho lớp này.");
    return;
  }

  const data = snap.data();
  const allDates = [...(data.days || [])].sort((a,b)=>b.localeCompare(a));
  const dayData = data.dayData || {};

  // Gom dữ liệu của học sinh này
  const entries = [];
  for (const dateCode of allDates) {
    const students = dayData[dateCode] || {};
    if (students[entryToday.name]) {
      entries.push({ date: dateCode, ...students[entryToday.name] });
    }
  }

  // Lấy 7 ngày gần nhất
  const recentEntries = entries.slice(0,7);

  // Render bảng
  const tbody = document.getElementById("weeklySummaryBody");
  tbody.innerHTML = "";
  recentEntries.forEach(e => {
    const date = `${e.date.slice(0,2)}-${e.date.slice(2,4)}-${e.date.slice(4)}`;
    const row = `
      <tr>
        <td>${date}</td>
        <td>${e.score}</td>
        <td>${e.max}</td>
        <td>${e.doneParts}</td>
        <td>${e.rating}</td>
      </tr>
    `;
    tbody.innerHTML += row;
  });

  document.getElementById("weeklySummarySection").style.display = "block";
}

// ================== GẮN SỰ KIỆN ==================
document.getElementById("saveResultBtn").addEventListener("click", saveTodayResult);
document.getElementById("weeklySummaryBtn").addEventListener("click", renderStudentWeekSummary);
