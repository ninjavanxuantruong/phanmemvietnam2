// Hàm phát âm từ file mp3 trên GitHub
function playIPAFromText(text) {
  // Tìm từ trong ngoặc: ví dụ "🔊 /aɪ/ (fly)" → lấy "aɪ"
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

// Gắn sự kiện click cho các nút âm thanh
document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".sound-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      playIPAFromText(btn.textContent.trim());
    });
  });
});
