/**
 * ==========================================================
 * PKM BATTLE ONLINE — bản PvP, dựa trên pkm_battle.js
 * ==========================================================
 * KHÔNG động vào pkm_battle.js (giữ nguyên cho chế độ đơn/offline).
 * File này dùng LẠI toàn bộ phần VẼ (renderBattlefield, updateUI,
 * animation qua SkillManager/PkmUnitFX) của pkm_battle.js, nhưng thay
 * hoàn toàn phần "não" tính toán: máu/damage/thắng-thua không tự tính
 * nữa mà LUÔN lấy từ server qua window.PkmBattleNet (xem
 * pkm_battle_net.js) — server là nguồn sự thật duy nhất.
 *
 * CẦN CÓ TRƯỚC (trong pkm_battle_online.html):
 *   <script src="https://cdnjs.cloudflare.com/ajax/libs/socket.io/4.7.5/socket.io.min.js"></script>
 *   <script src="pkm_battle_net.js"></script>
 *   <script src="pkm_battle_online.js"></script>
 * và các file dùng chung với bản đơn: pkm_styles.js (PkmStyles),
 * pkm_unit_fx.js (PkmUnitFX), pkm_skill_manager.js (SkillManager),
 * pkm_quiz.js (QuizManager), pkm_score.js (PkmScore).
 *
 * CÁC ĐIỂM ĐÃ LƯỢC BỎ SO VỚI BẢN ĐƠN (xem giải thích trong hội thoại):
 *   - Hệ thống hồi máu buff sau 3 đòn (cosmetic, dễ lệch với máu thật
 *     server đang giữ) -> bỏ hẳn ở bản online.
 *   - Hệ thống checkpoint dừng giữa chừng (MIN/MAX_QUESTIONS) -> PvP có
 *     hồi kết rõ ràng do server quyết (1 đội hết máu), không cần.
 *   - Chọn cấp độ/luồng học từ vựng (VocabularyModule) trước trận -> PvP
 *     ép cứng độ khó "kho" ngay từ màn chọn đội hình (file khác lo).
 *
 * ĐIỂM CHƯA KIỂM CHỨNG BẰNG TRÌNH DUYỆT THẬT (cần bạn test):
 *   - finishMatch() được gọi với allowLessonUnlock:false vì PvP không gắn
 *     với 1 bài học cụ thể (current_mission) — tắt hẳn phần "mở khoá bài
 *     mới" để tránh vô tình mở khoá nhầm bài dựa trên current_mission cũ
 *     còn sót lại trong localStorage từ 1 phiên chơi đơn trước đó.
 * ==========================================================
 */

