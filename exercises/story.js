/* Flipbook Story Mode - app.js
   - Fetch catalog from Google Sheet (GViz)
   - Filter by age
   - List stories
   - Load selected PDF with PDF.js
   - Render pages into #flipbook
   - Navigation + swipe
*/


// ====== CONFIG ======
const SHEET_ID = "1jh9uVAVB9CQZh1mEhEYmX376aoGc0qupvfUgrEr_lR0"; // your sheet id
const SHEET_GVIZ_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json`;
const MAX_PAGES = 200; // safety cap for huge PDFs
const DEFAULT_SCALE = 1.3;

// ====== STATE ======
let catalog = [];          // { age, title, link }
let currentPDF = null;     // pdfjsLib.PDFDocumentProxy
let totalPages = 0;
let zoomScale = DEFAULT_SCALE;
let renderedPages = [];    // array of canvas per page
let currentPageIndex = 0;  // 0-based

// ====== HELPERS ======
function logInfo(msg) {
  const info = document.getElementById("infoBar");
  if (info) info.textContent = msg;
  console.log(msg);
}

function parseGvizResponse(text) {
  // GViz returns: "/*O_o*/\ngoogle.visualization.Query.setResponse({...})"
  const jsonStr = text.replace(/^[^\(]*\(/, "").replace(/\);?$/, "");
  const obj = JSON.parse(jsonStr);
  const rows = obj.table.rows || [];
  const items = rows.map(r => {
    const c = r.c;
    const age = c[0]?.v ? String(c[0].v).trim() : "";
    const title = c[1]?.v ? String(c[1].v).trim() : "";
    const link = c[2]?.v ? String(c[2].v).trim() : "";
    return { age, title, link };
  }).filter(x => x.age && x.title && x.link);
  return items;
}

function extractDriveFileId(driveLink) {
  // Ví dụ: https://drive.google.com/file/d/FILE_ID/view?usp=sharing
  const match = driveLink.match(/\/file\/d\/([^/]+)\//);
  return match ? match[1] : null;
}

function makeDriveDownloadUrl(driveLink) {
  const fileId = extractDriveFileId(driveLink);
  if (!fileId) return null;
  // Gọi API trên dự án Replit đang chạy
  return `https://docpdf.onrender.com/pdf/${fileId}`;
}

function clearFlipbook() {
  const fb = document.getElementById("flipbook");
  fb.innerHTML = "";
  document.getElementById("pageCurrent").textContent = "0";
  document.getElementById("pageTotal").textContent = "0";
  totalPages = 0;
  currentPDF = null;
  renderedPages = [];
  currentPageIndex = 0;
}

// ====== RENDER UI ======
function renderCatalogList(age) {
  const listEl = document.getElementById("storyList");
  listEl.innerHTML = "";
  const filtered = age ? catalog.filter(x => x.age === age) : catalog;

  if (!filtered.length) {
    listEl.innerHTML = `<div class="story-item">Không có truyện cho lứa tuổi này.</div>`;
    return;
  }

  filtered.forEach(item => {
    const div = document.createElement("div");
    div.className = "story-item";
    div.innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
        <div>
          <div class="story-title">${item.title}</div>
          <div class="story-age">Age: ${item.age}</div>
        </div>
        <button class="openBtn">Open</button>
      </div>
    `;
    div.querySelector(".openBtn").onclick = () => openStory(item);
    listEl.appendChild(div);
  });
}

// ====== PDF LOADING ======
let englishWords = new Set();

async function loadWordSet(url) {
  const res = await fetch(url);
  const text = await res.text();
  englishWords = new Set(
    text.split(/\r?\n/).map(w => w.trim().toLowerCase()).filter(Boolean)
  );
  console.log("✅ Wordlist loaded:", englishWords.size, "words");
}

// Gọi khi trang khởi động
window.addEventListener("DOMContentLoaded", () => {
  loadWordSet("google-10000-english-no-swears.txt");
});

// ⚠️ Lưu ý: API key không nên để trực tiếp ở frontend.
// Nên để ở backend hoặc biến môi trường để tránh lộ key.
const OPENROUTER_API_KEY = "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"; // Thay bằng key thật

async function callOpenRouter(prompt) {
  const models = [
    "deepseek/deepseek-r1:free",   // miễn phí
    "mistralai/mistral-7b-instruct",
    "gryphe/mythomax-l2-13b",
    "undi95/toppy-m-7b"
  ];

  if (!prompt || prompt.trim().length < 10) {
    console.warn("⚠️ Prompt quá ngắn, dùng prompt mặc định.");
    prompt = "Rewrite the following OCR text into meaningful English sentences.";
  }

  // Prompt ép AI trả về JSON
  const fullPrompt = `
Rewrite this OCR text into meaningful English sentences.
For each sentence, also provide its Vietnamese translation.
Return the result strictly as a JSON array, where each item has:
{
  "english": "...",
  "vietnamese": "..."
}

OCR text:
${prompt}
`;

  console.log("📤 Prompt gửi lên OpenRouter:");
  console.log(fullPrompt);

  for (const model of models) {
    try {
      console.log(`⏳ Đang gọi model: ${model}`);
      const res = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${OPENROUTER_API_KEY}`
        },
        body: JSON.stringify({
          model,
          temperature: 0.7,
          messages: [
            { role: "system", content: "You are an assistant that rewrites noisy OCR text into clean English sentences and provides Vietnamese translations. Output strictly JSON." },
            { role: "user", content: fullPrompt }
          ]
        })
      });

      if (res.status === 429) {
        console.warn(`⚠️ Model ${model} bị giới hạn (429 Too Many Requests)`);
        continue;
      }

      if (!res.ok) {
        console.warn(`⚠️ Model ${model} lỗi: ${res.status} ${res.statusText}`);
        continue;
      }

      const data = await res.json();
      console.log(`📦 Raw response từ model ${model}:`, data);

      const output = data.choices?.[0]?.message?.content;
      if (output) {
        console.log(`✅ Nội dung AI trả về:`);
        console.log(output);
        return output;
      } else {
        console.warn(`⚠️ Model ${model} không trả về nội dung.`);
      }

    } catch (err) {
      console.error(`❌ Lỗi khi gọi model ${model}:`, err);
    }
  }

  console.error("❌ Không có model nào trả về kết quả.");
  return null;
}


