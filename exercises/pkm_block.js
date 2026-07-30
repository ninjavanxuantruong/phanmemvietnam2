/**
 * ==========================================
 * POKEMON BLOCK BLAST - GAME LOGIC (v2)
 * ==========================================
 * Luồng: giống hệt pkm_battle.js ở phần "học từ vựng trước" (VocabularyModule),
 * chỉ khác phần "sân chơi" — thay vì đấu Pokémon thì xếp khối phá hàng.
 *
 * LƯU Ý QUAN TRỌNG 1: pkm_vocabulary.js (dùng chung, KHÔNG sửa) sau khi học xong
 * gọi cứng `window.startPokemonBattle()`. Vì vậy bên dưới ta vẫn đặt tên hàm
 * khởi động game là `window.startPokemonBattle` (dù thực chất nó khởi động
 * Block Blast) để không phải đụng vào file gốc.
 *
 * LƯU Ý QUAN TRỌNG 2: pkm_quiz.js (dùng chung, KHÔNG sửa) không trả về trực
 * tiếp "câu vừa hỏi thuộc kỹ năng nào" qua callback của ask(). Nhưng nó có
 * biến đếm nội bộ `skillCycleIndex` — cứ mỗi câu hỏi THẬT SỰ được hỏi thì
 * tăng thêm 1, xoay vòng đúng thứ tự SKILL_ORDER = ["listening","speaking",
 * "reading","writing"]. Đọc biến này ngay lúc callback trả về, ta suy ra
 * chính xác câu vừa rồi thuộc kỹ năng nào — không cần sửa pkm_quiz.js.
 * Mảng SKILL_ORDER_LOCAL bên dưới PHẢI khớp đúng thứ tự với SKILL_ORDER
 * trong pkm_quiz.js — nếu sau này đổi thứ tự bên đó thì nhớ đổi luôn ở đây.
 */

