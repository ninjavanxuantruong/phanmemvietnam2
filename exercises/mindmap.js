// mindmap.js
let rawRows = []; // Lưu trữ dữ liệu gốc
let mm = null;    // Biến lưu instance của Markmap

async function initMindmap() {
    try {
        const loading = document.getElementById('loading');
        const response = await fetch(window.SHEET_URL);
        const data = await response.json();
        rawRows = data.rows || data;

        // 1. Tạo danh sách cho Dropdown
        buildDropdown(rawRows);

        // 2. Lắng nghe sự kiện đổi chủ đề
        document.getElementById('bigTopicFilter').addEventListener('change', (e) => {
            renderMindmap(e.target.value);
        });

        loading.style.display = 'none';
        // Vẽ lần đầu với hướng dẫn
        renderMindmap("ALL");

    } catch (error) {
        console.error("❌ Lỗi:", error);
        document.getElementById('loading').innerText = "❌ Lỗi tải dữ liệu!";
    }
}

function buildDropdown(rows) {
    const filter = document.getElementById('bigTopicFilter');
    const getVal = (r, idx) => (r.c && r.c[idx]) ? r.c[idx].v : r[idx];

    const bigTopics = [...new Set(rows.map(r => getVal(r, 6)).filter(Boolean))];
    bigTopics.sort().forEach(topic => {
        const opt = document.createElement('option');
        opt.value = topic;
        opt.textContent = topic;
        filter.appendChild(opt);
    });
}

function renderMindmap(selectedTopic) {
    const getVal = (r, idx) => (r.c && r.c[idx]) ? r.c[idx].v : r[idx];
    const mapData = {};

    // 1. Lọc dữ liệu theo chủ đề được chọn
    rawRows.forEach(r => {
        const bigTopic = getVal(r, 6) || "Khác";
        const smallTopic = getVal(r, 5) || "Chung";
        const vocab = getVal(r, 2);
        const meaning = getVal(r, 24) || "";

        if (!vocab) return;
        if (selectedTopic !== "ALL" && bigTopic !== selectedTopic) return;

        if (!mapData[bigTopic]) mapData[bigTopic] = {};
        if (!mapData[bigTopic][smallTopic]) mapData[bigTopic][smallTopic] = [];
        mapData[bigTopic][smallTopic].push(`${vocab} *(${meaning})*`);
    });

    // 2. Chuyển thành Markdown
    let markdownText = selectedTopic === "ALL" 
        ? "# 🚩 HÃY CHỌN MỘT CHỦ ĐỀ LỚN" 
        : `# 🚩 ${selectedTopic}\n`;

    for (const big in mapData) {
        if (selectedTopic === "ALL") {
            markdownText += `## ${big} (Chọn ở menu trên)\n`;
        } else {
            for (const small in mapData[big]) {
                markdownText += `## ${small}\n`; // Cấp 2 là chủ đề nhỏ
                mapData[big][small].forEach(item => {
                    markdownText += `- ${item}\n`; // Cấp 3 là từ vựng
                });
            }
        }
    }

    // 3. Vẽ bằng Markmap
    const svgEl = document.querySelector('#markmap');
    const { markmap } = window;
    const transformer = new markmap.Transformer();
    const { root } = transformer.transform(markdownText);

    // Xóa cái cũ nếu có
    if (mm) {
        svgEl.innerHTML = "";
    }

    // Cấu hình Quan trọng: initialExpandLevel
    // Level 0: Gốc, Level 1: Chủ đề nhỏ. 
    // Chúng ta để level 1 để nó hiện chủ đề nhỏ nhưng ĐÓNG từ vựng lại.
    mm = markmap.Markmap.create(svgEl, {
        autoFit: true,
        initialExpandLevel: 1, // <--- Chỉ mở đến cấp Chủ đề nhỏ
        duration: 400
    }, root);
}

document.addEventListener('DOMContentLoaded', initMindmap);
