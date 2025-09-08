// ✅ Import Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
// ✅ Import dữ liệu Pokémon
import { pokemonData } from './pokemonData.js';

// ✅ Hàm chọn Pokémon theo tiến hoá và tỉ lệ
function getNextPokemonToCapture(currentList = []) {
  const owned = new Set(currentList);
  const stage1 = pokemonData.filter(p => p.stage === 1);
  const stage2 = pokemonData.filter(p => p.stage === 2);
  const stage3 = pokemonData.filter(p => p.stage === 3);

  if (currentList.length === 0) {
    const starters = stage1.filter(p => !p.evolvesFrom || p.name === "Pikachu");
    const chosen = starters[Math.floor(Math.random() * starters.length)];
    console.log(`🎯 Thu phục khởi đầu: ${chosen.name}`);
    return chosen;
  }

  const evolvable = pokemonData.filter(p => {
    return p.evolvesFrom && owned.has(p.evolvesFrom) && !owned.has(p.id);
  });

  const evolvableStage2 = evolvable.filter(p => p.stage === 2);
  const evolvableStage3 = evolvable.filter(p => {
    const from = pokemonData.find(x => x.id === p.evolvesFrom);
    return p.stage === 3 && from && owned.has(from.id);
  });

  const pool = [];

  for (let i = 0; i < 6; i++) {
    const candidates = stage1.filter(p => !owned.has(p.id));
    if (candidates.length) pool.push(candidates[Math.floor(Math.random() * candidates.length)]);
  }

  for (let i = 0; i < 3; i++) {
    if (evolvableStage2.length) pool.push(evolvableStage2[Math.floor(Math.random() * evolvableStage2.length)]);
  }

  for (let i = 0; i < 1; i++) {
    if (evolvableStage3.length) pool.push(evolvableStage3[Math.floor(Math.random() * evolvableStage3.length)]);
  }

  const finalPool = pool.filter(Boolean);
  const selected = finalPool[Math.floor(Math.random() * finalPool.length)];
  console.log(`🎯 Đã chọn từ pool: ${selected.name} (stage ${selected.stage})`);
  return selected;
}