window.BlockGame = {
    GRID_SIZE: 8,
    MIN_QUESTIONS: 12,
    MAX_QUESTIONS: 24,

    // Phải khớp SKILL_ORDER trong pkm_quiz.js
    SKILL_ORDER_LOCAL: ["listening", "speaking", "reading", "writing"],

    grid: [],          // 8x8, mỗi ô: null hoặc mã màu (string)
    pokemonGrid: [],    // 8x8 song song với grid, mỗi ô: null hoặc {id, url}
    tray: [null, null, null],
    selectedTrayIndex: null,

    score: 0,
    correctCount: 0,
    wrongCount: 0,
    totalCount: 0,
    skillStats: {
        listening: { correct: 0, total: 0 },
        speaking: { correct: 0, total: 0 },
        reading: { correct: 0, total: 0 },
        writing: { correct: 0, total: 0 },
    },

    isPaused: false,
    gameOver: false,
    quizTimer: null,

    COLORS: ['#ff6b6b', '#4ecdc4', '#ffe66d', '#a29bfe', '#55efc4', '#fd79a8', '#74b9ff', '#fab1a0', '#ffb142'],

    // Mỗi shape là danh sách toạ độ [row, col] đã chuẩn hoá về gốc (0,0)
    PIECE_SHAPES: [
        { cells: [[0, 0]] },
        { cells: [[0, 0], [0, 1]] },
        { cells: [[0, 0], [1, 0]] },
        { cells: [[0, 0], [0, 1], [0, 2]] },
        { cells: [[0, 0], [1, 0], [2, 0]] },
        { cells: [[0, 0], [0, 1], [0, 2], [0, 3]] },
        { cells: [[0, 0], [1, 0], [2, 0], [3, 0]] },
        { cells: [[0, 0], [0, 1], [0, 2], [0, 3], [0, 4]] },
        { cells: [[0, 0], [1, 0], [2, 0], [3, 0], [4, 0]] },
        { cells: [[0, 0], [0, 1], [1, 0], [1, 1]] }, // vuông 2x2
        { cells: [[0, 0], [0, 1], [0, 2], [1, 0], [1, 1], [1, 2], [2, 0], [2, 1], [2, 2]] }, // vuông 3x3
        { cells: [[0, 0], [1, 0], [2, 0], [2, 1]] }, // L
        { cells: [[0, 0], [0, 1], [0, 2], [1, 0]] }, // L lật
        { cells: [[0, 0], [0, 1], [1, 1], [2, 1]] }, // L lật 2
        { cells: [[0, 2], [1, 0], [1, 1], [1, 2]] }, // L lật 3
        { cells: [[0, 0], [0, 1], [0, 2], [1, 1]] }, // T
        { cells: [[0, 1], [1, 0], [1, 1], [2, 1]] }, // T dọc
        { cells: [[0, 1], [0, 2], [1, 0], [1, 1]] }, // S
        { cells: [[0, 0], [0, 1], [1, 1], [1, 2]] }, // Z
        { cells: [[0, 0], [0, 1], [1, 0]] }, // góc nhỏ
        { cells: [[0, 0], [0, 1], [1, 1]] }, // góc nhỏ
        { cells: [[0, 1], [1, 0], [1, 1]] }, // góc nhỏ
        { cells: [[0, 0], [1, 0], [1, 1]] }, // góc nhỏ
        { cells: [[0, 1], [1, 0], [1, 1], [1, 2], [2, 1]] }, // dấu cộng
    ],

    // ═══════════════════════════════════════════════════════════
    // HỆ POKÉMON HOÁ (roster đang chơi / kho dự trữ / thu phục)
    // ═══════════════════════════════════════════════════════════
    ACTIVE_ROSTER_SIZE: 10,
    RESERVE_BATCH_SIZE: 15,
    RESERVE_REFILL_THRESHOLD: 3,
    POKEMON_ID_MAX: 649, // giới hạn Gen 1-5, khớp cách random enemy bên Battle

    activeRoster: [],   // [{id, url}] — nguồn để gán cho khối MỚI sinh ra
    reservePool: [],    // [{id, url}] — hàng chờ để thế chỗ khi có con bị thu phục
    usedIds: new Set(), // tránh trùng ngay giữa các đợt sinh, không chặn tuyệt đối
    collectedList: [],  // log các con đã thu phục trong ván (để vẽ dải UI)
    captureBusy: false, // khoá để hiện popup thu phục tuần tự, không đè lên nhau

    PRAISE_WORDS: ["EXCELLENT!", "GREAT!", "BRAVO!", "AWESOME!", "FANTASTIC!", "SUPER!"],

    pokemonSpriteUrl(id) {
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
    },

    preloadImage(url) {
        const img = new Image();
        img.src = url;
    },

    randomPokemonId(excludeSet) {
        let id, attempts = 0;
        do {
            id = Math.floor(Math.random() * this.POKEMON_ID_MAX) + 1;
            attempts++;
        } while (excludeSet && excludeSet.has(id) && attempts < 60);
        return id;
    },

    generateBatch(count, excludeSet) {
        const batch = [];
        const localExclude = new Set(excludeSet);
        for (let i = 0; i < count; i++) {
            const id = this.randomPokemonId(localExclude);
            localExclude.add(id);
            this.usedIds.add(id);
            const url = this.pokemonSpriteUrl(id);
            this.preloadImage(url);
            batch.push({ id, url });
        }
        return batch;
    },

    initRosterAndReserve() {
        this.activeRoster = this.generateBatch(this.ACTIVE_ROSTER_SIZE, this.usedIds);
        this.reservePool = this.generateBatch(this.RESERVE_BATCH_SIZE, this.usedIds);
    },

    refillReserveIfLow() {
        if (this.reservePool.length <= this.RESERVE_REFILL_THRESHOLD) {
            const more = this.generateBatch(this.RESERVE_BATCH_SIZE, this.usedIds);
            this.reservePool = this.reservePool.concat(more);
        }
    },

    pickRandomActivePokemon() {
        if (this.activeRoster.length === 0) {
            // an toàn: nếu vì lý do gì đó roster rỗng, tạo tạm 1 con mới
            return this.generateBatch(1, this.usedIds)[0];
        }
        return this.activeRoster[Math.floor(Math.random() * this.activeRoster.length)];
    },

    // Rút 1 con khỏi roster đang chơi (vì vừa bị "thu phục"), thế bằng 1 con
    // từ kho dự trữ, rồi bổ sung thêm dự trữ nếu sắp cạn.
    retireAndReplace(pokemonId) {
        const idx = this.activeRoster.findIndex(p => p.id === pokemonId);
        if (idx === -1) return; // đã bị rút trước đó rồi (2 line clear cùng lúc), bỏ qua
        this.activeRoster.splice(idx, 1);

        if (this.reservePool.length === 0) {
            this.reservePool = this.generateBatch(this.RESERVE_BATCH_SIZE, this.usedIds);
        }
        const replacement = this.reservePool.shift();
        this.activeRoster.push(replacement);
        this.refillReserveIfLow();
    },

    // ═══════════════════════════════════════════════════════════
    // ÂM THANH (tự tạo bằng Web Audio API — khỏi cần file mp3)
    // ═══════════════════════════════════════════════════════════
    _audioCtx: null,
    ensureAudioCtx() {
        if (!this._audioCtx) {
            this._audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        }
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
    playPlaceSound() {
        this.playTone(520, 0.08, "triangle", 0.22);
    },
    playClearSound(linesCleared) {
        const notes = [660, 880, 1046, 1318];
        const count = Math.min(notes.length, 1 + linesCleared);
        for (let i = 0; i < count; i++) {
            this.playTone(notes[i], 0.15, "sine", 0.25, i * 0.09);
        }
    },
    playCaptureSound() {
        this.playTone(784, 0.1, "sine", 0.22, 0);
        this.playTone(988, 0.1, "sine", 0.22, 0.09);
        this.playTone(1318, 0.18, "sine", 0.25, 0.18);
    },

    async init() {
        console.log("🧱 [DEBUG] BlockGame.init() started");

        this.setupGrid();
        this.renderBoard();
        this.attachTraySlotHandlers();
        this.initRosterAndReserve(); // preload ngầm ngay từ đầu, song song lúc học từ vựng

        // Pre-fetch dữ liệu quiz (4 kỹ năng) NGAY TỪ ĐẦU, chạy song song lúc
        // học từ vựng — giống hệt battle.js — để câu hỏi đầu tiên không bị
        // khựng chờ fetch network.
        if (window.QuizManager) window.QuizManager.prepareData();

        const quizOverlay = document.getElementById("quiz-overlay");
        if (quizOverlay) quizOverlay.style.display = "none";

        // Màn chọn cấp độ riêng cho Block Blast — 3 lựa chọn giống Battle
        const renderLevelSelect = (container) => {
            return new Promise((resolve) => {
                const LEVELS = [
                    { key: "de", emoji: "🟢", label: "Dễ", sub: "Hội thoại/đoạn văn ngắn" },
                    { key: "trung_binh", emoji: "🟡", label: "Trung bình", sub: "Độ dài vừa phải" },
                    { key: "kho", emoji: "🔴", label: "Khó", sub: "Hội thoại/đoạn văn dài" },
                ];
                container.innerHTML = `
                    <div style="text-align:center;">
                        <div style="font-size:16px;color:#FFCB05;font-weight:700;margin-bottom:18px;">🧱 Chọn cấp độ Block Blast!</div>
                        <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
                            ${LEVELS.map(lv => `
                                <div class="block-level-card" data-level="${lv.key}" style="
                                    background:rgba(255,255,255,.06); border:2px solid rgba(255,203,5,.3);
                                    border-radius:16px; padding:18px 22px; text-align:center; cursor:pointer;
                                    min-width:120px; transition:all .2s;">
                                    <div style="font-size:38px;">${lv.emoji}</div>
                                    <div style="font-weight:800;color:#FFCB05;margin-top:6px;font-size:16px;">${lv.label}</div>
                                    <div style="font-size:12px;color:#bbb;margin-top:4px;">${lv.sub}</div>
                                </div>`).join("")}
                        </div>
                    </div>`;
                container.querySelectorAll(".block-level-card").forEach(card => {
                    card.onclick = () => {
                        localStorage.setItem("selected_level", card.dataset.level);
                        resolve(card.dataset.level);
                    };
                });
            });
        };

        // Tên hàm PHẢI là startPokemonBattle vì pkm_vocabulary.js gọi cứng tên này
        window.startPokemonBattle = async () => {
            console.log("🧱 Chọn cấp độ trước khi vào Block Blast...");

            let mainCard = document.getElementById("mainCard");
            if (!mainCard) {
                mainCard = document.createElement("div");
                mainCard.id = "mainCard";
                document.body.appendChild(mainCard);
            }
            mainCard.style.cssText = `
                position: fixed; top:0; left:0; width:100vw; height:100dvh;
                background: radial-gradient(circle, #1a1c28 0%, #0a0c16 100%);
                z-index: 99999; display:flex; align-items:center; justify-content:center;
                padding:20px; box-sizing:border-box;
            `;

            await renderLevelSelect(mainCard);
            mainCard.style.display = "none";

            if (window.QuizManager) {
                window.QuizManager.loadLevel();
                window.QuizManager.initSkillPools();
            }

            this.startPlaying();
        };

        if (window.VocabularyModule && typeof window.VocabularyModule.start === "function") {
            console.log("📘 [Block] Gọi VocabularyModule chạy phần học từ vựng...");
            await window.VocabularyModule.start();
        } else {
            console.warn("⚠️ Không tìm thấy VocabularyModule, tự động vào thẳng Block Blast!");
            window.startPokemonBattle();
        }
    },

    startPlaying() {
        this.spawnTray();
        this.renderTray();
        this.updateScoreUI();
        this.updateStatsUI();
        this.scheduleNextQuiz();
    },

    // ═══════════════════════════════════════════════════════════
    // BÀN CỜ
    // ═══════════════════════════════════════════════════════════
    setupGrid() {
        this.grid = Array.from({ length: this.GRID_SIZE }, () => Array(this.GRID_SIZE).fill(null));
        this.pokemonGrid = Array.from({ length: this.GRID_SIZE }, () => Array(this.GRID_SIZE).fill(null));
    },

    renderBoard() {
        const board = document.getElementById("block-board");
        if (!board) return;
        board.innerHTML = "";
        for (let r = 0; r < this.GRID_SIZE; r++) {
            for (let c = 0; c < this.GRID_SIZE; c++) {
                const cell = document.createElement("div");
                cell.className = "block-cell";
                cell.dataset.r = r;
                cell.dataset.c = c;
                cell.addEventListener("click", () => this.handleCellClick(r, c));
                cell.addEventListener("mouseenter", () => this.handleCellHover(r, c));
                cell.addEventListener("mouseleave", () => this.clearPreview());
                board.appendChild(cell);
            }
        }
    },

    getCellEl(r, c) {
        return document.querySelector(`.block-cell[data-r="${r}"][data-c="${c}"]`);
    },

    paintCell(r, c, color, pokemonUrl) {
        const el = this.getCellEl(r, c);
        if (!el) return;
        if (color) {
            el.classList.add("filled");
            el.style.background = color;
            el.style.backgroundImage = pokemonUrl ? `url('${pokemonUrl}')` : "";
        } else {
            el.classList.remove("filled");
            el.style.background = "";
            el.style.backgroundImage = "";
        }
    },

    // ═══════════════════════════════════════════════════════════
    // KHAY KHỐI
    // ═══════════════════════════════════════════════════════════
    randomShape() {
        const shape = this.PIECE_SHAPES[Math.floor(Math.random() * this.PIECE_SHAPES.length)];
        const color = this.COLORS[Math.floor(Math.random() * this.COLORS.length)];
        const pokemon = this.pickRandomActivePokemon();
        return { cells: shape.cells, color, pokemon };
    },

    spawnTray() {
        this.tray = [this.randomShape(), this.randomShape(), this.randomShape()];
    },

    maybeRefillTray() {
        if (this.tray.every(p => !p)) this.spawnTray();
    },

    attachTraySlotHandlers() {
        [0, 1, 2].forEach(i => {
            const slot = document.getElementById(`traySlot${i}`);
            if (slot) slot.addEventListener("click", () => this.selectTraySlot(i));
        });
    },

    renderTray() {
        this.tray.forEach((piece, i) => {
            const slot = document.getElementById(`traySlot${i}`);
            if (!slot) return;
            slot.classList.remove("selected");
            if (!piece) {
                slot.classList.add("empty");
                slot.innerHTML = "";
                return;
            }
            slot.classList.remove("empty");
            const maxR = Math.max(...piece.cells.map(p => p[0])) + 1;
            const maxC = Math.max(...piece.cells.map(p => p[1])) + 1;
            const cellPx = Math.floor(70 / Math.max(maxR, maxC));
            const filledSet = new Set(piece.cells.map(p => `${p[0]}_${p[1]}`));
            const bg = piece.pokemon ? piece.pokemon.url : "";

            let html = `<div class="tray-piece-grid" style="grid-template-columns:repeat(${maxC},${cellPx}px);grid-template-rows:repeat(${maxR},${cellPx}px);">`;
            for (let r = 0; r < maxR; r++) {
                for (let c = 0; c < maxC; c++) {
                    const on = filledSet.has(`${r}_${c}`);
                    const style = on ? `background-color:${piece.color};background-image:url('${bg}');` : "";
                    html += `<div class="tray-piece-cell ${on ? "" : "empty"}" style="${style}"></div>`;
                }
            }
            html += `</div>`;
            slot.innerHTML = html;
        });

        if (this.selectedTrayIndex !== null && !this.tray[this.selectedTrayIndex]) {
            this.selectedTrayIndex = null;
        }
        if (this.selectedTrayIndex !== null) {
            document.getElementById(`traySlot${this.selectedTrayIndex}`)?.classList.add("selected");
        }
    },

    selectTraySlot(i) {
        if (this.isPaused || this.gameOver) return;
        if (!this.tray[i]) return;
        this.selectedTrayIndex = this.selectedTrayIndex === i ? null : i;
        this.renderTray();
    },

    // ═══════════════════════════════════════════════════════════
    // ĐẶT KHỐI
    // ═══════════════════════════════════════════════════════════
    canPlace(shapeCells, anchorR, anchorC) {
        for (const [dr, dc] of shapeCells) {
            const r = anchorR + dr, c = anchorC + dc;
            if (r < 0 || r >= this.GRID_SIZE || c < 0 || c >= this.GRID_SIZE) return false;
            if (this.grid[r][c]) return false;
        }
        return true;
    },

    handleCellHover(r, c) {
        if (this.selectedTrayIndex === null || this.isPaused || this.gameOver) return;
        const piece = this.tray[this.selectedTrayIndex];
        if (!piece) return;
        this.clearPreview();
        const ok = this.canPlace(piece.cells, r, c);
        piece.cells.forEach(([dr, dc]) => {
            const rr = r + dr, cc = c + dc;
            const el = this.getCellEl(rr, cc);
            if (el) el.classList.add(ok ? "preview-ok" : "preview-bad");
        });
    },

    clearPreview() {
        document.querySelectorAll(".block-cell.preview-ok, .block-cell.preview-bad")
            .forEach(el => el.classList.remove("preview-ok", "preview-bad"));
    },

    handleCellClick(r, c) {
        if (this.selectedTrayIndex === null || this.isPaused || this.gameOver) return;
        const idx = this.selectedTrayIndex;
        const piece = this.tray[idx];
        if (!piece) return;

        if (!this.canPlace(piece.cells, r, c)) {
            const board = document.getElementById("block-board");
            board?.classList.add("shake");
            setTimeout(() => board?.classList.remove("shake"), 300);
            return;
        }

        this.clearPreview();
        this.selectedTrayIndex = null;
        this.playPlaceSound();
        this.commitPlacement(idx, piece, r, c, { auto: false });
    },

    commitPlacement(idx, piece, anchorR, anchorC, opts = {}) {
        piece.cells.forEach(([dr, dc]) => {
            const r = anchorR + dr, c = anchorC + dc;
            this.grid[r][c] = piece.color;
            this.pokemonGrid[r][c] = piece.pokemon;
            this.paintCell(r, c, piece.color, piece.pokemon ? piece.pokemon.url : null);
            if (opts.auto) {
                const el = this.getCellEl(r, c);
                el?.classList.add("auto-placed");
                setTimeout(() => el?.classList.remove("auto-placed"), 700);
            }
        });

        this.score += piece.cells.length;
        this.tray[idx] = null;
        this.renderTray();

        setTimeout(() => {
            this.clearFullLines();
            this.updateScoreUI();
            this.maybeRefillTray();
            this.renderTray();
            this.checkGameOver();
        }, opts.auto ? 350 : 0);
    },

    clearFullLines() {
        const fullRows = [];
        const fullCols = [];
        for (let r = 0; r < this.GRID_SIZE; r++) {
            if (this.grid[r].every(cell => cell)) fullRows.push(r);
        }
        for (let c = 0; c < this.GRID_SIZE; c++) {
            if (this.grid.every(row => row[c])) fullCols.push(c);
        }
        if (fullRows.length === 0 && fullCols.length === 0) return;

        const cellsToClear = new Set();
        fullRows.forEach(r => { for (let c = 0; c < this.GRID_SIZE; c++) cellsToClear.add(`${r}_${c}`); });
        fullCols.forEach(c => { for (let r = 0; r < this.GRID_SIZE; r++) cellsToClear.add(`${r}_${c}`); });

        // Thu thập các loài Pokémon xuất hiện trong những ô sắp bị xoá — đây
        // chính là các con "bị thu phục" ở lượt này.
        const capturedMap = new Map(); // id -> {id,url}
        cellsToClear.forEach(key => {
            const [r, c] = key.split("_").map(Number);
            const p = this.pokemonGrid[r][c];
            if (p) capturedMap.set(p.id, p);
        });

        cellsToClear.forEach(key => {
            const [r, c] = key.split("_").map(Number);
            this.getCellEl(r, c)?.classList.add("clearing");
        });

        const linesCleared = fullRows.length + fullCols.length;
        this.score += linesCleared * linesCleared * 10;
        this.playClearSound(linesCleared);

        setTimeout(() => {
            cellsToClear.forEach(key => {
                const [r, c] = key.split("_").map(Number);
                this.grid[r][c] = null;
                this.pokemonGrid[r][c] = null;
                this.paintCell(r, c, null, null);
                this.getCellEl(r, c)?.classList.remove("clearing");
            });
            this.updateScoreUI();

            if (capturedMap.size > 0) {
                this.processCaptures(Array.from(capturedMap.values()));
            }
        }, 350);
    },

    // ═══════════════════════════════════════════════════════════
    // THU PHỤC POKÉMON (popup + dải "Đã thu phục")
    // ═══════════════════════════════════════════════════════════
    async processCaptures(list) {
        this.captureQueue = (this.captureQueue || []).concat(list);
        if (this.captureBusy) return;
        this.captureBusy = true;
        while (this.captureQueue.length > 0) {
            const pokemon = this.captureQueue.shift();
            await this.showCaptureEvent(pokemon);
        }
        this.captureBusy = false;
    },

    showCaptureEvent(pokemon) {
        return new Promise((resolve) => {
            this.retireAndReplace(pokemon.id);
            this.collectedList.push(pokemon);
            this.playCaptureSound();

            const popup = document.getElementById("capture-popup");
            const praiseEl = document.getElementById("capturePraiseText");
            const imgEl = document.getElementById("capturePokemonImg");
            if (praiseEl) praiseEl.innerText = this.PRAISE_WORDS[Math.floor(Math.random() * this.PRAISE_WORDS.length)];
            if (imgEl) imgEl.src = pokemon.url;

            if (popup) {
                popup.classList.remove("show");
                void popup.offsetWidth; // ép reflow để restart animation
                popup.classList.add("show");
            }

            // Icon "bay" từ popup vào dải thu phục
            const trayEl = document.getElementById("collected-tray");
            setTimeout(() => {
                if (popup && trayEl) {
                    const startRect = popup.getBoundingClientRect();
                    const fly = document.createElement("div");
                    fly.className = "fly-icon";
                    fly.style.backgroundImage = `url('${pokemon.url}')`;
                    fly.style.left = `${startRect.left + startRect.width / 2 - 20}px`;
                    fly.style.top = `${startRect.top + startRect.height / 2 - 20}px`;
                    document.body.appendChild(fly);

                    requestAnimationFrame(() => {
                        const endRect = trayEl.getBoundingClientRect();
                        fly.style.left = `${endRect.left + 10}px`;
                        fly.style.top = `${endRect.top + endRect.height / 2 - 20}px`;
                        fly.style.transform = "scale(0.4)";
                        fly.style.opacity = "0.3";
                    });

                    setTimeout(() => {
                        fly.remove();
                        this.appendCollectedIcon(pokemon);
                    }, 580);
                } else {
                    this.appendCollectedIcon(pokemon);
                }
            }, 550);

            setTimeout(resolve, 950);
        });
    },

    appendCollectedIcon(pokemon) {
        const trayEl = document.getElementById("collected-tray");
        if (!trayEl) return;
        const icon = document.createElement("div");
        icon.className = "collected-icon";
        icon.style.backgroundImage = `url('${pokemon.url}')`;
        icon.title = `#${pokemon.id}`;
        trayEl.appendChild(icon);
        trayEl.scrollLeft = trayEl.scrollWidth;
    },

    isBoardStuck() {
        const activePieces = this.tray.filter(p => p);
        if (activePieces.length === 0) return false; // sẽ được refill ngay
        for (const piece of activePieces) {
            for (let r = 0; r < this.GRID_SIZE; r++) {
                for (let c = 0; c < this.GRID_SIZE; c++) {
                    if (this.canPlace(piece.cells, r, c)) return false;
                }
            }
        }
        return true;
    },

    findFirstFitPosition(shapeCells) {
        for (let r = 0; r < this.GRID_SIZE; r++) {
            for (let c = 0; c < this.GRID_SIZE; c++) {
                if (this.canPlace(shapeCells, r, c)) return { r, c };
            }
        }
        return null;
    },

    // Phạt khi trả lời sai: tự chọn 1 khối trong khay và ghép vào ô đầu tiên
    // tìm thấy (không tối ưu để phá hàng) — mô phỏng "rơi thẳng" ẩu.
    autoPlayPenalty() {
        for (let idx = 0; idx < this.tray.length; idx++) {
            const piece = this.tray[idx];
            if (!piece) continue;
            const pos = this.findFirstFitPosition(piece.cells);
            if (pos) {
                this.commitPlacement(idx, piece, pos.r, pos.c, { auto: true });
                return;
            }
        }
        // Không khối nào đặt được nữa — bàn cờ coi như đã kẹt, checkGameOver() sẽ xử lý.
    },

    setInteractionEnabled(enabled) {
        document.getElementById("block-board")?.classList.toggle("locked", !enabled);
        document.getElementById("tray-area")?.classList.toggle("locked", !enabled);
        if (!enabled) this.clearPreview();
    },

    // ═══════════════════════════════════════════════════════════
    // QUIZ ĐỊNH KỲ (20-30s)
    // ═══════════════════════════════════════════════════════════
    scheduleNextQuiz() {
        if (this.gameOver) return;
        const delay = 20000 + Math.random() * 10000;
        clearTimeout(this.quizTimer);
        this.quizTimer = setTimeout(() => this.triggerQuiz(), delay);
    },

    triggerQuiz() {
        if (this.gameOver || this.isPaused) return;
        this.isPaused = true;
        this.selectedTrayIndex = null;
        this.setInteractionEnabled(false);

        if (window.QuizManager) {
            window.QuizManager.ask((isCorrect) => this.onQuizAnswered(isCorrect));
        } else {
            this.onQuizAnswered(true);
        }
    },

    // Suy ra kỹ năng của câu VỪA hỏi từ skillCycleIndex của QuizManager.
    // pickNextTypeName() bên pkm_quiz.js tăng skillCycleIndex NGAY TRƯỚC khi
    // xử lý câu hỏi, và không có lần tăng nào khác xảy ra giữa lúc đó và lúc
    // callback (isCorrect) được gọi — nên (skillCycleIndex - 1) chính là chỉ
    // số của kỹ năng vừa hỏi, kể cả khi có các lượt "bỏ qua do thiếu dữ liệu"
    // trước đó (mỗi lượt bỏ qua cũng tự tăng biến này).
    getSkillJustAsked() {
        if (!window.QuizManager || typeof window.QuizManager.skillCycleIndex !== "number") return null;
        const order = this.SKILL_ORDER_LOCAL;
        const idx = ((window.QuizManager.skillCycleIndex - 1) % order.length + order.length) % order.length;
        return order[idx];
    },

    onQuizAnswered(isCorrect) {
        const skillName = this.getSkillJustAsked();

        this.totalCount++;
        if (isCorrect) this.correctCount++; else this.wrongCount++;
        if (skillName && this.skillStats[skillName]) {
            this.skillStats[skillName].total++;
            if (isCorrect) this.skillStats[skillName].correct++;
        }
        this.updateStatsUI();

        this.isPaused = false;
        this.setInteractionEnabled(true);

        if (!isCorrect) this.autoPlayPenalty();

        if (this.checkGameOver()) return;
        this.scheduleNextQuiz();
    },

    // ═══════════════════════════════════════════════════════════
    // UI PHỤ
    // ═══════════════════════════════════════════════════════════
    updateScoreUI() {
        const el = document.getElementById("blockScoreValue");
        if (el) el.innerText = this.score;
    },

    updateStatsUI() {
        const el = document.getElementById("quiz-stats");
        if (el) el.innerHTML = `✅ ${this.correctCount} &nbsp; ❌ ${this.wrongCount} &nbsp; 📊 ${this.totalCount} câu`;
    },

    // ═══════════════════════════════════════════════════════════
    // KẾT THÚC GAME
    // ═══════════════════════════════════════════════════════════
    checkGameOver() {
        if (this.gameOver) return true;

        if (this.isBoardStuck()) {
            this.gameOver = true;
            clearTimeout(this.quizTimer);
            this.defeat();
            return true;
        }

        if (this.totalCount >= this.MAX_QUESTIONS) {
            this.gameOver = true;
            clearTimeout(this.quizTimer);
            this.victory();
            return true;
        }

        return false;
    },

    updateStreak() {
        const today = new Date().toISOString().slice(0, 10);
        const lastPlay = localStorage.getItem("pkm_last_play_date") || "";
        let streak = parseInt(localStorage.getItem("pkm_streak_days")) || 0;

        if (lastPlay === today) {
            // đã chơi hôm nay rồi
        } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            if (lastPlay === yesterday) streak++;
            else streak = 1;
            localStorage.setItem("pkm_last_play_date", today);
            localStorage.setItem("pkm_streak_days", streak);
        }
        return streak;
    },

    // Lưu kết quả: TỔNG dùng chung key với Battle (result_battle) để cộng dồn
    // xuyên suốt mọi game, và chi tiết theo 4 kỹ năng vào pkm_skill_scores
    // (cũng cộng dồn, dùng chung cho mọi game trong tương lai).
    saveBattleResult() {
        try {
            const prevTotal = JSON.parse(localStorage.getItem("result_battle")) || { score: 0, total: 0 };
            const updatedTotal = {
                score: (prevTotal.score || 0) + this.correctCount,
                total: (prevTotal.total || 0) + this.totalCount,
            };
            localStorage.setItem("result_battle", JSON.stringify(updatedTotal));

            const defaultSkills = () => ({
                listening: { correct: 0, total: 0 },
                speaking: { correct: 0, total: 0 },
                reading: { correct: 0, total: 0 },
                writing: { correct: 0, total: 0 },
            });
            const prevSkills = JSON.parse(localStorage.getItem("pkm_skill_scores")) || defaultSkills();
            Object.keys(this.skillStats).forEach(skill => {
                if (!prevSkills[skill]) prevSkills[skill] = { correct: 0, total: 0 };
                prevSkills[skill].correct += this.skillStats[skill].correct;
                prevSkills[skill].total += this.skillStats[skill].total;
            });
            localStorage.setItem("pkm_skill_scores", JSON.stringify(prevSkills));

            if (!localStorage.getItem("startTime_global")) {
                localStorage.setItem("startTime_global", Date.now().toString());
            }
        } catch (e) {
            console.error("❌ Lỗi lưu kết quả Block Blast:", e);
        }
    },

    async getRewardImage() {
        try {
            const inv = JSON.parse(localStorage.getItem("pkm_inventory")) || [];
            const team = inv.filter(p => p.inTeam).sort((a, b) => a.position - b.position);
            if (team.length > 0) return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${team[0].id}.png`;
        } catch (e) { /* ignore */ }
        return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/25.png`;
    },

    victory() {
        this.saveBattleResult();

        const missionData = localStorage.getItem("current_mission");
        const currentLessonId = missionData ? JSON.parse(missionData).id : null;
        let passedMaps = JSON.parse(localStorage.getItem("pkm_passed_maps")) || [];
        let currentEXP = parseInt(localStorage.getItem("pkm_global_exp")) || 0;
        let currentDV = parseInt(localStorage.getItem("pkm_global_dv")) || 0;
        const isNewLesson = currentLessonId && !passedMaps.includes(currentLessonId);

        let bonusEXP = 0, bonusDV = 0;
        let messages = [];

        const accuracy = this.totalCount > 0 ? Math.round((this.correctCount / this.totalCount) * 100) : 0;

        if (isNewLesson) {
            if (accuracy >= 80) {
                bonusEXP += 5; bonusDV += 5;
                passedMaps.push(currentLessonId);
                localStorage.setItem("pkm_passed_maps", JSON.stringify(passedMaps));
                messages.push(`🌟 BÀI MỚI HOÀN THÀNH (${accuracy}% đúng): <b>+5 KN +5 DV</b>`);
            } else {
                messages.push(`⚠️ Bài mới nhưng chỉ ${accuracy}% đúng — cần ≥80% để mở khoá!`);
            }
        }

        const reward2 = Math.round(this.correctCount / 2);
        if (reward2 > 0) {
            bonusEXP += reward2; bonusDV += reward2;
            messages.push(`📝 ${this.correctCount} câu đúng ÷ 2 = <b>+${reward2} KN +${reward2} DV</b>`);
        }

        const streak = this.updateStreak();
        let streakBonus = 0;
        if (streak >= 30) streakBonus = 3;
        else if (streak >= 10) streakBonus = 2;
        else if (streak >= 4) streakBonus = 1;
        if (streakBonus > 0) {
            bonusEXP += streakBonus; bonusDV += streakBonus;
            messages.push(`🔥 Chuỗi ${streak} ngày liên tục: <b>+${streakBonus} KN +${streakBonus} DV</b>`);
        } else {
            messages.push(`📅 Chuỗi hiện tại: <b>${streak} ngày</b>`);
        }

        const newEXP = currentEXP + bonusEXP;
        const newDV = currentDV + bonusDV;
        localStorage.setItem("pkm_global_exp", newEXP);
        localStorage.setItem("pkm_global_dv", newDV);

        this.getRewardImage().then(src => {
            const img = document.getElementById("victory-pkm-img");
            if (img) img.src = src;
        });

        const titleEl = document.getElementById("victory-title-text");
        if (titleEl) titleEl.innerText = "🏆 HOÀN THÀNH!";

        const skillLines = this.SKILL_ORDER_LOCAL.map(s => {
            const st = this.skillStats[s];
            const label = { listening: "🎧 Nghe", speaking: "🗣️ Nói", reading: "📖 Đọc", writing: "✍️ Viết" }[s];
            return `<div>${label}: ${st.correct}/${st.total}</div>`;
        }).join("");

        const expText = document.getElementById("victory-exp-text");
        if (expText) {
            expText.innerHTML = `
                <div style="font-size:13px; text-align:left; margin-bottom:12px; line-height:2;">
                    ${messages.map(m => `<div>${m}</div>`).join("")}
                </div>
                <div style="border-top:1px solid #444; padding-top:10px; margin-bottom:12px;">
                    <div style="color:#4caf50; font-size:16px; font-weight:bold;">+${bonusEXP} KN &nbsp; +${bonusDV} DV</div>
                    <div style="color:#aaa; font-size:12px;">Tổng: ${newEXP} KN | ${newDV} DV</div>
                </div>
                <div style="color:#aaa; font-size:12px; margin-bottom:4px;">
                    🧱 Điểm Block Blast: ${this.score}
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

    defeat() {
        this.saveBattleResult();

        this.getRewardImage().then(src => {
            const img = document.getElementById("victory-pkm-img");
            if (img) {
                img.src = src;
                img.style.filter = "grayscale(100%) opacity(0.7)";
            }
        });

        const titleEl = document.getElementById("victory-title-text");
        if (titleEl) {
            titleEl.innerText = "💥 BÀN CỜ ĐÃ ĐẦY!";
            titleEl.style.color = "#e74c3c";
            titleEl.style.textShadow = "0 0 30px #e74c3c, 0 0 60px #c0392b";
        }

        const skillLines = this.SKILL_ORDER_LOCAL.map(s => {
            const st = this.skillStats[s];
            const label = { listening: "🎧 Nghe", speaking: "🗣️ Nói", reading: "📖 Đọc", writing: "✍️ Viết" }[s];
            return `<div>${label}: ${st.correct}/${st.total}</div>`;
        }).join("");

        const expText = document.getElementById("victory-exp-text");
        if (expText) {
            expText.innerHTML = `
                <div style="color:#ccc; margin-bottom:14px;">Không còn khối nào đặt vừa bàn cờ nữa!</div>
                <div style="font-size:13px; text-align:left; margin-bottom:12px; line-height:1.8;">
                    <div>🧱 Điểm Block Blast: <b>${this.score}</b></div>
                    <div>📊 Tổng: ✅ ${this.correctCount} đúng / ❌ ${this.wrongCount} sai / ${this.totalCount} câu</div>
                </div>
                <div style="color:#8fa3d1; font-size:11px; text-align:left; margin-bottom:10px;">
                    ${skillLines}
                </div>
                <div style="font-size:12px; color:#ffbc00;">Chơi lại để cải thiện điểm và nhận thưởng nhé!</div>`;
        }

        const overlay = document.getElementById("victory-overlay");
        if (overlay) overlay.style.display = "flex";
    },
};

window.BlockGame.init();
