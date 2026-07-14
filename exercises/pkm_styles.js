window.PkmStyles = {
    // 3 bộ vị trí tuỳ theo SỐ LƯỢNG Pokémon còn lại trong đội
    positionSets: {
        // ========== 1 CON — đứng CHÍNH GIỮA, cả 2 phe ==========
        solo: {
            ta_1:   { left: 50, top: 80, scale: 1.2, flip: 1 },
            dich_1: { left: 50, top: 16, scale: 1.2, flip: -1 },
        },

        // ========== 2 CON — CHIA ĐỀU 2 BÊN, đối xứng qua tâm ==========
        duo: {
            ta_1:   { left: 32, top: 78, scale: 1.05, flip: 1 },
            ta_2:   { left: 68, top: 78, scale: 1.05, flip: -1 },

            dich_1: { left: 32, top: 18, scale: 1.0,  flip: -1 },
            dich_2: { left: 68, top: 18, scale: 1.0,  flip: 1 },
        },

        // ========== 3 CON — bố cục gốc, giữ nguyên như cũ ==========
        full: {
            // ========== QUÂN TA (dưới - gần) ==========
            ta_1: { left: 18, top: 76, scale: 1.0,  flip: 1 },
            ta_2: { left: 50, top: 84, scale: 1.08, flip: -0.7 },
            ta_3: { left: 82, top: 76, scale: 1.0,  flip: -1 },

            // ========== QUÂN ĐỊCH (trên - xa) ==========
            dich_1: { left: 18, top: 22, scale: 0.95, flip: -1 },
            dich_2: { left: 50, top: 14, scale: 1.0,  flip: -0.7 },
            dich_3: { left: 82, top: 22, scale: 0.95, flip: 1 },
        },
    },

    // Kích thước hiển thị CỐ ĐỊNH cho mọi Pokemon (không phụ thuộc size ảnh gốc)
    UNIT_SIZE: 80, // px

    // Chọn đúng bộ vị trí (solo/duo/full) dựa theo số lượng Pokémon trong đội
    getPosition(side, index, teamSize) {
        const setKey = teamSize === 1 ? 'solo' : teamSize === 2 ? 'duo' : 'full';
        const key = side === 'player' ? `ta_${index + 1}` : `dich_${index + 1}`;
        const set = this.positionSets[setKey];
        // Phòng hờ: nếu thiếu key (VD teamSize lệch), fallback về bộ 'full'
        return set[key] || this.positionSets.full[key] || this.positionSets.full[side === 'player' ? 'ta_1' : 'dich_1'];
    },

    // Lấy đường dẫn ảnh GIF
    getImageUrl(pkm, side) {
        const folder = side === 'player' ? 'ani-back' : 'ani';
        const cleanName = pkm.name.toLowerCase().replace(/\s+/g, '');
        return `https://play.pokemonshowdown.com/sprites/${folder}/${cleanName}.gif`;
    },

    // Render từng Pokemon — nhận thêm teamSize để biết dùng bộ vị trí nào
    // Nén tỉ lệ chiều cao thật (pkm.height, đơn vị decimet từ PokeAPI) thành
    // hệ số scale AN TOÀN cho layout — KHÔNG scale tuyến tính 100% vì chênh
    // lệch giữa các loài quá cực đoan (VD Wailord ~14.5m vs Joltik ~0.1m,
    // gấp 145 lần — nếu scale thẳng sẽ vỡ bố cục ngay).
    getBodyScale(heightDecimeter) {
        const heightM = (heightDecimeter || 10) / 10; // fallback 1m nếu thiếu dữ liệu
        const baseline = 1.0; // mét, coi là kích cỡ "trung bình"
        const raw = Math.sqrt(heightM / baseline);
        return Math.min(1.5, Math.max(0.75, raw));
    },

    // Render từng Pokemon — nhận thêm teamSize để biết dùng bộ vị trí nào
    renderUnit(pkm, index, side, teamSize) {
        const hpPct = Math.max(0, (pkm.currentHp / pkm.maxHp) * 100);
        const hpColor = hpPct > 50 ? '#2ecc71' : hpPct > 25 ? '#f1c40f' : '#e74c3c';

        const pos = this.getPosition(side, index, teamSize || 3);
        const bodyScale = this.getBodyScale(pkm.height);
        const finalScale = pos.scale * bodyScale; // độ sâu phối cảnh × kích cỡ thật của loài
        const imgUrl = this.getImageUrl(pkm, side);
        const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkm.id}.png`;
        const zIndex = side === 'player' ? 2 : 1;
        const size = this.UNIT_SIZE;

        // Wrapper ngoài: chỉ định vị trí, KHÔNG flip
        // Image wrapper bên trong: chịu scale + flip
        // Box ảnh bên trong cùng: kích thước CỐ ĐỊNH (size x size) + object-fit:contain
        //   → ảnh gốc to nhỏ khác nhau (Showdown sprite canvas không đều) vẫn hiện ra cùng 1 khung
        // HP bar: nằm ngoài flip, dùng data-attribute lưu pos để restore
        return `
            <div class="pkm-unit"
                 id="${side}-unit-${index}"
                 data-left="${pos.left}"
                 data-top="${pos.top}"
                 data-scale="${finalScale}"
                 data-flip="${pos.flip}"
                 style="position:absolute;
                        left:${pos.left}%;
                        top:${pos.top}%;
                        transform:translate(-50%,-50%);
                        z-index:${zIndex};
                        display:flex;
                        flex-direction:column;
                        align-items:center;">

                <div style="transform:scale(${finalScale}) scaleX(${pos.flip}); transform-origin:center bottom;">
                    <div style="width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center;">
                        <img src="${imgUrl}"
                             style="max-width:${size}px; max-height:${size}px; width:auto; height:auto;
                                    object-fit:contain; filter:drop-shadow(0 5px 10px black); display:block;"
                             onerror="this.src='${fallbackUrl}'"
                             alt="${pkm.name}">
                    </div>
                </div>

                <div style="margin-top:4px; width:70px;">
                    <div style="height:5px; background:#333; border-radius:3px; overflow:hidden;">
                        <div id="${side}-hp-fill-${index}"
                             style="width:${hpPct}%; height:100%; background:${hpColor}; transition:width 0.3s;">
                        </div>
                    </div>
                    <div id="${side}-hp-text-${index}"
                         style="font-size:9px; text-align:center; margin-top:2px; color:rgba(255,255,255,0.85);">
                        ${Math.max(0, pkm.currentHp)}/${pkm.maxHp}
                    </div>
                </div>
            </div>
        `;
    }
};
