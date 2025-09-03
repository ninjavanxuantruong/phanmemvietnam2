document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ Giao diện đã tải xong");

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
