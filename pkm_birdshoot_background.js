/**
 * ============================================================================
 * POKÉMON BIRD SHOOT — BACKGROUND MODULE (hình ảnh: nền, chim, cối xay gió,
 * khinh khí cầu)
 * ============================================================================
 * File RIÊNG chỉ lo phần VẼ — pkm_birdshoot.js (KHÔNG sửa lại ở đây) gọi
 * đúng 6 hàm dưới đây theo API đã chốt sẵn trong comment đầu pkm_birdshoot.js:
 *
 *   BirdShootBackground.preload()
 *   BirdShootBackground.rebuildGradients(ctx, state)
 *   BirdShootBackground.drawBackground(ctx, state)
 *   BirdShootBackground.drawBird(ctx, obj, state)
 *   BirdShootBackground.drawWindmill(ctx, obj, state)
 *   BirdShootBackground.drawBalloon(ctx, obj, state)
 *
 * state = { VW, VH, level, speedMul, tNow }.
 *
 * QUAN TRỌNG — ĐỒNG BỘ VỊ TRÍ CÁNH CỐI XAY GIÓ: pkm_birdshoot.js hit-test
 * bắn trúng cánh bằng windmillBladeTipPos(w, index) với công thức:
 *   angle = w.rotAngle + index * (2π/5)
 *   r     = w.bladeLen * 0.66 * w.scale
 * Hàm _bladeCenter() bên dưới PHẢI dùng ĐÚNG công thức này (chỉ khác là vẽ
 * cả thân cánh từ trục ra tới r = bladeLen*scale, không chỉ điểm tâm) —
 * nếu đổi 1 trong 2 bên mà không đổi bên kia thì vùng bắn trúng sẽ bị lệch
 * khỏi hình vẽ.
 *
 * Chim KHÔNG dùng ảnh sprite rời — vẽ bằng canvas path (giống phong cách
 * pkm_race_background.js vẽ chướng ngại vật/vật trang trí), vừa nhẹ vừa dễ
 * đổi màu theo species mà không cần thêm ảnh.
 * ============================================================================
 */

