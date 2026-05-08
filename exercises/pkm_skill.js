window.SkillManager = {
    systemConfig: {
        'electric': { color: '#f1c40f', effect: 'bolt', sound: 'zap' },
        'fire':     { color: '#e67e22', effect: 'fireball', sound: 'burn' },
        'water':    { color: '#3498db', effect: 'bubble', sound: 'splash' },
        'grass':    { color: '#2ecc71', effect: 'leaf', sound: 'slash' },
        'psychic':  { color: '#9b59b6', effect: 'beam', sound: 'psy' },
        'fighting': { color: '#e74c3c', effect: 'fist', sound: 'punch' },
        'ice':      { color: '#74b9ff', effect: 'ice-shard', sound: 'freeze' },
        'poison':   { color: '#a040a0', effect: 'toxic', sound: 'poison' },
        'ground':   { color: '#e2bf65', effect: 'rock', sound: 'earth' },
        'flying':   { color: '#a890f0', effect: 'wind', sound: 'gust' },
        'bug':      { color: '#a8b820', effect: 'sting', sound: 'insect' },
        'rock':     { color: '#b8a038', effect: 'stone', sound: 'rock' },
        'ghost':    { color: '#705898', effect: 'spirit', sound: 'ghost' },
        'dragon':   { color: '#7038f8', effect: 'dragon-breath', sound: 'roar' },
        'steel':    { color: '#b8b8d0', effect: 'flash', sound: 'metal' },
        'fairy':    { color: '#ee99ac', effect: 'sparkle', sound: 'magic' },
        'dark':     { color: '#705848', effect: 'shadow', sound: 'dark' },
        'normal':   { color: '#a8a878', effect: 'hit', sound: 'hit' }
    },

    async play(info) {
        const aliveEnemies = info.targets || []; 
        const attackerSide = info.attackerSide;
        const attackerIndex = info.attackerIndex;
        const attacker = document.getElementById(`${attackerSide}-unit-${attackerIndex}`);

        if (info.missed) {
            return new Promise(async resolve => {
                const attackerEl = document.getElementById(`${info.attackerSide}-unit-${info.attackerIndex}`);
                const targetSide = info.targetSide;
                const targetEl = document.getElementById(`${targetSide}-unit-${info.attackerIndex}`);

                // 1. Con tấn công lao tới như bình thường
                if (attackerEl) {
                    attackerEl.style.transition = "all 0.2s ease-in";
                    const moveY = info.attackerSide === 'player' ? -30 : 30;
                    attackerEl.style.transform = `translateY(${moveY}px) scale(1.15)`;
                }

                // 2. Con bị nhắm NÉ SANG BÊN
                if (targetEl) {
                    targetEl.style.transition = "all 0.15s ease-out";
                    const dodgeX = info.targetSide === 'enemy' ? 30 : -30;
                    targetEl.style.transform = `translateX(${dodgeX}px)`;
                }

                await new Promise(r => setTimeout(r, 200));

                // 3. Hiện chữ HỤT!
                if (targetEl) {
                    const rect = targetEl.getBoundingClientRect();
                    const missText = document.createElement('div');
                    missText.innerText = 'HỤT!';
                    missText.style.cssText = `
                        position: fixed;
                        left: ${rect.left + rect.width / 2}px;
                        top: ${rect.top - 10}px;
                        transform: translateX(-50%);
                        color: #feca57;
                        font-weight: 900;
                        font-size: 22px;
                        text-shadow: 2px 2px 0px #000;
                        z-index: 10000;
                        pointer-events: none;
                        animation: damageFloat 0.8s ease-out forwards;
                    `;
                    document.body.appendChild(missText);
                    setTimeout(() => missText.remove(), 800);
                }

                // 4. Cả 2 về vị trí cũ
                await new Promise(r => setTimeout(r, 300));
                if (attackerEl) attackerEl.style.transform = 'translateY(0) scale(1)';
                if (targetEl) targetEl.style.transform = 'translateX(0)';

                setTimeout(resolve, 300);
            });
        }

        return new Promise(async (resolve) => {
            this.toggleSkillScene(true, attackerSide, attackerIndex);

            // --- LOGIC MỚI: HIỆU ỨNG HÚC (ĐÁNH THƯỜNG) ---
            if (!info.isSkill) {
                const targetIdx = aliveEnemies[0];
                const target = document.getElementById(`${info.targetSide}-unit-${targetIdx}`);

                if (attacker && target) {
                    // Pokemon lao lên húc
                    attacker.style.transition = "all 0.2s ease-in";
                    const rectA = attacker.getBoundingClientRect();
                    const rectT = target.getBoundingClientRect();
                    const dist = (info.targetSide === 'enemy' ? 50 : -50);

                    attacker.style.transform = `translate(${rectT.left - rectA.left - dist}px, ${rectT.top - rectA.top}px) scale(1.2)`;

                    await new Promise(r => setTimeout(r, 200));

                    // Hiển thị số máu mất
                    this.createDamageText(target, info.damage);
                    target.classList.add('shake');

                    // Quay về chỗ cũ
                    attacker.style.transform = `translate(0, 0) scale(1)`;
                    await new Promise(r => setTimeout(r, 300));
                    target.classList.remove('shake');
                }
            } 
            // --- HIỆU ỨNG SKILL (PROJECTILE) ---
            // --- HIỆU ỨNG SKILL (PROJECTILE) ---
            // --- HIỆU ỨNG SKILL (PROJECTILE) ---
            else {
                let countPerTarget = 1;
                let sizeScale = 1;

                // Thiết lập số lượng và kích thước theo đời (Gen)
                switch(info.gen) {
                    case 1:
                        countPerTarget = 1;
                        sizeScale = 1;
                        break;
                    case 2:
                        countPerTarget = 2;
                        sizeScale = 1.5;
                        break;
                    case 3:
                        countPerTarget = 4;
                        sizeScale = 2;
                        break;
                    case 'mega': // Giả định bạn truyền gen là 'mega' cho dạng tiến hóa vượt trội
                    case 4: 
                        countPerTarget = 10;
                        sizeScale = 2.8;
                        break;
                    default:
                        countPerTarget = 1;
                        sizeScale = 1;
                }

                const effectData = this.systemConfig[info.type] || this.systemConfig['normal'];
                const targetSide = info.targetSide;

                const allAnimations = aliveEnemies.map(targetIdx => {
                    const targetEl = document.getElementById(`${targetSide}-unit-${targetIdx}`);
                    if (targetEl) {
                        this.createDamageText(targetEl, info.damage);
                    }
                    // Truyền thêm sizeScale vào hàm trigger
                    return this.triggerMultiEffect(attacker, targetIdx, targetSide, countPerTarget, effectData, sizeScale);
                });

                await Promise.all(allAnimations);
            }

            setTimeout(() => {
                this.toggleSkillScene(false);
                resolve();
            }, 500);
        });
    },

    // Hàm tạo số máu bay lên
    createDamageText(targetEl, damage) {
        if (!targetEl) return;
        const rect = targetEl.getBoundingClientRect();
        const text = document.createElement('div');
        text.className = 'damage-popup';
        text.innerText = `-${damage}`;
        text.style.cssText = `
            position: fixed;
            left: ${rect.left + rect.width/2}px;
            top: ${rect.top}px;
            color: #ff4757;
            font-weight: bold;
            font-size: 24px;
            text-shadow: 2px 2px 0px #000;
            z-index: 10000;
            pointer-events: none;
            animation: damageFloat 0.8s ease-out forwards;
        `;
        document.body.appendChild(text);
        setTimeout(() => text.remove(), 800);
    },

    async triggerMultiEffect(attacker, targetIdx, targetSide, count, effectData, sizeScale) {
        const target = document.getElementById(`${targetSide}-unit-${targetIdx}`);
        if (!target) return;

        for (let i = 0; i < count; i++) {
            // Truyền sizeScale xuống hàm tạo đạn
            this.createProjectile(attacker, target, effectData.color, i, sizeScale);
            if (count > 3) await new Promise(r => setTimeout(r, 50));
        }

        target.classList.add('shake');
        setTimeout(() => target.classList.remove('shake'), 400);
    },

    createProjectile(startEl, endEl, color, offset, sizeScale = 1) {
        if (!startEl || !endEl) return;
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        const p = document.createElement('div');
        p.className = 'skill-projectile';
        const drift = (offset - 1) * (15 * sizeScale); // Giãn khoảng cách tia theo kích thước

        // Tính toán kích thước dựa trên sizeScale (Gốc là 8x30)
        const width = 8 * sizeScale;
        const height = 30 * sizeScale;

        p.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width/2}px;
            top: ${rectS.top + rectS.height/2}px;
            width: ${width}px; 
            height: ${height}px;
            background: ${color};
            box-shadow: 0 0 ${15 * sizeScale}px ${color};
            border-radius: 50%;
            z-index: 9999;
            transform: rotate(${this.calcAngle(rectS, rectE)}deg);
            transition: all 0.4s cubic-bezier(0.6, -0.28, 0.735, 0.045);
        `;

        document.body.appendChild(p);

        requestAnimationFrame(() => {
            p.style.left = (rectE.left + rectE.width/2 + drift) + 'px';
            p.style.top = (rectE.top + rectE.height/2) + 'px';
        });

        setTimeout(() => p.remove(), 400);
    },

    calcAngle(s, e) {
        return Math.atan2(e.top - s.top, e.left - s.left) * 180 / Math.PI + 90;
    },

    toggleSkillScene(isActive, side, index) {
        if (isActive) {
            document.body.classList.add('skill-mode');
            document.querySelectorAll('.pkm-unit').forEach(unit => {
                // Giữ con đang đánh và team địch hiện rõ, còn lại làm mờ
                const isAttacker = unit.id === `${side}-unit-${index}`;
                const isEnemy = unit.id.includes('enemy') || unit.id.includes('player') && side === 'enemy';

                if (!isAttacker && !isEnemy) {
                    unit.style.opacity = '0.1';
                }
            });
        } else {
            document.body.classList.remove('skill-mode');
            document.querySelectorAll('.pkm-unit').forEach(unit => unit.style.opacity = '1');
        }
    }
};