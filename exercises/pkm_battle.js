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
    telegraph: null, // Kế hoạch (attacker/target/AOE) đã "dự báo" trước 1 lượt, đang hiện FX chờ tới lượt thực thi
    pendingHealBursts: [], // Hàng đợi hiệu ứng buff (hồi máu) chờ phát SAU khi animation đòn đánh đã tắt hẳn
    // Thống kê câu hỏi
    correctCount: 0,
    wrongCount: 0,
    totalCount: 0,


        async init() {
        console.log("⚔️ [DEBUG] BattleGame.init() started");

        const inv = JSON.parse(localStorage.getItem('pkm_inventory')) || [];

        // 🔧 TỰ ĐỘNG DỌN DỮ LIỆU CŨ: đội hình tối đa giờ chỉ còn 3
        let migrated = false;
        inv.forEach(p => {
            if (p.inTeam && p.position > 3) {
                p.inTeam = false;
                p.position = null;
                migrated = true;
            }
        });
        if (migrated) localStorage.setItem('pkm_inventory', JSON.stringify(inv));

            const team = inv.filter(p => p.inTeam).sort((a, b) => a.position - b.position);

            if (team.length === 0) {
                alert("Đội hình trống!");
                window.location.href = 'pkm_team.html';
                return;
            }

            // 🆕 FETCH BÙ height cho Pokémon cũ (ấp trứng trước khi có field này),
            // để bodyScale (pkm_styles.js) tính đúng cho mọi con, kể cả dữ liệu cũ.
            const heightsChanged = await this.ensureHeights(team);
            if (heightsChanged) localStorage.setItem('pkm_inventory', JSON.stringify(inv));

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

                    // 4. Ghi đè CHIỀU CAO theo đúng ID ngẫu nhiên vừa random — vì địch
                    // là 1 Pokémon HOÀN TOÀN KHÁC con gốc trong túi đồ, height gốc (nếu
                    // có) không còn đúng nữa, phải lấy height của chính con vừa random.
                    p.height = data.height;

                } catch (e) {
                    p.name = "Unknown";
                    p.type = "normal";
                    p.height = 10; // fallback ~1m nếu fetch lỗi
                }
            }

    if (window.QuizManager) window.QuizManager.prepareData();

        this.renderBattlefield();

        // 🔥 Tiến trình điều khiển: Học từ vựng (wordBank2) -> Đấu trắc nghiệm
        // 🔥 Tiến trình điều khiển ĐÃ CHUẨN HÓA: Học từ vựng (VocabularyModule) -> Xong mới Đấu trắc nghiệm
        (async () => {
            // 1. Ẩn bảng câu hỏi trắc nghiệm khi bắt đầu vào trang để ưu tiên học từ
            const quizOverlay = document.getElementById("quiz-overlay");
            if (quizOverlay) quizOverlay.style.display = "none";

            // 2. Định nghĩa hàm callback toàn cục để khi bên module Vocab học xong thì gọi ngược lại đây
            window.startPokemonBattle = () => {
                console.log("⚔️ Đã hoàn thành từ vựng! Mở bảng trắc nghiệm lên chiến đấu...");

                const mainCard = document.getElementById("mainCard");
                if (mainCard) mainCard.style.display = "none"; 

                if (quizOverlay) quizOverlay.style.display = "flex"; 

                // Dự báo (telegraph) trước cặp đấu đầu tiên, đợi 1 nhịp cho người chơi thấy rồi mới hỏi quiz
                this.activeUnitIndex = 0;
                this.telegraph = this.buildTelegraph(this.activeUnitIndex);
                this.showTelegraphFX(this.telegraph);
                setTimeout(() => this.askAndResolve(), 1000);
            };

            // 3. Kích hoạt gọi thằng VocabularyModule tự mò localStorage/sessionStorage bốc dữ liệu và chạy
            if (window.VocabularyModule && typeof window.VocabularyModule.start === "function") {
                console.log("📘 [Battle Script] Gọi VocabularyModule chạy phần học từ vựng...");
                await window.VocabularyModule.start();
            } else {
                // Phương án dự phòng nếu file vocab bị lỗi hoặc không tải được, vào thẳng trận đấu luôn
                console.warn("⚠️ Không tìm thấy VocabularyModule, tự động vào thẳng trận đấu!");
                window.startPokemonBattle();
            }
        })();
    },
    // Fetch bù trường "height" (đơn vị decimet, PokeAPI) cho các Pokémon
    // CŨ chưa có field này (ấp trứng trước khi pkm_egg.js được cập nhật).
    // Trả về true nếu có ít nhất 1 con vừa được fetch bù (để nơi gọi biết
    // mà lưu lại localStorage).
    async ensureHeights(team) {
        const missing = team.filter(p => !p.height);
        if (missing.length === 0) return false;

        await Promise.all(missing.map(async (p) => {
            try {
                const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${p.id}`);
                const data = await res.json();
                p.height = data.height;
            } catch (e) {
                p.height = 10; // fallback ~1m nếu fetch lỗi, tránh vỡ hiển thị
            }
        }));

        return true;
    },

    calculateStats(pkm, isEnemy) {
        const stats = pkm.baseStats || {};
        let hp   = parseInt(stats.hp)  || 20;
        let atk  = parseInt(stats.atk) || 20;
        let def  = parseInt(stats.def) || 15;
        let sAtk = parseInt(stats.sAtk) || 20;

        if (!isEnemy) {
            // 1. ĐỌC VÀ CỘNG CHỈ SỐ TỪ TRANG BỊ
            const equipped = JSON.parse(localStorage.getItem('pkm_equipped')) || {};
            const equippedIds = Object.values(equipped);
            let bonusAtk = 0, bonusDef = 0, bonusHP = 0, bonusSAtk = 0;

            const rankBonusMap = { 'silver': 0.02, 'gold': 0.03, 'red': 0.04, 'orange': 0.05 };

            equippedIds.forEach(id => {
                const parts = id.split('_');
                const type = parts[0];
                const rank = parts[1];
                const b = rankBonusMap[rank] || 0;

                if (type === 'weapon' || type === 'gloves') {
                    bonusAtk += b;
                    bonusSAtk += b;
                } else if (type === 'armor' || type === 'earring') {
                    bonusDef += b;
                } else if (type === 'helmet' || type === 'shoes') {
                    bonusHP += b;
                } else if (type === 'cloak' || type === 'belt') {
                    bonusSAtk += b;

                }
            });

            atk = Math.floor(atk * (1 + bonusAtk));
            sAtk = Math.floor(sAtk * (1 + bonusSAtk));
            def = Math.floor(def * (1 + bonusDef));
            hp  = Math.floor(hp  * (1 + bonusHP));

            // 2. TÍCH HỢP KIỂM TRA VÀ CỘNG BUFF ĐỘI HÌNH (+5% Toàn bộ chỉ số gốc + trang bị)
            const teamBuffStatus = localStorage.getItem('pkm_team_buff');
            if (teamBuffStatus === 'active') {
                atk  = Math.floor(atk * 1.05);
                sAtk = Math.floor(sAtk * 1.05);
                def  = Math.floor(def * 1.05);
                hp   = Math.floor(hp * 1.05);
                console.log(`💪 [BUFF ACTIVE] Đã cộng 5% chỉ số chiến đấu cho: ${pkm.name}`);
            }
        }

        // 🔥 ĐOẠN SỬA ĐỔI: Tối ưu HP co giãn riêng cho 1 con và 2 con, giữ nguyên 3-5 con
        const inv = JSON.parse(localStorage.getItem('pkm_inventory')) || [];
        const actualTeamSize = inv.filter(p => p.inTeam).length || 1;

        let hpMultiplier = 17; // Mặc định là x15 cho các trường hợp 3, 4, 5 con

        if (actualTeamSize === 1) {
            hpMultiplier = 45; // Đi 1 con đơn độc: x30 máu để kéo dài trận đấu
        } else if (actualTeamSize === 2) {
            hpMultiplier = 25; // Đi 2 con: x25 máu để trận đấu vừa vặn
        }

        // Cả phe ta và phe địch đều sẽ áp dụng hệ số co giãn này
        const baseHP = (hp * hpMultiplier) + 200;
        const randomPkmID = Math.floor(Math.random() * 649) + 1;

        return {
            ...pkm,
            id: isEnemy ? randomPkmID : pkm.id,
            name: isEnemy ? "Loading..." : pkm.name, 
            maxHp: isEnemy ? Math.floor(baseHP * 0.7) : baseHP,
            currentHp: isEnemy ? Math.floor(baseHP * 0.7) : baseHP,
            atk: atk, 
            sAtk: sAtk,
            def: def,
            type: pkm.type || 'normal',
            gen: pkm.gen || 1,
            hitsTaken: 0
        };
    },

    // ═══════════════════════════════════════════════════════════
    // PIPELINE LƯỢT ĐẤU MỚI — "dự báo trước 1 lượt" (telegraph)
    // ═══════════════════════════════════════════════════════════
    // Ý tưởng: ngay khi 1 cặp vừa đánh xong, ta CHỐT TRƯỚC (roll AOE/
    // mục tiêu) cho cặp KẾ TIẾP và bật FX (Ring1/Ring2/Ring3) lên
    // NGAY LÚC ĐÓ — trong khi cặp đó còn đứng yên chưa tới lượt.
    // Chỉ khi tới lượt của cặp đó, ta mới hỏi quiz rồi thực thi ĐÚNG
    // như đã báo trước (không roll lại). Nhờ vậy FX luôn xuất hiện
    // trước, cách xa thời điểm ra đòn thật.

    // Chốt trước kế hoạch tấn công cho 1 cặp (chưa thực thi damage)
    buildTelegraph(unitIndex) {
        const playerAttacker = this.playerTeam[unitIndex];
        const enemyAttacker  = this.enemyTeam[unitIndex];
        const pAlive = playerAttacker && playerAttacker.currentHp > 0;
        const eAlive = enemyAttacker  && enemyAttacker.currentHp  > 0;

        const plan = { unitIndex, enemyPlan: null, playerPlan: null };
        if (eAlive) plan.enemyPlan  = this.rollActionPlan(enemyAttacker, this.playerTeam, 'enemy', unitIndex);
        if (pAlive) plan.playerPlan = this.rollActionPlan(playerAttacker, this.enemyTeam, 'player', unitIndex);
        return plan;
    },

    // Roll ngẫu nhiên AOE hay đánh thường + chọn mục tiêu — KHÔNG tính damage, KHÔNG cần biết đúng/sai quiz
    rollActionPlan(attacker, opponentTeam, side, unitIndex) {
        const targetSide = side === 'player' ? 'enemy' : 'player';
        const isAOE = Math.random() < 0.35; // tỉ lệ ra AOE, chỉnh tuỳ ý

        if (!isAOE) {
            const targetIdx = opponentTeam.findIndex(p => p.currentHp > 0);
            if (targetIdx === -1) return null;
            return { attacker, side, targetSide, unitIndex, isAOE: false, targetIdx, targets: [targetIdx] };
        }

        const targets = opponentTeam.map((p, i) => p.currentHp > 0 ? i : -1).filter(i => i !== -1);
        if (targets.length === 0) return null;
        return { attacker, side, targetSide, unitIndex, isAOE: true, targets };
    },

    // Bật FX Ring1 (sắp tấn công) / Ring2 (sắp AOE) / Ring3 (sắp bị tấn công) cho cả kế hoạch của 1 cặp
    showTelegraphFX(plan) {
        if (plan.enemyPlan)  this.showPlanFX(plan.enemyPlan);
        if (plan.playerPlan) this.showPlanFX(plan.playerPlan);
    },
    showPlanFX(actionPlan) {
        window.PkmUnitFX?.setAttacking(actionPlan.side, actionPlan.unitIndex, true);
        if (actionPlan.isAOE) window.PkmUnitFX?.setAOECasting(actionPlan.side, actionPlan.unitIndex, true);
        (actionPlan.targets || []).forEach(i => window.PkmUnitFX?.setTargeted(actionPlan.targetSide, i, true));
    },
    // Tắt hết FX telegraph của 1 cặp (gọi sau khi đã thực thi xong đòn đánh thật)
    clearTelegraphFX(plan) {
        [plan.enemyPlan, plan.playerPlan].forEach(actionPlan => {
            if (!actionPlan) return;
            window.PkmUnitFX?.setAttacking(actionPlan.side, actionPlan.unitIndex, false);
            window.PkmUnitFX?.setAOECasting(actionPlan.side, actionPlan.unitIndex, false);
            (actionPlan.targets || []).forEach(i => window.PkmUnitFX?.setTargeted(actionPlan.targetSide, i, false));
        });
    },

    // Log + hỏi quiz (nếu phe ta có tham chiến ở cặp đang được telegraph), rồi thực thi
    askAndResolve() {
        const plan = this.telegraph;
        if (!plan || this.checkGameOver()) return;

        const enemyName  = plan.enemyPlan?.attacker?.name;
        const playerName = plan.playerPlan?.attacker?.name;

        if (plan.enemyPlan && plan.playerPlan) {
            this.log(`${enemyName} tấn công trước, ${playerName} phản công sau!`);
        } else if (plan.playerPlan) {
            this.log(`Lượt của ${playerName} (Phe mình)`);
        } else if (plan.enemyPlan) {
            this.log(`Lượt của ${enemyName} (Đối thủ)`);
        }

        if (plan.playerPlan) {
            if (window.QuizManager) {
                window.QuizManager.ask((isCorrect) => this.resolveRound(isCorrect));
            } else {
                this.resolveRound(true);
            }
        } else {
            // Chỉ địch còn sống ở cặp này → không cần hỏi quiz
            setTimeout(() => this.resolveRound(true), 600);
        }
    },

    // Thực thi kế hoạch đã telegraph: ĐỊCH đánh trước, TA đánh sau (theo đúng kết quả quiz)
    async resolveRound(playerCorrect) {
        this.isProcessing = true;

        const plan = this.telegraph;
        this.telegraph = null;

        if (plan.playerPlan) {
            this.totalCount++;
            if (playerCorrect) this.correctCount++; else this.wrongCount++;
            const statEl = document.getElementById('quiz-stats');
            if (statEl) statEl.innerHTML =
                `✅ ${this.correctCount} &nbsp; ❌ ${this.wrongCount} &nbsp; 📊 ${this.totalCount} câu`;
        }

        // ĐỊCH đánh trước — luôn trúng
        if (plan.enemyPlan) await this.executePlannedAction(plan.enemyPlan, true);

        // Nghỉ 1 nhịp cho animation đòn địch "lắng" hẳn trước khi đòn ta bắn ra, đỡ đơ
        if (plan.enemyPlan && plan.playerPlan) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }

        // TA đánh sau — theo kết quả quiz
        if (plan.playerPlan) await this.executePlannedAction(plan.playerPlan, playerCorrect);

        this.clearTelegraphFX(plan);
        this.updateUI();

        // Phát hiệu ứng buff (nếu có) SAU KHI mọi animation đòn đánh của lượt này đã xong hẳn
        await this.flushHealBursts();

        if (this.checkGameOver()) {
            this.isProcessing = false;
            return;
        }

        // Tìm cặp kế tiếp còn ít nhất 1 bên sống
        let nextIndex = (plan.unitIndex + 1) % this.playerTeam.length;
        let guard = 0;
        while (guard < this.playerTeam.length) {
            const p = this.playerTeam[nextIndex], e = this.enemyTeam[nextIndex];
            if ((p && p.currentHp > 0) || (e && e.currentHp > 0)) break;
            nextIndex = (nextIndex + 1) % this.playerTeam.length;
            guard++;
        }
        this.activeUnitIndex = nextIndex;

        // DỰ BÁO TRƯỚC cho cặp kế tiếp NGAY BÂY GIỜ — trong khi cặp vừa xong vẫn còn hiện trên sân,
        // FX của cặp kế tiếp đã bật sẵn để người chơi thấy trước 1 lượt.
        this.telegraph = this.buildTelegraph(this.activeUnitIndex);
        this.showTelegraphFX(this.telegraph);

        this.isProcessing = false;
        setTimeout(() => this.askAndResolve(), 1000);
    },

    // Thực thi 1 đòn đánh đã được telegraph từ trước: tính damage thật, phát animation, trừ máu
    async executePlannedAction(actionPlan, isCorrect) {
        if (!actionPlan) return;
        const { attacker, side, targetSide, isAOE, targetIdx, targets, unitIndex } = actionPlan;
        if (!attacker || attacker.currentHp <= 0) return; // đã chết trong lúc chờ telegraph

        const opponentTeam = targetSide === 'enemy' ? this.enemyTeam : this.playerTeam;

        if (!isCorrect) {
            this.log(`${attacker.name} đánh hụt!`);
            const playInfo = { attackerIndex: unitIndex, attackerSide: side, targetSide, missed: true, targets: [] };
            if (window.SkillManager) await window.SkillManager.playNormalAttack(playInfo);
            return;
        }

        if (attacker.name && window.SkillManager) window.SkillManager.speakName(attacker.name);

        if (!isAOE) {
            const target = opponentTeam[targetIdx];
            if (!target || target.currentHp <= 0) return; // mục tiêu đã chết trước đó (VD dính AOE của lượt vừa rồi)
            const damage = Math.max(15, Math.floor((attacker.atk * 1.8) / (1 + target.def / 100)));
            this.dealDamage(target, damage, targetSide, targetIdx);

            const playInfo = { type: attacker.type || 'normal', gen: attacker.gen || 1, attackerIndex: unitIndex, attackerSide: side,
                                attackerId: attacker.id, attackerName: attacker.name, targetSide, damage, isAOE: false, targets: [targetIdx], isSkill: true };
            await window.SkillManager.playNormalAttack(playInfo);
        } else {
            const aliveTargets = targets.filter(i => opponentTeam[i] && opponentTeam[i].currentHp > 0);
            if (aliveTargets.length === 0) return;

            const playInfo = { type: attacker.type || 'normal', gen: attacker.gen || 1, attackerIndex: unitIndex, attackerSide: side,
                                attackerId: attacker.id, attackerName: attacker.name, targetSide, targets: aliveTargets, damage: 0, isAOE: true, isSkill: true };
            aliveTargets.forEach(idx => {
                const target = opponentTeam[idx];
                const damage = Math.max(20, Math.floor((attacker.sAtk * 1.2) / (1 + target.def / 100)));
                this.dealDamage(target, damage, targetSide, idx);
                playInfo.damage = damage;
            });
            await window.SkillManager.play(playInfo);
        }

        this.updateUI();
    },

    // Trừ máu + đếm số lần bị dính đòn → cứ đủ 3 đòn thì hồi máu (buff thật),
    // và bật sẵn hiệu ứng "sắp được buff" (2 sao) ngay từ đòn thứ 2 để dự báo trước.
    dealDamage(target, damage, targetSide, targetIndex) {
        target.currentHp = Math.max(0, target.currentHp - damage);
        target.hitsTaken = (target.hitsTaken || 0) + 1;

        if (target.currentHp <= 0) return; // chết rồi thì thôi, khỏi buff

        const mod = target.hitsTaken % 3;
        if (mod === 2) {
            // Đã lãnh đủ 2 đòn — báo trước sắp được buff ở đòn kế tiếp
            window.PkmUnitFX?.setBuffing(targetSide, targetIndex, true);
        } else if (mod === 0) {
            // Đủ 3 đòn — CHƯA cộng máu ở đây nữa. Giờ buff hồi máu là buff
            // cho CẢ ĐỘI, số liệu từng con khác nhau tuỳ maxHp, và máu chỉ
            // thực sự được cộng đúng lúc hiệu ứng Pha 3 xuất hiện trên từng
            // con (xem playHealBuffSequence). Ở đây chỉ ghi nhận SỰ KIỆN.
            window.PkmUnitFX?.setBuffing(targetSide, targetIndex, false);
            this.log(`${target.name} kích hoạt hồi máu đồng đội!`);

            this.pendingHealBursts.push({
                side: targetSide,
                sourceIndex: targetIndex,
                sourceType: target.type || 'normal'
            });
        }
    },

    // Phát các hiệu ứng buff đã dồn trong hàng đợi — chỉ gọi SAU KHI mọi animation
    // đòn đánh của lượt đã hoàn toàn kết thúc, cách nhau 1 nhịp để không đơ.
    async flushHealBursts() {
        if (this.pendingHealBursts.length === 0) return;
        const events = this.pendingHealBursts;
        this.pendingHealBursts = [];

        // Đợi Pokémon "im" trở lại sau đòn đánh rồi mới phát hiệu ứng buff
        await new Promise(resolve => setTimeout(resolve, 500));

        // Tách sự kiện theo PHE — trong 1 phe, nếu có nhiều con cùng proc buff
        // ở turn này thì chạy TUẦN TỰ (con này xong hết mới tới con kia).
        // Nhưng phe ta và phe địch thì chạy SONG SONG với nhau.
        const bySide = { player: [], enemy: [] };
        events.forEach(ev => bySide[ev.side]?.push(ev));

        const runSideQueue = async (side, queue) => {
            for (const ev of queue) {
                await this.playHealBuffSequence(side, ev.sourceIndex, ev.sourceType);
            }
        };

        await Promise.all([
            runSideQueue('player', bySide.player),
            runSideQueue('enemy', bySide.enemy)
        ]);
    },

    // Chạy trọn 3 pha của 1 sự kiện buff hồi máu:
    // Pha 1: cột sáng giáng xuống đúng con vừa đủ 3 đòn (con "chủ buff")
    // Pha 2: mảng sáng lan từ con đó ra khắp các ô CÒN SỐNG cùng phe
    // Pha 3: hồi máu đồng loạt cho cả đội còn sống — CỘNG MÁU THẬT đúng
    //        lúc này, mỗi con hồi = min(20, 1% maxHp của chính nó)
    async playHealBuffSequence(side, sourceIndex, sourceType) {
        const team = side === 'player' ? this.playerTeam : this.enemyTeam;
        const aliveIndices = team
            .map((p, i) => (p && p.currentHp > 0) ? i : -1)
            .filter(i => i !== -1);
        if (aliveIndices.length === 0) return;

        const color = (window.SkillManager?.systemConfig?.[sourceType] || {}).color || '#2ecc71';

        // PHA 1
        await window.PkmUnitFX?.playDescendBeam(side, sourceIndex, color);

        // PHA 2
        await window.PkmUnitFX?.playGroundSpread(side, sourceIndex, aliveIndices, color);

        // PHA 3 — cộng máu thật + hiện hiệu ứng + số hồi, từng con nối tiếp nhẹ
        for (let i = 0; i < aliveIndices.length; i++) {
            const idx = aliveIndices[i];
            const p = team[idx];
            if (!p || p.currentHp <= 0) continue;

            const healAmount = Math.min(20, Math.floor(p.maxHp * 0.01));
            p.currentHp = Math.min(p.maxHp, p.currentHp + healAmount);

            window.PkmUnitFX?.showHealBurst(side, idx);
            window.PkmUnitFX?.showHealNumber(side, idx, healAmount);

            if (i < aliveIndices.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 150));
            }
        }

        this.updateUI();
    },

    renderBattlefield() {
        const arena = document.getElementById('battle-arena');
        if (arena) arena.className = 'battle-arena';

        const pContainer = document.getElementById('player-team-container');
        const eContainer = document.getElementById('enemy-team-container');
        if (!pContainer || !eContainer) return;

        pContainer.innerHTML = '';
        eContainer.innerHTML = '';

        // ✅ QUAN TRỌNG: Gắn đúng class "player-side" và "enemy-side"
        //pContainer.className = 'player-side';
        //eContainer.className = 'enemy-side';

        const teamSize = this.playerTeam.length; // player và enemy luôn cùng số lượng slot
        this.playerTeam.forEach((p, i) => { 
            pContainer.innerHTML += this.createUnitHTML(p, i, 'player', teamSize); 
        });
        this.enemyTeam.forEach((p, i)  => { 
            eContainer.innerHTML += this.createUnitHTML(p, i, 'enemy', teamSize);  
        });
        this.playerTeam.forEach((p,i)=>{ if(p.currentHp>0) window.PkmUnitFX?.attachBaseRings('player', i); });
        this.enemyTeam.forEach((p,i)=>{ if(p.currentHp>0) window.PkmUnitFX?.attachBaseRings('enemy', i); });

        this.updateActiveStatus();
    },
    createUnitHTML(pkm, index, side, teamSize) {
        // Chỉ gọi style, không xử lý ảnh ở đây nữa
        return PkmStyles.renderUnit(pkm, index, side, teamSize);
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
            this.markDeadIfNeeded(`player-unit-${i}`, p.currentHp);
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
            this.markDeadIfNeeded(`enemy-unit-${i}`, p.currentHp);
        });

        this.updateActiveStatus();
    },

    // Đánh dấu Pokemon chết và ẩn vĩnh viễn khỏi màn hình
    markDeadIfNeeded(unitId, currentHp) {
        const el = document.getElementById(unitId);
        if (!el) return;
        if (currentHp <= 0) {
            el.dataset.dead = '1';
            if (!el._teleportData) {
                el.style.opacity    = '0';
                el.style.visibility = 'hidden';
                el.style.pointerEvents = 'none';
            }
            const side = unitId.startsWith('player') ? 'player' : 'enemy';
            const idx = parseInt(unitId.split('-').pop());
            window.PkmUnitFX?.removeUnit(side, idx);
        }
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
         this.saveBattleResult();

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
            if (accuracy >= 80) {
                bonusEXP += 5; bonusDV += 5;
                passedMaps.push(currentLessonId);
                localStorage.setItem('pkm_passed_maps', JSON.stringify(passedMaps));
                messages.push(`🌟 BÀI MỚI HOÀN THÀNH (${accuracy}% đúng): <b>+5 KN +5 DV</b>`);
            } else {
                messages.push(`⚠️ Bài mới nhưng chỉ ${accuracy}% đúng — cần ≥90% để mở khoá!`);
            }
        }

        // ── 3. THƯỞNG 2: SỐ CÂU ĐÚNG / 2 ──
        const reward2 = Math.round(this.correctCount / 2);
        if (reward2 > 0) {
            bonusEXP += reward2; bonusDV += reward2;
            messages.push(`📝 ${this.correctCount} câu đúng ÷ 2 = <b>+${reward2} KN +${reward2} DV</b>`);
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
    saveBattleResult() {
        try {
            const prev = JSON.parse(localStorage.getItem('result_battle')) || { score: 0, total: 0 };
            const updated = {
                score: (prev.score || 0) + this.correctCount,
                total: (prev.total || 0) + this.totalCount
            };
            localStorage.setItem('result_battle', JSON.stringify(updated));

            if (!localStorage.getItem('startTime_global')) {
                localStorage.setItem('startTime_global', Date.now().toString());
            }
            console.log('📊 [Battle] Cộng dồn result_battle:', updated);
        } catch (e) {
            console.error('❌ Lỗi lưu result_battle:', e);
        }
    },
    defeat() {
        this.log("💀 BẠN ĐÃ THẤT BẠI!");
        this.isProcessing = true; 
        this.saveBattleResult();

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
                    QUAY LẠI BẢN ĐỒconst pkmImgRef = unit.querySelector('img');
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