window.BattleOnlineGame = {
    playerTeam: [],   // đội của TÔI (hiển thị bên "player")
    enemyTeam: [],    // đội ĐỐI THỦ (hiển thị bên "enemy")
    playerActiveIdx: 0,
    enemyActiveIdx: 0,
    myPlayerId: null,
    oppPlayerId: null,
    firstStateReceived: false,
    lastIsAOE: false,
    lastPrimaryId: null, // ai LÀ chính ở round SẮP DIỄN RA (dùng để suy ra ai vừa đánh khi state mới tới)
    isProcessing: false,

    async init() {
        console.log("⚔️🌐 [DEBUG] BattleOnlineGame.init() started");

        if (!window.PkmBattleNet) {
            alert("Thiếu pkm_battle_net.js — không thể vào trận online!");
            window.location.href = 'pkm.html';
            return;
        }

        await this.setupOnlineQuestionPool();
        window.addEventListener('beforeunload', () => this.restoreQuestionPool());

        window.PkmBattleNet.connect(); // phải gọi TRƯỚC — playerId chỉ được tạo bên trong connect()
        this.myPlayerId = window.PkmBattleNet.getMyPlayerId();

        window.PkmBattleNet.on('stateUpdate', (state) => this.onServerState(state));
        window.PkmBattleNet.on('battleEnd', (data) => this.onBattleEnd(data));
        window.PkmBattleNet.on('opponentDisconnected', () => this.log("⚠️ Đối thủ mất kết nối, đang chờ..."));
        window.PkmBattleNet.on('opponentReconnected', () => this.log("✅ Đối thủ đã quay lại!"));

        const quizOverlay = document.getElementById("quiz-overlay");
        if (quizOverlay) quizOverlay.style.display = "flex";
        this.log("⏳ Đang đồng bộ trận đấu...");
    },

    // ============ NGUỒN CÂU HỎI: KHÔNG lấy vocab của 1 bài cố định ============
    // Ép độ khó "kho" (khó nhất) + chọn NGẪU NHIÊN 1 bài học sinh này CHƯA
    // vượt qua (và nhỏ hơn bài max đã lên lịch), tái dùng đúng logic đã có
    // sẵn trong pkm_random.js (window.PkmLessonPicker.pickLesson()) thay vì
    // viết lại. Không đổi gì ở pkm_map.js/pkm_quiz.js.
    _prevSelectedLevel: undefined,
    async setupOnlineQuestionPool() {
        this._prevSelectedLevel = localStorage.getItem('selected_level');
        localStorage.setItem('selected_level', 'kho');

        if (!window.PkmLessonPicker) {
            console.warn("⚠️ Thiếu pkm_random.js — không chọn được bài ngẫu nhiên, dùng current_mission hiện có (nếu có).");
            return;
        }
        try {
            const lesson = await window.PkmLessonPicker.pickLesson();
            if (lesson) {
                localStorage.setItem('selected_lesson_name', lesson.lessonName);
                localStorage.setItem('current_mission', JSON.stringify({ id: lesson.fullId, type: 'online' }));
                localStorage.setItem('wordBank', JSON.stringify(lesson.words));
                console.log("🌐 [BATTLE ONLINE] Bài random cho trận này:", lesson.lessonName);
            } else {
                console.warn("⚠️ Không tìm được bài phù hợp (có thể đã học hết) — dùng current_mission cũ nếu có.");
            }
        } catch (e) {
            console.warn("⚠️ Lỗi khi chọn bài random cho online:", e);
        }
    },
    // Trả lại độ khó cũ khi rời trận online, tránh ảnh hưởng các chế độ
    // chơi khác (solo) đang dùng chung key 'selected_level' trong localStorage.
    restoreQuestionPool() {
        if (this._prevSelectedLevel === undefined) return; // chưa setup thì khỏi khôi phục
        if (this._prevSelectedLevel === null) localStorage.removeItem('selected_level');
        else localStorage.setItem('selected_level', this._prevSelectedLevel);
        this._prevSelectedLevel = undefined; // tránh khôi phục 2 lần
    },

    // ============ NHẬN TRẠNG THÁI THẬT TỪ SERVER ============
    // Mỗi lần có state:update: (1) nếu là lần đầu -> dựng đội hình + vẽ
    // trận; (2) nếu không -> so sánh với snapshot cũ để biết vừa ai đánh
    // trúng ai, phát animation tương ứng, rồi mới đồng bộ số liệu thật.
    onServerState(state) {
        this.oppPlayerId = Object.keys(state.teams).find(id => id !== this.myPlayerId) || this.oppPlayerId;

        if (!this.firstStateReceived) {
            this.firstStateReceived = true;
            this.buildTeamsFromState(state);
            this.renderBattlefield();
            this.showTelegraphForUpcoming(state);
            this.lastIsAOE = state.isAOE;
            this.lastPrimaryId = state.primaryId;
            const quizOverlay = document.getElementById("quiz-overlay");
            if (quizOverlay) quizOverlay.style.display = "flex";
            return;
        }

        // So khớp HP cũ vs HP mới để biết vừa xảy ra chuyện gì
        const prevAttackerWasMe = this.lastPrimaryId === this.myPlayerId;
        const attackerSide = prevAttackerWasMe ? 'player' : 'enemy';
        const defenderSide = prevAttackerWasMe ? 'enemy' : 'player';
        const attackerTeamOld = prevAttackerWasMe ? this.playerTeam : this.enemyTeam;
        const defenderTeamOld = prevAttackerWasMe ? this.enemyTeam : this.playerTeam;
        const defenderNewUnits = state.teams[prevAttackerWasMe ? this.oppPlayerId : this.myPlayerId];

        const hits = [];
        defenderNewUnits.forEach((newU, i) => {
            const oldU = defenderTeamOld[i];
            if (oldU && newU.hp < oldU.currentHp) {
                hits.push({ idx: i, damage: oldU.currentHp - newU.hp, killed: newU.hp <= 0 });
            }
        });

        const attackerActiveIdx = prevAttackerWasMe ? this.playerActiveIdx : this.enemyActiveIdx;
        const attackerUnit = attackerTeamOld[attackerActiveIdx];

        this.playAttackAnimation({
            attackerSide, defenderSide, attackerUnit, attackerIdx: attackerActiveIdx,
            hits, isAOE: this.lastIsAOE,
        }).then(() => {
            // Đồng bộ số liệu THẬT từ server (ghi đè, không tự tính)
            this.applyServerTeams(state);
            this.updateUI();
            this.showTelegraphForUpcoming(state);
            this.lastIsAOE = state.isAOE;
            this.lastPrimaryId = state.primaryId;
        });
    },

    buildTeamsFromState(state) {
        const mine = state.teams[this.myPlayerId] || [];
        const opp = state.teams[this.oppPlayerId] || [];
        this.playerTeam = mine.map(u => ({ ...u, currentHp: u.hp }));
        this.enemyTeam = opp.map(u => ({ ...u, currentHp: u.hp }));
        this.playerActiveIdx = state.activeIdx[this.myPlayerId] || 0;
        this.enemyActiveIdx = state.activeIdx[this.oppPlayerId] || 0;
    },

    // Ghi đè currentHp bằng đúng số liệu server vừa gửi (không cộng/trừ thủ công)
    applyServerTeams(state) {
        const mine = state.teams[this.myPlayerId] || [];
        const opp = state.teams[this.oppPlayerId] || [];
        mine.forEach((u, i) => { if (this.playerTeam[i]) this.playerTeam[i].currentHp = u.hp; });
        opp.forEach((u, i) => { if (this.enemyTeam[i]) this.enemyTeam[i].currentHp = u.hp; });
        this.playerActiveIdx = state.activeIdx[this.myPlayerId] || 0;
        this.enemyActiveIdx = state.activeIdx[this.oppPlayerId] || 0;
    },

    // Bật FX "sắp bị đánh / sắp ra chưởng" cho round SẮP TỚI, y hệt cảm
    // giác telegraph của bản đơn — chỉ khác là dữ liệu tới từ server.
    showTelegraphForUpcoming(state) {
        const primaryIsMe = state.primaryId === this.myPlayerId;
        const attackerSide = primaryIsMe ? 'player' : 'enemy';
        const defenderSide = primaryIsMe ? 'enemy' : 'player';
        const attackerIdx = primaryIsMe ? this.playerActiveIdx : this.enemyActiveIdx;
        const defenderIdx = primaryIsMe ? this.enemyActiveIdx : this.playerActiveIdx;

        window.PkmUnitFX?.setAttacking(attackerSide, attackerIdx, true);
        if (!state.isAOE) {
            window.PkmUnitFX?.setIncoming?.(defenderSide, defenderIdx, true);
        }
    },

    // Phát animation đòn đánh vừa xảy ra, dùng ĐÚNG damage server đã tính
    // (không tự tính lại) — tái dùng SkillManager y hệt bản đơn.
    async playAttackAnimation({ attackerSide, defenderSide, attackerUnit, attackerIdx, hits, isAOE }) {
        window.PkmUnitFX?.setAttacking(attackerSide, attackerIdx, false);

        if (!attackerUnit) return;
        if (attackerUnit.name && window.SkillManager) window.SkillManager.speakName(attackerUnit.name);

        if (hits.length === 0) {
            // Bên chính trả lời sai/không kịp -> đánh hụt
            this.log(`${attackerUnit.name} đánh hụt!`);
            const playInfo = { attackerIndex: attackerIdx, attackerSide, targetSide: defenderSide, missed: true, targets: [] };
            if (window.SkillManager) await window.SkillManager.playNormalAttack(playInfo);
            return;
        }

        if (!isAOE) {
            const h = hits[0];
            const playInfo = {
                type: attackerUnit.type || 'normal', attackerIndex: attackerIdx, attackerSide,
                attackerId: attackerUnit.id, attackerName: attackerUnit.name, targetSide: defenderSide,
                damage: h.damage, isAOE: false, targets: [h.idx], isSkill: true,
            };
            if (window.SkillManager) await window.SkillManager.playNormalAttack(playInfo);
        } else {
            const playInfo = {
                type: attackerUnit.type || 'normal', attackerIndex: attackerIdx, attackerSide,
                attackerId: attackerUnit.id, attackerName: attackerUnit.name, targetSide: defenderSide,
                targets: hits.map(h => h.idx), damage: hits[0]?.damage || 0, isAOE: true, isSkill: true,
            };
            if (window.SkillManager) await window.SkillManager.play(playInfo);
        }
    },

    // ============ KẾT THÚC TRẬN — do SERVER báo, không tự tính ============
    onBattleEnd({ winnerId, reason }) {
        this.restoreQuestionPool(); // xong trận -> trả lại độ khó cũ, không ảnh hưởng chế độ đơn
        if (winnerId === this.myPlayerId) this.victory(reason);
        else if (winnerId === this.oppPlayerId) this.defeat(reason);
        else this.draw(reason); // hoà (draw) hoặc winnerId null vì 2 bên cùng hết máu
    },

    // ============ VẼ TRẬN (TÁI DÙNG NGUYÊN VĂN TỪ pkm_battle.js) ============
    renderBattlefield() {
        const arena = document.getElementById('battle-arena');
        if (arena) arena.className = 'battle-arena';
        const pContainer = document.getElementById('player-team-container');
        const eContainer = document.getElementById('enemy-team-container');
        if (!pContainer || !eContainer) return;
        pContainer.innerHTML = '';
        eContainer.innerHTML = '';
        const teamSize = Math.max(this.playerTeam.length, this.enemyTeam.length);
        if (window.SkillManager?.resetNormalStylePools) window.SkillManager.resetNormalStylePools();
        if (window.PkmStyles?.assignEnemyTrainers) window.PkmStyles.assignEnemyTrainers(teamSize);

        this.enemyTeam.forEach((p, i) => {
            if (window.PkmStyles?.renderTrainer) eContainer.innerHTML += window.PkmStyles.renderTrainer('enemy', i, teamSize);
        });
        this.playerTeam.forEach((p, i) => { pContainer.innerHTML += this.createUnitHTML(p, i, 'player', teamSize); });
        this.enemyTeam.forEach((p, i) => { eContainer.innerHTML += this.createUnitHTML(p, i, 'enemy', teamSize); });
        this.playerTeam.forEach((p, i) => { if (p.currentHp > 0) window.PkmUnitFX?.attachBaseRings('player', i); });
        this.enemyTeam.forEach((p, i) => { if (p.currentHp > 0) window.PkmUnitFX?.attachBaseRings('enemy', i); });

        this.updateActiveStatus();
    },
    createUnitHTML(pkm, index, side, teamSize) {
        return window.PkmStyles.renderUnit(pkm, index, side, teamSize);
    },

    updateUI() {
        [...this.playerTeam.entries()].forEach(([i, p]) => {
            const fill = document.getElementById(`player-hp-fill-${i}`);
            const text = document.getElementById(`player-hp-text-${i}`);
            if (fill) {
                const pct = Math.max(0, (p.currentHp / p.maxHp) * 100);
                fill.style.width = pct + "%";
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
                fill.style.width = pct + "%";
                fill.style.background = pct > 50 ? "#2ecc71" : pct > 25 ? "#f1c40f" : "#e74c3c";
            }
            if (text) text.innerText = `${Math.max(0, p.currentHp)}/${p.maxHp}`;
            this.markDeadIfNeeded(`enemy-unit-${i}`, p.currentHp);
        });
        this.updateActiveStatus();
    },
    markDeadIfNeeded(unitId, currentHp) {
        const el = document.getElementById(unitId);
        if (!el) return;
        if (currentHp <= 0) {
            el.dataset.dead = '1';
            if (!el._teleportData) {
                el.style.opacity = '0';
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
        const pEl = document.getElementById(`player-unit-${this.playerActiveIdx}`);
        if (pEl) pEl.classList.add('active-unit');
        const eEl = document.getElementById(`enemy-unit-${this.enemyActiveIdx}`);
        if (eEl) eEl.classList.add('active-unit');
    },
    log(msg) {
        console.log("🎮🌐 [BATTLE ONLINE]: " + msg);
        const logElement = document.getElementById('turn-display');
        if (logElement) {
            logElement.innerHTML = msg;
            logElement.style.display = 'block';
            if (this.turnTimeout) clearTimeout(this.turnTimeout);
            this.turnTimeout = setTimeout(() => { logElement.style.display = 'none'; }, 1200);
        }
    },

    // ============ KẾT QUẢ TRẬN ============
    victory(reason) {
        this.log(reason === 'opponent_disconnected' ? "🏆 ĐỐI THỦ THOÁT TRẬN — BẠN THẮNG!" : "🏆 CHIẾN THẮNG!");
        const result = window.PkmScore ? window.PkmScore.finishMatch({ won: true, minQuestions: 0, allowLessonUnlock: false }) : {};
        this.showResultOverlay(true, result, reason);
    },
    defeat(reason) {
        this.log("💀 BẠN ĐÃ THUA TRẬN!");
        const result = window.PkmScore ? window.PkmScore.finishMatch({ won: false, minQuestions: 0, allowLessonUnlock: false }) : {};
        this.showResultOverlay(false, result, reason);
    },
    draw(reason) {
        this.log("🤝 HOÀ!");
        const result = window.PkmScore ? window.PkmScore.finishMatch({ won: false, minQuestions: 0, allowLessonUnlock: false }) : {};
        this.showResultOverlay(null, result, reason);
    },
    showResultOverlay(won, result, reason) {
        const firstPkm = this.playerTeam[0];
        const victoryImg = document.getElementById('victory-pkm-img');
        if (victoryImg && firstPkm) {
            victoryImg.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${firstPkm.id}.png`;
            victoryImg.style.filter = won === false ? "grayscale(100%) opacity(0.7)" : "";
        }
        const expText = document.getElementById('victory-exp-text');
        const title = won === true ? "🏆 CHIẾN THẮNG" : won === false ? "💀 THẤT BẠI" : "🤝 HOÀ";
        const color = won === true ? "#2ecc71" : won === false ? "#ff4757" : "#f1c40f";
        if (expText) {
            expText.innerHTML = `
                <div style="color:${color}; font-weight:bold; font-size:1.4em; margin-bottom:10px;">${title}</div>
                <div style="color:#4caf50; font-size:16px; font-weight:bold;">+${result.bonusEXP || 0} KN &nbsp; +${result.bonusDV || 0} DV</div>
                <div style="color:#aaa; font-size:12px; margin:8px 0;">Tổng: ${result.newEXP || 0} KN | ${result.newDV || 0} DV</div>
                <button onclick="window.location.href='pkm.html'"
                        style="background:${color}; color:white; border:none; padding:10px 30px;
                               border-radius:25px; cursor:pointer; font-weight:bold;">
                    TIẾP TỤC
                </button>`;
        }
        const overlay = document.getElementById('victory-overlay');
        if (overlay) overlay.style.display = 'flex';
    },
};

// KHÔNG tự gọi init() ở đây nữa — trang .html chỉ gọi khi thực sự có 1
// phòng đang chờ (tránh chạy nhầm khi ai đó mở thẳng trang này mà chưa
// ghép trận qua pkm_presence.js).
if (sessionStorage.getItem("pkm_net_room_id")) {
    window.BattleOnlineGame.init();
}
