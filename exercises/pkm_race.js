/**
 * ==========================================
 * POKÉMON TEMPLE DASH — GAME LOGIC (kiểu Temple Run, giả lập phối cảnh 3D bằng Canvas 2D)
 * ==========================================
 * Luồng: giống hệt pkm_block.js ở phần "học từ vựng trước" (VocabularyModule),
 * chỉ khác phần "sân chơi" — thay vì xếp khối thì chạy vượt chướng ngại vật + ăn vàng.
 *
 * LƯU Ý QUAN TRỌNG: pkm_vocabulary.js (dùng chung, KHÔNG sửa) sau khi học xong
 * gọi cứng `window.startPokemonBattle()`. Vì vậy bên dưới ta vẫn đặt tên hàm
 * khởi động game là `window.startPokemonBattle` (dù thực chất nó khởi động
 * Temple Dash) để không phải đụng vào file gốc.
 *
 * KHÁC BIỆT SO VỚI pkm_block.js: pkm_block.js gọi quiz theo SỐ LƯỢT ĐẶT KHỐI
 * (3-4 lượt/câu). Ở đây quiz được gọi theo SỐ VÀNG ĐÃ ĂN (6-8 đồng/câu).
 *
 * Phần ghi điểm theo 4 kỹ năng + tổng điểm "Trò chơi" + EXP/DV nay dùng chung
 * window.PkmScore (file pkm_score.js, nạp TRƯỚC file này trong HTML) — Y HỆT
 * cách pkm_block.js đang làm, không có gì khác biệt ở phần này.
 */

