// pkm_list.js

let inventory = [];
let pkmToRelease = null;

// 1. Khởi tạo dữ liệu
function initInventory() {
    let localData = JSON.parse(localStorage.getItem('pkm_inventory'));
    // Nếu trống thì tạo Pichu chuẩn (có hệ, có stats để API tra cứu được)
    if (!localData || localData.length === 0) {
        inventory = [{
            uid: "pichu_" + Date.now(),
            id: 172,
            name: "pichu",
            lv: 1,
            stars: 1,
            type: "electric", 
            baseStats: { hp: 20, atk: 40, def: 15 },
            inTeam: false
        }];
        saveLocal();
    } else {
        inventory = localData;
    }
    renderGrid();
}

// 2. Hàm bổ trợ: Truy vấn PokeAPI để lấy "Gia phả" và "Chỉ số gốc"
async function getPkmFamilyData(pkmIdOrName) {
    try {
        // B1: Lấy species để lấy URL chuỗi tiến hóa
        const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pkmIdOrName}/`);
        const speciesData = await speciesRes.json();

        // B2: Lấy chuỗi tiến hóa
        const evoRes = await fetch(speciesData.evolution_chain.url);
        const evoData = await evoRes.json();

        // B3: Xác định tên con đời 1 (Root)
        const rootName = evoData.chain.species.name;

        // B4: Đếm tổng số đời tiến hóa có thể đạt được
        let maxStage = 1;
        let chain = evoData.chain;
        while (chain.evolves_to.length > 0) {
            maxStage++;
            chain = chain.evolves_to[0]; 
        }

        // B5: Lấy stats của con đời 1 để đánh giá tố chất
        const rootPkmRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${rootName}/`);
        const rootPkmData = await rootPkmRes.json();

        const rootStats = {
            hp: rootPkmData.stats[0].base_stat,
            atk: rootPkmData.stats[1].base_stat,
            def: rootPkmData.stats[2].base_stat
        };

        return { rootName, rootStats, maxStage };
    } catch (e) {
        console.error("Lỗi API:", e);
        return null;
    }
}

// 3. Hiển thị danh sách 10 ô
function renderGrid() {
    const grid = document.getElementById('inventory-grid');
    if (!grid) return;

    grid.innerHTML = "";
    document.getElementById('pkm-count').innerText = `Tổng số: ${inventory.length}/10`;

    for (let i = 0; i < 10; i++) {
        const slot = document.createElement('div');
        slot.className = 'pkm-slot';

        if (inventory[i]) {
            const pkm = inventory[i];
            slot.innerHTML = `
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkm.id}.png">
                <span class="pkm-lv-tag">Lv.${pkm.lv}</span>
                ${pkm.inTeam ? '<div class="in-team-badge">TEAM</div>' : ''}
            `;
            slot.onclick = () => showDetail(pkm);
        } else {
            slot.innerHTML = `<span style="opacity:0.2">Trống</span>`;
        }
        grid.appendChild(slot);
    }
}

// 4. Hiển thị chi tiết (Có đánh giá Tố chất & Tiến hóa)
// --- HÀM HIỂN THỊ CHI TIẾT MỚI ---
async function showDetail(pkm) {
    const detailName = document.getElementById('detail-name');
    const statsDiv = document.getElementById('detail-stats');
    const detailImg = document.getElementById('detail-img');
    const detailEvo = document.getElementById('detail-evo');
    const detailStars = document.getElementById('detail-stars');

    // 1. Trạng thái chờ
    detailName.innerText = "ĐANG TRA CỨU...";
    detailEvo.innerHTML = "<small>Đang tải dữ liệu hệ và tiến hóa...</small>";

    // 2. Hiển thị ảnh (Ưu tiên GIF)
    detailImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pkm.id}.gif`;
    detailImg.onerror = function() {
        this.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkm.id}.png`;
    };

    // 3. Lấy dữ liệu nâng cao (Tiến hóa & Khắc hệ) từ API
    const [evoData, typeData] = await Promise.all([
        getFullEvolutionPath(pkm.id),
        getTypeEffectiveness(pkm.type)
    ]);

    // 4. Hiển thị thông tin cơ bản
    detailName.innerText = pkm.name.toUpperCase();
    detailStars.innerText = "⭐".repeat(pkm.stars || 1);

    // 5. Hiển thị Hệ và Khắc chế
    let typeHtml = `
        <div style="margin-bottom: 10px;">
            <span class="type-badge ${pkm.type}">${pkm.type.toUpperCase()}</span>
        </div>
        <div class="effectiveness-box">
            <div style="color: #2ecc71;">✅ Ưu thế (x2 dmg): <small>${typeData.advantages || 'Không rõ'}</small></div>
            <div style="color: #ff4757;">❌ Yếu thế (x2 nhận): <small>${typeData.weaknesses || 'Không rõ'}</small></div>
        </div>
        <div class="evo-path-box">
            🧬 Lộ trình: <span class="evo-path-text">${evoData}</span>
        </div>
    `;
    detailEvo.innerHTML = typeHtml;

    // 6. Hiển thị Stats
    statsDiv.innerHTML = `
        <div style="margin-top:15px;">
            ${renderStatBox('Máu (HP)', pkm.baseStats.hp, 'hp')}
            ${renderStatBox('Công (ATK)', pkm.baseStats.atk, 'atk')}
            ${renderStatBox('Thủ (DEF)', pkm.baseStats.def, 'def')}
        </div>
        <button onclick="openReleaseModal('${pkm.uid}')" class="btn-release" style="display:block; margin-top:20px; width:100%;">
            THẢ POKÉMON NÀY
        </button>
    `;
}

