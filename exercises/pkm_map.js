/**
 * ==========================================
 * POKEMON MAP LOGIC - DIRECT NAVIGATION
 * ==========================================
 */

// 1. Lấy thông tin người chơi từ localStorage
const trainerName = localStorage.getItem('trainerName') || "Trainer";
const trainerClass = localStorage.getItem('trainerClass') || "3";

/**
 * Đưa hàm jumpToClass ra window để các nút bấm (nếu có) gọi được
 */
window.jumpToClass = function(cls) {
    console.log("🚀 Chuyển sang lộ trình Lớp:", cls);
    localStorage.setItem('selected_class', cls.toString());
    initMap(); 
};

/**
 * Hàm chuẩn hóa ID để sắp xếp theo thứ tự Lớp-Bài-Phần
 */
function normalizeId(idStr) {
    if (!idStr || typeof idStr !== 'string') return 0;
    const parts = idStr.split("-");
    if (parts.length < 2) return 0;
    const cls = parseInt(parts[0], 10) || 0;
    const lesson = parseInt(parts[1], 10) || 0;
    const part = parseInt(parts[2], 10) || 0;
    return (cls * 1000) + (lesson * 10) + part;
}

/**
 * Hàm khởi tạo và vẽ bản đồ
 */
/**
 * ==========================================
 * POKEMON MAP LOGIC - OPTIMIZED PERFORMANCE
 * ==========================================
 */

async function initMap() {
    const mapCanvas = document.getElementById('map-canvas');
    const scrollWrapper = document.getElementById('scroll-wrapper');
    if (!mapCanvas) return;

    const selectedClass = localStorage.getItem('selected_class') || trainerClass;

    try {
        let rows = [];
        const cachedData = sessionStorage.getItem('allVocabData');
        if (cachedData) {
            rows = JSON.parse(cachedData);
        } else {
            const response = await fetch(window.SHEET_URL);
            const json = await response.json();
            rows = json.data || json;
            sessionStorage.setItem('allVocabData', JSON.stringify(rows));
        }

        const colID = (window.COLS_URL?.ID !== undefined) ? window.COLS_URL.ID : 1;
        const colWord = (window.COLS_URL?.WORD !== undefined) ? window.COLS_URL.WORD : 2;

        let uniqueIds = [...new Set(
            rows.map(r => {
                const d = Array.isArray(r) ? r : Object.values(r);
                return d[colID]?.toString().trim();
            }).filter(id => id && id.startsWith(selectedClass + "-"))
        )].sort((a, b) => normalizeId(a) - normalizeId(b));

        let finalPath = [];
        uniqueIds.forEach((id, index) => {
            finalPath.push({ id: id, type: 'island', class: selectedClass });
            const parts = id.split(' ')[0].split('-');
            const currentLessonGroup = parseInt(parts[1], 10);
            const nextId = uniqueIds[index + 1];
            const isLastOfGroup = !nextId || nextId.split('-')[1] !== parts[1];
            if (currentLessonGroup % 5 === 0 && isLastOfGroup) {
                finalPath.push({ id: `BOSS-${selectedClass}-${currentLessonGroup}`, type: 'boss', class: selectedClass, range: `${currentLessonGroup - 4}-${currentLessonGroup}` });
            }
        });

        // VẼ MAP
        mapCanvas.innerHTML = '<svg id="map-svg"></svg>'; 
        const pathData = [...finalPath].reverse(); // Đảo ngược để bài 1 nằm dưới cùng
        let currentIndex = 0;

        while (currentIndex < pathData.length) {
            // SỬA TẠI ĐÂY: Chỉ cho phép tối đa 3 node để không bị quá tải trên mobile
            const nodesInRow = Math.floor(Math.random() * 3) + 1; 

            const rowEl = document.createElement('div');
            rowEl.className = "map-row";
            // Đảm bảo hàng luôn có chiều cao ổn định để SVG dễ tính toán
            rowEl.style.cssText = "display:flex; justify-content:center; width:100%; min-height:120px; margin-bottom:60px; gap:20px; position:relative;";

            for (let j = 0; j < nodesInRow; j++) {
                if (currentIndex >= pathData.length) break;
                const node = pathData[currentIndex];
                const el = document.createElement('div');
                el.className = node.type === 'boss' ? 'node boss' : 'node';

                // BẮT BUỘC 1: Đặt ID để hàm drawLines tìm được bài học
                el.id = "pkm-node-" + currentIndex;

                // Random vị trí (Dùng Margin thay vì Transform để dây không bị lệch)
                const offsetH = Math.floor(Math.random() * 41) - 20; 
                el.style.margin = `0 ${offsetH}px`;

                // BẮT BUỘC 2: Tạo sẵn "sợi dây" nằm bên trong mỗi bài học
                const connector = document.createElement('div');
                connector.className = "connector";
                // Màu sắc ngẫu nhiên cho đoạn dây này
                const hue = Math.floor(Math.random() * 360);
                connector.style.backgroundColor = `hsla(${hue}, 70%, 50%, 0.5)`;
                el.appendChild(connector);

                const fullId = node.id;
                const namePart = fullId.includes(' ') ? fullId.substring(fullId.indexOf(' ') + 1) : "";

                renderNodeContent(el, node, fullId, namePart);

                el.onmousedown = () => {
                    const lessonName = namePart.trim() || fullId.trim();
                    const vList = rows.filter(r => {
                        const d = Array.isArray(r) ? r : Object.values(r);
                        return d[colID]?.toString().trim() === fullId.trim();
                    }).map(r => (Array.isArray(r) ? r : Object.values(r))[colWord]);

                    if (typeof window.handleNodeClick === 'function') {
                        localStorage.setItem('selected_lesson_name', lessonName);
                        localStorage.setItem('current_mission', JSON.stringify(node));
                        window.handleNodeClick(lessonName, vList, 'pkm_battle.html');
                    } else { window.location.href = 'pkm_battle.html'; }
                };

                rowEl.appendChild(el);
                currentIndex++;
            }
            mapCanvas.appendChild(rowEl);
        }

        // Vẽ đường nối sau khi Render xong
        setTimeout(() => drawLines(), 200);

        if (scrollWrapper) {
            setTimeout(() => { scrollWrapper.scrollTop = scrollWrapper.scrollHeight; }, 150);
        }
    } catch (e) { console.error("❌ Lỗi Map:", e); }
}

