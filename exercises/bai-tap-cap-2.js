// ✅ Điều hướng các nút
function goToPractice() {
  window.location.href = "bai-tap-tung-dang.html";
}
function goToTest() {
  window.location.href = "bai-kiem-tra.html";
}
function goToTheory() {
  window.location.href = "ly-thuyet.html";
}

// ✅ Danh sách dạng bài
const types = [
  "pronunciation", "verb", "article", "preposition", "pronoun",
  "connector", "rewrite", "plural", "wordform", "vocabulary",
  "reading", "kiemtra"
];

// ✅ Nhãn tiếng Việt cho từng dạng bài
const typeLabels = {
  pronunciation: "Phát âm",
  verb: "Động từ",
  article: "Mạo từ",
  preposition: "Giới từ",
  pronoun: "Đại từ",
  connector: "Liên từ",
  rewrite: "Viết lại câu",
  plural: "Số nhiều",
  wordform: "Biến đổi từ",
  vocabulary: "Từ vựng",
  reading: "Đọc hiểu",
  kiemtra: "Kiểm tra"
};

// ✅ Hàm lấy điểm từ localStorage
function getScore(type) {
  const key = `score_${type}_grade8`;
  const data = JSON.parse(localStorage.getItem(key) || "{}");
  return {
    correct: data.correct || 0,
    total: data.total || 0
  };
}

// ✅ Hiển thị bảng điểm chi tiết
function renderScoreTable() {
  const tbody = document.querySelector("#scoreTable tbody");
  if (!tbody) return;

  tbody.innerHTML = "";

  types.forEach(type => {
    const { correct, total } = getScore(type);
    const percent = total ? Math.round((correct / total) * 100) : 0;
    const label = typeLabels[type] || type;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td><img src="https://upload.wikimedia.org/wikipedia/commons/5/53/Poké_Ball_icon.svg" class="pokeball">${label}</td>
      <td>${correct}</td>
      <td>${total}</td>
      <td>${percent}%</td>
    `;
    tbody.appendChild(row);
  });
}

// ✅ Tạo mã kết quả tóm tắt
function generateResultCode() {
  const studentName = localStorage.getItem("trainerName") || "Không tên";
  const studentClass = localStorage.getItem("trainerClass") || "Chưa có lớp";

  const resultParts = types
    .map(type => {
      const { correct, total } = getScore(type);
      if (total > 0) {
        const label = typeLabels[type] || type;
        return `${label}: ${correct}/${total}`;
      }
      return null;
    })
    .filter(Boolean)
    .join(" - ");

  return `${studentName}-${studentClass} - ${resultParts}`;
}

// ✅ Hiển thị mã kết quả và nút sao chép
function renderResultCode() {
  const resultSection = document.getElementById("resultSection");
  if (!resultSection) return;

  const resultCode = generateResultCode();
  const now = new Date();
  const dateStr = now.toLocaleDateString("vi-VN");
  const timeStr = now.toLocaleTimeString("vi-VN");

  const resultCodeEl = document.createElement("p");
  resultCodeEl.innerHTML = `
    <strong>Mã kết quả:</strong> ${resultCode}
    <br><em>Thời gian tạo: ${dateStr} ${timeStr}</em>
  `;

  const copyBtn = document.createElement("button");
  copyBtn.textContent = "📋 Sao chép mã kết quả";
  copyBtn.className = "copy-btn";
  copyBtn.onclick = () => {
    navigator.clipboard.writeText(resultCode).then(() => {
      alert("✅ Đã sao chép mã kết quả!");
    });
  };

  resultSection.appendChild(resultCodeEl);
  resultSection.appendChild(copyBtn);
}

// ✅ Khởi chạy khi trang tải xong
document.addEventListener("DOMContentLoaded", () => {
  renderScoreTable();
  renderResultCode();
});
