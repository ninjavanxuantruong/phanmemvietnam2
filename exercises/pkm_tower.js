/**
 * ==========================================================
 * PKM TOWER DEFENSE — KIỂU PLANTS VS ZOMBIES (PvZ-lane)
 * ==========================================================
 * KIẾN TRÚC:
 *  - 3 làn dọc (lane), mỗi làn tối đa 3 tầng: tầng 0 = CẬN CHIẾN
 *    (đứng gần địch nhất, khi địch chạm tới sẽ bị "khựng" 1 khoảng
 *    thời gian rồi tự đi tiếp — địch KHÔNG bao giờ tấn công quân ta),
 *    tầng 1-2 = TẦM XA (bắn theo tầm bắn dọc làn, không có tương tác
 *    khựng).
 *  - Quân ta vẫn là Pokémon thật (ảnh GIF, tối đa 9 con cùng lúc nên
 *    không nặng). Quái là hình vẽ CSS thuần (không tải ảnh mạng) — xem
 *    khu MONSTER_SKINS bên dưới, dễ thêm loại mới sau này.
 *  - MỌI đòn tháp bắn ra gọi qua file RIÊNG pkm_tower_skill.js
 *    (window.TowerSkill) — KHÔNG dùng pkm_skill_normal.js/pkm_skill_aoe.js
 *    nữa (mỗi phát bắn ở đó tạo rất nhiều DOM node + setInterval tia lửa,
 *    bắn liên tục ở nhiều tháp cùng lúc gây đơ máy). TowerSkill viết CSS/WAAPI
 *    đơn giản, mỗi lần bắn chỉ 2-3 phần tử, tự dọn ngay khi xong:
 *      + Tháp CẬN CHIẾN (tầng 0) -> TowerSkill.meleeAttack (chớp/gạch chéo).
 *      + Tháp TẦM XA (tầng 1-2)  -> TowerSkill.fireRanged (viên đạn bay).
 *    Xem hàm fireAt() bên dưới. Chỉ cần 2 phần tử DOM (tháp + quái) có
 *    getBoundingClientRect, không cần cấu trúc gì đặc biệt.
 *  - Vàng + đội hình (roster) + cấp nâng cấp của từng con LƯU LÂU DÀI ở
 *    1 key localStorage RIÊNG (pkm_tower_state) — không đụng
 *    pkm_inventory/pkm_equipped/pkm_global_exp. Reset về mặc định khi
 *    THUA hoặc khi 3 NGÀY không chơi CHẾ ĐỘ NÀY.
 *  - Cửa hàng (~10 Pokémon random qua PokeAPI, ảnh TĨNH) refresh mỗi
 *    lần vào chơi (mỗi phiên), không refresh theo round.
 * ==========================================================
 */