// --- CÁC HÀM LOGIC BỔ TRỢ (THÊM VÀO FILE) ---

// Lấy toàn bộ đường đi tiến hóa: pichu -> pikachu -> raichu
async function getFullEvolutionPath(pkmId) {
    try {
        const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${pkmId}/`);
        const speciesData = await speciesRes.json();
        const evoRes = await fetch(speciesData.evolution_chain.url);
        const evoData = await evoRes.json();

        let path = [];
        let curr = evoData.chain;
        while (curr) {
            path.push(curr.species.name);
            curr = curr.evolves_to[0]; 
        }

        // Làm nổi bật tên hiện tại
        return path.map(name => 
            name.toLowerCase() === speciesData.name.toLowerCase() 
            ? `<b style="color:var(--pika-yellow)">${name}</b>` 
            : name
        ).join(" → ");
    } catch (e) { return "Không rõ"; }
}

// Lấy dữ liệu khắc hệ thực tế từ API
async function getTypeEffectiveness(typeName) {
    try {
        const res = await fetch(`https://pokeapi.co/api/v2/type/${typeName}`);
        const data = await res.json();
        const rel = data.damage_relations;

        return {
            advantages: rel.double_damage_to.map(t => t.name).join(", "),
            weaknesses: rel.double_damage_from.map(t => t.name).join(", ")
        };
    } catch (e) { return { advantages: "---", weaknesses: "---" }; }
}

// Hàm bổ trợ vẽ thanh Stats có màu
function renderStatBox(label, value, type) {
    // type: hp, atk, def (tương ứng với CSS màu đã viết)
    return `
        <div class="stat-bar">
            <div class="bar-label">
                <span>${label}</span>
                <span>${value}</span>
            </div>
            <div class="bar-bg">
                <div class="bar-fill ${type}" style="width: ${Math.min(value, 100)}%"></div>
            </div>
        </div>
    `;
}

// 5. Logic Thả Pokémon
function openReleaseModal(uid) {
    const pkm = inventory.find(p => p.uid === uid);
    if (!pkm) return;

    if (pkm.inTeam) {
        alert("Pokémon này đang trong đội hình chiến đấu! Hãy cho rời đội trước khi thả.");
        return;
    }

    pkmToRelease = uid;
    document.getElementById('release-pkm-name').innerText = pkm.name.toUpperCase();
    document.getElementById('confirm-modal').style.display = 'flex';
}

function closeModal() {
    document.getElementById('confirm-modal').style.display = 'none';
    pkmToRelease = null;
}

function executeRelease() {
    if (!pkmToRelease) return;
    inventory = inventory.filter(p => p.uid !== pkmToRelease);

    // Bảo hiểm: Nếu xóa hết thì tự động hồi lại 1 con Pichu
    if (inventory.length === 0) {
        initInventory(); // Hàm này sẽ tự sinh lại Pichu mặc định
        alert("Bạn đã thả con cuối cùng, hệ thống tặng bạn một Pichu mới!");
    } else {
        saveLocal();
    }

    closeModal();
    renderGrid();
    // Reset khung chi tiết về trạng thái trống
    document.getElementById('detail-name').innerText = "CHỌN POKÉMON";
    document.getElementById('detail-img').src = "";
    document.getElementById('detail-stats').innerHTML = "";
    document.getElementById('detail-evo').innerHTML = "";
    document.getElementById('detail-stars').innerText = "";
}

// 6. Lưu dữ liệu
function saveLocal() {
    localStorage.setItem('pkm_inventory', JSON.stringify(inventory));
}

// Khởi chạy
initInventory();