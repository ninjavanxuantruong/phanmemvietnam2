// linhthu.js
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { skillEffects } from "./skillEffects.js"; 
import { pokemonData } from "./pokemonData.js";   

(function() {
    const firebaseConfig = {
        apiKey: "AIzaSyCCVdzWiiFvcWiHVJN-x33YKarsjyziS8E",
        authDomain: "pokemon-capture-10d03.firebaseapp.com",
        projectId: "pokemon-capture-10d03",
        storageBucket: "pokemon-capture-10d03.appspot.com",
        messagingSenderId: "1068125543917",
        appId: "1:1068125543917:web:57de4365ee56729ea8dbe4"
    };

    let app;
    try { app = initializeApp(firebaseConfig); } catch { app = getApp(); }
    const db = getFirestore(app);

    function getPokeInfo(id) {
        return pokemonData.find(p => p.id === id) || { skills: ["Tackle"] };
    }

    // --- 1. HÀM NÓI CHUYỆN (CÓ TIẾNG) ---
    // --- 1. HÀM NÓI CHUYỆN (ĐÃ SỬA LỖI HIỂN THỊ CHỮ) ---
    function speakAndShow(parent, text) {
        // 1. Dọn dẹp bong bóng cũ (nếu có)
        const oldBubbles = parent.querySelectorAll('.poke-bubble');
        oldBubbles.forEach(b => b.remove());

        // 2. Tạo bong bóng mới
        const bubble = document.createElement('div');
        bubble.className = 'poke-bubble'; 
        bubble.innerText = text; 

        // 3. Style cực kỳ tinh gọn, bám sát container
        Object.assign(bubble.style, {
            position: 'absolute',
            bottom: '105%', // Nằm ngay sát trên đầu Pokemon
            left: '50%',
            transform: 'translateX(-50%)',
            background: 'white',
            border: '2px solid #333',
            borderRadius: '12px',
            padding: '4px 10px',
            fontSize: '14px',
            fontWeight: 'bold',
            color: '#333',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
            whiteSpace: 'nowrap',
            zIndex: '1000',
            pointerEvents: 'none', // Không cản trở click
            animation: 'bubble-up 2s ease-out forwards' // Chỉ dùng 1 animation này
        });

        // Mũi tên nhỏ trỏ xuống
        const arrow = document.createElement('div');
        Object.assign(arrow.style, {
            position: 'absolute',
            bottom: '-8px', left: '50%',
            transform: 'translateX(-50%)',
            borderWidth: '8px 8px 0',
            borderStyle: 'solid',
            borderColor: 'white transparent transparent'
        });
        bubble.appendChild(arrow);

        // 4. Gắn vào container (là biến 'parent' được truyền từ setInterval)
        parent.appendChild(bubble);

        // Tự xóa sau khi diễn xong animation
        setTimeout(() => bubble.remove(), 2000);

        // 5. Phát tiếng nói (TTS)
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.volume = 0.5;
        window.speechSynthesis.speak(utterance);
    }
    function launchFirework(parent) {
        for(let i=0; i<8; i++) {
            const p = document.createElement('div');
            const color = `hsl(${Math.random() * 360}, 100%, 50%)`;
            Object.assign(p.style, {
                position: 'absolute', top: '50%', left: '50%', width: '6px', height: '6px',
                background: color, borderRadius: '50%', zIndex: '99',
                animation: `firework-burst 0.8s ease-out forwards`
            });
            const angle = (i / 8) * Math.PI * 2;
            p.style.setProperty('--tx', Math.cos(angle) * 70 + 'px');
            p.style.setProperty('--ty', Math.sin(angle) * 70 + 'px');
            parent.appendChild(p);
            setTimeout(() => p.remove(), 800);
        }
    }

    async function initPet() {
        if (!document.body) return;

        const name = localStorage.getItem("trainerName") || "Không tên";
        const cls  = localStorage.getItem("trainerClass") || "Chưa có lớp";
        const snap = await getDoc(doc(db, "bosuutap", `${name.trim()}-${cls.trim()}`));
        const pokeId = snap.exists() ? snap.data().selected : 25;

        const pet = document.createElement('div');
        pet.id = 'global-pet';
        const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeId}.png`;
        pet.innerHTML = `<div id="pet-container"><img src="${imgUrl}" width="100"></div>`;

        Object.assign(pet.style, {
            position: 'fixed', zIndex: '99999', pointerEvents: 'none',
            transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            left: '20px', bottom: '20px'
        });

        // --- TỔNG HỢP CSS ANIMATIONS (ĐÃ SỬA LỖI ANIMATION CHỮ) ---
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            /* ✅ CÁCH VIẾT KEYFRAMES CHUẨN ĐỂ HIỆN CHỮ MƯỢT MÀ */
            @keyframes bubble-up { 
                0% { 
                    opacity: 0; 
                    /* Bắt đầu thấp, giữ nguyên translateX(-50%) từ style chính */
                    transform: translateX(-50%) translateY(20px) scale(0.8); 
                } 
                15% { 
                    opacity: 1; 
                    /* Hiện rõ và phóng to nhẹ ở vị trí chính */
                    transform: translateX(-50%) translateY(0) scale(1); 
                } 
                85% { 
                    opacity: 1; 
                    /* Giữ nguyên vị trí và độ rõ */
                    transform: translateX(-50%) translateY(0) scale(1); 
                } 
                100% { 
                    opacity: 0; 
                    /* Bay lên cao, làm mờ và thu nhỏ */
                    transform: translateX(-50%) translateY(-40px) scale(0.8); 
                } 
            }

            /* Các keyframes khác giữ nguyên */
            @keyframes firework-burst { 100% { transform: translate(var(--tx), var(--ty)); opacity: 0; } }
            @keyframes pet-breath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05) translateY(-5px); } }
            @keyframes pet-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes pet-jump { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-30px); } }
            @keyframes pet-teleport-out { 0% { transform: scale(1); opacity: 1; filter: blur(0); } 100% { transform: scale(0); opacity: 0; filter: blur(10px); } }
            @keyframes pet-teleport-in { 0% { transform: scale(0); opacity: 0; filter: blur(10px); } 100% { transform: scale(1); opacity: 1; filter: blur(0); } }

            .pet-breathing { animation: pet-breath 3s infinite ease-in-out; }
            .anim-spin { animation: pet-spin 0.6s ease-in-out; }
            .anim-jump { animation: pet-jump 0.5s ease-in-out; }
            .anim-tp-out { animation: pet-teleport-out 0.5s forwards; }
            .anim-tp-in { animation: pet-teleport-in 0.5s forwards; }
        `;
        document.head.appendChild(styleSheet);

        const container = pet.querySelector('#pet-container');
        container.classList.add('pet-breathing');
        document.body.appendChild(pet);

        // --- VÒNG LẶP HÀNH ĐỘNG ---
        setInterval(() => {
            const rand = Math.random();
            container.classList.remove('pet-breathing');

            // 1. Dịch chuyển (Teleport) - Tỉ lệ 10%
            if (rand < 0.10) {
                container.classList.add('anim-tp-out');
                setTimeout(() => {
                    pet.style.left = `${Math.random() * (window.innerWidth - 150) + 50}px`;
                    pet.style.top = `${Math.random() * (window.innerHeight - 150) + 50}px`;
                    container.classList.remove('anim-tp-out');
                    container.classList.add('anim-tp-in');
                    setTimeout(() => container.classList.remove('anim-tp-in'), 500);
                }, 500);
            }
            // 2. Tiếng kêu (Riêng biệt) - Tỉ lệ 5%
            else if (rand < 0.15) {
                const audio = new Audio(`https://raw.githubusercontent.com/PokeAPI/cries/master/cries/pokemon/latest/${pokeId}.ogg`);
                audio.volume = 0.04;
                audio.play().catch(() => {});
            }
            // 3. Bắn Skill (Tăng tỉ lệ lên 25%)
            else if (rand < 0.40) {
                const info = getPokeInfo(pokeId);
                const sName = info.skills[Math.floor(Math.random() * info.skills.length)];
                if (typeof skillEffects[sName] === "function") {
                    const rect = container.getBoundingClientRect();
                    const from = { x: rect.left + 50, y: rect.top + 50 };
                    const to = { x: from.x + (Math.random()-0.5)*400, y: from.y + (Math.random()-0.5)*400 };
                    skillEffects[sName](document.body, { x: from.x, y: from.y, targetX: to.x, targetY: to.y });
                }
            }
            // 4. Nói & Cổ vũ (CÓ TIẾNG) - Tỉ lệ 15%
            else if (rand < 0.55) {
                const cheers = ["Great!", "Good job!", "Excellent!", "Amazing!", "Try more!"];
                speakAndShow(container, cheers[Math.floor(Math.random() * cheers.length)]);
                if (Math.random() > 0.5) launchFirework(container);
            }
            // 5. Vận động cơ thể (Xoay/Nhảy) - Tỉ lệ 20%
            else if (rand < 0.75) {
                const anim = Math.random() > 0.5 ? 'anim-spin' : 'anim-jump';
                container.classList.add(anim);
                setTimeout(() => container.classList.remove(anim), 600);
            }

            // Trả lời trạng thái thở
            setTimeout(() => { if(!container.classList.contains('pet-breathing')) container.classList.add('pet-breathing'); }, 1000);
        }, 5000);

        // Click để di chuyển thủ công
        document.addEventListener('mousedown', (e) => {
            if (['BUTTON', 'INPUT', 'A', 'SELECT'].includes(e.target.tagName)) return;
            pet.style.left = `${e.clientX - 50}px`;
            pet.style.top = `${e.clientY - 50}px`;
        });
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', initPet);
    else initPet();
})();
