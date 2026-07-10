/**
 * ============================================================
 * PKM SKILL AOE — Chiêu diện rộng (tách từ pkm_skill.js cũ)
 * ============================================================
 * SO VỚI pkm_skill.js GỐC, FILE NÀY THAY ĐỔI:
 *
 *  1. KHÔNG còn xử lý "đánh thường" (húc / đấm liên tục / chạy vòng)
 *     — logic đó dời sang pkm_skill_normal.js.
 *     pkm_battle.js đã tự route rồi:
 *         playInfo.isAOE ? SkillManager.play(...) : SkillManager.playNormalAttack(...)
 *     => play() ở đây CHỈ còn chạy khi info.isSkill === true (AOE thật).
 *     Nhánh "đánh hụt" (info.missed) cũng được battle.js route sang
 *     playNormalAttack() luôn (vì missed thì isAOE luôn falsy) nên
 *     play() ở đây KHÔNG cần nhánh missed nữa.
 *
 *  2. durationConfig tách 2 tầng:
 *       this.durationConfig.aoe.*    ← dùng trong file này
 *       this.durationConfig.normal.* ← sẽ được pkm_skill_normal.js
 *                                       gộp vào bằng Object.assign
 *     Mọi spawnXxx trong file này đọc từ durationConfig.aoe.
 *
 *  3. Giao diện CHỌN CHIÊU đổi từ "orb xoay quanh Pokemon" sang
 *     BẢNG BẤM (button panel) nổi ở đáy màn hình — playSkillSelectPanel().
 *     - Người chơi: hiện bảng, có đếm ngược skillChoiceWindow (3s),
 *       bấm chọn hoặc hết giờ tự random.
 *     - AI địch: không hiện bảng, tự chọn ngay sau một khoảng "nghĩ" ngắn.
 *     - Nếu hệ chỉ có 1 chiêu (pool.length===1) thì bỏ qua bảng luôn
 *       (logic này giữ nguyên như bản gốc).
 *
 *  4. window.SoundEngine (Web Audio API, không cần file mp3) — mỗi
 *     chiêu gọi 3 mốc âm thanh riêng: playChargeSfx / playTravelSfx /
 *     playImpactSfx. Impact được gọi TẬP TRUNG trong triggerMultiEffect
 *     (tránh trùng lặp code ở từng spawnXxx), charge/travel do từng
 *     spawnXxx tự gọi vì thời điểm khác nhau tuỳ chiêu.
 *
 *  5. skillMeta{} — bảng tên hiển thị của từng chiêu (dùng để render
 *     label trên bảng bấm). Đặt cạnh từng spawnXxx tương ứng.
 *
 *  6. FILE TEST: mới viết ĐẦY ĐỦ 1 chiêu — spawnElectric (quả cầu điện,
 *     hệ Điện) — và 1 hàm dùng chung spawnDefault cho MỌI hệ chưa có
 *     chiêu riêng. Các hệ khác (lửa, nước, cỏ, ...) sẽ bổ sung dần sau,
 *     chỉ cần thêm hàm spawn<Hệ> + skillMeta tương ứng, không cần sửa
 *     logic tổng quan.
 *
 * pkm_skill_back.js (lớp tint nền theo hệ, fade in/out dần) giữ nguyên,
 * gọi qua toggleSkillScene() như cũ — không đổi trong file này.
 * ============================================================
 */

// Tự động nạp CSS cho Skill (giữ nguyên như bản gốc)
(function () {
    const cssPath = 'pkm_skill.css';
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = cssPath;
        document.head.appendChild(link);
    }
})();

