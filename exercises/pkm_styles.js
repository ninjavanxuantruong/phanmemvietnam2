window.PkmStyles = {
    // 6 vị trí cố định — 3 quân/bên xếp vòng cung gần ngang, đối mặt nhau
    positions: {
        // ========== QUÂN TA (dưới - gần) ==========
        // Vòng cung nhẹ: 2 bên hơi lùi lên trên, ở giữa nhô ra gần nhất
        ta_1: { left: 18, top: 76, scale: 1.0,  flip: 1 },
        ta_2: { left: 50, top: 84, scale: 1.08, flip: -1 },
        ta_3: { left: 82, top: 76, scale: 1.0,  flip: -1 },

        // ========== QUÂN ĐỊCH (trên - xa) ==========
        // Đối xứng với quân ta, vòng cung ngược lại, xa hơn nên scale nhỏ hơn chút
        dich_1: { left: 18, top: 22, scale: 0.95, flip: -1 },
        dich_2: { left: 50, top: 14, scale: 1.0,  flip: -1 },
        dich_3: { left: 82, top: 22, scale: 0.95, flip: 1 },
    },

    // Kích thước hiển thị CỐ ĐỊNH cho mọi Pokemon (không phụ thuộc size ảnh gốc)
    UNIT_SIZE: 80, // px

    // Lấy đường dẫn ảnh GIF
    getImageUrl(pkm, side) {
        const folder = side === 'player' ? 'ani-back' : 'ani';
        const cleanName = pkm.name.toLowerCase().replace(/\s+/g, '');
        return `https://play.pokemonshowdown.com/sprites/${folder}/${cleanName}.gif`;
    },

    // Render từng Pokemon
    renderUnit(pkm, index, side) {
        const hpPct = Math.max(0, (pkm.currentHp / pkm.maxHp) * 100);
        const hpColor = hpPct > 50 ? '#2ecc71' : hpPct > 25 ? '#f1c40f' : '#e74c3c';

        const key = side === 'player' ? `ta_${index + 1}` : `dich_${index + 1}`;
        const pos = this.positions[key] || this.positions[side === 'player' ? 'ta_1' : 'dich_1'];
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
                 data-scale="${pos.scale}"
                 data-flip="${pos.flip}"
                 style="position:absolute;
                        left:${pos.left}%;
                        top:${pos.top}%;
                        transform:translate(-50%,-50%);
                        z-index:${zIndex};
                        display:flex;
                        flex-direction:column;
                        align-items:center;">

                <div style="transform:scale(${pos.scale}) scaleX(${pos.flip}); transform-origin:center bottom;">
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
