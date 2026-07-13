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
        fire: {
            spawnFire2: 'Blazing Dai',
            spawnFire3: 'Blast Burn', // Skill 3 hiện tại của bạn
            spawnFire4: 'Supernova',  // ★ Skill toàn màn hình
        },
        electric: {
            spawnElectric: 'Thunderbolt',
            spawnElectric3: 'Thunderstorm',
            spawnElectric4: 'Static Burst', // ★ Skill toàn màn hình
        },
        water:    { spawnWater4:    'Tsunami Surge'     }, // ★
        grass:    { spawnGrass4:    'Bloom Cascade'      }, // ★
        ice:      { spawnIce4:      'Absolute Zero'      }, // ★
        poison:   { spawnPoison4:   'Miasma Surge'       }, // ★
        ground:   { spawnGround4:   'Tectonic Rift'      }, // ★
        flying:   { spawnFlying4:   'Tempest Wing'       }, // ★
        psychic:  { spawnPsychic4:  'Mind Swarm'         }, // ★
        fighting: { spawnFighting4: "Titan's Fury"       }, // ★
        ghost:    { spawnGhost4:    'Spectral Wail'      }, // ★
        bug:      { spawnBug4:      'Swarm Eclipse'      }, // ★
        rock:     { spawnRock4:     'Meteor Fall'        }, // ★
        dark:     { spawnDark4:     'Void Collapse'      }, // ★
        steel:    { spawnSteel4:    'Iron Cataclysm'     }, // ★
        dragon:   { spawnDragon4:   'Draconic Ascension' }, // ★
        fairy:    { spawnFairy4:    'Starlight Requiem'  }, // ★
        normal:   { spawnNormal4:   'Cosmic Judgment'    }, // ★
    },

    getSkillLabel(type, methodName) {
        return (this.skillMeta[type] && this.skillMeta[type][methodName]) || methodName;
    },

    // ─────────────────────────────────────────────
    // QUẢN LÝ POOL CHIÊU (giữ nguyên logic gốc)
    // ─────────────────────────────────────────────
    peekSkillPool(baseMethodName) {
        if (!this.skillPools[baseMethodName] || this.skillPools[baseMethodName].length === 0) {
            // Dò ĐỘNG, không giới hạn cứng ở suffix 3 — quét tới khi hết biến thể
            // (baseMethodName, baseMethodName2, baseMethodName3, baseMethodName4, ...)
            const candidates = [baseMethodName];
            for (let n = 2; n <= 8; n++) candidates.push(`${baseMethodName}${n}`);
            const filtered = candidates.filter(name => typeof this[name] === 'function');

            for (let i = filtered.length - 1; i > 0; i--) {
                const j = Math.floor(Math.random() * (i + 1));
                [filtered[i], filtered[j]] = [filtered[j], filtered[i]];
            }
            this.skillPools[baseMethodName] = filtered;
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
    // ── ICON THEO HỆ (hiện trên nút tròn) ──
    getTypeIcon(type) {
        const icons = {
            fire: '🔥', water: '💧', electric: '⚡', grass: '🌿',
            ice: '❄️', poison: '☠️', ground: '⛰️', flying: '🌪️',
            psychic: '🔮', fighting: '👊', ghost: '👻', bug: '🐛',
            rock: '🪨', dark: '🌑', steel: '⚙️', dragon: '🐉',
            fairy: '✨', normal: '⭐',
        };
        return icons[type] || '✦';
    },

    // ── CSS cho bảng chọn chiêu kiểu Pokémon Masters (chỉ inject 1 lần) ──
    injectSkillPanelStyles() {
        if (document.getElementById('pkm-skillpanel-style')) return;
        const style = document.createElement('style');
        style.id = 'pkm-skillpanel-style';
        style.textContent = `
            .pkm-skillpanel-wrap {
                position: fixed;
                left: 50%; bottom: 20px;
                transform: translateX(-50%) translateY(30px) scale(0.85);
                opacity: 0;
                z-index: 10010;
                transition: opacity 0.25s ease, transform 0.25s cubic-bezier(0.34,1.56,0.64,1);
                pointer-events: none;
            }
            .pkm-skillpanel-wrap.show {
                opacity: 1;
                transform: translateX(-50%) translateY(0) scale(1);
                pointer-events: auto;
            }
            .pkm-skillpanel-wrap.hide {
                opacity: 0;
                transform: translateX(-50%) translateY(20px) scale(0.9);
            }
            .pkm-skillpanel-card {
                position: relative;
                background: radial-gradient(ellipse at 50% 0%, rgba(45,30,35,0.96) 0%, rgba(15,10,12,0.97) 75%);
                border: 3px solid var(--accent, #ffcb05);
                border-radius: 26px;
                padding: 22px 18px 16px;
                box-shadow: 0 0 30px var(--accent, #ffcb05), inset 0 0 20px rgba(255,255,255,0.05);
                min-width: 220px;
            }
            .pkm-skillpanel-grid {
                display: grid;
                grid-template-columns: repeat(2, 1fr);
                gap: 16px 26px;
                position: relative;
            }
            .pkm-skillpanel-btn {
                position: relative;
                width: 76px; height: 76px;
                border-radius: 50%;
                border: 3px solid rgba(255,255,255,0.3);
                background: radial-gradient(circle at 35% 30%, var(--accent, #ffcb05) 0%, rgba(0,0,0,0.55) 100%);
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                cursor: pointer;
                box-shadow: 0 4px 10px rgba(0,0,0,0.5), inset 0 2px 4px rgba(255,255,255,0.25);
                transition: transform 0.15s ease, border-color 0.15s ease;
                margin: 0 auto;
            }
            .pkm-skillpanel-btn:active {
                transform: scale(0.92);
                border-color: #fff;
            }
            .pkm-skillpanel-icon {
                font-size: 20px;
                text-shadow: 0 0 6px rgba(255,255,255,0.8);
                margin-bottom: 2px;
            }
            .pkm-skillpanel-label {
                font-size: 10px;
                font-weight: 800;
                color: #fff;
                text-align: center;
                line-height: 1.15;
                padding: 0 4px;
                text-shadow: 1px 1px 2px rgba(0,0,0,0.85);
            }
            .pkm-skillpanel-hex {
                position: absolute;
                left: 50%; top: 50%;
                transform: translate(-50%, -50%);
                width: 56px; height: 56px;
                z-index: 2;
            }
            .pkm-skillpanel-hex-ring {
                position: absolute; inset: 0;
                clip-path: polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0% 50%);
                background: linear-gradient(160deg, #fff 0%, var(--accent, #ffcb05) 55%, rgba(0,0,0,0.4) 100%);
                box-shadow: 0 0 16px var(--accent, #ffcb05);
                animation: pkm-skillpanel-pulse 1s ease-in-out infinite;
            }
            .pkm-skillpanel-hex-num {
                position: absolute; inset: 0;
                display: flex; align-items: center; justify-content: center;
                color: #fff; font-weight: 900; font-size: 20px;
                text-shadow: 1px 1px 2px #000;
            }
            @keyframes pkm-skillpanel-pulse {
                0%, 100% { transform: scale(1); }
                50% { transform: scale(1.08); }
            }
        `;
        document.head.appendChild(style);
    },
    async playSkillSelectPanel(attackerEl, type, chosenMethod, baseMethodName, pool, interactive) {
        const methods = (pool && pool.length > 0) ? pool : [baseMethodName];

        // AI địch: không hiện bảng, tự chọn sau một khoảng "suy nghĩ" ngắn
        if (!interactive) {
            await new Promise(r => setTimeout(r, 300));
            return chosenMethod || methods[Math.floor(Math.random() * methods.length)];
        }

        this.injectSkillPanelStyles();
        const color = (this.systemConfig[type] || {}).color || '#ffcb05';

        return new Promise((resolve) => {
            const wrap = document.createElement('div');
            wrap.className = 'pkm-skillpanel-wrap';
            wrap.style.setProperty('--accent', color);

            const card = document.createElement('div');
            card.className = 'pkm-skillpanel-card';
            wrap.appendChild(card);

            const grid = document.createElement('div');
            grid.className = 'pkm-skillpanel-grid';
            card.appendChild(grid);

            // Hình lục giác đếm ngược ở giữa
            const hex = document.createElement('div');
            hex.className = 'pkm-skillpanel-hex';
            hex.innerHTML = `<div class="pkm-skillpanel-hex-ring"></div><div class="pkm-skillpanel-hex-num"></div>`;
            card.appendChild(hex);
            const hexNum = hex.querySelector('.pkm-skillpanel-hex-num');

            // Các nút tròn xếp lưới 2 cột quanh hex trung tâm
            methods.forEach((methodName) => {
                const btn = document.createElement('button');
                btn.className = 'pkm-skillpanel-btn';
                btn.innerHTML = `
                    <div class="pkm-skillpanel-icon">${this.getTypeIcon(type)}</div>
                    <div class="pkm-skillpanel-label">${this.getSkillLabel(type, methodName)}</div>
                `;
                btn.addEventListener('click', () => finish(methodName));
                grid.appendChild(btn);
            });

            document.body.appendChild(wrap);
            requestAnimationFrame(() => wrap.classList.add('show'));

            let done = false;
            const finish = (methodName) => {
                if (done) return;
                done = true;
                clearInterval(timer);
                wrap.classList.remove('show');
                wrap.classList.add('hide');
                setTimeout(() => wrap.remove(), 220);
                resolve(methodName);
            };

            const startTime = performance.now();
            const windowMs = this.durationConfig.aoe.skillChoiceWindow;
            hexNum.innerText = Math.ceil(windowMs / 1000);
            const timer = setInterval(() => {
                const remain = Math.max(0, Math.ceil((windowMs - (performance.now() - startTime)) / 1000));
                hexNum.innerText = remain;
                if (remain <= 0) finish(methods[Math.floor(Math.random() * methods.length)]);
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
    // ĐÃ SỬA THEO YÊU CẦU: COI MỌI CHIÊU LÀ "TOÀN MÀN HÌNH" — action() chỉ thực
    // sự được gọi ĐÚNG 1 LẦN cho cả đòn đánh, dù trúng bao nhiêu mục tiêu. Các
    // mục tiêu còn lại chỉ CHỜ CHUNG 1 promise, KHÔNG vẽ lại hiệu ứng nền —
    // tránh chồng CSS/DOM theo số lượng mục tiêu gây đơ máy.
    // ══════════════════════════════════════════════
    // BỌC CHUNG — biến MỌI chiêu "chỉ nhắm 1 mục tiêu" thành "toàn màn hình"
    // MÀ KHÔNG SỬA GÌ bên trong từng hàm spawnXxx gốc. Cách làm: gọi lại ĐÚNG
    // hàm gốc đó nhiều lần song song, mỗi lần cho nó 1 "điểm ảo" (div ẩn, rỗng,
    // rải ngẫu nhiên khắp arena) làm endEl — hàm gốc tưởng đang bay tới Pokémon
    // thật nhưng thực ra đang bay tới toạ độ ảo đó, tạo cảm giác phủ khắp màn hình.
    // ══════════════════════════════════════════════
    async runAsScreenBarrage(action, attacker, realTarget, count, scale, targetSide) {
        const arena = document.getElementById('battle-arena');
        const arenaRect = arena ? arena.getBoundingClientRect()
                                 : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

        // Ô giữa của bên bị đánh: dich_2 (nếu đánh địch) hoặc ta_2 (nếu đánh mình)
        // — đây chính là "tâm quân địch" theo bố cục vòng cung trong pkm_styles.js
        const prefix = targetSide === 'player' ? 'ta' : 'dich';
        const midPos = window.PkmStyles?.positions?.[`${prefix}_2`]
            || { left: 50, top: targetSide === 'player' ? 80 : 18 };

        const px = arenaRect.left + arenaRect.width * (midPos.left / 100);
        const py = arenaRect.top + arenaRect.height * (midPos.top / 100);

        // CHỈ 1 điểm ảo duy nhất, dù bên địch còn 1 hay 3 quân
        const singlePoint = document.createElement('div');
        singlePoint.style.cssText = `position:fixed; left:${px}px; top:${py}px; width:1px; height:1px; pointer-events:none; opacity:0;`;
        document.body.appendChild(singlePoint);

        await action.call(this, attacker, singlePoint, count, scale); // gọi action() ĐÚNG 1 LẦN

        singlePoint.remove();
    },
    async triggerMultiEffect(attacker, targetIdx, targetSide, count, sizeScale, type, damage, methodName) {
        const target = document.getElementById(`${targetSide}-unit-${targetIdx}`);
        if (!target) return;

        const baseMethodName = `spawn${type.charAt(0).toUpperCase() + type.slice(1)}`;
        let action = typeof this[methodName] === 'function' ? this[methodName] : this[baseMethodName];
        if (typeof action !== 'function') action = this.spawnDefault;

        // Cache promise theo attacker + tên chiêu: mục tiêu ĐẦU TIÊN xử lý sẽ thực
        // sự gọi action() (vẽ hiệu ứng đúng 1 lần), mọi mục tiêu còn lại chỉ CHỜ
        // CHUNG đúng promise đó, không tạo lại DOM/particle.
        if (!attacker._screenSkillCache) attacker._screenSkillCache = {};
        const cache = attacker._screenSkillCache;

        if (!cache[methodName]) {
            // Chỗ đang gọi (trong triggerMultiEffect):
            cache[methodName] = this.runAsScreenBarrage(action, attacker, target, count, sizeScale, targetSide);
            cache[methodName].finally(() => { delete cache[methodName]; });
        }
        await cache[methodName];

        // GIAI ĐOẠN B: va chạm — rung, damage text (mặc định dramatic=true cho AOE), sfx tập trung
        // Phần này LUÔN chạy riêng cho từng mục tiêu (nhẹ, không gây đơ) — mỗi Pokémon
        // trúng đòn vẫn có số damage/rung/viền riêng dù hiệu ứng nền dùng chung.
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
    // HỆ ĐIỆN
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
    // HẸ LỬA
    // SKILL 3 HỆ LỬA — spawnFire3 (Fire Rune - Trận Pháp Lửa Thư Pháp)
    // Dạng kỹ năng: Triệu hồi vòng tròn trận pháp thư pháp rực lửa phong ấn dưới chân/quanh đối thủ
    // Logic bám sát chuẩn xác tư duy vẽ nét coordinates sinh hạt theo timeline giống spawnFire2
    // ══════════════════════════════════════════════
    async spawnFire3(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // Trận pháp hình thành NGAY TẠI VỊ TRÍ ĐỐI THỦ (endEl)
        const targetCx = rectE.left + rectE.width / 2;
        const targetCy = rectE.top + rectE.height / 2;

        // Kích thước trận pháp bao quanh đối thủ
        const runeSize = rectE.width * 1.8 * scale;
        const half = runeSize / 2;

        if (this.playChargeSfx) this.playChargeSfx('fire');

        // Toạ độ chuẩn hoá (0..1) vẽ Vòng tròn ma pháp Ngôi sao/Trận pháp cổ đại rực lửa bao quanh địch
        // Thứ tự vẽ: Vẽ vòng tròn ngoài bằng 4 cung, sau đó vẽ lõi chữ Thập/Rune phong ấn bên trong
        const strokes = [
            { from: [0.15, 0.15], to: [0.85, 0.15] }, // Nét biên trên
            { from: [0.85, 0.15], to: [0.85, 0.85] }, // Nét biên phải
            { from: [0.85, 0.85], to: [0.15, 0.85] }, // Nét biên dưới
            { from: [0.15, 0.85], to: [0.15, 0.15] }, // Nét biên trái
            { from: [0.25, 0.25], to: [0.75, 0.75] }, // Nét chéo phong ấn 1
            { from: [0.75, 0.25], to: [0.25, 0.75] }  // Nét chéo phong ấn 2
        ];

        // Chuyển đổi toạ độ normalize thành Pixels dựa theo tâm đối thủ
        const toPx = ([nx, ny]) => [targetCx - half + nx * runeSize, targetCy - half + ny * runeSize];

        const pointsPerStroke = Math.max(8, 6 + count);

        // ── TIMELINE ĐỒNG BỘ TỪ CONFIG DURATION ──
        const chargeMs  = this.durationConfig.aoe.chargeAura;    // Thời gian vẽ trận pháp + tích tụ sáng dưới chân địch
        const sustainMs = this.durationConfig.aoe.targetSustain; // Thời gian kích nổ trận pháp dồn dập

        const drawDuration   = chargeMs * 0.7;   // 70% thời gian gồng để vẽ các nét trận pháp xuất hiện lần lượt
        const holdDuration   = chargeMs * 0.3;   // 30% còn lại giữ trận pháp rực sáng đỉnh điểm
        const explodeStart   = drawDuration + holdDuration; // Thời điểm bắt đầu kích nổ
        const totalMs        = chargeMs + sustainMs;

        const allEls = [];

        // Duyệt qua từng nét để rải hạt lửa hình thành ma trận
        strokes.forEach((stroke, strokeIdx) => {
            const [x1, y1] = toPx(stroke.from);
            const [x2, y2] = toPx(stroke.to);

            // Nét sau vẽ sau nét trước một chút tạo hiệu ứng nét bút thư pháp chảy đều
            const strokeStartDelay  = (strokeIdx / strokes.length) * drawDuration * 0.8;
            const strokeOwnDuration = drawDuration * 0.4;

            for (let i = 0; i <= pointsPerStroke; i++) {
                const t = i / pointsPerStroke;
                const px = x1 + (x2 - x1) * t;
                const py = y1 + (y2 - y1) * t;
                const litAt = strokeStartDelay + t * strokeOwnDuration;

                // Độ lệch hạt ngẫu nhiên nhẹ quanh nét vẽ
                const jitterX = (Math.random() - 0.5) * 10 * scale;
                const jitterY = (Math.random() - 0.5) * 10 * scale;

                const size = (8 + Math.random() * 8) * scale;
                const flame = document.createElement('div');
                flame.className = 'pkm-particle particle-fire';
                flame.style.cssText = `
                    position: fixed;
                    left: ${px + jitterX}px; top: ${py + jitterY}px;
                    width: ${size}px; height: ${size}px;
                    background: radial-gradient(circle, #fff 20%, #ff9f43 50%, #ee5253 90%, transparent 100%);
                    box-shadow: 0 0 ${10 * scale}px #ff9f43, 0 0 ${20 * scale}px #ee5253;
                    border-radius: 50%;
                    transform: translate(-50%, -50%) scale(0);
                    z-index: 9998; pointer-events: none;
                    opacity: 0;
                `;
                document.body.appendChild(flame);
                allEls.push(flame);

                // Giai đoạn 1: Vẽ nổi hình trận pháp phong ấn (pop-in mọc dần)
                flame.animate([
                    { transform: 'translate(-50%,-50%) scale(0)',   opacity: 0 },
                    { transform: 'translate(-50%,-50%) scale(1.4)', opacity: 1, offset: 0.2 },
                    { transform: 'translate(-50%,-50%) scale(1)',   opacity: 0.95 }
                ], {
                    duration: Math.max(1, drawDuration + holdDuration - litAt),
                    delay: litAt,
                    fill: 'forwards',
                    easing: 'ease-out'
                });

                // Giai đoạn 2: Trận pháp co cụm sụp đổ hút mạnh vào tâm đối thủ gây nổ dữ dội
                flame.animate([
                    { left: `${px + jitterX}px`, top: `${py + jitterY}px`, transform: 'translate(-50%,-50%) scale(1)' },
                    { left: `${targetCx}px`, top: `${targetCy}px`, transform: 'translate(-50%,-50%) scale(1.5)', opacity: 1, offset: 0.7 },
                    { left: `${targetCx}px`, top: `${targetCy}px`, transform: 'translate(-50%,-50%) scale(0)', opacity: 0 }
                ], {
                    duration: sustainMs * 0.4,
                    delay: explodeStart,
                    fill: 'forwards',
                    easing: 'ease-in'
                });

                // Tàn lửa bốc lên lác đác tại vị trí trận pháp đang tụ năng lượng
                if (i % 4 === 0) {
                    const ember = document.createElement('div');
                    const emberSize = (3 + Math.random() * 4) * scale;
                    ember.style.cssText = `
                        position: fixed; left: ${px}px; top: ${py}px;
                        width: ${emberSize}px; height: ${emberSize}px;
                        background: #ffffbf; border-radius: 50%;
                        box-shadow: 0 0 6px #ff6b6b;
                        z-index: 9997; pointer-events: none; opacity: 0;
                    `;
                    document.body.appendChild(ember);
                    allEls.push(ember);

                    const riseDist = (25 + Math.random() * 30) * scale;
                    ember.animate([
                        { transform: 'translate(-50%,-50%) translateY(0px)',            opacity: 0.8 },
                        { transform: `translate(-50%,-50%) translateY(-${riseDist}px)`, opacity: 0 }
                    ], {
                        duration: 600,
                        delay: litAt + 100,
                        fill: 'forwards',
                        easing: 'ease-out'
                    });
                }
            }
        });

        // Lớp quầng nhiệt bổ trợ nằm dưới chân đối thủ, co giãn theo nhịp gồng ma pháp
        const glowSize = runeSize * 1.2;
        const glow = document.createElement('div');
        glow.style.cssText = `
            position: fixed; left: ${targetCx}px; top: ${targetCy}px;
            width: ${glowSize}px; height: ${glowSize}px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(238,82,83,0.3) 0%, rgba(255,159,67,0.1) 50%, transparent 70%);
            transform: translate(-50%, -50%) scale(0.5);
            z-index: 9996; pointer-events: none; opacity: 0;
            filter: blur(${8 * scale}px);
        `;
        document.body.appendChild(glow);
        allEls.push(glow);

        // Quầng nhiệt bành trướng khi vẽ trận pháp
        glow.animate([
            { opacity: 0,   transform: 'translate(-50%,-50%) scale(0.5)' },
            { opacity: 0.85, transform: 'translate(-50%,-50%) scale(1)' }
        ], {
            duration: drawDuration,
            fill: 'forwards',
            easing: 'ease-out'
        });

        // Quầng nhiệt co rút bùng nổ dữ dội ở sustainMs
        glow.animate([
            { opacity: 0.85, transform: 'translate(-50%,-50%) scale(1)' },
            { opacity: 1,    transform: 'translate(-50%,-50%) scale(0.2)', offset: 0.6 },
            { opacity: 0,    transform: 'translate(-50%,-50%) scale(2)' }
        ], {
            duration: sustainMs * 0.5,
            delay: explodeStart,
            fill: 'forwards',
            easing: 'ease-in-out'
        });

        // Kích hoạt chuỗi hiệu ứng bùng nổ (createFireExplosion) ngay khi các nét tụ lại ở tâm điểm địch
        setTimeout(() => {
            if (this.createFireExplosion) {
                this.createFireExplosion(targetCx, targetCy, scale);
                // Bồi thêm 1 vụ nổ phụ cách đó ít mili-giây để tăng uy lực cho skill 3 AoE
                setTimeout(() => this.createFireExplosion(targetCx + 15 * scale, targetCy - 10 * scale, scale * 0.8), 80);
            }
            if (window.SoundEngine) {
                window.SoundEngine.playDelayed('explosion', 0, 1000, 0, 0.22);
            }
        }, explodeStart + sustainMs * 0.28);

        // Đợi toàn bộ chu kỳ vẽ pháp trận và kích nổ kết thúc để dọn dẹp phần tử
        await new Promise((resolve) => {
            setTimeout(() => {
                allEls.forEach((el) => el.remove());
                resolve();
            }, totalMs + 50);
        });
    },
    // ══════════════════════════════════════════════
    // SKILL 4 HỆ LỬA — spawnFire4 (Supernova - Siêu Tân Tinh Hủy Diệt)
    // Kỹ năng tối thượng bao phủ TOÀN BỘ SÀN ĐẤU (#battle-arena) thay vì theo Pokemon
    // Tối ưu hóa cực hạn cho Mobile: Dùng Core Divs lớn, GPU Layer, không tạo hạt lặp
    // ══════════════════════════════════════════════
    async spawnFire5(startEl, endEl, count, scale, data) {
        // Lấy tọa độ và kích thước của toàn bộ đấu trường arena
        const arenaEl = document.getElementById('battle-arena');
        const arenaRect = arenaEl 
            ? arenaEl.getBoundingClientRect() 
            : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };

        const arenaCx = arenaRect.left + arenaRect.width / 2;
        const arenaCy = arenaRect.top + arenaRect.height / 2;

        if (this.playRandomSfx) this.playRandomSfx();

        // ── TIMELINE TUÂN THỦ DURATIONCONFIG ──
        const chargeMs  = this.durationConfig.chargeAura;    // Giai đoạn tích nhiệt toàn sàn
        const sustainMs = this.durationConfig.targetSustain; // Giai đoạn bão lửa + nổ tung

        const vortexDuration    = sustainMs * 0.5; // Lốc lửa quét toàn sàn
        const supernovaDuration = sustainMs * 0.5; // Kích nổ siêu tân tinh giải phóng

        const vortexStart    = chargeMs;
        const supernovaStart = vortexStart + vortexDuration;
        const totalMs        = chargeMs + sustainMs;

        const allEls = [];

        // 1. THẢM DUNG NHAM TOÀN SÀN — Đổi màu nền đáy đấu trường rực đỏ gồng năng lượng
        const magmaFloor = document.createElement('div');
        magmaFloor.style.cssText = `
            position: fixed; left: ${arenaRect.left}px; top: ${arenaRect.top}px;
            width: ${arenaRect.width}px; height: ${arenaRect.height}px;
            background: radial-gradient(circle at center, rgba(230,126,34,0.4) 0%, rgba(192,57,43,0.1) 70%, transparent 100%);
            z-index: 9992; pointer-events: none; opacity: 0;
            will-change: opacity;
        `;
        document.body.appendChild(magmaFloor);
        allEls.push(magmaFloor);

        magmaFloor.animate([
            { opacity: 0 },
            { opacity: 1, offset: 0.5 },
            { opacity: 0.7 }
        ], { duration: chargeMs, fill: 'forwards', easing: 'ease-in-out' });


        // 2. LỐC LỬA KHỔNG LỒ QUÉT TOÀN ĐẦU TRƯỜNG (Bắt đầu ở vùng vortexStart)
        const vortexSize = Math.max(arenaRect.width, arenaRect.height) * 1.2;
        const fireVortex = document.createElement('div');
        fireVortex.style.cssText = `
            position: fixed; left: ${arenaCx}px; top: ${arenaCy}px;
            width: ${vortexSize}px; height: ${vortexSize}px;
            background: conic-gradient(from 0deg, transparent, #ff5500, #ffcf00, transparent 60%, #ff5500, transparent);
            border-radius: 50%;
            filter: blur(${10 * scale}px);
            transform: translate(-50%, -50%) scale(0) rotate(0deg);
            z-index: 9994; pointer-events: none; opacity: 0;
            will-change: transform, opacity;
        `;
        document.body.appendChild(fireVortex);
        allEls.push(fireVortex);

        fireVortex.animate([
            { transform: 'translate(-50%, -50%) scale(0.1) rotate(0deg)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1) rotate(360deg)', opacity: 0.85, offset: 0.2 },
            { transform: 'translate(-50%, -50%) scale(1.1) rotate(720deg)', opacity: 0.9, offset: 0.8 },
            { transform: 'translate(-50%, -50%) scale(1.3) rotate(900deg)', opacity: 0 }
        ], { duration: vortexDuration, delay: vortexStart, fill: 'forwards', easing: 'ease-out' });


        // 3. ĐẠI BÙNG NỔ SUPERNOVA — Sóng xung kích bao phủ toàn bộ tầm nhìn arena
        const shockwave = document.createElement('div');
        shockwave.style.cssText = `
            position: fixed; left: ${arenaCx}px; top: ${arenaCy}px;
            width: ${arenaRect.width * 0.2}px; height: ${arenaRect.width * 0.2}px;
            background: radial-gradient(circle, #fff 10%, #ffdf00 30%, #ff3b0a 70%, transparent 100%);
            border-radius: 50%;
            transform: translate(-50%, -50%) scale(0);
            box-shadow: 0 0 ${40 * scale}px #ff8c00;
            z-index: 9995; pointer-events: none; opacity: 0;
            will-change: transform, opacity;
        `;
        document.body.appendChild(shockwave);
        allEls.push(shockwave);

        shockwave.animate([
            { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(3.5)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%, -50%) scale(6)', opacity: 0 }
        ], { duration: supernovaDuration, delay: supernovaStart, fill: 'forwards', easing: 'ease-out' });


        // 4. CHỚP SÁNG TOÀN KHUNG HÌNH ARENA (Flash lóa mắt khi vụ nổ đạt đỉnh)
        const arenaFlash = document.createElement('div');
        arenaFlash.style.cssText = `
            position: fixed; left: ${arenaRect.left}px; top: ${arenaRect.top}px;
            width: ${arenaRect.width}px; height: ${arenaRect.height}px;
            background: #fff;
            z-index: 9996; pointer-events: none; opacity: 0;
            mix-blend-mode: overlay;
            will-change: opacity;
        `;
        document.body.appendChild(arenaFlash);
        allEls.push(arenaFlash);

        arenaFlash.animate([
            { opacity: 0 },
            { opacity: 0.95, offset: 0.15 },
            { opacity: 0 }
        ], { duration: supernovaDuration * 0.6, delay: supernovaStart, fill: 'forwards', easing: 'ease-out' });


        // 5. MẢNH VỠ DUNG NHAM BẮN RA BIÊN ARENA (Giới hạn số lượng cố định cực ít để chống lag)
        const fragmentCount = Math.min(8, 6 + count);
        for (let f = 0; f < fragmentCount; f++) {
            const shard = document.createElement('div');
            const shardSize = (16 + Math.random() * 16) * scale;
            shard.style.cssText = `
                position: fixed; left: ${arenaCx}px; top: ${arenaCy}px;
                width: ${shardSize}px; height: ${shardSize}px;
                background: #ffcf00;
                box-shadow: 0 0 ${12 * scale}px #ff3b0a;
                border-radius: 30% 70% 70% 30% / 30% 30% 70% 70%; /* Tạo hình khối đá nứt góc ngẫu nhiên */
                transform: translate(-50%, -50%) scale(0);
                z-index: 9997; pointer-events: none; opacity: 0;
                will-change: transform, opacity;
            `;
            document.body.appendChild(shard);
            allEls.push(shard);

            // Bắn tung mảnh vỡ ra ngẫu nhiên hướng góc ngoài rìa biên sàn đấu
            const angle = (f / fragmentCount) * Math.PI * 2 + Math.random() * 0.5;
            const distance = (arenaRect.width * 0.4 + Math.random() * arenaRect.width * 0.2) * scale;
            const destX = Math.cos(angle) * distance;
            const destY = Math.sin(angle) * distance;

            shard.animate([
                { transform: 'translate(-50%, -50%) translate(0px, 0px) scale(0) rotate(0deg)', opacity: 0 },
                { transform: `translate(-50%, -50%) translate(${destX * 0.5}px, ${destY * 0.5}px) scale(1.3) rotate(180deg)`, opacity: 1, offset: 0.3 },
                { transform: `translate(-50%, -50%) translate(${destX}px, ${destY}px) scale(0.2) rotate(360deg)`, opacity: 0 }
            ], { duration: supernovaDuration * 0.9, delay: supernovaStart, fill: 'forwards', easing: 'ease-out' });
        }

        // Rung chuyển cực đại toàn cục kéo dài suốt giai đoạn nổ Supernova
        setTimeout(() => {
            if (this.applyGlobalShake) {
                this.applyGlobalShake(scale * 2.2); 
            }
        }, supernovaStart);

        // Chờ đợi kỹ năng thực thi xong toàn bộ timeline và giải phóng phần tử DOM
        await new Promise((resolve) => {
            setTimeout(() => {
                allEls.forEach((el) => el.remove());
                resolve();
            }, totalMs + 80);
        });
    },
    // ══════════════════════════════════════════════
    //SKILL 1 TRIỆU HỒI TOÀN MÀN HÌNH
    // ══════════════════════════════════════════════════════════
    // ENGINE DÙNG CHUNG CHO SKILL "TOÀN MÀN HÌNH" — sửa 1 chỗ,
    // mọi hệ hưởng lợi. Mỗi hệ chỉ cần gọi hàm này với itemBuilder
    // + màu + pattern riêng.
    // ══════════════════════════════════════════════════════════
    async playScreenSummonBurst(target, scale, opts) {
        const {
            itemBuilder,
            color = '#fff',
            count = 18,
            phase2 = 'random', // 'converge' | 'glow' | 'detonate' | 'random'
        } = opts;

        const arena = document.getElementById('battle-arena');
        const arenaRect = arena ? arena.getBoundingClientRect()
                                 : { left: 0, top: 0, width: window.innerWidth, height: window.innerHeight };
        const rectT = target.getBoundingClientRect();
        const targetX = rectT.left + rectT.width / 2;
        const targetY = rectT.top + rectT.height / 2;

        const cfg = this.durationConfig.aoe;

        // ── TIMELINE 3 PHA: TRIỆU HỒI → HÀNH ĐỘNG → NỔ TOÀN MÀN HÌNH ──
        const summonStart = cfg.chargeAura;
        const summonDur   = cfg.targetSustain * 0.45;
        const actionStart = summonStart + summonDur;
        const actionDur   = cfg.targetSustain * 0.30;
        const finaleStart = actionStart + actionDur;
        const finaleDur   = cfg.targetSustain * 0.25;
        const totalMs     = cfg.chargeAura + cfg.targetSustain;

        // Random hoá bước 2 nếu để 'random' — mỗi lần đánh có thể ra hành vi khác nhau
        const chosenPhase2 = phase2 === 'random'
            ? ['converge', 'glow', 'detonate'][Math.floor(Math.random() * 3)]
            : phase2;

        const particleCount = Math.max(15, Math.min(25, count));
        const allEls = [];
        const particles = [];

        if (this.playChargeSfx) this.playChargeSfx('normal');

        // ── PHA 1: TRIỆU HỒI — xuất hiện random vị trí/kích cỡ, tích luỹ dần, bập bềnh tại chỗ ──
        for (let i = 0; i < particleCount; i++) {
            const x = arenaRect.left + arenaRect.width * (0.08 + Math.random() * 0.84);
            const y = arenaRect.top + arenaRect.height * (0.1 + Math.random() * 0.6);
            const pScale = scale * (0.55 + Math.random() * 0.85); // kích cỡ random mỗi phần tử
            const spawnDelay = summonStart + (i / particleCount) * summonDur * 0.85 + Math.random() * 120;

            const el = itemBuilder(x, y, pScale, color);
            document.body.appendChild(el);
            allEls.push(el);
            particles.push({ el, x, y, scale: pScale });

            const bobAmp = (6 + Math.random() * 10) * pScale;
            const idleDur = Math.max(300, actionStart - spawnDelay);
            el.animate([
                { opacity: 0, transform: 'translate(-50%,-50%) scale(0.3)' },
                { opacity: 1, transform: 'translate(-50%,-50%) scale(1)', offset: 0.15 },
                { opacity: 1, transform: `translate(-50%,-50%) translateY(${-bobAmp}px) scale(1.05)`, offset: 0.5 },
                { opacity: 1, transform: `translate(-50%,-50%) translateY(${bobAmp * 0.6}px) scale(0.97)`, offset: 0.8 },
                { opacity: 1, transform: 'translate(-50%,-50%) scale(1)' }
            ], { duration: idleDur, delay: spawnDelay, fill: 'forwards', easing: 'ease-in-out' });
        }

        // ── PHA 2: HÀNH ĐỘNG — random 1 trong 3 kiểu để đỡ nhàm giữa các lượt đánh ──
        if (this.playTravelSfx) this.playTravelSfx('normal');

        particles.forEach((p, idx) => {
            if (chosenPhase2 === 'converge') {
                // Cùng bay hội tụ về phía đối thủ, kéo theo CHUỖI ẢNH MỜ (afterimage) dọc đường bay
                const dx = targetX - p.x, dy = targetY - p.y;
                p.el.animate([
                    { transform: 'translate(-50%,-50%) translate(0px,0px) scale(1)', offset: 0 },
                    { transform: `translate(-50%,-50%) translate(${dx * 0.9}px,${dy * 0.9}px) scale(1.15)`, offset: 0.88 },
                    { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(0.3)`, opacity: 0 }
                ], { duration: actionDur, delay: actionStart, fill: 'forwards', easing: 'ease-in' });

                // Thả 4 bản sao mờ dần dọc đường bay, mỗi bản trễ hơn 1 nhịp so với phần tử gốc
                const ghostCount = 4;
                for (let g = 1; g <= ghostCount; g++) {
                    const t = g / (ghostCount + 1);
                    const ghostDelay = actionStart + actionDur * t * 0.9;
                    const ghost = document.createElement('div');
                    const gSize = 10 * p.scale;
                    ghost.style.cssText = `
                        position: fixed; left:${p.x + dx * t}px; top:${p.y + dy * t}px;
                        width:${gSize}px; height:${gSize}px; border-radius:50%;
                        background: radial-gradient(circle, ${color}cc 15%, ${color}55 60%, transparent 100%);
                        filter: blur(${1.5 * p.scale}px);
                        transform: translate(-50%,-50%) scale(1); opacity: 0;
                        z-index: 9994; pointer-events:none;
                    `;
                    document.body.appendChild(ghost);
                    allEls.push(ghost);
                    ghost.animate([
                        { opacity: 0.55, transform: 'translate(-50%,-50%) scale(1)' },
                        { opacity: 0, transform: 'translate(-50%,-50%) scale(0.4)' }
                    ], { duration: 260, delay: ghostDelay, fill: 'forwards', easing: 'ease-out' });
                }

                // ÂM THANH — 1 tiếng "vù" mạnh đồng loạt lúc cả đàn bắt đầu lao đi (chỉ bắn 1 lần)
                if (idx === 0 && window.SoundEngine) {
                    window.SoundEngine.playDelayed('whoosh', actionStart, 0.45, 0.22, 850);
                }
                // Rải thêm vài tiếng "vù" nhỏ lệch pha nhẹ cho có chiều sâu, không dồn ồn cùng lúc
                if (idx % 4 === 0 && window.SoundEngine) {
                    window.SoundEngine.playDelayed('whoosh', actionStart + Math.random() * 120, 0.3, 0.12, 1100 + idx * 10);
                }

            } else if (chosenPhase2 === 'glow') {
                // 'glow' — SÁNG LẦN LƯỢT THEO THỨ TỰ (domino): phần tử nào sáng rồi thì
                // GIỮ NGUYÊN độ sáng đó, và độ sáng đỉnh tăng dần theo thứ tự.
                const stepDur = Math.max(90, actionDur / particleCount);
                const glowDelay = actionStart + idx * stepDur;

                const peakBrightness = 2.2 + (idx / particleCount) * 2.2;
                const peakScale = 1.15 + (idx / particleCount) * 0.35;

                p.el.animate([
                    { filter: 'brightness(1) saturate(1)', transform: 'translate(-50%,-50%) scale(1)' },
                    { filter: `brightness(${peakBrightness}) saturate(1.5)`, transform: `translate(-50%,-50%) scale(${peakScale})` }
                ], { duration: stepDur, delay: glowDelay, fill: 'forwards', easing: 'ease-out' });

                const spot = document.createElement('div');
                const spotSize = (60 + idx * 2) * p.scale;
                spot.style.cssText = `
                    position: fixed; left:${p.x}px; top:${p.y}px;
                    width:${spotSize}px; height:${spotSize}px; border-radius:50%;
                    background: radial-gradient(circle, ${color}88 0%, ${color}33 45%, transparent 75%);
                    transform: translate(-50%,-50%) scale(0.3); opacity: 0;
                    z-index: 9993; pointer-events:none;
                `;
                document.body.appendChild(spot);
                allEls.push(spot);
                spot.animate([
                    { opacity: 0, transform: 'translate(-50%,-50%) scale(0.3)' },
                    { opacity: Math.min(1, 0.6 + idx * 0.02), transform: 'translate(-50%,-50%) scale(1.3)' }
                ], { duration: stepDur, delay: glowDelay, fill: 'forwards', easing: 'ease-out' });

                // ÂM THANH — chuông "chime" ngân lên đúng lúc phần tử này sáng, cao độ TĂNG DẦN
                // theo thứ tự (idx) để nghe như đang dồn năng lượng cao trào — bỏ bớt 1 nửa để đỡ dày
                if (idx % 2 === 0 && window.SoundEngine) {
                    const pitch = 500 + idx * 35;
                    const vol = 0.08 + (idx / particleCount) * 0.09;
                    window.SoundEngine.playDelayed('chime', glowDelay, pitch, 0.22, vol);
                }

            } else {
                // 'detonate' — NỔ DÂY CHUYỀN (domino): nổ lần lượt đúng thứ tự, quy mô nổ TĂNG DẦN.
                const stepDur = Math.max(110, (actionDur * 0.9) / particleCount);
                const detDelay = actionStart + idx * stepDur;
                const burstScale = 1.8 + (idx / particleCount) * 1.6;

                p.el.animate([
                    { transform: 'translate(-50%,-50%) scale(1)', opacity: 1 },
                    { transform: `translate(-50%,-50%) scale(${burstScale})`, opacity: 0.9, offset: 0.4 },
                    { transform: 'translate(-50%,-50%) scale(0.15)', opacity: 0 }
                ], { duration: stepDur * 1.4, delay: detDelay, fill: 'forwards', easing: 'ease-out' });

                const ring = document.createElement('div');
                const ringSize = 26 * p.scale * (1 + idx / particleCount);
                ring.style.cssText = `
                    position: fixed; left:${p.x}px; top:${p.y}px;
                    width:${ringSize}px; height:${ringSize}px; border-radius:50%;
                    background: radial-gradient(circle, #fff 15%, ${color} 55%, transparent 100%);
                    transform: translate(-50%,-50%) scale(0); opacity: 0;
                    z-index: 9994; pointer-events:none;
                `;
                document.body.appendChild(ring);
                allEls.push(ring);
                ring.animate([
                    { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
                    { transform: 'translate(-50%,-50%) scale(1.6)', opacity: 0.9, offset: 0.35 },
                    { transform: 'translate(-50%,-50%) scale(2.4)', opacity: 0 }
                ], { duration: stepDur * 1.3, delay: detDelay, fill: 'forwards', easing: 'ease-out' });

                setTimeout(() => {
                    if (this.applyGlobalShake) this.applyGlobalShake(scale * (0.3 + (idx / particleCount) * 0.5));
                }, detDelay);

                // ÂM THANH — mỗi vụ nổ trong chuỗi phát 1 tiếng "boom", TRẦM DẦN + TO DẦN
                // theo thứ tự (idx) để nghe như quả sau luôn mạnh hơn quả trước.
                if (window.SoundEngine) {
                    const boomVol = 0.12 + (idx / particleCount) * 0.16;
                    const boomFreq = 220 - (idx / particleCount) * 90; // trầm dần
                    window.SoundEngine.playDelayed('boom', detDelay, 0.22 + (idx / particleCount) * 0.08, boomVol, boomFreq);

                    // Thêm 1 tiếng "tách" lửa nhỏ ngay trước tiếng nổ để có kết cấu, bỏ bớt cho đỡ dày
                    if (idx % 2 === 0) {
                        window.SoundEngine.playDelayed('crackle', Math.max(0, detDelay - 40), 0.12, 0.08);
                    }
                }
            }
        });

        // ── PHA 3: NỔ TOÀN MÀN HÌNH + RUNG CHẤN (dùng chung cho mọi hệ) ──
        const finaleEls = [];
        setTimeout(() => {
            this.triggerScreenFinale(arenaRect, targetX, targetY, color, scale, finaleDur, finaleEls);
        }, finaleStart);

        await new Promise(r => setTimeout(r, totalMs + 250));
        allEls.forEach(el => el.remove());
        finaleEls.forEach(el => el.remove());
    },

    // ── PHA NỔ TOÀN MÀN HÌNH DÙNG CHUNG — mọi hệ gọi lại, chỉ đổi màu ──
    // Gồm: sóng xung kích lớn tại điểm hội tụ + chớp sáng phủ toàn arena
    // + mảnh vỡ bắn ra biên + rung màn hình toàn cục.
    triggerScreenFinale(arenaRect, cx, cy, color, scale, duration, collectEls) {
        const push = (el) => { document.body.appendChild(el); if (collectEls) collectEls.push(el); };

        // Sóng xung kích lớn từ điểm hội tụ lan phủ gần hết arena
        const shockSize = Math.max(arenaRect.width, arenaRect.height) * 0.15;
        const shock = document.createElement('div');
        shock.style.cssText = `
            position: fixed; left:${cx}px; top:${cy}px;
            width:${shockSize}px; height:${shockSize}px; border-radius:50%;
            background: radial-gradient(circle, #fff 10%, ${color} 40%, ${color}55 70%, transparent 100%);
            box-shadow: 0 0 ${40 * scale}px ${color};
            transform: translate(-50%,-50%) scale(0);
            z-index: 9995; pointer-events:none; opacity:0;
        `;
        push(shock);
        shock.animate([
            { transform: 'translate(-50%,-50%) scale(0)', opacity: 0 },
            { transform: 'translate(-50%,-50%) scale(4)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%,-50%) scale(7)', opacity: 0 }
        ], { duration, fill: 'forwards', easing: 'ease-out' });

        // Chớp sáng toàn khung arena (không tràn full màn hình)
        const flash = document.createElement('div');
        flash.style.cssText = `
            position: fixed; left:${arenaRect.left}px; top:${arenaRect.top}px;
            width:${arenaRect.width}px; height:${arenaRect.height}px;
            background:#fff; mix-blend-mode: overlay;
            z-index: 9996; pointer-events:none; opacity:0;
        `;
        push(flash);
        flash.animate([
            { opacity: 0 },
            { opacity: 0.9, offset: 0.15 },
            { opacity: 0 }
        ], { duration: duration * 0.6, fill: 'forwards', easing: 'ease-out' });

        // Mảnh vỡ bắn ra biên arena (số lượng cố định thấp để tránh lag)
        const fragmentCount = 10;
        for (let f = 0; f < fragmentCount; f++) {
            const shard = document.createElement('div');
            const shardSize = (10 + Math.random() * 12) * scale;
            shard.style.cssText = `
                position: fixed; left:${cx}px; top:${cy}px;
                width:${shardSize}px; height:${shardSize}px; border-radius:50%;
                background: radial-gradient(circle, #fff 20%, ${color} 75%);
                box-shadow: 0 0 ${10 * scale}px ${color};
                transform: translate(-50%,-50%) scale(0);
                z-index: 9997; pointer-events:none; opacity:0;
            `;
            push(shard);
            const angle = (f / fragmentCount) * Math.PI * 2 + Math.random() * 0.4;
            const dist = arenaRect.width * (0.35 + Math.random() * 0.25);
            const dx = Math.cos(angle) * dist, dy = Math.sin(angle) * dist;
            shard.animate([
                { transform: 'translate(-50%,-50%) translate(0px,0px) scale(0)', opacity: 0 },
                { transform: `translate(-50%,-50%) translate(${dx * 0.5}px,${dy * 0.5}px) scale(1.2)`, opacity: 1, offset: 0.3 },
                { transform: `translate(-50%,-50%) translate(${dx}px,${dy}px) scale(0.2)`, opacity: 0 }
            ], { duration: duration * 0.9, fill: 'forwards', easing: 'ease-out' });
        }

        if (this.applyGlobalShake) this.applyGlobalShake(scale * 2);
        if (this.playImpactSfx) { /* impact sfx đã được gọi tập trung ở triggerMultiEffect, không gọi lại ở đây */ }
    },



    // HỆ ĐIỆN — spawnElectric4 (Static Burst) — ★ Skill toàn màn hình
    // CSS phần tử tia điện vẽ riêng ngay trong hàm này (core sáng + tia chớp zigzag,
    // xoay góc random để tạo cảm giác lộn xộn đặc trưng của điện).
    // Bước 2 để 'random': mỗi lượt đánh ngẫu nhiên rơi vào 1 trong 3 hiệu ứng
    // (nổ tại chỗ / sáng lên theo làn sóng / hội tụ kéo theo chuỗi ảnh mờ).
    async spawnElectric4(startEl, endEl, count, scale) {
        const buildBolt = (x, y, s, c) => {
            const size = 16 * s;
            const angle = Math.random() * 70 - 35; // random để mỗi tia lệch hướng khác nhau
            const el = document.createElement('div');
            el.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${size * 0.6}px; height:${size * 1.7}px;
                transform: translate(-50%,-50%) rotate(${angle}deg);
                pointer-events: none; z-index: 9998; opacity: 0;
                filter: drop-shadow(0 0 ${4 * s}px #aef1ff);
            `;
            el.innerHTML = `
                <div style="position:absolute; left:50%; top:50%; width:${size * 0.55}px; height:${size * 0.55}px;
                    transform:translate(-50%,-50%); border-radius:50%;
                    background:radial-gradient(circle,#fff 20%,#fff59d 55%,${c} 100%);
                    box-shadow:0 0 ${size * 0.5}px ${c};"></div>
                <div style="position:absolute; left:50%; top:50%; width:${size * 0.32}px; height:${size * 1.6}px;
                    transform:translate(-50%,-50%);
                    background:linear-gradient(to bottom, transparent, #fff, ${c}, #fff, transparent);
                    clip-path:polygon(50% 0%,66% 20%,42% 28%,62% 46%,36% 56%,58% 74%,50% 100%,32% 76%,56% 60%,30% 44%,54% 30%,34% 14%);
                    box-shadow:0 0 ${size * 0.4}px ${c};"></div>
            `;
            return el;
        };

        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildBolt,
            color: '#f1c40f', phase2: 'random', count: 20,
        });
    },
    // HỆ LỬA — spawnFire4 (Solar Flare) — ★ Skill toàn màn hình
    // Mỗi phần tử là 1 "mặt trời" nhỏ: lõi sáng + các tia nắng toả quanh,
    // góc xoay random để trông tự nhiên, không đều tăm tắp.
    async spawnFire4(startEl, endEl, count, scale) {
        const buildSun = (x, y, s, c) => {
            const size = 20 * s;
            const rayCount = 8;
            const el = document.createElement('div');
            el.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${size}px; height:${size}px;
                transform: translate(-50%,-50%) rotate(${Math.random() * 360}deg);
                pointer-events: none; z-index: 9998; opacity: 0;
                filter: drop-shadow(0 0 ${5 * s}px #ffb347);
            `;
            let raysHtml = '';
            for (let i = 0; i < rayCount; i++) {
                const angle = (360 / rayCount) * i;
                raysHtml += `
                    <div style="position:absolute; left:50%; top:50%; width:${size * 0.16}px; height:${size * 0.62}px;
                        background:linear-gradient(to bottom, ${c}, transparent);
                        transform:translate(-50%,-100%) rotate(${angle}deg); transform-origin:50% 100%;
                        border-radius:50% 50% 0 0;"></div>
                `;
            }
            el.innerHTML = `
                ${raysHtml}
                <div style="position:absolute; inset:0; border-radius:50%;
                    background:radial-gradient(circle,#fff 10%,#ffe066 40%,${c} 80%);
                    box-shadow:0 0 ${size * 0.7}px ${c};"></div>
            `;
            return el;
        };

        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildSun,
            color: '#ff6d00', phase2: 'random', count: 18,
        });
    },

    // HỆ NƯỚC — spawnWater4 (Tsunami Surge) — ★ Skill toàn màn hình
    // Bong bóng nước trong suốt, có viền sáng + điểm highlight nhỏ tạo độ bóng thật.
    async spawnWater4(startEl, endEl, count, scale) {
        const buildBubble = (x, y, s, c) => {
            const size = 18 * s;
            const el = document.createElement('div');
            el.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${size}px; height:${size}px; border-radius:50%;
                transform: translate(-50%,-50%);
                pointer-events: none; z-index: 9998; opacity: 0;
                background: radial-gradient(circle at 32% 28%, #fff 0%, ${c}99 45%, ${c}33 80%, transparent 100%);
                border: 1.5px solid rgba(255,255,255,0.75);
                box-shadow: inset -2px -2px 5px rgba(0,0,0,0.15), inset 2px 2px 6px rgba(255,255,255,0.6), 0 0 ${size * 0.35}px ${c}88;
            `;
            const highlight = document.createElement('div');
            highlight.style.cssText = `
                position:absolute; left:22%; top:20%; width:26%; height:26%;
                background:#fff; border-radius:50%; opacity:0.7;
            `;
            el.appendChild(highlight);
            return el;
        };

        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildBubble,
            color: '#3498db', phase2: 'random', count: 20,
        });
    },

    // HỆ ĐÁ — spawnRock4 (Meteor Fall) — ★ Skill toàn màn hình
    // Mỗi viên đá random 1 trong 3 hình đa giác thô ráp khác nhau, xoay góc ngẫu nhiên
    // để đàn đá trông tự nhiên, không giống hệt nhau.
    async spawnRock4(startEl, endEl, count, scale) {
        const buildStone = (x, y, s, c) => {
            const size = 18 * s;
            const el = document.createElement('div');
            const clipPaths = [
                'polygon(20% 0%,80% 8%,100% 45%,78% 100%,20% 95%,0% 50%)',
                'polygon(10% 15%,60% 0%,100% 30%,90% 80%,45% 100%,0% 65%)',
                'polygon(30% 0%,90% 20%,100% 70%,55% 100%,5% 75%,0% 25%)',
            ];
            const clip = clipPaths[Math.floor(Math.random() * clipPaths.length)];
            el.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${size}px; height:${size}px;
                transform: translate(-50%,-50%) rotate(${Math.random() * 360}deg);
                pointer-events: none; z-index: 9998; opacity: 0;
                background: linear-gradient(135deg, #fff2, ${c} 55%, #00000055);
                clip-path: ${clip};
                box-shadow: 0 0 ${size * 0.3}px #00000066;
            `;
            return el;
        };

        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildStone,
            color: '#8d6e63', phase2: 'random', count: 18,
        });
    },


    // HỆ BĂNG — spawnIce4 (Absolute Zero) — ★ Skill toàn màn hình
    // Bông tuyết 6 cánh đối xứng, dựng bằng nhiều nhánh xoay đều 60°.
    async spawnIce4(startEl, endEl, count, scale) {
        const buildSnowflake = (x, y, s, c) => {
            const size = 18 * s;
            const el = document.createElement('div');
            el.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${size}px; height:${size}px;
                transform: translate(-50%,-50%) rotate(${Math.random() * 60}deg);
                pointer-events: none; z-index: 9998; opacity: 0;
                filter: drop-shadow(0 0 ${4 * s}px #fff) drop-shadow(0 0 ${6 * s}px ${c});
            `;
            let branches = '';
            for (let i = 0; i < 6; i++) {
                const angle = i * 60;
                branches += `
                    <div style="position:absolute; left:50%; top:50%; width:2px; height:${size * 0.5}px;
                        background: linear-gradient(to top, transparent, #fff 40%, ${c});
                        transform: translate(-50%,-100%) rotate(${angle}deg); transform-origin: 50% 100%;">
                        <div style="position:absolute; top:30%; left:-3px; width:0; height:0;
                            border-left:3px solid transparent; border-right:3px solid transparent;
                            border-bottom:4px solid #fff; transform: rotate(35deg);"></div>
                        <div style="position:absolute; top:30%; right:-3px; width:0; height:0;
                            border-left:3px solid transparent; border-right:3px solid transparent;
                            border-bottom:4px solid #fff; transform: rotate(-35deg);"></div>
                    </div>
                `;
            }
            el.innerHTML = `
                ${branches}
                <div style="position:absolute; left:50%; top:50%; width:${size * 0.22}px; height:${size * 0.22}px;
                    transform:translate(-50%,-50%); border-radius:50%;
                    background: radial-gradient(circle,#fff 30%,${c} 100%);"></div>
            `;
            return el;
        };

        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildSnowflake,
            color: '#74b9ff', phase2: 'random', count: 20,
        });
    },

    // HỆ CỎ — spawnGrass4 (Bloom Cascade) — ★ Skill toàn màn hình
    // Lá cây dựng đúng theo tinh thần CSS bạn gửi: gradient xanh chéo, viền đậm,
    // bo góc nhọn-sắc (80% 10% 80% 10%), drop-shadow nổi bật + gân lá chạy chéo.
    async spawnGrass4(startEl, endEl, count, scale) {
        // Vài bảng màu khác nhau để đàn lá không đồng nhất 1 tông
        const leafPalettes = [
            ['#2ecc71', '#27ae60', '#145a32'],
            ['#58d68d', '#229954', '#0b3d1e'],
            ['#82e0aa', '#1e8449', '#0e4d24'],
        ];

        const buildLeaf = (x, y, s, c) => {
            const [top, bottom, edge] = leafPalettes[Math.floor(Math.random() * leafPalettes.length)];
            const w = 34 * s, h = 19 * s;
            const angle = Math.random() * 360;

            // outer: KHÔNG tự set transform — nhường toàn quyền vị trí/scale/opacity
            // cho playScreenSummonBurst animate, tránh bị ghi đè góc xoay.
            const outer = document.createElement('div');
            outer.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${w}px; height:${h}px;
                pointer-events: none; z-index: 9998; opacity: 0;
            `;

            // inner: giữ NGUYÊN góc xoay + toàn bộ hình dạng/màu sắc lá, không bị animate đè
            const inner = document.createElement('div');
            inner.style.cssText = `
                position: absolute; inset: 0;
                transform: rotate(${angle}deg);
                background: linear-gradient(135deg, ${top}, ${bottom});
                border-radius: 80% 10% 80% 10%;
                border: ${1.2 * s}px solid ${edge};
                filter: drop-shadow(0 0 ${4 * s}px rgba(0,0,0,0.5));
            `;
            // Gân lá chạy chéo theo trục dài của lá
            inner.innerHTML = `
                <div style="position:absolute; left:8%; top:48%; width:84%; height:${Math.max(1, 1 * s)}px;
                    background: rgba(0,0,0,0.25); transform: rotate(-6deg);"></div>
            `;

            outer.appendChild(inner);
            return outer;
        };

        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildLeaf,
            color: '#2ecc71', phase2: 'random', count: 22,
        });
    },

    // HỆ BAY — spawnFlying4 (Tempest Wing) — ★ Skill toàn màn hình
    // Lưỡi liềm gió dựng bằng SVG mask (2 vòng tròn lệch tâm) đúng kiểu tham khảo —
    // ID gradient/mask random riêng từng lưỡi để nhiều lưỡi bay cùng lúc không giẫm ID.
    async spawnFlying4(startEl, endEl, count, scale) {
        let uidCounter = 0;

        const buildCrescentBlade = (x, y, s, c) => {
            const uid = `af4-${Date.now()}-${uidCounter++}`;
            const size = 56 * s;
            const angle = Math.random() * 360;

            const outer = document.createElement('div');
            outer.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${size}px; height:${size}px;
                pointer-events: none; z-index: 9998; opacity: 0;
            `;

            // inner: giữ nguyên góc xoay của lưỡi liềm, không bị animate cha ghi đè
            const inner = document.createElement('div');
            inner.style.cssText = `
                position: absolute; inset: 0;
                transform: rotate(${angle}deg);
            `;
            inner.innerHTML = `
                <svg width="${size}" height="${size}" viewBox="0 0 96 96">
                    <defs>
                        <radialGradient id="grad-${uid}" cx="28%" cy="50%" r="70%">
                            <stop offset="0%" stop-color="#fff"/>
                            <stop offset="65%" stop-color="#dff3ff"/>
                            <stop offset="100%" stop-color="rgba(200,240,255,0)"/>
                        </radialGradient>
                        <mask id="mask-${uid}">
                            <rect x="0" y="0" width="96" height="96" fill="black"/>
                            <circle cx="48" cy="48" r="38" fill="white"/>
                            <circle cx="32" cy="48" r="30" fill="black"/>
                        </mask>
                    </defs>
                    <circle cx="48" cy="48" r="38" fill="url(#grad-${uid})" mask="url(#mask-${uid})"
                        style="filter: drop-shadow(0 0 ${8 * s}px rgba(200,240,255,0.9));"/>
                </svg>
            `;

            outer.appendChild(inner);
            return outer;
        };

        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildCrescentBlade,
            color: '#a890f0', phase2: 'random', count: 18,
        });
    },
    async spawnDragon4(startEl, endEl, count, scale) {
        // Tự động thêm hiệu ứng chuyển động Thần Long lượn sóng (chỉ chạy 1 lần)
        if (!document.getElementById('pkm-dragon-epic-keyframes')) {
            const style = document.createElement('style');
            style.id = 'pkm-dragon-epic-keyframes';
            style.textContent = `
                @keyframes dragon-epic-glide {
                    0%, 100% { transform: translateY(0) scale(1) rotate(0deg); }
                    25% { transform: translateY(-5px) scale(0.98) rotate(1deg); }
                    50% { transform: translateY(2px) scale(1.02) rotate(-1deg); }
                    75% { transform: translateY(-3px) scale(1) rotate(0.5deg); }
                }
            `;
            document.head.appendChild(style);
        }

        let uid = 0;
        const buildDragonSpirit = (x, y, s, c) => {
            // Tăng kích thước rộng rãi để hiển thị toàn bộ Thần Long uốn lượn kiêu hùng
            const w = 120 * s, h = 60 * s;
            const angle = Math.random() * 360;
            const gid = `epic-drg-${Date.now()}-${uid++}`;

            const outer = document.createElement('div');
            outer.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${w}px; height:${h}px;
                pointer-events: none; z-index: 9998; opacity: 0;
            `;

            const inner = document.createElement('div');
            inner.style.cssText = `
                position: absolute; inset: 0;
                transform: rotate(${angle}deg);
                /* Hào quang Thần Long huyền thoại xếp chồng nhiều lớp màu cực đẹp */
                filter: drop-shadow(0 0 ${4 * s}px ${c}) 
                        drop-shadow(0 0 ${10 * s}px #00f0ff) 
                        drop-shadow(0 0 ${2 * s}px #fff);
                /* Áp dụng hoạt ảnh chuyển động uốn lượn */
                animation: dragon-epic-glide 0.8s ease-in-out infinite;
                animation-delay: -${Math.random() * 800}ms;
            `;

            // SVG Thần Long phương Đông uốn lượn nghệ thuật cao cấp
            inner.innerHTML = `
                <svg width="${w}" height="${h}" viewBox="0 0 160 80" style="overflow:visible;">
                    <defs>
                        <linearGradient id="drgGrad-${gid}" x1="0%" y1="50%" x2="100%" y2="30%">
                            <stop offset="0%" stop-color="#2a085c" stop-opacity="0.4"/>
                            <stop offset="40%" stop-color="${c}" stop-opacity="0.95"/>
                            <stop offset="85%" stop-color="#00f0ff" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#ffffff"/>
                        </linearGradient>
                    </defs>

                    <path d="M 14,45 C 4,43 -2,32 3,22 C 6,30 10,38 14,45 Z" fill="#00f0ff" opacity="0.8"/>

                    <path d="M 12,45 C 25,18 45,72 65,40 C 85,8 105,62 125,32 C 135,18 146,22 152,32 C 144,48 130,45 122,45 C 105,72 85,20 65,52 C 45,82 25,32 12,45 Z" 
                          fill="url(#drgGrad-${gid})" />

                    <path d="M 16,46 C 26,30 46,74 65,42 C 76,26 90,34 100,50 C 90,22 72,16 65,38 C 45,68 26,28 16,46 Z" 
                          fill="rgba(255, 255, 255, 0.35)" />

                    <polygon points="32,25 35,12 42,23" fill="#ffffff" opacity="0.9"/>
                    <polygon points="54,46 56,60 64,48" fill="#00f0ff" opacity="0.9"/>
                    <polygon points="82,18 85,4 92,16" fill="#ffffff" opacity="0.9"/>
                    <polygon points="106,44 109,58 117,46" fill="#00f0ff" opacity="0.9"/>

                    <path d="M 124,33 C 130,22 142,20 152,30 C 155,33 151,39 148,41 C 149,45 143,48 135,42 Z" fill="url(#drgGrad-${gid})"/>

                    <polygon points="135,26 148,8 142,24" fill="#ffffff"/>
                    <polygon points="131,25 142,5 137,23" fill="#ffffff" opacity="0.7"/>

                    <circle cx="142" cy="32" r="2.2" fill="#ffffff" style="filter: drop-shadow(0 0 2px #fff);"/>

                    <path d="M 148,39 Q 164,44 170,39 M 146,41 Q 160,52 166,51" stroke="#00f0ff" stroke-width="1.5" fill="none" stroke-linecap="round"/>
                </svg>
            `;

            outer.appendChild(inner);
            return outer;
        };

        // Kích hoạt bùng nổ trận pháp rồng bay lượn ngẫu nhiên toàn màn hình qua bộ lõi AOE của bạn
        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildDragonSpirit,
            color: '#7038f8', // Sắc tím đặc trưng tối thượng của hệ Rồng
            phase2: 'random', 
            count: 16,
        });
    },

    async spawnFighting4(startEl, endEl, count, scale) {
        const weapons = ['sword', 'axe', 'mace'];

        const buildWeaponSpirit = (x, y, s, c) => {
            const kind = weapons[Math.floor(Math.random() * weapons.length)];
            const w = 26 * s, h = 46 * s;
            const angle = Math.random() * 360;

            const outer = document.createElement('div');
            outer.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${w}px; height:${h}px;
                pointer-events: none; z-index: 9998; opacity: 0;
            `;

            const inner = document.createElement('div');
            inner.style.cssText = `
                position: absolute; inset: 0;
                transform: rotate(${angle}deg);
                filter: drop-shadow(0 0 ${5 * s}px ${c});
            `;

            if (kind === 'sword') {
                inner.innerHTML = `
                    <div style="position:absolute; left:38%; top:0%; width:24%; height:62%;
                        clip-path:polygon(50% 0%, 100% 30%, 78% 100%, 22% 100%, 0% 30%);
                        background:linear-gradient(180deg,#fff 0%, ${c}dd 40%, ${c}88 100%);
                        box-shadow:0 0 ${5 * s}px ${c};"></div>
                    <div style="position:absolute; left:20%; top:60%; width:60%; height:8%;
                        background:${c}cc; border-radius:2px;"></div>
                    <div style="position:absolute; left:42%; top:66%; width:16%; height:30%;
                        background:linear-gradient(${c}, ${c}aa); border-radius:2px;"></div>
                    <div style="position:absolute; left:36%; top:94%; width:28%; height:10%;
                        border-radius:50%; background:${c};"></div>
                `;
            } else if (kind === 'axe') {
                inner.innerHTML = `
                    <div style="position:absolute; left:44%; top:6%; width:12%; height:88%;
                        background:linear-gradient(${c}, ${c}aa); border-radius:2px;"></div>
                    <div style="position:absolute; left:0%; top:0%; width:100%; height:38%;
                        clip-path:polygon(50% 40%, 30% 0%, 100% 10%, 90% 50%, 50% 65%);
                        background:radial-gradient(circle at 60% 20%, #fff 0%, ${c}dd 45%, ${c}88 100%);
                        box-shadow:0 0 ${5 * s}px ${c};"></div>
                `;
            } else {
                inner.innerHTML = `
                    <div style="position:absolute; left:44%; top:22%; width:12%; height:72%;
                        background:linear-gradient(${c}, ${c}aa); border-radius:2px;"></div>
                    <div style="position:absolute; left:20%; top:0%; width:60%; height:34%; border-radius:50%;
                        background:radial-gradient(circle at 35% 30%, #fff 0%, ${c}dd 50%, ${c}88 100%);
                        box-shadow:0 0 ${5 * s}px ${c};"></div>
                    <div style="position:absolute; left:47%; top:-6%; width:6%; height:14%; background:#fff;
                        clip-path:polygon(50% 0%,100% 100%,0% 100%);"></div>
                    <div style="position:absolute; left:8%; top:8%; width:6%; height:14%; background:#fff;
                        clip-path:polygon(50% 0%,100% 100%,0% 100%); transform:rotate(-60deg);"></div>
                    <div style="position:absolute; left:78%; top:8%; width:6%; height:14%; background:#fff;
                        clip-path:polygon(50% 0%,100% 100%,0% 100%); transform:rotate(60deg);"></div>
                `;
            }

            outer.appendChild(inner);
            return outer;
        };

        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildWeaponSpirit,
            color: '#e74c3c', phase2: 'random', count: 16,
        });
    },
    async spawnFairy4(startEl, endEl, count, scale) {
        // Tự động inject keyframes vỗ cánh (chỉ chạy 1 lần duy nhất)
        if (!document.getElementById('pkm-fairy-keyframes')) {
            const style = document.createElement('style');
            style.id = 'pkm-fairy-keyframes';
            style.textContent = `
                @keyframes fairy-wing-flap-l {
                    0%, 100% { transform: rotate(20deg) scaleX(-1); }
                    50% { transform: rotate(-35deg) scaleX(-1); }
                }
                @keyframes fairy-wing-flap-r {
                    0%, 100% { transform: rotate(20deg); }
                    50% { transform: rotate(-35deg); }
                }
            `;
            document.head.appendChild(style);
        }

        // Định nghĩa cấu trúc Tinh linh Tiên tộc đồng bộ với hệ thống vật thể
        const buildFairySpirit = (x, y, s, c) => {
            const w = 36 * s, h = 36 * s;
            // Giữ độ nghiêng nhẹ tự nhiên khi bay lượn thay vì xoay tròn 360 độ
            const angle = (Math.random() - 0.5) * 30; 

            const outer = document.createElement('div');
            outer.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${w}px; height:${h}px;
                pointer-events: none; z-index: 9998; opacity: 0;
            `;

            const inner = document.createElement('div');
            inner.style.cssText = `
                position: absolute; inset: 0;
                transform: rotate(${angle}deg);
                display: flex; align-items: center; justify-content: center;
            `;

            // Khởi tạo cơ thể tinh linh hình người phát sáng kèm 2 cánh vỗ liên tục
            inner.innerHTML = `
                <div style="position: relative; width: ${8 * s}px; height: ${18 * s}px; 
                            background: linear-gradient(to bottom, #ffffff, ${c}); 
                            border-radius: ${4 * s}px ${4 * s}px ${5 * s}px ${5 * s}px; 
                            box-shadow: 0 0 ${10 * s}px ${c}, 0 0 ${4 * s}px #fff;">

                    <!-- Đầu tinh linh -->
                    <div style="position: absolute; top: -${8 * s}px; left: 50%; transform: translateX(-50%); 
                                width: ${8 * s}px; height: ${8 * s}px; background: #fff; border-radius: 50%; 
                                box-shadow: 0 0 ${6 * s}px #fff, 0 0 ${12 * s}px ${c};"></div>

                    <!-- Cánh Trái -->
                    <div style="position: absolute; right: 100%; top: -${1 * s}px; 
                                width: ${14 * s}px; height: ${22 * s}px; 
                                background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 182, 193, 0.6) 80%); 
                                border-radius: 100% 0% 100% 40%; box-shadow: 0 0 ${8 * s}px rgba(255, 182, 193, 0.8); 
                                transform-origin: right top; animation: fairy-wing-flap-l 0.12s ease-in-out infinite;"></div>

                    <!-- Cánh Phải -->
                    <div style="position: absolute; left: 100%; top: -${1 * s}px; 
                                width: ${14 * s}px; height: ${22 * s}px; 
                                background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.95) 0%, rgba(255, 182, 193, 0.6) 80%); 
                                border-radius: 0% 100% 40% 100%; box-shadow: 0 0 ${8 * s}px rgba(255, 182, 193, 0.8); 
                                transform-origin: left top; animation: fairy-wing-flap-r 0.12s ease-in-out infinite;"></div>
                </div>
            `;

            outer.appendChild(inner);
            return outer;
        };

        // Kích hoạt nổ trận pháp triệu hồi toàn màn hình, di chuyển lượn và rung lắc qua bộ lõi AOE
        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildFairySpirit,
            color: '#ee99ac', // Màu hồng phấn đặc trưng của hệ Tiên
            phase2: 'random', 
            count: 16,
        });
    },
    async spawnBug4(startEl, endEl, count, scale) {
        // Tự động thêm hiệu ứng hoạt ảnh co duỗi bò trườn của sâu nhỏ (chỉ chạy 1 lần)
        if (!document.getElementById('pkm-bug-epic-keyframes')) {
            const style = document.createElement('style');
            style.id = 'pkm-bug-epic-keyframes';
            style.textContent = `
                @keyframes bug-caterpillar-crawl {
                    0%, 100% { transform: scaleX(1) scaleY(1) translateY(0); }
                    30% { transform: scaleX(0.82) scaleY(1.15) translateY(-4px); }
                    65% { transform: scaleX(1.08) scaleY(0.92) translateY(1px); }
                }
            `;
            document.head.appendChild(style);
        }

        let uid = 0;
        const buildBugSpirit = (x, y, s, c) => {
            // Định kích thước vừa vặn cho chú sâu nhỏ tinh nghịch
            const w = 50 * s, h = 25 * s;
            const angle = Math.random() * 360;
            const gid = `bug-${Date.now()}-${uid++}`;

            const outer = document.createElement('div');
            outer.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${w}px; height:${h}px;
                pointer-events: none; z-index: 9998; opacity: 0;
            `;

            const inner = document.createElement('div');
            inner.style.cssText = `
                position: absolute; inset: 0;
                transform: rotate(${angle}deg);
                /* Hào quang tinh linh Bọ đặc trưng (Xanh rêu -> Lục bảo Neon -> Lõi Bạch Kim) */
                filter: drop-shadow(0 0 ${3 * s}px ${c}) 
                        drop-shadow(0 0 ${8 * s}px #adff2f) 
                        drop-shadow(0 0 ${1.5 * s}px #fff);
                /* Áp dụng hiệu ứng trườn bò nhấp nhô */
                animation: bug-caterpillar-crawl 0.42s ease-in-out infinite;
                /* Lệch nhịp hoạt ảnh giữa các con sâu để nhìn tự nhiên hơn */
                animation-delay: -${Math.random() * 420}ms;
            `;

            // SVG chú sâu nhỏ phân đốt tròn béo ú siêu dễ thương kèm râu đầu lấp lánh
            inner.innerHTML = `
                <svg width="${w}" height="${h}" viewBox="0 0 60 30" style="overflow:visible;">
                    <defs>
                        <linearGradient id="bugGrad-${gid}" x1="0%" y1="0%" x2="100%" y2="0%">
                            <stop offset="0%" stop-color="#3c6116" stop-opacity="0.4"/>
                            <stop offset="35%" stop-color="${c}" stop-opacity="0.95"/>
                            <stop offset="75%" stop-color="#adff2f" stop-opacity="0.95"/>
                            <stop offset="100%" stop-color="#ffffff"/>
                        </linearGradient>
                    </defs>

                    <circle cx="12" cy="16" r="4.2" fill="url(#bugGrad-${gid})" />
                    <circle cx="20" cy="15" r="4.8" fill="url(#bugGrad-${gid})" />
                    <circle cx="28" cy="14.5" r="5.3" fill="url(#bugGrad-${gid})" />
                    <circle cx="36" cy="15" r="4.8" fill="url(#bugGrad-${gid})" />

                    <circle cx="44" cy="16" r="5.8" fill="url(#bugGrad-${gid})" />

                    <path d="M 45,11 Q 47,4 52,3 M 47,12 Q 51,6 56,7" stroke="#ffffff" stroke-width="1.5" stroke-linecap="round" fill="none"/>

                    <circle cx="45" cy="14" r="1.2" fill="#ffffff" />
                    <circle cx="45" cy="14" r="0.5" fill="#000000" />
                </svg>
            `;

            outer.appendChild(inner);
            return outer;
        };

        // Kích hoạt bùng nổ trận pháp bầy sâu nhỏ trườn bò toàn màn hình qua bộ lõi AOE của bạn
        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildBugSpirit,
            color: '#a8b820', // Sắc xanh đọt chuối/lục đặc trưng của hệ Bọ
            phase2: 'random', 
            count: 20,        // Tăng số lượng lên 20 con cho bầy sâu nhìn đông đúc, vui mắt
        });
    },
    async spawnGhost4(startEl, endEl, count, scale) {
        // Tự động thêm hiệu ứng hoạt ảnh lơ lửng chập chờn của linh hồn ma (chỉ chạy 1 lần)
        if (!document.getElementById('pkm-ghost-epic-keyframes')) {
            const style = document.createElement('style');
            style.id = 'pkm-ghost-epic-keyframes';
            style.textContent = `
                @keyframes ghost-spectral-wobble {
                    0%, 100% { transform: translateY(0) scale(1) rotate(0deg); opacity: 0.95; }
                    25% { transform: translateY(-6px) scaleX(0.93) scaleY(1.05) rotate(2deg); opacity: 0.6; }
                    50% { transform: translateY(2px) scale(1) rotate(-1deg); opacity: 0.9; }
                    75% { transform: translateY(-4px) scaleX(1.05) scaleY(0.95) rotate(1deg); opacity: 0.5; }
                }
            `;
            document.head.appendChild(style);
        }

        let uid = 0;
        const buildGhostSpirit = (x, y, s, c) => {
            // Thiết kế dáng đứng thon dài cho linh hồn lơ lửng
            const w = 42 * s, h = 52 * s;
            // Giữ độ nghiêng nhẹ tự nhiên khi bay thay vì xoay tròn 360 độ để bóng ma luôn hướng lên
            const angle = (Math.random() - 0.5) * 40; 
            const gid = `ghst-${Date.now()}-${uid++}`;

            const outer = document.createElement('div');
            outer.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${w}px; height:${h}px;
                pointer-events: none; z-index: 9998; opacity: 0;
            `;

            const inner = document.createElement('div');
            inner.style.cssText = `
                position: absolute; inset: 0;
                transform: rotate(${angle}deg);
                /* Hào quang bóng ma u linh (Tím ma -> Xanh Lục linh hồn -> Lõi Bạch Kim) */
                filter: drop-shadow(0 0 ${4 * s}px ${c}) 
                        drop-shadow(0 0 ${10 * s}px #00ffcc) 
                        drop-shadow(0 0 ${2 * s}px #fff);
                /* Áp dụng hiệu ứng chập chờn, lơ lửng ma mị */
                animation: ghost-spectral-wobble 0.7s ease-in-out infinite;
                animation-delay: -${Math.random() * 700}ms;
            `;

            // SVG Linh hồn ma uốn lượn kèm đôi mắt rực sáng huyền bí
            inner.innerHTML = `
                <svg width="${w}" height="${h}" viewBox="0 0 40 50" style="overflow:visible;">
                    <defs>
                        <linearGradient id="ghstGrad-${gid}" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stop-color="#ffffff"/>
                            <stop offset="25%" stop-color="#00ffcc" stop-opacity="0.95"/>
                            <stop offset="70%" stop-color="${c}" stop-opacity="0.85"/>
                            <stop offset="100%" stop-color="#1c0d30" stop-opacity="0"/>
                        </linearGradient>
                    </defs>

                    <path d="M 20,4 
                             C 33,4 35,16 33,26 
                             C 31,35 23,37 23,45 
                             C 23,49 20,49 20,45 
                             C 20,37 13,35 11,26 
                             C 9,16 7,4 20,4 Z" 
                          fill="url(#ghstGrad-${gid})" />

                    <ellipse cx="15" cy="17" rx="2" ry="3" fill="#ffffff" transform="rotate(-10 15 17)"/>
                    <ellipse cx="25" cy="17" rx="2" ry="3" fill="#ffffff" transform="rotate(10 25 17)"/>

                    <circle cx="15.5" cy="17" r="0.8" fill="#1c0d30"/>
                    <circle cx="24.5" cy="17" r="0.8" fill="#1c0d30"/>

                    <path d="M 6,22 Q 2,26 4,29" stroke="#00ffcc" stroke-width="1.2" fill="none" opacity="0.6"/>
                    <path d="M 34,22 Q 38,26 36,29" stroke="#00ffcc" stroke-width="1.2" fill="none" opacity="0.6"/>
                </svg>
            `;

            outer.appendChild(inner);
            return outer;
        };

        // Kích hoạt bùng nổ trận pháp ma mị, bay lượn lơ lửng toàn màn hình qua bộ lõi AOE của bạn
        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildGhostSpirit,
            color: '#705898', // Sắc tím đặc trưng huyền bí của hệ Ma
            phase2: 'random', 
            count: 16,
        });
    },
    async spawnSteel4(startEl, endEl, count, scale) {
        // Tự động inject hiệu ứng xoay tròn thuận/ngược chiều kim đồng hồ của bánh răng (chỉ chạy 1 lần)
        if (!document.getElementById('pkm-steel-epic-keyframes')) {
            const style = document.createElement('style');
            style.id = 'pkm-steel-epic-keyframes';
            style.textContent = `
                @keyframes steel-gear-spin-cw {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                @keyframes steel-gear-spin-ccw {
                    0% { transform: rotate(360deg); }
                    100% { transform: rotate(0deg); }
                }
            `;
            document.head.appendChild(style);
        }

        let uid = 0;
        const buildSteelSpirit = (x, y, s, c) => {
            // Ngẫu nhiên chọn loại bánh răng và hướng xoay để tạo sự đa dạng cơ khí
            const gearTypes = ['standard', 'heavy'];
            const kind = gearTypes[Math.floor(Math.random() * gearTypes.length)];
            const isClockwise = Math.random() > 0.5;

            // Kích thước vuông vắn cho bánh răng tròn
            const w = 45 * s, h = 45 * s;
            const gid = `steel-${Date.now()}-${uid++}`;

            const outer = document.createElement('div');
            outer.style.cssText = `
                position: fixed; left:${x}px; top:${y}px;
                width:${w}px; height:${h}px;
                pointer-events: none; z-index: 9998; opacity: 0;
            `;

            const inner = document.createElement('div');
            inner.style.cssText = `
                position: absolute; inset: 0;
                /* Hào quang kim loại lạnh toát (Xám thép -> Trắng bạc Bạch kim) */
                filter: drop-shadow(0 0 ${3 * s}px ${c}) 
                        drop-shadow(0 0 ${7 * s}px #e0e0e0) 
                        drop-shadow(0 0 ${1.5 * s}px #fff);
                /* Áp dụng hoạt ảnh xoay tròn tốc độ cao vô hạn */
                animation: ${isClockwise ? 'steel-gear-spin-cw' : 'steel-gear-spin-ccw'} 0.8s linear infinite;
            `;

            if (kind === 'standard') {
                // Mẫu 1: Bánh răng 8 răng tiêu chuẩn với các nan hoa đối xứng
                inner.innerHTML = `
                    <svg width="${w}" height="${h}" viewBox="0 0 50 50" style="overflow:visible;">
                        <defs>
                            <linearGradient id="stlGrad-${gid}" x1="0%" y1="0%" x2="100%" y2="100%">
                                <stop offset="0%" stop-color="#4a525a"/>
                                <stop offset="30%" stop-color="${c}"/>
                                <stop offset="70%" stop-color="#e1e4e6"/>
                                <stop offset="100%" stop-color="#ffffff"/>
                            </linearGradient>
                        </defs>
                        <rect x="21" y="2" width="8" height="46" rx="1.5" fill="url(#stlGrad-${gid})" />
                        <rect x="2" y="21" width="46" height="8" rx="1.5" fill="url(#stlGrad-${gid})" />
                        <rect x="21" y="2" width="8" height="46" rx="1.5" transform="rotate(45 25 25)" fill="url(#stlGrad-${gid})" />
                        <rect x="21" y="2" width="8" height="46" rx="1.5" transform="rotate(-45 25 25)" fill="url(#stlGrad-${gid})" />

                        <circle cx="25" cy="25" r="17" fill="url(#stlGrad-${gid})" stroke="#7f8c8d" stroke-width="1"/>

                        <circle cx="25" cy="25" r="6" fill="#1e272e" />
                        <circle cx="25" cy="25" r="4" fill="#000000" />
                    </svg>
                `;
            } else {
                // Mẫu 2: Bánh răng hạng nặng (Heavy Cogwheel) dày dặn và nhiều răng cưa hơn (12 răng)
                inner.innerHTML = `
                    <svg width="${w}" height="${h}" viewBox="0 0 50 50" style="overflow:visible;">
                        <defs>
                            <linearGradient id="stlGradH-${gid}" x1="10%" y1="0%" x2="90%" y2="100%">
                                <stop offset="0%" stop-color="#2c3e50"/>
                                <stop offset="40%" stop-color="${c}"/>
                                <stop offset="75%" stop-color="#dcdde1"/>
                                <stop offset="100%" stop-color="#ffffff"/>
                            </linearGradient>
                        </defs>
                        <rect x="20" y="1" width="10" height="48" rx="1" fill="url(#stlGradH-${gid})" />
                        <rect x="1" y="20" width="48" height="10" rx="1" fill="url(#stlGradH-${gid})" />
                        <rect x="20" y="1" width="10" height="48" rx="1" transform="rotate(30 25 25)" fill="url(#stlGradH-${gid})" />
                        <rect x="20" y="1" width="10" height="48" rx="1" transform="rotate(60 25 25)" fill="url(#stlGradH-${gid})" />
                        <rect x="20" y="1" width="10" height="48" rx="1" transform="rotate(-30 25 25)" fill="url(#stlGradH-${gid})" />
                        <rect x="20" y="1" width="10" height="48" rx="1" transform="rotate(-60 25 25)" fill="url(#stlGradH-${gid})" />

                        <circle cx="25" cy="25" r="18" fill="url(#stlGradH-${gid})" stroke="#57606f" stroke-width="1.5"/>
                        <circle cx="25" cy="25" r="12" fill="none" stroke="#ffffff" stroke-width="1" opacity="0.4"/>
                        <circle cx="25" cy="25" r="5" fill="#1e272e" />
                    </svg>
                `;
            }

            outer.appendChild(inner);
            return outer;
        };

        // Kích hoạt bùng nổ trận pháp mưa bánh răng cơ khí thép tràn màn hình qua bộ lõi AOE của bạn
        await this.playScreenSummonBurst(endEl, scale, {
            itemBuilder: buildSteelSpirit,
            color: '#b8b8d0', // Màu xám bạc đặc trưng của hệ Thép (Steel)
            phase2: 'random', 
            count: 16,
        });
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
