window.PkmStyles = {
    // 10 vị trí cố định - dùng left, top, scale, flip
    positions: {
        // ========== QUÂN TA (dưới - gần) ==========
        // Hàng giữa: 2 con (ta_1, ta_2) — cách trung tâm ~20% lên trên
        ta_1: { left: 28, top: 72, scale: 1.0, flip: 1 },
        ta_2: { left: 72, top: 72, scale: 1.0, flip: -1 },

        // Hàng dưới: 3 con (ta_3, ta_4, ta_5) — dàn ngang ~80% chiều rộng
        ta_3: { left: 12, top: 80, scale: 1.6,  flip: 1 },
        ta_4: { left: 50, top: 90, scale: 1.9,  flip: -1 },
        ta_5: { left: 88, top: 80, scale: 1.6,  flip: -1 },

        // ========== QUÂN ĐỊCH (trên - xa) ==========
        // Hàng giữa: 2 con (dich_1, dich_2) — đối xứng với ta_1, ta_2
        dich_1: { left: 60, top: 20, scale: 1.2,  flip:  1 },
        dich_2: { left: 40, top: 20, scale: 1.2,  flip: -1 },

        // Hàng trên: 3 con (dich_3, dich_4, dich_5) — dàn ngang xa nhất
        dich_3: { left: 75, top: 12, scale: 0.95, flip:  1 },
        dich_4: { left: 50, top: 10, scale: 0.75,  flip:  1 },
        dich_5: { left: 25, top: 12, scale: 0.95, flip: -1 },
    },

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
        const pos = this.positions[key];
        const imgUrl = this.getImageUrl(pkm, side);
        const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pkm.id}.png`;
        const zIndex = side === 'player' ? 2 : 1;

        // Wrapper ngoài: chỉ định vị trí, KHÔNG flip
        // Image wrapper bên trong: chịu scale + flip
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
                    <img src="${imgUrl}"
                         style="width:80px; height:80px; object-fit:contain; filter:drop-shadow(0 5px 10px black); display:block;"
                         onerror="this.src='${fallbackUrl}'"
                         alt="${pkm.name}">
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