// ✅ Cấu hình Firebase mới (bộ sưu tập Pokémon)
const firebaseConfig = {
  apiKey: "AIzaSyCCVdzWiiFvcWiHVJN-x33YKarsjyziS8E",
  authDomain: "pokemon-capture-10d03.firebaseapp.com",
  projectId: "pokemon-capture-10d03",
  storageBucket: "pokemon-capture-10d03.firebasestorage.app",
  messagingSenderId: "1068125543917",
  appId: "1:1068125543917:web:57de4365ee56729ea8dbe4"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ Lấy tên và lớp từ localStorage
const studentName = localStorage.getItem("trainerName") || "Không tên";
const studentClass = localStorage.getItem("trainerClass") || "Chưa có lớp";
document.getElementById("studentName").textContent = studentName;

// ✅ Tạo document ID
const docId = `${studentName}-${studentClass}`;

// ✅ Hàm cập nhật sao từ điểm hôm qua
async function updateStarsFromYesterday() {
  console.log("🔍 Bắt đầu kiểm tra cập nhật sao hôm nay...");

  try {
    const today = new Date();
    const todayCode = `${String(today.getDate()).padStart(2, '0')}${String(today.getMonth() + 1).padStart(2, '0')}${String(today.getFullYear()).slice(-2)}`;

    const yesterday = new Date(Date.now() - 86400000);
    const yesterdayCode = `${String(yesterday.getDate()).padStart(2, '0')}${String(yesterday.getMonth() + 1).padStart(2, '0')}${String(yesterday.getFullYear()).slice(-2)}`;

    const refCollection = doc(db, "bosuutap", docId);
    const snapCollection = await getDoc(refCollection);
    const data = snapCollection.exists() ? snapCollection.data() : null;

    if (data?.lastStarUpdate === todayCode) {
      console.log(`⏳ Hôm nay (${todayCode}) đã cập nhật sao rồi. Bỏ qua.`);
      return;
    }

    // ✅ Lấy điểm hôm qua từ Firebase cũ
    const oldFirebaseConfig = {
      apiKey: "AIzaSyBQ1pPmSdBV8M8YdVbpKhw_DOetmzIMwXU",
      authDomain: "lop-hoc-thay-tinh.firebaseapp.com",
      projectId: "lop-hoc-thay-tinh",
      storageBucket: "lop-hoc-thay-tinh.appspot.com",
      messagingSenderId: "391812475288",
      appId: "1:391812475288:web:ca4c275ac776d69deb23ed"
    };

    const { initializeApp: initOld, getApp: getOldApp } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js");
    const { getFirestore: getOldFirestore, doc: oldDoc, getDoc: oldGetDoc } = await import("https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js");

    let oldApp;
    try {
      oldApp = initOld(oldFirebaseConfig, "oldApp");
    } catch {
      oldApp = getOldApp("oldApp");
    }

    const oldDb = getOldFirestore(oldApp);
    const resultId = `${studentName}_${studentClass}_${yesterdayCode}`;
    const refResult = oldDoc(oldDb, "hocsinh", resultId);
    const snapResult = await oldGetDoc(refResult);

    if (!snapResult.exists()) {
      console.warn(`⚠️ Không tìm thấy kết quả hôm qua (${yesterdayCode}) trong Firebase cũ.`);
      return;
    }

    const resultData = snapResult.data();
    console.log("📦 Dữ liệu hôm qua:", resultData);

    const score = resultData.score || 0;
    const newStars = (data?.stars || 0) + score;

    await setDoc(refCollection, {
      ...data,
      stars: newStars,
      lastStarUpdate: todayCode
    });

    document.getElementById("starCount").textContent = newStars;
    console.log(`✅ Đã cộng ${score} sao từ kết quả hôm qua (${yesterdayCode}).`);
    console.log(`⭐ Tổng sao mới: ${newStars}`);
  } catch (error) {
    console.error("❌ Lỗi khi cập nhật sao:", error.message);
  }
}

// ✅ Hàm tải dữ liệu từ Firebase và hiển thị bộ sưu tập
async function loadCollection() {
  console.log("📥 Đang tải dữ liệu bộ sưu tập Pokémon...");

  try {
    const ref = doc(db, "bosuutap", docId);
    const snap = await getDoc(ref);

    if (!snap.exists()) {
      console.warn("⚠️ Không tìm thấy dữ liệu học sinh:", docId);
      return;
    }

    const data = snap.data();
    console.log("📦 Dữ liệu bộ sưu tập:", data);

    document.getElementById("starCount").textContent = data.stars || 0;

    const container = document.getElementById("pokemonCollection");
    container.innerHTML = "";

    (data.pokemons || []).forEach(id => {
      const imgURL = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
      const card = document.createElement("div");
      card.className = "pokemon-card";
      card.innerHTML = `<img src="${imgURL}" /><div>#${id}</div>`;
      container.appendChild(card);
    });

    console.log("✅ Đã hiển thị bộ sưu tập Pokémon");
    renderCapturedPokemons(data);


    // ✅ Gọi cập nhật sao sau khi tải xong
    updateStarsFromYesterday();
  } catch (error) {
    console.error("❌ Lỗi khi tải dữ liệu Firebase:", error.message);
  }
}

loadCollection();

// ✅ Bắt đầu quy trình thu phục Pokémon
document.getElementById("startCaptureBtn").addEventListener("click", async () => {
  console.log("🎯 Bắt đầu kiểm tra điều kiện thu phục...");

  const ref = doc(db, "bosuutap", docId);
  const snap = await getDoc(ref);

  if (!snap.exists()) {
    alert("❌ Không tìm thấy dữ liệu học sinh.");
    return;
  }

  const data = snap.data();
  const currentStars = data.stars || 0;
  const today = new Date().toISOString().slice(0, 10);

  if (currentStars < 500) {
    alert("❌ Bạn chưa đủ 500 sao để thu phục Pokémon.");
    console.log("❌ Không đủ sao để thu phục.");
    return;
  }

  // ✅ Trừ 500 sao và ghi lại
  const newStars = currentStars - 500;
  await setDoc(ref, {
    ...data,
    stars: newStars,
    lastCaptureDate: today
  });

  document.getElementById("starCount").textContent = newStars;
  console.log(`✅ Đã trừ 500 sao. Còn lại: ${newStars}`);
  console.log("🧠 Bắt đầu tạo quiz thu phục...");

  // ✅ Tạo quiz từ sheet từ vựng (mỗi câu từ một bài khác nhau)
  const numQuestions = 1; // ✅ Sửa tại đây nếu muốn đổi số câu
  const currentLessonCode = parseInt(localStorage.getItem("selectedLesson") || "9999");

  const SHEET_TU_VUNG = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
  const res = await fetch(SHEET_TU_VUNG);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows.slice(1); // ✅ Bỏ dòng đầu tiên

  const baiTuVung = {};
  rows.forEach(r => {
    const rawCode = r.c[1]?.v;
    const word = r.c[2]?.v?.toString().trim();
    const meaning = r.c[24]?.v?.toString().trim();

    if (!rawCode || !word || !meaning) return;

    const codeStr = rawCode.toString().trim();
    const normalizedCode = parseInt(codeStr.replace(/\D/g, ""));
    if (isNaN(normalizedCode) || normalizedCode >= currentLessonCode) return;

    if (!baiTuVung[normalizedCode]) baiTuVung[normalizedCode] = [];
    baiTuVung[normalizedCode].push({ word, meaning });
  });


  const allCodes = Object.keys(baiTuVung).map(c => parseInt(c));
  const shuffledCodes = allCodes.sort(() => Math.random() - 0.5);
  const selectedCodes = shuffledCodes.slice(0, numQuestions);

  const quizItems = [];
  selectedCodes.forEach(code => {
    const words = baiTuVung[code];
    if (words && words.length > 0) {
      const item = words[Math.floor(Math.random() * words.length)];
      quizItems.push(item);
    }
  });

  const container = document.getElementById("quizContainer");
  container.innerHTML = "";
  document.getElementById("quizSection").style.display = "block";

  quizItems.forEach((item, index) => {
    const allMeanings = rows
      .map(r => r.c[24]?.v?.toString().trim())
      .filter(m => m && m !== item.meaning);

    const wrongOptions = allMeanings.sort(() => Math.random() - 0.5).slice(0, 3);
    const allOptions = [...wrongOptions, item.meaning].sort(() => Math.random() - 0.5);

    const div = document.createElement("div");
    div.className = "quiz-item";
    div.innerHTML = `<strong>Câu ${index + 1}:</strong> Nghĩa của "<em>${item.word}</em>"<br/>`;

    allOptions.forEach((opt, i) => {
      const label = String.fromCharCode(65 + i);
      div.innerHTML += `
        <label>
          <input type="radio" name="q${index}" value="${opt}" data-correct="${item.meaning}" />
          ${label}. ${opt}
        </label><br/>
      `;
    });

    container.appendChild(div);
  });

  console.log(`✅ Đã tạo quiz từ ${selectedCodes.length} bài, mỗi bài 1 từ.`);
});

document.getElementById("submitQuizBtn").addEventListener("click", async () => {
  const radios = document.querySelectorAll("input[type=radio]:checked");
  let correctCount = 0;

  radios.forEach(r => {
    if (r.value === r.dataset.correct) correctCount++;
  });

  const totalQuestions = document.querySelectorAll(".quiz-item").length;
  const passThreshold = Math.ceil(totalQuestions * 0.8);

  console.log(`📊 Số câu đúng: ${correctCount}/${totalQuestions} | Yêu cầu: ≥${passThreshold}`);

  if (correctCount >= passThreshold) {
    const ref = doc(db, "bosuutap", docId);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {};
    const currentList = data.pokemons || [];
    const owned = new Set(currentList);

    const newPokemonObj = getNextPokemonToCapture(currentList);
    const newPokemon = newPokemonObj.id;
    let updatedList = [...currentList];
    let message = "";

    if (newPokemonObj.evolvesFrom && owned.has(newPokemonObj.evolvesFrom)) {
      updatedList = updatedList.filter(id => id !== newPokemonObj.evolvesFrom);
      message = `✨ Tiến hoá lên ${newPokemonObj.name}!`;
      console.log(`🔁 Tiến hoá: ${newPokemonObj.evolvesFrom} → ${newPokemon}`);
    } else {
      message = `✅ Thu phục thành công ${newPokemonObj.name}!`;
      console.log(`🆕 Thu phục mới: ${newPokemonObj.name}`);
    }

    updatedList.push(newPokemon);

    await setDoc(ref, {
      ...data,
      pokemons: updatedList,
      selected: newPokemon,
      stage: newPokemonObj.stage
    });

    // ✅ Tạo hiệu ứng PokéBall
    const pokeball = document.createElement('img');
    pokeball.src = 'https://cdn-icons-png.flaticon.com/512/361/361998.png';
    pokeball.alt = 'PokéBall';
    pokeball.style.position = 'fixed';
    pokeball.style.top = '50%';
    pokeball.style.left = '50%';
    pokeball.style.transform = 'translate(-50%, -50%)';
    pokeball.style.height = '120px';
    pokeball.style.zIndex = '1000';
    pokeball.style.animation = 'shake 1s ease-in-out 3';
    document.body.appendChild(pokeball);

    const style = document.createElement('style');
    style.innerHTML = `
      @keyframes shake {
        0%, 100% { transform: translate(-50%, -50%) rotate(0deg); }
        25% { transform: translate(-50%, -50%) rotate(10deg); }
        50% { transform: translate(-50%, -50%) rotate(-10deg); }
        75% { transform: translate(-50%, -50%) rotate(10deg); }
      }

      @keyframes summon {
        from { opacity: 0; transform: translate(-50%, -50%) scale(0.5); }
        to { opacity: 1; transform: translate(-50%, -50%) scale(1.4); }
      }
    `;
    document.head.appendChild(style);

    // ✅ Hiện Pokémon sau hiệu ứng
    setTimeout(() => {
      pokeball.remove();

      const pokemonImg = document.createElement('img');
      pokemonImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${newPokemon}.png`;
      pokemonImg.alt = newPokemonObj.name;
      pokemonImg.style.position = 'fixed';
      pokemonImg.style.top = '50%';
      pokemonImg.style.left = '50%';
      pokemonImg.style.transform = 'translate(-50%, -50%)';
      pokemonImg.style.height = '140px';
      pokemonImg.style.zIndex = '1000';
      pokemonImg.style.animation = 'summon 0.6s ease-out';
      document.body.appendChild(pokemonImg);

      setTimeout(() => {
        alert(message);
        window.location.reload();
      }, 1000);
    }, 3000);
  } else {
    alert("❌ Bạn chưa đủ điểm để thu phục Pokémon.");
    console.log("❌ Không vượt qua bài kiểm tra.");

    document.getElementById("quizSection").style.display = "none";
    document.getElementById("quizContainer").innerHTML = "";
  }
});

function renderCapturedPokemons(data) {
  const container = document.getElementById("pokemonCollection");
  const infoBox = document.getElementById("selectedPokemonInfo");
  container.innerHTML = "";
  infoBox.textContent = "";

  const captured = data.pokemons || [];
  const selectedId = data.selected;

  captured.forEach(id => {
    const p = pokemonData.find(p => p.id === id);
    if (!p) return;

    const card = document.createElement("div");
    card.className = "pokemon-card";
    card.innerHTML = `
      <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${p.id}.png" alt="${p.name}" />
      <p>#${p.id} - ${p.name}</p>
      <button>Chọn để xuất chiến</button>
    `;

    card.querySelector("button").addEventListener("click", async () => {
      const ref = doc(db, "bosuutap", docId);
      await setDoc(ref, {
        ...data,
        selected: p.id
      });

      infoBox.textContent = `🛡️ Bạn đang chọn Pokémon ${p.name} (#${p.id}) để xuất chiến`;
      console.log(`✅ Đã chọn Pokémon ${p.name} (#${p.id}) để xuất chiến`);
    });

    container.appendChild(card);

    if (p.id === selectedId) {
      infoBox.textContent = `🛡️ Bạn đang chọn Pokémon ${p.name} (#${p.id}) để xuất chiến`;
    }
  });
}



