let inventory = JSON.parse(localStorage.getItem('pkm_inventory')) || [];

function init() {
    renderFormation();
    renderInventory();
    updateBuffs();
}

// 1. Vẽ sơ đồ đội hình và gán sự kiện nhận (Drop)
function renderFormation() {
    const slots = document.querySelectorAll('.slot');
    slots.forEach(slot => {
        const pos = parseInt(slot.dataset.pos);
        const pkm = inventory.find(p => p.inTeam && p.position === pos);

        // Sự kiện Kéo/Thả
        slot.ondragover = (e) => { e.preventDefault(); slot.classList.add('drag-over'); };
        slot.ondragleave = () => slot.classList.remove('drag-over');
        slot.ondrop = (e) => {
            slot.classList.remove('drag-over');
            const pkmUid = e.dataTransfer.getData("pkm_uid");
            dropToTeam(pkmUid, pos);
        };

        if (pkm) {
            slot.innerHTML = `
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pkm.id}.png">
                <span class="pos-label">Vị trí ${pos}</span>
                <button class="remove-btn" onclick="removeFromTeam('${pkm.uid}')">×</button>
            `;
        } else {
            slot.innerHTML = `<span style="font-size:24px; color:#444">+</span><span class="pos-label">Trống</span>`;
        }
    });
}

// 2. Vẽ kho đồ và gán sự kiện bắt đầu kéo (Drag)
function renderInventory() {
    const grid = document.getElementById('inventory-grid');
    grid.innerHTML = "";
    inventory.forEach(pkm => {
        const div = document.createElement('div');
        div.className = `pkm-item ${pkm.inTeam ? 'is-in-team' : ''}`;
        div.draggable = true; // Quan trọng để kéo được

        div.innerHTML = `
            <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pkm.id}.png" draggable="false">
            <div style="font-size:12px;">Lv.${pkm.lv}</div>
        `;

        // Khi bắt đầu cầm con thú kéo đi
        div.ondragstart = (e) => {
            e.dataTransfer.setData("pkm_uid", pkm.uid);
            div.classList.add('dragging');
        };
        div.ondragend = () => div.classList.remove('dragging');

        grid.appendChild(div);
    });
}

// 3. Xử lý khi thả Pokémon vào ô
function dropToTeam(uid, pos) {
    // Tìm con Pokémon đang được kéo
    let pkm = inventory.find(p => p.uid === uid);

    // Nếu con này đang ở vị trí khác trong đội, xóa vị trí cũ của nó
    inventory.forEach(p => {
        if (p.position === pos) { // Nếu ô đích có con khác, đuổi con đó ra
            p.inTeam = false;
            p.position = null;
        }
    });

    pkm.inTeam = true;
    pkm.position = pos;
    saveAndRefresh();
}

function removeFromTeam(uid) {
    let pkm = inventory.find(p => p.uid === uid);
    pkm.inTeam = false;
    pkm.position = null;
    saveAndRefresh();
}

function updateBuffs() {
    const team = inventory.filter(p => p.inTeam);
    const buffDiv = document.getElementById('buff-info');

    if (team.length < 5) {
        buffDiv.innerHTML = "⚠️ Kéo đủ 5 Pokémon vào đội hình để kích hoạt Buff.";
        return;
    }

    const types = team.map(p => p.type); 
    const typeCounts = {};
    types.forEach(t => typeCounts[t] = (typeCounts[t] || 0) + 1);
    const maxSame = Math.max(...Object.values(typeCounts));
    const uniqueTypes = [...new Set(types)].length;

    if (maxSame >= 3) {
        buffDiv.innerHTML = "🔥 <b>BUFF ĐỒNG NHẤT:</b> +5% Chỉ số (Có 3+ con cùng hệ)";
    } else if (uniqueTypes >= 4) {
        buffDiv.innerHTML = "🌈 <b>BUFF ĐA DẠNG:</b> +5% Chỉ số (Có 4+ hệ khác nhau)";
    } else {
        buffDiv.innerHTML = "❄️ Không có Buff nào được kích hoạt.";
    }
}

function saveAndRefresh() {
    localStorage.setItem('pkm_inventory', JSON.stringify(inventory));
    init();
}

init();