window.RaceGame = {
    // ═══════════════════════════════════════════════════════════
    // CẤU HÌNH & KHÔNG GIAN ẢO (virtual resolution — luôn 720x1280 rồi co giãn bằng CSS)
    // ═══════════════════════════════════════════════════════════
    VW: 720,
    VH: 1280,
    LANES: [-1, 0, 1],
    MIN_QUESTIONS: 8,
    COLLIDE_T: 0.05,

    // 6 loại chướng ngại vật, 3 kiểu né khác nhau:
    //  - "jump"  : rock (đá tảng), spike (bẫy gai kim loại), chasm (hố lava)
    //  - "slide" : branch (cành cây/cổng gỗ), swarm (đàn quái bay)
    //  - "dodge" : wall (bức tường chắn 2/3 làn) — KHÔNG né được bằng nhảy/trượt,
    //              bắt buộc phải đứng đúng làn còn trống.
    OBSTACLE_ACTIONS: { rock: "jump", spike: "jump", chasm: "jump", branch: "slide", swarm: "slide", wall: "dodge" },

    HORIZON_Y: 430,
    ROAD_BOTTOM_Y: 1120,
    LANE_OFFSET_BOTTOM: 190,
    LANE_OFFSET_TOP: 24,
    PLAYER_Y: 1080,

    canvas: null,
    ctx: null,
    dpr: 1,
    cssW: 0,
    cssH: 0,

    // ── trạng thái ván chơi ──
    running: false,
    paused: false,
    gameOver: false,
    controlsLocked: false,
    rafId: null,
    lastTs: 0,

    coinsCollected: 0,
    score: 0,
    lives: 10,
    distance: 0,
    speed: 0.5, // đơn vị t/giây (tốc độ thế giới trôi qua nhân vật)
    BASE_SPEED: 0.5,
    MAX_SPEED: 1.35,

    correctCount: 0,
    wrongCount: 0,
    totalCount: 0,

    coinsSinceQuiz: 0,
    coinsUntilQuiz: 6,

    spawnTimer: 0.9,
    propTimer: 0.4,

    objects: [], // {kind:'coin'|'obstacle', lane, t, type, resolved, spin, overBarrier}
    sideProps: [], // {lane, t, kind}
    particles: [], // {x,y,vx,vy,life,maxLife,color,size,text}

    player: {
        lane: 0,
        xOff: 0, // vị trí x mượt hiện tại (lerp dần về lane target)
        jumping: false,
        jumpT: 0,
        JUMP_DUR: 0.62,
        sliding: false,
        slideT: 0,
        SLIDE_DUR: 0.55,
        hit: false,
        invulnT: 0,
        runCycle: 0,
        squash: 1,
    },

    shake: { t: 0, mag: 0 },

    characterUrl: "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/25.gif",
    characterImg: null,

    cachedSkyGrad: null,
    cachedRoadGrad: null,

    // ═══════════════════════════════════════════════════════════
    // ÂM THANH (Web Audio API tự tạo — copy phong cách pkm_block.js)
    // ═══════════════════════════════════════════════════════════
    _audioCtx: null,
    ensureAudioCtx() {
        if (!this._audioCtx) this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        if (this._audioCtx.state === "suspended") this._audioCtx.resume();
        return this._audioCtx;
    },
    playTone(freq, duration = 0.12, type = "sine", volume = 0.25, delay = 0) {
        try {
            const ctx = this.ensureAudioCtx();
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            osc.type = type;
            osc.frequency.value = freq;
            osc.connect(gain);
            gain.connect(ctx.destination);
            const startTime = ctx.currentTime + delay;
            gain.gain.setValueAtTime(volume, startTime);
            gain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
            osc.start(startTime);
            osc.stop(startTime + duration + 0.02);
        } catch (e) { /* im lặng nếu trình duyệt chặn audio */ }
    },
    playCoinSound() { this.playTone(880, 0.1, "triangle", 0.3, 0); this.playTone(1320, 0.12, "triangle", 0.28, 0.05); this.playTone(1760, 0.14, "sine", 0.22, 0.1); },
    playJumpSound() { this.playTone(440, 0.08, "square", 0.15, 0); this.playTone(660, 0.1, "square", 0.15, 0.06); },
    playSlideSound() { this.playTone(220, 0.14, "sawtooth", 0.14, 0); },
    playHitSound() { this.playTone(140, 0.22, "square", 0.28, 0); this.playTone(90, 0.25, "sawtooth", 0.22, 0.05); },
    playQuizChime() { this.playTone(784, 0.1, "sine", 0.22, 0); this.playTone(988, 0.1, "sine", 0.22, 0.09); this.playTone(1318, 0.18, "sine", 0.25, 0.18); },
    playGoSound() { this.playTone(523, 0.12, "sine", 0.25, 0); this.playTone(659, 0.12, "sine", 0.25, 0.12); this.playTone(784, 0.2, "sine", 0.28, 0.24); },
    playGameOverSound() { this.playTone(392, 0.2, "sawtooth", 0.2, 0); this.playTone(330, 0.2, "sawtooth", 0.2, 0.18); this.playTone(220, 0.35, "sawtooth", 0.2, 0.36); },

    // ═══════════════════════════════════════════════════════════
    // KHỞI TẠO
    // ═══════════════════════════════════════════════════════════
    async init() {
        console.log("🏃 [DEBUG] RaceGame.init() started");

        this.canvas = document.getElementById("raceCanvas");
        this.ctx = this.canvas.getContext("2d");
        this.resize();
        window.addEventListener("resize", () => this.resize());

        this.attachControls();

        if (window.QuizManager) window.QuizManager.prepareData();

        const quizOverlay = document.getElementById("quiz-overlay");
        if (quizOverlay) quizOverlay.style.display = "none";

        // Màn chọn cấp độ — giống hệt kiểu pkm_block.js
        const renderLevelSelect = (container) => {
            return new Promise((resolve) => {
                const LEVELS = [
                    { key: "de", emoji: "🟢", label: "Dễ", sub: "Hội thoại/đoạn văn ngắn" },
                    { key: "trung_binh", emoji: "🟡", label: "Trung bình", sub: "Độ dài vừa phải" },
                    { key: "kho", emoji: "🔴", label: "Khó", sub: "Hội thoại/đoạn văn dài" },
                ];
                container.innerHTML = `
                    <div style="text-align:center;">
                        <div style="font-size:17px;color:#FFCB05;font-weight:800;margin-bottom:18px;text-shadow:2px 2px 0 #000;">🏃 Chọn cấp độ Temple Dash!</div>
                        <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
                            ${LEVELS.map((lv) => `
                                <div class="race-level-card" data-level="${lv.key}">
                                    <div style="font-size:38px;">${lv.emoji}</div>
                                    <div style="font-weight:800;color:#FFCB05;margin-top:6px;font-size:16px;">${lv.label}</div>
                                    <div style="font-size:12px;color:#bbb;margin-top:4px;">${lv.sub}</div>
                                </div>`).join("")}
                        </div>
                    </div>`;
                container.querySelectorAll(".race-level-card").forEach((card) => {
                    card.onclick = () => {
                        localStorage.setItem("selected_level", card.dataset.level);
                        resolve(card.dataset.level);
                    };
                });
            });
        };

        // Tên hàm PHẢI là startPokemonBattle vì pkm_vocabulary.js gọi cứng tên này
        window.startPokemonBattle = async () => {
            console.log("🏃 Chọn cấp độ trước khi vào Temple Dash...");

            let mainCard = document.getElementById("mainCard");
            if (!mainCard) {
                mainCard = document.createElement("div");
                mainCard.id = "mainCard";
                document.body.appendChild(mainCard);
            }
            mainCard.style.cssText = `
                position: fixed; top:0; left:0; width:100vw; height:100dvh;
                background: radial-gradient(circle, #241143 0%, #0a0616 100%);
                z-index: 99999; display:flex; align-items:center; justify-content:center;
                padding:20px; box-sizing:border-box;
            `;
            mainCard.style.display = "flex";

            await renderLevelSelect(mainCard);
            mainCard.style.display = "none";

            if (window.QuizManager) {
                window.QuizManager.loadLevel();
                window.QuizManager.initSkillPools();
            }

            await this.pickRewardCharacter();
            this.showTapToStart();
        };

        if (window.VocabularyModule && typeof window.VocabularyModule.start === "function") {
            console.log("📘 [Race] Gọi VocabularyModule chạy phần học từ vựng...");
            await window.VocabularyModule.start();
        } else {
            console.warn("⚠️ Không tìm thấy VocabularyModule, tự động vào thẳng Temple Dash!");
            window.startPokemonBattle();
        }
    },

    // Lấy 1 Pokémon trong đội hình làm nhân vật chính chạy (bản GIF hoạt hình), fallback Pikachu
    async pickRewardCharacter() {
        let id = 25;
        try {
            const inv = JSON.parse(localStorage.getItem("pkm_inventory")) || [];
            const team = inv.filter((p) => p.inTeam).sort((a, b) => a.position - b.position);
            if (team.length > 0) id = team[0].id;
        } catch (e) { /* dùng fallback Pikachu */ }
        this.characterUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/${id}.gif`;
        this.characterImg = new Image();
        this.characterImg.crossOrigin = "anonymous";
        await new Promise((resolve) => {
            this.characterImg.onload = resolve;
            this.characterImg.onerror = () => {
                this.characterUrl = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/back/25.gif";
                this.characterImg.src = this.characterUrl;
                resolve();
            };
            this.characterImg.src = this.characterUrl;
        });
    },

    // ═══════════════════════════════════════════════════════════
    // CANVAS RESIZE (giữ tỉ lệ 720:1280 luôn khớp mọi màn hình)
    // ═══════════════════════════════════════════════════════════
    resize() {
        const stage = document.getElementById("race-stage");
        const wrapW = Math.max(1, stage.clientWidth);
        const wrapH = Math.max(1, stage.clientHeight);

        // FULL-BLEED: canvas luôn phủ kín đúng kích thước khung chứa (không
        // còn viền đen 2 bên) — bí quyết là để CHIỀU RỘNG ẢO (this.VW) co
        // giãn theo đúng tỉ lệ khung hình thật của máy, còn CHIỀU CAO ẢO
        // (this.VH) giữ cố định. Vì tỉ lệ ảo == tỉ lệ CSS thật nên ảnh không
        // hề bị kéo méo. Kết quả: điện thoại (dọc, hẹp) thấy đường chạy gần
        // và chật, còn PC/màn ngang (rộng) thấy thêm khung cảnh 2 bên đường
        // — đúng cảm giác "PC khác, mobile khác" mà vẫn luôn full màn hình.
        this.cssW = wrapW; this.cssH = wrapH;
        this.canvas.style.width = wrapW + "px";
        this.canvas.style.height = wrapH + "px";

        this.VH = 1280;
        this.VW = Math.round(this.VH * (wrapW / wrapH));

        // Làn đường co giãn nhẹ theo bề rộng ảo nhưng có trần (210) — để
        // trên màn hình siêu rộng, đường chạy không phình to vô lý; phần dư
        // ra 2 bên sẽ tự hiện thêm cây/trụ đá trang trí (sideProps).
        this.LANE_OFFSET_BOTTOM = Math.min(210, this.VW * 0.26);
        this.LANE_OFFSET_TOP = this.LANE_OFFSET_BOTTOM * 0.126;

        // Giới hạn devicePixelRatio tối đa 2x — màn hình điện thoại "retina"
        // có dpr tới 3, nếu không giới hạn thì canvas phải vẽ gấp ĐÔI số
        // pixel cần thiết mỗi khung hình, rất nặng trên máy yếu mà mắt gần
        // như không thấy khác biệt so với 2x.
        this.dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = Math.round(this.VW * this.dpr);
        this.canvas.height = Math.round(this.VH * this.dpr);
        this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
        this.buildCachedGradients();
    },

    buildCachedGradients() {
        const ctx = this.ctx;
        const sky = ctx.createLinearGradient(0, 0, 0, this.HORIZON_Y + 60);
        sky.addColorStop(0, "#160a2e");
        sky.addColorStop(0.45, "#4c2270");
        sky.addColorStop(0.8, "#a4477a");
        sky.addColorStop(1, "#ff8c42");
        this.cachedSkyGrad = sky;

        const road = ctx.createLinearGradient(0, this.HORIZON_Y, 0, this.ROAD_BOTTOM_Y + 120);
        road.addColorStop(0, "#3a3350");
        road.addColorStop(1, "#5b5270");
        this.cachedRoadGrad = road;

        // Các gradient toả sáng này KHÔNG đổi hình dạng giữa các khung hình
        // (chỉ tịnh tiến theo translate) -> dựng sẵn 1 LẦN ở đây, tránh gọi
        // createRadialGradient() 60 lần/giây — đây chính là 1 nguyên nhân
        // lớn gây giật/lag trên điện thoại yếu.
        const moonX = this.VW * 0.78, moonY = 150;
        const moonGlow = ctx.createRadialGradient(moonX, moonY, 4, moonX, moonY, 90);
        moonGlow.addColorStop(0, "rgba(255,240,190,0.9)");
        moonGlow.addColorStop(1, "rgba(255,240,190,0)");
        this.cachedMoonGlow = moonGlow;

        const vign = ctx.createRadialGradient(this.VW / 2, this.VH * 0.42, this.VH * 0.35, this.VW / 2, this.VH * 0.42, this.VH * 0.75);
        vign.addColorStop(0, "rgba(0,0,0,0)");
        vign.addColorStop(1, "rgba(0,0,0,0.45)");
        this.cachedVignette = vign;

        const pGlow = ctx.createRadialGradient(0, 20, 10, 0, 20, 90);
        pGlow.addColorStop(0, "rgba(255,203,5,0.35)");
        pGlow.addColorStop(1, "rgba(255,203,5,0)");
        this.cachedPlayerGlow = pGlow;
    },

    // ═══════════════════════════════════════════════════════════
    // MÀN "CHẠM ĐỂ BẮT ĐẦU" + ĐẾM NGƯỢC
    // ═══════════════════════════════════════════════════════════
    showTapToStart() {
        const layer = document.getElementById("race-overlay-layer");
        layer.className = "show";
        layer.innerHTML = `
            <div id="tapStartCard">
                <div id="tapStartBtn"></div>
                <div class="tap-label">Chạm để bắt đầu!</div>
            </div>`;
        this.renderIdleFrame();
        document.getElementById("tapStartBtn").onclick = () => {
            this.ensureAudioCtx();
            layer.className = "";
            layer.innerHTML = "";
            this.runCountdown();
        };
    },

    renderIdleFrame() {
        this.resetRunState();
        this.drawScene(0);
    },

    runCountdown() {
        const layer = document.getElementById("race-overlay-layer");
        layer.className = "show";
        const seq = ["3", "2", "1", "GO!"];
        let i = 0;
        const step = () => {
            layer.innerHTML = "";
            const el = document.createElement("div");
            el.className = seq[i] === "GO!" ? "go-text" : "countdown-num";
            el.innerText = seq[i];
            layer.appendChild(el);
            this.playTone(seq[i] === "GO!" ? 880 : 523, 0.15, "sine", 0.22, 0);
            i++;
            if (i < seq.length) {
                setTimeout(step, 700);
            } else {
                setTimeout(() => {
                    layer.className = "";
                    layer.innerHTML = "";
                    this.playGoSound();
                    this.startPlaying();
                }, 650);
            }
        };
        step();
    },

    // ═══════════════════════════════════════════════════════════
    // BẮT ĐẦU / VÒNG LẶP CHÍNH
    // ═══════════════════════════════════════════════════════════
    resetRunState() {
        this.player.lane = 0;
        this.player.xOff = 0;
        this.player.jumping = false; this.player.jumpT = 0;
        this.player.sliding = false; this.player.slideT = 0;
        this.player.hit = false; this.player.invulnT = 0;
        this.player.runCycle = 0; this.player.squash = 1;
        this.objects = [];
        this.sideProps = [];
        this.particles = [];
        this.spawnTimer = 0.6;
        this.propTimer = 0.2;
    },

    startPlaying() {
        this.resetRunState();
        this.running = true;
        this.paused = false;
        this.gameOver = false;
        this.controlsLocked = false;
        this.coinsCollected = 0;
        this.score = 0;
        this.lives = 10;
        this.distance = 0;
        this.speed = this.BASE_SPEED;
        this.correctCount = 0; this.wrongCount = 0; this.totalCount = 0;
        this.coinsSinceQuiz = 0;
        this.coinsUntilQuiz = this.randomCoinThreshold();
        this.updateHUD();
        document.getElementById("race-controls").classList.remove("locked");

        this.lastTs = performance.now();
        if (!this._boundLoop) this._boundLoop = this.gameLoopStep.bind(this);
        this.rafId = requestAnimationFrame(this._boundLoop);
    },

    // Vòng lặp chính. QUAN TRỌNG: khi this.paused = true (đang mở quiz) thì
    // KHÔNG tự xin thêm khung hình nữa — dừng hẳn requestAnimationFrame,
    // giống hệt cách pkm_block.js dừng hẳn xử lý khi mở quiz, thay vì vẫn
    // phải vẽ lại toàn bộ canvas 60 lần/giây phía sau lớp quiz-overlay mờ
    // (backdrop-filter) — đây là nguyên nhân chính gây đơ/giật khi quiz mở
    // và cũng giúp máy yếu đỡ hao pin/CPU hơn nhiều.
    gameLoopStep(ts) {
        if (!this.running) return;
        let dt = (ts - this.lastTs) / 1000;
        this.lastTs = ts;
        if (dt > 0.05) dt = 0.05; // chống giật khung hình khi tab bị treo
        if (!this.paused && !this.gameOver) this.update(dt);
        this.drawScene(dt);
        if (!this.paused && !this.gameOver) {
            this.rafId = requestAnimationFrame(this._boundLoop);
        }
        // Nếu paused/gameOver -> KHÔNG gọi requestAnimationFrame nữa, vòng
        // lặp dừng hẳn tại đây. Muốn chạy lại phải tự gọi
        // requestAnimationFrame(this._boundLoop) ở nơi khác (xem onQuizAnswered()).
    },

    randomCoinThreshold() { return 20; }, // số vàng gọi quiz

    // ═══════════════════════════════════════════════════════════
    // CẬP NHẬT MỖI KHUNG HÌNH
    // ═══════════════════════════════════════════════════════════
    update(dt) {
        // tăng dần độ khó theo quãng đường
        this.distance += this.speed * dt * 40;
        this.speed = Math.min(this.MAX_SPEED, this.BASE_SPEED + this.distance * 0.00035);
        this.score = this.coinsCollected * 10 + Math.floor(this.distance);

        this.updatePlayer(dt);
        this.updateSpawns(dt);
        this.updateObjects(dt);
        this.updateSideProps(dt);
        this.updateParticles(dt);

        if (this.shake.t > 0) { this.shake.t -= dt; if (this.shake.t < 0) this.shake.t = 0; }

        this.updateHUD();
    },

    updatePlayer(dt) {
        const p = this.player;
        // di chuyển mượt sang lane mục tiêu
        const targetX = p.lane * this.LANE_OFFSET_BOTTOM;
        p.xOff += (targetX - p.xOff) * Math.min(1, dt * 12);

        p.runCycle += dt * (6 + this.speed * 4);

        if (p.jumping) {
            p.jumpT += dt / p.JUMP_DUR;
            if (p.jumpT >= 1) { p.jumpT = 0; p.jumping = false; }
        }
        if (p.sliding) {
            p.slideT += dt / p.SLIDE_DUR;
            if (p.slideT >= 1) { p.slideT = 0; p.sliding = false; }
        }
        if (p.invulnT > 0) { p.invulnT -= dt; if (p.invulnT < 0) p.invulnT = 0; }
    },

    updateSpawns(dt) {
        this.spawnTimer -= dt;
        if (this.spawnTimer <= 0) {
            this.spawnWave();
            const desiredGap = 0.85 + Math.random() * 0.55;
            this.spawnTimer = Math.max(0.55, desiredGap / this.speed);
        }
        this.propTimer -= dt;
        if (this.propTimer <= 0) {
            this.spawnSideProp();
            this.propTimer = 0.35 + Math.random() * 0.4;
        }
    },

    spawnSideProp() {
        const lane = Math.random() < 0.5 ? -1 : 1;
        const kinds = ["tree", "pillar", "crystal"];
        this.sideProps.push({
            lane: lane * (1.75 + Math.random() * 0.5),
            t: 1.08,
            kind: kinds[Math.floor(Math.random() * kinds.length)],
            jitter: Math.random() * 40 - 20,
        });
    },

    spawnWave() {
        const roll = Math.random();
        if (roll < 0.28) {
            this.spawnCoinLine();
        } else if (roll < 0.42) {
            this.spawnCoinLine();
            this.spawnSingleObstacle();
        } else if (roll < 0.66) {
            this.spawnSingleObstacle();
        } else if (roll < 0.85) {
            this.spawnBarrier();
        } else {
            this.spawnWallGap();
        }
    },

    spawnCoinLine() {
        const lane = this.LANES[Math.floor(Math.random() * this.LANES.length)];
        const count = 4 + Math.floor(Math.random() * 3);
        for (let i = 0; i < count; i++) {
            this.objects.push({ kind: "coin", lane, t: 1.05 + i * 0.055, resolved: false, spin: Math.random() * 10 });
        }
    },

    spawnSingleObstacle() {
        const lane = this.LANES[Math.floor(Math.random() * this.LANES.length)];
        const pool = ["rock", "spike", "branch", "swarm"];
        const type = pool[Math.floor(Math.random() * pool.length)];
        this.objects.push({ kind: "obstacle", lane, t: 1.08, type, resolved: false, spanAll: false, spin: Math.random() * 10 });
        // thưởng vàng ở 1 lane an toàn bên cạnh để khuyến khích đổi lane
        if (Math.random() < 0.6) {
            const safeLanes = this.LANES.filter((l) => l !== lane);
            const safeLane = safeLanes[Math.floor(Math.random() * safeLanes.length)];
            for (let i = 0; i < 3; i++) {
                this.objects.push({ kind: "coin", lane: safeLane, t: 1.08 + i * 0.05, resolved: false, spin: Math.random() * 10 });
            }
        }
    },

    spawnBarrier() {
        const pool = ["rock", "spike", "chasm", "branch", "swarm"];
        const type = pool[Math.floor(Math.random() * pool.length)];
        const action = this.OBSTACLE_ACTIONS[type];
        this.objects.push({ kind: "obstacle", lane: 0, t: 1.1, type, resolved: false, spanAll: true, spin: Math.random() * 10 });
        // vàng thưởng ngay tại chỗ, chỉ ăn được nếu thực hiện đúng động tác (nhảy/trượt)
        this.LANES.forEach((lane) => {
            this.objects.push({
                kind: "coin", lane, t: 1.1, resolved: false, spin: Math.random() * 10,
                overBarrier: action === "jump",
                underBarrier: action === "slide",
            });
        });
    },

    // Chướng ngại MỚI: bức tường cổ chắn 2/3 làn, chỉ chừa lại đúng 1 làn
    // trống — không né được bằng nhảy/trượt, buộc người chơi phải ĐỔI LÀN
    // sang đúng chỗ trống trước khi va tới.
    spawnWallGap() {
        const freeLane = this.LANES[Math.floor(Math.random() * this.LANES.length)];
        const blockedLanes = this.LANES.filter((l) => l !== freeLane);
        this.objects.push({ kind: "obstacle", type: "wall", lane: freeLane, blockedLanes, t: 1.12, resolved: false, spanAll: false });
        // vàng dẫn đường ngay tại làn trống để gợi ý hướng né
        for (let i = 0; i < 3; i++) {
            this.objects.push({ kind: "coin", lane: freeLane, t: 1.12 + i * 0.05, resolved: false, spin: Math.random() * 10 });
        }
    },

    updateObjects(dt) {
        const remain = [];
        for (const obj of this.objects) {
            obj.t -= this.speed * dt;
            if (obj.spin !== undefined) obj.spin += dt * 6;
            if (!obj.resolved && Math.abs(obj.t) < this.COLLIDE_T) {
                this.resolveCollision(obj);
            }
            if (obj.t > -0.12) remain.push(obj);
        }
        this.objects = remain;
    },

    updateSideProps(dt) {
        const remain = [];
        for (const sp of this.sideProps) {
            sp.t -= this.speed * dt;
            if (sp.t > -0.12) remain.push(sp);
        }
        this.sideProps = remain;
    },

    updateParticles(dt) {
        const remain = [];
        for (const pt of this.particles) {
            pt.life -= dt;
            pt.x += pt.vx * dt;
            pt.y += pt.vy * dt;
            pt.vy += (pt.gravity || 0) * dt;
            if (pt.life > 0) remain.push(pt);
        }
        this.particles = remain;
    },

    // ═══════════════════════════════════════════════════════════
    // VA CHẠM
    // ═══════════════════════════════════════════════════════════
    resolveCollision(obj) {
        const p = this.player;

        if (obj.kind === "coin") {
            if (obj.lane !== p.lane) { obj.resolved = true; return; }
            if (obj.overBarrier && !p.jumping) { obj.resolved = true; return; }
            if (obj.underBarrier && !p.sliding) { obj.resolved = true; return; }
            obj.resolved = true;
            this.collectCoin(obj);
            return;
        }

        // obstacle — "covered" = người chơi đang ở làn bị chướng ngại này che
        const covered = obj.spanAll || (obj.blockedLanes ? obj.blockedLanes.includes(p.lane) : obj.lane === p.lane);
        if (!covered) { obj.resolved = true; return; }
        obj.resolved = true;
        if (p.invulnT > 0) return; // đang bất tử sau va chạm trước đó

        const action = this.OBSTACLE_ACTIONS[obj.type] || "jump";
        // "dodge" (bức tường đổi làn) không có cách né nào ngoài việc đứng
        // đúng làn trống ngay từ đầu — nếu đã "covered" thì luôn va chạm.
        const avoided =
            (action === "jump" && p.jumping) ||
            (action === "slide" && p.sliding);
        if (!avoided) this.hitObstacle(obj);
    },

    collectCoin(obj) {
        this.coinsCollected++;
        this.coinsSinceQuiz++;
        this.playCoinSound();
        const pos = this.projectPlayerPoint();
        this.spawnBurst(pos.x, pos.y - 20, "#ffd54f", 8);
        this.spawnFloatText(pos.x, pos.y - 40, "+10", "#ffd54f");

        if (this.coinsSinceQuiz >= this.coinsUntilQuiz) {
            this.coinsSinceQuiz = 0;
            this.coinsUntilQuiz = this.randomCoinThreshold();
            this.triggerQuiz();
        }
    },

    hitObstacle(obj) {
        this.lives = Math.max(0, this.lives - 1);
        this.player.hit = true;
        this.player.invulnT = 1.3;
        this.shake.t = 0.35; this.shake.mag = 16;
        this.playHitSound();
        const pos = this.projectPlayerPoint();
        this.spawnBurst(pos.x, pos.y - 30, "#ff6b6b", 12);
        this.spawnFloatText(pos.x, pos.y - 50, "-1 ❤️", "#ff6b6b");
        this.updateHeartsUI();
        setTimeout(() => { this.player.hit = false; }, 260);
        this.checkGameOver();
    },

    spawnBurst(x, y, color, count) {
        for (let i = 0; i < count; i++) {
            const ang = Math.random() * Math.PI * 2;
            const spd = 60 + Math.random() * 120;
            this.particles.push({
                x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd - 40,
                gravity: 260, life: 0.5 + Math.random() * 0.3, maxLife: 0.8,
                color, size: 3 + Math.random() * 3,
            });
        }
    },

    spawnFloatText(x, y, text, color) {
        this.particles.push({ x, y, vx: 0, vy: -55, gravity: 40, life: 0.9, maxLife: 0.9, color, text, size: 20 });
    },

    // ═══════════════════════════════════════════════════════════
    // QUIZ THEO SỐ VÀNG ĐÃ ĂN
    // ═══════════════════════════════════════════════════════════
    triggerQuiz() {
        if (this.gameOver) return;
        this.paused = true;
        this.controlsLocked = true;
        document.getElementById("race-controls").classList.add("locked");
        this.playQuizChime();

        const banner = document.getElementById("quiz-intro-banner");
        banner.classList.add("show");
        setTimeout(() => { banner.classList.remove("show"); }, 900);

        setTimeout(() => {
            if (window.QuizManager) {
                window.QuizManager.ask((isCorrect) => this.onQuizAnswered(isCorrect));
            } else {
                this.onQuizAnswered(true);
            }
        }, 750);
    },

    onQuizAnswered(isCorrect) {
        if (window.PkmScore) window.PkmScore.recordAnswer(isCorrect);

        this.totalCount++;
        if (isCorrect) this.correctCount++; else this.wrongCount++;
        this.updateHUD();

        this.paused = false;
        this.controlsLocked = false;
        document.getElementById("race-controls").classList.remove("locked");
        this.lastTs = performance.now(); // tránh dt khổng lồ ngay sau khi resume

        if (!isCorrect) {
            // Phạt khi trả lời sai: mất 1 mạng, mô phỏng va vấp
            this.player.invulnT = 0.1;
            this.hitObstacle({ type: "penalty" });
        } else {
            const pos = this.projectPlayerPoint();
            this.spawnFloatText(pos.x, pos.y - 60, "🎉 Chuẩn!", "#2ecc71");
        }

        const isOver = this.checkGameOver();
        // gameLoopStep() đã tự dừng hẳn khi paused=true ở trên -> phải chủ
        // động khởi động lại tại đây, TRỪ KHI ván đấu vừa kết thúc (lúc đó
        // checkGameOver() đã tự huỷ rAF và gọi handleMatchEnd()).
        if (!isOver) {
            this.lastTs = performance.now();
            this.rafId = requestAnimationFrame(this._boundLoop);
        }
    },

    // ═══════════════════════════════════════════════════════════
    // ĐIỀU KHIỂN
    // ═══════════════════════════════════════════════════════════
    attachControls() {
        const doLeft = () => this.moveLane(-1);
        const doRight = () => this.moveLane(1);
        const doJump = () => this.jumpAction();
        const doSlide = () => this.slideAction();

        document.getElementById("btnLeft").addEventListener("click", doLeft);
        document.getElementById("btnRight").addEventListener("click", doRight);
        document.getElementById("btnJump").addEventListener("click", doJump);
        document.getElementById("btnSlide").addEventListener("click", doSlide);

        window.addEventListener("keydown", (e) => {
            if (this.controlsLocked || !this.running || this.gameOver) return;
            if (e.key === "ArrowLeft" || e.key === "a") doLeft();
            else if (e.key === "ArrowRight" || e.key === "d") doRight();
            else if (e.key === "ArrowUp" || e.key === " " || e.key === "w") doJump();
            else if (e.key === "ArrowDown" || e.key === "s") doSlide();
        });

        // Cử chỉ vuốt trên canvas
        let touchStartX = 0, touchStartY = 0, touchActive = false;
        const stage = document.getElementById("race-stage");
        stage.addEventListener("touchstart", (e) => {
            if (this.controlsLocked) return;
            const t = e.changedTouches[0];
            touchStartX = t.clientX; touchStartY = t.clientY; touchActive = true;
        }, { passive: true });
        stage.addEventListener("touchend", (e) => {
            if (!touchActive || this.controlsLocked) return;
            touchActive = false;
            const t = e.changedTouches[0];
            const dx = t.clientX - touchStartX;
            const dy = t.clientY - touchStartY;
            const absX = Math.abs(dx), absY = Math.abs(dy);
            const THRESH = 28;
            if (Math.max(absX, absY) < THRESH) return;
            if (absX > absY) { dx > 0 ? doRight() : doLeft(); }
            else { dy > 0 ? doSlide() : doJump(); }
        }, { passive: true });
    },

    moveLane(dir) {
        if (this.controlsLocked || !this.running || this.gameOver) return;
        const idx = this.LANES.indexOf(this.player.lane);
        const next = Math.max(0, Math.min(this.LANES.length - 1, idx + dir));
        this.player.lane = this.LANES[next];
    },

    jumpAction() {
        if (this.controlsLocked || !this.running || this.gameOver) return;
        if (this.player.jumping || this.player.sliding) return;
        this.player.jumping = true;
        this.player.jumpT = 0;
        this.playJumpSound();
    },

    slideAction() {
        if (this.controlsLocked || !this.running || this.gameOver) return;
        if (this.player.jumping || this.player.sliding) return;
        this.player.sliding = true;
        this.player.slideT = 0;
        this.playSlideSound();
    },

    // ═══════════════════════════════════════════════════════════
    // HUD
    // ═══════════════════════════════════════════════════════════
    updateHUD() {
        const coinsEl = document.getElementById("coinsValue");
        const scoreEl = document.getElementById("scoreValue");
        if (coinsEl) coinsEl.innerText = this.coinsCollected;
        if (scoreEl) scoreEl.innerText = this.score;
        const stats = document.getElementById("quiz-stats");
        if (stats) stats.innerHTML = `✅ ${this.correctCount} &nbsp; ❌ ${this.wrongCount} &nbsp; 📊 ${this.totalCount} câu`;
    },

    updateHeartsUI() {
        document.querySelectorAll("#heartsBox .heart-icon").forEach((el, i) => {
            el.classList.toggle("heart-lost", i >= this.lives);
        });
    },

    // ═══════════════════════════════════════════════════════════
    // KẾT THÚC GAME
    // ═══════════════════════════════════════════════════════════
    checkGameOver() {
        if (this.gameOver) return true;
        if (this.lives <= 0) {
            this.gameOver = true;
            this.running = false;
            if (this.rafId) cancelAnimationFrame(this.rafId);
            this.playGameOverSound();
            setTimeout(() => this.handleMatchEnd(), 500);
            return true;
        }
        return false;
    },

    async getRewardImage() {
        try {
            const inv = JSON.parse(localStorage.getItem("pkm_inventory")) || [];
            const team = inv.filter((p) => p.inTeam).sort((a, b) => a.position - b.position);
            if (team.length > 0) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${team[0].id}.png`;
        } catch (e) { /* ignore */ }
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png`;
    },

    handleMatchEnd() {
        if (!window.PkmScore) {
            console.error('❌ PkmScore chưa được nạp — thiếu <script src="pkm_score.js"> trong pkm_race.html (phải đặt TRƯỚC thẻ <script src="pkm_race.js">)?');
            return;
        }

        const enoughQuestions = this.totalCount >= this.MIN_QUESTIONS;
        const result = window.PkmScore.finishMatch({
            won: enoughQuestions,
            minQuestions: this.MIN_QUESTIONS,
        });

        const titleEl = document.getElementById("victory-title-text");
        const expText = document.getElementById("victory-exp-text");

        if (result.skipped) {
            this.getRewardImage().then((src) => {
                const img = document.getElementById("victory-pkm-img");
                if (img) { img.src = src; img.style.filter = "grayscale(100%) opacity(0.7)"; }
            });
            if (titleEl) {
                titleEl.innerText = "💥 HẾT MẠNG RỒI!";
                titleEl.style.color = "#e74c3c";
                titleEl.style.textShadow = "0 0 30px #e74c3c, 0 0 60px #c0392b";
            }
            if (expText) {
                expText.innerHTML = `
                    <div style="color:#ccc; margin-bottom:14px;">Chuyến chạy kết thúc quá sớm!</div>
                    <div style="font-size:13px; color:#ff9f43; margin-bottom:10px;">
                        Ván này mới trả lời ${this.totalCount}/${this.MIN_QUESTIONS} câu tối thiểu nên
                        chưa được tính điểm hay thưởng.
                    </div>
                    <div style="font-size:12px; color:#ffbc00;">Chơi lại và trả lời đủ ${this.MIN_QUESTIONS} câu để được ghi nhận nhé!</div>`;
            }
            const overlay = document.getElementById("victory-overlay");
            if (overlay) overlay.style.display = "flex";
            return;
        }

        this.getRewardImage().then((src) => {
            const img = document.getElementById("victory-pkm-img");
            if (img) img.src = src;
        });

        if (titleEl) titleEl.innerText = "🏆 VỀ ĐÍCH!";

        const messages = (result.breakdown || []).map((b) => {
            if (b.type === "new_lesson") return `🌟 BÀI MỚI HOÀN THÀNH (${b.accuracy}% đúng): <b>+${b.exp} KN +${b.dv} DV</b>`;
            if (b.type === "new_lesson_failed") return `⚠️ Bài mới nhưng chỉ ${b.accuracy}% đúng — cần ≥${b.requiredAccuracy}% để mở khoá!`;
            if (b.type === "correct_answers") return `📝 ${b.correctCount} câu đúng ÷ ${b.divisor} = <b>+${b.exp} KN +${b.dv} DV</b>`;
            if (b.type === "streak") return b.exp > 0 ? `🔥 Chuỗi ${b.streak} ngày liên tục: <b>+${b.exp} KN +${b.dv} DV</b>` : `📅 Chuỗi hiện tại: <b>${b.streak} ngày</b>`;
            return "";
        }).filter(Boolean);

        const skillOrder = window.PkmScore.SKILL_ORDER;
        const skillStatsNow = window.PkmScore.session.skillStats;
        const skillLines = skillOrder.map((s) => {
            const st = skillStatsNow[s] || { correct: 0, total: 0 };
            const label = { listening: "🎧 Nghe", speaking: "🗣️ Nói", reading: "📖 Đọc", writing: "✍️ Viết" }[s];
            return `<div>${label}: ${st.correct}/${st.total}</div>`;
        }).join("");

        if (expText) {
            expText.innerHTML = `
                <div style="font-size:13px; text-align:left; margin-bottom:12px; line-height:2;">
                    ${messages.map((m) => `<div>${m}</div>`).join("")}
                </div>
                <div style="border-top:1px solid #444; padding-top:10px; margin-bottom:12px;">
                    <div style="color:#4caf50; font-size:16px; font-weight:bold;">+${result.bonusEXP} KN &nbsp; +${result.bonusDV} DV</div>
                    <div style="color:#aaa; font-size:12px;">Tổng: ${result.newEXP} KN | ${result.newDV} DV</div>
                </div>
                <div style="color:#aaa; font-size:12px; margin-bottom:4px;">
                    🪙 Vàng thu được: ${this.coinsCollected} &nbsp; | &nbsp; 🏁 Quãng đường: ${Math.floor(this.distance)}m &nbsp; | &nbsp; ⭐ Điểm: ${this.score}
                </div>
                <div style="color:#aaa; font-size:12px; margin-bottom:8px;">
                    📊 Tổng: ✅ ${this.correctCount} đúng / ❌ ${this.wrongCount} sai / ${this.totalCount} câu
                </div>
                <div style="color:#8fa3d1; font-size:11px; text-align:left;">
                    ${skillLines}
                </div>`;
        }

        const overlay = document.getElementById("victory-overlay");
        if (overlay) overlay.style.display = "flex";
    },

    // ═══════════════════════════════════════════════════════════
    // PHỐI CẢNH GIẢ 3D (chiếu 1 điểm lane/t ra toạ độ màn hình)
    // ═══════════════════════════════════════════════════════════
    project(lane, t) {
        const f = Math.max(0, Math.min(1, t)) ** 1.6;
        const centerX = this.VW / 2;
        const laneOffset = this.LANE_OFFSET_BOTTOM + (this.LANE_OFFSET_TOP - this.LANE_OFFSET_BOTTOM) * f;
        const x = centerX + lane * laneOffset;
        const y = this.ROAD_BOTTOM_Y + (this.HORIZON_Y - this.ROAD_BOTTOM_Y) * f;
        const scale = 1 + (0.12 - 1) * f;
        return { x, y, scale, f };
    },

    // Trả về toạ độ trong KHÔNG GIAN ẢO (VWxVH) — khớp hệ toạ độ mà drawScene()
    // đang dùng cho mọi thứ khác (KHÔNG quy đổi ra px CSS, tránh lệch vị trí particle).
    projectPlayerPoint() {
        return { x: this.VW / 2 + this.player.xOff, y: this.PLAYER_Y - 60 };
    },

    // ═══════════════════════════════════════════════════════════
    // VẼ TOÀN CẢNH
    // ═══════════════════════════════════════════════════════════
    drawScene(dt) {
        const ctx = this.ctx;
        ctx.save();
        ctx.clearRect(0, 0, this.VW, this.VH);

        if (this.shake.t > 0) {
            const m = this.shake.mag * (this.shake.t / 0.35);
            ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
        }

        this.drawSky();
        this.drawRoad();

        // gộp props + objects rồi vẽ theo thứ tự xa->gần
        const drawList = [];
        this.sideProps.forEach((sp) => drawList.push({ ref: sp, isProp: true }));
        this.objects.forEach((o) => drawList.push({ ref: o, isProp: false }));
        drawList.sort((a, b) => b.ref.t - a.ref.t);
        drawList.forEach((item) => {
            if (item.isProp) this.drawSideProp(item.ref);
            else this.drawObject(item.ref);
        });

        this.drawPlayer();
        this.drawParticles();
        this.drawVignette();

        ctx.restore();
    },

    drawSky() {
        const ctx = this.ctx;
        ctx.fillStyle = this.cachedSkyGrad || "#241143";
        ctx.fillRect(0, 0, this.VW, this.HORIZON_Y + 40);

        // vầng trăng phát sáng
        const moonX = this.VW * 0.78, moonY = 150;
        ctx.fillStyle = this.cachedMoonGlow || "rgba(255,240,190,0.5)";
        ctx.beginPath(); ctx.arc(moonX, moonY, 90, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#fff6d8";
        ctx.beginPath(); ctx.arc(moonX, moonY, 34, 0, Math.PI * 2); ctx.fill();

        // dãy đền cổ xa xa (silhouette)
        ctx.fillStyle = "#241132";
        const baseY = this.HORIZON_Y - 10;
        for (let i = 0; i < 6; i++) {
            const bx = (i * 140 - 60 + (this.distance * 6) % 140) % (this.VW + 200) - 100;
            const bh = 60 + (i % 3) * 30;
            ctx.fillRect(bx, baseY - bh, 46, bh);
            ctx.beginPath();
            ctx.moveTo(bx - 6, baseY - bh);
            ctx.lineTo(bx + 23, baseY - bh - 26);
            ctx.lineTo(bx + 52, baseY - bh);
            ctx.closePath();
            ctx.fill();
            // ánh đèn cửa sổ
            ctx.fillStyle = "rgba(255,203,5,0.55)";
            ctx.fillRect(bx + 16, baseY - bh + 14, 10, 12);
            ctx.fillStyle = "#241132";
        }
    },

    drawRoad() {
        const ctx = this.ctx;
        const centerX = this.VW / 2;
        const topHalf = this.LANE_OFFSET_TOP * 1.5 + 10;
        const botHalf = this.LANE_OFFSET_BOTTOM * 1.5 + 40;

        ctx.beginPath();
        ctx.moveTo(centerX - topHalf, this.HORIZON_Y);
        ctx.lineTo(centerX + topHalf, this.HORIZON_Y);
        ctx.lineTo(centerX + botHalf, this.ROAD_BOTTOM_Y + 130);
        ctx.lineTo(centerX - botHalf, this.ROAD_BOTTOM_Y + 130);
        ctx.closePath();
        ctx.fillStyle = this.cachedRoadGrad || "#4a4058";
        ctx.fill();

        // viền đá 2 bên
        ctx.strokeStyle = "rgba(255,203,5,0.35)";
        ctx.lineWidth = 3;
        ctx.stroke();

        // vạch chia lane chạy (hiệu ứng chuyển động)
        const scrollOffset = (this.distance * 3.2) % 60;
        ctx.strokeStyle = "rgba(255,213,79,0.55)";
        [-0.5, 0.5].forEach((laneEdge) => {
            ctx.beginPath();
            for (let t = 1; t >= 0; t -= 0.02) {
                const f = t ** 1.6;
                const off = this.LANE_OFFSET_BOTTOM + (this.LANE_OFFSET_TOP - this.LANE_OFFSET_BOTTOM) * f;
                const x = centerX + laneEdge * off * 2;
                const y = this.ROAD_BOTTOM_Y + (this.HORIZON_Y - this.ROAD_BOTTOM_Y) * f;
                const dashPhase = Math.floor((t * 400 + scrollOffset) / 30) % 2;
                if (dashPhase === 0) ctx.lineTo(x, y); else ctx.moveTo(x, y);
            }
            ctx.lineWidth = 4;
            ctx.stroke();
        });
    },

    drawSideProp(sp) {
        const ctx = this.ctx;
        const proj = this.project(sp.lane, sp.t);
        const w = 46 * proj.scale, h = (sp.kind === "pillar" ? 140 : 100) * proj.scale;
        const x = proj.x + sp.jitter * proj.scale, y = proj.y;
        ctx.save();
        ctx.globalAlpha = Math.min(1, proj.f * 3 + 0.15);
        if (sp.kind === "tree") {
            ctx.fillStyle = "#12331f";
            ctx.beginPath(); ctx.ellipse(x, y - h * 0.7, w * 0.55, h * 0.5, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#2a1c12";
            ctx.fillRect(x - w * 0.08, y - h * 0.3, w * 0.16, h * 0.3);
        } else if (sp.kind === "pillar") {
            ctx.fillStyle = "#2c2440";
            ctx.fillRect(x - w * 0.22, y - h, w * 0.44, h);
            ctx.fillStyle = "rgba(255,203,5,0.4)";
            ctx.fillRect(x - w * 0.1, y - h * 0.55, w * 0.2, w * 0.2);
        } else {
            ctx.fillStyle = "#3a2560";
            ctx.beginPath();
            ctx.moveTo(x, y - h);
            ctx.lineTo(x + w * 0.35, y - h * 0.3);
            ctx.lineTo(x - w * 0.35, y - h * 0.3);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = "rgba(120,200,255,0.5)";
            ctx.beginPath(); ctx.ellipse(x, y - h * 0.55, w * 0.12, h * 0.18, 0, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    },

    // Tính toạ độ chiếu cho 1 vật thể tại (lane, t) — tách riêng thành helper
    // để dùng lại được cho cả obstacle 'wall' (chặn NHIỀU làn cùng lúc, cần
    // chiếu riêng từng làn) lẫn coin/obstacle bình thường (1 làn).
    renderProjFor(lane, t) {
        if (t >= 0) return this.project(lane, t);
        // Đã lướt qua khỏi camera -> phóng to nhanh & rơi khỏi màn hình dưới,
        // tránh hiện tượng "đứng khựng" ở đúng vị trí người chơi vài khung hình.
        const base = this.project(lane, 0);
        const k = -t; // 0 -> 0.12
        return { x: base.x, y: base.y + k * 3200, scale: base.scale + k * 10, f: 0 };
    },

    drawObject(obj) {
        if (obj.type === "wall") { this.drawWallGap(obj); return; }
        const proj = this.renderProjFor(obj.lane, obj.t);
        if (obj.kind === "coin") this.drawCoin(proj, obj);
        else this.drawObstacle(proj, obj);
    },

    drawCoin(proj, obj) {
        const ctx = this.ctx;
        const r = 20 * proj.scale;
        const squish = Math.abs(Math.cos(obj.spin));
        ctx.save();
        ctx.translate(proj.x, proj.y - 14 * proj.scale);
        // bóng đổ dưới đồng vàng
        ctx.save();
        ctx.translate(0, 14 * proj.scale);
        ctx.scale(1, 0.3);
        ctx.fillStyle = "rgba(0,0,0,0.35)";
        ctx.beginPath(); ctx.arc(0, 0, r * 0.9, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        ctx.scale(Math.max(0.15, squish), 1);
        const grad = ctx.createRadialGradient(-r * 0.3, -r * 0.3, r * 0.1, 0, 0, r);
        grad.addColorStop(0, "#fff6c9");
        grad.addColorStop(0.5, "#ffd54f");
        grad.addColorStop(1, "#e08e00");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "#a85f00"; ctx.lineWidth = Math.max(1, 2 * proj.scale);
        ctx.stroke();
        ctx.fillStyle = "rgba(160,90,0,0.85)";
        ctx.font = `bold ${r * 1.05}px Baloo 2, sans-serif`;
        ctx.textAlign = "center"; ctx.textBaseline = "middle";
        ctx.fillText("₽", 0, 1);
        ctx.restore();
    },

    drawObstacle(proj, obj) {
        switch (obj.type) {
            case "spike": return this.drawSpikeObstacle(proj, obj);
            case "chasm": return this.drawChasmObstacle(proj, obj);
            case "swarm": return this.drawSwarmObstacle(proj, obj);
            case "branch": return this.drawBranchObstacle(proj, obj);
            case "rock":
            default: return this.drawRockObstacle(proj, obj);
        }
    },

    // ── Loại 1: ĐÁ TẢNG (né bằng nhảy) ──
    drawRockObstacle(proj, obj) {
        const ctx = this.ctx;
        const spanW = obj.spanAll ? (this.LANE_OFFSET_BOTTOM * 2.6 * proj.scale) : (70 * proj.scale);
        const h = 62 * proj.scale;
        ctx.save();
        ctx.translate(proj.x, proj.y);
        this.drawGroundShadow(spanW * 0.55, 26 * proj.scale, 20 * proj.scale);

        const grad = ctx.createLinearGradient(-spanW / 2, -h, spanW / 2, 0);
        grad.addColorStop(0, "#8b8a9c");
        grad.addColorStop(0.5, "#5b5a6d");
        grad.addColorStop(1, "#3f3f4d");
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.moveTo(-spanW * 0.5, 4);
        ctx.lineTo(-spanW * 0.38, -h * 0.65);
        ctx.lineTo(-spanW * 0.12, -h);
        ctx.lineTo(spanW * 0.2, -h * 0.82);
        ctx.lineTo(spanW * 0.48, -h * 0.25);
        ctx.lineTo(spanW * 0.5, 6);
        ctx.closePath();
        ctx.fill();
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2; ctx.stroke();
        // rêu xanh điểm nhấn
        ctx.fillStyle = "rgba(80,160,90,0.55)";
        ctx.beginPath(); ctx.ellipse(-spanW * 0.1, -h * 0.55, spanW * 0.16, h * 0.12, 0.3, 0, Math.PI * 2); ctx.fill();
        this.drawActionLabel("⤒ NHẢY", 0, -h - 10 * proj.scale, proj.scale, "#ffcb05");
        ctx.restore();
    },

    // ── Loại 2: GAI KIM LOẠI (né bằng nhảy) ──
    drawSpikeObstacle(proj, obj) {
        const ctx = this.ctx;
        const spanW = obj.spanAll ? (this.LANE_OFFSET_BOTTOM * 2.6 * proj.scale) : (66 * proj.scale);
        const h = 56 * proj.scale;
        const spikeCount = obj.spanAll ? 7 : 3;
        const spikeW = spanW / spikeCount;
        ctx.save();
        ctx.translate(proj.x, proj.y);
        this.drawGroundShadow(spanW * 0.55, 22 * proj.scale, 12 * proj.scale);

        ctx.fillStyle = "#2c2a38";
        ctx.fillRect(-spanW / 2, -10 * proj.scale, spanW, 14 * proj.scale);
        for (let i = 0; i < spikeCount; i++) {
            const cx = -spanW / 2 + spikeW * (i + 0.5);
            const grad = ctx.createLinearGradient(cx, -h, cx, 0);
            grad.addColorStop(0, "#f4f4f8");
            grad.addColorStop(0.55, "#9a9aa8");
            grad.addColorStop(1, "#45454f");
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.moveTo(cx - spikeW * 0.32, 0);
            ctx.lineTo(cx, -h);
            ctx.lineTo(cx + spikeW * 0.32, 0);
            ctx.closePath();
            ctx.fill();
        }
        // đèn cảnh báo đỏ nhấp nháy theo obj.spin
        const pulse = 0.5 + 0.5 * Math.sin((obj.spin || 0) * 3);
        ctx.fillStyle = `rgba(255,60,60,${0.4 + pulse * 0.5})`;
        ctx.beginPath(); ctx.arc(0, -8 * proj.scale, 5 * proj.scale, 0, Math.PI * 2); ctx.fill();
        this.drawActionLabel("⤒ NHẢY", 0, -h - 10 * proj.scale, proj.scale, "#ff6b6b");
        ctx.restore();
    },

    // ── Loại 3: HỐ LAVA (né bằng nhảy, nằm sát mặt đất) ──
    drawChasmObstacle(proj, obj) {
        const ctx = this.ctx;
        const spanW = obj.spanAll ? (this.LANE_OFFSET_BOTTOM * 2.6 * proj.scale) : (78 * proj.scale);
        const depth = 30 * proj.scale;
        ctx.save();
        ctx.translate(proj.x, proj.y);

        ctx.fillStyle = "#0c0814";
        ctx.beginPath(); ctx.ellipse(0, 8 * proj.scale, spanW * 0.55, depth, 0, 0, Math.PI * 2); ctx.fill();
        const grad = ctx.createRadialGradient(0, 8 * proj.scale, 4, 0, 8 * proj.scale, spanW * 0.5);
        grad.addColorStop(0, "rgba(255,150,40,0.9)");
        grad.addColorStop(0.55, "rgba(255,80,20,0.4)");
        grad.addColorStop(1, "rgba(255,80,20,0)");
        ctx.fillStyle = grad;
        ctx.beginPath(); ctx.ellipse(0, 8 * proj.scale, spanW * 0.46, depth * 0.75, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = "rgba(255,203,5,0.55)"; ctx.lineWidth = 2 * proj.scale;
        ctx.beginPath(); ctx.ellipse(0, 8 * proj.scale, spanW * 0.55, depth, 0, 0, Math.PI * 2); ctx.stroke();
        this.drawActionLabel("⤒ NHẢY", 0, -34 * proj.scale, proj.scale, "#ff9f43");
        ctx.restore();
    },

    // ── Loại 4: CÀNH CÂY / CỔNG GỖ (né bằng trượt) ──
    drawBranchObstacle(proj, obj) {
        const ctx = this.ctx;
        const spanW = obj.spanAll ? (this.LANE_OFFSET_BOTTOM * 2.6 * proj.scale) : (70 * proj.scale);
        const h = 30 * proj.scale;
        const yTop = -110 * proj.scale;
        ctx.save();
        ctx.translate(proj.x, proj.y);
        this.drawGroundShadow(spanW * 0.55, 26 * proj.scale, 20 * proj.scale);

        const grad = ctx.createLinearGradient(0, yTop, 0, yTop + h);
        grad.addColorStop(0, "#a9702f");
        grad.addColorStop(1, "#6b4419");
        ctx.fillStyle = grad;
        ctx.fillRect(-spanW / 2, yTop, spanW, h);
        ctx.strokeStyle = "rgba(0,0,0,0.35)"; ctx.lineWidth = 2;
        ctx.strokeRect(-spanW / 2, yTop, spanW, h);
        ctx.fillStyle = "#3f8f4f";
        ctx.beginPath(); ctx.ellipse(-spanW / 2 + 8, yTop, 14 * proj.scale, 9 * proj.scale, 0.4, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(spanW / 2 - 8, yTop + h, 14 * proj.scale, 9 * proj.scale, -0.4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = "#4a2f12";
        ctx.fillRect(-spanW / 2 + 4, yTop + h, 8 * proj.scale, 110 * proj.scale);
        ctx.fillRect(spanW / 2 - 12, yTop + h, 8 * proj.scale, 110 * proj.scale);
        this.drawActionLabel("⤓ TRƯỢT", 0, yTop - 8 * proj.scale, proj.scale, "#7ee6ff");
        ctx.restore();
    },

    // ── Loại 5: ĐÀN QUÁI BAY (né bằng trượt, lơ lửng ngang đầu) ──
    drawSwarmObstacle(proj, obj) {
        const ctx = this.ctx;
        const spanW = obj.spanAll ? (this.LANE_OFFSET_BOTTOM * 2.6 * proj.scale) : (80 * proj.scale);
        const yTop = -128 * proj.scale;
        const spin = obj.spin || 0;
        const flap = Math.sin(spin * 3);
        ctx.save();
        ctx.translate(proj.x, proj.y);
        this.drawGroundShadow(spanW * 0.42, 16 * proj.scale, 8 * proj.scale, 0.24);

        const count = obj.spanAll ? 5 : 3;
        for (let i = 0; i < count; i++) {
            const cx = -spanW / 2 + (spanW / Math.max(1, count - 1)) * i;
            const cy = yTop + Math.sin(spin + i * 1.7) * 8 * proj.scale;
            ctx.save();
            ctx.translate(cx, cy);
            ctx.fillStyle = "#5a3f80";
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(-16 * proj.scale, -6 * proj.scale - flap * 9 * proj.scale); ctx.lineTo(-4 * proj.scale, 3 * proj.scale);
            ctx.closePath(); ctx.fill();
            ctx.beginPath();
            ctx.moveTo(0, 0); ctx.lineTo(16 * proj.scale, -6 * proj.scale - flap * 9 * proj.scale); ctx.lineTo(4 * proj.scale, 3 * proj.scale);
            ctx.closePath(); ctx.fill();
            ctx.fillStyle = "#3a2a55";
            ctx.beginPath(); ctx.ellipse(0, 0, 9 * proj.scale, 7 * proj.scale, 0, 0, Math.PI * 2); ctx.fill();
            ctx.fillStyle = "#ff5555";
            ctx.beginPath(); ctx.arc(-2.4 * proj.scale, -1 * proj.scale, 1.6 * proj.scale, 0, Math.PI * 2); ctx.fill();
            ctx.beginPath(); ctx.arc(2.4 * proj.scale, -1 * proj.scale, 1.6 * proj.scale, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        }
        this.drawActionLabel("⤓ TRƯỢT", 0, yTop - 30 * proj.scale, proj.scale, "#c9a8ff");
        ctx.restore();
    },

    // ── Loại 6 (MỚI): BỨC TƯỜNG CỔ chắn 2/3 làn — bắt buộc ĐỔI LÀN, không
    // né được bằng nhảy/trượt. Vẽ riêng từng làn bị chặn (không dùng proj
    // truyền vào vì mỗi làn chiếu ra 1 vị trí khác nhau).
    drawWallGap(obj) {
        const ctx = this.ctx;
        (obj.blockedLanes || []).forEach((lane) => {
            const proj = this.renderProjFor(lane, obj.t);
            const w = 132 * proj.scale, h = 150 * proj.scale;
            ctx.save();
            ctx.translate(proj.x, proj.y);
            this.drawGroundShadow(w * 0.5, 22 * proj.scale, 20 * proj.scale);

            const grad = ctx.createLinearGradient(-w / 2, -h, w / 2, 0);
            grad.addColorStop(0, "#5a4a7a");
            grad.addColorStop(0.5, "#3a2c58");
            grad.addColorStop(1, "#241a3d");
            ctx.fillStyle = grad;
            ctx.fillRect(-w / 2, -h, w, h);
            ctx.strokeStyle = "rgba(255,203,5,0.4)"; ctx.lineWidth = 2;
            ctx.strokeRect(-w / 2, -h, w, h);
            ctx.strokeStyle = "rgba(0,0,0,0.3)"; ctx.lineWidth = 1.5;
            for (let row = 1; row < 4; row++) {
                ctx.beginPath();
                ctx.moveTo(-w / 2, -h + (h / 4) * row);
                ctx.lineTo(w / 2, -h + (h / 4) * row);
                ctx.stroke();
            }
            ctx.fillStyle = "rgba(255,80,80,0.85)";
            ctx.beginPath(); ctx.arc(0, -h * 0.55, 6 * proj.scale, 0, Math.PI * 2); ctx.fill();
            ctx.restore();
        });

        // nhãn nhắc đổi làn, đặt tại đúng vị trí làn còn TRỐNG
        const freeLane = this.LANES.find((l) => !(obj.blockedLanes || []).includes(l));
        const lp = this.renderProjFor(freeLane != null ? freeLane : 0, obj.t);
        ctx.save();
        ctx.translate(lp.x, lp.y);
        this.drawActionLabel("↔ ĐỔI LÀN", 0, -168 * lp.scale, lp.scale, "#7ee6ff");
        ctx.restore();
    },

    // Helper dùng chung: bóng đổ hình elip dưới chân chướng ngại vật
    drawGroundShadow(rx, ry, offsetY, alpha = 0.4) {
        const ctx = this.ctx;
        ctx.save();
        ctx.scale(1, 0.28);
        ctx.fillStyle = `rgba(0,0,0,${alpha})`;
        ctx.beginPath(); ctx.ellipse(0, offsetY / 0.28, rx, ry / 0.28 * 0.28, 0, 0, Math.PI * 2); ctx.fill();
        ctx.restore();
    },

    // Helper dùng chung: nhãn chữ nhắc hành động ("⤒ NHẢY" / "⤓ TRƯỢT" / "↔ ĐỔI LÀN")
    drawActionLabel(text, x, y, scale, color) {
        const ctx = this.ctx;
        ctx.save();
        ctx.fillStyle = color;
        ctx.font = `bold ${14 * scale}px Baloo 2, sans-serif`;
        ctx.textAlign = "center";
        ctx.shadowColor = "rgba(0,0,0,0.8)";
        ctx.shadowBlur = 4 * scale;
        ctx.fillText(text, x, y);
        ctx.restore();
    },

    drawPlayer() {
        const ctx = this.ctx;
        const p = this.player;
        const x = this.VW / 2 + p.xOff;
        let y = this.PLAYER_Y;
        let scale = 1;

        if (p.jumping) {
            const arc = Math.sin(Math.PI * p.jumpT);
            y -= arc * 190;
            scale = 1 + arc * 0.05;
        }
        let squashY = 1, squashX = 1;
        if (p.sliding) {
            const s = Math.sin(Math.PI * Math.min(1, p.slideT * 1.6));
            squashY = 1 - s * 0.42;
            squashX = 1 + s * 0.22;
            y += 26 * s;
        }

        // bóng đổ dưới nhân vật
        ctx.save();
        ctx.translate(x, this.PLAYER_Y + 46);
        ctx.scale(1, 0.28);
        const shadowAlpha = p.jumping ? 0.18 : 0.4;
        ctx.fillStyle = `rgba(0,0,0,${shadowAlpha})`;
        ctx.beginPath(); ctx.arc(0, 0, 56, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // hào quang vàng phía sau
        ctx.save();
        ctx.translate(x, y);
        ctx.fillStyle = this.cachedPlayerGlow || "rgba(255,203,5,0.2)";
        ctx.beginPath(); ctx.arc(0, 20, 90, 0, Math.PI * 2); ctx.fill();
        ctx.restore();

        // vệt tốc độ phía sau khi chạy nhanh
        if (this.speed > 0.75 && !p.sliding) {
            ctx.save();
            ctx.globalAlpha = 0.35;
            ctx.strokeStyle = "#ffd54f";
            ctx.lineWidth = 4;
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.moveTo(x - 40 - i * 14, y - 10 + i * 14);
                ctx.lineTo(x - 80 - i * 18, y - 6 + i * 14);
                ctx.stroke();
            }
            ctx.restore();
        }

        // nhấp nháy khi đang bất tử (mới bị va chạm)
        const blinking = p.invulnT > 0 && Math.floor(p.invulnT * 12) % 2 === 0;
        ctx.save();
        ctx.globalAlpha = blinking ? 0.35 : 1;
        ctx.translate(x, y);
        const bob = p.jumping || p.sliding ? 0 : Math.sin(p.runCycle) * 8;
        ctx.translate(0, bob);
        ctx.scale(squashX * scale, squashY * scale);

        const size = 118;
        if (this.characterImg && this.characterImg.complete && this.characterImg.naturalWidth > 0) {
            ctx.save();
            if (p.hit) ctx.filter = "brightness(1.8) saturate(0.4)";
            ctx.drawImage(this.characterImg, -size / 2, -size, size, size);
            ctx.restore();
        } else {
            ctx.fillStyle = "#ffcb05";
            ctx.beginPath(); ctx.arc(0, -size / 2, size * 0.4, 0, Math.PI * 2); ctx.fill();
        }
        ctx.restore();
    },

    drawParticles() {
        const ctx = this.ctx;
        this.particles.forEach((pt) => {
            const alpha = Math.max(0, pt.life / pt.maxLife);
            ctx.save();
            ctx.globalAlpha = alpha;
            if (pt.text) {
                ctx.fillStyle = pt.color;
                ctx.font = `bold ${pt.size}px Baloo 2, sans-serif`;
                ctx.textAlign = "center";
                ctx.strokeStyle = "rgba(0,0,0,0.6)"; ctx.lineWidth = 3;
                ctx.strokeText(pt.text, pt.x, pt.y);
                ctx.fillText(pt.text, pt.x, pt.y);
            } else {
                ctx.fillStyle = pt.color;
                ctx.beginPath(); ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2); ctx.fill();
            }
            ctx.restore();
        });
    },

    drawVignette() {
        const ctx = this.ctx;
        ctx.fillStyle = this.cachedVignette || "rgba(0,0,0,0.25)";
        ctx.fillRect(0, 0, this.VW, this.VH);
    },
};

window.RaceGame.init();
