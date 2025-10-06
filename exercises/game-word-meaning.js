console.log("📣 Bản đã được xoá thật sự");
console.log("game-word-meaning.js đã được load");

import { ASSETS } from "./library.js"; // Import library.js để lấy nhạc nền
let isPlaying = true;

document.getElementById("toggle-music").addEventListener("click", () => {
  if (isPlaying) {
    bgMusic.pause();
    document.getElementById("toggle-music").innerText = "Bật Nhạc";
  } else {
    bgMusic.play();
    document.getElementById("toggle-music").innerText = "Tắt Nhạc";
  }
  isPlaying = !isPlaying;
});

// Tạo đối tượng Audio và phát nhạc nền
const bgMusic = new Audio(ASSETS.backgroundMusic);
bgMusic.loop = true;  // Phát nhạc lặp lại
bgMusic.volume = 0.5; // Điều chỉnh âm lượng nếu cần
bgMusic.play();        // Bắt đầu phát nhạc

// 🆕 Biến lưu danh sách từ vựng đúng và các từ đã ghép thành công
let vocabWords = [];     // Danh sách từ đúng (đã làm sạch) có kèm nghĩa
let matchedWords = [];   // Danh sách các từ đã ghép đúng

// 🆕 Hàm làm sạch từ: loại bỏ các ký tự không phải chữ và chuyển toàn bộ về chữ in hoa
function cleanWord(word) {
  return word.replace(/[^a-zA-Z]/g, "").toUpperCase();
}


// Hàm fetch từ Google Sheet (cột C: từ, cột Y: nghĩa)
async function fetchWords() {
  // Lấy danh sách từ đã chốt từ localStorage
  let chosenWords = JSON.parse(localStorage.getItem("wordBank")) || [];

  if (chosenWords.length === 0) {
    console.warn("Không có danh sách từ vựng đã chốt!");
    return [];
  }

  const url = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

  try {
    const response = await fetch(url);
    const text = await response.text();
    const jsonData = JSON.parse(text.substring(47).slice(0, -2));
    const rows = jsonData.table.rows;

    // Làm sạch và lọc dữ liệu phù hợp với danh sách đã chọn
    const filteredWords = rows.map(row => {
      let rowData = row.c;
      return {
        word: cleanWord(rowData[2]?.v || ""),
        meaning: rowData[24]?.v?.trim().toUpperCase() || ""
      };
    }).filter(item =>
      chosenWords.some(chosen => cleanWord(chosen) === item.word)
    );

    console.log("🔎 Tổng số dòng trùng khớp:", filteredWords.length);

    // Loại bỏ các bản ghi trùng từ — giữ bản ghi đầu tiên
    const uniqueMap = new Map();
    for (let item of filteredWords) {
      const key = item.word;
      if (!uniqueMap.has(key)) {
        uniqueMap.set(key, item); // giữ dòng đầu tiên
      }
    }

    const uniqueWords = [...uniqueMap.values()];
    console.log("✅ Danh sách từ sau khi loại trùng:", uniqueWords);

    // Lưu tổng số từ vào localStorage để kiểm tra chiến thắng
    localStorage.setItem("totalWords", uniqueWords.length);
    console.log("📦 Đã lưu số từ cần ghép:", uniqueWords.length);

    return uniqueWords;
  } catch (error) {
    console.error("❌ Lỗi khi fetch dữ liệu:", error);
    return [];
  }
}







// Hàm khởi tạo trò chơi nối từ & nghĩa
// Hàm khởi tạo trò chơi nối từ & nghĩa
async function setupGame() {
  console.log("Bắt đầu setupGame()");
  const words = await fetchWords();

  // ✅ Gán dữ liệu fetch được vào vocabWords
  vocabWords = words;

  console.log("Danh sách từ đã chốt:", vocabWords);
  console.log("Tổng số từ cần ghép:", vocabWords.length);

  if (!words.length) {
    console.error("Không có từ vựng nào được tải về!");
    return;
  }

  // Tạo mảng gameCards gồm 2 thẻ cho mỗi cặp (từ & nghĩa)
  const gameCards = [];
  words.forEach((item, index) => {
    gameCards.push({ id: index, text: item.word, type: "word" });
    gameCards.push({ id: index, text: item.meaning, type: "meaning" });
  });

  // Xáo trộn các thẻ ngẫu nhiên
  gameCards.sort(() => Math.random() - 0.5);
  console.log("gameCards sau khi xáo trộn:", gameCards);

  // Tạo giao diện trò chơi
  const gameBoard = document.getElementById("gameBoard");
  if (!gameBoard) {
    console.error("Không tìm thấy phần tử với id 'gameBoard'.");
    return;
  }
  gameBoard.innerHTML = "";

  // Hiển thị các thẻ lên giao diện
  gameCards.forEach(card => {
    const cardElem = document.createElement("div");
    cardElem.classList.add("card");
    cardElem.innerText = card.text.toUpperCase();
    cardElem.dataset.id = card.id;
    cardElem.dataset.type = card.type;
    cardElem.addEventListener("click", () => handleCardClick(cardElem));
    gameBoard.appendChild(cardElem);
  });

  console.log("Game đã được hiển thị!");
}


