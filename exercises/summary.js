const studentName = localStorage.getItem("trainerName") || "Không tên";
const studentClass = localStorage.getItem("trainerClass") || "Chưa có lớp";

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
  { key: "overview",           label: "Tổng quan" }
];

let totalScore = 0;
let totalMax = 0;

parts.forEach(({key, label}, index) => {
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

// 👉 Tính tổng & đánh giá cuối
const finalPercent = totalMax > 0 ? Math.round((totalScore / totalMax) * 100) : 0;
let finalRating = "";

if (finalPercent < 50) finalRating = "😕 Cần cố gắng";
else if (finalPercent < 70) finalRating = "🙂 Khá";
else if (finalPercent < 90) finalRating = "😃 Tốt";
else finalRating = "🏆 Tuyệt vời";

// 👉 Gắn vào ô tfoot phía dưới bảng
document.getElementById("totalScore").textContent = totalScore;
document.getElementById("totalMax").textContent = totalMax;
document.getElementById("totalPercent").textContent = `${finalPercent}%`;
document.getElementById("totalRating").textContent = finalRating;

// 🧠 Tạo mã tổng kết
const dateStr = new Date();
const day = String(dateStr.getDate()).padStart(2, '0');
const month = String(dateStr.getMonth() + 1).padStart(2, '0');
const year = String(dateStr.getFullYear()).slice(-2);
const dateCode = `${day}${month}${year}`;

const completedParts = parts.filter(({key}) => {
  const result = localStorage.getItem(`result_${key}`);
  if (!result) return false;
  const parsed = JSON.parse(result);
  return parsed?.total > 0;
}).length;

const code = `${studentName}-${studentClass}-${dateCode}-${totalScore}/${totalMax}-${completedParts}/11-${finalRating}`;
document.getElementById("resultCode").textContent = code;

// 📋 Sao chép mã
function copyResultCode() {
  navigator.clipboard.writeText(code).then(() => {
    alert("✅ Đã sao chép mã kết quả!");
  });
}

