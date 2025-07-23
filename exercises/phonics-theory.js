function speakFromExample(text) {
  const match = text.match(/\(([^)]+)\)/); // lấy từ trong ngoặc
  const word = match?.[1];
  if (word) {
    const utter = new SpeechSynthesisUtterance(word);
    utter.lang = "en-US";
    speechSynthesis.speak(utter);
  } else {
    console.warn("Không tìm thấy từ ví dụ trong nút:", text);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  document.querySelectorAll(".sound-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      speakFromExample(btn.textContent.trim());
    });
  });
});