/**
 * Hàm vẽ đường nối giữa các Node
 */
function drawLines() {
    const nodes = document.querySelectorAll('.node');
    const scrollWrapper = document.getElementById('scroll-wrapper');
    if (!scrollWrapper) return;

    // Lấy vị trí của khung cuộn để làm mốc trừ
    const wrapperRect = scrollWrapper.getBoundingClientRect();

    nodes.forEach((node, i) => {
        const connector = node.querySelector('.connector');
        const nextNode = document.getElementById("pkm-node-" + (i + 1));

        if (connector && nextNode) {
            const r1 = node.getBoundingClientRect();
            const r2 = nextNode.getBoundingClientRect();

            // Tính toán khoảng cách và góc (Dùng tọa độ tương đối với wrapper)
            const x1 = r1.left + r1.width / 2;
            const y1 = r1.top + r1.height / 2;
            const x2 = r2.left + r2.width / 2;
            const y2 = r2.top + r2.height / 2;

            const length = Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
            const angle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;

            // Áp dụng cho sợi dây
            connector.style.width = length + "px";
            connector.style.transform = `rotate(${angle}deg)`;
            connector.style.display = "block";
            connector.style.position = "absolute";
            connector.style.zIndex = "-1";
        } else if (connector) {
            connector.style.display = "none";
        }
    });
}

// Vẽ lại khi resize cửa sổ
window.addEventListener('resize', drawLines);

// Hàm bổ trợ vẽ nội dung Node (Tách ra cho sạch code)
function renderNodeContent(el, node, fullId, namePart) {
    const subParts = fullId.split(' ')[0].split('-');
    const clsNum = parseInt(node.class) || 0;
    const lessonNum = parseInt(subParts[1], 10) || 0;
    const lessonPart = parseInt(subParts[2], 10) || 0; // Chuyển phần sang số để tính toán

    // CÔNG THỨC MỚI: Tách biệt Pokémon cho từng phần (Part)
    // Ví dụ: 3-2-1 -> 321 | 3-2-2 -> 322
    let pokeID = (clsNum * 100) + (lessonNum * 10) + lessonPart;

    // Giới hạn pokeID trong khoảng Pokédex (tránh trường hợp vượt quá Gen 5/6)
    // Nếu bạn muốn xoay vòng khi ID quá lớn: if (pokeID > 649) pokeID = pokeID % 649;

    const passedMaps = JSON.parse(localStorage.getItem('pkm_passed_maps')) || [];
    const isPassed = passedMaps.includes(fullId);
    const lockHTML = !isPassed ? '<div class="lock-badge">🔒</div>' : '';

    if (node.type === 'boss') {
        el.innerHTML = `
            <div class="poke-circle">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/149.png">
                ${lockHTML}
            </div>
            <div class="node-info">
                <div class="node-name">TRÙM CUỐI</div>
                <div class="node-class-label">Bài ${node.range}</div>
            </div>`;
    } else {
        el.innerHTML = `
            <div class="poke-circle">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pokeID}.png">
                <div class="lesson-badge">${lessonNum}-${lessonPart}</div>
                ${lockHTML}
            </div>
            <div class="node-info">
                <div class="node-name">${namePart}</div>
                <div class="node-class-label">Lớp ${node.class}</div>
            </div>`;
    }
}
/**
 * Hàm hiển thị Modal từ vựng
 * @param {string} title - Tên bài học
 * @param {Array} vocabs - Danh sách từ vựng
 * @param {string} targetUrl - Đường dẫn khi nhấn Bắt đầu
 */
window.handleNodeClick = function(title, vocabs, targetUrl) {
    const modal = document.getElementById('vocabModal');
    const titleEl = document.getElementById('modalTitle');
    const listContainer = document.getElementById('vocabList');
    const startBtn = document.getElementById('startLessonBtn');

    if (!modal || !listContainer) return;

    // Cập nhật tiêu đề và URL
    titleEl.innerText = title;

    // Hiển thị danh sách từ
    listContainer.innerHTML = "";
    if (vocabs.length > 0) {
        vocabs.forEach(word => {
            const item = document.createElement('div');
            item.className = 'vocab-item';
            item.innerHTML = `<span>${word}</span> <span style="color:#3c5aa6">★</span>`;
            listContainer.appendChild(item);
        });
    } else {
        listContainer.innerHTML = "<div style='text-align:center; color:#999;'>Không có từ vựng cho bài này.</div>";
    }

    // Gán sự kiện cho nút bắt đầu
    // Gán sự kiện cho nút bắt đầu (Đã đổi thành wordBank2)
    startBtn.onclick = () => {
        // Lưu danh sách từ vựng vào wordBank2 để không xung đột với tính năng khác
        localStorage.setItem('wordBank2', JSON.stringify(vocabs));
        window.location.href = targetUrl;
    };

    // Hiện Modal
    modal.style.display = 'flex';
};

// Hàm đóng Modal
window.closeModal = function() {
    document.getElementById('vocabModal').style.display = 'none';
};
// Chạy khởi động khi file JS được nạp
initMap();
