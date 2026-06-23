<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Pokemon Unified Laboratory</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: #05050f;
            color: #fff;
            height: 100vh;
            overflow: hidden;
            display: flex;
        }

        /* ── SIDEBAR ── */
        .control-panel {
            width: 340px;
            min-width: 340px;
            background: rgba(10,10,25,0.97);
            border-right: 1px solid rgba(255,255,255,0.1);
            z-index: 200;          /* cao hơn canvas overlay */
            display: flex;
            flex-direction: column;
            padding: 16px;
            overflow-y: auto;
            position: relative;
        }

        .panel-title { font-size:1.1rem; font-weight:bold; text-transform:uppercase; letter-spacing:1px; margin-bottom:2px; color:#00e5ff; }
        .panel-subtitle { font-size:.75rem; color:#888; margin-bottom:12px; }

        .section-divider {
            color:#ffcb05; margin:12px 0 8px; font-size:.8rem;
            text-transform:uppercase; letter-spacing:.5px;
            border-top:1px solid rgba(255,255,255,0.1); padding-top:12px;
        }

        .type-grid { display:grid; grid-template-columns:repeat(2,1fr); gap:6px; margin-bottom:10px; }

        .type-btn {
            padding:7px 6px; border:1px solid rgba(255,255,255,0.15);
            background:rgba(255,255,255,0.05); color:#ccc;
            border-radius:6px; cursor:pointer; font-weight:600;
            text-align:center; font-size:.75rem; transition:all .2s;
        }
        .type-btn:hover { background:rgba(255,255,255,0.12); color:#fff; }
        .type-btn.active {
            color:#fff; font-weight:bold;
            border-color:var(--tc,#fff);
            background:rgba(128,128,128,0.2);
            box-shadow:0 0 10px var(--tc,#fff);
        }

        .bg-actions { display:flex; gap:8px; margin-bottom:4px; }
        .flash-btn {
            flex:1; padding:10px 8px; background:#ff3366; color:white;
            border:none; border-radius:6px; font-weight:bold;
            text-transform:uppercase; cursor:pointer; font-size:.75rem;
        }
        .flash-btn:hover { background:#ff5588; }
        .stop-btn {
            flex:1; padding:10px 8px; background:#222; color:#aaa;
            border:1px solid #555; border-radius:6px; font-weight:bold;
            text-transform:uppercase; cursor:pointer; font-size:.75rem;
        }
        .stop-btn:hover { background:#333; color:#fff; }

        .skill-scroll-container {
            max-height:220px; overflow-y:auto;
            border:1px solid rgba(255,255,255,0.1);
            padding:8px; background:rgba(0,0,0,0.3); border-radius:6px;
        }
        .btn-type {
            padding:6px; border:none; border-radius:4px; color:white;
            font-weight:bold; cursor:pointer; text-transform:uppercase;
            font-size:10px; transition:transform .1s, filter .2s;
            text-shadow:1px 1px 2px rgba(0,0,0,.5); flex:1; text-align:center;
        }
        .btn-type:hover { filter:brightness(1.3); transform:translateY(-1px); }

        .special-controls { display:flex; gap:8px; justify-content:center; margin-top:10px; }
        .btn-special {
            background:#333; color:white; border:1px solid #555;
            padding:7px 12px; border-radius:20px; cursor:pointer; font-size:11px;
        }
        .btn-special:hover { background:#444; }

        select {
            width:100%; padding:7px; background:#222; color:white;
            border-radius:5px; border:1px solid #444; margin-top:4px; font-size:.82rem;
        }

        .info-note { font-size:.68rem; color:#666; text-align:center; padding:3px; font-style:italic; margin-bottom:6px; }

        /* ── ARENA DISPLAY ── */
        .arena-display {
            flex:1;
            position:relative;
            height:100%;
            display:flex;
            flex-direction:column;
            align-items:center;
            justify-content:center;
            padding:20px;
            overflow:hidden;
        }

        /* Canvas overlay — chỉ nằm trong arena-display, KHÔNG che sidebar */
        #bg-canvas-overlay {
            position:absolute;
            top:0; left:0; right:0; bottom:0;
            width:100%; height:100%;
            z-index:1;           /* thấp — nằm dưới battle-scene và sidebar */
            pointer-events:none;
            display:none;
            overflow:hidden;
        }

        /* ── BATTLE SCENE ── */
        #battle-scene {
            position:relative;
            width:100%; max-width:780px; height:390px;
            background:linear-gradient(to bottom,rgba(40,40,60,.5),rgba(10,10,20,.8));
            border:2px solid rgba(255,255,255,0.12);
            border-radius:14px; overflow:hidden;
            box-shadow:0 10px 40px rgba(0,0,0,.6);
            z-index:5;
        }

        .pkm-unit { position:absolute; width:120px; text-align:center; transition:all .3s ease; }
        .pkm-sprite { width:100px; height:100px; margin:0 auto; background-size:contain; background-repeat:no-repeat; background-position:center; }

        #player-unit-0 { bottom:40px; left:80px; }
        #enemy-unit-0  { top:30px;   right:80px; }
        #enemy-unit-1  { top:140px;  right:180px; }
        #enemy-unit-2  { top:250px;  right:80px; }

        /* Pokéball decor */
        .pokemon-mockup { position:relative; z-index:5; width:200px; height:110px; display:flex; flex-direction:column; align-items:center; justify-content:center; pointer-events:none; margin-top:12px; }
        .mockup-sprite { width:65px; height:65px; background:radial-gradient(circle,rgba(255,255,255,.07) 0%,transparent 70%); border-radius:50%; display:flex; align-items:center; justify-content:center; animation:bounce 2s ease-in-out infinite alternate; }
        .mockup-sprite svg { width:46px; height:46px; fill:rgba(255,255,255,.35); filter:drop-shadow(0 0 6px rgba(255,255,255,.2)); }
        .pokemon-shadow { width:65px; height:7px; background:rgba(0,0,0,.45); border-radius:50%; margin-top:4px; animation:shadowScale 2s ease-in-out infinite alternate; }
        @keyframes bounce     { 0%{transform:translateY(0)} 100%{transform:translateY(-8px)} }
        @keyframes shadowScale{ 0%{transform:scale(1);opacity:.55} 100%{transform:scale(.8);opacity:.25} }

        /* Status badge */
        #status-badge {
            position:absolute; bottom:10px; right:10px;
            padding:5px 12px; border-radius:20px;
            font-size:11px; font-weight:bold; text-transform:uppercase; letter-spacing:1px;
            z-index:6; transition:all .3s;
            background:rgba(0,0,0,.5); border:1px solid rgba(255,255,255,.12); color:#666;
        }
        #status-badge.on {
            background:rgba(0,0,0,.6);
            border-color:var(--bc,#fff); color:var(--bc,#fff);
            box-shadow:0 0 12px var(--bc,#fff);
        }

        @keyframes damageFloat {
            0%   { transform:translateX(-50%) translateY(0); opacity:1; }
            100% { transform:translateX(-50%) translateY(-55px); opacity:0; }
        }
        @keyframes shake {
            0%,100%{ transform:translate(-50%,-50%) translateX(0); }
            20%    { transform:translate(-50%,-50%) translateX(-6px); }
            40%    { transform:translate(-50%,-50%) translateX(6px); }
            60%    { transform:translate(-50%,-50%) translateX(-4px); }
            80%    { transform:translate(-50%,-50%) translateX(4px); }
        }
        .shake { animation:shake .5s ease-in-out; }
    </style>
</head>
<body>

<!-- ══ SIDEBAR ══ -->
<div class="control-panel">
    <div class="panel-title">PKM Arena Lab</div>
    <div class="panel-subtitle">Skill Engine + Canvas Background Test</div>

    <!-- PHẦN 1: NỀN CANVAS -->
    <div style="color:#00e5ff;font-size:.78rem;font-weight:bold;text-transform:uppercase;margin-bottom:4px;">
        1. Thử Nghiệm Nền Canvas (PkmSkillBack)
    </div>
    <div class="info-note">Bấm hệ → hiện nền · Giữ flash · Stop → tắt</div>
    <div class="type-grid" id="typeGrid"></div>
    <div class="bg-actions">
        <button class="flash-btn" id="btnFlash">💥 Giữ Flash</button>
        <button class="stop-btn"  id="btnStop">⏹ Dừng</button>
    </div>

    <!-- PHẦN 2: SKILL -->
    <div class="section-divider">2. Thử Nghiệm Kỹ Năng (SkillManager)</div>
    <div style="margin-bottom:10px;font-size:12px;color:#aaa;">
        Gen:
        <select id="gen-select">
            <option value="1">Gen 1 (Cơ bản)</option>
            <option value="2">Gen 2 (Vừa)</option>
            <option value="3">Gen 3 (Mạnh)</option>
            <option value="4">Gen 4 (Rất mạnh)</option>
            <option value="mega">Mega Evolution</option>
        </select>
    </div>
    <div style="font-size:12px;color:#aaa;margin-bottom:6px;">Chiêu thức (đánh 3 địch):</div>
    <div class="skill-scroll-container" id="type-buttons"></div>
    <div class="special-controls">
        <button class="btn-special" onclick="testNormalAttack()">Đòn thường</button>
        <button class="btn-special" onclick="testMiss()" style="border-color:#feca57;color:#feca57;">Test Hụt</button>
    </div>
</div>

<!-- ══ ARENA ══ -->
<div class="arena-display">

    <!-- Canvas nền — chỉ phủ trong arena, KHÔNG phủ sidebar -->
    <div id="bg-canvas-overlay"></div>

    <h2 style="color:#ffcb05;text-shadow:2px 2px #3c5aa6;z-index:5;margin-bottom:14px;font-size:1.35rem;letter-spacing:2px;position:relative;">
        ⚔ Pokemon Skill Laboratory ⚔
    </h2>

    <div id="battle-scene" style="position:relative;">
        <div id="player-unit-0" class="pkm-unit">
            <div class="pkm-sprite" style="background-image:url('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/25.gif');"></div>
            <div style="font-size:11px;margin-top:4px;font-weight:bold;color:#ffcb05;">PIKACHU</div>
        </div>
        <div id="enemy-unit-0" class="pkm-unit">
            <div class="pkm-sprite" style="background-image:url('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/150.gif');"></div>
            <div style="font-size:11px;margin-top:4px;font-weight:bold;color:#ff6b6b;">MEWTWO</div>
        </div>
        <div id="enemy-unit-1" class="pkm-unit">
            <div class="pkm-sprite" style="background-image:url('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/6.gif');"></div>
            <div style="font-size:11px;margin-top:4px;font-weight:bold;color:#ff6b6b;">CHARIZARD</div>
        </div>
        <div id="enemy-unit-2" class="pkm-unit">
            <div class="pkm-sprite" style="background-image:url('https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/showdown/7.gif');"></div>
            <div style="font-size:11px;margin-top:4px;font-weight:bold;color:#ff6b6b;">SQUIRTLE</div>
        </div>
        <div id="status-badge">— chọn hệ —</div>
    </div>

    <div class="pokemon-mockup">
        <div class="mockup-sprite">
            <svg viewBox="0 0 24 24"><path d="M12,2A10,10 0 0,0 2,12A10,10 0 0,0 12,22A10,10 0 0,0 22,12A10,10 0 0,0 12,2M12,4A8,8 0 0,1 19.3,11H15.1C14.7,9.3 13.2,8 11.4,8C9.3,8 7.6,9.5 7.1,11.5H4.05C4.6,7.3 8,4 12,4M4.05,13H7.1C7.5,14.8 9,16 10.9,16C13,16 14.7,14.5 15.2,12.5H19.85C19.3,16.7 15.9,20 12,20C7.7,20 4.3,16.5 4.05,13M12,10A2,2 0 0,1 14,12A2,2 0 0,1 12,14A2,2 0 0,1 10,12A2,2 0 0,1 12,10Z"/></svg>
        </div>
        <div class="pokemon-shadow"></div>
    </div>
</div>

<script src="pkm_skill_back.js"></script>
<script src="pkm_skill.js"></script>

<script>
// ════════════════════════════════════════════════════
//  PATCH: PkmSkillBack dùng #bg-canvas-overlay (absolute)
//  thay vì fixed fullscreen — không che sidebar
// ════════════════════════════════════════════════════
(function patchPkmSkillBack() {
    // Đợi PkmSkillBack nạp xong
    function tryPatch() {
        if (!window.PkmSkillBack) { setTimeout(tryPatch, 50); return; }

        const _origShow = window.PkmSkillBack.show.bind(window.PkmSkillBack);
        const _origHide = window.PkmSkillBack.hide.bind(window.PkmSkillBack);

        window.PkmSkillBack.show = function(el, type, posX, posY) {
            // Override style: absolute thay vì fixed
            // (PkmSkillBack.show sẽ set cssText, ta sửa lại sau)
            _origShow(el, type, posX, posY);
            // Sau khi show set style, ta override lại position
            el.style.position = 'absolute';
            el.style.width    = '100%';
            el.style.height   = '100%';
            el.style.top      = '0';
            el.style.left     = '0';
            el.style.zIndex   = '1';
        };

        window.PkmSkillBack.hide = function(el) {
            _origHide(el);
        };
    }
    tryPatch();
})();

// ════════════════════════════════════════════════════
//  PATCH: SkillManager.toggleSkillScene dùng #bg-canvas-overlay
//  thay vì #skill-scene-overlay (không tồn tại / fixed)
// ════════════════════════════════════════════════════
(function patchSkillManager() {
    function tryPatch() {
        if (!window.SkillManager) { setTimeout(tryPatch, 50); return; }

        const _origToggle = window.SkillManager.toggleSkillScene.bind(window.SkillManager);

        window.SkillManager.toggleSkillScene = function(show, side, attackerIndex, type) {
            // Thay thế id overlay mà SkillManager tìm
            const fakeOverlay = document.getElementById('bg-canvas-overlay');
            const arena       = document.getElementById('battle-arena'); // ko tồn tại → null ok

            if (show) {
                document.querySelectorAll('.pkm-unit').forEach(u => {
                    const isAttacker = u.id === `${side}-unit-${attackerIndex}`;
                    const isEnemy    = side === 'player'
                        ? u.id.startsWith('enemy-')
                        : u.id.startsWith('player-');
                    const visible = isAttacker || isEnemy;
                    u.style.opacity    = visible ? '1' : '0';
                    u.style.visibility = visible ? 'visible' : 'hidden';
                    u.style.zIndex     = visible ? '10' : '';
                });

                if (fakeOverlay && window.PkmSkillBack) {
                    fakeOverlay.style.display = 'block';
                    fakeOverlay.style.opacity = '1';
                    window.PkmSkillBack.show(fakeOverlay, type || 'normal', 50, 50);
                    // Đảm bảo absolute sau khi show patch
                    fakeOverlay.style.position = 'absolute';
                    fakeOverlay.style.zIndex   = '1';
                }
            } else {
                document.querySelectorAll('.pkm-unit').forEach(u => {
                    u.style.opacity    = '1';
                    u.style.visibility = 'visible';
                    u.style.zIndex     = '';
                    u.style.transform  = 'translate(-50%,-50%)';
                });
                if (fakeOverlay && window.PkmSkillBack) {
                    window.PkmSkillBack.hide(fakeOverlay);
                    fakeOverlay.style.opacity = '0';
                    setTimeout(() => { fakeOverlay.style.display = 'none'; }, 400);
                }
            }
        };
    }
    tryPatch();
})();

// ════════════════════════════════════════════════════
//  STATE & LOGIC CHÍNH
// ════════════════════════════════════════════════════
let currentType   = 'normal';
let bgActive      = false;
let flashInterval = null;

const overlay    = document.getElementById('bg-canvas-overlay');
const badge      = document.getElementById('status-badge');

const pokemonTypes = [
    {id:'normal',   name:'Thường 🤍',  color:'#a8a878'},
    {id:'fire',     name:'Lửa 🔥',     color:'#f08030'},
    {id:'water',    name:'Nước 💧',    color:'#6890f0'},
    {id:'grass',    name:'Cỏ 🌿',      color:'#78c850'},
    {id:'electric', name:'Điện ⚡',    color:'#f8d030'},
    {id:'ice',      name:'Băng 🧊',    color:'#98d8d8'},
    {id:'fighting', name:'Chiến 🥊',   color:'#c03028'},
    {id:'poison',   name:'Độc ☠️',     color:'#a040a0'},
    {id:'ground',   name:'Đất 🌍',     color:'#e0c068'},
    {id:'flying',   name:'Bay 🌬️',     color:'#a890f0'},
    {id:'psychic',  name:'TâmLinh 🧠', color:'#f85888'},
    {id:'bug',      name:'Bọ 🐛',      color:'#a8b820'},
    {id:'rock',     name:'Đá 🪨',      color:'#b8a038'},
    {id:'ghost',    name:'Ma 👻',      color:'#705898'},
    {id:'dragon',   name:'Rồng 🐉',    color:'#7038f8'},
    {id:'dark',     name:'Tối 🌑',     color:'#705848'},
    {id:'steel',    name:'Thép ⚙️',    color:'#b8b8d0'},
    {id:'fairy',    name:'Tiên 🧚',    color:'#ee99ac'},
];

function showBg(type) {
    if (!window.PkmSkillBack) return;
    currentType = type;
    bgActive    = true;
    overlay.style.display  = 'block';
    overlay.style.opacity  = '1';
    window.PkmSkillBack.show(overlay, type, 50, 50);
    // Đảm bảo absolute sau patch
    overlay.style.position = 'absolute';
    overlay.style.zIndex   = '1';

    const t = pokemonTypes.find(x => x.id === type);
    badge.style.setProperty('--bc', t ? t.color : '#fff');
    badge.className = 'on';
    badge.textContent = (t ? t.name : type) + ' ▶';
}

function hideBg() {
    if (!window.PkmSkillBack) return;
    bgActive = false;
    window.PkmSkillBack.hide(overlay);
    overlay.style.opacity = '0';
    setTimeout(() => { overlay.style.display = 'none'; }, 400);
    badge.className = '';
    badge.textContent = '— chọn hệ —';
}

function startFlash() {
    if (!bgActive) showBg(currentType);
    let on = true;
    flashInterval = setInterval(() => { overlay.style.opacity = on ? '0' : '1'; on = !on; }, 110);
}
function stopFlash() {
    if (flashInterval) { clearInterval(flashInterval); flashInterval = null; }
    if (bgActive) overlay.style.opacity = '1';
}

async function testSkill(type, idx) {
    if (!window.SkillManager) return;
    const gen = document.getElementById('gen-select').value;
    await SkillManager.play({
        attackerSide:'player', attackerIndex:0,
        targetSide:'enemy', targets:[0,1,2],
        type, skillIndex:idx,
        gen: isNaN(gen) ? gen : parseInt(gen),
        damage: Math.floor(Math.random()*80)+20,
        isSkill:true, missed:false,
    });
}
async function testNormalAttack() {
    if (!window.SkillManager) return;
    await SkillManager.play({attackerSide:'player',attackerIndex:0,targetSide:'enemy',targets:[0],damage:15,isSkill:false,missed:false});
}
async function testMiss() {
    if (!window.SkillManager) return;
    await SkillManager.play({attackerSide:'player',attackerIndex:0,targetSide:'enemy',targets:[0],missed:true});
}

// ════════════════════════════════════════════════════
//  DOM READY
// ════════════════════════════════════════════════════
window.addEventListener('DOMContentLoaded', () => {

    // Build nút hệ (Phần 1)
    const grid = document.getElementById('typeGrid');
    pokemonTypes.forEach(t => {
        const btn = document.createElement('button');
        btn.className = 'type-btn';
        btn.textContent = t.name;
        btn.style.setProperty('--tc', t.color);
        btn.addEventListener('click', () => {
            grid.querySelectorAll('.type-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            showBg(t.id);
        });
        grid.appendChild(btn);
    });

    // Flash button
    const btnFlash = document.getElementById('btnFlash');
    btnFlash.addEventListener('mousedown',  startFlash);
    btnFlash.addEventListener('mouseup',    stopFlash);
    btnFlash.addEventListener('mouseleave', stopFlash);
    btnFlash.addEventListener('touchstart', e => { e.preventDefault(); startFlash(); });
    btnFlash.addEventListener('touchend',   stopFlash);
    document.getElementById('btnStop').addEventListener('click', hideBg);

    // Build nút skill (Phần 2)
    function buildSkillBtns() {
        if (!window.SkillManager || !SkillManager.systemConfig) {
            document.getElementById('type-buttons').innerHTML =
                '<div style="color:#feca57;font-size:11px;text-align:center;padding:8px;">Đang nạp SkillManager...</div>';
            setTimeout(buildSkillBtns, 300);
            return;
        }
        const container = document.getElementById('type-buttons');
        container.innerHTML = '';
        Object.keys(SkillManager.systemConfig).forEach(type => {
            const row = document.createElement('div');
            row.style.cssText = 'display:flex;gap:6px;align-items:center;margin-bottom:6px;';
            row.innerHTML = `<span style="width:68px;font-size:10px;font-weight:bold;text-transform:uppercase;color:#ddd;">${type}</span>`;
            for (let i = 1; i <= 3; i++) {
                const b = document.createElement('button');
                b.className = 'btn-type';
                b.textContent = `S${i}`;
                b.style.backgroundColor = SkillManager.systemConfig[type].color || '#444';
                b.onclick = () => testSkill(type, i);
                row.appendChild(b);
            }
            container.appendChild(row);
        });
    }
    buildSkillBtns();
});
</script>
</body>
</html>
