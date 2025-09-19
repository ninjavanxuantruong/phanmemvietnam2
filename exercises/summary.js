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
  { key: "vocabulary",     label: "Từ vựng" },
  { key: "image",          label: "Hình ảnh" },
  { key: "game",           label: "Trò chơi" },         // ✅ gộp 3 game
  { key: "listening",      label: "Bài tập nghe" },
  { key: "speaking",       label: "Bài tập nói" },      // ✅ gộp 3 speaking
  { key: "phonics",        label: "Phát âm" },
  { key: "overview",       label: "Bài viết" },
  { key: "communication",  label: "Giao tiếp" },
  { key: "grade8",         label: "Bài tập cấp 2" }     // ✅ thêm phần cấp 2
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




// ✅ Xử lý phần đã làm và chưa làm theo nhóm
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

// ✅ BỔ SUNG PHẦN CẤP 2 VÀO completed/zero
const grade8Result = JSON.parse(localStorage.getItem("result_grade8") || "{}");
const grade8Total = grade8Result.total || 0;

if (grade8Total > 0) {
  completedParts.push("Bài tập cấp 2");
} else {
  zeroParts.push("Bài tập cấp 2");
}


// 👉 Tổng kết cuối
const finalPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;


// ✅ Tính nhóm kỹ năng đã học
const skillGroups = {
  vocabulary: "Từ vựng",
  image: "Hình ảnh",
  game: "Trò chơi",           // ✅ gộp 3 game
  listening: "Nghe",          // ✅ gộp các phần nghe
  speaking: "Nói",            // ✅ gộp các phần nói
  phonics: "Phát âm",
  overview: "Viết",
  communication: "Giao tiếp",
  grade8: "Bài cấp 2"         // ✅ thêm để thống kê
};

const learnedGroups = new Set();
parts.forEach(({ key }) => {
  const result = JSON.parse(localStorage.getItem(`result_${key}`));
  if (result?.total > 0 && skillGroups[key]) {
    learnedGroups.add(skillGroups[key]);
  }
});

if (grade8Total > 0) {
  learnedGroups.add("Bài cấp 2");
}

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
//  navigator.clipboard.writeText(code).then(() => {
//    alert("✅ Đã sao chép mã kết quả - Hãy dán vào Zalo thầy Tình!");
//  });
//}

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
  const coveragePercent = Math.round((completedParts.length / 8) * 100); // ✅ chỉ tính 8 phần chính
  const skillPercent = Math.round((learnedGroups.size / 8) * 100);       // ✅ chỉ tính 8 nhóm kỹ năng

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



// Hàm tạo object kết quả hôm nay
function getTodayEntry() {
  // Lấy tên/lớp hiển thị (để lưu vào history local cho dễ đọc)
  const studentName = localStorage.getItem("trainerName") || "";
  const studentClass = localStorage.getItem("trainerClass") || "";

  // Lấy tên/lớp đã chuẩn hóa từ lúc đăng nhập (ưu tiên dùng)
  const normalizedName =
    localStorage.getItem("normalizedTrainerName") ||
    studentName.toLowerCase().trim();
  const normalizedClass =
    localStorage.getItem("normalizedTrainerClass") ||
    studentClass.toLowerCase().trim();

  // Mã ngày dạng ddmmyy
  const dateStr = new Date();
  const day = String(dateStr.getDate()).padStart(2, "0");
  const month = String(dateStr.getMonth() + 1).padStart(2, "0");
  const year = String(dateStr.getFullYear()).slice(-2);
  const dateCode = `${day}${month}${year}`;

  // Điểm và đánh giá
  const totalScore =
    parseInt(document.getElementById("totalScore").textContent) || 0;
  const totalMax =
    parseInt(document.getElementById("totalMax").textContent) || 0;
  const finalRating = document
    .getElementById("totalRating")
    .textContent.split(" | ")
    .pop()
    .split(": ")
    .pop();

  // Thời gian làm bài
  const startTimeGlobal = localStorage.getItem("startTime_global");
  const totalMinutes = startTimeGlobal
    ? Math.max(1, Math.floor((Date.now() - parseInt(startTimeGlobal)) / 60000))
    : 0;

  // Số phần đã làm
  const completedCount = [
    "vocabulary", "image", "game", "listening", "speaking",
    "phonics", "overview", "communication", "grade8"
  ].filter(key => {
    const result = JSON.parse(localStorage.getItem(`result_${key}`) || "{}");
    return result.total > 0;
  }).length;


  return {
    name: normalizedName,       // luôn dùng bản chuẩn hóa để lưu Firebase
    class: normalizedClass,     // luôn dùng bản chuẩn hóa để lưu Firebase
    score: totalScore,
    max: totalMax,
    doneParts: completedCount,
    rating: finalRating,
    date: dateCode,
    duration: totalMinutes,
    _displayName: studentName,  // để hiển thị đẹp
    _displayClass: studentClass // để hiển thị đẹp
  };
}


// 1️⃣ Hàm lưu kết quả hôm nay
async function saveTodayResult() {
  const isVerified = localStorage.getItem("isVerifiedStudent") === "true";
  if (!isVerified) {
    alert("❌ Bạn chưa được xác thực, không thể ghi kết quả.");
    return;
  }

  const entry = getTodayEntry();

  // Lưu local history
  const historyKey = `history_${entry._displayName}_${entry._displayClass}`;
  const history = JSON.parse(localStorage.getItem(historyKey)) || [];
  const existingIndex = history.findIndex(e => e.date === entry.date);
  if (existingIndex >= 0) {
    history[existingIndex] = entry;
  } else {
    history.push(entry);
  }
  localStorage.setItem(historyKey, JSON.stringify(history));

  // Ghi Firebase
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

// 2️⃣ Hàm render bảng tuần từ Firebase
async function renderStudentWeekSummary() {
  const isVerified = localStorage.getItem("isVerifiedStudent") === "true";
  if (!isVerified) {
    alert("❌ Bạn chưa được xác thực, không thể xem kết quả tuần.");
    return;
  }

  const entryToday = getTodayEntry();

  // Khởi tạo Firebase
  const { initializeApp, getApp } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js");
  const { getFirestore, collection, query, where, getDocs } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");

  const firebaseConfig = {
    apiKey: "AIzaSyBQ1pPmSdBV8M8YdVbpKhw_DOetmzIMwXU",
    authDomain: "lop-hoc-thay-tinh.firebaseapp.com",
    projectId: "lop-hoc-thay-tinh",
    storageBucket: "lop-hoc-thay-tinh.appspot.com",
    messagingSenderId: "391812475288",
    appId: "1:391812475288:web:ca4c275ac776d69deb23ed"
  };

  let app;
  try { app = initializeApp(firebaseConfig); } catch { app = getApp(); }
  const db = getFirestore(app);

  // Truy vấn dữ liệu học sinh
  const q = query(
    collection(db, "hocsinh"),
    where("name", "==", entryToday.name),
    where("class", "==", entryToday.class)
  );

  const snapshot = await getDocs(q);

  // Gom dữ liệu: hôm nay + các ngày khác từ Firebase
  const entries = [entryToday];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    if (data.date !== entryToday.date) {
      entries.push(data);
    }
  });

  // Sắp xếp và lấy 7 ngày gần nhất
  const recentEntries = entries
    .sort((a, b) => b.date.localeCompare(a.date))
    .slice(0, 7);

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

// Gắn sự kiện cho nút
document.getElementById("saveResultBtn").addEventListener("click", saveTodayResult);
document.getElementById("weeklySummaryBtn").addEventListener("click", renderStudentWeekSummary);






