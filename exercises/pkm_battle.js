/**
 * ==========================================
 * POKEMON BATTLE LOGIC - TURN BASED VERSION
 * ==========================================
 */

window.BattleGame = {
    playerTeam: [],
    enemyTeam: [],
    activeUnitIndex: 0, // Chỉ số con đang đến lượt (0-4)
    isPlayerSide: true, // Đang là lượt phe mình hay phe địch
    isProcessing: false,
    // Thống kê câu hỏi
    correctCount: 0,
    wrongCount: 0,
    totalCount: 0,

    async init() {
        console.log("⚔️ [DEBUG] BattleGame.init() started");

        const inv = JSON.parse(localStorage.getItem('pkm_inventory')) || [];
        const team = inv.filter(p => p.inTeam).sort((a, b) => a.position - b.position);

        if (team.length === 0) {
            alert("Đội hình trống!");
            window.location.href = 'pkm_team.html';
            return;
        }

        this.playerTeam = team.map(p => this.calculateStats(p, false));
        this.enemyTeam  = team.map(p => this.calculateStats(p, true));

        // ✅ THÊM LOGIC NÀY: Lấy tên thật cho đối thủ dựa trên ID ngẫu nhiên đã tạo
        // ✅ SỬA TRONG BattleGame.init()
        for (let p of this.enemyTeam) {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.id}`);
                const data = await res.json();

                // 1. Ghi đè tên
                p.name = data.name.charAt(0).toUpperCase() + data.name.slice(1);

                // 2. Ghi đè hệ (Type) - Lấy hệ đầu tiên của Pokemon đó
                if (data.types && data.types.length > 0) {
                    p.type = data.types[0].type.name; 
                }

                // 3. (Tùy chọn) Ghi đè Gen nếu sếp muốn hiệu ứng xịn theo đúng con đó
                // Pokemon ID > 493 thường là Gen 5 trở đi, sếp có thể tạm logic hóa ở đây

            } catch (e) {
                p.name = "Unknown";
                p.type = "normal";
            }
        }

        if (window.QuizManager) window.QuizManager.prepareData();

        this.renderBattlefield();
        setTimeout(() => this.nextTurn(), 500);
    },

    calculateStats(pkm, isEnemy) {
        // 1. Lấy chỉ số gốc từ dữ liệu
        const stats = pkm.baseStats || {};
        let hp  = parseInt(stats.hp)  || parseInt(pkm.hp)  || 20;
        let atk = parseInt(stats.atk) || parseInt(pkm.atk) || 20;
        let def = parseInt(stats.def) || parseInt(pkm.def) || 15;

        // 2. Tính toán Bonus Trang bị (Chỉ dành cho Quân mình)
        if (!isEnemy) {
            // Đọc danh sách các ID trang bị đang mặc từ LocalStorage
            const equipped = JSON.parse(localStorage.getItem('pkm_equipped')) || {};
            const equippedIds = Object.values(equipped); // Ví dụ: ["weapon_silver", "armor_gold", ...]

            let bonusAtk = 0, bonusDef = 0, bonusHP = 0;

            // Bảng tra cứu bonus theo phẩm chất (Rank)
            const rankBonusMap = { 
                'silver': 0.02, // Bạc 2%
                'gold':   0.03, // Vàng (Trung bình) 3%
                'red':    0.04, // Đỏ (Cao cấp) 4%
                'orange': 0.05  // Cam (Truyền thuyết) 5%
            };

            equippedIds.forEach(id => {
                const parts = id.split('_'); // Tách chuỗi ví dụ "weapon_silver" -> ["weapon", "silver"]
                const type = parts[0];
                const rank = parts[1];
                const b = rankBonusMap[rank] || 0;

                // Phân loại slot đồ cộng vào chỉ số nào
                if (type === 'weapon' || type === 'gloves') {
                    bonusAtk += b;
                } else if (type === 'armor' || type === 'earring') {
                    bonusDef += b;
                } else if (type === 'helmet' || type === 'shoes') {
                    bonusHP += b;
                }
            });

            // Áp dụng % bonus vào chỉ số gốc của Quân mình
            atk = Math.floor(atk * (1 + bonusAtk));
            def = Math.floor(def * (1 + bonusDef));
            hp  = Math.floor(hp  * (1 + bonusHP));
        }

        // 3. Tính toán máu thực tế (baseHP)
        // Công thức game của bạn: (Chỉ số * 10) + 200
        const baseHP = (hp * 15) + 200;
        const randomPkmID = Math.floor(Math.random() * 1010) + 1;

        return {
            ...pkm,
            id: isEnemy ? randomPkmID : pkm.id,
            // ✅ SỬA TẠI ĐÂY: Nếu là địch, tạm thời để tên là "Đang tải..." 
            // để sau đó hàm fetch sẽ đè tên đúng vào.
            name: isEnemy ? "Loading..." : pkm.name, 
            maxHp: isEnemy ? Math.floor(baseHP * 0.7) : baseHP,
            currentHp: isEnemy ? Math.floor(baseHP * 0.7) : baseHP,
            atk: atk, 
            def: def,
            type: pkm.type || 'normal',
            gen: pkm.gen || 1
        };
    },

    nextTurn() {
        if (this.isProcessing || this.checkGameOver()) return;

        // Xác định con đang đứng ở vị trí hiện tại của phe đang đến lượt
        const attacker = this.isPlayerSide ? 
            this.playerTeam[this.activeUnitIndex] : 
            this.enemyTeam[this.activeUnitIndex];

        // Nếu con này đã chết, bỏ qua chuyển sang thực thể tiếp theo
        if (!attacker || attacker.currentHp <= 0) {
            return this.moveToNextUnit();
        }

        if (this.isPlayerSide) {
            this.log(`Lượt của ${attacker.name} (Phe mình)`);
            if (window.QuizManager) {
                window.QuizManager.ask((isCorrect) => this.handleAction(isCorrect, 'player'));
            }
        } else {
            this.log(`Lượt của ${attacker.name} (Đối thủ)`);
            setTimeout(() => this.handleAction(true, 'enemy'), 1000);
        }
    },

    // Hàm bổ trợ để chuyển lượt
    moveToNextUnit() {
        if (this.isPlayerSide) {
            this.isPlayerSide = false; // Xong lượt mình vị trí X -> sang lượt địch vị trí X
        } else {
            this.isPlayerSide = true; 
            this.activeUnitIndex = (this.activeUnitIndex + 1) % this.playerTeam.length; // Sang vị trí X+1
        }
        this.nextTurn();
    },

    // Tìm đến đoạn async handleAction(isCorrect, side) và thay đổi phần nội dung bên trong:

    async handleAction(isCorrect, side) {
        this.isProcessing = true;
        // Chỉ đếm lượt của player
        if (side === 'player') {
            this.totalCount++;
            if (isCorrect) this.correctCount++;
            else this.wrongCount++;
            // Cập nhật UI thống kê
            const statEl = document.getElementById('quiz-stats');
            if (statEl) statEl.innerHTML = 
                `✅ ${this.correctCount} &nbsp; ❌ ${this.wrongCount} &nbsp; 📊 ${this.totalCount} câu`;
        }
        const attacker = side === 'player' ? this.playerTeam[this.activeUnitIndex] : this.enemyTeam[this.activeUnitIndex];
        const opponentTeam = side === 'player' ? this.enemyTeam : this.playerTeam;
        // ✅ THÊM DÒNG NÀY Ở ĐÂY: Đọc tên Pokemon ngay khi bắt đầu hành động
        if (attacker && attacker.name && window.SkillManager) {
            window.SkillManager.speakName(attacker.name);
        }

        // 1. Tìm mục tiêu hàng thủ (luôn ưu tiên con đầu tiên còn sống)
        const targetIdx = opponentTeam.findIndex(p => p.currentHp > 0);
        if (targetIdx === -1) return this.checkGameOver();

        attacker.personalTurn = (attacker.personalTurn || 0) + 1;

        if (!isCorrect) {
            this.log(`${attacker.name} đánh hụt!`);
            await window.SkillManager.play({ 
                attackerIndex: this.activeUnitIndex, 
                attackerSide: side, 
                missed: true,
                targets: [] // ✅ Thêm để tránh lỗi .map()
            });
        } 
        else if (attacker.personalTurn % 2 !== 0) {
            // --- LƯỢT LẺ: ĐÁNH THƯỜNG ---
            const target = opponentTeam[targetIdx];
            const damage = Math.max(15, attacker.atk - target.def);
            target.currentHp = Math.max(0, target.currentHp - damage);

            this.log(`${attacker.name} đánh thường vào ${target.name}!`);

            await window.SkillManager.play({
                type: 'normal',
                gen: 1,
                attackerIndex: this.activeUnitIndex,
                attackerSide: side,
                attackerId: attacker.id,   // Thêm cái này
                attackerName: attacker.name, // Thêm cái này
                targetSide: side === 'player' ? 'enemy' : 'player',
                damage,
                isAOE: false,
                targets: [targetIdx],
                isSkill: false
            });
        } 
        else {
            // --- LƯỢT CHẴN: SKILL AOE ---
            const aliveTargets = opponentTeam.map((p, i) => p.currentHp > 0 ? i : -1).filter(i => i !== -1);
            let lastDamage = 0; 
            const targetSide = side === 'player' ? 'enemy' : 'player';

            aliveTargets.forEach(idx => {
                const target = opponentTeam[idx];
                const damage = Math.max(20, Math.floor(attacker.atk - (target.def * 0.3)));
                target.currentHp = Math.max(0, target.currentHp - damage);
                lastDamage = damage; 
            });

            // GỌI SKILL VỚI ĐẦY ĐỦ THÔNG TIN
            await window.SkillManager.play({
                type: attacker.type || 'normal',
                gen: attacker.gen || 1,
                attackerIndex: this.activeUnitIndex,
                attackerSide: side,
                attackerId: attacker.id,   // Thêm cái này
                attackerName: attacker.name, // Thêm cái này
                targetSide: targetSide,
                targets: aliveTargets,
                damage: lastDamage,
                isAOE: true,
                isSkill: true
            });
        }

        this.updateUI();
        this.isProcessing = false;
        setTimeout(() => this.moveToNextUnit(), 1200); 
    },

    

    renderBattlefield() {
        const pContainer = document.getElementById('player-team-container');
        const eContainer = document.getElementById('enemy-team-container');
        if (!pContainer || !eContainer) return;
        pContainer.innerHTML = '';
        eContainer.innerHTML = '';
        this.playerTeam.forEach((p, i) => { pContainer.innerHTML += this.createUnitHTML(p, i, 'player'); });
        this.enemyTeam.forEach((p, i)  => { eContainer.innerHTML += this.createUnitHTML(p, i, 'enemy');  });
        this.updateActiveStatus();
    },

    createUnitHTML(pkm, index, side) {
        // 0,1 to (45%) chiếm hàng riêng, 2,3,4 nhỏ (30%) chiếm hàng riêng
        const widthStyle = (index < 2) ? "width: 45%;" : "width: 30%;";
        const imgPath = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${pkm.id}.png`;

        return `
            <div class="pkm-unit" id="${side}-unit-${index}" style="${widthStyle}; margin-bottom: 10px;">
                <img src="${imgPath}" id="${side}-img-${index}" style="width: 100%; height: auto; max-width: 80px;">
                <div class="unit-stats">
                    <div class="hp-text" id="${side}-hp-text-${index}" style="font-size: 10px;">${pkm.currentHp}/${pkm.maxHp}</div>
                    <div class="hp-bar" style="height: 6px;">
                        <div class="hp-fill" id="${side}-hp-fill-${index}" style="width: 100%"></div>
                    </div>
                </div>
            </div>`;
    },

    updateUI() {
        [...this.playerTeam.entries()].forEach(([i, p]) => {
            const fill = document.getElementById(`player-hp-fill-${i}`);
            const text = document.getElementById(`player-hp-text-${i}`);
            if (fill) {
                const pct = Math.max(0, (p.currentHp / p.maxHp) * 100);
                fill.style.width      = pct + "%";
                fill.style.background = pct > 50 ? "#2ecc71" : pct > 25 ? "#f1c40f" : "#e74c3c";
            }
            if (text) text.innerText = `${Math.max(0, p.currentHp)}/${p.maxHp}`;
        });

        [...this.enemyTeam.entries()].forEach(([i, p]) => {
            const fill = document.getElementById(`enemy-hp-fill-${i}`);
            const text = document.getElementById(`enemy-hp-text-${i}`);
            if (fill) {
                const pct = Math.max(0, (p.currentHp / p.maxHp) * 100);
                fill.style.width      = pct + "%";
                fill.style.background = pct > 50 ? "#2ecc71" : pct > 25 ? "#f1c40f" : "#e74c3c";
            }
            if (text) text.innerText = `${Math.max(0, p.currentHp)}/${p.maxHp}`;
        });

        this.updateActiveStatus();
    },

    updateActiveStatus() {
        document.querySelectorAll('.pkm-unit').forEach(u => u.classList.remove('active-unit'));
        const side = this.isPlayerSide ? 'player' : 'enemy';
        const activeEl = document.getElementById(`${side}-unit-${this.activeUnitIndex}`);
        if (activeEl) activeEl.classList.add('active-unit');
    },
    log(msg) {
        console.log("🎮 [BATTLE]: " + msg);
        const logElement = document.getElementById('turn-display'); // Đã đổi ID
        if (logElement) {
            logElement.innerHTML = msg;
            logElement.style.display = 'block';

            // Tự động ẩn sau 1.2 giây để tiếp tục trận đấu
            if (this.turnTimeout) clearTimeout(this.turnTimeout);
            this.turnTimeout = setTimeout(() => {
                logElement.style.display = 'none';
            }, 1200);
        }
    }, // Thêm dấu phẩy ở đây

    checkGameOver() {
        const isEnemyOut = this.enemyTeam.every(p => p.currentHp <= 0);
        const isPlayerOut = this.playerTeam.every(p => p.currentHp <= 0);

        if (isEnemyOut) { 
            this.victory(); 
            return true; 
        }
        if (isPlayerOut) { 
            this.defeat(); 
            return true; 
        }
        return false;
    },
    

    // ✅ Victory: hiện overlay đẹp, chờ bấm nút mới về map
    victory() {
        this.log("🏆 CHIẾN THẮNG!");

        // ── 1. ĐỌC DỮ LIỆU ──
        const missionData     = localStorage.getItem('current_mission');
        const currentLessonId = missionData ? JSON.parse(missionData).id : null;
        let passedMaps        = JSON.parse(localStorage.getItem('pkm_passed_maps')) || [];
        let currentEXP        = parseInt(localStorage.getItem('pkm_global_exp')) || 0;
        let currentDV         = parseInt(localStorage.getItem('pkm_global_dv'))  || 0;
        const isNewLesson     = currentLessonId && !passedMaps.includes(currentLessonId);

        let bonusEXP = 0, bonusDV = 0;
        let messages = [];

        // ── 2. THƯỞNG 1: BÀI MỚI (cần >= 90% đúng) ──
        const accuracy = this.totalCount > 0
            ? Math.round((this.correctCount / this.totalCount) * 100) : 0;

        if (isNewLesson) {
            if (accuracy >= 90) {
                bonusEXP += 5; bonusDV += 5;
                passedMaps.push(currentLessonId);
                localStorage.setItem('pkm_passed_maps', JSON.stringify(passedMaps));
                messages.push(`🌟 BÀI MỚI HOÀN THÀNH (${accuracy}% đúng): <b>+5 KN +5 DV</b>`);
            } else {
                messages.push(`⚠️ Bài mới nhưng chỉ ${accuracy}% đúng — cần ≥90% để mở khoá!`);
            }
        }

        // ── 3. THƯỞNG 2: SỐ CÂU ĐÚNG / 5 ──
        const reward2 = Math.round(this.correctCount / 5);
        if (reward2 > 0) {
            bonusEXP += reward2; bonusDV += reward2;
            messages.push(`📝 ${this.correctCount} câu đúng ÷ 5 = <b>+${reward2} KN +${reward2} DV</b>`);
        }

        // ── 4. THƯỞNG 3: CHĂM CHỈ (chuỗi ngày liên tục) ──
        const streak = this.updateStreak();
        let streakBonus = 0;
        if      (streak >= 30) streakBonus = 3;
        else if (streak >= 10) streakBonus = 2;
        else if (streak >= 4)  streakBonus = 1;

        if (streakBonus > 0) {
            bonusEXP += streakBonus; bonusDV += streakBonus;
            messages.push(`🔥 Chuỗi ${streak} ngày liên tục: <b>+${streakBonus} KN +${streakBonus} DV</b>`);
        } else {
            messages.push(`📅 Chuỗi hiện tại: <b>${streak} ngày</b>`);
        }

        // ── 5. LƯU ──
        const newEXP = currentEXP + bonusEXP;
        const newDV  = currentDV  + bonusDV;
        localStorage.setItem('pkm_global_exp', newEXP);
        localStorage.setItem('pkm_global_dv',  newDV);

        // ── 6. HIỆN UI ──
        const firstPkm   = this.playerTeam[0];
        const victoryImg = document.getElementById('victory-pkm-img');
        if (victoryImg && firstPkm) {
            victoryImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${firstPkm.id}.png`;
        }

        const expText = document.getElementById('victory-exp-text');
        if (expText) {
            expText.innerHTML = `
                <div style="font-size:13px; text-align:left; margin-bottom:12px; line-height:2;">
                    ${messages.map(m => `<div>${m}</div>`).join('')}
                </div>
                <div style="border-top:1px solid #444; padding-top:10px; margin-bottom:12px;">
                    <div style="color:#4caf50; font-size:16px; font-weight:bold;">+${bonusEXP} KN &nbsp; +${bonusDV} DV</div>
                    <div style="color:#aaa; font-size:12px;">Tổng: ${newEXP} KN | ${newDV} DV</div>
                </div>
                <div style="color:#aaa; font-size:12px; margin-bottom:12px;">
                    📊 Kết quả: ✅ ${this.correctCount} đúng / ❌ ${this.wrongCount} sai / tổng ${this.totalCount} câu
                </div>
                <button onclick="window.location.href='pkm_map.html'"
                        style="background:#2ecc71; color:white; border:none; padding:10px 30px;
                               border-radius:25px; cursor:pointer; font-weight:bold;">
                    TIẾP TỤC
                </button>
            `;
        }

        const overlay = document.getElementById('victory-overlay');
        if (overlay) overlay.style.display = 'flex';
    },

    // ── HÀM TÍNH CHUỖI NGÀY ──
    updateStreak() {
        const today     = new Date().toISOString().slice(0, 10); // "2025-01-15"
        const lastPlay  = localStorage.getItem('pkm_last_play_date') || '';
        let   streak    = parseInt(localStorage.getItem('pkm_streak_days')) || 0;

        if (lastPlay === today) {
            // Hôm nay đã chơi rồi → không tăng, giữ nguyên streak
        } else {
            const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
            if (lastPlay === yesterday) {
                // Hôm qua có chơi → tăng streak
                streak++;
            } else if (lastPlay === '') {
                // Lần đầu chơi
                streak = 1;
            } else {
                // Bỏ ngày → reset
                streak = 1;
            }
            localStorage.setItem('pkm_last_play_date', today);
            localStorage.setItem('pkm_streak_days', streak);
        }

        return streak;
    },
    defeat() {
        this.log("💀 BẠN ĐÃ THẤT BẠI!");
        this.isProcessing = true; 

        // 1. Cập nhật hình ảnh Pokemon thất bại (làm xám)
        const firstPkm = this.playerTeam[0];
        const victoryImg = document.getElementById('victory-pkm-img');
        if (victoryImg && firstPkm) {
            victoryImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${firstPkm.id}.png`;
            victoryImg.style.filter = "grayscale(100%) opacity(0.7)";
        }

        // 2. Nội dung thông báo và Nút quay lại
        const expText = document.getElementById('victory-exp-text');
        if (expText) {
            expText.innerHTML = `
                <div style="color: #ff4757; font-weight: bold; font-size: 1.5em; margin-bottom: 10px;">THẤT BẠI</div>
                <p style="color: #ccc; margin-bottom: 20px;">Đội hình của bạn đã kiệt sức!</p>

                <div style="background: rgba(0,0,0,0.3); padding: 15px; border-radius: 8px; border: 1px solid #444; margin-bottom: 20px;">
                    <div style="color: #888; text-decoration: line-through;">+10 EXP</div>
                    <div style="color: #888; text-decoration: line-through;">+10 Danh vọng</div>
                    <div style="font-size: 0.8em; margin-top: 5px; color: #ffbc00;">Thử thách lại để nhận thưởng!</div>
                </div>

                <!-- Nút bấm quay lại Map -->
                <button onclick="window.location.href='pkm_map.html'" 
                        style="background: #444; color: white; border: 2px solid #666; padding: 10px 30px; 
                               border-radius: 25px; cursor: pointer; font-weight: bold; transition: 0.3s;"
                        onmouseover="this.style.background='#ff4757'; this.style.borderColor='#fff'"
                        onmouseout="this.style.background='#444'; this.style.borderColor='#666'">
                    QUAY LẠI BẢN ĐỒ
                </button>
            `;
        }

        // 3. Hiển thị Overlay
        const overlay = document.getElementById('victory-overlay');
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.backgroundColor = "rgba(0, 0, 0, 0.85)";
        }
    }
};

window.BattleGame.init();
