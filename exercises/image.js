// ✅ Import hiệu ứng PokéBall từ module
import { showCatchEffect } from './pokeball-effect.js';

const wordBank = JSON.parse(localStorage.getItem("wordBank")) || [];
const uniqueWords = [...new Set(wordBank)];

const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
const PEXELS_API_KEY = "DsgAHtqZS5lQtujZcSdZsOHIhoa9NtT6GVMQ3Xn7DQiyDJ9FKDhgo2GQ";

// ✅ Reset điểm nếu mở lại trang
["score1", "score2", "score3", "total1", "total2", "total3", "isSessionStarted"].forEach(k => {
  localStorage.removeItem(k);
});


if (!localStorage.getItem("isSessionStarted")) {
  ["score1", "score2", "score3", "total1", "total2", "total3"].forEach(k => localStorage.removeItem(k));
  localStorage.setItem("isSessionStarted", "true");
}

let vocabData = [];
let currentIndex = 0;
let score = 0;
let mode = 1;

function speak(word) {
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = "en-US";
  speechSynthesis.speak(utter);
}

function shuffle(arr) {
  return arr.sort(() => Math.random() - 0.5);
}

async function fetchWords() {
  const res = await fetch(SHEET_URL);
  const txt = await res.text();
  const json = JSON.parse(txt.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const all = rows.map(row => ({
    word: row.c[2]?.v?.trim() || "",
    meaning: row.c[24]?.v?.trim() || ""
  }));

  return shuffle(all.filter(item => uniqueWords.includes(item.word)));
}

async function getImage(word) {
  try {
    const res = await fetch(`https://api.pexels.com/v1/search?query=${word}&per_page=1`, {
      headers: { Authorization: PEXELS_API_KEY }
    });
    const data = await res.json();
    return data.photos[0]?.src.medium || "fallback.jpg";
  } catch {
    return "fallback.jpg";
  }
}

function updateScoreBoard() {
  let s1 = +localStorage.getItem("score1") || 0;
  let s2 = +localStorage.getItem("score2") || 0;
  let s3 = +localStorage.getItem("score3") || 0;
  let t1 = +localStorage.getItem("total1") || 0;
  let t2 = +localStorage.getItem("total2") || 0;
  let t3 = +localStorage.getItem("total3") || 0;

  document.getElementById("scoreBoard").innerHTML = `
    <p>🧠 Dạng 1: ${s1}/${t1}</p>
    <p>🖼️ Dạng 2: ${s2}/${t2}</p>
    <p>🎨 Dạng 3: ${s3}/${t3}</p>
    <hr>
    <p><strong>🎯 Tổng: ${s1 + s2 + s3}/${t1 + t2 + t3}</strong></p>
  `;
}

document.querySelectorAll(".mode-btn").forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll(".mode-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    mode = parseInt(btn.dataset.mode);
    startMode(mode);
  };
});

function startMode(m) {
  currentIndex = 0;
  score = 0;
  document.getElementById("exerciseArea").innerHTML = "";
  document.getElementById("finalBox").textContent = "";
  updateScoreBoard();

  fetchWords().then(data => {
    vocabData = data;
    if (vocabData.length > 0) {
      if (m === 1) showD1();
      if (m === 2) showD2();
      if (m === 3) showD3();
    }
  });
}

function showCompletedMessageImage(mode, score, total) {
  const box = document.getElementById("finalBox");
  const color = mode === 1 ? "green" : mode === 2 ? "blue" : "purple";
  box.innerHTML = `<p style="color:${color};">🎉 Đã hoàn tất dạng ${mode}. Điểm: ${score}/${total}</p>`;
  document.querySelector(`[data-mode='${mode}']`).disabled = true;
}

// ------------------ DẠNG 1 ------------------
async function showD1() {
  const area = document.getElementById("exerciseArea");
  area.innerHTML = `
    <button id="playSoundD1">🔊 Nghe từ</button>
    <div id="cardsD1" style="display:flex;flex-wrap:wrap;justify-content:center;gap:12px;margin:20px;"></div>
    <p id="resultD1"></p>
  `;

  const current = vocabData[currentIndex];
  speak(current.word);

  const wrong = vocabData.filter(item => item.word !== current.word);
  const options = [current, ...wrong.slice(0, 3)];
  const mixed = shuffle(options);

  const container = document.getElementById("cardsD1");

  for (let item of mixed) {
    const imgUrl = await getImage(item.word);
    const card = document.createElement("div");
    card.style.width = "160px";
    card.style.border = "3px solid #fff9c4";
    card.style.borderRadius = "12px";
    card.style.padding = "8px";
    card.style.background = "#fff";
    card.style.color = "#000";
    card.innerHTML = `<img src="${imgUrl}" style="width:100%;border-radius:8px;" /><p>${item.meaning}</p>`;
    card.onclick = () => handleD1(item.word);
    container.appendChild(card);
  }

  document.getElementById("playSoundD1").onclick = () => speak(current.word);
}

