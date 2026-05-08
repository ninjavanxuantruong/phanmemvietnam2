// 1. Cập nhật giao diện khi vào trang
function updateEggUI() {
    const dv = parseInt(localStorage.getItem('pkm_global_dv')) || 0;
    const inventory = JSON.parse(localStorage.getItem('pkm_inventory')) || [];

    const dvDisplay = document.getElementById('current-dv');
    const countDisplay = document.getElementById('bag-count');
    const buyBtn = document.getElementById('buy-btn');

    if (dvDisplay) dvDisplay.innerText = dv;
    if (countDisplay) countDisplay.innerText = `${inventory.length}/10`;

    // Vô hiệu hóa nút nếu không đủ tiền hoặc túi đầy
    if (buyBtn) {
        buyBtn.disabled = (dv < 50 || inventory.length >= 10);
    }
}

// 2. Hàm lấy dữ liệu Pokémon từ PokeAPI (để lấy tên và type chính xác)
async function getPkmSpeciesData(id) {
    try {
        // 1. Gọi species để check tiến hóa
        const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${id}`);
        const speciesData = await speciesRes.json();

        // KIỂM TRA: Nếu nó tiến hóa từ một con khác -> LOẠI (không phải Đời 1)
        if (speciesData.evolves_from_species !== null) {
            return { isValid: false };
        }

        // 2. Nếu là Đời 1, gọi tiếp lấy stats và hình ảnh
        const pkmRes = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const pkmData = await pkmRes.json();

        return {
            isValid: true,
            id: pkmData.id,
            name: pkmData.name,
            type: pkmData.types[0].type.name,
            evolution_url: speciesData.evolution_chain.url, // Lưu lại để check trùng dòng họ
            baseStats: {
                hp: pkmData.stats[0].base_stat,
                atk: pkmData.stats[1].base_stat,
                def: pkmData.stats[2].base_stat
            }
        };
    } catch (error) {
        console.error("Lỗi API:", error);
        return { isValid: false };
    }
}

// 3. Logic Ấp trứng
// Thêm hàm lấy thông tin con tiến hóa tiếp theo từ Evolution Chain
async function getNextEvolutionName(url) {
    try {
        const res = await fetch(url);
        const data = await res.json();
        // Tìm loài cơ bản trong chuỗi và xem nó có con tiến hóa tiếp theo không
        if (data.chain.evolves_to.length > 0) {
            return data.chain.evolves_to[0].species.name;
        }
        return "Tối thượng (Không thể tiến hóa)";
    } catch { return "Chưa xác định"; }
}
function rollStarTier() {
    const r = Math.random() * 100;
    if (r <= 2) return 5;      // 2%
    if (r <= 10) return 4;     // 8%
    if (r <= 25) return 3;     // 15%
    if (r <= 50) return 2;     // 25%
    return 1;                  // 50%
}

async function hatchEgg() {
    let dv = parseInt(localStorage.getItem('pkm_global_dv')) || 0;
    let inventory = JSON.parse(localStorage.getItem('pkm_inventory')) || [];

    if (dv < 50) return alert("Bạn không đủ danh vọng!");
    if (inventory.length >= 10) return alert("Túi đã đầy 10 con!");

    const buyBtn = document.getElementById('buy-btn');
    const eggImg = document.getElementById('egg-img');

    if (buyBtn) {
        buyBtn.disabled = true;
        buyBtn.innerText = "Đang ấp..."; 
    }
    if (eggImg) eggImg.classList.add('egg-shaking'); 

    // --- BƯỚC 1: CHỐT CHỈ TIÊU SAO ---
    const targetStar = rollStarTier(); 
    console.log("%c >>> ROUND MỚI <<<", "color: white; background: #3c5aa6; font-weight: bold; padding: 2px 5px;");
    console.log(`%c CHỈ TIÊU LƯỢT NÀY: ${targetStar} SAO `, "color: #ff4757; font-weight: bold; border: 1px solid #ff4757;");

    let rolledPkm = null;
    let attempts = 0;

    // --- BƯỚC 2: VÒNG LẶP TÌM PKM KHỚP CHỈ TIÊU ---
    while (!rolledPkm && attempts < 100) { 
        attempts++;
        let rolledId = Math.floor(Math.random() * 649) + 1;
        const result = await getPkmSpeciesData(rolledId);

        if (result.isValid) {
            const totalStats = result.baseStats.hp + result.baseStats.atk + result.baseStats.def;
            let currentPkmStars = 1;
            if (totalStats > 190) currentPkmStars = 5;
            else if (totalStats > 160) currentPkmStars = 4;
            else if (totalStats > 130) currentPkmStars = 3;
            else if (totalStats > 100) currentPkmStars = 2;

            // Log nhẹ quá trình quét (Optional - giúp b theo dõi tốc độ loop)
            console.log(`Lần thử ${attempts}: ID ${rolledId} mang sức mạnh ${currentPkmStars} sao...`);

            if (currentPkmStars === targetStar) {
                const isChainDuplicate = inventory.some(p => p.evolution_url === result.evolution_url);
                if (!isChainDuplicate) {
                    rolledPkm = result;
                    rolledPkm.stars = currentPkmStars;
                    console.log(`%c => THÀNH CÔNG! Đã tìm thấy ${rolledPkm.name} khớp ${targetStar} sao tại lần thử thứ ${attempts}`, "color: #2ed573; font-weight: bold;");
                } else {
                    console.log(`Bỏ qua ${result.name} (Trùng dòng họ tiến hóa trong túi)`);
                }
            }
        }
    }

    if (!rolledPkm) {
        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.innerText = "ẤP TRỨNG (-50 DV)";
        }
        if (eggImg) eggImg.classList.remove('egg-shaking');
        console.warn("Không tìm được Pokemon phù hợp sau 100 lần thử.");
        return alert("Vùng đất này đang yên tĩnh quá, hãy thử lại sau!");
    }

    const nextEvoName = await getNextEvolutionName(rolledPkm.evolution_url);

    setTimeout(() => {
        if (eggImg) {
            eggImg.classList.remove('egg-shaking');
            eggImg.classList.add('egg-explode');
        }

        const newPkm = {
            uid: rolledPkm.name + "_" + Date.now(),
            id: rolledPkm.id,
            name: rolledPkm.name.charAt(0).toUpperCase() + rolledPkm.name.slice(1),
            lv: 1,
            exp: 0,
            inTeam: false,
            position: null,
            type: rolledPkm.type,
            baseStats: rolledPkm.baseStats,
            evolution_url: rolledPkm.evolution_url,
            gen: 1,
            stars: rolledPkm.stars,
            nextEvo: nextEvoName 
        };

        dv -= 50;
        inventory.push(newPkm);
        localStorage.setItem('pkm_global_dv', dv);
        localStorage.setItem('pkm_inventory', JSON.stringify(inventory));

        if (typeof updateEggUI === "function") updateEggUI();
        showResult(newPkm);

        if (buyBtn) {
            buyBtn.disabled = false;
            buyBtn.innerText = "ẤP TRỨNG (-50 DV)";
        }

        setTimeout(() => { if (eggImg) eggImg.classList.remove('egg-explode'); }, 500);
    }, 1500); 
}

function showResult(pkm) {
    const resultArea = document.getElementById('pkm-result-info');
    const eggImg = document.getElementById('egg-img');

    // Đổi sang ảnh Pokemon chính thức
    eggImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkm.id}.png`;

    // Tạo chuỗi sao vàng
    let starHTML = "";
    for(let i=0; i<pkm.stars; i++) {
        starHTML += `<span class="star-icon">⭐</span>`;
    }

    resultArea.innerHTML = `
        <div class="pkm-card-result animate-pop">
            <div class="stars-container">${starHTML}</div>
            <h2 class="pkm-title">${pkm.name.toUpperCase()}</h2>

            <div class="pkm-stats-detail">
                <div class="stat-bar">
                    <span>Máu (HP)</span>
                    <div class="bar-bg"><div class="bar-fill hp" style="width: ${Math.min(pkm.baseStats.hp, 100)}%"></div></div>
                    <span class="stat-val">${pkm.baseStats.hp}</span>
                </div>
                <div class="stat-bar">
                    <span>Công (ATK)</span>
                    <div class="bar-bg"><div class="bar-fill atk" style="width: ${Math.min(pkm.baseStats.atk, 100)}%"></div></div>
                    <span class="stat-val">${pkm.baseStats.atk}</span>
                </div>
                <div class="stat-bar">
                    <span>Thủ (DEF)</span>
                    <div class="bar-bg"><div class="bar-fill def" style="width: ${Math.min(pkm.baseStats.def, 100)}%"></div></div>
                    <span class="stat-val">${pkm.baseStats.def}</span>
                </div>
            </div>

            <div class="pkm-footer">
                <p>🧬 Khả năng tiến hóa: <strong>${pkm.nextEvo}</strong></p>
                <p>📍 Đời: ${pkm.gen} | Hệ: ${pkm.type.toUpperCase()}</p>
            </div>
        </div>
    `;
}

// Chạy khởi tạo
updateEggUI();