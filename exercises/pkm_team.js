/**
 * PKM_TEAM.JS
 * Cơ chế: Bấm chọn Pokemon → bấm vào slot để đặt vào
 * Hoạt động tốt trên cả mobile lẫn desktop
 */

let inventory = JSON.parse(localStorage.getItem('pkm_inventory')) || [];
let selectedUid = null; // UID của Pokemon đang được chọn

function init() {
    renderFormation();
    renderInventory();
    updateBuffs();
}

// =============================================
// 1. VẼ SƠ ĐỒ ĐỘI HÌNH
// =============================================
function renderFormation() {
    const slots = document.querySelectorAll('.slot');
    slots.forEach(slot => {
        const pos = parseInt(slot.dataset.pos);
        const pkm = inventory.find(p => p.inTeam && p.position === pos);

        if (pkm) {
            // Slot có Pokemon
            const isSelected = pkm.uid === selectedUid;
            slot.className = `slot filled ${isSelected ? 'selected' : ''}`;
            slot.innerHTML = `
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pkm.id}.png">
                <div class="slot-name">${pkm.name}</div>
                <div class="slot-lv">Lv.${pkm.lv}</div>
                <button class="remove-btn" onclick="removeFromTeam(event, '${pkm.uid}')">×</button>
            `;
            // Bấm vào slot có Pokemon = chọn con đó
            slot.onclick = (e) => {
                if (e.target.classList.contains('remove-btn')) return;
                selectPkm(pkm.uid);
            };
        } else {
            // Slot trống
            const isHighlight = selectedUid !== null;
            slot.className = `slot empty ${isHighlight ? 'highlight' : ''}`;
            slot.innerHTML = `
                <div class="slot-plus">${isHighlight ? '✓' : '+'}</div>
                <div class="pos-label">Vị trí ${pos}</div>
            `;
            // Bấm vào slot trống = đặt Pokemon đang chọn vào
            slot.onclick = () => {
                if (selectedUid) dropToTeam(selectedUid, pos);
            };
        }
    });
}

// =============================================
// 2. VẼ KHO POKEMON
// =============================================
function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = '';

    if (inventory.length === 0) {
        grid.innerHTML = `<div style="color:#666; grid-column:1/-1; text-align:center; padding:20px;">
            Túi trống! Hãy ấp trứng để có Pokémon.
        </div>`;
        return;
    }

    inventory.forEach(pkm => {
        const div = document.createElement('div');
        const isSelected = pkm.uid === selectedUid;
        const isInTeam   = pkm.inTeam;

        div.className = `pkm-item 
            ${isInTeam   ? 'is-in-team' : ''} 
            ${isSelected ? 'is-selected' : ''}`;

        div.innerHTML = `
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pkm.id}.png">
            <div class="pkm-name">${pkm.name}</div>
            <div class="pkm-lv">Lv.${pkm.lv}</div>
            ${isInTeam ? '<div class="in-team-tag">TRONG ĐỘI</div>' : ''}
        `;

        div.onclick = () => {
            if (isInTeam) {
                // Bấm vào con đang trong đội → chọn nó để di chuyển
                selectPkm(pkm.uid);
            } else {
                // Bấm vào con chưa trong đội → chọn nó
                selectPkm(pkm.uid);
            }
        };

        grid.appendChild(div);
    });
}

// =============================================
// 3. LOGIC CHỌN POKEMON
// =============================================
function selectPkm(uid) {
    if (selectedUid === uid) {
        // Bấm lại vào con đang chọn = bỏ chọn
        selectedUid = null;
    } else {
        selectedUid = uid;
    }
    renderFormation();
    renderInventory();
    updateHint();
}

function updateHint() {
    const hintEl = document.getElementById('selection-hint');
    if (!hintEl) return;
    if (selectedUid) {
        const pkm = inventory.find(p => p.uid === selectedUid);
        hintEl.style.display = 'block';
        hintEl.innerHTML = `✅ Đã chọn <b style="color:#deff9a">${pkm?.name || ''}</b> — Bấm vào ô trống để đặt vào đội`;
    } else {
        hintEl.style.display = 'none';
    }
}

// =============================================
// 4. ĐẶT POKEMON VÀO Ô
// =============================================
function dropToTeam(uid, pos) {
    // Đuổi con cũ đang ở vị trí đó ra
    inventory.forEach(p => {
        if (p.position === pos && p.inTeam) {
            p.inTeam    = false;
            p.position  = null;
        }
    });

    // Nếu con này đang ở vị trí khác → xóa vị trí cũ
    const pkm = inventory.find(p => p.uid === uid);
    if (!pkm) return;

    pkm.inTeam   = true;
    pkm.position = pos;

    selectedUid = null;
    saveAndRefresh();
}

// =============================================
// 5. XÓA KHỎI ĐỘI
// =============================================
function removeFromTeam(event, uid) {
    event.stopPropagation();
    const pkm = inventory.find(p => p.uid === uid);
    if (!pkm) return;
    pkm.inTeam   = false;
    pkm.position = null;
    if (selectedUid === uid) selectedUid = null;
    saveAndRefresh();
}

// =============================================
// 6. BUFF
// =============================================
function updateBuffs() {
    const team   = inventory.filter(p => p.inTeam);
    const buffDiv = document.getElementById('buff-info');
    if (!buffDiv) return;

    if (team.length < 5) {
        buffDiv.innerHTML = `⚠️ Chọn đủ <b>5 Pokémon</b> cho đội hình để kích hoạt Buff.`;
        return;
    }

    const types      = team.map(p => p.type);
    const typeCounts = {};
    types.forEach(t => typeCounts[t] = (typeCounts[t] || 0) + 1);
    const maxSame    = Math.max(...Object.values(typeCounts));
    const uniqueTypes = [...new Set(types)].length;

    if (maxSame >= 3) {
        buffDiv.innerHTML = `🔥 <b>BUFF ĐỒNG NHẤT:</b> +5% Chỉ số (Có 3+ con cùng hệ)`;
    } else if (uniqueTypes >= 4) {
        buffDiv.innerHTML = `🌈 <b>BUFF ĐA DẠNG:</b> +5% Chỉ số (Có 4+ hệ khác nhau)`;
    } else {
        buffDiv.innerHTML = `❄️ Không có Buff nào được kích hoạt.`;
    }
}

// =============================================
// 7. LƯU
// =============================================
function saveAndRefresh() {
    localStorage.setItem('pkm_inventory', JSON.stringify(inventory));
    inventory = JSON.parse(localStorage.getItem('pkm_inventory')) || [];
    init();
    updateHint();
}

// Khởi chạy
init();