// ─────────────────────────────────────────────
// SOUND ENGINE — âm thanh tạo bằng Web Audio API, không cần file mp3
// ─────────────────────────────────────────────
window.SoundEngine = {
    _ctx: null,
    getCtx() {
        if (!this._ctx) {
            this._ctx = new (window.AudioContext || window.webkitAudioContext)();
        }
        if (this._ctx.state === 'suspended') this._ctx.resume();
        return this._ctx;
    },

    // Tiếng "tách/zap" điện tử ngắn — hệ Điện
    zap(freqStart = 900, freqEnd = 200, duration = 0.1, volume = 0.15) {
        const ctx = this.getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(Math.max(30, freqEnd), ctx.currentTime + duration);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.02);
    },

    // Tiếng "vù/whoosh" — đạn bay, gió, cắt không khí
    whoosh(duration = 0.3, volume = 0.2, freq = 1200) {
        const ctx = this.getCtx();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'bandpass';
        filter.frequency.setValueAtTime(freq, ctx.currentTime);
        filter.frequency.exponentialRampToValueAtTime(freq * 0.3, ctx.currentTime + duration);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);

        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start();
        noise.stop(ctx.currentTime + duration);
    },

    // Tiếng "bùm/boom" trầm — nổ, va chạm mạnh
    boom(duration = 0.35, volume = 0.3, freqStart = 150) {
        const ctx = this.getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freqStart, ctx.currentTime);
        osc.frequency.exponentialRampToValueAtTime(30, ctx.currentTime + duration);
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.02);

        const bufferSize = ctx.sampleRate * 0.08;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(volume * 0.6, ctx.currentTime);
        noise.connect(noiseGain).connect(ctx.destination);
        noise.start();
    },

    // Tiếng "chuông/chime" trong trẻo — Tiên, Tâm linh, phép nhẹ
    chime(freq = 1200, duration = 0.4, volume = 0.12) {
        const ctx = this.getCtx();
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, ctx.currentTime);
        gain.gain.setValueAtTime(0, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(volume, ctx.currentTime + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
        osc.connect(gain).connect(ctx.destination);
        osc.start();
        osc.stop(ctx.currentTime + duration + 0.02);
    },

    // Tiếng "rung/rumble" trầm kéo dài — dậm đất, đá lở
    rumble(duration = 0.6, volume = 0.18, freq = 60) {
        const ctx = this.getCtx();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(freq, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.linearRampToValueAtTime(0.001, ctx.currentTime + duration);

        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start();
        noise.stop(ctx.currentTime + duration);
    },

    // Tiếng "sôi bùng/burn" cho lửa
    crackle(duration = 0.3, volume = 0.15) {
        const ctx = this.getCtx();
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);

        const noise = ctx.createBufferSource();
        noise.buffer = buffer;
        const filter = ctx.createBiquadFilter();
        filter.type = 'highpass';
        filter.frequency.setValueAtTime(1500, ctx.currentTime);
        const gain = ctx.createGain();
        gain.gain.setValueAtTime(volume, ctx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

        noise.connect(filter).connect(gain).connect(ctx.destination);
        noise.start();
        noise.stop(ctx.currentTime + duration);
    },

    playDelayed(fnName, delay, ...args) {
        setTimeout(() => {
            if (typeof this[fnName] === 'function') this[fnName](...args);
        }, delay);
    },
};

// ─────────────────────────────────────────────
// SKILL MANAGER — lõi điều phối AOE
// ─────────────────────────────────────────────
window.SkillManager = {
    audioBaseUrl: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/s%20(",

    // Đếm số lượt skill đang chạy đồng thời (2 bên cùng đánh)
    _activeSceneCount: 0,
    _activeAttackers: new Set(),
    _bgInstances: { player: null, enemy: null },

    skillPools: {},

    // ── CONFIG THỜI GIAN — tách namespace .aoe để không đụng .normal ──
    durationConfig: {
        aoe: {
            chargeAura: 900,
            projectileFly: 3000,
            targetSustain: 4000,
            skillChoiceWindow: 3000,
            delayBetween: 300,
            particleLife: 1000,
            electricBolt: 300,
            shake: 800,
            statusText: 1600,
            sceneTransition: 1200,
        },
        // normal: {...} ← pkm_skill_normal.js sẽ Object.assign thêm vào đây
    },

    systemConfig: {
        'electric': { color: '#f1c40f' }, 'fire': { color: '#e67e22' },
        'water': { color: '#3498db' }, 'grass': { color: '#2ecc71' },
        'psychic': { color: '#9b59b6' }, 'fighting': { color: '#e74c3c' },
        'ice': { color: '#74b9ff' }, 'poison': { color: '#a040a0' },
        'ground': { color: '#e2bf65' }, 'flying': { color: '#a890f0' },
        'bug': { color: '#a8b820' }, 'rock': { color: '#b8a038' },
        'ghost': { color: '#705898' }, 'dark': { color: '#705848' },
        'normal': { color: '#a8a878' },
        'steel': { color: '#b8b8d0' },
        'dragon': { color: '#7038f8' },
        'fairy': { color: '#ee99ac' },
    },

    // ── TÊN HIỂN THỊ CỦA TỪNG CHIÊU (dùng cho bảng bấm) ──
    // Chỉ hệ Điện có chiêu thật ở bản test này; các hệ khác dùng
    // spawnDefault nên chưa cần khai báo — thêm dần khi viết chiêu mới.
    skillMeta: {
        electric: {
            spawnElectric: 'Thunderbolt',     // Skill 1: Tia sét phóng từ ta sang địch
                spawnElectric3: 'Thunderstorm',
        },
    },

    getSkillLabel(type, methodName) {
        return (this.skillMeta[type] && this.skillMeta[type][methodName]) || methodName;
    },

    // ─────────────────────────────────────────────
    // QUẢN LÝ POOL CHIÊU (giữ nguyên logic gốc)
    // ─────────────────────────────────────────────
    peekSkillPool(baseMethodName) {
        if (!this.skillPools[baseMethodName] || this.skillPools[baseMethodName].length === 0) {
            const candidates = [
                baseMethodName,
                `${baseMethodName}2`,
                `${baseMethodName}3`
            ].filter(name => typeof this[name] === 'function');

            for (let i = candidates.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
            }
            this.skillPools[baseMethodName] = candidates;
        }
        return this.skillPools[baseMethodName];
    },

    consumeSkillFromPool(baseMethodName, methodName) {
        const pool = this.skillPools[baseMethodName];
        if (!pool) return;
        const idx = pool.indexOf(methodName);
        if (idx !== -1) pool.splice(idx, 1);
    },

    getNextSkillMethod(baseMethodName) {
        const pool = this.peekSkillPool(baseMethodName);
        const methodName = pool[Math.floor(Math.random() * pool.length)];
        this.consumeSkillFromPool(baseMethodName, methodName);
        return methodName;
    },

    // Điều phối: người chơi chọn trong bảng bấm 3s, AI tự chọn ngay
    async chooseSkillInteractive(attacker, type, baseMethodName, isPlayerControlled) {
        const pool = this.peekSkillPool(baseMethodName).slice();

        // Chỉ còn 1 chiêu duy nhất -> không cần hỏi, dùng luôn
        if (pool.length === 1) {
            const methodName = pool[0];
            this.consumeSkillFromPool(baseMethodName, methodName);
            await this.playSkillSelectPanel(attacker, type, methodName, baseMethodName, pool, false);
            return methodName;
        }

        const interactive = !!isPlayerControlled;
        const chosen = await this.playSkillSelectPanel(attacker, type, null, baseMethodName, pool, interactive);
        this.consumeSkillFromPool(baseMethodName, chosen);
        return chosen;
    },

    // Hàm đọc tên Pokemon (giữ nguyên, dùng chung với battle.js)
    speakName(name) {
        if (!window.speechSynthesis || !name) return;
        window.speechSynthesis.cancel();
        const msg = new SpeechSynthesisUtterance(name);
        msg.lang = 'en-US';
        msg.rate = 1.0;
        window.speechSynthesis.speak(msg);
    },

    // SFX dự phòng từ file mp3 (legacy) — dùng khi 1 hệ chưa có âm SoundEngine riêng
    playRandomSfx() {
        const randomNum = Math.floor(Math.random() * 7) + 1;
        const audioUrl = `${this.audioBaseUrl}${randomNum}).wav`;
        const audio = new Audio(audioUrl);
        audio.volume = 0.6;
        audio.play().catch(() => {});
    },

    // Rung màn hình toàn cục theo scale (Gen càng cao rung càng mạnh)
    applyGlobalShake(scale) {
        const intensity = 2 * scale;
        const duration = 500;
        document.body.animate([
            { transform: `translate(${intensity}px, ${intensity}px)` },
            { transform: `translate(-${intensity}px, -${intensity * 2}px)` },
            { transform: `translate(-${intensity * 2}px, 0px)` },
            { transform: `translate(${intensity * 2}px, ${intensity}px)` },
            { transform: `translate(0px, 0px)` }
        ], { duration: 100, iterations: duration / 100 });
    },

    // ── 3 MỐC ÂM THANH — mỗi hệ tự tra, có fallback chung ──
    playChargeSfx(type) {
        switch (type) {
            case 'electric': window.SoundEngine.zap(300, 900, 0.25, 0.12); break;
            case 'fire':     window.SoundEngine.crackle(0.3, 0.12); break;
            case 'ground':
            case 'rock':     window.SoundEngine.rumble(0.4, 0.14); break;
            case 'fairy':
            case 'psychic':  window.SoundEngine.chime(900, 0.35, 0.1); break;
            default:         window.SoundEngine.chime(700, 0.3, 0.08);
        }
    },
    playTravelSfx(type) {
        switch (type) {
            case 'electric': window.SoundEngine.whoosh(0.25, 0.15, 1600); break;
            case 'flying':   window.SoundEngine.whoosh(0.2, 0.16, 2000); break;
            default:         window.SoundEngine.whoosh(0.25, 0.12, 1000);
        }
    },
    playImpactSfx(type) {
        switch (type) {
            case 'electric': window.SoundEngine.zap(900, 150, 0.15, 0.2); break;
            case 'fighting':
            case 'ground':
            case 'rock':      window.SoundEngine.boom(0.35, 0.28); break;
            default:          window.SoundEngine.boom(0.3, 0.2);
        }
    },

    // ─────────────────────────────────────────────
    // LỚP TINT NỀN THEO HỆ (giữ nguyên, phần fade-in/out do
    // pkm_skill_back.js đảm nhận qua instance.show()/hide())
    // ─────────────────────────────────────────────
    toggleSkillScene(show, side = '', attackerIndex = null, type = 'normal') {
        const arena = document.getElementById('battle-arena');

        if (show) {
            this._activeSceneCount++;
            this._activeAttackers.add(`${side}-unit-${attackerIndex}`);

            let sideOverlay = document.getElementById(`skill-scene-overlay-${side}`);
            if (!sideOverlay) {
                sideOverlay = document.createElement('div');
                sideOverlay.id = `skill-scene-overlay-${side}`;
                if (arena) arena.appendChild(sideOverlay); // ✅ nằm TRONG arena, không phải body
                else document.body.appendChild(sideOverlay);
            }
            sideOverlay.style.cssText = `
                position: absolute;
                inset: 0;
                overflow: hidden;
                z-index: 0;
                pointer-events: none;
                display: block;
                opacity: 1;
            `;

            if (!this._bgInstances[side] && window.PkmSkillBack) {
                this._bgInstances[side] = window.PkmSkillBack.createInstance();
            }

            const attackerEl = document.getElementById(`${side}-unit-${attackerIndex}`);
            const posX = attackerEl?.getAttribute('data-left') || '50';
            const posY = attackerEl?.getAttribute('data-top') || '50';
            if (this._bgInstances[side]) {
                this._bgInstances[side].show(sideOverlay, type, posX, posY);
            }

        } else {
            const sideOverlay = document.getElementById(`skill-scene-overlay-${side}`);
            if (sideOverlay && this._bgInstances[side]) {
                this._bgInstances[side].hide(sideOverlay);
            }

            this._activeSceneCount = Math.max(0, this._activeSceneCount - 1);
            if (this._activeSceneCount > 0) return;

            this._activeAttackers.clear();
        }
    },

    // ─────────────────────────────────────────────
    // BẢNG BẤM CHỌN CHIÊU (thay thế orb xoay quanh cũ)
    // ─────────────────────────────────────────────
    async playSkillSelectPanel(attackerEl, type, chosenMethod, baseMethodName, pool, interactive) {
        const methods = (pool && pool.length > 0) ? pool : [baseMethodName];

        // AI địch: không hiện bảng, tự chọn sau một khoảng "suy nghĩ" ngắn
        if (!interactive) {
            await new Promise(r => setTimeout(r, 300));
            return chosenMethod || methods[Math.floor(Math.random() * methods.length)];
        }

        return new Promise((resolve) => {
            const panel = document.createElement('div');
            panel.style.cssText = `
                position: fixed;
                left: 50%; bottom: 24px;
                transform: translateX(-50%) translateY(20px);
                display: flex; flex-direction: column; gap: 8px;
                z-index: 10010;
                opacity: 0;
                transition: opacity 0.25s ease, transform 0.25s ease;
                background: rgba(10,10,20,0.9);
                border: 2px solid #ffcb05;
                border-radius: 14px;
                padding: 12px 14px;
                min-width: 220px;
                box-shadow: 0 0 24px rgba(255,203,5,0.35);
            `;

            const title = document.createElement('div');
            title.style.cssText = `color:#fff; font-weight:900; font-size:13px; text-align:center; margin-bottom:2px;`;
            title.innerText = '⏱ Chọn chiêu!';
            panel.appendChild(title);

            methods.forEach((methodName) => {
                const btn = document.createElement('button');
                btn.innerText = this.getSkillLabel(type, methodName);
                btn.style.cssText = `
                    padding: 10px 14px; border-radius: 10px; border: 2px solid rgba(255,255,255,0.25);
                    background:#1e1e35; color:#fff; font-weight:700; font-size:13px; cursor:pointer;
                `;
                btn.addEventListener('mousedown', () => btn.style.background = '#2a2a50');
                btn.addEventListener('click', () => finish(methodName));
                panel.appendChild(btn);
            });

            document.body.appendChild(panel);
            requestAnimationFrame(() => {
                panel.style.opacity = '1';
                panel.style.transform = 'translateX(-50%) translateY(0)';
            });

            let done = false;
            const finish = (methodName) => {
                if (done) return;
                done = true;
                clearInterval(timer);
                panel.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
                panel.style.opacity = '0';
                panel.style.transform = 'translateX(-50%) translateY(20px) scale(0.9)';
                setTimeout(() => panel.remove(), 220);
                resolve(methodName);
            };

            const startTime = performance.now();
            const windowMs = this.durationConfig.aoe.skillChoiceWindow;
            const timer = setInterval(() => {
                const remain = Math.max(0, Math.ceil((windowMs - (performance.now() - startTime)) / 1000));
                title.innerText = `⏱ ${remain}s — Chọn chiêu!`;
                if (remain <= 0) {
                    finish(methods[Math.floor(Math.random() * methods.length)]);
                }
            }, 200);
        });
    },

    // ─────────────────────────────────────────────
    // play() — ĐIỀU PHỐI CHIÊU AOE (CHỈ AOE, không còn đánh thường/hụt)
    // Được gọi từ pkm_battle.js: playInfo.isAOE ? SkillManager.play(info) : ...
    // ─────────────────────────────────────────────
    async play(info) {
        return new Promise(async (resolve) => {
            const attackerSide = info.attackerSide;
            const attackerIndex = info.attackerIndex;
            const attacker = document.getElementById(`${attackerSide}-unit-${attackerIndex}`);
            const aliveTargets = info.targets || [];

            if (!attacker) { resolve(); return; }

            // Bật lớp tint nền theo hệ (fade-in do pkm_skill_back.js xử lý)
            if (!info.skipScene) {
                this.toggleSkillScene(true, attackerSide, attackerIndex, info.type);
            }

            aliveTargets.forEach(idx => {
                const targetEl = document.getElementById(`${info.targetSide}-unit-${idx}`);
                if (targetEl) targetEl.style.zIndex = '10000';
            });

            // Số hạt/tia + kích thước theo Gen (giữ nguyên buff Đời 1 đã chỉnh trước đó)
            let countPerTarget = 1, sizeScale = 1;
            switch (info.gen) {
                case 1: countPerTarget = 4; sizeScale = 1.6; break;
                case 2: countPerTarget = 5; sizeScale = 1.8; break;
                case 3: countPerTarget = 6; sizeScale = 2.2; break;
                case 'mega':
                case 4: countPerTarget = 10; sizeScale = 3.0; break;
            }

            const pos = {
                scale: parseFloat(attacker.dataset.scale) || 1,
                flip: parseFloat(attacker.dataset.flip) || 1
            };
            attacker.style.zIndex = '10001';

            const baseMethodName = `spawn${info.type.charAt(0).toUpperCase() + info.type.slice(1)}`;

            // PHASE 1: GỒNG CHIÊU (thu nhỏ tại chỗ)
            const imgWrapper = attacker.querySelector('div');
            if (imgWrapper) {
                imgWrapper.style.transition = `transform 0.3s ease-in`;
                imgWrapper.style.transform = `scale(${pos.scale * 0.85}) scaleX(${pos.flip})`;
            }

            // PHASE 2: CHỌN CHIÊU — bảng bấm (player) / auto (AI)
            const chosenMethod = await this.chooseSkillInteractive(
                attacker, info.type, baseMethodName, attackerSide === 'player'
            );

            // PHASE 3: BUNG CHIÊU (phóng to lại rồi về scale gốc)
            if (imgWrapper) {
                imgWrapper.style.transition = `transform 0.2s cubic-bezier(0.34,1.56,0.64,1)`;
                imgWrapper.style.transform = `scale(${pos.scale * 1.2}) scaleX(${pos.flip})`;
                await new Promise(r => setTimeout(r, 200));
                imgWrapper.style.transform = `scale(${pos.scale}) scaleX(${pos.flip})`;
            }

            if (this.playRandomSfx) this.playRandomSfx();

            // PHASE 4: TUNG CHIÊU tới từng mục tiêu (song song)
            const allAnimations = aliveTargets.map(targetIdx =>
                this.triggerMultiEffect(attacker, targetIdx, info.targetSide, countPerTarget, sizeScale, info.type, info.damage, chosenMethod)
            );
            await Promise.all(allAnimations);

            // PHASE 5: THU QUÂN
            attacker.style.transition = 'transform 0.3s ease-out';
            attacker.style.transform = 'translate(-50%,-50%)';
            await new Promise(r => setTimeout(r, 320));
            attacker.style.transition = '';
            attacker.style.zIndex = '';

            setTimeout(() => {
                if (!info.skipScene) this.toggleSkillScene(false, attackerSide);
                resolve();
            }, this.durationConfig.aoe.sceneTransition);
        });
    },

    // 1 mục tiêu: chạy spawnXxx đã chọn -> va chạm -> rung + text + sustain CSS
    async triggerMultiEffect(attacker, targetIdx, targetSide, count, sizeScale, type, damage, methodName) {
        const target = document.getElementById(`${targetSide}-unit-${targetIdx}`);
        if (!target) return;

        const baseMethodName = `spawn${type.charAt(0).toUpperCase() + type.slice(1)}`;
        let action = typeof this[methodName] === 'function' ? this[methodName] : this[baseMethodName];
        if (typeof action !== 'function') action = this.spawnDefault;

        // GIAI ĐOẠN A: chiêu di chuyển đến địch (charge + travel sfx nằm trong spawnXxx)
        await action.call(this, attacker, target, count, sizeScale);

        // GIAI ĐOẠN B: va chạm — rung, damage text (mặc định dramatic=true cho AOE), sfx tập trung
        this.applyGlobalShake(sizeScale);
        this.playImpactSfx(type);
        this.createDamageText(target, damage, true);

        const sustainClass = `sustain-${type}`;
        target.classList.add('shake', sustainClass);
        await new Promise(r => setTimeout(r, this.durationConfig.aoe.targetSustain));
        target.classList.remove('shake', sustainClass);
    },

    // ══════════════════════════════════════════════
    // HỆ ĐIỆN — spawnElectric (Quả Cầu Điện)
    // Timeline: GỒNG (chargeAura) -> DI CHUYỂN (projectileFly) -> NỔ
    // ══════════════════════════════════════════════
    // ══════════════════════════════════════════════
    // SKILL 1 HỆ ĐIỆN — Thunderbolt (Tia Sét Phóng Điện)
    // Dạng kỹ năng: Phóng các tia chớp zigzag trực tiếp từ ta sang địch
    // Tối ưu hóa: Dùng DocumentFragment, giảm segment, rải đều delay bất đồng bộ
    // ══════════════════════════════════════════════
    async spawnElectric(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();
        const totalSpan = this.durationConfig.aoe.projectileFly; // Đọc từ config chuẩn aoe

        // Giới hạn số lượng tia sét đồng thời xuất hiện hợp lý, tránh nghẽn DOM
        const numBolts = Math.min(8, Math.max(4, count)); 
        const boltDuration = 120; // Thời gian tồn tại chớp nhoáng của mỗi tia sét

        const startX = rectS.left + rectS.width / 2;
        const startY = rectS.top + rectS.height / 2;
        const endX   = rectE.left + rectE.width / 2;
        const endY   = rectE.top + rectE.height / 2;

        // Kích hoạt âm thanh gồng chiêu tích điện hệ Điện đầu trận
        this.playChargeSfx('electric');

        // Hàm xử lý tạo riêng rẽ từng tia một cách bất đồng bộ để chia nhỏ tải cho GPU/CPU
        const spawnSingleBolt = (delay, index) => {
            return new Promise((resolveBolt) => {
                setTimeout(() => {
                    let curX = startX, curY = startY;
                    const segments = 6; // 6 đoạn chuẩn zigzag, mượt và giảm tải DOM
                    const fragment = document.createDocumentFragment();
                    const currentSegmentsEls = [];

                    // Kèm theo một tiếng giật điện nhỏ (zap) tương ứng với thời gian xuất hiện của từng tia
                    if (window.SoundEngine) {
                        window.SoundEngine.playDelayed('zap', 0, 900 - (index * 30), 100, 0.15, 0.15);
                    }

                    for (let j = 1; j <= segments; j++) {
                        const t = j / segments;
                        const noise = (Math.random() - 0.5) * 45 * scale;

                        // Điểm kết thúc bắt buộc phải trúng đích, các đoạn giữa lệch ngẫu nhiên
                        const nextX = j === segments ? endX : (startX + (endX - startX) * t + noise);
                        const nextY = j === segments ? endY : (startY + (endY - startY) * t + (Math.random() - 0.5) * 25 * scale);

                        const dx = nextX - curX;
                        const dy = nextY - curY;
                        const dist = Math.sqrt(dx * dx + dy * dy);

                        const bolt = document.createElement('div');
                        bolt.className = 'pkm-particle particle-electric';

                        // Chiều cao lõi tia sét lớn từ 6px-9px nhân theo tỉ lệ để tia điện dày rõ rệt
                        const boltHeight = (6 + Math.random() * 3) * scale;

                        bolt.style.cssText = `
                            position: fixed; left: ${curX}px; top: ${curY}px;
                            width: ${dist}px; height: ${boltHeight}px;
                            background: rgba(255, 255, 255, 0.95);
                            transform: rotate(${Math.atan2(dy, dx) * 180 / Math.PI}deg);
                            transform-origin: 0 50%;
                            /* Tăng bán kính vầng sáng màu vàng bao quanh bung to rực rỡ */
                            box-shadow: 0 0 ${10 * scale}px #fff, 0 0 ${25 * scale}px #f1c40f, 0 0 ${40 * scale}px #ff9f43;
                            z-index: 9999;
                            pointer-events: none;
                            will-change: transform, opacity;
                        `;

                        fragment.appendChild(bolt);
                        currentSegmentsEls.push(bolt);

                        curX = nextX;
                        curY = nextY;
                    }

                    // Đẩy nguyên 1 cụm tia vào DOM cùng một lúc thông qua fragment để tối ưu performance
                    document.body.appendChild(fragment);

                    // Xóa nhanh phần tử ngay khi diễn hoạt xong để giải phóng bộ nhớ
                    setTimeout(() => {
                        currentSegmentsEls.forEach(el => el.remove());
                        resolveBolt();
                    }, boltDuration);

                }, delay);
            });
        };

        const boltPromises = [];
        for (let i = 0; i < numBolts; i++) {
            // Rải đều thời gian bắn ngẫu nhiên các tia trong khoảng thời gian xả chiêu
            const delay = (i / numBolts) * (totalSpan * 0.5);
            boltPromises.push(spawnSingleBolt(delay, i));
        }

        await Promise.all(boltPromises);
    },
    // ══════════════════════════════════════════════
    // SKILL 3 HỆ ĐIỆN — spawnElectric3 (Bão Điện Thiên Lôi)
    // Dạng kỹ năng: Triệu hồi bão mây tĩnh điện và giáng sấm sét liên tục
    // ══════════════════════════════════════════════
    async spawnElectric3(startEl, endEl, count, scale) {
        const cfg = this.durationConfig.aoe;
        const rectE = endEl.getBoundingClientRect();
        const centerX = rectE.left + rectE.width / 2;
        const centerY = rectE.top + rectE.height / 2;
        const cloudY  = rectE.top - 50 * scale;

        const chargeMs  = cfg.chargeAura;
        const sustainMs = cfg.targetSustain;
        const totalMs   = chargeMs + sustainMs;

        const allEls = [];

        // Kích hoạt âm thanh gồng chiêu tích điện
        this.playChargeSfx('electric');

        // 1. Mây tích điện (được tối ưu hóa kích thước theo scale)
        const cloudW = 110 * scale;
        const cloudH = 55  * scale;
        const cloud = document.createElement('div');
        cloud.style.cssText = `
            position: fixed; left: ${centerX - cloudW / 2}px; top: ${cloudY - cloudH / 2}px;
            width: ${cloudW}px; height: ${cloudH}px;
            background: radial-gradient(ellipse at center, #34495e 20%, #1c2833 70%, transparent 100%);
            border-radius: 50%; z-index: 9998;
            filter: blur(${6 * scale}px); pointer-events: none;
            opacity: 0; transform: scale(0.5);
            will-change: transform, opacity;
        `;
        document.body.appendChild(cloud);
        allEls.push(cloud);

        cloud.animate([
            { opacity: 0, transform: 'scale(0.5)' },
            { opacity: 0.9, transform: 'scale(1)' }
        ], { duration: chargeMs, fill: 'forwards', easing: 'ease-out' });

        // 2. Tia tĩnh điện lấm tấm quanh đám mây
        const sparkCount = Math.max(12, count * 5);
        for (let i = 0; i < sparkCount; i++) {
            const spark = document.createElement('div');
            const sx = centerX + (Math.random() - 0.5) * cloudW;
            const sy = cloudY  + (Math.random() - 0.5) * cloudH;
            const delay = chargeMs * 0.2 + Math.random() * (totalMs - chargeMs * 0.2);
            spark.style.cssText = `
                position: fixed; left: ${sx}px; top: ${sy}px;
                width: ${2 * scale}px; height: ${2 * scale}px; background: #fff;
                box-shadow: 0 0 ${5 * scale}px #f1c40f; z-index: 9999; pointer-events: none;
                opacity: 0; will-change: opacity;
            `;
            document.body.appendChild(spark);
            allEls.push(spark);
            spark.animate([
                { opacity: 0 }, { opacity: 1, offset: 0.5 }, { opacity: 0 }
            ], { duration: 220, delay, fill: 'forwards' });
        }

        // Kích hoạt âm thanh tiếng gió rít/travel sfx chuẩn bị giáng sét
        window.SoundEngine.playDelayed('whoosh', chargeMs * 0.8, 0.3, 0.15, 1400);

        // 3. Giáng loạt tia sét zigzag dồn dập xuống đối thủ
        const boltCount = Math.max(8, count * 4); 
        const strikeStart = chargeMs;
        const strikeSpan  = sustainMs;

        for (let i = 0; i < boltCount; i++) {
            const delay = strikeStart + (i / boltCount) * strikeSpan + Math.random() * 100;
            const x1 = centerX + (Math.random() - 0.5) * cloudW * 0.7;
            const y1 = cloudY;
            const x2 = centerX + (Math.random() - 0.5) * cloudW * 0.4;
            const y2 = centerY;

            this.createZigzagBoltDelayed(x1, y1, x2, y2, scale, delay, allEls);

            // Cứ mỗi tia sét giáng xuống, kèm theo một tiếng zap/ nổ sấm nhỏ tương ứng với delay
            window.SoundEngine.playDelayed('zap', delay, 800 - (i * 20), 200, 0.12, 0.12);
        }

        // Chờ toàn bộ quá trình thực hiện xong và quét dọn các thẻ DOM dư thừa
        await new Promise((r) => setTimeout(r, totalMs));
        allEls.forEach((el) => el.remove());
    },

    // Tạo 1 tia sét zigzag hiển thị ngay lập tức (Đồng bộ)
    createZigzagBolt(x1, y1, x2, y2, scale) {
        const segments = 10;
        let curX = x1, curY = y1;

        for (let i = 1; i <= segments; i++) {
            const targetX = x1 + (x2 - x1) * (i / segments);
            const targetY = y1 + (y2 - y1) * (i / segments);

            const noise = (Math.random() - 0.5) * 70 * scale;
            const nextX = i < segments ? targetX + noise : x2;
            const nextY = targetY;

            const dist = Math.sqrt((nextX - curX)**2 + (nextY - curY)**2);

            const bolt = document.createElement('div');
            bolt.style.cssText = `
                position: fixed; left: ${curX}px; top: ${curY}px;
                width: ${dist}px; height: ${1.5 * scale}px; 
                background: #fff;
                transform: rotate(${Math.atan2(nextY - curY, nextX - curX) * 180 / Math.PI}deg);
                transform-origin: 0 50%;
                box-shadow: 0 0 8px #fff, 0 0 15px #f1c40f;
                z-index: 9999; pointer-events: none;
            `;
            document.body.appendChild(bolt);
            setTimeout(() => bolt.remove(), 120);

            curX = nextX; curY = nextY;
        }
    },

    // Tạo tia sét tĩnh và điều khiển hiển thị bằng animation delay (Tối ưu Mobile)
    createZigzagBoltDelayed(x1, y1, x2, y2, scale, delay, collector) {
        const segments = 10;
        let curX = x1, curY = y1;

        for (let i = 1; i <= segments; i++) {
            const targetX = x1 + (x2 - x1) * (i / segments);
            const targetY = y1 + (y2 - y1) * (i / segments);

            const noise = (Math.random() - 0.5) * 60 * scale;
            const nextX = i < segments ? targetX + noise : x2;
            const nextY = targetY;

            const dist = Math.sqrt((nextX - curX) ** 2 + (nextY - curY) ** 2);

            const bolt = document.createElement('div');
            bolt.style.cssText = `
                position: fixed; left: ${curX}px; top: ${curY}px;
                width: ${dist}px; height: ${1.5 * scale}px;
                background: #fff;
                transform: rotate(${Math.atan2(nextY - curY, nextX - curX) * 180 / Math.PI}deg);
                transform-origin: 0 50%;
                box-shadow: 0 0 ${8 * scale}px #fff, 0 0 ${15 * scale}px #f1c40f;
                z-index: 9999; pointer-events: none;
                opacity: 0; will-change: opacity;
            `;
            document.body.appendChild(bolt);
            if (collector) collector.push(bolt);

            bolt.animate([
                { opacity: 0 },
                { opacity: 1, offset: 0.2 },
                { opacity: 1, offset: 0.6 },
                { opacity: 0 }
            ], { duration: 150, delay, fill: 'forwards' });

            curX = nextX; curY = nextY;
        }
    },
    

    // ══════════════════════════════════════════════
    // FALLBACK CHUNG — dùng cho MỌI hệ CHƯA có chiêu riêng.
    // Khi viết chiêu thật cho 1 hệ, chỉ cần thêm spawn<Hệ> +
    // skillMeta[<hệ>] tương ứng, không cần sửa gì ở play()/
    // triggerMultiEffect (tự động dùng spawn<Hệ> nếu tồn tại).
    // ══════════════════════════════════════════════
    async spawnDefault(startEl, endEl, count, scale) {
        const cfg = this.durationConfig.aoe;

        this.playChargeSfx('normal');
        await new Promise(r => setTimeout(r, cfg.chargeAura * 0.4));

        this.playTravelSfx('normal');
        for (let i = 0; i < count; i++) {
            this.createProjectile(startEl, endEl, '#ddd', i, scale);
            await new Promise(r => setTimeout(r, cfg.delayBetween));
        }
        await new Promise(r => setTimeout(r, cfg.projectileFly * 0.3));
    },

    createProjectile(startEl, endEl, color, offset, sizeScale) {
        const cfg = this.durationConfig.aoe;
        const rectS = startEl.getBoundingClientRect(), rectE = endEl.getBoundingClientRect();
        const p = document.createElement('div');
        p.style.cssText = `
            position:fixed; left:${rectS.left + rectS.width / 2}px; top:${rectS.top + rectS.height / 2}px;
            width:${8 * sizeScale}px; height:${25 * sizeScale}px; background:${color};
            box-shadow:0 0 10px ${color}; border-radius:50%; z-index:9999;
            transform:rotate(${this.calcAngle(rectS, rectE)}deg);
            transition:all ${cfg.projectileFly}ms ease-in;
        `;
        document.body.appendChild(p);
        requestAnimationFrame(() => {
            p.style.left = (rectE.left + rectE.width / 2) + 'px';
            p.style.top = (rectE.top + rectE.height / 2) + 'px';
        });
        setTimeout(() => p.remove(), cfg.projectileFly);
    },

    // ── TEXT / HELPER DÙNG CHUNG ──
    showStatusText(targetEl, text, color, dramatic = false) {
        const rect = targetEl.getBoundingClientRect();
        const div = document.createElement('div');
        div.innerText = text;
        const fontSize = dramatic ? 30 : 20;
        div.style.cssText = `
            position:fixed; left:${rect.left + rect.width / 2}px; top:${rect.top}px;
            color:${color}; font-weight:900; font-size:${fontSize}px;
            text-shadow:2px 2px 0px #000; z-index:10000; pointer-events:none;
            animation:damageFloat ${this.durationConfig.aoe.statusText}ms ease-out forwards;
            transform:translateX(-50%) scale(${dramatic ? 1.15 : 1});
        `;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), this.durationConfig.aoe.statusText);
    },

    createDamageText(targetEl, damage, dramatic = true) {
        this.showStatusText(targetEl, `-${damage}`, '#ff4757', dramatic);
    },

    calcAngle(s, e) {
        return Math.atan2(e.top - s.top, e.left - s.left) * 180 / Math.PI + 90;
    },
};
