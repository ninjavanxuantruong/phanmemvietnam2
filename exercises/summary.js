// ✅ RESET DỮ LIỆU SAU 12 TIẾNG
const startTimeGlobal = localStorage.getItem("startTime_global");
const now = Date.now();

if (startTimeGlobal && now - parseInt(startTimeGlobal) > 12 * 60 * 60 * 1000) {
  const keysToReset = Object.keys(localStorage).filter(k =>
    k.startsWith("result_") || k.startsWith("startTime_")
  );
  keysToReset.forEach(k => localStorage.removeItem(k));
  localStorage.removeItem("startTime_global");
}

// ✅ THÔNG TIN HỌC SINH
const studentName = localStorage.getItem("trainerName") || "Không tên";
const studentClass = localStorage.getItem("trainerClass") || "Chưa có lớp";
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

// 👉 Tổng kết cuối
const finalPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
let finalRating = "";

if (finalPercent < 50) finalRating = "😕 Cần cố gắng";
else if (finalPercent < 70) finalRating = "🙂 Khá";
else if (finalPercent < 90) finalRating = "😃 Tốt";
else finalRating = "🏆 Tuyệt vời";

document.getElementById("totalScore").textContent = totalScore;
document.getElementById("totalMax").textContent = totalMax;
document.getElementById("totalPercent").textContent = `${finalPercent}%`;
document.getElementById("totalRating").textContent = finalRating;

// 🧠 Mã ngày
const dateStr = new Date();
const day = String(dateStr.getDate()).padStart(2, '0');
const month = String(dateStr.getMonth() + 1).padStart(2, '0');
const year = String(dateStr.getFullYear()).slice(-2);
const dateCode = `${day}${month}${year}`;

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

// 📋 Sao chép mã
function copyResultCode() {
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
    name: studentName,
    class: studentClass,
    score: totalScore,
    max: totalMax,
    doneParts: completedCount,
    rating: finalRating,
    date: dateCode
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