window.TowerGame = {
    // ================= CẤU HÌNH =================
    STORAGE_KEY: 'pkm_tower_state',
    RESET_AFTER_DAYS: 3,
    MAX_LEAKS: 20,               // tổng số quái lọt qua CẢ PHIÊN (không reset theo round)

    LANE_X: [20, 50, 80],        // % vị trí ngang của 3 làn
    SLOT_Y: [58, 70, 82],        // % vị trí dọc của 3 tầng (0=cận chiến,1-2=tầm xa)
    SPAWN_Y: 4,
    LEAK_Y: 97,

    DEPTH_UNLOCK_ROUND: [1, 1, 1], // cả 9 ô (3 làn x 3 tầng) mở sẵn ngay từ round 1, muốn đặt tầng nào cũng được

    WAVE_BASE_COUNT: 6,
    WAVE_COUNT_STEP: 2,
    SPAWN_INTERVAL_MS: 1700, // giãn cách giữa 2 lần quái xuất hiện — tăng lên cho thưa, đỡ dày đặc

    QUIZ_INTERVAL_MS: 20000,
    WRONG_STUN_MS: 3000,
    MIN_QUESTIONS: 6,

    MELEE_COOLDOWN_MS: 900,
    RANGED_COOLDOWN_MS: 1100,
    STUN_BASE_MS: 1300,
    STUN_PER_LV_MS: 280,
    // Tháp tầm xa LUÔN bắn được lên phía trên (hướng quái đang tới) không giới
    // hạn — đúng vai trò "bắn từ xa". RANGE_*_PCT chỉ là phần "còn bắn thêm
    // được BAO NHIÊU sau khi quái đã đi NGANG QUA vị trí tháp" (để không mất
    // dấu ngay khi quái vừa lướt qua), không phải tầm bắn chính.
    RANGE_BASE_PCT: 10,
    RANGE_PER_LV_PCT: 4,

    DMG_FLOOR: 9,                  // damage tối thiểu (CP <= CP_FLOOR)
    CP_FLOOR: 2000,
    CP_CEIL: 10000,                // damage tối đa = 2x DMG_FLOOR tại CP này trở lên
    DMG_PER_LV: 0.15,              // +15%/cấp nâng damage

    UPGRADE_BASE_COST: 18,
    OWNED_SHOP_BASE_PRICE: 22,
    UNOWNED_SHOP_BASE_PRICE: 45,
    SHOP_SIZE: 10,

    MONSTER_BASE: {
        slime:    { hp: 70, speed: 4.6, gold: 8,  label: 'Slime' },
        skeleton: { hp: 45, speed: 7.2, gold: 12, label: 'Xương Khô' },
        bat:      { hp: 26, speed: 11,  gold: 15, label: 'Dơi' },
    },

    // ================= STATE PHIÊN CHƠI (không lưu) =================
    session: null,

    // ================= 1. LƯU TRỮ LÂU DÀI =================
    todayStr() { return new Date().toISOString().split('T')[0]; },

    daysBetween(a, b) {
        const d1 = new Date(a), d2 = new Date(b);
        return Math.floor((d2 - d1) / 86400000);
    },

    defaultState() {
        return { gold: 0, round: 1, leaksTotal: 0, roster: null, placement: {}, lastPlayDate: this.todayStr() };
    },

    loadPersisted() {
        let raw = null;
        try { raw = JSON.parse(localStorage.getItem(this.STORAGE_KEY)); } catch (e) { raw = null; }
        if (!raw) return { state: this.defaultState(), wasReset: true };

        const gap = this.daysBetween(raw.lastPlayDate || this.todayStr(), this.todayStr());
        if (gap >= this.RESET_AFTER_DAYS) {
            return { state: this.defaultState(), wasReset: true };
        }
        return { state: raw, wasReset: false };
    },

    savePersisted() {
        const s = this.session.persisted;
        s.lastPlayDate = this.todayStr();
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(s));
    },

    wipeAndRestart() {
        this.session.persisted = this.defaultState();
        this.savePersisted();
    },

    // ================= 2. TÍNH CHIẾN LỰC (CP) — QUY VỀ CƠ BẢN =================
    calcCP(baseStats, lv = 1) {
        const hp = baseStats?.hp || 20, atk = baseStats?.atk || 20,
              def = baseStats?.def || 15, sAtk = baseStats?.sAtk || 20;
        const baseCP = (hp * 15) + (def * 17.6) + (atk * 20) + (sAtk * 28.8);
        return Math.floor(baseCP * (1 + (lv - 1) * 0.1));
    },

    cpToDamageMultiplier(cp) {
        const t = Math.max(0, Math.min(1, (cp - this.CP_FLOOR) / (this.CP_CEIL - this.CP_FLOOR)));
        return 1 + t; // 1x .. 2x
    },

    towerDamage(entry) {
        const base = this.DMG_FLOOR * this.cpToDamageMultiplier(entry.cp);
        return Math.round(base * (1 + (entry.dmgLv || 0) * this.DMG_PER_LV));
    },

    towerStunMs(entry) { return this.STUN_BASE_MS + (entry.stunLv || 0) * this.STUN_PER_LV_MS; },
    towerRangePct(entry) { return this.RANGE_BASE_PCT + (entry.rangeLv || 0) * this.RANGE_PER_LV_PCT; },

    upgradeCost(entry, kind) {
        const lv = entry[kind + 'Lv'] || 0;
        const cpFactor = Math.pow(Math.max(1, entry.cp / this.CP_FLOOR), 1.2);
        return Math.round(this.UPGRADE_BASE_COST * (lv + 1) * cpFactor);
    },

    isPkmOwned(pkmId) {
        const inv = JSON.parse(localStorage.getItem('pkm_inventory')) || [];
        return inv.some(p => p.id === pkmId);
    },

    shopPrice(cp, owned) {
        return owned
            ? Math.round(this.OWNED_SHOP_BASE_PRICE + cp / 400)
            : Math.round(this.UNOWNED_SHOP_BASE_PRICE * Math.pow(Math.max(1, cp / this.CP_FLOOR), 1.3));
    },

    // ================= 3. POKEAPI (chỉ cho chỗ CẦN — kho hàng + lấp thiếu) =================
    async fetchPokeData(id) {
        const res = await fetch(`https://pokeapi.co/api/v2/pokemon/${id}`);
        const data = await res.json();
        const stat = (n) => (data.stats.find(s => s.stat.name === n) || {}).base_stat || 20;
        return {
            id: data.id,
            name: data.name.charAt(0).toUpperCase() + data.name.slice(1),
            type: (data.types[0] || { type: { name: 'normal' } }).type.name,
            height: data.height || 10,
            baseStats: { hp: stat('hp'), atk: stat('attack'), def: stat('defense'), sAtk: stat('special-attack') },
            spriteStatic: data.sprites?.other?.['official-artwork']?.front_default
                || data.sprites?.front_default
                || `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`,
        };
    },

    makeRosterEntry(d) {
        return {
            uid: 'r' + Math.random().toString(36).slice(2, 9),
            pkmId: d.pkmId, name: d.name, type: d.type || 'normal', gen: d.gen || 1, height: d.height || 10,
            cp: this.calcCP(d.baseStats, 1),
            dmgLv: 0, rangeLv: 0, stunLv: 0,
        };
    },

    async buildStartingRoster() {
        const inv = JSON.parse(localStorage.getItem('pkm_inventory')) || [];
        const team = inv.filter(p => p.inTeam).sort((a, b) => a.position - b.position).slice(0, 3);
        const roster = team.map(pkm => this.makeRosterEntry({
            pkmId: pkm.id, name: pkm.name, type: pkm.type, gen: pkm.gen,
            baseStats: pkm.baseStats, height: pkm.height,
        }));
        while (roster.length < 3) {
            try {
                const d = await this.fetchPokeData(Math.floor(Math.random() * 649) + 1);
                roster.push(this.makeRosterEntry(d));
            } catch (e) {
                roster.push(this.makeRosterEntry({
                    pkmId: 1, name: 'Bulbasaur', type: 'grass', gen: 1,
                    baseStats: { hp: 45, atk: 49, def: 49, sAtk: 65 }, height: 7,
                }));
            }
        }
        return roster;
    },

    // ================= 4. KHỞI TẠO =================
    async init() {
        this.injectMonsterStyles();

        const { state, wasReset } = this.loadPersisted();
        this.session = {
            persisted: state,
            shop: [],
            towers: {},        // key `${lane}-${depth}` -> {entry, el, lastShot}
            enemies: [],
            nextEnemyUid: 0,
            wave: { spawnedThisWave: 0, targetThisWave: 0, spawning: false, lastSpawnTs: 0 },
            correctCount: 0, wrongCount: 0, totalCount: 0, score: 0,
            paused: true,
            gameOverWiped: false,
            towerStunUntil: 0,
        };

        if (wasReset || !this.session.persisted.roster) {
            this.log('🌱 Bắt đầu chiến dịch Thủ Thành mới!');
            this.session.persisted.roster = await this.buildStartingRoster();
            this.session.persisted.placement = {};
            this.savePersisted();
        }

        await this.buildShop(); // refresh mỗi phiên (đã bàn), không phải mỗi round

        if (window.QuizManager) window.QuizManager.prepareData();

        const quizOverlay = document.getElementById('quiz-overlay');
        if (quizOverlay) quizOverlay.style.display = 'none';

        const renderLevelSelect = (container) => new Promise((resolve) => {
            const LEVELS = [
                { key: 'de', emoji: '🟢', label: 'Dễ' },
                { key: 'trung_binh', emoji: '🟡', label: 'Trung bình' },
                { key: 'kho', emoji: '🔴', label: 'Khó' },
            ];
            container.innerHTML = `
                <div style="text-align:center;">
                    <div style="font-size:16px;color:#FFCB05;font-weight:700;margin-bottom:18px;">🏰 Chọn cấp độ Thủ Thành!</div>
                    <div style="display:flex;gap:14px;justify-content:center;flex-wrap:wrap;">
                        ${LEVELS.map(lv => `
                            <div class="tower-level-card" data-level="${lv.key}" style="
                                background:rgba(255,255,255,.06); border:2px solid rgba(255,203,5,.3);
                                border-radius:16px; padding:18px 22px; text-align:center; cursor:pointer; min-width:110px;">
                                <div style="font-size:34px;">${lv.emoji}</div>
                                <div style="font-weight:800;color:#FFCB05;margin-top:6px;font-size:15px;">${lv.label}</div>
                            </div>`).join('')}
                    </div>
                </div>`;
            container.querySelectorAll('.tower-level-card').forEach(card => {
                card.onclick = () => { localStorage.setItem('selected_level', card.dataset.level); resolve(); };
            });
        });

        window.startPokemonBattle = async () => {
            let mainCard = document.getElementById('mainCard');
            if (!mainCard) { mainCard = document.createElement('div'); mainCard.id = 'mainCard'; document.body.appendChild(mainCard); }
            mainCard.style.cssText = `position:fixed; inset:0; background:radial-gradient(circle,#1a1c28 0%,#0a0c16 100%);
                z-index:99999; display:flex; align-items:center; justify-content:center; padding:20px; box-sizing:border-box;`;
            await renderLevelSelect(mainCard);
            mainCard.style.display = 'none';
            if (window.QuizManager) { window.QuizManager.loadLevel(); window.QuizManager.initSkillPools(); }
            this.updateHud();
            this.openArrangeScreen(); // vào thẳng màn sắp xếp đội hình cho round hiện tại
        };

        if (window.VocabularyModule && typeof window.VocabularyModule.start === 'function') {
            await window.VocabularyModule.start();
        } else {
            window.startPokemonBattle();
        }

        requestAnimationFrame(this.loop.bind(this));
    },

    // ================= 5. CỬA HÀNG =================
    async buildShop() {
        this.log('🛒 Đang tải cửa hàng...');
        const list = [];
        const used = new Set();
        let guard = 0;
        while (list.length < this.SHOP_SIZE && guard < this.SHOP_SIZE * 3) {
            guard++;
            const id = Math.floor(Math.random() * 649) + 1;
            if (used.has(id)) continue;
            used.add(id);
            try {
                const d = await this.fetchPokeData(id);
                const cp = this.calcCP(d.baseStats, 1);
                const owned = this.isPkmOwned(d.id);
                list.push({ ...d, cp, owned, price: this.shopPrice(cp, owned) });
            } catch (e) { /* bỏ qua nếu lỗi mạng, thử id khác */ }
        }
        this.session.shop = list;
    },

    openShop() {
        this.session.paused = true;
        const overlay = document.getElementById('shop-overlay');
        const list = document.getElementById('shop-list');
        if (!overlay || !list) return;
        list.innerHTML = this.session.shop.map(m => `
            <div class="shop-item">
                <img src="${m.spriteStatic}" alt="${m.name}">
                <div class="shop-item-name">${m.name}</div>
                <div class="shop-item-cp">CP ${m.cp.toLocaleString()}</div>
                <button class="shop-buy-btn" data-id="${m.id}">${m.owned ? '🏠 ' : ''}💰 ${m.price}</button>
            </div>`).join('');
        list.querySelectorAll('.shop-buy-btn').forEach(btn => {
            btn.onclick = () => this.buyMon(parseInt(btn.dataset.id, 10));
        });
        overlay.style.display = 'flex';
        this.renderRosterUpgradePanel();
    },

    closeShop() {
        document.getElementById('shop-overlay').style.display = 'none';
        const arrangeOverlay = document.getElementById('arrange-overlay');
        if (arrangeOverlay && arrangeOverlay.style.display === 'flex') {
            // Đang ở màn sắp xếp đội hình -> vẽ lại kho dự trữ để con vừa mua/
            // vừa nâng cấp hiện ra ngay, và GIỮ NGUYÊN paused=true (chưa vào trận).
            this.renderArrangeScreen();
        } else {
            this.session.paused = false;
        }
    },

    buyMon(pkmId) {
        const m = this.session.shop.find(x => x.id === pkmId);
        if (!m) return;
        const s = this.session.persisted;
        if (s.gold < m.price) { this.log('❌ Không đủ vàng!'); return; }
        s.gold -= m.price;
        s.roster.push(this.makeRosterEntry({ pkmId: m.id, name: m.name, type: m.type, gen: 1, baseStats: m.baseStats, height: m.height }));
        this.savePersisted();
        this.updateHud();
        this.openShop();
        this.log(`✅ Đã chiêu mộ ${m.name}!`);
    },

    renderRosterUpgradePanel() {
        const panel = document.getElementById('roster-upgrade-list');
        if (!panel) return;
        const s = this.session.persisted;
        panel.innerHTML = s.roster.map(e => {
            const placedKey = Object.keys(s.placement).find(k => s.placement[k] === e.uid);
            const isMelee = placedKey && placedKey.endsWith('-0');
            const rangeOrStunLabel = isMelee ? `⏱ Khựng Lv${e.stunLv}` : `🎯 Tầm Lv${e.rangeLv}`;
            const rangeOrStunKind = isMelee ? 'stun' : 'range';
            return `
            <div class="roster-card">
                <div class="roster-card-name">${e.name} <small>(CP ${e.cp.toLocaleString()})</small></div>
                <div class="roster-card-row">
                    <span>⚔️ Dmg Lv${e.dmgLv} (${this.towerDamage(e)})</span>
                    <button class="up-btn" data-uid="${e.uid}" data-kind="dmg">+💰${this.upgradeCost(e, 'dmg')}</button>
                </div>
                <div class="roster-card-row">
                    <span>${rangeOrStunLabel}</span>
                    <button class="up-btn" data-uid="${e.uid}" data-kind="${rangeOrStunKind}">+💰${this.upgradeCost(e, rangeOrStunKind)}</button>
                </div>
            </div>`;
        }).join('');
        panel.querySelectorAll('.up-btn').forEach(btn => {
            btn.onclick = () => this.upgrade(btn.dataset.uid, btn.dataset.kind);
        });
    },

    upgrade(uid, kind) {
        const s = this.session.persisted;
        const entry = s.roster.find(e => e.uid === uid);
        if (!entry) return;
        const cost = this.upgradeCost(entry, kind);
        if (s.gold < cost) { this.log('❌ Không đủ vàng để nâng cấp!'); return; }
        s.gold -= cost;
        entry[kind + 'Lv'] = (entry[kind + 'Lv'] || 0) + 1;
        this.savePersisted();
        this.updateHud();
        this.renderRosterUpgradePanel();
    },

    // ================= 6. MÀN SẮP XẾP ĐỘI HÌNH (đầu mỗi round) =================
    openArrangeScreen() {
        this.session.paused = true;
        clearTimeout(this._quizTimer);
        const overlay = document.getElementById('arrange-overlay');
        overlay.style.display = 'flex';
        this._selectedBenchUid = null;
        this.renderArrangeScreen();
    },

    unlockedDepths() {
        const round = this.session.persisted.round;
        return this.DEPTH_UNLOCK_ROUND.map(r => round >= r);
    },

    renderArrangeScreen() {
        const s = this.session.persisted;
        const unlocked = this.unlockedDepths();
        document.getElementById('arrange-round-label').innerText = `Chuẩn bị đợt ${s.round}`;

        const grid = document.getElementById('arrange-grid');
        let html = '';
        for (let lane = 0; lane < 3; lane++) {
            html += `<div class="arrange-lane">`;
            for (let depth = 0; depth < 3; depth++) {
                const key = `${lane}-${depth}`;
                const isUnlocked = unlocked[depth];
                const placedUid = s.placement[key];
                const placedEntry = placedUid ? s.roster.find(e => e.uid === placedUid) : null;
                const roleLabel = depth === 0 ? '⚔️ Cận chiến' : '🎯 Tầm xa';
                const roleClass = depth === 0 ? 'role-melee' : 'role-ranged';
                if (!isUnlocked) {
                    html += `<div class="arrange-slot locked ${roleClass}">🔒<div class="slot-role">${roleLabel}</div></div>`;
                } else if (placedEntry) {
                    html += `<div class="arrange-slot filled ${roleClass}" data-key="${key}">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${placedEntry.pkmId}.png">
                        <div class="slot-name">${placedEntry.name}</div>
                        <div class="slot-role">${roleLabel}</div>
                        <button class="slot-remove" data-key="${key}">×</button>
                    </div>`;
                } else {
                    html += `<div class="arrange-slot empty ${roleClass}" data-key="${key}">
                        <div class="slot-plus">+</div><div class="slot-role">${roleLabel}</div>
                    </div>`;
                }
            }
            html += `</div>`;
        }
        grid.innerHTML = html;

        grid.querySelectorAll('.arrange-slot.empty').forEach(el => {
            el.onclick = () => {
                if (!this._selectedBenchUid) return;
                s.placement[el.dataset.key] = this._selectedBenchUid;
                this._selectedBenchUid = null;
                this.savePersisted();
                this.renderArrangeScreen();
            };
        });
        grid.querySelectorAll('.slot-remove').forEach(btn => {
            btn.onclick = (ev) => {
                ev.stopPropagation();
                delete s.placement[btn.dataset.key];
                this.savePersisted();
                this.renderArrangeScreen();
            };
        });

        // Kho dự trữ: con chưa được đặt vào ô nào
        const placedUids = new Set(Object.values(s.placement));
        const bench = document.getElementById('arrange-bench');
        bench.innerHTML = s.roster.filter(e => !placedUids.has(e.uid)).map(e => `
            <div class="bench-item ${this._selectedBenchUid === e.uid ? 'selected' : ''}" data-uid="${e.uid}">
                <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${e.pkmId}.png">
                <div class="bench-item-name">${e.name}</div>
            </div>`).join('') || `<div style="color:#888;font-size:12px;">Kho trống — mua thêm ở cửa hàng!</div>`;
        bench.querySelectorAll('.bench-item').forEach(el => {
            el.onclick = () => { this._selectedBenchUid = (this._selectedBenchUid === el.dataset.uid) ? null : el.dataset.uid; this.renderArrangeScreen(); };
        });
    },

    confirmArrangeAndStart() {
        const hasAnyPlacement = Object.keys(this.session.persisted.placement).length > 0;
        if (!hasAnyPlacement) { this.log('⚠️ Hãy đặt ít nhất 1 Pokémon vào đội hình!'); return; }
        document.getElementById('arrange-overlay').style.display = 'none';
        this.buildTowerElements();
        this.startWave();
    },

    // ================= 7. DỰNG THÁP (POKÉMON THẬT — GIF, TỐI ĐA 9 CON) =================
    buildTowerElements() {
        const container = document.getElementById('tower-units');
        container.innerHTML = '';
        this.session.towers = {};
        const s = this.session.persisted;

        Object.entries(s.placement).forEach(([key, uid]) => {
            const entry = s.roster.find(e => e.uid === uid);
            if (!entry) return;
            const [lane, depth] = key.split('-').map(Number);
            const idx = lane * 3 + depth;
            const bodyScale = window.PkmStyles?.getBodyScale ? window.PkmStyles.getBodyScale(entry.height) : 1;
            const size = (window.PkmStyles && window.PkmStyles.UNIT_SIZE) || 80;
            const imgUrl = window.PkmStyles?.getImageUrl
                ? window.PkmStyles.getImageUrl(entry, 'player')
                : `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${entry.pkmId}.png`;
            const fallbackUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${entry.pkmId}.png`;

            const el = document.createElement('div');
            el.className = 'pkm-unit tower-unit';
            el.id = `player-unit-${idx}`;
            el.dataset.scale = bodyScale;
            el.dataset.flip = 1; // luôn quay lưng lên trên — hướng địch luôn từ trên xuống thẳng làn
            el.dataset.type = entry.type;
            el.style.cssText = `position:absolute; left:${this.LANE_X[lane]}%; top:${this.SLOT_Y[depth]}%;
                transform:translate(-50%,-50%); z-index:2; display:flex; flex-direction:column; align-items:center;`;
            el.innerHTML = `
                <div style="transform:scale(${bodyScale}) scaleX(1); transform-origin:center bottom;">
                    <div style="width:${size}px; height:${size}px; display:flex; align-items:center; justify-content:center;">
                        <img src="${imgUrl}" style="max-width:${size}px; max-height:${size}px; width:auto; height:auto;
                             object-fit:contain; filter:drop-shadow(0 5px 8px black); display:block;"
                             onerror="this.src='${fallbackUrl}'" alt="${entry.name}">
                    </div>
                </div>
                <div class="tower-tag ${depth === 0 ? 'role-melee' : 'role-ranged'}">${depth === 0 ? '⚔️' : '🎯'}</div>`;
            container.appendChild(el);

            this.session.towers[key] = {
                entry, el, idx, lane, depth,
                lastShot: 0,
                cooldown: depth === 0 ? this.MELEE_COOLDOWN_MS : this.RANGED_COOLDOWN_MS,
            };
        });
    },

    // ================= 8. WAVE / SPAWN =================
    startWave() {
        const s = this.session;
        const round = s.persisted.round;
        s.wave.spawnedThisWave = 0;
        s.wave.targetThisWave = this.WAVE_BASE_COUNT + (round - 1) * this.WAVE_COUNT_STEP;
        s.wave.lastSpawnTs = 0;
        s.wave.spawning = true;
        s.paused = false;
        this.log(`🌊 Đợt ${round} — ${s.wave.targetThisWave} quái!`);
        this.updateHud();
        this.scheduleNextQuiz();
    },

    roundMonsterPool(round) {
        if (round <= 2) return ['slime'];
        if (round <= 4) return ['slime', 'skeleton'];
        return ['slime', 'skeleton', 'bat'];
    },

    maybeSpawnEnemy(ts) {
        const w = this.session.wave;
        if (!w.spawning) return;
        if (w.spawnedThisWave >= w.targetThisWave) { w.spawning = false; return; }
        if (ts - w.lastSpawnTs < this.SPAWN_INTERVAL_MS) return;
        w.lastSpawnTs = ts;
        w.spawnedThisWave++;
        this.spawnEnemy();
    },

    spawnEnemy() {
        const s = this.session;
        const round = s.persisted.round;
        const pool = this.roundMonsterPool(round);
        const type = pool[Math.floor(Math.random() * pool.length)];
        const base = this.MONSTER_BASE[type];
        const hp = Math.round(base.hp * (1 + (round - 1) * 0.18));
        const speed = base.speed * (1 + (round - 1) * 0.04);
        const gold = Math.round(base.gold * (1 + (round - 1) * 0.15));
        const lane = Math.floor(Math.random() * 3);
        const uid = s.nextEnemyUid++;

        const container = document.getElementById('tower-enemies');
        const el = document.createElement('div');
        el.className = 'pkm-unit tower-enemy';
        el.id = `enemy-unit-${uid}`;
        el.style.cssText = `position:absolute; left:${this.LANE_X[lane]}%; top:${this.SPAWN_Y}%; transform:translate(-50%,-50%); z-index:3;`;
        el.innerHTML = `${this.buildMonsterHTML(type)}<div class="enemy-hp-bg"><div class="enemy-hp-fill" id="enemy-hp-${uid}"></div></div>`;
        container.appendChild(el);

        s.enemies.push({ uid, el, lane, type, hp, maxHp: hp, speed, gold, y: this.SPAWN_Y, alive: true, frozen: false, hasBeenStunned: false, stunElapsed: 0, stunDuration: 0 });
    },

    // ================= 9. QUÁI VẼ CSS =================
    injectMonsterStyles() {
        if (document.getElementById('tower-monster-style')) return;
        const style = document.createElement('style');
        style.id = 'tower-monster-style';
        style.textContent = `
            @keyframes towerMonSquish { 0%,100%{transform:scaleX(1) scaleY(1);} 50%{transform:scaleX(1.14) scaleY(0.82);} }
            @keyframes towerMonBob { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-4px);} }
            @keyframes towerLegSwing { 0%,100%{transform:rotate(-10deg);} 50%{transform:rotate(10deg);} }
            @keyframes towerWingFlapL { 0%,100%{transform:rotate(18deg);} 50%{transform:rotate(-38deg);} }
            @keyframes towerWingFlapR { 0%,100%{transform:rotate(-18deg);} 50%{transform:rotate(38deg);} }
            @keyframes towerBatFloat { 0%,100%{transform:translateY(0);} 50%{transform:translateY(-6px);} }

            .mon-slime .slime-body {
                width:34px; height:26px; border-radius:50% 50% 45% 45% / 65% 65% 35% 35%;
                background:linear-gradient(160deg,#eafff0,#4ce07a 55%,#1f9b4d);
                border:2px solid #157a3a;
                box-shadow:inset -4px -6px 8px rgba(0,0,0,.25), inset 3px 3px 6px rgba(255,255,255,.5);
                animation: towerMonSquish 1.05s ease-in-out infinite;
            }
            .mon-skeleton { position:relative; width:26px; height:40px; animation: towerMonBob .6s ease-in-out infinite; }
            .mon-skeleton .sk-head {
                position:absolute; left:50%; top:0; transform:translateX(-50%);
                width:16px; height:16px; border-radius:50%; background:#f2ede0; border:2px solid #b9b09a;
            }
            .mon-skeleton .sk-head::before, .mon-skeleton .sk-head::after {
                content:''; position:absolute; top:6px; width:3px; height:3px; border-radius:50%; background:#333;
            }
            .mon-skeleton .sk-head::before { left:3px; } .mon-skeleton .sk-head::after { right:3px; }
            .mon-skeleton .sk-body {
                position:absolute; left:50%; top:15px; transform:translateX(-50%);
                width:12px; height:18px; border-radius:3px;
                background:repeating-linear-gradient(180deg,#f2ede0 0 3px,#c9c0a8 3px 5px);
                border:1px solid #b9b09a;
            }
            .mon-skeleton .sk-leg { position:absolute; top:32px; width:4px; height:10px; background:#e6e0cf; border-radius:2px; transform-origin:top center; }
            .mon-skeleton .sk-leg-l { left:9px; animation: towerLegSwing .5s ease-in-out infinite; }
            .mon-skeleton .sk-leg-r { right:9px; animation: towerLegSwing .5s ease-in-out infinite reverse; }

            .mon-bat { position:relative; width:40px; height:26px; animation: towerBatFloat .9s ease-in-out infinite; }
            .mon-bat .bat-body { position:absolute; left:50%; top:6px; transform:translateX(-50%); width:12px; height:14px; border-radius:50%; background:#3a2f4a; border:1px solid #1e1626; }
            .mon-bat .bat-wing { position:absolute; top:8px; width:16px; height:12px; background:linear-gradient(160deg,#5a4a72,#2a2038); }
            .mon-bat .bat-wing-l { left:0; clip-path:polygon(100% 0%, 0% 40%, 60% 100%, 100% 60%); transform-origin: 100% 30%; animation: towerWingFlapL .35s ease-in-out infinite; }
            .mon-bat .bat-wing-r { right:0; clip-path:polygon(0% 0%, 100% 40%, 40% 100%, 0% 60%); transform-origin: 0% 30%; animation: towerWingFlapR .35s ease-in-out infinite; }
        `;
        document.head.appendChild(style);
    },

    buildMonsterHTML(type) {
        if (type === 'slime') return `<div class="mon mon-slime"><div class="slime-body"></div></div>`;
        if (type === 'skeleton') return `<div class="mon mon-skeleton"><div class="sk-head"></div><div class="sk-body"></div><div class="sk-leg sk-leg-l"></div><div class="sk-leg sk-leg-r"></div></div>`;
        return `<div class="mon mon-bat"><div class="bat-wing bat-wing-l"></div><div class="bat-wing bat-wing-r"></div><div class="bat-body"></div></div>`;
    },

    // ================= 10. VÒNG LẶP CHÍNH =================
    loop(ts) {
        const dt = Math.min(0.05, (ts - (this._lastTs || ts)) / 1000);
        this._lastTs = ts;
        if (this.session && !this.session.paused && !this.session.gameOverWiped) {
            this.maybeSpawnEnemy(ts);
            this.updateEnemies(dt);
            this.updateTowers(ts);
        }
        requestAnimationFrame(this.loop.bind(this));
    },

    updateEnemies(dt) {
        const s = this.session;
        for (let i = s.enemies.length - 1; i >= 0; i--) {
            const e = s.enemies[i];
            if (!e.alive) continue;

            if (e.frozen) {
                e.stunElapsed += dt * 1000;
                if (e.stunElapsed >= e.stunDuration) e.frozen = false;
                continue;
            }

            e.y += e.speed * dt;
            e.el.style.top = e.y + '%';
            const fill = document.getElementById(`enemy-hp-${e.uid}`);
            if (fill) fill.style.width = Math.max(0, (e.hp / e.maxHp) * 100) + '%';

            const meleeKey = `${e.lane}-0`;
            const meleeTower = s.towers[meleeKey];
            if (meleeTower && !e.hasBeenStunned && e.y >= this.SLOT_Y[0]) {
                e.frozen = true; e.hasBeenStunned = true; e.stunElapsed = 0;
                e.stunDuration = this.towerStunMs(meleeTower.entry);
            }

            if (e.y >= this.LEAK_Y) this.enemyLeak(e);
        }
    },

    updateTowers(ts) {
        const s = this.session;
        if (ts < s.towerStunUntil) return; // trả lời sai câu hỏi -> quân ta khựng toàn bộ vài giây
        Object.values(s.towers).forEach(tower => {
            if (ts - tower.lastShot < tower.cooldown) return;
            let target = null;
            if (tower.depth === 0) {
                target = s.enemies.find(e => e.alive && e.lane === tower.lane && e.frozen);
            } else {
                // Tầm xa: bắn được TOÀN BỘ phía trên vị trí tháp (hướng quái đang
                // tới, không giới hạn khoảng cách) + thêm 1 đoạn nhỏ phía dưới
                // (đã đi qua) theo towerRangePct — nhờ vậy tháp tầm xa "đón đầu"
                // được quái ngay từ lúc vừa xuất hiện, không phải đợi tới gần.
                const laneY = this.SLOT_Y[tower.depth];
                const buffer = this.towerRangePct(tower.entry);
                const candidates = s.enemies.filter(e => e.alive && e.lane === tower.lane && e.y <= laneY + buffer);
                if (candidates.length) target = candidates.reduce((b, e) => (e.y > b.y ? e : b), candidates[0]);
            }
            if (!target) return;
            tower.lastShot = ts;
            this.fireAt(tower, target);
        });
    },

    fireAt(tower, target) {
        const damage = this.towerDamage(tower.entry);
        target.hp -= damage;

        // Dùng file skill NHẸ RIÊNG cho Thủ Thành (pkm_tower_skill.js) — không
        // còn gọi SkillManager của pkm_skill_normal.js nữa (mỗi phát bắn ở đó
        // tạo rất nhiều DOM node + setInterval tia lửa, bắn liên tục nhiều
        // tháp cùng lúc gây đơ). TowerSkill chỉ tạo 2-3 phần tử/lần bắn, không
        // setInterval, tự dọn dẹp ngay khi xong.
        if (window.TowerSkill) {
            if (tower.depth === 0) {
                window.TowerSkill.meleeAttack(tower.el, target.el, { type: tower.entry.type, damage });
            } else {
                window.TowerSkill.fireRanged(tower.el, target.el, { type: tower.entry.type, damage });
            }
        }

        if (target.hp <= 0 && target.alive) {
            target.alive = false; // khoá ngay để tránh bị nhắm 2 lần trong lúc chờ hiệu ứng
            setTimeout(() => this.enemyDie(target), 120);
        }
    },

    enemyDie(e) {
        const s = this.session;
        s.persisted.gold += e.gold;
        s.score += 10;
        this.floatingText(e.el, `+${e.gold}💰`, '#ffd700');
        e.el.style.transition = 'opacity .25s, transform .25s';
        e.el.style.opacity = '0';
        e.el.style.transform += ' scale(0.4)';
        setTimeout(() => e.el.remove(), 260);
        const idx = s.enemies.indexOf(e);
        if (idx !== -1) s.enemies.splice(idx, 1);
        this.savePersisted();
        this.updateHud();
        this.checkWaveCleared();
    },

    enemyLeak(e) {
        const s = this.session;
        e.alive = false;
        e.el.remove();
        s.persisted.leaksTotal++;
        this.log(`💢 1 quái lọt qua! (${s.persisted.leaksTotal}/${this.MAX_LEAKS})`);
        const idx = s.enemies.indexOf(e);
        if (idx !== -1) s.enemies.splice(idx, 1);
        this.savePersisted();
        this.updateHud();
        if (s.persisted.leaksTotal >= this.MAX_LEAKS) { this.gameOverWipe(); return; }
        this.checkWaveCleared();
    },

    checkWaveCleared() {
        const s = this.session;
        if (s.gameOverWiped) return;
        if (!s.wave.spawning && s.enemies.length === 0 && s.wave.spawnedThisWave >= s.wave.targetThisWave) {
            s.paused = true;
            clearTimeout(this._quizTimer);
            setTimeout(() => {
                s.persisted.round++;
                this.savePersisted();
                this.updateHud();
                this.openArrangeScreen();
            }, 1200);
        }
    },

    // ================= 11. QUIZ MỖI ~10s =================
    scheduleNextQuiz() {
        clearTimeout(this._quizTimer);
        this._quizTimer = setTimeout(() => this.triggerQuiz(), this.QUIZ_INTERVAL_MS);
    },

        triggerQuiz() {
            if (this.session.gameOverWiped) return;
            this.session.paused = true; // câu hỏi xuất hiện -> quái/tháp/mọi thứ tạm dừng hoàn toàn
            const overlay = document.getElementById('quiz-overlay');
            if (overlay) overlay.style.display = 'flex';
            if (window.QuizManager) window.QuizManager.ask((isCorrect) => this.onQuizAnswered(isCorrect));
            else this.onQuizAnswered(true);
        },

        onQuizAnswered(isCorrect) {
            const s = this.session;
            if (window.PkmScore) window.PkmScore.recordAnswer(isCorrect);
            s.totalCount++;
            if (isCorrect) s.correctCount++; else s.wrongCount++;
            this.updateHud();

            const overlay = document.getElementById('quiz-overlay');
            if (overlay) overlay.style.display = 'none';
            s.paused = false; // trả lời xong -> chạy tiếp

        if (!isCorrect) {
            s.towerStunUntil = performance.now() + this.WRONG_STUN_MS;
            document.querySelectorAll('.tower-unit').forEach(el => el.classList.add('tower-stunned'));
            setTimeout(() => document.querySelectorAll('.tower-unit').forEach(el => el.classList.remove('tower-stunned')), this.WRONG_STUN_MS);
        }

        if (!s.gameOverWiped) this.scheduleNextQuiz();
    },

    // ================= 12. THUA — RESET TOÀN BỘ =================
    gameOverWipe() {
        const s = this.session;
        s.gameOverWiped = true;
        s.paused = true;
        clearTimeout(this._quizTimer);
        if (window.PkmScore) window.PkmScore.finishMatch({ won: false, minQuestions: this.MIN_QUESTIONS });
        this.wipeAndRestart();

        const overlay = document.getElementById('victory-overlay');
        document.getElementById('victory-title-text').innerText = '💀 THÀNH ĐÃ THẤT THỦ!';
        document.getElementById('victory-exp-text').innerHTML = `
            <div style="color:#ccc; margin-bottom:10px;">Đã để lọt quá ${this.MAX_LEAKS} quái — toàn bộ vàng,
            đội hình và tiến trình chiến dịch đã được <b>đặt lại từ đầu</b>.</div>
            <div style="color:#aaa; font-size:12px;">📊 ✅ ${s.correctCount} / ❌ ${s.wrongCount} câu &nbsp; ⭐ ${s.score} điểm</div>`;
        if (overlay) overlay.style.display = 'flex';
    },

    // ================= 13. HUD / LOG / HIỆU ỨNG NHỎ =================
    updateHud() {
        const s = this.session.persisted;
        const el = (id) => document.getElementById(id);
        if (el('tower-round')) el('tower-round').innerText = `Đợt ${s.round}`;
        if (el('tower-gold')) el('tower-gold').innerText = `💰 ${s.gold}`;
        if (el('tower-leaks')) el('tower-leaks').innerText = `💢 ${s.leaksTotal}/${this.MAX_LEAKS}`;
        if (el('quiz-stats')) el('quiz-stats').innerHTML = `✅ ${this.session.correctCount} &nbsp; ❌ ${this.session.wrongCount} &nbsp; 📊 ${this.session.totalCount} câu`;
    },

    floatingText(anchorEl, text, color) {
        const div = document.createElement('div');
        div.innerText = text;
        div.style.cssText = `position:absolute; left:50%; top:0; transform:translate(-50%,0);
            color:${color}; font-weight:900; font-size:13px; text-shadow:1px 1px 2px #000;
            pointer-events:none; z-index:20; transition: transform .8s ease-out, opacity .8s ease-out;`;
        anchorEl.appendChild(div);
        requestAnimationFrame(() => { div.style.transform = 'translate(-50%,-30px)'; div.style.opacity = '0'; });
        setTimeout(() => div.remove(), 850);
    },

    log(msg) {
        console.log('🏰 [TOWER]: ' + msg);
        const el = document.getElementById('tower-log');
        if (!el) return;
        el.innerText = msg;
        el.style.opacity = '1';
        clearTimeout(this._logTimeout);
        this._logTimeout = setTimeout(() => { el.style.opacity = '0'; }, 1800);
    },
};

window.TowerGame.init();
