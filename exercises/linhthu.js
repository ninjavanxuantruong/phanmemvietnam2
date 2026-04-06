// linhthu.js
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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

    async function getSelectedPokemon() {
        const name = localStorage.getItem("trainerName") || "Không tên";
        const cls  = localStorage.getItem("trainerClass") || "Chưa có lớp";
        const docId = `${name.trim()}-${cls.trim()}`;
        const ref = doc(db, "bosuutap", docId);
        try {
            const snap = await getDoc(ref);
            return snap.exists() ? snap.data().selected : 25;
        } catch (err) {
            return 25; 
        }
    }

    // ĐÃ SỬA: Bỏ hàm lấy tên lỗi, dùng thẳng nguồn .ogg ổn định nhất
    async function playPokeCry(pokeId) {
        try {
            // 1. Gọi PokéAPI để lấy thông tin chi tiết (bao gồm tên tiếng Anh)
            const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${pokeId}`);
            const data = await response.json();
            const pokeName = data.name; // Lấy tên tiếng Anh chuẩn (ví dụ: 'pikachu', 'charizard')

            // 2. Dùng tên đó để gọi file .mp3 từ Showdown
            const audioUrl = `https://play.pokemonshowdown.com/audio/cries/${pokeName}.mp3`;
            const audio = new Audio(audioUrl);
            audio.volume = 0.1; // Âm thanh Showdown khá sạch nên để 0.1 là vừa

            await audio.play();
        } catch (err) {
            console.error("Không lấy được tiếng kêu từ Showdown, thử dùng nguồn dự phòng...");
            // Nguồn dự phòng dùng ID (PokeAPI .ogg) nếu Showdown lỗi tên
            const backupUrl = `https://raw.githubusercontent.com/PokeAPI/cries/master/cries/pokemon/latest/${pokeId}.ogg`;
            new Audio(backupUrl).play().catch(() => {});
        }
    }

    async function initPet() {
        if (!document.body) return;

        const pokeId = await getSelectedPokemon();
        const pet = document.createElement('div');
        pet.id = 'global-pet';

        const imgUrl = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/other/official-artwork/${pokeId}.png`;

        pet.innerHTML = `
            <div id="pet-container" style="transition: all 0.5s ease;">
                <img src="${imgUrl}" width="100" style="filter: drop-shadow(2px 4px 6px rgba(0,0,0,0.3));">
            </div>
        `;

        Object.assign(pet.style, {
            position: 'fixed',
            zIndex: '99999',
            pointerEvents: 'none',
            transition: 'all 0.8s cubic-bezier(0.175, 0.885, 0.32, 1.275)',
            left: '20px',
            bottom: '20px'
        });

        // ĐÃ SỬA: Bổ sung đầy đủ các Keyframes cho Zoom, Left, Right
        const styleSheet = document.createElement("style");
        styleSheet.innerText = `
            @keyframes pet-breath { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.05) translateY(-5px); } }
            @keyframes pet-spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
            @keyframes pet-jump { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-30px) scaleX(0.9); } }
            @keyframes pet-zoom { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.4); } }
            @keyframes pet-left { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(-40px) translateY(-10px); } }
            @keyframes pet-right { 0%, 100% { transform: translateX(0); } 50% { transform: translateX(40px) translateY(-10px); } }

            .pet-breathing { animation: pet-breath 3s infinite ease-in-out; }
            .pet-spinning { animation: pet-spin 0.6s ease-in-out; }
            .pet-jumping { animation: pet-jump 0.5s ease-in-out; }
            .pet-zooming { animation: pet-zoom 0.6s ease-in-out; }
            .pet-left { animation: pet-left 0.6s ease-in-out; }
            .pet-right { animation: pet-right 0.6s ease-in-out; }
        `;
        document.head.appendChild(styleSheet);

        const container = pet.querySelector('#pet-container');
        container.classList.add('pet-breathing');
        document.body.appendChild(pet);

        setInterval(() => {
            const rand = Math.random();
            container.classList.remove('pet-breathing');

            // Xử lý hành động ngẫu nhiên
            if (rand < 0.1) {
                container.classList.add('pet-spinning');
                setTimeout(() => container.classList.remove('pet-spinning'), 600);
            } else if (rand < 0.2) {
                container.classList.add('pet-jumping');
                setTimeout(() => container.classList.remove('pet-jumping'), 500);
            } else if (rand < 0.3) {
                container.classList.add('pet-zooming');
                setTimeout(() => container.classList.remove('pet-zooming'), 600);
            } else if (rand < 0.4) {
                container.classList.add('pet-left');
                setTimeout(() => container.classList.remove('pet-left'), 600);
            } else if (rand < 0.5) {
                container.classList.add('pet-right');
                setTimeout(() => container.classList.remove('pet-right'), 600);
            }

            // Trả lời trạng thái thở sau khi diễn xong
            // CÁCH SỬA ĐÚNG:
            setTimeout(() => {
                if (!container.classList.contains('pet-breathing')) {
                    container.classList.add('pet-breathing');
                }
            }, 700);

            // Tỉ lệ kêu 20% mỗi 6 giây
            if (rand < 0.2) {
                playPokeCry(pokeId);
            }
        }, 6000);

        document.addEventListener('mousedown', (e) => {
            if (['BUTTON', 'INPUT', 'A', 'SELECT'].includes(e.target.tagName)) return;
            const x = e.clientX - 50; 
            const y = e.clientY - 50;
            pet.style.left = `${x}px`;
            pet.style.top = `${y}px`;
            container.style.transform = 'scale(1.4) rotate(-15deg)';
            setTimeout(() => { 
                container.style.transform = 'scale(1) rotate(0deg)'; 
            }, 400);
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initPet);
    } else {
        initPet();
    }
})();
