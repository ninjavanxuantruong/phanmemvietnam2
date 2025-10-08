// speaking3.js (ES module)
const SHEET_UNITS = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
const SHEET_LESSONS = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
const MIN_UNIT_NUM = 3031;
const PIXABAY_KEY = "51268254-554135d72f1d226beca834413";

let speakingItems = []; // unique name to avoid collisions
let currentIndex = 0;
let score = 0;

// UI refs
const progressBalls = Array.from(document.querySelectorAll('.ball-small'));
const imgEl = document.getElementById('vocabImage');
const hintEl = document.getElementById('hintText');
const targetEl = document.getElementById('targetWord');
const lessonEl = document.getElementById('lessonCode');
const resultEl = document.getElementById('speechResult');
const scoreEl = document.getElementById('scoreValue');
const pokemonEmoteEl = document.getElementById('pokemonEmote');
const prevBtn = document.getElementById('prevBtn');
const nextBtn = document.getElementById('nextBtn');
const recordBtn = document.getElementById('recordBtn');

// Helpers
function normalizeUnitId(unitStr){
  const m = (unitStr || "").trim().match(/^(\d+)-(\d+)-(\d+)$/);
  if (!m) return 0;
  return parseInt(m[1],10)*1000 + parseInt(m[2],10)*10 + parseInt(m[3],10);
}
function normalizeClass(raw){
  const n = parseInt((raw||"").replace(/\D/g,""),10);
  return Number.isFinite(n) ? n : null;
}
function splitTargets(rawTarget){
  return (rawTarget||"").toLowerCase().split(/[/;,]/).map(s=>s.trim()).filter(Boolean);
}
function normText(s){ return (s||"").toLowerCase().replace(/[^a-z0-9'\s]/g,"").trim(); }
function pickRandom(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

async function fetchGVizRows(url){
  console.log("🔗 Fetch GViz:", url);
  const res = await fetch(url);
  const txt = await res.text();
  const json = JSON.parse(txt.substring(47).replace(/\);$/, ""));
  const rows = json.table?.rows || [];
  console.log("📥 GViz parsed rows:", rows.length);
  return rows;
}

function numberToUnitStr(num){
  const s = num.toString().padStart(4,"0");
  return `${s[0]}-${s.slice(1,3)}-${s[3]}`;
}

async function getMaxLessonCode(trainerClassRaw){
  const classNum = normalizeClass(trainerClassRaw);
  console.log("🎓 TrainerClass raw:", trainerClassRaw, "→ normalized:", classNum);
  if (!classNum) return null;

  const rows = await fetchGVizRows(SHEET_LESSONS);
  console.log("🗂 Lessons sample:", rows.slice(0,3).map(r=>({A:r.c?.[0]?.v, C:r.c?.[2]?.v})));

  const codes = rows.map(r=>{
    const lopNum = normalizeClass(r.c?.[0]?.v?.toString().trim());
    const baiNum = parseInt(r.c?.[2]?.v?.toString().trim(),10);
    if (lopNum===classNum && Number.isFinite(baiNum)){
      return normalizeUnitId(numberToUnitStr(baiNum));
    }
    return null;
  }).filter(v=>typeof v==="number");

  console.log("📊 Max lesson candidates:", codes);
  return codes.length ? Math.max(...codes) : null;
}

async function fetchPresentationRows(){
  const rows = await fetchGVizRows(SHEET_UNITS);
  console.log("🔎 Units first 3 raw (B/C/I):", rows.slice(0,3).map(r=>({
    B:r.c?.[1]?.v, C:r.c?.[2]?.v, I:r.c?.[8]?.v
  })));

  const items = rows.map((r, idx)=>{
    const unitStr = r.c?.[1]?.v?.toString().trim() || "";
    const vocabRaw = r.c?.[2]?.v?.toString().trim() || "";
    const presentation = r.c?.[8]?.v?.toString().trim() || "";
    const unitNum = unitStr ? normalizeUnitId(unitStr) : 0;
    const targets = splitTargets(vocabRaw);

    // Per-row log (requested)
    console.log("🧩 Row", idx, { unitStr, vocabRaw, presentation, unitNum, targets });

    return { unitStr, unitNum, targets, presentation };
  }).filter(it=>it.unitStr && it.unitNum && it.presentation);

  console.log("📦 Presentation items count:", items.length);
  return items;
}

function makeHint(text){
  const w = (text||"").split(/\s+/).filter(Boolean);
  return (w.slice(0,2).join(" ") || "...") + "...";
}

// Images
const imageCache = {};
function fetchImageForKeyword(keyword){
  const kw = (keyword||"").trim().toLowerCase();
  if (!kw) return Promise.resolve(null);
  const apiUrl = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(`${kw} cartoon`)}&image_type=illustration&safesearch=true&per_page=5`;
  console.log("🖼️ Fetching image:", kw, apiUrl);
  return fetch(apiUrl)
    .then(res=>res.json())
    .then(data=>{
      console.log("🖼️ Pixabay response:", data);
      if (data.hits?.length){
        const chosen = data.hits[Math.floor(Math.random()*data.hits.length)];
        console.log("🖼️ Chosen image:", chosen.webformatURL, "for:", kw);
        return { url: chosen.webformatURL, keyword: kw };
      }
      console.warn("⚠️ No image found for:", kw);
      return null;
    })
    .catch(err=>{
      console.error("❌ Pixabay error:", err);
      return null;
    });
}

// Build items
async function buildSpeaking3Items() {
  const trainerClassRaw = localStorage.getItem("trainerClass")?.trim() || "";
  const wordBankRaw = localStorage.getItem("wordBank");
  const wordBank = wordBankRaw ? (JSON.parse(wordBankRaw) || []).map(w => normText(w)) : [];

  console.log("🧩 trainerClass:", trainerClassRaw);
  console.log("🧩 wordBank:", wordBank);

  if (!trainerClassRaw) throw new Error("Thiếu trainerClass (vd: '3' hoặc 'Lớp 3').");
  if (!wordBank.length) throw new Error("wordBank rỗng. Hãy set localStorage.wordBank là mảng từ vựng.");

  const maxLessonCode = await getMaxLessonCode(trainerClassRaw);
  console.log("🏁 MaxLessonCode:", maxLessonCode);
  if (!maxLessonCode) throw new Error(`Không tìm thấy bài lớn nhất cho lớp "${trainerClassRaw}"`);

  const all = await fetchPresentationRows();
  const classNum = normalizeTrainerClass(trainerClassRaw);

  // Nhóm theo bài (cột B: unitStr)
  const unitMap = new Map(); // key: unitStr, value: array of rows [{unitStr, unitNum, targets, presentation}]
  for (const row of all) {
    if (!unitMap.has(row.unitStr)) unitMap.set(row.unitStr, []);
    unitMap.get(row.unitStr).push(row);
  }

  // Lọc bài hợp lệ: đúng lớp, trong khoảng <= maxLessonCode, có ít nhất 1 câu thuyết trình
  const eligibleUnits = Array.from(unitMap.entries())
    .filter(([unitStr, rows]) => {
      const unitNum = normalizeUnitId(unitStr);
      const inRange = unitNum >= MIN_UNIT_NUM && unitNum <= maxLessonCode;
      const correctClass = classNum ? unitStr.startsWith(`${classNum}-`) : true;
      const hasPresentation = rows.some(r => !!r.presentation);
      return inRange && correctClass && hasPresentation;
    })
    .map(([unitStr, rows]) => ({ unitStr, unitNum: normalizeUnitId(unitStr), rows }));

  console.log("📚 Eligible units:", eligibleUnits.length);
  console.log("📚 Eligible units sample:", eligibleUnits.slice(0, 5).map(u => u.unitStr));

  if (!eligibleUnits.length) {
    console.warn("📊 Filter stats (units):", {
      MIN_UNIT_NUM,
      countMin: all.filter(it => it.unitNum >= MIN_UNIT_NUM).length,
      countMax: all.filter(it => it.unitNum <= maxLessonCode).length,
      countClass: all.filter(it => classNum ? it.unitStr.startsWith(`${classNum}-`) : true).length,
      countPres: all.filter(it => !!it.presentation).length
    });
    throw new Error("Không có dữ liệu hợp lệ");
  }

  const speakingItems = [];

  // 1) Câu đầu: nếu tìm được bài chứa từ vựng random trong wordBank, lấy một câu từ bài đó
  const randomWord = pickRandom(wordBank);
  console.log("🎯 Random word:", randomWord);

  const unitWithWord = eligibleUnits.find(u => u.rows.some(r => r.targets.includes(randomWord)));
  if (unitWithWord) {
    const row = pickRandom(unitWithWord.rows.filter(r => r.presentation));
    const firstTarget = (row.targets.find(t => wordBank.includes(t)) || row.targets[0] || "").trim();
    const firstHint = makeHint(row.presentation);

    console.log("🎯 First from unit:", unitWithWord.unitStr, {
      target: firstTarget, hint: firstHint, text: row.presentation
    });

    const firstImage = await fetchImageForKeyword(firstTarget);
    speakingItems.push({
      fullText: row.presentation,
      hint: firstHint,
      target: firstTarget,
      lesson: unitWithWord.unitStr,
      imageUrl: firstImage?.url || ""
    });

    // Loại bài này khỏi pool để không trùng
    const idx = eligibleUnits.findIndex(u => u.unitStr === unitWithWord.unitStr);
    if (idx >= 0) eligibleUnits.splice(idx, 1);
  } else {
    console.warn("⚠️ Không tìm thấy bài chứa randomWord. Sẽ chọn toàn bộ từ pool ngẫu nhiên.");
  }

  // 2) Chọn 9 bài còn lại (mỗi bài 1 câu I)
  const shuffledUnits = [...eligibleUnits].sort(() => Math.random() - 0.5);
  const unitsPicked = shuffledUnits.slice(0, Math.max(0, 10 - speakingItems.length)); // để đủ 10 tổng

  console.log("📌 Units picked:", unitsPicked.map(u => u.unitStr));

  for (const u of unitsPicked) {
    // Chỉ lấy 1 câu thuyết trình từ bài này
    const rowsWithPresentation = u.rows.filter(r => r.presentation);
    const chosenRow = pickRandom(rowsWithPresentation);
    const target = (chosenRow.targets[0] || "").trim();
    const hint = makeHint(chosenRow.presentation);

    console.log("➕ Add from unit:", u.unitStr, { target, hint, text: chosenRow.presentation });

    const img = target ? await fetchImageForKeyword(target) : null;
    speakingItems.push({
      fullText: chosenRow.presentation,
      hint,
      target,
      lesson: u.unitStr,
      imageUrl: img?.url || ""
    });

    if (speakingItems.length >= 10) break;
  }

  console.log("📦 Final speakingItems:", speakingItems.length);
  console.log("📦 Sample:", speakingItems.slice(0, 3));

  // Prefetch ảnh vào cache (nếu dùng cache)
  const prefetchPromises = speakingItems.map(async it => {
    const key = (it.target || it.fullText || "").trim().toLowerCase();
    if (!imageCache[key] && it.target) {
      const img = await fetchImageForKeyword(it.target);
      if (img?.url) {
        imageCache[key] = img;
        if (!it.imageUrl) it.imageUrl = img.url;
      }
    }
  });
  await Promise.all(prefetchPromises);
  console.log("🗃️ ImageCache keys:", Object.keys(imageCache));

  return speakingItems;
}


// Render + scoring
function setActiveProgress(i){
  progressBalls.forEach((b, idx)=> b.classList.toggle('active', idx < i+1));
}
async function render(i){
  const it = speakingItems[i];
  if (!it) return;

  hintEl.textContent = it.hint || "...";
  targetEl.textContent = it.target || "...";
  lessonEl.textContent = it.lesson || "...";

  if (!it.imageUrl && it.target){
    const key = (it.target || it.fullText || "").trim().toLowerCase();
    const cached = imageCache[key];
    if (cached?.url){
      it.imageUrl = cached.url;
      console.log("🖼️ Use cached image:", cached.url, "for:", key);
    } else {
      const img = await fetchImageForKeyword(it.target);
      it.imageUrl = img?.url || "";
      if (img) imageCache[key] = img;
    }
  }

  imgEl.src = it.imageUrl || "";
  imgEl.alt = it.target || "vocab";
  resultEl.innerHTML = 'Kết quả sẽ hiện ở đây.';
  scoreEl.textContent = String(score);
  setActiveProgress(i);

  pokemonEmoteEl.className = 'emote';
  pokemonEmoteEl.textContent = '⚡️';
}

function checkAccuracy(userText, correctText, targetWord){
  const tWords = normText(correctText).split(/\s+/).filter(Boolean);
  const uSet = new Set(normText(userText).split(/\s+/).filter(Boolean));
  let hit = 0;
  for (const w of tWords) if (uSet.has(w)) hit++;
  const percent = tWords.length ? Math.round((hit/tWords.length)*100) : 0;
  const hasTarget = targetWord ? uSet.has(normText(targetWord)) : false;
  const pass = percent >= 50 || hasTarget;
  return { percent, hit, total: tWords.length, pass, hasTarget };
}

// SpeechRecognition (Speaking 2 style)
let recognition = null;
let isListening = false;
function setupRecognition(){
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition){
    console.warn("⚠️ Browser không hỗ trợ SpeechRecognition.");
    return;
  }
  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;

  recognition.onstart = ()=>{ isListening = true; resultEl.textContent = "🎙️ Đang nghe..."; };
  recognition.onend = ()=>{ isListening = false; };
  recognition.onerror = (e)=>{ isListening=false; console.error("❌ Rec error:", e.error); resultEl.textContent = `❌ Lỗi: ${e.error}`; try{ recognition.abort(); }catch{} };
  recognition.onresult = (event)=>{
    const transcript = event.results?.[0]?.[0]?.transcript?.toLowerCase()?.trim() || "";
    const it = speakingItems[currentIndex];
    const { percent, hit, total, pass, hasTarget } = checkAccuracy(transcript, it.fullText, it.target);
    resultEl.innerHTML = `✅ Bạn nói: "<i>${transcript}</i>"<br>🎯 Đúng ${hit}/${total} từ → <b>${percent}%</b>${it.target ? `<br>🔑 Từ vựng: <b>${it.target}</b> (${hasTarget ? "✅ có" : "❌ không"})` : ""}`;

    if (pass){
      score++;
      scoreEl.textContent = String(score);
      pokemonEmoteEl.textContent = '✨';
      pokemonEmoteEl.classList.add('react-good');
    } else {
      pokemonEmoteEl.textContent = '💧';
      pokemonEmoteEl.classList.add('react-bad');
    }
    console.log("🧮 Score update:", { currentIndex, score, percent, pass });
  };
}

// Events
prevBtn.addEventListener('click', async ()=>{
  if (recognition && isListening) { try{ recognition.abort(); }catch{} }
  if (currentIndex > 0){ currentIndex--; await render(currentIndex); }
});
nextBtn.addEventListener('click', async ()=>{
  if (recognition && isListening) { try{ recognition.abort(); }catch{} }
  if (currentIndex < speakingItems.length - 1){ currentIndex++; await render(currentIndex); }
  else {
    const percentTotal = speakingItems.length ? Math.round((score/speakingItems.length)*100) : 0;
    if (percentTotal >= 50){
      resultEl.innerHTML = `🎉 Hoàn thành! Điểm: <strong>${score}/${speakingItems.length}</strong> → <strong>${percentTotal}%</strong>`;
    } else {
      resultEl.innerHTML = `🚫 Chưa đạt. Điểm: <strong>${score}/${speakingItems.length}</strong> → <strong>${percentTotal}%</strong>`;
    }
  }
});
recordBtn.addEventListener('click', ()=>{
  if (!recognition){ resultEl.textContent = "⚠️ Trình duyệt không hỗ trợ thu âm."; return; }
  if (isListening) return;
  try { recognition.start(); }
  catch(err){
    try{ recognition.abort(); }catch{}
    setTimeout(()=>{ try{ recognition.start(); }catch(e2){ resultEl.textContent="❌ Không thể bắt đầu nhận giọng. Kiểm tra mic/HTTPS."; } }, 120);
  }
});

// Init
(async function init(){
  try {
    console.log("🚀 Init Speaking 3");
    setupRecognition();
    speakingItems = await buildSpeaking3Items();
    if (!speakingItems.length){
      resultEl.textContent = "📭 Không có dữ liệu Speaking 3 hợp lệ.";
      return;
    }
    currentIndex = 0;
    score = 0;
    await render(currentIndex);
    console.log("✅ Ready. Items:", speakingItems.length);
  } catch (e) {
    console.error("❌ Init error:", e);
    resultEl.textContent = "❌ Không thể khởi tạo Speaking 3. Kiểm tra dữ liệu.";
  }
})();
