// Speaking 3 — built from Speaking 2 flow, with images, hint-on-2-words, and final paragraph reading.
// Notes:
// - Uses column I for presentation sentences, column C for vocab, column B for lesson name.
// - Shows only first two words as hint (e.g., "my name...").
// - Does NOT auto-speak at render; speaks the correct full sentence AFTER scoring.
// - Fetches and displays an image for each sentence via Pixabay; caches by keyword.
// - After all sentences, builds a paragraph of all sentences, plays sample, then lets user read it; scores the long read.
// - Detailed logs included for data extraction, selection, images, and scoring.

// ===== Config =====
const SHEET_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
const PIXABAY_KEY = "51268254-554135d72f1d226beca834413";

// ===== State =====
let sentences = []; // [{ text, target, meaning, lesson, imageUrl }]
let sentenceIndex = 0;
let voice = null;
let totalScore = 0;
let recognition = null;
let isListening = false;

// ===== Image cache =====
const imageCache = {}; // key: keyword (string), value: { url, keyword }

// ===== Helpers =====
function normText(s) {
  return (s || "").toLowerCase().replace(/[^a-z0-9'\s]/g, "").trim();
}

function firstTwoWordsHint(s) {
  const words = (s || "").trim().split(/\s+/);
  return words.slice(0, 2).join(" ") + (words.length > 2 ? "..." : "");
}

function splitTargets(rawTarget) {
  return (rawTarget || "")
    .toLowerCase()
    .split(/[/;,]/)
    .map(t => t.trim())
    .filter(Boolean);
}

function pickRandom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function speak(text) {
  if (!text) return;
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US";
  utter.voice = voice;
  speechSynthesis.speak(utter);
}

function getVoices() {
  return new Promise(resolve => {
    const voices = speechSynthesis.getVoices();
    if (voices.length) return resolve(voices);
    speechSynthesis.onvoiceschanged = () => resolve(speechSynthesis.getVoices());
  });
}

async function fetchGVizRows(url) {
  console.log("🔗 Fetching GViz:", url);
  const res = await fetch(url);
  const txt = await res.text();
  try {
    const json = JSON.parse(txt.substring(47).slice(0, -2));
    const rows = json.table?.rows || [];
    console.log("📥 GViz parsed rows:", rows.length);
    return rows;
  } catch (err) {
    console.error("❌ GViz parse error:", err);
    console.log("🧾 Raw head(200):", txt.slice(0, 200));
    throw err;
  }
}

/**
 * Extract presentation data from sheet rows.
 * Columns:
 * - B (index 1): lesson/mã bài (e.g., "3-07-2")
 * - C (index 2): vocab raw (keywords)
 * - I (index 8): presentation sentence
 * - Y (index 24): meaning (if available; same as Speaking 2)
 */
function extractPresentationData(rows) {
  const items = rows.map((r, idx) => {
    const lessonName = r.c?.[1]?.v?.toString().trim() || ""; // B
    const vocabRaw = r.c?.[2]?.v?.toString().trim() || "";   // C
    const presentation = r.c?.[8]?.v?.toString().trim() || ""; // I
    const meaning = r.c?.[24]?.v?.toString().trim() || "";     // Y (optional)

    const targets = splitTargets(vocabRaw);

    // Log per-row for debugging
    console.log("📖 Row", idx, { lessonName, vocabRaw, presentation, meaning, targets });

    return { lessonName, vocabRaw, presentation, meaning, targets };
  }).filter(it => it.lessonName && it.presentation);

  console.log("✅ Presentation items count:", items.length);
  return items;
}

// ===== Images: Pixabay fetch + cache =====
function fetchImageForKeyword(keyword) {
  const kw = (keyword || "").trim().toLowerCase();
  if (!kw) return Promise.resolve(null);

  const searchTerm = `${kw} cartoon`;
  const apiUrl = `https://pixabay.com/api/?key=${PIXABAY_KEY}&q=${encodeURIComponent(searchTerm)}&image_type=illustration&safesearch=true&per_page=5`;

  console.log("🖼️ Fetching image for keyword:", kw, apiUrl);

  return fetch(apiUrl)
    .then(res => res.json())
    .then(data => {
      console.log("🖼️ Pixabay response:", data);
      if (data.hits && data.hits.length > 0) {
        const chosen = data.hits[Math.floor(Math.random() * data.hits.length)];
        console.log("🖼️ Chosen image:", chosen.webformatURL, "for vocab:", kw);
        return { url: chosen.webformatURL, keyword: kw };
      }
      console.warn("⚠️ No image found for keyword:", kw);
      return null;
    })
    .catch(err => {
      console.error("❌ Lỗi fetch ảnh Pixabay:", err);
      return null;
    });
}
function showIntroParagraph() {
  const area = document.getElementById("sentenceArea");
  const fullParagraph = sentences.map(s => s.text).join(". ").replace(/\s+\./g, ".").trim() + ".";
  area.innerHTML = `
    <div style="font-size:20px; margin-bottom:8px;">🧩 Đoạn văn tổng thể (nghe mẫu)</div>
    <div id="paragraphBox" style="margin-bottom:12px; color:#a7b1d0;">${fullParagraph}</div>
    <div style="text-align:center;">
      <button id="playParagraphBtn">🔊 Nghe đoạn</button>
      <button id="startPracticeBtn">Bắt đầu luyện từng câu</button>
    </div>
  `;
  document.getElementById("playParagraphBtn").onclick = () => speak(fullParagraph);
  document.getElementById("startPracticeBtn").onclick = () => startSentence();
}

// ===== Rendering and scoring =====
function renderSentence(autoSpeak = false, target = "", meaning = "") {
  const { text } = sentences[sentenceIndex];

  const area = document.getElementById("sentenceArea");
  const imageBox = document.getElementById("imageBox");

  const hint = firstTwoWordsHint(text);

  area.innerHTML = `
    <div style="font-size:24px; margin-bottom:10px; text-align:center;">
      🔤 <b style="color:#cc3333;">${target}</b>
      <span style="font-size:18px;">${meaning ? `(${meaning})` : ""}</span>
    </div>
    <div style="font-size:28px; font-weight:bold; margin-bottom:18px; text-align:center;">
      ${hint}
    </div>
    <div style="text-align:center;">
      <button id="recordBtn" style="margin:0 8px;">
        <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" alt="PokéBall" style="width:40px; vertical-align:middle;" />
      </button>
      <button id="nextBtn">⏩ Tiếp theo</button>
    </div>
    <div id="speechResult" style="margin-top:16px; text-align:center;"></div>
  `;

  // Load image (cache -> fetch)
  const sentenceObj = sentences[sentenceIndex];
  if (imageBox) {
    imageBox.innerHTML = ""; // reset
    const key = (sentenceObj.target || sentenceObj.text || "").trim().toLowerCase();
    const cached = imageCache[key];
    if (cached?.url) {
      imageBox.innerHTML = `<img src="${cached.url}" alt="${sentenceObj.target}" style="max-width:60%;width:100%;height:auto;border-radius:8px;margin:6px 0;object-fit:cover;" />`;
      console.log("🖼️ Use cached image:", cached.url, "for:", key);
    } else if (sentenceObj.target) {
      fetchImageForKeyword(sentenceObj.target).then(img => {
        if (img?.url) {
          imageCache[key] = img;
          sentenceObj.imageUrl = img.url;
          imageBox.innerHTML = `<img src="${img.url}" alt="${sentenceObj.target}" style="max-width:60%;width:100%;height:auto;border-radius:8px;margin:6px 0;object-fit:cover;" />`;
        }
      });
    }
  }

  document.getElementById("nextBtn").onclick = () => {
    sentenceIndex++;
    if (sentenceIndex < sentences.length) {
      startSentence();
    } else {
      showFinalResult();
    }
  };

  // Recognition setup per render (Speaking 2 style)
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    alert("Thiết bị của bạn không hỗ trợ nhận giọng nói.");
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = "en-US";
  recognition.interimResults = false;
  recognition.maxAlternatives = 1;
  isListening = false;

  document.getElementById("recordBtn").onclick = () => {
    document.getElementById("speechResult").textContent = "🎙️ Đang nghe...";
    try {
      isListening = true;
      recognition.start();
    } catch (err) {
      console.warn("⚠️ start() failed, trying abort→start:", err);
      try { recognition.abort(); } catch {}
      setTimeout(() => {
        try { isListening = true; recognition.start(); } catch (e2) {
          document.getElementById("speechResult").innerText = "❌ Không thể bắt đầu nhận giọng. Kiểm tra quyền mic/HTTPS.";
        }
      }, 120);
    }
  };

  recognition.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    console.log("🗣️ Transcript:", transcript);
    checkAccuracy(transcript);
    // Speak the correct sentence AFTER scoring
    const correctSentence = sentences[sentenceIndex].text;
    speak(correctSentence);
  };

  recognition.onerror = (event) => {
    isListening = false;
    document.getElementById("speechResult").innerText = `❌ Lỗi: ${event.error}`;
    console.error("❌ Recognition error:", event.error);
  };

  recognition.onend = () => { isListening = false; };
}

function checkAccuracy(userText) {
  const currentSentence = sentences[sentenceIndex].text.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const user = userText.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
  const targetWords = currentSentence.split(/\s+/).filter(Boolean);
  const userWordsSet = new Set(user.split(/\s+/).filter(Boolean));

  let correct = 0;
  for (let word of targetWords) {
    if (userWordsSet.has(word)) correct++;
  }

  const percent = targetWords.length ? Math.round((correct / targetWords.length) * 100) : 0;
  if (percent >= 50) totalScore++;

  const result = document.getElementById("speechResult");
  result.innerHTML = `✅ Bạn nói: "<i>${userText}</i>"<br>🎯 Đúng ${correct}/${targetWords.length} từ → <b>${percent}%</b>`;
  console.log("🧮 Sentence scoring:", { index: sentenceIndex, percent, correct, total: targetWords.length, totalScore });
}

// ===== Final stage: show result, then paragraph reading =====
function showFinalResult() {
  const area = document.getElementById("sentenceArea");
  const percent = sentences.length > 0
    ? Math.round((totalScore / sentences.length) * 100)
    : 0;

  // Save cumulative to localStorage
  const prev = JSON.parse(localStorage.getItem("result_speaking")) || { score: 0, total: 0 };
  const updated = {
    score: prev.score + totalScore,
    total: prev.total + sentences.length
  };
  localStorage.setItem("result_speaking", JSON.stringify(updated));

  // UI result
  area.innerHTML = `
    <div style="font-size:24px;">🏁 Bạn đã luyện hết toàn bộ câu!</div>
    <div style="margin-top:16px;">
      📊 Tổng điểm: <b>${totalScore}/${sentences.length}</b> → <b>${percent}%</b>
    </div>
    <hr style="margin:16px 0; opacity:.35;">
    <div style="font-size:20px; margin-bottom:8px;">🧩 Bước cuối: Đọc cả đoạn văn</div>
    <div id="paragraphBox" style="margin-bottom:12px; color:#a7b1d0;"></div>
    <div style="text-align:center;">
      <button id="playParagraphBtn">🔊 Nghe mẫu đoạn</button>
      <button id="recordParagraphBtn" style="margin-left:8px;">🎙️ Đọc cả đoạn</button>
    </div>
    <div id="paragraphResult" style="margin-top:12px; text-align:center;"></div>
  `;

  // Build the paragraph from all sentences
  const fullParagraph = sentences.map(s => s.text).join(". ").replace(/\s+\./g, ".").trim() + ".";
  document.getElementById("paragraphBox").textContent = fullParagraph;

  // Play sample
  document.getElementById("playParagraphBtn").onclick = () => speak(fullParagraph);

  // Record entire paragraph
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SpeechRecognition) {
    document.getElementById("paragraphResult").textContent = "⚠️ Thiết bị không hỗ trợ thu âm đoạn dài.";
    return;
  }

  const longRec = new SpeechRecognition();
  longRec.lang = "en-US";
  longRec.interimResults = false;
  longRec.maxAlternatives = 1;

  document.getElementById("recordParagraphBtn").onclick = () => {
    document.getElementById("paragraphResult").textContent = "🎙️ Đang nghe đoạn...";
    try {
      longRec.start();
    } catch (err) {
      try { longRec.abort(); } catch {}
      setTimeout(() => {
        try { longRec.start(); } catch (e2) {
          document.getElementById("paragraphResult").textContent = "❌ Không thể bắt đầu thu đoạn. Kiểm tra mic/HTTPS.";
        }
      }, 120);
    }
  };

  longRec.onresult = (event) => {
    const transcript = event.results[0][0].transcript.toLowerCase().trim();
    const targetWords = normText(fullParagraph).split(/\s+/).filter(Boolean);
    const userWordsSet = new Set(normText(transcript).split(/\s+/).filter(Boolean));

    let correct = 0;
    for (let word of targetWords) if (userWordsSet.has(word)) correct++;
    const percentPara = targetWords.length ? Math.round((correct / targetWords.length) * 100) : 0;

    // Thang điểm đoạn văn
    let paragraphScore = 0;
    if (percentPara >= 80) paragraphScore = 10;
    else if (percentPara >= 50 && percentPara <= 70) paragraphScore = 5;

    totalScore += paragraphScore;

    const grandTotal = sentences.length + 10;
    const percentTotal = Math.round((totalScore / grandTotal) * 100);

    // Lưu localStorage
    const prev = JSON.parse(localStorage.getItem("result_speaking")) || { score: 0, total: 0 };
    const updated = {
      score: prev.score + totalScore,
      total: prev.total + grandTotal
    };
    localStorage.setItem("result_speaking", JSON.stringify(updated));

    const resEl = document.getElementById("paragraphResult");
    resEl.innerHTML =
      `📣 Bạn đọc: "<i>${transcript}</i>"<br>🎯 Khớp ${correct}/${targetWords.length} từ → <b>${percentPara}%</b><br>` +
      `🧮 Điểm đoạn văn: <b>${paragraphScore}/10</b><br>` +
      `📊 Tổng điểm: <b>${totalScore}/${grandTotal}</b> → <b>${percentTotal}%</b>`;

    if (percentTotal >= 50) {
      resEl.innerHTML += `<div style="margin-top:10px;">🎉 Chuẩn Legendary! Bạn đã bắt được Pokémon!</div>`;
      try { showCatchEffect(area); } catch {}
    } else {
      resEl.innerHTML += `<div style="margin-top:10px;">🚫 Bạn đã thua! Hãy luyện thêm để đạt tối thiểu 50%.</div>`;
    }
  };

}