window.BirdShootBackground = {
    // Ảnh nền đồng quê do người dùng cung cấp — tải 1 lần, cache lại, dùng
    // kiểu "cover" (phủ kín khung, cắt bớt dư ra) cho mọi tỉ lệ màn hình.
    IMG_URL: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/banchim1.png",
    _bgImg: null,
    _bgLoaded: false,
    _bgFailed: false,

    preload() {
        if (this._bgImg) return;
        this._bgImg = new Image();
        this._bgImg.crossOrigin = "anonymous";
        this._bgImg.onload = () => { this._bgLoaded = true; };
        this._bgImg.onerror = () => {
            this._bgFailed = true;
            console.warn("⚠️ [BirdShootBackground] Không tải được ảnh nền, dùng gradient dự phòng:", this.IMG_URL);
        };
        this._bgImg.src = this.IMG_URL;
    },

    // ═══════════════════════════════════════════════════════════
    // GRADIENT DỰ PHÒNG (khi ảnh chưa tải xong / lỗi) + LỚP VIGNETTE
    // ═══════════════════════════════════════════════════════════
    _gradCache: null,

    rebuildGradients(ctx, state) {
        const sky = ctx.createLinearGradient(0, 0, 0, state.VH);
        sky.addColorStop(0, "#5fa8d8");
        sky.addColorStop(0.5, "#bfe0ae");
        sky.addColorStop(0.68, "#e8d998");
        sky.addColorStop(1, "#c7a955");

        const vign = ctx.createRadialGradient(state.VW / 2, state.VH * 0.4, state.VH * 0.32, state.VW / 2, state.VH * 0.4, state.VH * 0.82);
        vign.addColorStop(0, "rgba(0,0,0,0)");
        vign.addColorStop(1, "rgba(0,0,0,0.32)");

        this._gradCache = { sky, vign };
        return this._gradCache;
    },

    // ═══════════════════════════════════════════════════════════
    // NỀN — ảnh đồng quê phủ "cover" kín khung hình ảo
    // ═══════════════════════════════════════════════════════════
    drawBackground(ctx, state) {
        const g = this._gradCache || this.rebuildGradients(ctx, state);

        if (this._bgLoaded && this._bgImg && this._bgImg.naturalWidth > 0) {
            this._drawCover(ctx, this._bgImg, state.VW, state.VH);
        } else {
            ctx.fillStyle = g.sky;
            ctx.fillRect(0, 0, state.VW, state.VH);
        }

        ctx.fillStyle = g.vign;
        ctx.fillRect(0, 0, state.VW, state.VH);
    },

    // Vẽ ảnh phủ kín khung theo kiểu "background-size: cover" (giữ tỉ lệ,
    // scale theo cạnh lớn hơn, cắt bớt phần dư 2 bên/trên-dưới).
    _drawCover(ctx, img, vw, vh) {
        const iw = img.naturalWidth, ih = img.naturalHeight;
        const scale = Math.max(vw / iw, vh / ih);
        const dw = iw * scale, dh = ih * scale;
        const dx = (vw - dw) / 2, dy = (vh - dh) / 2;
        ctx.drawImage(img, dx, dy, dw, dh);
    },

    // ═══════════════════════════════════════════════════════════
    // BẢNG MÀU 3 GIỐNG CHIM
    // ═══════════════════════════════════════════════════════════
    BIRD_PALETTE: {
        brown: { body: "#8a5a2e", body2: "#5e3a1a", belly: "#e8c98a", wing: "#6b451f", beak: "#ffb339", comb: "#c0392b" },
        red: { body: "#c0392b", body2: "#7a2015", belly: "#ffdca8", wing: "#8f2a1e", beak: "#ffb339", comb: "#7a2015" },
        white: { body: "#f2f2f2", body2: "#c7c7c7", belly: "#fff8e0", wing: "#d8d8d8", beak: "#ff9f1c", comb: "#e74c3c" },
    },

    // ═══════════════════════════════════════════════════════════
    // CHIM — vẽ bằng canvas path, quay đầu theo hướng bay, đập cánh theo
    // obj.flapPhase, độ nghiêng theo obj.rot (đã tính sẵn ở pkm_birdshoot.js)
    // ═══════════════════════════════════════════════════════════
    drawBird(ctx, obj, state) {
        const pal = this.BIRD_PALETTE[obj.species] || this.BIRD_PALETTE.brown;
        const s = obj.scale;
        const dir = obj.vx < 0 ? -1 : 1; // mặc định quay phải nếu chưa di chuyển
        const flap = Math.sin(obj.flapPhase); // -1..1

        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.rotate(obj.rot || 0);
        ctx.scale(dir * s, s);

        // bóng mờ phía dưới (giúp cảm nhận độ cao dù không có mặt đất ngay dưới)
        ctx.save();
        ctx.globalAlpha = 0.18;
        ctx.fillStyle = "#000";
        ctx.beginPath(); ctx.ellipse(0, 34, 26, 7, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // cánh SAU (xa camera hơn) — vẽ trước để cánh trước đè lên
        ctx.fillStyle = pal.wing;
        ctx.save();
        ctx.translate(-4, 2);
        ctx.rotate(-0.4 + flap * 0.55);
        ctx.beginPath(); ctx.ellipse(0, 0, 22, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // đuôi
        ctx.fillStyle = pal.body2;
        ctx.beginPath();
        ctx.moveTo(-20, -2); ctx.lineTo(-38, -14); ctx.lineTo(-30, 2); ctx.lineTo(-38, 10); ctx.lineTo(-18, 6);
        ctx.closePath(); ctx.fill();

        // thân
        const bodyGrad = ctx.createLinearGradient(-20, -18, 20, 18);
        bodyGrad.addColorStop(0, pal.body); bodyGrad.addColorStop(1, pal.body2);
        ctx.fillStyle = bodyGrad;
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 17, 0, 0, Math.PI * 2); ctx.fill();

        // bụng sáng màu
        ctx.fillStyle = pal.belly;
        ctx.beginPath(); ctx.ellipse(2, 6, 15, 9, 0, 0, Math.PI * 2); ctx.fill();

        // đầu
        ctx.fillStyle = pal.body;
        ctx.beginPath(); ctx.arc(20, -10, 11, 0, Math.PI * 2); ctx.fill();

        // mào đỏ
        ctx.fillStyle = pal.comb;
        ctx.beginPath();
        ctx.moveTo(16, -19); ctx.lineTo(19, -26); ctx.lineTo(22, -19);
        ctx.lineTo(25, -25); ctx.lineTo(27, -18); ctx.closePath(); ctx.fill();

        // mỏ
        ctx.fillStyle = pal.beak;
        ctx.beginPath(); ctx.moveTo(29, -10); ctx.lineTo(38, -7); ctx.lineTo(29, -4); ctx.closePath(); ctx.fill();

        // mắt
        ctx.fillStyle = "#1a1410";
        ctx.beginPath(); ctx.arc(24, -12, 2.2, 0, Math.PI * 2); ctx.fill();

        // cánh TRƯỚC (gần camera hơn) — đập theo nhịp bay
        ctx.fillStyle = pal.wing;
        ctx.save();
        ctx.translate(-2, -1);
        ctx.rotate(-0.2 - flap * 0.7);
        ctx.beginPath(); ctx.ellipse(0, 0, 24, 11, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.25)"; ctx.lineWidth = 1; ctx.stroke();
        ctx.restore();

        // chân (chỉ lộ rõ khi bay ngang thong thả, không quá quan trọng)
        ctx.strokeStyle = pal.beak; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.moveTo(-2, 15); ctx.lineTo(-4, 26); ctx.moveTo(6, 15); ctx.lineTo(8, 26); ctx.stroke();

        ctx.restore();
    },

    // ═══════════════════════════════════════════════════════════
    // CỐI XAY GIÓ — 5 cánh, mỗi cánh check obj.blades[i].alive để vẽ hoặc
    // bỏ qua (đã bị bắn gãy). Công thức góc PHẢI khớp windmillBladeTipPos()
    // trong pkm_birdshoot.js (xem ghi chú đầu file).
    // ═══════════════════════════════════════════════════════════
    _bladeAngle(w, index) {
        return w.rotAngle + index * ((Math.PI * 2) / 5);
    },

    drawWindmill(ctx, obj, state) {
        const s = obj.scale;
        const fadeAlpha = obj.destroyed ? Math.max(0, 1 - obj.despawnT / 0.6) : 1;

        ctx.save();
        ctx.globalAlpha = fadeAlpha;
        ctx.translate(obj.x, obj.y);

        // tháp gỗ đỡ cối xay — neo xuống dưới để trông như gắn vào mặt đất/đồi
        const towerH = 210 * s, towerW = 46 * s;
        const towerGrad = ctx.createLinearGradient(-towerW / 2, 0, towerW / 2, towerH);
        towerGrad.addColorStop(0, "#8a6a48"); towerGrad.addColorStop(1, "#5a3f26");
        ctx.fillStyle = towerGrad;
        ctx.beginPath();
        ctx.moveTo(-towerW * 0.32, 0); ctx.lineTo(towerW * 0.32, 0);
        ctx.lineTo(towerW * 0.5, towerH); ctx.lineTo(-towerW * 0.5, towerH);
        ctx.closePath(); ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1.5; ctx.stroke();
        // thanh chống chéo trang trí
        ctx.strokeStyle = "rgba(255,255,255,0.15)"; ctx.lineWidth = 2 * s;
        ctx.beginPath();
        ctx.moveTo(-towerW * 0.4, towerH * 0.25); ctx.lineTo(towerW * 0.4, towerH * 0.7);
        ctx.moveTo(towerW * 0.4, towerH * 0.25); ctx.lineTo(-towerW * 0.4, towerH * 0.7);
        ctx.stroke();
        // mái nhỏ chỏm trên đỉnh tháp
        ctx.fillStyle = "#4a2f1c";
        ctx.beginPath(); ctx.moveTo(-14 * s, 0); ctx.lineTo(0, -16 * s); ctx.lineTo(14 * s, 0); ctx.closePath(); ctx.fill();

        // trục giữa (hub)
        const hubR = 13 * s;
        ctx.fillStyle = "#3a2a1c";
        ctx.beginPath(); ctx.arc(0, 0, hubR, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,203,5,0.7)"; ctx.lineWidth = 2; ctx.stroke();

        // 5 cánh
        obj.blades.forEach((blade, i) => {
            const angle = this._bladeAngle(obj, i);
            if (!blade.alive) {
                // cánh đã bị bắn gãy — chỉ còn 1 mẩu cụt gần trục + vài mảnh vỡ bay quanh
                ctx.save();
                ctx.rotate(angle);
                ctx.fillStyle = "#5a4530";
                ctx.beginPath();
                ctx.moveTo(hubR, -6 * s); ctx.lineTo(hubR + 16 * s, -4 * s);
                ctx.lineTo(hubR + 16 * s, 4 * s); ctx.lineTo(hubR, 6 * s);
                ctx.closePath(); ctx.fill();
                ctx.restore();
                return;
            }
            ctx.save();
            ctx.rotate(angle);
            const bladeLen = obj.bladeLen * s;
            const grad = ctx.createLinearGradient(hubR, 0, bladeLen, 0);
            grad.addColorStop(0, "#e8dcc0"); grad.addColorStop(1, "#b89a68");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(hubR, -9 * s);
            ctx.lineTo(bladeLen, -16 * s);
            ctx.lineTo(bladeLen + 8 * s, 0);
            ctx.lineTo(bladeLen, 16 * s);
            ctx.lineTo(hubR, 9 * s);
            ctx.closePath();
            ctx.fill();
            ctx.strokeStyle = "rgba(90,60,20,0.5)"; ctx.lineWidth = 1.5; ctx.stroke();
            // sọc vải trang trí trên cánh
            ctx.strokeStyle = "rgba(122,32,21,0.55)"; ctx.lineWidth = 2 * s;
            for (let k = 1; k <= 3; k++) {
                const lx = hubR + (bladeLen - hubR) * (k / 4);
                ctx.beginPath(); ctx.moveTo(lx, -12 * s * (1 - k / 5)); ctx.lineTo(lx, 12 * s * (1 - k / 5)); ctx.stroke();
            }
            ctx.restore();
        });

        // chốt trục nổi lên trên cùng
        ctx.fillStyle = "#ffcb05"; ctx.globalAlpha = fadeAlpha * 0.9;
        ctx.beginPath(); ctx.arc(0, 0, 4 * s, 0, Math.PI * 2); ctx.fill();

        ctx.restore();
    },

    // ═══════════════════════════════════════════════════════════
    // KHINH KHÍ CẦU — mục tiêu cần TRÁNH, tô màu cảnh báo sọc đỏ/trắng để
    // dễ phân biệt với chim ngay từ xa.
    // ═══════════════════════════════════════════════════════════
    drawBalloon(ctx, obj, state) {
        const s = obj.scale;
        ctx.save();
        ctx.translate(obj.x, obj.y);
        ctx.scale(s, s);

        // dây neo + giỏ
        ctx.strokeStyle = "rgba(60,40,20,0.7)"; ctx.lineWidth = 1.6;
        ctx.beginPath(); ctx.moveTo(-14, 46); ctx.lineTo(-9, 62); ctx.moveTo(14, 46); ctx.lineTo(9, 62); ctx.stroke();
        ctx.fillStyle = "#6b4a2c";
        ctx.fillRect(-12, 62, 24, 16);
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 1; ctx.strokeRect(-12, 62, 24, 16);

        // thân khinh khí cầu — sọc đỏ trắng cảnh báo
        ctx.save();
        ctx.beginPath(); ctx.ellipse(0, 0, 42, 54, 0, 0, Math.PI * 2); ctx.clip();
        ctx.fillStyle = "#f2f2f2"; ctx.fillRect(-50, -60, 100, 120);
        ctx.fillStyle = "#e74c3c";
        for (let i = -4; i <= 4; i += 2) ctx.fillRect(i * 10 - 5, -60, 10, 120);
        ctx.restore();
        ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.ellipse(0, 0, 42, 54, 0, 0, Math.PI * 2); ctx.stroke();

        // ánh sáng nhẹ phía trên tạo khối tròn
        const shine = ctx.createRadialGradient(-14, -22, 4, -14, -22, 40);
        shine.addColorStop(0, "rgba(255,255,255,0.55)"); shine.addColorStop(1, "rgba(255,255,255,0)");
        ctx.fillStyle = shine;
        ctx.beginPath(); ctx.ellipse(0, 0, 42, 54, 0, 0, Math.PI * 2); ctx.fill();

        // dấu chấm than cảnh báo nhỏ trên thân
        ctx.fillStyle = "#c0392b";
        ctx.beginPath(); ctx.arc(0, 10, 12, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff";
        ctx.font = "bold 16px Baloo 2, sans-serif"; ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("!", 0, 11);

        ctx.restore();
    },
};