// 🆕 Mảng lưu trữ các thẻ được chọn tạm thời
let selectedCards = [];

// 🆕 Xử lý sự kiện khi người dùng click vào một thẻ
function handleCardClick(cardElem) {
  if (cardElem.classList.contains("matched") || selectedCards.includes(cardElem)) return;

  cardElem.style.backgroundColor = "#ff9800";
  selectedCards.push(cardElem);

  if (selectedCards.length === 2) {
    const first = selectedCards[0];
    const second = selectedCards[1];

    console.log("Thẻ 1:", first.dataset.id, first.dataset.type);
    console.log("Thẻ 2:", second.dataset.id, second.dataset.type);

    if (first.dataset.id === second.dataset.id && first.dataset.type !== second.dataset.type) {
      console.log("Cặp thẻ đúng khớp! Gọi showStarAndSpeak()");
      first.classList.add("matched");
      second.classList.add("matched");
      first.style.visibility = "hidden";
      second.style.visibility = "hidden";

      showStarAndSpeak();

      // 🆕 Lưu cả hai thẻ vào danh sách đã ghép đúng
      matchedWords.push(first.dataset.id, second.dataset.id);

      // 🆕 Kiểm tra chiến thắng sau khi cập nhật danh sách
      checkVictory();
    } else {
      setTimeout(() => {
        [first, second].forEach(card => (card.style.backgroundColor = "#e91e63"));
      }, 1000);
    }

    // 🆕 Xóa danh sách chọn sau khi kiểm tra
    selectedCards = [];
  }
}


// 🆕 Hàm hiển thị biểu tượng ngôi sao và đọc "wow"
function showStarAndSpeak() {
  console.log("showStarAndSpeak() được gọi");

  // 🆕 Phát âm "wow" sử dụng Web Speech API
  const utterance = new SpeechSynthesisUtterance("wow");
  window.speechSynthesis.speak(utterance);

  // 🆕 Tạo phần tử ngôi sao
  const star = document.createElement("span");
  star.innerText = "★";
  star.style.position = "fixed";
  star.style.top = "50%";
  star.style.left = "50%";
  star.style.transform = "translate(-50%, -50%) scale(3)";
  star.style.fontSize = "100px";
  star.style.color = "gold";
  star.style.zIndex = "9999";
  star.style.opacity = "0.8";
  document.body.appendChild(star);

  // 🆕 Xóa biểu tượng ngôi sao sau 1 giây
  setTimeout(() => {
    star.remove();
  }, 1000);
}

// 🆕 Hàm kiểm tra chiến thắng và hiển thị pháo hoa


import { showVictoryEffect } from './effect-win.js';
import { showDefeatEffect } from './effect-loose.js';

function setResultGamePart(mode, score, total) {
  const raw = localStorage.getItem("result_game");
  const prev = raw ? JSON.parse(raw) : {};

  const updated = {
    scoreGame1: mode === 1 ? score : prev.scoreGame1 || 0,
    scoreGame2: mode === 2 ? score : prev.scoreGame2 || 0,
    scoreGame3: mode === 3 ? score : prev.scoreGame3 || 0,
    totalGame1: mode === 1 ? total : prev.totalGame1 || 0,
    totalGame2: mode === 2 ? total : prev.totalGame2 || 0,
    totalGame3: mode === 3 ? total : prev.totalGame3 || 0
  };

  const totalScore = updated.scoreGame1 + updated.scoreGame2 + updated.scoreGame3;
  const totalMax   = updated.totalGame1 + updated.totalGame2 + updated.totalGame3;

  localStorage.setItem("result_game", JSON.stringify({
    ...updated,
    score: totalScore,
    total: totalMax
  }));
}


function checkVictory() {
  const totalPairs = parseInt(localStorage.getItem("totalWords")) || 0;
  const matchedPairs = matchedWords.length / 2;

  console.log("🔍 Kiểm tra số cặp phục vụ victory:", totalPairs);
  console.log("🔍 Số cặp đã ghép đúng:", matchedPairs);

  if (totalPairs > 0 && matchedPairs === totalPairs) {
    console.log("✅ Người chơi đã hoàn thành trò chơi!");

    const scorePercent = (matchedPairs / totalPairs) * 100;
    console.log("📊 Tỷ lệ đúng:", scorePercent.toFixed(2) + "%");

    if (scorePercent >= 70) {
      console.log("🏆 Hiệu ứng chiến thắng được gọi!");
      showVictoryEffect(); // 🎉 Hiệu ứng thắng
    } else {
      console.log("💥 Hiệu ứng thất bại được gọi!");
      showDefeatEffect(); // 💥 Hiệu ứng thua
    }

    // ✅ Ghi điểm cho Game 1 (ghi đè, giống listening)
    setResultGamePart(1, matchedPairs, totalPairs);

  }
}



// 🆕 Sự kiện khi trang tải xong, khởi động game
document.addEventListener("DOMContentLoaded", () => {
  console.log("✅ DOMContentLoaded đã được kích hoạt");
  setupGame();
});
