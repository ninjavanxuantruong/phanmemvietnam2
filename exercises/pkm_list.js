// pkm_list.js

let inventory = [];
let pkmToRelease = null;

// Thêm hàm này để đồng bộ 100% công thức tính CP theo vai trò 16 hiệp từ egg.js
function calculateCP(pkm) {
    if (!pkm.baseStats) return 0;

    // Đảm bảo lấy đúng key (sAtk) và dự phòng nếu chỉ số trống
    const hp = pkm.baseStats.hp || 0;
    const atk = pkm.baseStats.atk || 0;
    const def = pkm.baseStats.def || 0;
    const sAtk = pkm.baseStats.sAtk || 0; 

    // Áp dụng công thức chuẩn từ hệ thống egg.js
    const baseCP = (hp * 15) + (def * 17.6) + (atk * 20) + (sAtk * 28.8);

    // Tỉ lệ tăng tiến sức mạnh theo Level (Ví dụ: mỗi level tăng thêm 10%)
    const levelBonus = 1 + (pkm.lv - 1) * 0.1; 

    return Math.floor(baseCP * levelBonus);
}

// 1. Khởi tạo dữ liệu
function initInventory() {
    let localData = JSON.parse(localStorage.getItem("pkm_inventory"));
    if (!localData || localData.length === 0) {
        inventory = [
            {
                uid: "pichu_" + Date.now(),
                id: 172,
                name: "Pichu",
                lv: 1,
                stars: 1,
                gen: 1, 
                type: "electric",
                baseStats: { hp: 20, atk: 40, def: 15, sAtk: 35 }, // Sử dụng sAtk đồng bộ với egg.js
                inTeam: false,
            },
        ];
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
        const speciesRes = await fetch(
            `https://pokeapi.co/api/v2/pokemon-species/${pkmIdOrName}/`,
        );
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
        const rootPkmRes = await fetch(
            `https://pokeapi.co/api/v2/pokemon/${rootName}/`,
        );
        const rootPkmData = await rootPkmRes.json();

        // HÀM TÌM STAT THEO TÊN (Cực kỳ an toàn)
        const findStat = (name) => {
            const s = rootPkmData.stats.find((item) => item.stat.name === name);
            return s ? s.base_stat : 20; 
        };

        const rootStats = {
            hp: findStat("hp"),
            atk: findStat("attack"),
            def: findStat("defense"),
            sAtk: findStat("special-attack"), // Map chuẩn vào sAtk
        };

        return { rootName, rootStats, maxStage };
    } catch (e) {
        console.error("Lỗi API:", e);
        return null;
    }
}

// 3. Hiển thị danh sách 10 ô
function renderGrid() {
    const grid = document.getElementById("inventory-grid");
    if (!grid) return;

    grid.innerHTML = "";
    document.getElementById("pkm-count").innerText =
        `Tổng số: ${inventory.length}/10`;

    for (let i = 0; i < 10; i++) {
        const slot = document.createElement("div");
        slot.className = "pkm-slot";

        if (inventory[i]) {
            const pkm = inventory[i];

            // Gọi hàm calculateCP mới để hiển thị ngoài danh sách trùng khớp với chi tiết
            const cp = calculateCP(pkm);

            slot.innerHTML = `
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkm.id}.png">
                <span class="pkm-lv-tag">Lv.${pkm.lv}</span>
                <div class="pkm-cp-tag">CP: ${cp.toLocaleString()}</div>
                ${pkm.inTeam ? '<div class="in-team-badge">TEAM</div>' : ""}
            `;
            slot.onclick = () => showDetail(pkm);
        } else {
            slot.innerHTML = `<span style="opacity:0.2">Trống</span>`;
        }
        grid.appendChild(slot);
    }
}

