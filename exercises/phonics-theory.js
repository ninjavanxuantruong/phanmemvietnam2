// ✅ Hàm phát âm từ file mp3 trên GitHub
function playIPAFromText(text) {
  const match = text.match(/\/([^/]+)\//); // lấy phần giữa dấu gạch chéo
  const ipa = match?.[1];

  if (ipa) {
    const url = `https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/${encodeURIComponent(ipa)}.mp3`;
    const audio = new Audio(url);
    audio.play();
  } else {
    console.warn("Không tìm thấy IPA trong nút:", text);
  }
}

// ✅ Hàm cập nhật điểm hiển thị
function updatePhonicsScoreDisplay() {
  const scoreDisplay = document.getElementById("scoreValue");
  const rounded = localStorage.getItem("phonicsTheoryRounded") || "0";
  scoreDisplay.textContent = rounded;
}

// ✅ Gắn sự kiện click cho các nút âm thanh
document.addEventListener("DOMContentLoaded", () => {
  console.log("📦 Phonics lý thuyết đã sẵn sàng");

  // Cập nhật điểm khi trang tải
  updatePhonicsScoreDisplay();

  document.querySelectorAll(".sound-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const text = btn.textContent.trim();
      playIPAFromText(text);

      // ✅ Tính điểm mỗi lần bấm: +0.5
      const currentRaw = parseFloat(localStorage.getItem("phonicsTheoryScore") || "0");
      const updatedRaw = currentRaw + 0.25;
      const roundedScore = Math.ceil(updatedRaw);

      // ✅ Lưu lại điểm
      localStorage.setItem("phonicsTheoryScore", updatedRaw.toFixed(1));
      localStorage.setItem("phonicsTheoryRounded", roundedScore);

      // ✅ Cập nhật giao diện
      updatePhonicsScoreDisplay();

      console.log(`📚 Điểm lý thuyết Phonics: ${updatedRaw.toFixed(1)} → Làm tròn: ${roundedScore}`);
    });
  });
});
