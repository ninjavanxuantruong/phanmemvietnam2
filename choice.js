document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Giao diện đã tải xong");

  // ✅ Giữ lại các key quan trọng từ index
  const preservedKeys = [
    "trainerName",
    "trainerClass",
    "startTime_global",
    "isVerifiedStudent",
    "studentPassword"
  ];

  const preservedData = {};
  preservedKeys.forEach(key => {
    preservedData[key] = localStorage.getItem(key);
  });

  // ✅ Xóa toàn bộ localStorage
  localStorage.clear();

  // ✅ Khôi phục lại dữ liệu từ index
  preservedKeys.forEach(key => {
    if (preservedData[key] !== null) {
      localStorage.setItem(key, preservedData[key]);
    }
  });

  console.log("🧹 Đã reset localStorage, giữ lại thông tin học sinh");

  // ✅ Gắn sự kiện các nút như cũ
  const btn1 = document.getElementById("btnLearnSuggested");
  const btn2 = document.getElementById("btnChooseOther");
  const btn3 = document.getElementById("btnClassCompetition");

  if (btn1) {
    btn1.addEventListener("click", () => {
      console.log("🎯 Đã ấn nút học bài đề xuất");
      window.dispatchEvent(new CustomEvent("choice1:trigger"));
    });
  }

  if (btn2) {
    btn2.addEventListener("click", () => {
      console.log("📚 Đã ấn nút chọn bài khác");
      window.dispatchEvent(new CustomEvent("choice2:trigger"));
    });
  }

  if (btn3) {
    btn3.addEventListener("click", () => {
      console.log("🏆 Đã ấn nút cuộc thi cả lớp");
      window.dispatchEvent(new CustomEvent("choice3:trigger"));
    });
  }
});
