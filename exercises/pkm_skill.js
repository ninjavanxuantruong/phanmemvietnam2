// Tự động nạp CSS cho Skill
(function() {
    const cssPath = 'pkm_skill.css';
    if (!document.querySelector(`link[href="${cssPath}"]`)) {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.type = 'text/css';
        link.href = cssPath;
        document.head.appendChild(link);
    }
})();

window.SkillManager = {
    // --- CẤU HÌNH ÂM THANH MỚI ---
    audioBaseUrl: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/s%20(",

    // Hàm đọc tên Pokemon
    speakName(name) {
        if (!window.speechSynthesis || !name) return;
        window.speechSynthesis.cancel(); // Ngắt tiếng cũ nếu đang đọc dở
        const msg = new SpeechSynthesisUtterance(name);
        msg.lang = 'en-US';
        msg.rate = 1.0;
        window.speechSynthesis.speak(msg);
    },

    // Hàm phát âm thanh ngẫu nhiên từ s (1).wav đến s (7).wav
    playRandomSfx() {
        const randomNum = Math.floor(Math.random() * 7) + 1; // Ngẫu nhiên từ 1-7
        const audioUrl = `${this.audioBaseUrl}${randomNum}).wav`;
        const audio = new Audio(audioUrl);
        audio.volume = 0.6;
        audio.play().catch(e => console.warn("Audio play blocked hoặc lỗi link"));
    },
    // Hàm rung màn hình hệ thống - Tỷ lệ theo Gen (sizeScale)
    applyGlobalShake(scale) {
        // Gen 1 (scale 1) rung 4px, Gen 4 (scale 2.5) rung 10px
        const intensity = 2 * scale; 
        const duration = 500; 

        document.body.animate([
            { transform: `translate(${intensity}px, ${intensity}px)` },
            { transform: `translate(-${intensity}px, -${intensity * 2}px)` },
            { transform: `translate(-${intensity * 2}px, 0px)` },
            { transform: `translate(${intensity * 2}px, ${intensity}px)` },
            { transform: `translate(0px, 0px)` }
        ], { 
            duration: 100, 
            iterations: duration / 100 
        });
    },

    durationConfig: {
        projectileFly: 800,
        delayBetween: 300,
        particleLife: 1000,
        electricBolt: 300,
        shake: 800,
        statusText: 1600,
        sceneTransition: 1200 
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
        'steel': { color: '#b8b8d0' },    // Hệ Thép (Màu bạc ánh kim)
        'dragon': { color: '#7038f8' },   // Hệ Rồng (Màu lam tím đậm)
        'fairy': { color: '#ee99ac' },    // Hệ Tiên (Màu hồng phấn)
    },
    toggleSkillScene(show, side = '', attackerIndex = null, type = 'normal') {
        const overlay = document.getElementById('skill-scene-overlay');
        if (!overlay) return;

        if (show) {
            // 1. Xóa hết các class màu cũ (để tránh bị chồng chéo màu)
            overlay.className = ''; 

            // 2. Thêm class màu tương ứng với hệ (type) của Pokemon
            overlay.classList.add(`bg-skill-${type}`);

            // 3. Hiện overlay
            overlay.style.display = 'block';
            overlay.style.opacity = '1';

            // 4. Đẩy Pokemon lên trên
            if (side && attackerIndex !== null) {
                const attacker = document.getElementById(`${side}-unit-${attackerIndex}`);
                if (attacker) attacker.style.zIndex = '10000';
            }
        } else {
            // Ẩn overlay
            overlay.style.opacity = '0';
            setTimeout(() => { 
                overlay.style.display = 'none';
                // Reset z-index
                document.querySelectorAll('.pkm-unit').forEach(u => {
                    u.style.zIndex = '';
                    u.style.transform = 'translate(-50%,-50%)';
                });
            }, 500); // Đợi hiệu ứng mờ dần xong mới ẩn hẳn
        }
    },

    async play(info) {
        const aliveEnemies = info.targets || [];
        const attackerSide = info.attackerSide;
        const attackerIndex = info.attackerIndex;
        const attacker = document.getElementById(`${attackerSide}-unit-${attackerIndex}`);

        // --- 1. XỬ LÝ ĐÁNH HỤT (Né đòn & Hiện chữ - Im lặng) ---
        if (info.missed) {
            return new Promise(async resolve => {
                const targetSide = info.targetSide;
                const targetIdx = aliveEnemies[0];
                const targetEl = document.getElementById(`${targetSide}-unit-${targetIdx}`);

                if (attacker) {
                    attacker.style.transition = "all 0.2s ease-in";
                    const moveY = attackerSide === 'player' ? -30 : 30;
                    const aScale = attacker.dataset.scale || 1;
                    const aFlip  = attacker.dataset.flip  || 1;
                    attacker.style.transform = `translate(-50%,-50%) translateY(${moveY}px) scale(${aScale}) scaleX(${aFlip})`;
                }
                if (targetEl) {
                    targetEl.style.transition = "all 0.15s ease-out";
                    const dodgeX = targetSide === 'enemy' ? 30 : -30;
                    targetEl.style.transform = `translateX(${dodgeX}px)`;
                }

                await new Promise(r => setTimeout(r, 200));
                // Hiện chữ HỤT! theo style sếp chọn
                if (targetEl) this.showStatusText(targetEl, 'HỤT!', '#feca57');

                await new Promise(r => setTimeout(r, 300));
                if (attacker) {
                    const aScale = attacker.dataset.scale || 1;
                    const aFlip  = attacker.dataset.flip  || 1;
                    attacker.style.transform = 'translate(-50%,-50%)';
                }
                if (targetEl) {
                    const tScale = targetEl.dataset.scale || 1;
                    const tFlip  = targetEl.dataset.flip  || 1;
                    targetEl.style.transform = 'translate(-50%,-50%)';
                }

                setTimeout(resolve, 300);
            });
        }

        return new Promise(async (resolve) => {
            // Bật nền tối kỹ năng
            this.toggleSkillScene(true, attackerSide, attackerIndex, info.type);

            // Đẩy các mục tiêu lên z-index cao để nổi trên nền đen
            aliveEnemies.forEach(idx => {
                const targetEl = document.getElementById(`${info.targetSide}-unit-${idx}`);
                if (targetEl) targetEl.style.zIndex = '10000';
            });

            // --- 2. XỬ LÝ ĐÁNH THƯỜNG (Lao vào húc - Im lặng) ---
            if (!info.isSkill) {
                const targetIdx = aliveEnemies[0];
                const target = document.getElementById(`${info.targetSide}-unit-${targetIdx}`);

                if (attacker && target) {
                    attacker.style.transition = "all 0.2s ease-in";
                    const rectA = attacker.getBoundingClientRect();
                    const rectT = target.getBoundingClientRect();
                    const dist = (info.targetSide === 'enemy' ? 50 : -50);

                    const aScale2 = attacker.dataset.scale || 1;
                    const aFlip2  = attacker.dataset.flip  || 1;
                    attacker.style.transform = `translate(calc(-50% + ${rectT.left - rectA.left - dist}px), calc(-50% + ${rectT.top - rectA.top}px))`;

                    await new Promise(r => setTimeout(r, 200));

                    // Không phát bất kỳ âm thanh nào ở đây theo ý sếp
                    this.createDamageText(target, info.damage);
                    target.classList.add('shake');

                    const aScale3 = attacker.dataset.scale || 1;
                    const aFlip3  = attacker.dataset.flip  || 1;
                    attacker.style.transform = 'translate(-50%,-50%)';
                    await new Promise(r => setTimeout(r, this.durationConfig.shake));
                    target.classList.remove('shake');
                }
            } 
            // --- 3. XỬ LÝ SKILL (Có hiệu ứng & 1 tiếng SFX duy nhất) ---
            // --- 3. XỬ LÝ SKILL (Di chuyển ra điểm giữa sân rồi tung chiêu) ---
            else {
                let countPerTarget = 1, sizeScale = 1;
                // Lấy scale & flip gốc của attacker để dùng trong animation gồng
                const pos = {
                    scale: parseFloat(attacker.dataset.scale) || 1,
                    flip:  parseFloat(attacker.dataset.flip)  || 1
                };
                switch(info.gen) {
                    case 1: countPerTarget = 1; break;
                    case 2: countPerTarget = 2; sizeScale = 1.3; break;
                    case 3: countPerTarget = 4; sizeScale = 1.8; break;
                    case 'mega': case 4: countPerTarget = 8; sizeScale = 2.5; break;
                }

                // ── BƯỚC 1: Tính toán điểm giữa sân (stage) ──
                const arena = document.getElementById('battle-arena');
                const rectArena = arena ? arena.getBoundingClientRect() : null;
                const rectA = attacker.getBoundingClientRect();

                // Điểm giữa sân = 50% ngang, 46% dọc (khớp với #arena-spotlight trong pkm_arena3d.js)
                const stageCX = rectArena ? rectArena.left + rectArena.width  * 0.50 : window.innerWidth  * 0.50;
                const stageCY = rectArena ? rectArena.top  + rectArena.height * 0.46 : window.innerHeight * 0.46;

                // Offset để attacker đến đúng tâm stage
                const moveX = stageCX - (rectA.left + rectA.width  / 2);
                const moveY = stageCY - (rectA.top  + rectA.height / 2);

                // ── BƯỚC 2: Pokemon lướt ra giữa sân ──
                attacker.style.transition = 'transform 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)';
                attacker.style.transform  = `translate(calc(-50% + ${moveX}px), calc(-50% + ${moveY}px))`;
                attacker.style.zIndex     = '10001';
                await new Promise(r => setTimeout(r, 380));

                // ── BƯỚC 2.5: HIỆU ỨNG GỒNG ──
                // Lấy màu theme nếu có (từ pkm_arena3d.js), fallback về vàng
                const auraColor = (window.ArenaTheme && window.ArenaTheme.stage) ? window.ArenaTheme.stage : '#ffcb05';
                const typeColor  = (this.systemConfig[info.type] || {}).color || auraColor;

                // Tạo div hào quang xoay quanh người
                const auraEl = document.createElement('div');
                auraEl.style.cssText = `
                    position: fixed;
                    left: ${stageCX}px;
                    top:  ${stageCY}px;
                    width: 0; height: 0;
                    pointer-events: none;
                    z-index: 10002;
                `;
                // Vòng 1: hào quang ngoài xoay chậm
                const ring1 = document.createElement('div');
                ring1.style.cssText = `
                    position:absolute;
                    width:110px; height:110px;
                    border-radius:50%;
                    border: 3px solid ${typeColor};
                    box-shadow: 0 0 18px ${typeColor}, inset 0 0 18px ${typeColor}44;
                    transform: translate(-50%,-50%) scale(0.3);
                    opacity:0;
                    transition: transform 0.25s ease-out, opacity 0.2s;
                `;
                // Vòng 2: hào quang trong xoay nhanh hơn
                const ring2 = document.createElement('div');
                ring2.style.cssText = `
                    position:absolute;
                    width:75px; height:75px;
                    border-radius:50%;
                    border: 2px dashed ${auraColor};
                    box-shadow: 0 0 12px ${auraColor};
                    transform: translate(-50%,-50%) scale(0.3);
                    opacity:0;
                    transition: transform 0.2s ease-out, opacity 0.15s;
                `;
                auraEl.appendChild(ring1);
                auraEl.appendChild(ring2);
                document.body.appendChild(auraEl);

                // Hiện vòng hào quang
                requestAnimationFrame(() => {
                    ring1.style.transform = 'translate(-50%,-50%) scale(1)';
                    ring1.style.opacity   = '1';
                    ring2.style.transform = 'translate(-50%,-50%) scale(1)';
                    ring2.style.opacity   = '1';
                });

                // Xoay liên tục trong khi gồng
                let ringAngle1 = 0, ringAngle2 = 0;
                const spinId = setInterval(() => {
                    ringAngle1 += 3;
                    ringAngle2 -= 5;
                    ring1.style.transform = `translate(-50%,-50%) scale(1) rotate(${ringAngle1}deg)`;
                    ring2.style.transform = `translate(-50%,-50%) scale(1) rotate(${ringAngle2}deg)`;
                }, 16);

                // Thêm particles tia sáng bắn ra trong khi gồng
                const chargeParticles = [];
                for (let i = 0; i < 8; i++) {
                    setTimeout(() => {
                        const p = document.createElement('div');
                        const angle = Math.random() * Math.PI * 2;
                        const dist  = 40 + Math.random() * 30;
                        p.style.cssText = `
                            position:fixed;
                            left:${stageCX}px; top:${stageCY}px;
                            width:6px; height:6px;
                            border-radius:50%;
                            background:${typeColor};
                            box-shadow: 0 0 8px ${typeColor};
                            pointer-events:none; z-index:10003;
                            opacity:0.9;
                        `;
                        document.body.appendChild(p);
                        chargeParticles.push(p);
                        p.animate([
                            { transform: 'translate(-50%,-50%) scale(1)', opacity: 0.9 },
                            { transform: `translate(calc(-50% + ${Math.cos(angle)*dist}px), calc(-50% + ${Math.sin(angle)*dist}px)) scale(0)`, opacity: 0 }
                        ], { duration: 500, easing: 'ease-out' }).onfinish = () => p.remove();
                    }, i * 80);
                }

                // GỒNG: nhỏ lại → nở ra theo nhịp
                attacker.style.transition = 'none';

                // Thu nhỏ (nín thở)
                const imgWrapper = attacker.querySelector('div');
                if (imgWrapper) {
                    imgWrapper.style.transition = 'transform 0.2s ease-in';
                    imgWrapper.style.transform  = `scale(${pos.scale * 0.6}) scaleX(${pos.flip})`;
                }
                await new Promise(r => setTimeout(r, 220));

                // Nở ra mạnh hơn bình thường (nhún người)
                if (imgWrapper) {
                    imgWrapper.style.transition = 'transform 0.15s cubic-bezier(0.34,1.56,0.64,1)';
                    imgWrapper.style.transform  = `scale(${pos.scale * 1.25}) scaleX(${pos.flip})`;
                }
                await new Promise(r => setTimeout(r, 160));

                // Về đúng kích cỡ thường
                if (imgWrapper) {
                    imgWrapper.style.transition = 'transform 0.12s ease-out';
                    imgWrapper.style.transform  = `scale(${pos.scale}) scaleX(${pos.flip})`;
                }
                await new Promise(r => setTimeout(r, 130));

                // Dừng xoay, xóa hào quang
                clearInterval(spinId);
                ring1.style.opacity = '0';
                ring2.style.opacity = '0';
                setTimeout(() => auraEl.remove(), 300);

                // ── BƯỚC 3: Tung chiêu tại điểm giữa ──
                setTimeout(() => this.playRandomSfx(), 400);

                const effectData = this.systemConfig[info.type] || this.systemConfig['normal'];
                const allAnimations = aliveEnemies.map(targetIdx =>
                    this.triggerMultiEffect(attacker, targetIdx, info.targetSide, countPerTarget, effectData, sizeScale, info.type, info.damage)
                );
                await Promise.all(allAnimations);

                // ── BƯỚC 4: Pokemon lướt về vị trí gốc ──
                attacker.style.transition = 'transform 0.3s ease-out';
                attacker.style.transform  = 'translate(-50%,-50%)';
                await new Promise(r => setTimeout(r, 320));
                attacker.style.transition = '';
                attacker.style.zIndex     = '';
            }

            // Kết thúc: Ẩn nền đen và kết thúc lượt
            setTimeout(() => { 
                this.toggleSkillScene(false); 
                resolve(); 
            }, this.durationConfig.sceneTransition);
        });
    },

    async triggerMultiEffect(attacker, targetIdx, targetSide, count, effectData, sizeScale, type, damage) {
        const target = document.getElementById(`${targetSide}-unit-${targetIdx}`);
        if (!target) return;

        // 1. Khởi tạo hiệu ứng hệ trước (ví dụ: bão lá, nứt đất bắt đầu diễn ra)
        const methodName = `spawn${type.charAt(0).toUpperCase() + type.slice(1)}`;
        const action = typeof this[methodName] === 'function' ? this[methodName] : this.spawnDefault;

        // Chạy hiệu ứng animation
        const animationPromise = action.call(this, attacker, target, count, sizeScale, effectData);

        // 2. Đợi một khoảng trễ nhỏ (tùy chiêu) hoặc đợi va chạm rồi mới RUNG và hiện SÁT THƯƠNG
        // Ở đây mình đợi khoảng 400ms - 600ms để effect kịp bay tới mục tiêu
        await new Promise(r => setTimeout(r, 500)); 

        // --- ĐƯA RUNG VÀO ĐÂY ĐỂ CẢM GIÁC VA CHẠM LÚC CUỐI ---
        this.applyGlobalShake(sizeScale);
        this.createDamageText(target, damage);

        // 3. Đợi toàn bộ quá trình kết thúc
        await Promise.all([
            animationPromise,
            new Promise(r => setTimeout(r, 1500)) 
        ]);

        // 4. Rung riêng của Pokemon (CSS shake)
        target.classList.add('shake');
        setTimeout(() => target.classList.remove('shake'), this.durationConfig.shake);
    },


    

    // --- CÁC HÀM SPAWN GIỮ NGUYÊN NHƯ FILE CŨ CỦA BẠN ---
    async spawnElectric(startEl, endEl, count, scale) {
        const duration = 2000; 
        const numBolts = Math.max(2, count / 2);
        const interval = duration / numBolts;

        for (let i = 0; i < numBolts; i++) {
            setTimeout(() => {
                const rectS = startEl.getBoundingClientRect();
                const rectE = endEl.getBoundingClientRect();
                let curX = rectS.left + rectS.width / 2, curY = rectS.top + rectS.height / 2;
                const endX = rectE.left + rectE.width / 2, endY = rectE.top + rectE.height / 2;
                const segments = 5;
                for (let j = 1; j <= segments; j++) {
                    const nextX = curX + (endX - curX) * (1 / (segments - j + 1)) + (Math.random() - 0.5) * 40;
                    const nextY = curY + (endY - curY) * (1 / (segments - j + 1)) + (Math.random() - 0.5) * 40;
                    const dx = nextX - curX, dy = nextY - curY, dist = Math.sqrt(dx * dx + dy * dy);
                    const bolt = document.createElement('div');
                    bolt.className = 'pkm-particle particle-electric';
                    bolt.style.cssText = `left:${curX}px; top:${curY}px; width:${dist}px; height:${3 * scale}px; transform:rotate(${Math.atan2(dy, dx)*180/Math.PI}deg); transform-origin:0 50%;`;
                    document.body.appendChild(bolt);
                    setTimeout(() => bolt.remove(), this.durationConfig.electricBolt);
                    curX = nextX; curY = nextY;
                }
            }, i * interval);
        }
    },

    // --- HỆ LỬA (FIRE) CÂN BẰNG THỜI GIAN ---
    async spawnFire(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        // Tính toán delay động để tổng thời gian không quá 2s (dành 0.5s cho nổ cuối)
        const totalAvailableTime = 2000; 
        const interval = count > 1 ? Math.min(200, totalAvailableTime / count) : 0;

        for (let i = 0; i < count; i++) {
            // Không dùng await ở đây để các quả cầu có thể bay gối đầu nhau (nếu Gen cao)
            this.executeSingleFireball(rectS, rectE, scale, i * interval);
        }

        // Chờ đúng 2.5s để đồng bộ với chốt chặn của triggerMultiEffect
        await new Promise(r => setTimeout(r, 2500));
    },

    async executeSingleFireball(rectS, rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const fireball = document.createElement('div');
        fireball.className = 'pkm-particle particle-fire';
        fireball.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width / 2}px;
            top: ${rectS.top + rectS.height / 2}px;
            width: ${22 * scale}px; height: ${22 * scale}px;
            background: radial-gradient(circle, #fff 10%, #ffdf00 40%, #e67e22 80%, #c0392b 100%);
            box-shadow: 0 0 ${15 * scale}px #e67e22, 0 0 ${30 * scale}px #f39c12;
            border-radius: 50%; z-index: 9999; pointer-events: none;
        `;
        document.body.appendChild(fireball);

        const sparkTimer = setInterval(() => {
            const spark = document.createElement('div');
            const fRect = fireball.getBoundingClientRect();
            spark.style.cssText = `
                position: fixed; left: ${fRect.left + fRect.width/2}px; top: ${fRect.top + fRect.height/2}px;
                width: ${6 * scale}px; height: ${6 * scale}px; background: #ff4d00;
                border-radius: 50%; opacity: 0.9; z-index: 9998;
            `;
            document.body.appendChild(spark);
            spark.animate([{opacity:0.9},{transform:`translate(${(Math.random()-0.5)*40}px,40px)`,opacity:0}], 400).onfinish=()=>spark.remove();
        }, 40);

        const targetX = rectE.left + rectE.width/2 + (Math.random()-0.5)*60;
        const targetY = rectE.top + rectE.height/2 + (Math.random()-0.5)*60;

        await fireball.animate([
            { left: fireball.style.left, top: fireball.style.top },
            { left: `${targetX}px`, top: `${targetY}px` }
        ], { duration: 600, easing: 'ease-in' }).finished;

        clearInterval(sparkTimer);
        this.createFireExplosion(targetX, targetY, scale);
        fireball.remove();
        if (this.playRandomSfx) this.playRandomSfx();
    },

    // --- HỆ NƯỚC (WATER) ---
    async spawnWater(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        // Tính toán để tất cả bong bóng phun ra trong vòng 1.5s, 1s còn lại để nước tan
        const totalLaunchTime = 1500;
        const interval = count > 1 ? totalLaunchTime / count : 0;

        for (let i = 0; i < count; i++) {
            this.executeSingleBubble(rectS, rectE, scale, i * interval);
        }

        // Chờ đúng 2.5s như chốt chặn
        await new Promise(r => setTimeout(r, 2500));
    },

    async executeSingleBubble(rectS, rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const bubble = document.createElement('div');
        bubble.className = 'pkm-particle particle-water';

        // Style bong bóng: Trong suốt, có vệt sáng trắng (highlight) tạo độ bóng
        bubble.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width / 2}px;
            top: ${rectS.top + rectS.height / 2}px;
            width: ${18 * scale}px;
            height: ${18 * scale}px;
            background: rgba(52, 152, 219, 0.4);
            border: 1px solid rgba(255, 255, 255, 0.6);
            box-shadow: inset -3px -3px 8px rgba(0,0,0,0.2), inset 3px 3px 8px rgba(255,255,255,0.8);
            border-radius: 50%;
            z-index: 9999;
            pointer-events: none;
        `;
        document.body.appendChild(bubble);

        // Tạo một điểm sáng nhỏ bên trong bong bóng cho đẹp
        const highlight = document.createElement('div');
        highlight.style.cssText = `
            position: absolute; top: 20%; left: 20%; width: 30%; height: 30%;
            background: white; border-radius: 50%; opacity: 0.6;
        `;
        bubble.appendChild(highlight);

        const targetX = rectE.left + rectE.width / 2 + (Math.random() - 0.5) * 50;
        const targetY = rectE.top + rectE.height / 2 + (Math.random() - 0.5) * 50;

        // Quỹ đạo bay cong (Arc) bằng cách dùng CSS Keyframes ẩn hoặc animate trung gian
        const midX = (rectS.left + targetX) / 2;
        const midY = Math.min(rectS.top, targetY) - 100; // Bay vồng lên trên

        await bubble.animate([
            { left: bubble.style.left, top: bubble.style.top, transform: 'scale(1)' },
            { left: `${midX}px`, top: `${midY}px`, transform: 'scale(1.2)' },
            { left: `${targetX}px`, top: `${targetY}px`, transform: 'scale(1)' }
        ], {
            duration: 700,
            easing: 'ease-out'
        }).finished;

        // Khi chạm mục tiêu: Bong bóng vỡ thành các giọt nước nhỏ rơi xuống
        this.createWaterSplash(targetX, targetY, scale);
        bubble.remove();

        if (this.playRandomSfx) this.playRandomSfx();
    },

    // Hiệu ứng nước bắn tung tóe
    createWaterSplash(x, y, scale) {
        for (let i = 0; i < 8; i++) {
            const drop = document.createElement('div');
            const angle = (i / 8) * Math.PI * 2;
            const velocity = (30 + Math.random() * 30) * scale;

            drop.style.cssText = `
                position: fixed; left: ${x}px; top: ${y}px;
                width: ${5 * scale}px; height: ${5 * scale}px;
                background: #3498db; border-radius: 50%; opacity: 0.8; z-index: 10000;
            `;
            document.body.appendChild(drop);

            drop.animate([
                { transform: 'translate(0, 0)', opacity: 0.8 },
                { transform: `translate(${Math.cos(angle) * velocity}px, ${Math.sin(angle) * velocity + 20}px)`, opacity: 0 }
            ], { duration: 400, easing: 'ease-in' }).onfinish = () => drop.remove();
        }
    },

    // --- HỆ BĂNG (ICE) ---
    async spawnIce(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        // Phân bổ thời gian bắn các tinh thể băng trong 1.8s
        const totalLaunchTime = 1800;
        const interval = count > 1 ? totalLaunchTime / count : 0;

        for (let i = 0; i < count; i++) {
            this.executeSingleIceCrystal(rectS, rectE, scale, i * interval);
        }

        // Chốt chặn 2.5s đồng bộ toàn hệ thống
        await new Promise(r => setTimeout(r, 2500));
    },

    async executeSingleIceCrystal(rectS, rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const ice = document.createElement('div');
        ice.className = 'pkm-particle particle-ice';

        // Tạo hình bông tuyết/tinh thể bằng clip-path hoặc dùng ký tự đặc biệt
        // Ở đây dùng CSS để tạo khối kim cương sắc cạnh, màu xanh trắng buốt
        ice.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width / 2}px;
            top: ${rectS.top + rectS.height / 2}px;
            width: ${30 * scale}px;
            height: ${40 * scale}px;
            background: linear-gradient(135deg, #ffffff 0%, #74b9ff 50%, #a29bfe 100%);
            clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
            box-shadow: 0 0 ${10 * scale}px #fff;
            z-index: 9999;
            pointer-events: none;
            opacity: 0.9;
        `;
        document.body.appendChild(ice);

        const targetX = rectE.left + rectE.width / 2 + (Math.random() - 0.5) * 40;
        const targetY = rectE.top + rectE.height / 2 + (Math.random() - 0.5) * 40;

        // Băng bay thẳng và xoay tròn cực nhanh tạo cảm giác sắc lẹm
        await ice.animate([
            { left: ice.style.left, top: ice.style.top, transform: 'rotate(0deg) scale(1)' },
            { left: `${targetX}px`, top: `${targetY}px`, transform: `rotate(${360 * 2}deg) scale(1.2)` }
        ], {
            duration: 500,
            easing: 'ease-in'
        }).finished;

        // Khi chạm mục tiêu: Vỡ vụn thành các mảnh băng nhỏ (Shards)
        this.createIceShards(targetX, targetY, scale);
        ice.remove();

        if (this.playRandomSfx) this.playRandomSfx();
    },

    // Hiệu ứng vỡ vụn của băng
    createIceShards(x, y, scale) {
        for (let i = 0; i < 10; i++) {
            const shard = document.createElement('div');
            const angle = (i / 10) * Math.PI * 2;
            const dist = (30 + Math.random() * 20) * scale;

            shard.style.cssText = `
                position: fixed; left: ${x}px; top: ${y}px;
                width: ${4 * scale}px; height: ${4 * scale}px;
                background: #fff; clip-path: polygon(20% 0%, 100% 40%, 70% 100%, 0% 80%);
                opacity: 0.8; z-index: 10000;
            `;
            document.body.appendChild(shard);

            shard.animate([
                { transform: 'translate(0, 0) rotate(0deg)', opacity: 0.8 },
                { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) rotate(180deg)`, opacity: 0 }
            ], { duration: 400, easing: 'ease-out' }).onfinish = () => shard.remove();
        }
    },

    // --- HỆ ĐỘC (POISON) - PHUN MẢNG ĐỘC ---
    async spawnPoison(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        // Phun toàn bộ mảng độc trong 1.5s để dành thời gian cho hiệu ứng loang nổ
        const totalLaunchTime = 1500;
        const interval = count > 1 ? totalLaunchTime / count : 0;

        for (let i = 0; i < count; i++) {
            this.executeSinglePoisonGunk(rectS, rectE, scale, i * interval);
        }

        await new Promise(r => setTimeout(r, 2500));
    },

    async executeSinglePoisonGunk(rectS, rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const gunk = document.createElement('div');
        gunk.className = 'pkm-particle particle-poison-gunk';

        // Style mảng độc: Hình dạng kéo dài (oblong), màu tím tối, bề mặt như bùn
        gunk.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width / 2}px;
            top: ${rectS.top + rectS.height / 2}px;
            width: ${40 * scale}px; 
            height: ${20 * scale}px;
            background: #4a235a;
            border-radius: 30% 70% 40% 60% / 50%; /* Hình dạng mảng bùn méo mó */
            box-shadow: inset -5px -5px 10px #2e1537, 0 0 ${10 * scale}px #8e44ad;
            z-index: 9999;
            pointer-events: none;
            filter: blur(0.5px);
        `;
        document.body.appendChild(gunk);

        const targetX = rectE.left + rectE.width / 2 + (Math.random() - 0.5) * 40;
        const targetY = rectE.top + rectE.height / 2 + (Math.random() - 0.5) * 40;

        // Quỹ đạo bay zigzag hiểm hóc
        const keyframes = [
            { left: gunk.style.left, top: gunk.style.top, transform: 'rotate(0deg) scaleX(1)' },
            { 
                left: `${(rectS.left + targetX) / 2 + 50}px`, 
                top: `${(rectS.top + targetY) / 2 - 20}px`, 
                transform: 'rotate(15deg) scaleX(1.5)' // Kéo dài ra khi bay
            },
            { 
                left: `${targetX}px`, 
                top: `${targetY}px`, 
                transform: 'rotate(-10deg) scaleX(1.2)' 
            }
        ];

        await gunk.animate(keyframes, {
            duration: 600,
            easing: 'ease-in'
        }).finished;

        // Khi chạm mục tiêu: Loang ra thành vũng độc
        this.createPoisonSplat(targetX, targetY, scale);
        gunk.remove();

        if (this.playRandomSfx) this.playRandomSfx();
    },

    // Hiệu ứng vũng độc loang lổ (Splat)
    createPoisonSplat(x, y, scale) {
        for (let i = 0; i < 5; i++) {
            const splat = document.createElement('div');
            const offX = (Math.random() - 0.5) * 60 * scale;
            const offY = (Math.random() - 0.5) * 60 * scale;
            const size = (20 + Math.random() * 30) * scale;

            splat.style.cssText = `
                position: fixed; 
                left: ${x + offX}px; 
                top: ${y + offY}px;
                width: ${size}px; height: ${size}px;
                background: #8e44ad;
                border-radius: 40% 60% 30% 70%;
                opacity: 0.7;
                filter: blur(5px);
                z-index: 9998;
                pointer-events: none;
            `;
            document.body.appendChild(splat);

            splat.animate([
                { transform: 'scale(0.5)', opacity: 0.7 },
                { transform: 'scale(1.5)', opacity: 0 }
            ], { duration: 800, easing: 'ease-out' }).onfinish = () => splat.remove();
        }
    },

    // --- HỆ ĐÁ (ROCK) - MỌC LÊN TỪ DƯỚI ĐẤT ---
    async spawnRock(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // Phân bổ thời gian mọc đá dồn dập trong 1.8s
        const totalDuration = 1800;
        const interval = count > 1 ? totalDuration / count : 0;

        for (let i = 0; i < count; i++) {
            this.executeSingleRockRise(rectE, scale, i * interval);
        }

        // Chốt chặn 2.5s đồng bộ
        await new Promise(r => setTimeout(r, 2500));
    },

    async executeSingleRockRise(rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const rock = document.createElement('div');
        rock.className = 'pkm-particle particle-rock';

        // Vị trí ngẫu nhiên quanh chân đối thủ
        const offsetX = (Math.random() - 0.5) * 80 * scale;
        const offsetY = (Math.random() - 0.5) * 40 * scale;

        // Style khối đá: Thô ráp, màu xám nâu, hình đa giác sắc cạnh
        rock.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2 + offsetX}px;
            top: ${rectE.top + rectE.height - 20 + offsetY}px;
            width: ${35 * scale}px;
            height: ${35 * scale}px;
            background: #7f8c8d;
            clip-path: polygon(20% 0%, 80% 10%, 100% 50%, 70% 90%, 20% 100%, 0% 50%);
            background-image: linear-gradient(135deg, #95a5a6 0%, #7f8c8d 50%, #2c3e50 100%);
            box-shadow: inset 2px 2px 5px rgba(255,255,255,0.2);
            z-index: 10001;
            pointer-events: none;
            transform: translateY(100px) scale(0); /* Xuất phát từ dưới đất */
        `;
        document.body.appendChild(rock);

        // Hiệu ứng mọc lên (vút lên rồi khựng lại)
        await rock.animate([
            { transform: 'translateY(100px) scale(0) rotate(0deg)', opacity: 0 },
            { transform: 'translateY(-20px) scale(1.2) rotate(15deg)', opacity: 1, offset: 0.7 },
            { transform: 'translateY(0) scale(1) rotate(0deg)', opacity: 1 }
        ], {
            duration: 400,
            easing: 'ease-out'
        }).finished;

        // Rung màn hình nhẹ khi đá mọc lên
        if (this.playRandomSfx) this.playRandomSfx();

        // Sau khi mọc lên, đá sẽ vỡ vụn sau một khoảng ngắn
        setTimeout(() => {
            this.createRockDebris(rectE.left + rectE.width / 2 + offsetX, rectE.top + rectE.height / 2 + offsetY, scale);
            rock.remove();
        }, 300);
    },

    // Hiệu ứng mảnh vỡ và bụi đất
    createRockDebris(x, y, scale) {
        for (let i = 0; i < 8; i++) {
            const debris = document.createElement('div');
            const angle = Math.random() * Math.PI * 2;
            const dist = (40 + Math.random() * 40) * scale;

            debris.style.cssText = `
                position: fixed; left: ${x}px; top: ${y}px;
                width: ${10 * scale}px; height: ${10 * scale}px;
                background: #5d6d7e;
                clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%);
                opacity: 0.8; z-index: 10000;
            `;
            document.body.appendChild(debris);

            debris.animate([
                { transform: 'translate(0, 0) scale(1)', opacity: 1 },
                { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) rotate(180deg)`, opacity: 0 }
            ], { duration: 500, easing: 'ease-out' }).onfinish = () => debris.remove();
        }
    },

    // --- HỆ BAY (FLYING) - CẬP NHẬT MÀU ĐẬM RÕ NÉT ---
    async spawnFlying(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // Thời gian xả chiêu gói gọn trong 1.8s
        const totalDuration = 1800;
        const interval = count > 1 ? totalDuration / count : 0;

        for (let i = 0; i < count; i++) {
            this.executeSingleAirSlash(rectE, scale, i * interval);
        }

        // Chốt chặn 2.5s đồng bộ
        await new Promise(r => setTimeout(r, 2500));
    },

    async executeSingleAirSlash(rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const slash = document.createElement('div');
        slash.className = 'pkm-particle particle-flying';

        // Xuất phát từ trên cao, lệch ngẫu nhiên
        const startTop = -100;
        const startLeft = rectE.left + rectE.width/2 + (Math.random() - 0.5) * 500;

        // STYLE CẬP NHẬT: Màu đậm hơn, rõ nét hơn
        slash.style.cssText = `
            position: fixed;
            left: ${startLeft}px;
            top: ${startTop}px;
            width: ${80 * scale}px; /* Tăng chiều dài một chút */
            height: ${15 * scale}px; /* Tăng độ dày một chút */
            /* Sử dụng màu xanh tím đậm hệ bay */
            background: linear-gradient(to right, transparent, #a890f0 20%, #fff 50%, #a890f0 80%, transparent);
            border-radius: 50%;
            /* Tăng độ sáng của glow */
            box-shadow: 0 0 ${20 * scale}px #a890f0, 0 0 ${10 * scale}px #fff;
            z-index: 10001;
            pointer-events: none;
            /* Tính góc chém hướng về mục tiêu */
            transform: rotate(${this.calcAngleToTarget(startLeft, startTop, rectE.left + rectE.width/2, rectE.top + rectE.height/2)}deg);
            /* Giảm blur để nhìn rõ nét hơn */
            filter: blur(0.5px);
            opacity: 0;
        `;
        document.body.appendChild(slash);

        const targetX = rectE.left + rectE.width / 2 + (Math.random() - 0.5) * 80;
        const targetY = rectE.top + rectE.height / 2 + (Math.random() - 0.5) * 80;

        // Chém xuống cực nhanh (300ms)
        await slash.animate([
            { left: `${startLeft}px`, top: `${startTop}px`, opacity: 0 },
            { opacity: 1, offset: 0.1 }, // Hiện ra nhanh
            { opacity: 1, offset: 0.8 }, // Giữ nguyên độ đậm khi bay
            { left: `${targetX}px`, top: `${targetY}px`, opacity: 0 } // Biến mất khi chạm
        ], {
            duration: 300,
            easing: 'linear' // Bay đều tốc độ
        }).finished;

        this.createWindImpact(targetX, targetY, scale);
        slash.remove();

        if (this.playRandomSfx) this.playRandomSfx();
    },

    // Hiệu ứng va chạm của gió (Cũng làm màu xanh tím cho đồng bộ)
    createWindImpact(x, y, scale) {
        for (let i = 0; i < 4; i++) {
            const wind = document.createElement('div');
            wind.style.cssText = `
                position: fixed; left: ${x}px; top: ${y}px;
                width: ${50 * scale}px; height: ${10 * scale}px;
                border: 3px solid #a890f0;
                border-radius: 50%;
                z-index: 10000;
                pointer-events: none;
                filter: blur(1px);
            `;
            document.body.appendChild(wind);

            wind.animate([
                { transform: 'translate(-50%, -50%) rotate(0deg) scale(0.5)', opacity: 0.8 },
                { transform: `translate(-50%, -50%) rotate(${Math.random() * 360}deg) scale(2)`, opacity: 0 }
            ], { duration: 400, easing: 'ease-out' }).onfinish = () => wind.remove();
        }
    },

    // Hàm helper tính góc xoay để lưỡi gió luôn hướng đầu về mục tiêu
    calcAngleToTarget(x1, y1, x2, y2) {
        return Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
    },

    // --- HỆ TÂM LINH (PSYCHIC) - BIẾN DẠNG KHÔNG GIAN ---
    async spawnPsychic(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // Hệ Tâm Linh thường diễn ra đồng thời hoặc dồn dập
        const totalDuration = 1800;
        const interval = count > 1 ? totalDuration / count : 0;

        for (let i = 0; i < count; i++) {
            this.executeSinglePsychicWave(rectE, scale, i * interval);
        }

        await new Promise(r => setTimeout(r, 2500));
    },

    async executeSinglePsychicWave(rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        // 1. Tạo hiệu ứng Biến dạng không gian (Distortion)
        const distortion = document.createElement('div');
        distortion.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height / 2}px;
            width: ${120 * scale}px;
            height: ${120 * scale}px;
            background: rgba(255, 255, 255, 0.05);
            border-radius: 50%;
            z-index: 9998;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(0);
            /* Hiệu ứng bẻ cong không gian quan trọng nhất ở đây */
            backdrop-filter: blur(5px) hue-rotate(90deg);
            -webkit-backdrop-filter: blur(5px) hue-rotate(90deg);
            border: 2px solid rgba(248, 88, 136, 0.3);
        `;
        document.body.appendChild(distortion);

        // 2. Tạo vòng tròn năng lượng co thắt (Shrinking Ring)
        const ring = document.createElement('div');
        ring.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height / 2}px;
            width: ${200 * scale}px;
            height: ${200 * scale}px;
            border: ${4 * scale}px solid #f85888;
            box-shadow: 0 0 20px #f85888, inset 0 0 20px #f85888;
            border-radius: 50%;
            z-index: 10001;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(1);
            opacity: 0;
        `;
        document.body.appendChild(ring);

        // Chạy hiệu ứng biến dạng (phình ra rồi mất)
        distortion.animate([
            { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.5)', opacity: 1, offset: 0.5 },
            { transform: 'translate(-50%, -50%) scale(2)', opacity: 0 }
        ], { duration: 1000, easing: 'ease-out' }).onfinish = () => distortion.remove();

        // Chạy hiệu ứng vòng tròn co thắt
        await ring.animate([
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(0.8)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%, -50%) scale(0)', opacity: 0 }
        ], {
            duration: 800,
            easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        }).finished;

        ring.remove();
        if (this.playRandomSfx) this.playRandomSfx();
    },

    // --- HỆ THÉP (STEEL) 2.0 - VẠN KIẾM QUY TÔNG ---
    async spawnSteel(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // Phân bổ thời gian rơi dồn dập
        const totalDuration = 1800;
        const interval = count > 1 ? totalDuration / count : 0;

        for (let i = 0; i < count; i++) {
            this.executeSteelHeavyBlade(rectE, scale, i * interval);
        }

        await new Promise(r => setTimeout(r, 2500));
    },

    async executeSteelHeavyBlade(rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const blade = document.createElement('div');
        // Tạo cấu trúc lưỡi kiếm sắc bén hơn
        blade.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2 + (Math.random() - 0.5) * 120 * scale}px;
            top: -250px;
            width: ${12 * scale}px;
            height: ${80 * scale}px;
            background: linear-gradient(90deg, #7f8c8d 0%, #ecf0f1 45%, #ffffff 50%, #ecf0f1 55%, #7f8c8d 100%);
            z-index: 10001;
            pointer-events: none;
            clip-path: polygon(50% 100%, 100% 85%, 100% 0%, 0% 0%, 0% 85%);
            box-shadow: 0 0 ${15 * scale}px rgba(255,255,255,0.8);
            filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.4));
        `;
        document.body.appendChild(blade);

        // Hiệu ứng lóe sáng (Gleam) chạy dọc lưỡi kiếm
        const gleam = document.createElement('div');
        gleam.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 20%;
            background: rgba(255,255,255,0.8); filter: blur(4px);
        `;
        blade.appendChild(gleam);
        gleam.animate([{top: '0%'}, {top: '100%'}], {duration: 300, iterations: Infinity});

        const landY = rectE.top + rectE.height / 2 + (Math.random() - 0.5) * 40;

        // Rơi cực nhanh và cắm phập xuống
        await blade.animate([
            { transform: 'translateY(0) scaleY(1.5)', opacity: 0 },
            { transform: `translateY(${landY + 250}px) scaleY(1)`, opacity: 1 }
        ], {
            duration: 350,
            easing: 'cubic-bezier(0.6, 0.04, 0.98, 0.33)'
        }).finished;

        // Rung màn hình và tóe lửa
        this.createSteelHeavySparks(parseFloat(blade.style.left), landY, scale);

        // Hiệu ứng phản lực (nảy nhẹ khi cắm xuống đất)
        blade.animate([
            { transform: `translateY(${landY + 250}px) scaleY(1)` },
            { transform: `translateY(${landY + 245}px) scaleY(0.95)` },
            { transform: `translateY(${landY + 250}px) scaleY(1)` }
        ], { duration: 100 });

        // Biến mất sau khi cắm lại một lát
        setTimeout(() => {
            blade.animate([{opacity: 1}, {opacity: 0}], {duration: 200}).onfinish = () => blade.remove();
        }, 500);

        if (this.playRandomSfx) this.playRandomSfx();
    },

    createSteelHeavySparks(x, y, scale) {
        for (let i = 0; i < 10; i++) {
            const s = document.createElement('div');
            const angle = Math.random() * Math.PI * 2;
            const dist = (50 + Math.random() * 30) * scale;
            s.style.cssText = `
                position: fixed; left: ${x}px; top: ${y}px;
                width: ${3 * scale}px; height: ${15 * scale}px;
                background: #f1c40f; z-index: 10002;
                transform: rotate(${angle}rad);
            `;
            document.body.appendChild(s);
            s.animate([
                { transform: `rotate(${angle}rad) translateY(0) scaleY(1)`, opacity: 1 },
                { transform: `rotate(${angle}rad) translateY(-${dist}px) scaleY(0)`, opacity: 0 }
            ], { duration: 400, easing: 'ease-out' }).onfinish = () => s.remove();
        }
    },

    // --- HỆ CỎ (GRASS) - TỐI ƯU MOBILE: TO RÕ, MƯỢT MÀ ---
    async spawnGrass(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // Không nhân đôi count nữa để tránh lag trên mobile
        const leafCount = count;
        // Giảm tổng thời gian một chút để hiệu ứng diễn ra dồn dập, dứt khoát
        const totalDuration = 1500; 
        const interval = totalDuration / leafCount;

        for (let i = 0; i < leafCount; i++) {
            this.executeMobileRazorLeaf(rectE, scale, i * interval, i);
        }

        // Chốt chặn 2.5s đồng bộ
        await new Promise(r => setTimeout(r, 2500));
    },

    async executeMobileRazorLeaf(rectE, scale, delay, index) {
        await new Promise(r => setTimeout(r, delay));

        const leaf = document.createElement('div');
        // className giúp bạn dễ dàng debug hoặc thêm CSS style nếu cần
        leaf.className = 'pkm-particle particle-grass-leaf-mobile';

        // KÍCH THƯỚC TO GẤP ĐÔI (ví dụ: 18x10 lên 36x20)
        leaf.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height / 2}px;
            width: ${36 * scale}px; 
            height: ${20 * scale}px;
            background: linear-gradient(135deg, #2ecc71, #27ae60);
            /* Hình dáng chiếc lá nhọn, sắc bén */
            border-radius: 80% 10% 80% 10%;
            border: ${1 * scale}px solid #145a32;
            z-index: 10002;
            pointer-events: none;
            /* Thêm drop-shadow mạnh để nổi bật trên nền battle */
            filter: drop-shadow(0 0 ${4 * scale}px rgba(0,0,0,0.5));
            opacity: 0;
            /* Bỏ transform-style: preserve-3d để tối ưu performance */
        `;
        document.body.appendChild(leaf);

        // Tham số quỹ đạo đơn giản hóa (2D Vortex)
        // Bán kính xoáy rộng hơn để không bị rối mắt
        const radius = (80 + Math.random() * 60) * scale; 
        const angleStart = Math.random() * Math.PI * 2;
        const rotateSpeed = 2 + Math.random() * 1; // Xoay nhanh hơn

        // Hiệu ứng bão lá xoáy tròn đơn giản (Tối ưu GPU)
        await leaf.animate([
            { 
                transform: `rotate(${angleStart}rad) translateX(${radius * 1.5}px) scale(0)`, 
                opacity: 0 
            },
            { opacity: 1, offset: 0.1 },
            { 
                // Xoay 1 vòng, bay vào tâm, không xoay 3D lật mặt
                transform: `rotate(${angleStart + Math.PI * 2 * rotateSpeed}rad) translateX(${radius * 0.5}px) scale(1.1)`, 
                opacity: 1,
                offset: 0.8
            },
            { 
                transform: `rotate(${angleStart + Math.PI * 2.5 * rotateSpeed}rad) translateX(${radius}px) scale(0)`, 
                opacity: 0 
            }
        ], {
            // Giảm duration để lá bay nhanh, dứt khoát, giảm thời gian render
            duration: 800 + Math.random() * 200, 
            easing: 'cubic-bezier(0.25, 0.46, 0.45, 0.94)' // Out-back nhẹ
        }).finished;

        leaf.remove();

        // Chỉ chơi âm thanh cho một số lá để không bị ồn, tiết kiệm CPU
        if (index % 5 === 0 && this.playRandomSfx) this.playRandomSfx();
    },

    // --- HỆ ĐẤT (GROUND) - TẬP TRUNG HIỆU ỨNG VẬT LÝ ---
    async spawnGround(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // 1. Tạo các vết nứt mặt đất (Cracks)
        // Số lượng vết nứt tỷ lệ thuận với Gen
        const crackCount = Math.min(3, Math.ceil(count / 2));
        for (let i = 0; i < crackCount; i++) {
            this.executeGroundCrack(rectE, scale, i * 300);
        }

        // 2. Phun bùn đất (Mud/Dust particles)
        const totalDuration = 1500;
        const interval = totalDuration / count;
        for (let i = 0; i < count; i++) {
            this.executeMudEruption(rectE, scale, i * interval);
        }

        await new Promise(r => setTimeout(r, 2500));
    },

    // Hiệu ứng nứt đất (Tối ưu hóa hiển thị)
    async executeGroundCrack(rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const crack = document.createElement('div');
        const width = (100 + Math.random() * 50) * scale; // Tăng size nhẹ để nhìn rõ hơn

        crack.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height - 5}px;
            width: ${width}px;
            height: ${12 * scale}px;
            background: #4e342e;
            /* Hình dạng nứt vỡ răng cưa */
            clip-path: polygon(0% 50%, 15% 0%, 35% 70%, 50% 20%, 65% 80%, 85% 10%, 100% 50%, 90% 95%, 50% 100%, 10% 90%);
            z-index: 9997;
            pointer-events: none;
            transform: translate(-50%, 0) scaleX(0);
            opacity: 0.9;
        `;
        document.body.appendChild(crack);

        await crack.animate([
            { transform: 'translate(-50%, 0) scaleX(0)', opacity: 0.9 },
            { transform: 'translate(-50%, 0) scaleX(1.1)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%, 0) scaleX(1)', opacity: 0 }
        ], { 
            duration: 1800, 
            easing: 'ease-out' 
        }).finished;

        crack.remove();
    },

    // Hiệu ứng phun bùn đất (Đã bỏ rung lẻ)
    async executeMudEruption(rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const mud = document.createElement('div');
        const size = (30 + Math.random() * 20) * scale; 

        mud.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2 + (Math.random() - 0.5) * 80 * scale}px;
            top: ${rectE.top + rectE.height}px;
            width: ${size}px;
            height: ${size}px;
            background: #6d4c41;
            clip-path: polygon(25% 5%, 75% 0%, 100% 45%, 85% 95%, 20% 100%, 0% 55%);
            box-shadow: inset -5px -5px 12px rgba(0,0,0,0.6);
            z-index: 10002;
            pointer-events: none;
            filter: drop-shadow(2px 3px 5px rgba(0,0,0,0.5));
        `;
        document.body.appendChild(mud);

        const peakY = -(120 + Math.random() * 120) * scale;
        const driftX = (Math.random() - 0.5) * 120 * scale;

        await mud.animate([
            { transform: 'translateY(0) rotate(0deg)', opacity: 1 },
            { transform: `translate(${driftX/2}px, ${peakY}px) rotate(180deg)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${driftX}px, 60px) rotate(360deg)`, opacity: 0 }
        ], {
            duration: 900 + Math.random() * 300,
            easing: 'cubic-bezier(0.22, 0.61, 0.36, 1)' // Hiệu ứng rơi có trọng lực hơn
        }).finished;

        mud.remove();

        // Vẫn giữ âm thanh sfx khi va chạm cho sống động
        if (this.playRandomSfx) this.playRandomSfx();
    },

    // --- HỆ MA (GHOST) 2.0 - LINH HỒN MẶT QUỶ ---
    async spawnGhost(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        const totalDuration = 2200; // Tăng thời gian để ma bay lờ lững
        const interval = totalDuration / count;

        for (let i = 0; i < count; i++) {
            this.executeSpecterApparition(rectE, scale, i * interval, i);
        }

        await new Promise(r => setTimeout(r, 3000));
    },

    async executeSpecterApparition(rectE, scale, delay, index) {
        await new Promise(r => setTimeout(r, delay));

        const specter = document.createElement('div');
        specter.className = 'pkm-particle particle-specter';

        // KÍCH THƯỚC TO, MỜ ẢO để dễ nhìn trên phone
        const size = (80 + Math.random() * 40) * scale;

        specter.style.cssText = `
            position: fixed;
            /* Xuất hiện quanh mục tiêu */
            left: ${rectE.left + rectE.width / 2 + (Math.random() - 0.5) * 150 * scale}px;
            top: ${rectE.top + rectE.height / 2 + (Math.random() - 0.5) * 150 * scale}px;
            width: ${size}px;
            height: ${size}px;
            /* Màu sắc ma mị: Tím, Xanh lam, Trắng mờ */
            background: radial-gradient(circle at 50% 30%, rgba(255, 255, 255, 0.4) 0%, rgba(162, 155, 254, 0.1) 40%, rgba(108, 92, 231, 0.0) 70%);
            border-radius: 50% 50% 10% 10%;
            z-index: 10003;
            pointer-events: none;
            /* BLUR MẠNH để tạo cảm giác không xác thực */
            filter: blur(${5 * scale}px);
            opacity: 0;
            /* XUYÊN THẤU - Hòa trộn ánh sáng qua Pokemon */
            mix-blend-mode: screen; 
            transform-style: preserve-3d;
            box-shadow: 0 0 ${20 * scale}px rgba(162, 155, 254, 0.3);
        `;
        document.body.appendChild(specter);

        // --- TẠO HÌNH MẶT NGƯỜI/ĐẦU LÂU BẰNG KÝ TỰ ĐẶC BIỆT ---
        const face = document.createElement('div');
        face.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            display: flex; justify-content: center; align-items: center;
            font-size: ${size * 0.8}px;
            color: rgba(255, 255, 255, 0.2);
            font-family: monospace; /* Dùng phông monospace để ký tự chuẩn */
            filter: blur(1px); /* Giảm độ nét của ký tự */
        `;
        // Ngẫu nhiên các hình khuôn mặt khác nhau
        const faces = ['👻', '💀', '👽', '👁️‍🗨️', '😈', '🤮'];
        face.innerText = faces[Math.floor(Math.random() * faces.length)];
        specter.appendChild(face);

        // --- HIỆU ỨNG LINH HỒN LƠ LỬNG VÀ TAN BIẾN ---
        // Bay từ dưới lên theo hình vòng cung
        const driftY = -(120 + Math.random() * 120) * scale;
        const driftX = (Math.random() - 0.5) * 100 * scale;

        await specter.animate([
            { transform: 'translateY(100px) rotate(0deg) scale(0.7)', opacity: 0 },
            { opacity: 0.7, offset: 0.1 },
            { 
                transform: `translate(${driftX/2}px, ${driftY/2}px) rotate(${(Math.random()-0.5)*30}deg) scale(1.1)`, 
                opacity: 0.8, 
                offset: 0.6 
            },
            { 
                transform: `translate(${driftX}px, ${driftY}px) rotate(${(Math.random()-0.5)*60}deg) scale(1.5)`, 
                opacity: 0 
            }
        ], {
            // Thời gian bay chậm rãi, ma quái
            duration: 1800 + Math.random() * 800,
            easing: 'cubic-bezier(0.1, 0.8, 0.2, 1)' // Vào nhanh, xoáy đều, tan biến chậm
        }).finished;

        specter.remove();

        // Chỉ chơi âm thanh cho một số linh hồn để tránh ồn
        if (index % 3 === 0 && this.playRandomSfx) this.playRandomSfx();
    },

    // --- HỆ CHIẾN ĐẤU (FIGHTING) - CÚ ĐẤM NGÀN CÂN ---
    async spawnFighting(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // Với hệ Chiến đấu, ta ưu tiên các cú đánh dồn dập
        const totalDuration = 1500;
        const interval = totalDuration / count;

        for (let i = 0; i < count; i++) {
            this.executeFightingImpact(rectE, scale, i * interval);
        }

        await new Promise(r => setTimeout(r, 2000));
    },

    async executeFightingImpact(rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const impactContainer = document.createElement('div');
        const size = (100 + Math.random() * 50) * scale;

        impactContainer.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height / 2}px;
            width: ${size}px;
            height: ${size}px;
            transform: translate(-50%, -50%);
            z-index: 10005;
            pointer-events: none;
            display: flex;
            justify-content: center;
            align-items: center;
        `;
        document.body.appendChild(impactContainer);

        // 1. Tạo biểu tượng Nắm đấm hoặc Dấu chân (Emoji)
        const punch = document.createElement('div');
        punch.style.cssText = `
            font-size: ${size}px;
            filter: drop-shadow(0 0 10px rgba(231, 76, 60, 0.8));
            opacity: 0;
            transform: scale(2);
        `;
        const icons = ['👊', '🥊', '🦶', '💥'];
        punch.innerText = icons[Math.floor(Math.random() * icons.length)];
        impactContainer.appendChild(punch);

        // 2. Tạo hiệu ứng tia lửa va chạm (Shockwave)
        const ring = document.createElement('div');
        ring.style.cssText = `
            position: absolute;
            width: 100%;
            height: 100%;
            border: ${5 * scale}px solid #e74c3c;
            border-radius: 50%;
            opacity: 0;
        `;
        impactContainer.appendChild(ring);

        // --- ANIMATION TẤN CÔNG CHỚP NHOÁNG ---
        // Nắm đấm đập mạnh từ ngoài vào
        punch.animate([
            { transform: 'scale(3) rotate(-20deg)', opacity: 0 },
            { transform: 'scale(1) rotate(0deg)', opacity: 1, offset: 0.1 },
            { transform: 'scale(0.8) rotate(10deg)', opacity: 0, offset: 0.9 }
        ], {
            duration: 400,
            easing: 'cubic-bezier(0.175, 0.885, 0.32, 1.275)'
        });

        // Vòng tròn sóng xung kích tỏa ra
        ring.animate([
            { transform: 'scale(0.5)', opacity: 1, borderWeight: `${10 * scale}px` },
            { transform: 'scale(1.5)', opacity: 0, borderWeight: '1px' }
        ], {
            duration: 400,
            easing: 'ease-out'
        }).finished.then(() => impactContainer.remove());

        // Chơi âm thanh va chạm mạnh
        if (this.playRandomSfx) this.playRandomSfx();
    },
    // --- HỆ RỒNG (DRAGON) - LONG THẦN NỘ KÍCH ---
    async spawnDragon(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        // 1. Tạo luồng năng lượng chính (Dragon Beam)
        const beam = document.createElement('div');
        beam.className = 'dragon-beam';

        // Tính toán khoảng cách và góc quay để nối từ Pokemon này sang Pokemon kia
        const deltaX = rectE.left + rectE.width / 2 - (rectS.left + rectS.width / 2);
        const deltaY = rectE.top + rectE.height / 2 - (rectS.top + rectS.height / 2);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

        beam.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width / 2}px;
            top: ${rectS.top + rectS.height / 2}px;
            width: 0px; /* Bắt đầu từ 0 để tạo hiệu ứng bắn ra */
            height: ${40 * scale}px;
            background: linear-gradient(to bottom, #7038f8, #ffffff 50%, #7038f8);
            box-shadow: 0 0 ${30 * scale}px #7038f8, 0 0 ${60 * scale}px rgba(112, 56, 248, 0.5);
            z-index: 10004;
            pointer-events: none;
            transform-origin: 0 50%;
            transform: rotate(${angle}deg);
            border-radius: ${20 * scale}px;
            filter: blur(1px);
            opacity: 0.9;
        `;
        document.body.appendChild(beam);

        // 2. Hiệu ứng vận công (Charge Aura) tại đầu tia laser
        const aura = document.createElement('div');
        aura.style.cssText = `
            position: absolute; left: -20px; top: 50%;
            width: ${80 * scale}px; height: ${80 * scale}px;
            background: radial-gradient(circle, #fff 0%, #7038f8 70%, transparent 100%);
            transform: translate(-50%, -50%);
            border-radius: 50%;
            filter: blur(10px);
        `;
        beam.appendChild(aura);

        // 3. Thực hiện bắn tia laser
        await beam.animate([
            { width: '0px', opacity: 0 },
            { width: `${distance}px`, opacity: 1, offset: 0.1 },
            { width: `${distance}px`, opacity: 1, offset: 0.8 },
            { width: `${distance}px`, opacity: 0 }
        ], {
            duration: 1200,
            easing: 'ease-out'
        }).finished;

        // 4. Các mảnh vỡ năng lượng bắn ra tại điểm va chạm
        for (let i = 0; i < 15; i++) {
            this.executeDragonParticle(rectE, scale);
        }

        beam.remove();
        await new Promise(r => setTimeout(r, 1000));
    },

    async executeDragonParticle(rectE, scale) {
        const p = document.createElement('div');
        const size = (10 + Math.random() * 15) * scale;
        p.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height / 2}px;
            width: ${size}px;
            height: ${size}px;
            background: #7038f8;
            clip-path: polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%); /* Hình kim cương */
            z-index: 10005;
            pointer-events: none;
            box-shadow: 0 0 10px #7038f8;
        `;
        document.body.appendChild(p);

        const angle = Math.random() * Math.PI * 2;
        const dist = (50 + Math.random() * 100) * scale;

        await p.animate([
            { transform: 'translate(0, 0) rotate(0deg) scale(1)', opacity: 1 },
            { transform: `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) rotate(360deg) scale(0)`, opacity: 0 }
        ], {
            duration: 800,
            easing: 'ease-out'
        }).finished;
        p.remove();
    },

    // --- HỆ TIÊN (FAIRY) - VŨ ĐIỆU ÁNH TRĂNG ---
    async spawnFairy(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        // Số lượng hạt lấp lánh tỷ lệ theo Gen
        const totalParticles = count * 3; 
        const duration = 1800;
        const interval = duration / totalParticles;

        for (let i = 0; i < totalParticles; i++) {
            this.executeFairyMagic(rectS, rectE, scale, i * interval);
        }

        await new Promise(r => setTimeout(r, 2500));
    },

    async executeFairyMagic(rectS, rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const magic = document.createElement('div');
        const size = (20 + Math.random() * 25) * scale;

        // Ngẫu nhiên giữa Trái tim, Sao và Hạt lấp lánh
        const types = ['✨', '💖', '⭐', '🌸'];
        const type = types[Math.floor(Math.random() * types.length)];

        magic.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width / 2}px;
            top: ${rectS.top + rectS.height / 2}px;
            font-size: ${size}px;
            z-index: 10005;
            pointer-events: none;
            filter: drop-shadow(0 0 ${5 * scale}px #ee99ac);
            opacity: 0;
            user-select: none;
        `;
        magic.innerText = type;
        document.body.appendChild(magic);

        // Quỹ đạo bay vòng cung (Bezier)
        const destX = (rectE.left + rectE.width / 2 - (rectS.left + rectS.width / 2)) + (Math.random() - 0.5) * 60 * scale;
        const destY = (rectE.top + rectE.height / 2 - (rectS.top + rectS.height / 2)) + (Math.random() - 0.5) * 60 * scale;

        // Điểm uốn của vòng cung (tạo độ lượn)
        const midX = destX / 2 + (Math.random() - 0.5) * 200 * scale;
        const midY = destY / 2 - (100 + Math.random() * 150) * scale;

        await magic.animate([
            { transform: 'translate(0, 0) scale(0.5) rotate(0deg)', opacity: 0 },
            { transform: `translate(${midX}px, ${midY}px) scale(1.2) rotate(180deg)`, opacity: 1, offset: 0.5 },
            { transform: `translate(${destX}px, ${destY}px) scale(0.8) rotate(360deg)`, opacity: 0.8, offset: 0.9 },
            { transform: `translate(${destX}px, ${destY}px) scale(1.5) rotate(360deg)`, opacity: 0 }
        ], {
            duration: 1000 + Math.random() * 500,
            easing: 'ease-in-out'
        }).finished;

        magic.remove();

        // Thỉnh thoảng phát tiếng chuông nhẹ (sfx) nếu muốn
        if (Math.random() > 0.8 && this.playRandomSfx) this.playRandomSfx();
    },

    // --- HỆ BÓNG TỐI (DARK) - VỰC THẲM HẮC ÁM ---
    async spawnDark(startEl, endEl, count, scale, data) {
        const rectE = endEl.getBoundingClientRect();

        // 1. Tạo vòng xoáy hắc ám dưới chân (Dark Vortex)
        this.executeDarkVortex(rectE, scale);

        // 2. Các lưỡi dao bóng tối chém dồn dập
        const totalDuration = 1500;
        const interval = totalDuration / count;

        for (let i = 0; i < count; i++) {
            this.executeDarkSlash(rectE, scale, i * interval);
        }

        await new Promise(r => setTimeout(r, 2500));
    },

    // Hiệu ứng vòng xoáy bóng tối
    async executeDarkVortex(rectE, scale) {
        const vortex = document.createElement('div');
        const size = 150 * scale;

        vortex.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height / 2}px;
            width: ${size}px;
            height: ${size}px;
            background: radial-gradient(circle, rgba(45, 0, 78, 0.8) 0%, rgba(0, 0, 0, 0.9) 50%, transparent 70%);
            border: ${2 * scale}px dashed #705848;
            border-radius: 50%;
            z-index: 10001;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(0) rotate(0deg);
            filter: blur(${5 * scale}px);
            opacity: 0;
        `;
        document.body.appendChild(vortex);

        await vortex.animate([
            { transform: 'translate(-50%, -50%) scale(0) rotate(0deg)', opacity: 0 },
            { transform: 'translate(-50%, -50%) scale(1.2) rotate(180deg)', opacity: 1, offset: 0.2 },
            { transform: 'translate(-50%, -50%) scale(1) rotate(360deg)', opacity: 0.8, offset: 0.8 },
            { transform: 'translate(-50%, -50%) scale(1.5) rotate(540deg)', opacity: 0 }
        ], {
            duration: 2000,
            easing: 'ease-out'
        }).finished;

        vortex.remove();
    },

    // Hiệu ứng lưỡi dao bóng tối chém xuyên qua
    async executeDarkSlash(rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const slash = document.createElement('div');
        const width = (120 + Math.random() * 60) * scale;
        const height = (15 + Math.random() * 10) * scale;

        const angle = Math.random() * 360;

        slash.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height / 2}px;
            width: ${width}px;
            height: ${height}px;
            background: linear-gradient(90deg, transparent, #2d004e, #000, #705848, transparent);
            z-index: 10005;
            pointer-events: none;
            transform: translate(-50%, -50%) rotate(${angle}deg) scaleX(0);
            clip-path: polygon(10% 0%, 100% 50%, 10% 100%, 0% 50%);
            filter: drop-shadow(0 0 8px #705848);
            opacity: 0.9;
        `;
        document.body.appendChild(slash);

        await slash.animate([
            { transform: `translate(-50%, -50%) rotate(${angle}deg) scaleX(0)`, opacity: 0 },
            { transform: `translate(-50%, -50%) rotate(${angle}deg) scaleX(1.5)`, opacity: 1, offset: 0.2 },
            { transform: `translate(-50%, -50%) rotate(${angle}deg) scaleX(2)`, opacity: 0 }
        ], {
            duration: 400,
            easing: 'ease-in'
        }).finished;

        slash.remove();
        if (this.playRandomSfx) this.playRandomSfx();
    },

    // --- HỆ THƯỜNG (NORMAL) - SÓNG ÂM DỒN DẬP ---
    async spawnNormal(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        // Số lượng vòng sóng âm bay đi
        const totalWaves = Math.max(count, 3);
        const duration = 1500;
        const interval = duration / totalWaves;

        for (let i = 0; i < totalWaves; i++) {
            this.executeSonicWave(rectS, rectE, scale, i * interval);
        }

        await new Promise(r => setTimeout(r, 2000));
    },

    async executeSonicWave(rectS, rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));

        const wave = document.createElement('div');
        // Kích thước vòng sóng ban đầu nhỏ
        const size = 40 * scale;

        // Tính toán góc bay
        const deltaX = (rectE.left + rectE.width / 2) - (rectS.left + rectS.width / 2);
        const deltaY = (rectE.top + rectE.height / 2) - (rectS.top + rectS.height / 2);

        wave.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width / 2}px;
            top: ${rectS.top + rectS.height / 2}px;
            width: ${size}px;
            height: ${size}px;
            border: ${3 * scale}px solid rgba(255, 255, 255, 0.6);
            border-radius: 50%;
            z-index: 10004;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(1);
            /* Hiệu ứng bóng mờ tạo cảm giác rung động */
            box-shadow: 0 0 ${10 * scale}px rgba(255, 255, 255, 0.4);
            filter: blur(1px);
        `;
        document.body.appendChild(wave);

        // Hiệu ứng bay: Vừa bay vừa to dần ra (như loa phóng thanh)
        await wave.animate([
            { 
                transform: 'translate(-50%, -50%) scale(1)', 
                opacity: 0.8 
            },
            { 
                transform: `translate(calc(-50% + ${deltaX}px), calc(-50% + ${deltaY}px)) scale(${3 * scale})`, 
                opacity: 0 
            }
        ], {
            duration: 800,
            easing: 'ease-out'
        }).finished;

        wave.remove();

        // Phát âm thanh va chạm cho mỗi vòng sóng chạm đích
        if (this.playRandomSfx) this.playRandomSfx();
    },

    // --- HỆ CÔN TRÙNG (BUG) FINAL - DỆT KÉN CUỐN CHIẾU ---
    async spawnBug(startEl, endEl, count, scale, data) {
        const rectS = startEl.getBoundingClientRect();
        const rectE = endEl.getBoundingClientRect();

        const fixedStrandCount = 7;
        const interval = 120; // Khoảng cách giữa mỗi lần phun tơ

        // 1. Phun sợi đầu tiên
        this.executeStringShot(rectS, rectE, scale, 0);

        // 2. KÉN BẮT ĐẦU XUẤT HIỆN NGAY KHI SỢI 1 CHẠM ĐÍCH (khoảng 300ms sau)
        // Chúng ta không dùng 'await' ở đây để kén nở song song với việc phun các sợi còn lại
        setTimeout(() => {
            this.executeCentricWebGrowth(rectE, scale);
        }, 300);

        // 3. Tiếp tục phun các sợi còn lại (từ sợi thứ 2 đến 7)
        for (let i = 1; i < fixedStrandCount; i++) {
            this.executeStringShot(rectS, rectE, scale, i * interval);
        }

        // Đợi toàn bộ quá trình dệt kén hoàn tất
        await new Promise(r => setTimeout(r, 2500));
    },

    // Hàm bắn tơ trực tiếp
    async executeStringShot(rectS, rectE, scale, delay) {
        await new Promise(r => setTimeout(r, delay));
        const strand = document.createElement('div');
        const deltaX = rectE.left + rectE.width / 2 - (rectS.left + rectS.width / 2);
        const deltaY = rectE.top + rectE.height / 2 - (rectS.top + rectS.height / 2);
        const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const angle = Math.atan2(deltaY, deltaX) * 180 / Math.PI;

        strand.style.cssText = `
            position: fixed;
            left: ${rectS.left + rectS.width / 2}px;
            top: ${rectS.top + rectS.height / 2}px;
            width: 0px; height: ${1.5 * scale}px;
            background: rgba(255, 255, 255, 0.9);
            box-shadow: 0 0 5px white;
            z-index: 10003;
            transform-origin: 0 50%;
            transform: rotate(${angle + (Math.random()-0.5)*10}deg);
            pointer-events: none;
        `;
        document.body.appendChild(strand);

        await strand.animate([
            { width: '0px', opacity: 1 },
            { width: `${distance}px`, opacity: 1, offset: 0.2 },
            { width: `${distance}px`, opacity: 0 }
        ], { duration: 600, easing: 'ease-out' }).finished;
        strand.remove();
    },

    // HIỆU ỨNG KÉN NỞ DẦN (LAN TỎA TỪ TÂM)
    async executeCentricWebGrowth(rectE, scale) {
        const cocoon = document.createElement('div');
        const fWidth = rectE.width * 1.25;
        const fHeight = rectE.height * 1.5;

        cocoon.style.cssText = `
            position: fixed;
            left: ${rectE.left + rectE.width / 2}px;
            top: ${rectE.top + rectE.height / 2}px;
            width: ${fWidth}px;
            height: ${fHeight}px;
            border-radius: 50%;
            background: radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(200,200,200,0.4) 80%, transparent 100%);
            z-index: 10005;
            pointer-events: none;
            transform: translate(-50%, -50%) scale(0);
            opacity: 0;
            filter: blur(5px);
        `;
        document.body.appendChild(cocoon);

        // Kén nở dần dần, chậm rãi lan ra trong khi tơ vẫn đang bắn vào
        await cocoon.animate([
            { transform: 'translate(-50%, -50%) scale(0)', opacity: 0, filter: 'blur(8px)' },
            { transform: 'translate(-50%, -50%) scale(0.5)', opacity: 0.6, filter: 'blur(4px)', offset: 0.3 },
            { transform: 'translate(-50%, -50%) scale(1)', opacity: 1, filter: 'blur(1px)', offset: 0.7 },
            { transform: 'translate(-50%, -50%) scale(1.1)', opacity: 0, filter: 'blur(10px)' }
        ], {
            duration: 2200, // Thời gian nở dài hơn để thấy rõ quá trình lan tỏa
            easing: 'ease-out'
        }).finished;

        cocoon.remove();
    },





    

    async spawnDefault(startEl, endEl, count, scale, data) {
        for (let i = 0; i < count; i++) {
            this.createProjectile(startEl, endEl, data.color, i, scale);
            await new Promise(r => setTimeout(r, this.durationConfig.delayBetween));
        }
    },

    createProjectile(startEl, endEl, color, offset, sizeScale) {
        const rectS = startEl.getBoundingClientRect(), rectE = endEl.getBoundingClientRect();
        const p = document.createElement('div');
        p.className = 'skill-projectile';
        p.style.cssText = `position:fixed; left:${rectS.left + rectS.width / 2}px; top:${rectS.top + rectS.height / 2}px; width:${8*sizeScale}px; height:${25*sizeScale}px; background:${color}; box-shadow:0 0 10px ${color}; border-radius:50%; z-index:9999; transform:rotate(${this.calcAngle(rectS, rectE)}deg); transition:all ${this.durationConfig.projectileFly}ms ease-in;`;
        document.body.appendChild(p);
        requestAnimationFrame(() => { p.style.left = (rectE.left + rectE.width/2) + 'px'; p.style.top = (rectE.top + rectE.height/2) + 'px'; });
        setTimeout(() => p.remove(), this.durationConfig.projectileFly);
    },

    showStatusText(targetEl, text, color) {
        const rect = targetEl.getBoundingClientRect();
        const div = document.createElement('div');
        div.innerText = text;
        div.style.cssText = `position:fixed; left:${rect.left + rect.width/2}px; top:${rect.top}px; color:${color}; font-weight:900; font-size:24px; text-shadow:2px 2px 0px #000; z-index:10000; pointer-events:none; animation:damageFloat ${this.durationConfig.statusText}ms ease-out forwards; transform:translateX(-50%);`;
        document.body.appendChild(div);
        setTimeout(() => div.remove(), this.durationConfig.statusText);
    },

    createDamageText(targetEl, damage) { this.showStatusText(targetEl, `-${damage}`, '#ff4757'); },
    calcAngle(s, e) { return Math.atan2(e.top - s.top, e.left - s.left) * 180 / Math.PI + 90; },
    toggleSkillScene(isActive, side, index) {
        document.body.classList.toggle('skill-mode', isActive);
        document.querySelectorAll('.pkm-unit').forEach(unit => {
            const isActiveUnit = unit.id === `${side}-unit-${index}` || unit.id.includes(side === 'player' ? 'enemy' : 'player');
            unit.style.opacity = isActive && !isActiveUnit ? '0.1' : '1';
        });
    }
};
