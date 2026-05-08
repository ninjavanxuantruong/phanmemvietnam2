/**
 * POKEMON UPGRADE & EVOLUTION SYSTEM
 * Logic: 
 * - 20 EXP mỗi lần nâng cấp.
 * - Mỗi level tăng 5% chỉ số (hp, atk, def).
 * - Max Lv.10: Nâng cấp tiếp theo sẽ Tiến hóa (nếu có) và Reset về Lv.1.
 * - Tiến hóa ngẫu nhiên nếu có nhiều nhánh.
 */

const UPGRADE_COST = 20;
const GROWTH_RATE = 0.05; // 5% mỗi cấp

/**
 * Hàm chính xử lý nâng cấp Pokemon
 * @param {string} uid - ID duy nhất của Pokemon trong kho (pkm_inventory)
 */
async function handleUpgrade(uid) {
    // 1. Tải dữ liệu từ LocalStorage
    let inventory = JSON.parse(localStorage.getItem('pkm_inventory')) || [];
    let globalExp = parseInt(localStorage.getItem('pkm_global_exp')) || 0;

    // Tìm Pokemon cần nâng cấp trong danh sách
    let pkmIndex = inventory.findIndex(p => p.uid === uid);
    if (pkmIndex === -1) return alert("Không tìm thấy Pokemon!");

    let pkm = inventory[pkmIndex];

    // 2. Kiểm tra điều kiện EXP
    if (globalExp < UPGRADE_COST) {
        alert(`Bạn cần ${UPGRADE_COST} EXP để nâng cấp. Hiện có: ${globalExp}`);
        return;
    }

    // 3. Xử lý Logic Nâng cấp
    if (pkm.lv < 10) {
        // --- TRƯỜNG HỢP TĂNG LEVEL (Lv.1 -> Lv.10) ---
        globalExp -= UPGRADE_COST;
        pkm.lv += 1;

        // Tăng 5% chỉ số dựa trên chỉ số hiện tại
        pkm.baseStats.hp = Math.round(pkm.baseStats.hp * (1 + GROWTH_RATE));
        pkm.baseStats.atk = Math.round(pkm.baseStats.atk * (1 + GROWTH_RATE));
        pkm.baseStats.def = Math.round(pkm.baseStats.def * (1 + GROWTH_RATE));

        console.log(`Nâng cấp thành công: ${pkm.name} lên Lv.${pkm.lv}`);
    } 
    else {
        // --- TRƯỜNG HỢP TIẾN HÓA (KHI ĐANG Ở LV.10) ---
        console.log(`Đang kiểm tra tiến hóa cho ${pkm.name}...`);
        const nextForm = await getNextEvolution(pkm.id);

        if (nextForm) {
            globalExp -= UPGRADE_COST;

            // Cập nhật thông tin loài mới
            const oldName = pkm.name;
            pkm.id = nextForm.id;
            pkm.name = nextForm.name;
            pkm.lv = 1; // Reset về Level 1

            // Lấy chỉ số gốc của loài mới từ API để đảm bảo sức mạnh vượt trội
            const newStats = await fetchBaseStats(nextForm.id);
            pkm.baseStats = newStats;

            alert(`TUYỆT VỜI! ${oldName.toUpperCase()} đã tiến hóa thành ${pkm.name.toUpperCase()} Lv.1!`);
        } else {
            alert(`${pkm.name} đã đạt hình thái cuối cùng, không thể nâng cấp thêm!`);
            return; // Thoát hàm, không trừ tiền
        }
    }

    // 4. Lưu dữ liệu mới vào LocalStorage
    localStorage.setItem('pkm_global_exp', globalExp);
    localStorage.setItem('pkm_inventory', JSON.stringify(inventory));

    // 5. Cập nhật giao diện (Nếu bạn có hàm render hoặc reload trang)
    if (typeof updateUI === "function") {
        updateUI();
    } else {
        location.reload(); // Tạm thời reload trang để thấy thay đổi
    }
}

/**
 * Truy xuất cây tiến hóa từ PokeAPI và chọn ngẫu nhiên hình thái tiếp theo
 */
async function getNextEvolution(currentId) {
    try {
        // Bước 1: Lấy thông tin loài (species) để lấy URL evolution_chain
        const speciesRes = await fetch(`https://pokeapi.co/api/v2/pokemon-species/${currentId}/`);
        const speciesData = await speciesRes.json();

        // Bước 2: Lấy dữ liệu chuỗi tiến hóa
        const evoRes = await fetch(speciesData.evolution_chain.url);
        const evoData = await evoRes.json();

        // Bước 3: Tìm nút hiện tại trong cây tiến hóa
        let currentNode = findNodeInEvoChain(evoData.chain, speciesData.name);

        // Bước 4: Kiểm tra nếu có hình thái tiếp theo
        if (currentNode && currentNode.evolves_to.length > 0) {
            // Ngẫu nhiên chọn một nhánh tiến hóa (Dành cho Eevee, Gloom, v.v.)
            const randomIndex = Math.floor(Math.random() * currentNode.evolves_to.length);
            const nextSpecies = currentNode.evolves_to[randomIndex].species;

            // Lấy ID từ URL (đoạn cuối của URL species)
            const nextId = nextSpecies.url.split('/').filter(Boolean).pop();
            return { id: nextId, name: nextSpecies.name };
        }
        return null; // Không có tiến hóa tiếp theo
    } catch (error) {
        console.error("Lỗi khi tìm tiến hóa:", error);
        return null;
    }
}

/**
 * Hàm đệ quy để tìm Pokemon hiện tại trong cây tiến hóa
 */
function findNodeInEvoChain(node, targetName) {
    if (node.species.name === targetName) {
        return node;
    }
    for (let i = 0; i < node.evolves_to.length; i++) {
        let found = findNodeInEvoChain(node.evolves_to[i], targetName);
        if (found) return found;
    }
    return null;
}

/**
 * Lấy chỉ số cơ bản (HP, ATK, DEF) từ PokeAPI
 */
async function fetchBaseStats(id) {
    try {
        const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const data = await response.json();
        return {
            hp: data.stats.find(s => s.stat.name === 'hp').base_stat,
            atk: data.stats.find(s => s.stat.name === 'attack').base_stat,
            def: data.stats.find(s => s.stat.name === 'defense').base_stat
        };
    } catch (error) {
        console.error("Lỗi khi lấy chỉ số gốc:", error);
        return { hp: 50, atk: 50, def: 50 }; // Giá trị mặc định nếu lỗi
    }
}

/**
 * Hàm bổ trợ để kiểm tra và hiển thị EXP hiện tại
 */
function updateExpDisplay() {
    const globalExp = localStorage.getItem('pkm_global_exp') || 0;
    const expElement = document.getElementById('global-exp-display');
    if (expElement) expElement.innerText = globalExp;
}