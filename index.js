function startApp() {
  localStorage.clear();
  const name = document.getElementById("studentName").value.trim();
  const className = document.getElementById("studentClass").value.trim();
  const password = document.getElementById("studentPassword").value.trim();
  const errorBox = document.getElementById("errorMessage");

  const usePassword = false; // 🔁 Bật = true, Tắt = false
  const expectedPassword = "1";

  // ✅ Kiểm tra tên và lớp luôn luôn bắt buộc
  if (!name || !className) {
    errorBox.textContent = "⚠️ Vui lòng nhập đầy đủ tên và lớp.";
    return;
  }

  // 🔐 Chỉ kiểm tra mật khẩu nếu đang bật
  if (usePassword && password !== expectedPassword) {
    errorBox.textContent = "🚫 Mật khẩu sai rồi!";
    return;
  }

  // 💾 Lưu thông tin
  localStorage.setItem("trainerName", name);
  localStorage.setItem("trainerClass", className);

  localStorage.setItem("startTime_global", Date.now());


  // 🚀 Tiến vào hành trình
  window.location.href = "dataEntry.html";
}