// 4. Hiển thị chi tiết (Có đánh giá Tố chất & Tiến hóa)
async function showDetail(pkm) {
    const detailName = document.getElementById("detail-name");
    const statsDiv = document.getElementById("detail-stats");
    const detailImg = document.getElementById("detail-img");
    const detailEvo = document.getElementById("detail-evo");
    const detailStars = document.getElementById("detail-stars");

    // Hiển thị ảnh và trạng thái chờ
    detailName.innerText = "ĐANG TRA CỨU...";
    detailImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/${pkm.id}.gif`;

    // Gọi API lấy dữ liệu bổ sung
    const [evoData, typeData] = await Promise.all([
        getFullEvolutionPath(pkm.id),
        getTypeEffectiveness(pkm.type),
    ]);

    detailName.innerText = pkm.name.toUpperCase();
    detailStars.innerText = "⭐".repeat(pkm.stars || 1);

    // CẬP NHẬT PHẦN HIỂN THỊ HỆ VÀ GEN
    detailEvo.innerHTML = `
        <div style="margin-bottom: 10px;">
            <span class="type-badge ${pkm.type}">${pkm.type.toUpperCase()}</span>
            <span class="gen-badge">GEN: ${pkm.gen || 1}</span>
        </div>
        <div class="effectiveness-box">
            <div style="color: #2ecc71;">✅ Ưu thế: <small>${typeData.advantages || "None"}</small></div>
            <div style="color: #ff4757;">❌ Yếu thế: <small>${typeData.weaknesses || "None"}</small></div>
        </div>
        <div class="evo-path-box">🧬 Tiến hóa: ${evoData}</div>
    `;

    // CẬP NHẬT PHẦN STATS (Sử dụng chuẩn sAtk viết hoa để lấy dữ liệu từ egg)
    const cp = calculateCP(pkm);
    statsDiv.innerHTML = `
        <div style="margin-top:15px;">
            ${renderStatBox("Máu (HP)", pkm.baseStats.hp, "hp")}
            ${renderStatBox("Công (ATK)", pkm.baseStats.atk, "atk")}
            ${renderStatBox("Thủ (DEF)", pkm.baseStats.def, "def")}
            ${renderStatBox("Kỹ năng (S.ATK)", pkm.baseStats.sAtk, "satk")} 
        </div>
        <div class="cp-display">TỔNG CHIẾN LỰC: ${cp.toLocaleString()}</div>
        <button onclick="openReleaseModal('${pkm.uid}')" class="btn-release">THẢ POKÉMON</button>
    `;
}

// --- CÁC HÀM LOGIC BỔ TRỢ ---

async function getFullEvolutionPath(pkmId) {
    try {
        const speciesRes = await fetch(
            `https://pokeapi.co/api/v2/pokemon-species/${pkmId}/`,
        );
        const speciesData = await speciesRes.json();
        const evoRes = await fetch(speciesData.evolution_chain.url);
        const evoData = await evoRes.json();

        let path = [];
        let curr = evoData.chain;
        while (curr) {
            path.push(curr.species.name);
            curr = curr.evolves_to[0];
        }

        return path
            .map((name) =>
                name.toLowerCase() === speciesData.name.toLowerCase()
                    ? `<b style="color:var(--pika-yellow)">${name}</b>`
                    : name,
            )
            .join(" → ");
    } catch (e) {
        return "Không rõ";
    }
}

async function getTypeEffectiveness(typeName) {
    try {
        const res = await fetch(`https://pokeapi.co/api/v2/type/${typeName}`);
        const data = await res.json();
        const rel = data.damage_relations;

        return {
            advantages: rel.double_damage_to.map((t) => t.name).join(", "),
            weaknesses: rel.double_damage_from.map((t) => t.name).join(", "),
        };
    } catch (e) {
        return { advantages: "---", weaknesses: "---" };
    }
}

function renderStatBox(label, value, type) {
    // Đã đồng bộ chia cho 200 giúp thanh UI cân đối hơn với chỉ số thực tế
    const percentage = Math.min((value / 200) * 100, 100);
    return `
        <div class="stat-bar">
            <div class="bar-label">
                <span>${label}</span>
                <span>${value}</span>
            </div>
            <div class="bar-bg">
                <div class="bar-fill ${type}" style="width: ${percentage}%"></div>
            </div>
        </div>
    `;
}

// 5. Logic Thả Pokémon
function openReleaseModal(uid) {
    const pkm = inventory.find((p) => p.uid === uid);
    if (!pkm) return;

    if (pkm.inTeam) {
        alert("Pokémon này đang trong đội hình chiến đấu! Hãy cho rời đội trước khi thả.");
        return;
    }

    pkmToRelease = uid;
    document.getElementById("release-pkm-name").innerText = pkm.name.toUpperCase();
    document.getElementById("confirm-modal").style.display = "flex";
}

function closeModal() {
    document.getElementById("confirm-modal").style.display = "none";
    pkmToRelease = null;
}

function executeRelease() {
    if (!pkmToRelease) return;
    inventory = inventory.filter((p) => p.uid !== pkmToRelease);

    if (inventory.length === 0) {
        initInventory(); 
        alert("Bạn đã thả con cuối cùng, hệ thống tặng bạn một Pichu mới!");
    } else {
        saveLocal();
    }

    closeModal();
    renderGrid();

    document.getElementById("detail-name").innerText = "CHỌN POKÉMON";
    document.getElementById("detail-img").src = "";
    document.getElementById("detail-stats").innerHTML = "";
    document.getElementById("detail-evo").innerHTML = "";
    document.getElementById("detail-stars").innerText = "";
}

function saveLocal() {
    localStorage.setItem("pkm_inventory", JSON.stringify(inventory));
}

// Khởi chạy
initInventory();
