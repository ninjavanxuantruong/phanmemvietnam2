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

      const currentRaw = parseFloat(localStorage.getItem("phonicsTheoryScore") || "0");
      const roundedScore = Math.ceil(currentRaw);

      if (roundedScore >= 20) {
        console.log("🏁 Đã đạt tối đa 20 điểm. Không cộng thêm.");
        return;
      }

      const updatedRaw = currentRaw + 0.25;
      const newRounded = Math.min(20, Math.ceil(updatedRaw));

      localStorage.setItem("phonicsTheoryScore", updatedRaw.toFixed(1));
      localStorage.setItem("phonicsTheoryRounded", newRounded);

      updatePhonicsScoreDisplay();
      console.log(`📚 Điểm lý thuyết Phonics: ${updatedRaw.toFixed(1)} → Làm tròn: ${newRounded}`);
    });
  });

});