// ===== Flow control =====
function startSentence() {
  const { text, target, meaning } = sentences[sentenceIndex];
  renderSentence(false, target, meaning);
}

// ===== Init =====
getVoices().then(v => {
  voice = v.find(v => v.lang === "en-US") || v[0];

  const wordBank = JSON.parse(localStorage.getItem("wordBank"))?.map(w => w.toLowerCase().trim()) || [];
  console.log("🧩 wordBank:", wordBank);

  fetchGVizRows(SHEET_URL)
    .then(rows => {
      const items = extractPresentationData(rows);

      sentences = [];
      for (const it of items) {
        const { lessonName, presentation, meaning, targets } = it;
        const match = targets?.some(t => wordBank.includes(t));
        if (match) {
          const targetWord = targets.find(t => wordBank.includes(t)) || targets[0] || "";
          sentences.push({
            text: presentation,
            target: targetWord,
            meaning: meaning || "",
            lesson: lessonName,
            imageUrl: ""
          });
          console.log("➕ Sentence added:", { lesson: lessonName, target: targetWord, text: presentation });
        }
      }

      sentenceIndex = 0;
      if (sentences.length > 0) {
        // Prefetch images for first render responsiveness
        const prefetchPromises = sentences.map(s => {
          if (!s.target) return Promise.resolve();
          const key = s.target.trim().toLowerCase();
          if (imageCache[key]) return Promise.resolve();
          return fetchImageForKeyword(s.target).then(img => {
            if (img?.url) {
              imageCache[key] = img;
              s.imageUrl = img.url;
            }
          });
        });

        Promise.all(prefetchPromises).then(() => {
          showIntroParagraph();
        });

      } else {
        document.getElementById("sentenceArea").innerHTML =
          `<div style="font-size:20px;">📭 Không tìm thấy dữ liệu từ vựng đã học.</div>`;
      }
    })
    .catch(err => {
      console.error("❌ Init Speaking 3 error:", err);
      const area = document.getElementById("sentenceArea");
      if (area) area.innerHTML = `<div style="font-size:20px;">❌ Không thể khởi tạo Speaking 3. Kiểm tra dữ liệu.</div>`;
    });
});
