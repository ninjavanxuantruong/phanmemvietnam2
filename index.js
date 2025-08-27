import { fetchStudentList } from './studentList.js';

console.log("✅ index.js đã chạy");

async function startApp() {
  const name = document.getElementById("studentName").value.trim();
  const className = document.getElementById("studentClass").value.trim();
  const password = document.getElementById("studentPassword").value.trim();
  const errorBox = document.getElementById("errorMessage");

  if (!name || !className) {
    errorBox.textContent = "⚠️ Vui lòng nhập đầy đủ tên và lớp.";
    return;
  }

  const studentList = await fetchStudentList();

  // ✅ Hàm chuẩn hóa: giữ dấu, bỏ khoảng trắng đầu/cuối, không phân biệt hoa/thường
  const normalize = str => str.toLowerCase().trim();

  // ✅ Kiểm tra khớp tên và lớp
  const matchedStudent = studentList.find(s =>
    normalize(s.name) === normalize(name) &&
    normalize(s.class) === normalize(className)
  );

  // ✅ Test riêng cho Trần Anh lớp 2
  const testName = "Trần Anh";
  const testClass = "2";
  const testMatch = studentList.find(s =>
    normalize(s.name) === normalize(testName) &&
    normalize(s.class) === normalize(testClass)
  );
  console.log("🧪 Test Trần Anh lớp 2:", testMatch ? "✅ Có trong danh sách" : "❌ Không tìm thấy");

  // ✅ Lưu thông tin học sinh
  localStorage.setItem("trainerName", name);
  localStorage.setItem("trainerClass", className);
  localStorage.setItem("startTime_global", Date.now());

  if (matchedStudent) {
    localStorage.setItem("isVerifiedStudent", "true");
    localStorage.setItem("studentPassword", matchedStudent.password || "");
  } else {
    localStorage.setItem("isVerifiedStudent", "false");
  }

  console.log("Đã xác thực:", localStorage.getItem("isVerifiedStudent"));
  console.log("Đã lưu mật khẩu:", localStorage.getItem("studentPassword"));

  window.location.href = "dataEntry.html";
}

window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("startBtn");
  console.log("✅ Đã tìm thấy nút:", btn);
  if (btn) {
    btn.addEventListener("click", startApp);
  } else {
    console.warn("❌ Không tìm thấy nút #startBtn");
  }
});