function handleD1(selected) {
  const current = vocabData[currentIndex];
  const correct = current.word;
  const result = document.getElementById("resultD1");

  if (selected === correct) {
    score++;
    result.textContent = "✅ Chính xác!";
  } else {
    result.textContent = `❌ Sai rồi. Đáp án là: ${correct}`;
  }

  currentIndex++;
  setTimeout(() => {
    if (currentIndex < vocabData.length) {
      showD1();
    } else {
      localStorage.setItem("score1", score);
      localStorage.setItem("total1", vocabData.length);
      updateScoreBoard();
      showCompletedMessageImage(1, score, vocabData.length);
      checkGameEnd();
    }
  }, 1200);
}
// ------------------ DẠNG 2 ------------------
async function showD2() {
  const area = document.getElementById("exerciseArea");
  area.innerHTML = `
    <button id="playSoundD2">🔊 Nghe từ</button>
    <div style="margin:20px;"><img id="imageD2" src="" style="width:280px;border-radius:12px;" /></div>
    <div id="choicesD2" style="display:flex;flex-direction:column;gap:12px;align-items:center;"></div>
    <p id="resultD2"></p>
  `;

  const current = vocabData[currentIndex];
  speak(current.word);

  const imgUrl = await getImage(current.word);
  document.getElementById("imageD2").src = imgUrl;

  const wrong = vocabData.filter(item => item.word !== current.word);
  const options = [current.word, ...wrong.map(w => w.word).slice(0, 3)];
  const mixed = shuffle(options);

  const box = document.getElementById("choicesD2");
  mixed.forEach((w, i) => {
    const btn = document.createElement("button");
    btn.textContent = `${String.fromCharCode(65 + i)}. ${w}`;
    btn.style.padding = "10px 16px";
    btn.style.borderRadius = "12px";
    btn.style.border = "none";
    btn.style.cursor = "pointer";
    btn.style.fontSize = "16px";
    btn.style.background = "#fff9c4";
    btn.onclick = () => handleD2(w);
    box.appendChild(btn);
  });

  document.getElementById("playSoundD2").onclick = () => speak(current.word);
}

function handleD2(selected) {
  const current = vocabData[currentIndex];
  const correct = current.word;
  const result = document.getElementById("resultD2");

  if (selected === correct) {
    score++;
    result.textContent = "✅ Chính xác!";
  } else {
    result.textContent = `❌ Sai rồi. Đáp án là: ${correct}`;
  }

  currentIndex++;
  setTimeout(() => {
    if (currentIndex < vocabData.length) {
      showD2();
    } else {
      localStorage.setItem("score2", score);
      localStorage.setItem("total2", vocabData.length);
      updateScoreBoard();
      showCompletedMessageImage(2, score, vocabData.length);
      checkGameEnd();
    }
  }, 1400);
}

// ------------------ DẠNG 3 ------------------
async function showD3() {
  const area = document.getElementById("exerciseArea");
  area.innerHTML = `
    <button id="playSoundD3">🔊 Nghe từ</button>
    <div style="margin:20px;"><img id="imageD3" class="blur" src="" style="width:280px;border-radius:12px;filter:blur(3px);transition:0.3s;" /></div>
    <input type="text" id="inputD3" placeholder="Gõ từ tiếng Anh" style="padding:10px;font-size:16px;border-radius:10px;width:60%;max-width:300px;" />
    <br><button id="submitD3">Trả lời</button>
    <p id="resultD3"></p>
  `;

  const current = vocabData[currentIndex];
  speak(current.word);

  const imgUrl = await getImage(current.word);
  const img = document.getElementById("imageD3");
  img.src = imgUrl;
  img.classList.add("blur");

  document.getElementById("submitD3").onclick = () => handleD3(current);
  document.getElementById("playSoundD3").onclick = () => speak(current.word);
}

function handleD3(current) {
  const input = document.getElementById("inputD3").value.trim().toLowerCase();
  const correct = current.word.toLowerCase();
  const resultBox = document.getElementById("resultD3");
  const img = document.getElementById("imageD3");

  if (input === correct) {
    score++;
    resultBox.textContent = "✅ Chính xác!";
  } else {
    resultBox.textContent = `❌ Sai rồi. Đáp án là: ${current.word}`;
  }

  img.classList.remove("blur");
  resultBox.innerHTML += `<p><strong>${current.word}</strong>: ${current.meaning}</p>`;
  speak(current.word);

  currentIndex++;
  setTimeout(() => {
    if (currentIndex < vocabData.length) {
      showD3();
    } else {
      localStorage.setItem("score3", score);
      localStorage.setItem("total3", vocabData.length);
      updateScoreBoard();
      showCompletedMessageImage(3, score, vocabData.length);
      checkGameEnd();
    }
  }, 2000);
}

// ------------------ TỔNG KẾT & HIỆU ỨNG ------------------
function checkGameEnd() {
  const s1 = Number(localStorage.getItem("score1")) || 0;
  const s2 = Number(localStorage.getItem("score2")) || 0;
  const s3 = Number(localStorage.getItem("score3")) || 0;

  const t1 = Number(localStorage.getItem("total1")) || 0;
  const t2 = Number(localStorage.getItem("total2")) || 0;
  const t3 = Number(localStorage.getItem("total3")) || 0;

  const totalScore = s1 + s2 + s3;
  const totalMax = t1 + t2 + t3;

  // ✅ Ghi lại vào localStorage theo chuẩn summary.js
  localStorage.setItem("result_image", JSON.stringify({
    score: totalScore,
    total: totalMax
  }));

  // 👉 Nếu chưa làm hết 3 dạng thì không hiển thị gì
  if (t1 === 0 || t2 === 0 || t3 === 0) return;

  // ✅ UI hiển thị kết quả
  const container = document.querySelector(".quiz-container");
  container.innerHTML = `
    <h2 style="color:hotpink;">🎯 Đã hoàn tất cả 3 dạng!</h2>
    <p style="color:hotpink;">Tổng điểm: ${totalScore} / ${totalMax}</p>
    <div style="font-size: 60px; color:hotpink;">✨ Sẵn sàng bắt Pokémon ✨</div>
  `;

  // ✅ Gọi hiệu ứng nếu đạt từ 50%
  if (totalMax > 0 && totalScore >= totalMax / 2) {
    showCatchEffect(container);
  }
}

