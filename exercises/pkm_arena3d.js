/**
 * =============================================
 * PKM ARENA 3D — Sân đấu perspective 3D
 * Inject SVG vòng ellipse + spotlight + particles
 * Random màu 1 lần mỗi ván, giữ nguyên suốt trận
 * =============================================
 * CÁCH DÙNG: thêm <script src="pkm_arena3d.js"></script>
 * vào pkm_battle.html, TRƯỚC pkm_battle.js
 * =============================================
 */

window.ArenaBuilder = (function () {

    // ── 6 BỘ MÀU CHỦ ĐỀ: mỗi ván random 1 bộ ──
    const THEMES = [
        { // Xanh navy đêm (mặc định giống ảnh)
            bg1: '#07122e', bg2: '#0d1b3e',
            ring1: 'rgba(30,80,180,0.55)', ring2: 'rgba(20,60,150,0.35)', ring3: 'rgba(10,40,110,0.20)',
            spotlight: '#3a7bd5', stage: '#5b9bff',
            particle: '#6ab0ff', floorTile: 'rgba(40,100,220,0.08)'
        },
        { // Tím huyền bí
            bg1: '#130a2e', bg2: '#1e0f3e',
            ring1: 'rgba(100,30,180,0.55)', ring2: 'rgba(80,20,150,0.35)', ring3: 'rgba(60,10,120,0.20)',
            spotlight: '#8e44ad', stage: '#c39bff',
            particle: '#d7baff', floorTile: 'rgba(120,40,200,0.08)'
        },
        { // Đỏ lửa
            bg1: '#2a0a08', bg2: '#3d1008',
            ring1: 'rgba(180,30,20,0.55)', ring2: 'rgba(150,20,10,0.35)', ring3: 'rgba(120,10,5,0.20)',
            spotlight: '#e74c3c', stage: '#ff7675',
            particle: '#ffb3b0', floorTile: 'rgba(200,40,30,0.08)'
        },
        { // Xanh lá rừng tối
            bg1: '#031a0a', bg2: '#072212',
            ring1: 'rgba(20,130,50,0.55)', ring2: 'rgba(15,100,35,0.35)', ring3: 'rgba(10,70,25,0.20)',
            spotlight: '#27ae60', stage: '#55efc4',
            particle: '#a8ffcc', floorTile: 'rgba(30,150,60,0.08)'
        },
        { // Vàng hoàng kim
            bg1: '#1a1200', bg2: '#251a00',
            ring1: 'rgba(180,140,10,0.55)', ring2: 'rgba(150,110,5,0.35)', ring3: 'rgba(120,80,0,0.20)',
            spotlight: '#f39c12', stage: '#ffcb05',
            particle: '#ffe97a', floorTile: 'rgba(200,160,10,0.08)'
        },
        { // Đen tuyền & trắng
            bg1: '#0a0a0a', bg2: '#141414',
            ring1: 'rgba(180,180,180,0.45)', ring2: 'rgba(140,140,140,0.28)', ring3: 'rgba(100,100,100,0.15)',
            spotlight: '#ecf0f1', stage: '#ffffff',
            particle: '#cccccc', floorTile: 'rgba(200,200,200,0.06)'
        }
    ];

    // ── Lấy theme đã chọn hoặc random mới ──
    function getTheme() {
        const stored = sessionStorage.getItem('pkm_arena_theme');
        if (stored) return JSON.parse(stored);
        const t = THEMES[Math.floor(Math.random() * THEMES.length)];
        sessionStorage.setItem('pkm_arena_theme', JSON.stringify(t));
        return t;
    }

    // ── Build SVG nền sân đấu ──
    function buildArenaSVG(t) {
        // Tất cả tọa độ tính theo % → dùng viewBox 100x60 cho dễ
        // Arena chiếm toàn bộ chiều rộng, perspective từ dưới lên
        return `
        <svg id="arena-svg-bg" xmlns="http://www.w3.org/2000/svg"
             viewBox="0 0 100 60" preserveAspectRatio="xMidYMax meet"
             style="position:absolute;bottom:0;left:0;width:100%;height:100%;z-index:0;pointer-events:none;">
            <defs>
                <!-- Spotlight gradient ở giữa sân -->
                <radialGradient id="arenaSpot" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stop-color="${t.spotlight}" stop-opacity="0.18"/>
                    <stop offset="100%" stop-color="${t.spotlight}" stop-opacity="0"/>
                </radialGradient>
                <!-- Spotlight chính giữa (stage) -->
                <radialGradient id="arenaStage" cx="50%" cy="50%" r="50%">
                    <stop offset="0%"   stop-color="${t.stage}" stop-opacity="0.28"/>
                    <stop offset="60%"  stop-color="${t.stage}" stop-opacity="0.10"/>
                    <stop offset="100%" stop-color="${t.stage}" stop-opacity="0"/>
                </radialGradient>
                <!-- Nền tổng thể -->
                <radialGradient id="arenaBg" cx="50%" cy="70%" r="70%">
                    <stop offset="0%"   stop-color="${t.bg2}"/>
                    <stop offset="100%" stop-color="${t.bg1}"/>
                </radialGradient>
                <!-- Sàn ô vuông mờ (floor tile) -->
                <pattern id="floorGrid" x="0" y="0" width="8" height="8" patternUnits="userSpaceOnUse">
                    <rect width="8" height="8" fill="none" stroke="${t.floorTile}" stroke-width="0.3"/>
                </pattern>
            </defs>

            <!-- 1. NỀN TỔNG THỂ -->
            <rect width="100" height="60" fill="url(#arenaBg)"/>

            <!-- 2. SÀN Ô VUÔNG MỜ: chỉ phần dưới -->
            <rect x="0" y="30" width="100" height="30" fill="url(#floorGrid)" opacity="0.6"/>

            <!-- 3. VÒNG ELLIPSE LỚN NHẤT (hàng trên cùng - xa nhất) -->
            <ellipse cx="50" cy="22" rx="42" ry="8"
                     fill="none" stroke="${t.ring1}" stroke-width="0.5" opacity="0.7"/>
            <!-- vạch phản chiếu nội -->
            <ellipse cx="50" cy="22" rx="38" ry="6.5"
                     fill="none" stroke="${t.ring1}" stroke-width="0.25" opacity="0.4"/>

            <!-- 4. VÒNG ELLIPSE GIỮA (hàng giữa) -->
            <ellipse cx="50" cy="35" rx="46" ry="10"
                     fill="none" stroke="${t.ring2}" stroke-width="0.6" opacity="0.75"/>
            <ellipse cx="50" cy="35" rx="41" ry="8.5"
                     fill="none" stroke="${t.ring2}" stroke-width="0.25" opacity="0.35"/>

            <!-- 5. VÒNG ELLIPSE DƯỚI CÙNG (hàng quân ta - gần nhất) -->
            <ellipse cx="50" cy="50" rx="48" ry="9"
                     fill="none" stroke="${t.ring3}" stroke-width="0.7" opacity="0.8"/>
            <ellipse cx="50" cy="50" rx="43" ry="7"
                     fill="none" stroke="${t.ring3}" stroke-width="0.3" opacity="0.4"/>

            <!-- 6. ĐƯỜNG KẺ NGANG nối 2 vòng (tạo cảm giác sân 3D) -->
            <line x1="8"  y1="22" x2="8"  y2="50" stroke="${t.ring3}" stroke-width="0.25" opacity="0.3"/>
            <line x1="92" y1="22" x2="92" y2="50" stroke="${t.ring3}" stroke-width="0.25" opacity="0.3"/>
            <line x1="20" y1="17" x2="12" y2="50" stroke="${t.ring3}" stroke-width="0.2"  opacity="0.2"/>
            <line x1="80" y1="17" x2="88" y2="50" stroke="${t.ring3}" stroke-width="0.2"  opacity="0.2"/>
            <line x1="35" y1="14" x2="25" y2="50" stroke="${t.ring3}" stroke-width="0.2"  opacity="0.15"/>
            <line x1="65" y1="14" x2="75" y2="50" stroke="${t.ring3}" stroke-width="0.2"  opacity="0.15"/>

            <!-- 7. SPOTLIGHT TỔNG (vùng sáng lớn giữa sân) -->
            <ellipse cx="50" cy="38" rx="40" ry="22" fill="url(#arenaSpot)" opacity="0.9"/>

            <!-- 8. STAGE (điểm nổi trội chính giữa - pokemon sẽ di chuyển vào đây khi skill) -->
            <ellipse cx="50" cy="36" rx="14" ry="5" fill="url(#arenaStage)" opacity="1"/>
            <!-- vòng tròn stage nổi bật -->
            <ellipse cx="50" cy="36" rx="10" ry="3.5"
                     fill="none" stroke="${t.stage}" stroke-width="0.5" opacity="0.8"/>
            <ellipse cx="50" cy="36" rx="13" ry="4.8"
                     fill="none" stroke="${t.stage}" stroke-width="0.25" opacity="0.4"/>

            <!-- 9. ĐIỂM SÁNG TÂM STAGE -->
            <circle cx="50" cy="36" r="1.5"
                    fill="${t.stage}" opacity="0.9">
                <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite"/>
                <animate attributeName="r"       values="1.2;1.8;1.2" dur="2s" repeatCount="indefinite"/>
            </circle>

            <!-- 10. TIA SÁNG TỎA RA TỪ TÂM STAGE (8 tia) -->
            ${[0,45,90,135,180,225,270,315].map(deg => {
                const rad = deg * Math.PI / 180;
                const x2 = 50 + Math.cos(rad) * 18;
                const y2 = 36 + Math.sin(rad) * 6.5;
                return `<line x1="50" y1="36" x2="${x2.toFixed(1)}" y2="${y2.toFixed(1)}"
                              stroke="${t.stage}" stroke-width="0.2" opacity="0.25">
                    <animate attributeName="opacity" values="0.1;0.35;0.1"
                             dur="${(2 + deg/90).toFixed(1)}s" repeatCount="indefinite"/>
                </line>`;
            }).join('')}
        </svg>`;
    }

    // ── Thêm vòng sáng dưới chân Pokemon khi đứng trên ellipse ──
    function buildSpotlight(t) {
        const el = document.createElement('div');
        el.id = 'arena-spotlight';
        el.style.cssText = `
            position:absolute; left:50%; top:46%;
            transform:translate(-50%,-50%);
            width:100px; height:100px; border-radius:50%;
            background: radial-gradient(circle, ${t.spotlight}33 0%, ${t.spotlight}00 70%);
            box-shadow: 0 0 40px 10px ${t.spotlight}22;
            z-index:5; pointer-events:none;
        `;
        return el;
    }

    // ── Particles nhỏ bay lên từ sàn ──
    function spawnParticles(arena, t) {
        const COUNT = 12;
        for (let i = 0; i < COUNT; i++) {
            const p = document.createElement('div');
            const size = 2 + Math.random() * 3;
            const left = 10 + Math.random() * 80;
            const bottom = 5 + Math.random() * 50;
            const dur = 3 + Math.random() * 4;
            const delay = Math.random() * 5;
            p.className = 'arena-particle';
            p.style.cssText = `
                width:${size}px; height:${size}px;
                left:${left}%; bottom:${bottom}%;
                background:${t.particle};
                animation-duration:${dur}s;
                animation-delay:${delay}s;
                box-shadow: 0 0 ${size * 2}px ${t.particle};
            `;
            arena.appendChild(p);
        }
    }

    // ── MAIN: gọi khi DOM ready ──
    function build() {
        const arena = document.getElementById('battle-arena');
        if (!arena) return;

        const t = getTheme();

        // 1. Set màu nền body/arena theo theme
        arena.style.background = `linear-gradient(180deg, ${t.bg1} 0%, ${t.bg2} 100%)`;
        document.body.style.background = t.bg1;

        // 2. Inject SVG sân đấu
        arena.insertAdjacentHTML('afterbegin', buildArenaSVG(t));

        // 3. Spotlight div
        arena.insertBefore(buildSpotlight(t), arena.firstChild.nextSibling);

        // 4. Particles
        spawnParticles(arena, t);

        // Expose theme màu cho các module khác dùng
        window.ArenaTheme = t;
    }

    // Tự chạy sau khi DOM load
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', build);
    } else {
        build();
    }

    return { build, getTheme };
})();