function splitSentencesPair(item) {
  const enSentences = item.english
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const viSentences = item.vietnamese
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(Boolean);

  const pairs = [];

  const len = Math.min(enSentences.length, viSentences.length);
  for (let i = 0; i < len; i++) {
    pairs.push({
      english: enSentences[i],
      vietnamese: viSentences[i]
    });
  }

  return pairs;
}

async function openStory(item) {
  try {
    clearFlipbook();
    logInfo(`Đang mở truyện: ${item.title}`);

    const pdfUrl = makeDriveDownloadUrl(item.link);
    if (!pdfUrl) {
      logInfo("Link Google Drive không hợp lệ.");
      return;
    }

    const loadingTask = pdfjsLib.getDocument({ url: pdfUrl });
    currentPDF = await loadingTask.promise;

    totalPages = Math.min(currentPDF.numPages, MAX_PAGES);
    document.getElementById("pageTotal").textContent = String(totalPages);

    renderedPages = [];

    // OCR tất cả các trang
    let ocrPages = [];
    for (let p = 1; p <= totalPages; p++) {
      const page = await currentPDF.getPage(p);
      const viewport = page.getViewport({ scale: zoomScale });

      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = viewport.width;
      canvas.height = viewport.height;

      const renderTask = page.render({ canvasContext: ctx, viewport });
      await renderTask.promise;

      const textContent = await page.getTextContent();
      if (textContent.items.length > 0) {
        let rawText = textContent.items.map(i => i.str).join(" ");
        rawText = rawText.replace(/\s+/g, " ").trim();
        ocrPages.push(rawText);
      } else {
        logInfo(`Trang ${p}: không có text layer, đang OCR…`);
        const result = await Tesseract.recognize(canvas, 'eng');
        let ocrText = result.data.text;
        ocrPages.push(ocrText);
      }

      // Lưu canvas để hiển thị trang
      const wrapper = document.createElement("div");
      wrapper.className = "page";
      wrapper.style.display = "flex";
      wrapper.style.flexDirection = "column";
      wrapper.style.alignItems = "center";
      wrapper.appendChild(canvas);
      renderedPages.push(wrapper);
    }

    // Gom toàn bộ OCR thành một bản
    let allOcrText = ocrPages.join("\n\n");
    allOcrText = allOcrText.replace(/[^a-zA-Z0-9\s.,!?']/g, " ");

    // Gọi AI một lần duy nhất
    const aiOutput = await callOpenRouter(allOcrText);
    if (!aiOutput) {
      logInfo("❌ Không nhận được phản hồi từ AI.");
      return;
    }

    console.log("📥 Kết quả AI trả về:");
    console.log(aiOutput);

    // Parse JSON từ AI
    let sentencesData = [];
    try {
      // Loại bỏ các token thừa như <s> hoặc đoạn đầu không phải JSON
      let cleanedOutput = aiOutput.trim()
        .replace(/^<s>\s*/i, "")        // bỏ token <s>
        .replace(/```json/i, "")        // bỏ ```json
        .replace(/```/g, "")            // bỏ ```
        .trim();

      if (cleanedOutput.startsWith("{") || cleanedOutput.startsWith("[")) {
        sentencesData = JSON.parse(cleanedOutput);
      } else {
        console.warn("⚠️ AI không trả về JSON. Dữ liệu thô:");
        console.log(aiOutput);
        return;
      }
    } catch (err) {
      console.error("❌ Lỗi parse JSON:", err);
      console.log("📄 Dữ liệu thô từ AI:");
      console.log(aiOutput);
      return;
    }



    // Panel số độc lập
    const sentencePanel = document.createElement("div");
    sentencePanel.className = "sentence-panel";
    sentencePanel.style.marginTop = "12px";
    sentencePanel.style.display = "flex";
    sentencePanel.style.flexWrap = "wrap";
    sentencePanel.style.gap = "8px";
    sentencePanel.style.justifyContent = "center";

    // Vùng hiển thị câu EN + VI
    const displayDiv = document.createElement("div");
    displayDiv.id = "sentenceDisplay";
    displayDiv.style.marginTop = "20px";
    displayDiv.style.textAlign = "center";

    let allPairs = [];
    sentencesData.forEach(item => {
      const pairs = splitSentencesPair(item);
      allPairs.push(...pairs);
    });

    allPairs.forEach((item, i) => {
      const btn = document.createElement("button");
      btn.textContent = i + 1;
      btn.title = item.english;
      btn.style.padding = "6px 10px";
      btn.style.borderRadius = "50%";
      btn.style.fontSize = "14px";
      btn.style.background = "#2a3156";
      btn.style.color = "#fff";
      btn.style.border = "none";
      btn.style.cursor = "pointer";

      btn.onclick = () => {
        speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(item.english);
        btn.style.background = "#ff5ea6";
        utter.onend = () => {
          btn.style.background = "#2a3156";
        };
        speechSynthesis.speak(utter);

        displayDiv.innerHTML = `<p><b>EN:</b> ${item.english}</p><p><b>VI:</b> ${item.vietnamese}</p>`;
      };

      sentencePanel.appendChild(btn);
    });


    // Gắn panel + display vào container chung
    const container = document.getElementById("flipbookContainer");
    container.appendChild(sentencePanel);
    container.appendChild(displayDiv);

    currentPageIndex = 0;
    showPage(currentPageIndex);
    logInfo(`Đã mở "${item.title}" (${totalPages} trang, ${allPairs.length} câu).`);

  } catch (err) {
    console.error("PDF load error:", err);
    logInfo("Không thể tải PDF. Kiểm tra quyền chia sẻ hoặc thử lại.");
  }
}






// ====== HIỂN THỊ TRANG HIỆN TẠI ======
function showPage(index) {
  if (!renderedPages.length) return;
  const fb = document.getElementById("flipbook");
  fb.innerHTML = "";
  fb.appendChild(renderedPages[index]);
  document.getElementById("pageCurrent").textContent = String(index + 1);
}

// ====== NAVIGATION ======
function setupNavigation() {
  const prevBtn = document.getElementById("prevBtn");
  const nextBtn = document.getElementById("nextBtn");

  prevBtn.onclick = () => {
    if (currentPageIndex > 0) {
      currentPageIndex--;
      showPage(currentPageIndex);
    }
  };

  nextBtn.onclick = () => {
    if (currentPageIndex < renderedPages.length - 1) {
      currentPageIndex++;
      showPage(currentPageIndex);
    }
  };

  // Swipe support
  const container = document.getElementById("flipbook");
  let startX = 0;
  container.addEventListener("touchstart", e => {
    startX = e.touches[0].clientX;
  });
  container.addEventListener("touchend", e => {
    const endX = e.changedTouches[0].clientX;
    const delta = endX - startX;
    if (Math.abs(delta) > 50) {
      if (delta < 0 && currentPageIndex < renderedPages.length - 1) {
        currentPageIndex++;
        showPage(currentPageIndex);
      } else if (delta > 0 && currentPageIndex > 0) {
        currentPageIndex--;
        showPage(currentPageIndex);
      }
    }
  });

  // Zoom controls (re-render current book with new scale)
  document.getElementById("zoomInBtn")?.addEventListener("click", async () => {
    zoomScale = Math.min(zoomScale + 0.2, 2.5);
    await rerenderCurrentBook();
  });
  document.getElementById("zoomOutBtn")?.addEventListener("click", async () => {
    zoomScale = Math.max(zoomScale - 0.2, 0.8);
    await rerenderCurrentBook();
  });
}

// ====== RENDER LẠI KHI ZOOM ======
async function rerenderCurrentBook() {
  if (!currentPDF) return;
  const pages = totalPages;
  const prevIndex = currentPageIndex;

  renderedPages = [];

  for (let p = 1; p <= pages; p++) {
    const page = await currentPDF.getPage(p);
    const viewport = page.getViewport({ scale: zoomScale });

    // Canvas render
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    const renderTask = page.render({ canvasContext: ctx, viewport });
    await renderTask.promise;

    // Text content
    const textContent = await page.getTextContent();
    const textLayerDiv = document.createElement("div");
    textLayerDiv.className = "textLayer";
    textLayerDiv.style.position = "absolute";
    textLayerDiv.style.top = "0";
    textLayerDiv.style.left = "0";
    textLayerDiv.style.width = canvas.width + "px";
    textLayerDiv.style.height = canvas.height + "px";

    // Gom text thành câu
    let sentence = "";
    let sentenceItems = [];
    textContent.items.forEach(item => {
      sentence += item.str + " ";
      sentenceItems.push(item);

      if (/[.!?]$/.test(item.str.trim())) {
        // Tạo div cho câu
        const sentenceDiv = document.createElement("div");
        sentenceDiv.textContent = sentence.trim();
        sentenceDiv.className = "sentence";
        sentenceDiv.style.position = "absolute";

        // Ước lượng vị trí từ item đầu tiên
        // Ước lượng vị trí và kích thước từ item đầu và cuối
        const first = sentenceItems[0];
        const last = sentenceItems[sentenceItems.length - 1];

        // Tọa độ PDF.js: transform[4] = x, transform[5] = y (ngược chiều cao canvas)
        const x = first.transform[4];
        const y = canvas.height - first.transform[5];

        // Chiều rộng = khoảng cách từ chữ đầu đến chữ cuối + độ rộng chữ cuối
        const w = (last.transform[4] - first.transform[4]) + last.width;
        const h = first.height;

        sentenceDiv.style.left = x + "px";
        sentenceDiv.style.top = y + "px";
        sentenceDiv.style.width = w + "px";
        sentenceDiv.style.height = h + "px";

        // Click để đọc câu
        sentenceDiv.onclick = () => {
          speechSynthesis.cancel();
          const utter = new SpeechSynthesisUtterance(sentenceDiv.textContent);
          sentenceDiv.classList.add("active");
          utter.onend = () => sentenceDiv.classList.remove("active");
          speechSynthesis.speak(utter);
        };

        textLayerDiv.appendChild(sentenceDiv);

        // Reset
        sentence = "";
        sentenceItems = [];
      }
    });

    // Gói canvas + text layer
    const wrapper = document.createElement("div");
    wrapper.className = "page";
    wrapper.style.position = "relative";
    wrapper.style.width = canvas.width + "px";
    wrapper.style.height = canvas.height + "px";
    wrapper.appendChild(canvas);
    wrapper.appendChild(textLayerDiv);

    renderedPages.push(wrapper);
  }

  currentPageIndex = Math.min(prevIndex, renderedPages.length - 1);
  showPage(currentPageIndex);
  document.getElementById("pageTotal").textContent = String(pages);
}


// ====== SHEET FETCH ======
async function fetchCatalog() {
  logInfo("Đang tải danh mục truyện từ Google Sheet…");
  const res = await fetch(SHEET_GVIZ_URL);
  const text = await res.text();
  catalog = parseGvizResponse(text);

  // Optional: dedupe + sort by title
  const seen = new Set();
  catalog = catalog.filter(item => {
    const key = `${item.age}|${item.title}|${item.link}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  }).sort((a, b) => a.title.localeCompare(b.title));

  logInfo(`Đã tải ${catalog.length} truyện.`);
  renderCatalogList(""); // show all initially or wait for age selection
}

// ====== AGE FILTER ======
function setupAgeFilter() {
  const sel = document.getElementById("ageSelect");
  sel.addEventListener("change", () => {
    const age = sel.value;
    renderCatalogList(age);
    logInfo(age ? `Đang lọc truyện cho lứa tuổi: ${age}` : "Hiển thị toàn bộ truyện.");
  });
  // Optional: reload button
  const reload = document.getElementById("reloadBtn");
  if (reload) {
    reload.addEventListener("click", async () => {
      await fetchCatalog();
      const age = sel.value;
      renderCatalogList(age);
    });
  }
}
function speak(text) {
  speechSynthesis.cancel(); // dừng nếu đang đọc
  const utter = new SpeechSynthesisUtterance(text);
  utter.lang = "en-US"; // ép giọng đọc tiếng Anh (Mỹ)
  speechSynthesis.speak(utter);
}


// ====== INIT ======
window.addEventListener("DOMContentLoaded", async () => {
  try {
    // PDF.js worker for performance
    if (window['pdfjsLib']) {
      pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
    }

    setupNavigation();
    setupAgeFilter();
    await fetchCatalog();

    logInfo("Sẵn sàng. Chọn lứa tuổi → chọn truyện → flipbook sẽ hiển thị.");
  } catch (e) {
    console.error(e);
    logInfo("Lỗi khởi tạo ứng dụng.");
  }
});
