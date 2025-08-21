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

  // ⏱ Lưu thời gian bắt đầu nếu chưa có
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
    else group1Zero.push(label);
    return;
  }

  if (group2.includes(key)) {
    if (hasData) group2Done = true;
    else group2Zero.push(label);
    return;
  }

  if (hasData) completedParts.push(label);
  else zeroParts.push(label);
});

// ✅ Gom nhóm trò chơi
if (group1Done) {
  completedParts.push("Trò chơi từ & nghĩa / ô chữ / điền chữ cái");
} else {
  zeroParts.push("Trò chơi");
}

// ✅ Gom nhóm phần nói
if (group2Done) {
  completedParts.push("Nói cụm / câu / đoạn văn");
} else {
  zeroParts.push("Phần nói");
}

const completedCount = completedParts.length;

// ✅ Tính tổng thời gian làm bài
let totalMinutes = 0;

parts.forEach(({ key }) => {
  const result = JSON.parse(localStorage.getItem(`result_${key}`));
  const total = result?.total || 0;

  if (total > 0) {
    const startTime = localStorage.getItem(`startTime_${key}`);
    if (startTime) {
      const durationMs = Date.now() - parseInt(startTime);
      const minutes = Math.floor(durationMs / 60000);
      totalMinutes += minutes;
    }
  }
});

// ✅ Tạo mã tổng kết đầy đủ
const zeroText = zeroParts.length > 0 ? ` (Các phần 0 điểm: ${zeroParts.join(", ")})` : "";
const timeText = totalMinutes > 0 ? ` [ ${totalMinutes} phút]` : "";

const code = `${studentName}-${studentClass}-${selectedLesson}-${dateCode}-${totalScore}/${totalMax}-${completedCount}/${parts.length}-${finalRating}${zeroText}${timeText}`;

document.getElementById("resultCode").textContent = code;



// 📋 Sao chép mã
function copyResultCode() {
  navigator.clipboard.writeText(code).then(() => {
    alert("✅ Đã sao chép mã kết quả kèm thời gian!");
  });
}
