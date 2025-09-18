import { fetchStudentList } from './studentList.js';

console.log("✅ index.js đã chạy");
function cleanInput(str) {
  return str
    .toLowerCase()               // chuyển về chữ thường
    .replace(/[.,;/:]/g, "")     // xóa dấu câu
    .trim();                     // xóa khoảng trắng đầu/cuối
}

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
  const normalize = str => str.toLowerCase().trim();

  const matchedStudent = studentList.find(s =>
    normalize(s.name) === normalize(name) &&
    normalize(s.class) === normalize(className)
  );

  const cleanedName = cleanInput(name);
  const cleanedClass = cleanInput(className);

  localStorage.setItem("trainerName", cleanedName);
  localStorage.setItem("trainerClass", cleanedClass);
  localStorage.setItem("startTime_global", Date.now());

  if (matchedStudent) {
    localStorage.setItem("isVerifiedStudent", "true");
    localStorage.setItem("studentPassword", matchedStudent.password || "");

    // Lưu cả bản chuẩn hóa để dùng khi ghi Firebase
    localStorage.setItem("normalizedTrainerName", cleanedName);
    localStorage.setItem("normalizedTrainerClass", cleanedClass);

    window.location.href = "choice.html";
  } else {
    localStorage.setItem("isVerifiedStudent", "false");
    alert("⚠️ Bạn chưa được cấp nick. Bạn vẫn có thể tiếp tục học.");
  }

}
window.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("startBtn");
  if (btn) {
    btn.addEventListener("click", startApp);
  }
});

