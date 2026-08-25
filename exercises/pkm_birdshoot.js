        /**
         * ==========================================
         * POKÉMON BIRD SHOOT — GAME LOGIC (kiểu Moorhuhn: bắn chim qua màn hình)
         * ==========================================
         * Luồng tổng thể HỆT pkm_race.js: học từ vựng trước (VocabularyModule) ->
         * chọn cấp độ -> chạm để bắt đầu -> đếm ngược -> chơi. Quiz gọi theo SỐ CHIM
         * ĐÃ BẮN TRÚNG (giống coinsUntilQuiz), điểm/EXP/DV dùng chung window.PkmScore
         * (pkm_score.js, KHÔNG sửa) — Y HỆT cách pkm_race.js đang làm.
         *
         * ĐIỂM KHÁC BIỆT SO VỚI pkm_race.js:
         *  - Không có phối cảnh 3D/lane — đây là bắn súng 2D phẳng: chim/cối xay
         *    gió/khinh khí cầu có toạ độ (x,y) + "depth" (0=xa..1=gần) quyết định
         *    kích cỡ hiển thị + bán kính bắn trúng (xa = bé = khó bắn = ĐIỂM CAO
         *    hơn; gần = to = dễ bắn = điểm thấp hơn).
         *  - Điều khiển: TAP TRỰC TIẾP vào mục tiêu trên canvas (mobile-first),
         *    không phải né/nhảy như race.
         *  - Đạn giới hạn (MAX_AMMO viên) + nút NẠP ĐẠN (khoá bắn trong lúc nạp).
         *  - Mất mạng theo TỈ LỆ BẮN TRƯỢT: theo dõi cửa sổ trượt MISS_WINDOW_SIZE
         *    phát bắn gần nhất, nếu tỉ lệ trượt > 50% thì trừ 1 tim rồi reset cửa sổ.
         *  - Cối xay gió (5 cánh): bắn TỪNG CÁNH ăn điểm riêng, bắn hết 5 cánh có
         *    thưởng thêm. Khinh khí cầu: bắn phải TRỪ điểm (mục tiêu cần TRÁNH).
         *    Cả 2 loại này KHÔNG tính vào bộ đếm quiz / lên màn (chỉ chim thật mới
         *    tính), nhưng vẫn tính là "bắn trúng" cho thống kê tỉ lệ trượt.
         *
         * PHẦN VẼ HÌNH ẢNH (ảnh nền banchim1.png, sprite chim/cối xay gió/khinh khí
         * cầu) nằm HOÀN TOÀN ở file RIÊNG pkm_birdshoot_background.js — file này
         * chỉ GỌI qua object window.BirdShootBackground theo API cố định dưới đây
         * (viết trước, code nền sẽ khớp đúng theo API này ở lượt sau):
         *
         *   BirdShootBackground.preload()                     // tải ảnh nền 1 lần
         *   BirdShootBackground.rebuildGradients(ctx, state)   // gọi lúc resize()
         *   BirdShootBackground.drawBackground(ctx, state)     // vẽ nền/bầu trời/mây
         *   BirdShootBackground.drawBird(ctx, obj, state)      // obj xem spawnBird()
         *   BirdShootBackground.drawWindmill(ctx, obj, state)  // obj xem spawnWindmill()
         *   BirdShootBackground.drawBalloon(ctx, obj, state)   // obj xem spawnBalloon()
         *
         * state truyền vào mọi hàm trên = kết quả của this.shootState() bên dưới:
         *   { VW, VH, level, speedMul, tNow }
         *
         * QUY ƯỚC TOẠ ĐỘ: mọi obj dùng thẳng toạ độ KHÔNG GIAN ẢO (VW x VH), KHÔNG
         * qua phép chiếu phối cảnh nào — vì đây là bắn súng 2D phẳng, không phải
         * đường chạy 3D như race. obj.scale (suy từ obj.depth) là hệ số phóng to/
         * nhỏ sprite mà BirdShootBackground.drawXxx() phải tự nhân vào khi vẽ.
         * ==========================================
         */

        window.BirdShootGame = {
            // ═══════════════════════════════════════════════════════════
            // CẤU HÌNH
            // ═══════════════════════════════════════════════════════════
            VW: 720,
            VH: 1280,
            MIN_QUESTIONS: 8,

            MAX_AMMO: 6,
            RELOAD_DURATION: 0.65,

            MISS_WINDOW_SIZE: 10,
            MISS_RATE_THRESHOLD: 0.5,

            // điểm chim: xa (depth~0) khó bắn hơn -> điểm cao hơn; gần (depth~1) dễ
            // bắn hơn -> điểm thấp hơn. Công thức: BIRD_SCORE_FAR - (FAR-NEAR)*depth
            BIRD_SCORE_FAR: 25,
            BIRD_SCORE_NEAR: 10,
            WINDMILL_BLADE_SCORE: 15,
            WINDMILL_CLEAR_BONUS: 50,
            BALLOON_PENALTY: 20,

            SCALE_FAR: 0.42,
            SCALE_NEAR: 1.15,
            HIT_RADIUS_BASE: 46, // bán kính bắn trúng ở scale=1 (đơn vị không gian ảo)

            BASE_SPEED: 150, // px ảo/giây ở depth trung bình, level 1
            MAX_SPEED_MUL: 2.1,

            randomHitsUntilQuiz() { return 5 + Math.floor(Math.random() * 4); }, // 5..8
            randomLevelTarget() { return 10 + Math.floor(Math.random() * 4); }, // 10..13
            randomWindmillInterval() { return 14 + Math.random() * 8; }, // 14..22s
            randomBalloonInterval() { return 10 + Math.random() * 8; }, // 10..18s
            randomSpawnGap() { return Math.max(0.35, (0.75 + Math.random() * 0.5) / this.speedMul); },

            // ═══════════════════════════════════════════════════════════
            // TRẠNG THÁI
            // ═══════════════════════════════════════════════════════════
            canvas: null,
            ctx: null,
            dpr: 1,
            cssW: 0,
            cssH: 0,

            running: false,
            paused: false,
            gameOver: false,
            controlsLocked: false,
            rafId: null,
            lastTs: 0,
            _boundLoop: null,

            score: 0,
            lives: 10,
            level: 1,
            speedMul: 1,

            birdsCollected: 0,
            correctCount: 0,
            wrongCount: 0,
            totalCount: 0,

            birdsHitSinceQuiz: 0,
            hitsUntilQuiz: 6,

            levelBirdsHit: 0,
            levelTarget: 10,

            ammo: 6,
            reloading: false,
            reloadT: 0,

            // cửa sổ trượt theo dõi TỈ LỆ BẮN TRƯỢT — mỗi phát bắn đẩy 1 giá trị
            // (1 = trúng mục tiêu bất kỳ, 0 = bắn hụt hoàn toàn không trúng gì).
            // Đầy MISS_WINDOW_SIZE phát thì chấm điểm 1 lần rồi làm rỗng lại.
            shotWindow: [],

            objects: [], // {kind:'bird'|'windmill'|'balloon', ...} xem các hàm spawnXxx()
            particles: [],

            spawnTimer: 0.8,
            windmillTimer: 6,
            balloonTimer: 8,
            windmillActive: false,
            balloonActive: false,

            shake: { t: 0, mag: 0 },

            // ═══════════════════════════════════════════════════════════
            // ÂM THANH (Web Audio API tự tạo — cùng phong cách pkm_race.js)
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
            playNoiseBurst(duration, volume, delay = 0) {
                try {
                    const ctx = this.ensureAudioCtx();
                    const bufferSize = Math.floor(ctx.sampleRate * duration);
                    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
                    const data = buffer.getChannelData(0);
                    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
                    const src = ctx.createBufferSource();
                    src.buffer = buffer;
                    const gain = ctx.createGain();
                    gain.gain.value = volume;
                    src.connect(gain); gain.connect(ctx.destination);
                    src.start(ctx.currentTime + delay);
                } catch (e) { /* ignore */ }
            },
            // tiếng súng: nổ (noise) + "đề pa" tần số thấp
            playGunshotSound() {
                this.playNoiseBurst(0.14, 0.5, 0);
                this.playTone(120, 0.1, "square", 0.22, 0);
                this.playTone(70, 0.14, "sine", 0.18, 0.015);
            },
            // tiếng cò súng bấm khi hết đạn (khô, không nổ)
            playEmptyClickSound() { this.playTone(1400, 0.03, "square", 0.08, 0); this.playTone(900, 0.03, "square", 0.06, 0.03); },
            // tiếng nạp đạn: 2 nhịp lách cách kim loại
            playReloadSound() {
                this.playTone(320, 0.06, "square", 0.16, 0);
                this.playTone(220, 0.05, "square", 0.14, 0.14);
                this.playTone(500, 0.05, "square", 0.15, 0.32);
                this.playTone(260, 0.08, "square", 0.16, 0.42);
            },
            playBirdHitSound() { this.playTone(700, 0.05, "triangle", 0.22, 0); this.playTone(1100, 0.09, "sine", 0.22, 0.04); },
            playWindmillHitSound() { this.playTone(300, 0.05, "square", 0.2, 0); this.playTone(180, 0.08, "square", 0.16, 0.03); },
            playWindmillDestroySound() {
                this.playTone(523, 0.1, "sine", 0.22, 0); this.playTone(659, 0.1, "sine", 0.22, 0.1);
                this.playTone(784, 0.1, "sine", 0.22, 0.2); this.playTone(1047, 0.2, "sine", 0.26, 0.3);
            },
            playBalloonPopSound() { this.playNoiseBurst(0.2, 0.35, 0); this.playTone(180, 0.22, "sawtooth", 0.22, 0); },
            playHeartLostSound() { this.playTone(160, 0.2, "square", 0.24, 0); this.playTone(100, 0.24, "sawtooth", 0.2, 0.05); },
            playQuizChime() { this.playTone(784, 0.1, "sine", 0.22, 0); this.playTone(988, 0.1, "sine", 0.22, 0.09); this.playTone(1318, 0.18, "sine", 0.25, 0.18); },
            playGoSound() { this.playTone(523, 0.12, "sine", 0.25, 0); this.playTone(659, 0.12, "sine", 0.25, 0.12); this.playTone(784, 0.2, "sine", 0.28, 0.24); },
            playGameOverSound() { this.playTone(392, 0.2, "sawtooth", 0.2, 0); this.playTone(330, 0.2, "sawtooth", 0.2, 0.18); this.playTone(220, 0.35, "sawtooth", 0.2, 0.36); },
            playLevelUpSound() {
                this.playTone(440, 0.1, "sine", 0.22, 0); this.playTone(587, 0.1, "sine", 0.24, 0.1); this.playTone(880, 0.24, "sine", 0.28, 0.2);
            },

            // ═══════════════════════════════════════════════════════════
            // KHỞI TẠO — luồng học từ vựng -> chọn cấp -> chạm bắt đầu, HỆT pkm_race.js
            // ═══════════════════════════════════════════════════════════
            async init() {
                console.log("🎯 [DEBUG] BirdShootGame.init() started");

                this.canvas = document.getElementById("shootCanvas");
                this.ctx = this.canvas.getContext("2d");
                if (window.BirdShootBackground && window.BirdShootBackground.preload) {
                    window.BirdShootBackground.preload();
                }
                this.resize();
                window.addEventListener("resize", () => this.resize());

                this.attachControls();

                if (window.QuizManager) window.QuizManager.prepareData();

                const quizOverlay = document.getElementById("quiz-overlay");
                if (quizOverlay) quizOverlay.style.display = "none";

                const renderLevelSelect = (container) => {
                    return new Promise((resolve) => {
                        const LEVELS = [
                            { key: "de", emoji: "🟢", label: "Dễ", sub: "Hội thoại/đoạn văn ngắn" },
                            { key: "trung_binh", emoji: "🟡", label: "Trung bình", sub: "Độ dài vừa phải" },
                            { key: "kho", emoji: "🔴", label: "Khó", sub: "Hội thoại/đoạn văn dài" },
                        ];
                        container.innerHTML = `
                            <div style="text-align:center;">
                                <div class="shoot-level-select-title">🎯 Chọn cấp độ Bird Shoot!</div>
                                <div class="shoot-level-row">
                                    ${LEVELS.map((lv) => `
                                        <div class="shoot-level-card" data-level="${lv.key}">
                                            <div class="lv-emoji">${lv.emoji}</div>
                                            <div class="lv-label">${lv.label}</div>
                                            <div class="lv-sub">${lv.sub}</div>
                                        </div>`).join("")}
                                </div>
                            </div>`;
                        container.querySelectorAll(".shoot-level-card").forEach((card) => {
                            card.onclick = () => {
                                localStorage.setItem("selected_level", card.dataset.level);
                                resolve(card.dataset.level);
                            };
                        });
                    });
                };

                // Tên hàm PHẢI là startPokemonBattle vì pkm_vocabulary.js gọi cứng tên này
                window.startPokemonBattle = async () => {
                    console.log("🎯 Chọn cấp độ trước khi vào Bird Shoot...");

                    let mainCard = document.getElementById("mainCard");
                    if (!mainCard) {
                        mainCard = document.createElement("div");
                        mainCard.id = "mainCard";
                        document.body.appendChild(mainCard);
                    }
                    mainCard.style.cssText = `
                        position: fixed; top:0; left:0; width:100vw; height:100dvh;
                        background: radial-gradient(circle, #2b4a1f 0%, #0c1608 100%);
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

                    this.showTapToStart();
                };

                if (window.VocabularyModule && typeof window.VocabularyModule.start === "function") {
                    console.log("📘 [BirdShoot] Gọi VocabularyModule chạy phần học từ vựng...");
                    await window.VocabularyModule.start();
                } else {
                    console.warn("⚠️ Không tìm thấy VocabularyModule, tự động vào thẳng Bird Shoot!");
                    window.startPokemonBattle();
                }
            },

            // ═══════════════════════════════════════════════════════════
            // CANVAS RESIZE (full-bleed, giống pkm_race.js nhưng không cần lane)
            // ═══════════════════════════════════════════════════════════
            resize() {
                const stage = document.getElementById("shoot-stage");
                const wrapW = Math.max(1, stage.clientWidth);
                const wrapH = Math.max(1, stage.clientHeight);

                this.cssW = wrapW; this.cssH = wrapH;
                this.canvas.style.width = wrapW + "px";
                this.canvas.style.height = wrapH + "px";

                this.VH = 1280;
                this.VW = Math.round(this.VH * (wrapW / wrapH));

                this.dpr = Math.min(window.devicePixelRatio || 1, 2);
                this.canvas.width = Math.round(this.VW * this.dpr);
                this.canvas.height = Math.round(this.VH * this.dpr);
                this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);

                if (window.BirdShootBackground) window.BirdShootBackground.rebuildGradients(this.ctx, this.shootState());
            },

            // Đóng gói thông số cho pkm_birdshoot_background.js — xem API ở đầu file.
            shootState() {
                return { VW: this.VW, VH: this.VH, level: this.level, speedMul: this.speedMul, tNow: performance.now() / 1000 };
            },

            // ═══════════════════════════════════════════════════════════
            // MÀN "CHẠM ĐỂ BẮT ĐẦU" + ĐẾM NGƯỢC (HỆT pkm_race.js)
            // ═══════════════════════════════════════════════════════════
            showTapToStart() {
                const layer = document.getElementById("shoot-overlay-layer");
                layer.className = "show";
                layer.innerHTML = `
                    <div id="tapStartCard">
                        <div id="tapStartBtn"></div>
                        <div class="tap-label">Chạm để bắt đầu!</div>
                        <div class="tap-sub">Chạm trúng chim · Nạp đạn kịp lúc · Né khinh khí cầu</div>
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
                const layer = document.getElementById("shoot-overlay-layer");
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
                this.objects = [];
                this.particles = [];
                this.level = 1;
                this.speedMul = 1;
                this.levelBirdsHit = 0;
                this.levelTarget = this.randomLevelTarget();
                this.ammo = this.MAX_AMMO;
                this.reloading = false;
                this.reloadT = 0;
                this.shotWindow = [];
                this.spawnTimer = 0.6;
                this.windmillTimer = this.randomWindmillInterval();
                this.balloonTimer = this.randomBalloonInterval();
                this.windmillActive = false;
                this.balloonActive = false;
                if (window.BirdShootBackground) window.BirdShootBackground.rebuildGradients(this.ctx, this.shootState());
            },

            startPlaying() {
                this.resetRunState();
                this.running = true;
                this.paused = false;
                this.gameOver = false;
                this.controlsLocked = false;
                this.score = 0;
                this.lives = 10;
                this.birdsCollected = 0;
                this.correctCount = 0; this.wrongCount = 0; this.totalCount = 0;
                this.birdsHitSinceQuiz = 0;
                this.hitsUntilQuiz = this.randomHitsUntilQuiz();
                this.updateHUD();
                this.updateHeartsUI();
                this.updateAmmoUI();
                document.getElementById("shoot-controls").classList.remove("locked");

                this.lastTs = performance.now();
                if (!this._boundLoop) this._boundLoop = this.gameLoopStep.bind(this);
                this.rafId = requestAnimationFrame(this._boundLoop);
            },

            // Y HỆT cơ chế dừng hẳn rAF khi paused (mở quiz) của pkm_race.js — đỡ
            // hao pin/CPU và không bị giật hình phía sau lớp quiz-overlay mờ.
            gameLoopStep(ts) {
                if (!this.running) return;
                let dt = (ts - this.lastTs) / 1000;
                this.lastTs = ts;
                if (dt > 0.05) dt = 0.05;
                if (!this.paused && !this.gameOver) this.update(dt);
                this.drawScene(dt);
                if (!this.paused && !this.gameOver) {
                    this.rafId = requestAnimationFrame(this._boundLoop);
                }
            },

            // ═══════════════════════════════════════════════════════════
            // CẬP NHẬT MỖI KHUNG HÌNH
            // ═══════════════════════════════════════════════════════════
            update(dt) {
                this.updateReload(dt);
                this.updateSpawns(dt);
                this.updateObjects(dt);
                this.updateParticles(dt);

                if (this.shake.t > 0) { this.shake.t -= dt; if (this.shake.t < 0) this.shake.t = 0; }

                this.updateHUD();
            },

            updateReload(dt) {
                if (!this.reloading) return;
                this.reloadT -= dt;
                if (this.reloadT <= 0) {
                    this.reloading = false;
                    this.ammo = this.MAX_AMMO;
                    this.updateAmmoUI();
                }
            },

            updateSpawns(dt) {
                this.spawnTimer -= dt;
                if (this.spawnTimer <= 0) {
                    this.spawnBird();
                    this.spawnTimer = this.randomSpawnGap();
                }
                if (!this.windmillActive) {
                    this.windmillTimer -= dt;
                    if (this.windmillTimer <= 0) this.spawnWindmill();
                }
                if (!this.balloonActive) {
                    this.balloonTimer -= dt;
                    if (this.balloonTimer <= 0) this.spawnBalloon();
                }
            },

            // ═══════════════════════════════════════════════════════════
            // SINH MỤC TIÊU
            // ═══════════════════════════════════════════════════════════
            // 55% bay ngang trái<->phải, 30% bay chéo lên trời, 15% lượn giữa màn hình.
            spawnBird() {
                const roll = Math.random();
                const depth = Math.random(); // 0 = xa/bé, 1 = gần/to
                const scale = this.SCALE_FAR + (this.SCALE_NEAR - this.SCALE_FAR) * depth;
                const speed = this.BASE_SPEED * (0.65 + 0.55 * depth) * this.speedMul;
                const species = ["brown", "red", "white"][Math.floor(Math.random() * 3)];
                const base = {
                    kind: "bird", alive: true, depth, scale, species,
                    hitRadius: this.HIT_RADIUS_BASE * scale,
                    flapPhase: Math.random() * Math.PI * 2,
                    rot: 0, bornT: performance.now() / 1000,
                };

                if (roll < 0.55) {
                    // bay ngang: trái->phải hoặc phải->trái, hơi nhấp nhô theo sin
                    const dir = Math.random() < 0.5 ? 1 : -1;
                    const y = this.VH * 0.14 + Math.random() * this.VH * 0.42;
                    this.objects.push(Object.assign(base, {
                        pattern: "horizontal",
                        x: dir < 0 ? this.VW + 70 : -70, y, baseY: y,
                        vx: dir * speed, vy: 0,
                        bobAmp: 14 + Math.random() * 26, bobFreq: 1.4 + Math.random() * 1.4,
                    }));
                } else if (roll < 0.85) {
                    // bay chéo lên trời: xuất phát đáy 1 bên, bay chéo qua và thoát lên trên
                    const dir = Math.random() < 0.5 ? 1 : -1;
                    const x = dir < 0 ? this.VW + 40 : -40;
                    const y = this.VH * 0.62 + Math.random() * this.VH * 0.28;
                    this.objects.push(Object.assign(base, {
                        pattern: "diagonal",
                        x, y,
                        vx: dir * speed * 0.72, vy: -speed * 0.95,
                    }));
                } else {
                    // lượn giữa màn hình 1 lúc rồi bay thoát — mục tiêu "ngon ăn" nhưng thời gian có hạn
                    const x = this.VW * 0.34 + Math.random() * this.VW * 0.32;
                    const y = this.VH * 0.22 + Math.random() * this.VH * 0.24;
                    this.objects.push(Object.assign(base, {
                        pattern: "center",
                        x, y, baseX: x, baseY: y,
                        vx: 0, vy: 0, centerT: 0, centerLife: 2.4 + Math.random() * 1.3, fleeing: false,
                    }));
                }
            },

            // Cối xay gió 5 cánh — neo cố định gần rìa màn hình, cánh tự quay, bắn
            // từng cánh ăn điểm riêng, bắn hết 5 cánh có thưởng rồi biến mất.
            spawnWindmill() {
                this.windmillActive = true;
                const side = Math.random() < 0.5 ? 0.16 : 0.84;
                this.objects.push({
                    kind: "windmill", alive: true,
                    x: this.VW * side, y: this.VH * 0.22,
                    scale: 1, bladeLen: 92, rotAngle: 0,
                    rotSpeed: 1.05 + Math.random() * 0.5,
                    blades: [0, 1, 2, 3, 4].map(() => ({ alive: true })),
                    destroyed: false, despawnT: 0,
                });
            },

            // Khinh khí cầu — bay ngang chậm rãi, bắn trúng bị TRỪ điểm (mục tiêu
            // cần tránh, không tính vào bộ đếm quiz/lên màn).
            spawnBalloon() {
                this.balloonActive = true;
                const dir = Math.random() < 0.5 ? 1 : -1;
                const y = this.VH * 0.1 + Math.random() * this.VH * 0.16;
                this.objects.push({
                    kind: "balloon", alive: true,
                    x: dir < 0 ? this.VW + 90 : -90, y,
                    vx: dir * this.BASE_SPEED * 0.42 * this.speedMul, vy: 0,
                    scale: 0.95 + Math.random() * 0.25,
                    hitRadius: this.HIT_RADIUS_BASE * 1.35,
                    bobPhase: Math.random() * Math.PI * 2,
                });
            },

            // ═══════════════════════════════════════════════════════════
            // CẬP NHẬT VỊ TRÍ MỤC TIÊU
            // ═══════════════════════════════════════════════════════════
            updateObjects(dt) {
                const remain = [];
                for (const obj of this.objects) {
                    if (obj.kind === "bird") this.updateBird(obj, dt);
                    else if (obj.kind === "windmill") this.updateWindmill(obj, dt);
                    else if (obj.kind === "balloon") this.updateBalloon(obj, dt);

                    if (this.isOffscreenRemovable(obj)) continue;
                    remain.push(obj);
                }
                this.objects = remain;
            },

            updateBird(b, dt) {
                b.flapPhase += dt * 9;
                if (b.pattern === "horizontal") {
                    b.x += b.vx * dt;
                    b.y = b.baseY + Math.sin(b.flapPhase * (b.bobFreq / 9)) * b.bobAmp;
                    b.rot = b.vx > 0 ? 0.08 : -0.08;
                } else if (b.pattern === "diagonal") {
                    b.x += b.vx * dt; b.y += b.vy * dt;
                    b.rot = Math.atan2(b.vy, b.vx) * 0.5;
                } else if (b.pattern === "center") {
                    if (!b.fleeing) {
                        b.centerT += dt;
                        b.x = b.baseX + Math.sin(b.centerT * 1.6) * 30;
                        b.y = b.baseY + Math.cos(b.centerT * 1.1) * 18;
                        if (b.centerT >= b.centerLife) {
                            b.fleeing = true;
                            const ang = Math.random() * Math.PI * 2;
                            const spd = this.BASE_SPEED * (0.8 + 0.6 * b.depth) * this.speedMul;
                            b.vx = Math.cos(ang) * spd; b.vy = Math.sin(ang) * spd - 40;
                        }
                    } else {
                        b.x += b.vx * dt; b.y += b.vy * dt;
                    }
                }
            },

            updateWindmill(w, dt) {
                w.rotAngle += dt * w.rotSpeed;
                if (w.destroyed) {
                    w.despawnT += dt;
                    if (w.despawnT > 0.6) { w.alive = false; this.windmillActive = false; }
                }
            },

            updateBalloon(bl, dt) {
                bl.bobPhase += dt * 1.2;
                bl.x += bl.vx * dt;
                bl.y += Math.sin(bl.bobPhase) * 0.6;
            },

            isOffscreenRemovable(obj) {
                if (obj.kind === "windmill") return !obj.alive;
                const margin = 140;
                if (obj.x < -margin || obj.x > this.VW + margin || obj.y < -margin || obj.y > this.VH + margin) {
                    if (obj.kind === "balloon") this.balloonActive = false;
                    return true;
                }
                return false;
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
            // ĐIỀU KHIỂN — TAP TRỰC TIẾP VÀO MỤC TIÊU TRÊN CANVAS
            // ═══════════════════════════════════════════════════════════
            attachControls() {
                document.getElementById("btnReload").addEventListener("click", () => this.doReload());

                const stage = document.getElementById("shoot-stage");
                const toVirtual = (clientX, clientY) => {
                    const rect = this.canvas.getBoundingClientRect();
                    const relX = (clientX - rect.left) / rect.width;
                    const relY = (clientY - rect.top) / rect.height;
                    return { x: relX * this.VW, y: relY * this.VH };
                };

                stage.addEventListener("touchstart", (e) => {
                    if (this.controlsLocked || !this.running || this.gameOver) return;
                    const t = e.changedTouches[0];
                    const p = toVirtual(t.clientX, t.clientY);
                    this.onTapShoot(p.x, p.y);
                }, { passive: true });

                // click chuột cho PC (nếu người chơi test trên máy tính)
                stage.addEventListener("mousedown", (e) => {
                    if (this.controlsLocked || !this.running || this.gameOver) return;
                    const p = toVirtual(e.clientX, e.clientY);
                    this.onTapShoot(p.x, p.y);
                });

                window.addEventListener("keydown", (e) => {
                    if (this.controlsLocked || !this.running || this.gameOver) return;
                    if (e.key === "r" || e.key === "R") this.doReload();
                });
            },

            doReload() {
                if (this.controlsLocked || !this.running || this.gameOver) return;
                if (this.reloading || this.ammo === this.MAX_AMMO) return;
                this.reloading = true;
                this.reloadT = this.RELOAD_DURATION;
                this.playReloadSound();
            },

            // ═══════════════════════════════════════════════════════════
            // BẮN — hit-test mục tiêu gần điểm chạm nhất, ưu tiên vật NỔI/GẦN nhất
            // ═══════════════════════════════════════════════════════════
            onTapShoot(x, y) {
                if (this.reloading) { this.playEmptyClickSound(); return; }
                if (this.ammo <= 0) { this.playEmptyClickSound(); this.flashNoAmmoHint(); return; }

                this.ammo--;
                this.playGunshotSound();
                this.spawnMuzzleFlash(x, y);
                this.updateAmmoUI();

                const target = this.findTargetAt(x, y);
                if (!target) {
                    this.pushShotResult(0);
                    return;
                }

                this.pushShotResult(1);
                if (target.kind === "bird") this.collectBird(target.obj);
                else if (target.kind === "windmillBlade") this.hitWindmillBlade(target.obj, target.bladeIndex);
                else if (target.kind === "balloon") this.hitBalloon(target.obj);
            },

            // Trả về { kind, obj, bladeIndex? } của mục tiêu gần điểm chạm nhất
            // trong bán kính bắn trúng, hoặc null nếu bắn hụt hoàn toàn.
            findTargetAt(x, y) {
                let best = null, bestDist = Infinity;
                for (const obj of this.objects) {
                    if (obj.kind === "bird" && obj.alive) {
                        const d = Math.hypot(obj.x - x, obj.y - y);
                        if (d <= obj.hitRadius && d < bestDist) { bestDist = d; best = { kind: "bird", obj }; }
                    } else if (obj.kind === "balloon" && obj.alive) {
                        const d = Math.hypot(obj.x - x, obj.y - y);
                        if (d <= obj.hitRadius && d < bestDist) { bestDist = d; best = { kind: "balloon", obj }; }
                    } else if (obj.kind === "windmill" && obj.alive && !obj.destroyed) {
                        obj.blades.forEach((blade, i) => {
                            if (!blade.alive) return;
                            const tip = this.windmillBladeTipPos(obj, i);
                            const d = Math.hypot(tip.x - x, tip.y - y);
                            const r = 44 * obj.scale;
                            if (d <= r && d < bestDist) { bestDist = d; best = { kind: "windmillBlade", obj, bladeIndex: i }; }
                        });
                    }
                }
                return best;
            },

            // Vị trí đầu cánh cối xay gió tại thời điểm hiện tại — dùng chung cho cả
            // hit-test (ở đây) lẫn vẽ hình (pkm_birdshoot_background.js phải tính
            // GIỐNG HỆT công thức này để hình vẽ khớp đúng vùng bắn trúng được).
            windmillBladeTipPos(w, index) {
                const angle = w.rotAngle + index * ((Math.PI * 2) / 5);
                const r = w.bladeLen * 0.66 * w.scale;
                return { x: w.x + Math.cos(angle) * r, y: w.y + Math.sin(angle) * r };
            },

            pushShotResult(v) {
                this.shotWindow.push(v);
                if (this.shotWindow.length >= this.MISS_WINDOW_SIZE) {
                    const misses = this.shotWindow.filter((s) => s === 0).length;
                    if (misses / this.shotWindow.length > this.MISS_RATE_THRESHOLD) {
                        this.loseHeart("miss_rate");
                    }
                    this.shotWindow = [];
                }
            },

            flashNoAmmoHint() {
                this.spawnFloatText(this.VW / 2, this.VH * 0.42, "🔄 Hết đạn — Nạp đạn!", "#ffcb05");
            },

            // ═══════════════════════════════════════════════════════════
            // KẾT QUẢ TRÚNG ĐÍCH
            // ═══════════════════════════════════════════════════════════
            collectBird(bird) {
                bird.alive = false;
                this.objects = this.objects.filter((o) => o !== bird);

                const pts = Math.round(this.BIRD_SCORE_FAR - (this.BIRD_SCORE_FAR - this.BIRD_SCORE_NEAR) * bird.depth);
                this.score += pts;
                this.birdsCollected++;
                this.birdsHitSinceQuiz++;
                this.levelBirdsHit++;
                this.playBirdHitSound();
                this.spawnBurst(bird.x, bird.y, "#ffcb05", 10);
                this.spawnFloatText(bird.x, bird.y - 30, `+${pts}`, "#ffe38a");

                if (this.birdsHitSinceQuiz >= this.hitsUntilQuiz) {
                    this.birdsHitSinceQuiz = 0;
                    this.hitsUntilQuiz = this.randomHitsUntilQuiz();
                    this.triggerQuiz();
                }

                if (this.levelBirdsHit >= this.levelTarget) {
                    this.levelUp();
                }
            },

            hitWindmillBlade(windmill, index) {
                const blade = windmill.blades[index];
                if (!blade.alive) return;
                blade.alive = false;
                this.score += this.WINDMILL_BLADE_SCORE;
                this.playWindmillHitSound();
                const tip = this.windmillBladeTipPos(windmill, index);
                this.spawnBurst(tip.x, tip.y, "#c9a0ff", 8);
                this.spawnFloatText(tip.x, tip.y - 20, `+${this.WINDMILL_BLADE_SCORE}`, "#c9a0ff");

                if (windmill.blades.every((b) => !b.alive) && !windmill.destroyed) {
                    windmill.destroyed = true;
                    windmill.despawnT = 0;
                    this.score += this.WINDMILL_CLEAR_BONUS;
                    this.playWindmillDestroySound();
                    this.spawnBurst(windmill.x, windmill.y, "#ffcb05", 26);
                    this.spawnFloatText(windmill.x, windmill.y - 60, `🎉 +${this.WINDMILL_CLEAR_BONUS}`, "#ffcb05");
                }
            },

            hitBalloon(balloon) {
                balloon.alive = false;
                this.objects = this.objects.filter((o) => o !== balloon);
                this.balloonActive = false;
                this.score = Math.max(0, this.score - this.BALLOON_PENALTY);
                this.playBalloonPopSound();
                this.spawnBurst(balloon.x, balloon.y, "#ff6b6b", 14);
                this.spawnFloatText(balloon.x, balloon.y - 20, `-${this.BALLOON_PENALTY}`, "#ff6b6b");
                this.shake.t = 0.2; this.shake.mag = 8;
            },

            levelUp() {
                this.level++;
                this.levelBirdsHit = 0;
                this.levelTarget = this.randomLevelTarget();
                this.speedMul = Math.min(this.MAX_SPEED_MUL, 1 + (this.level - 1) * 0.16);
                this.playLevelUpSound();
                this.showLevelBanner();
            },

            showLevelBanner() {
                const el = document.getElementById("level-banner");
                if (!el) return;
                const txt = el.querySelector(".level-banner-txt");
                if (txt) txt.textContent = `🎯 Màn ${this.level}`;
                el.classList.remove("show");
                void el.offsetWidth;
                el.classList.add("show");
                clearTimeout(this._levelBannerTimer);
                this._levelBannerTimer = setTimeout(() => el.classList.remove("show"), 2200);
            },

            // ═══════════════════════════════════════════════════════════
            // MẤT MẠNG
            // ═══════════════════════════════════════════════════════════
            loseHeart(reason) {
                this.lives = Math.max(0, this.lives - 1);
                this.shake.t = 0.3; this.shake.mag = 14;
                this.playHeartLostSound();
                this.spawnFloatText(this.VW / 2, this.VH * 0.36, "-1 ❤️", "#ff6b6b");
                this.updateHeartsUI();
                this.checkGameOver();
            },

            // ═══════════════════════════════════════════════════════════
            // HIỆU ỨNG HẠT
            // ═══════════════════════════════════════════════════════════
            spawnMuzzleFlash(x, y) {
                for (let i = 0; i < 6; i++) {
                    const ang = Math.random() * Math.PI * 2;
                    const spd = 50 + Math.random() * 70;
                    this.particles.push({
                        x, y, vx: Math.cos(ang) * spd, vy: Math.sin(ang) * spd,
                        gravity: 60, life: 0.18 + Math.random() * 0.1, maxLife: 0.28,
                        color: "rgba(255,220,140,0.85)", size: 2.5 + Math.random() * 2.5,
                    });
                }
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
            // QUIZ THEO SỐ CHIM ĐÃ BẮN TRÚNG (HỆT pkm_race.js)
            // ═══════════════════════════════════════════════════════════
            triggerQuiz() {
                if (this.gameOver) return;
                this.paused = true;
                this.controlsLocked = true;
                document.getElementById("shoot-controls").classList.add("locked");
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
                document.getElementById("shoot-controls").classList.remove("locked");
                this.lastTs = performance.now();

                if (!isCorrect) {
                    this.loseHeart("quiz_wrong");
                } else {
                    this.spawnFloatText(this.VW / 2, this.VH * 0.36, "🎉 Chuẩn!", "#2ecc71");
                }

                const isOver = this.checkGameOver();
                if (!isOver) {
                    this.lastTs = performance.now();
                    this.rafId = requestAnimationFrame(this._boundLoop);
                }
            },

            // ═══════════════════════════════════════════════════════════
            // HUD
            // ═══════════════════════════════════════════════════════════
            updateHUD() {
                const scoreEl = document.getElementById("scoreValue");
                if (scoreEl) scoreEl.innerText = this.score;
                const stats = document.getElementById("quiz-stats");
                if (stats) stats.innerHTML = `✅ ${this.correctCount} &nbsp; ❌ ${this.wrongCount} &nbsp; 📊 ${this.totalCount} câu`;
                const levelEl = document.getElementById("levelChip");
                if (levelEl) levelEl.textContent = `🎯 Màn ${this.level}`;
            },

            updateHeartsUI() {
                document.querySelectorAll("#heartsBox .heart-icon").forEach((el, i) => {
                    el.classList.toggle("heart-lost", i >= this.lives);
                });
            },

            updateAmmoUI() {
                const box = document.getElementById("ammoBox");
                if (!box) return;
                box.querySelectorAll(".bullet-icon").forEach((el, i) => {
                    el.classList.toggle("bullet-used", i >= this.ammo);
                });
                const reloadBtn = document.getElementById("btnReload");
                if (reloadBtn) reloadBtn.classList.toggle("reloading", this.reloading);
            },

            // ═══════════════════════════════════════════════════════════
            // KẾT THÚC GAME (dùng chung PkmScore — HỆT pkm_race.js)
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
                    console.error('❌ PkmScore chưa được nạp — thiếu <script src="pkm_score.js"> trong pkm_birdshoot.html?');
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
                            <div style="color:#ccc; margin-bottom:14px;">Cuộc săn kết thúc quá sớm!</div>
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

                if (titleEl) titleEl.innerText = "🏆 SĂN THÀNH CÔNG!";

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
                            🐦 Chim bắn trúng: ${this.birdsCollected} &nbsp; | &nbsp; 🎯 Màn đã qua: ${this.level} &nbsp; | &nbsp; ⭐ Điểm: ${this.score}
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
            // VẼ TOÀN CẢNH — nền/sprite giao hết cho BirdShootBackground, ở đây chỉ
            // lo THỨ TỰ vẽ + hiệu ứng hạt + rung màn hình.
            // ═══════════════════════════════════════════════════════════
            drawScene(dt) {
                const ctx = this.ctx;
                ctx.save();
                ctx.clearRect(0, 0, this.VW, this.VH);

                if (this.shake.t > 0) {
                    const m = this.shake.mag * (this.shake.t / 0.3);
                    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
                }

                const state = this.shootState();
                if (window.BirdShootBackground) window.BirdShootBackground.drawBackground(ctx, state);

                // vẽ mục tiêu theo thứ tự XA -> GẦN (depth thấp trước) để vật gần đè lên vật xa
                const drawList = this.objects.slice().sort((a, b) => {
                    const da = a.kind === "bird" ? a.depth : a.kind === "balloon" ? 0.5 : 0.8;
                    const db = b.kind === "bird" ? b.depth : b.kind === "balloon" ? 0.5 : 0.8;
                    return da - db;
                });
                if (window.BirdShootBackground) {
                    drawList.forEach((obj) => {
                        if (obj.kind === "bird") window.BirdShootBackground.drawBird(ctx, obj, state);
                        else if (obj.kind === "windmill") window.BirdShootBackground.drawWindmill(ctx, obj, state);
                        else if (obj.kind === "balloon") window.BirdShootBackground.drawBalloon(ctx, obj, state);
                    });
                }

                this.drawParticles();
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
        };

        window.BirdShootGame.init();
