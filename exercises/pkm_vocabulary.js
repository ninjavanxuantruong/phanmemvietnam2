/**
 * =========================================================================
 * POKEMON VOCABULARY LEARNING MODULE - WITH TRAINER CONVERSATION INTERACTION
 * =========================================================================
 */

window.VocabularyModule = {
    currentLessonData: [],
    currentIndex: 0,
    currentRound: 1, // Vòng 1, Vòng 2, hoặc Vòng 3 (Hội thoại)
    turnPhase: "ask", // Lượt của Trainer A hỏi ("ask") hay Trainer B trả lời ("answer")

    // Cấu hình giọng đọc mặc định
    voiceMale: null,
    voiceFemale: null,

    COLS: {
        LESSON_NAME: 1, WORD: 2, PHRASE_EN: 3, PHRASE_VI: 4,
        PRESENT_SENT: 8, QUESTION: 9, KEYWORD_FIX: 10, FINAL_ANS: 11,
        MEANING: 24, SOUND_PUN: 25, PUN_SENTENCE: 26,
    },

    // 1. Tải và đồng bộ hóa danh sách giọng nói AI chuẩn Mỹ
    initVoices() {
        return new Promise((resolve) => {
            const list = window.speechSynthesis.getVoices();
            const filterVoices = (vList) => {
                this.voiceMale = vList.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("david")) ||
                                 vList.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("alex")) ||
                                 vList.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("male")) ||
                                 vList.find(v => v.lang === "en-US");

                this.voiceFemale = vList.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("zira")) ||
                                   vList.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("samantha")) ||
                                   vList.find(v => v.lang === "en-US" && v.name.toLowerCase().includes("female")) ||
                                   vList.find(v => v.lang === "en-US");
                resolve();
            };
            if (list.length) return filterVoices(list);
            window.speechSynthesis.onvoiceschanged = () => filterVoices(window.speechSynthesis.getVoices());
        });
    },

    // 2. Hàm phát âm văn bản theo giọng chỉ định
    speak(text, isFemale = true) {
        if (!text) return;
        window.speechSynthesis.cancel();
        const utter = new SpeechSynthesisUtterance(text);
        utter.lang = "en-US";
        utter.voice = isFemale ? this.voiceFemale : this.voiceMale;
        utter.rate = 0.9; 
        window.speechSynthesis.speak(utter);
    },

    // 3. Hiệu ứng gõ chữ và Highlight từ vựng đích
    typeText(element, fullText, vocabWord, onDone = () => {}) {
        element.textContent = "";
        let i = 0;
        const speed = 40; 

        function step() {
            if (i < fullText.length) {
                element.textContent += fullText.charAt(i);
                i++;
                setTimeout(step, speed);
            } else {
                if (vocabWord) {
                    const regex = new RegExp(`\\b(${vocabWord})\\b`, "gi");
                    element.innerHTML = fullText.replace(regex, `<span style="color: #ffcb05; font-weight: bold; text-shadow: 0 0 5px rgba(255,203,5,0.4);">$1</span>`);
                }
                onDone();
            }
        }
        step();
    },

    async fetchAllVocabData() {
        const storedData = sessionStorage.getItem("allVocabData");
        const missionData = localStorage.getItem("current_mission");
        if (!storedData || !missionData) return [];

        const allRows = JSON.parse(storedData);
        const currentLessonId = JSON.parse(missionData).id;
        const listVocabs = [];

        allRows.forEach((row) => {
            const r = Array.isArray(row) ? row : Object.values(row);
            const lessonId = (r[this.COLS.LESSON_NAME] || "").toString().trim();

            if (lessonId === currentLessonId && r[this.COLS.WORD]) {
                listVocabs.push({
                    word: (r[this.COLS.WORD] || "").toString().trim(),
                    meaning: (r[this.COLS.MEANING] || "").toString().trim(),
                    enChunk: (r[this.COLS.PHRASE_EN] || "").toString().trim(),
                    viChunk: (r[this.COLS.PHRASE_VI] || "").toString().trim(),
                    question: (r[this.COLS.QUESTION] || "").toString().trim(),
                    answer: (r[this.COLS.FINAL_ANS] || "").toString().trim(),
                });
            }
        });
        this.currentLessonData = listVocabs;
        return listVocabs;
    },

    async start() {
        await this.initVoices();
        const data = await this.fetchAllVocabData();

        if (!data || data.length === 0) {
            this.endLearning();
            return;
        }

        this.currentIndex = 0;
        this.currentRound = 1;
        this.turnPhase = "ask";

        let mainCard = document.getElementById("mainCard");
        if (!mainCard) {
            mainCard = document.createElement("div");
            mainCard.id = "mainCard";
            document.body.appendChild(mainCard);
        }

        // ✅ ĐÃ SỬA: Ép cứng mainCard thành Popup chiếm toàn bộ màn hình (Full 100vw/100vh)
        mainCard.style.cssText = `
            position: fixed !important;
            top: 0 !important;
            left: 0 !important;
            width: 100vw !important;
            height: 100vh !important;
            background: radial-gradient(circle, #1a1c28 0%, #0a0c16 100%) !important;
            padding: 20px !important;
            color: white !important;
            font-family: system-ui, -apple-system, sans-serif !important;
            z-index: 99999 !important;
            box-shadow: none !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            box-sizing: border-box !important;
            overflow-y: auto !important; /* Hỗ trợ cuộn nội dung nếu màn hình điện thoại quá lùn */
        `;

        this.render();
    },

    render() {
        // KIỂM TRA ĐIỀU KIỆN CHUYỂN VÒNG CHƠI
        if (this.currentIndex >= this.currentLessonData.length) {
            if (this.currentRound === 1) {
                this.currentRound = 2;
                this.currentIndex = 0;
                alert("🌟 Đã xong Vòng 1! Bắt đầu Vòng 2 ôn tập nhanh.");
            } else if (this.currentRound === 2) {
                // CHUYỂN SANG CHẾ ĐỘ HỘI THOẠI LUYỆN NGHE NÓI TRAINER
                this.currentRound = 3; 
                this.currentIndex = 0;
                this.turnPhase = "ask";
                alert("💬 Tuyệt vời! Hãy cùng xem cuộc đối thoại thực tế giữa 2 Trainer Pokémon!");
            } else {
                this.endLearning();
                return;
            }
        }

        // PHÂN LƯỒNG GIAO DIỆN: (1 & 2 Học từ vựng) HOẶC (3 Hội thoại Trainer)
        if (this.currentRound === 1 || this.currentRound === 2) {
            this.renderVocabCard();
        } else {
            this.renderConversationCard();
        }
    },

    // --- KHUNG GIAO DIỆN HỌC TỪ VỰNG (VÒNG 1 & 2) ---
    renderVocabCard() {
        const currentItem = this.currentLessonData[this.currentIndex];
        const mainCard = document.getElementById("mainCard");
        const isLast = (this.currentRound === 2 && this.currentIndex === this.currentLessonData.length - 1);

        // Kiềm chế độ rộng nội dung từ vựng để hiển thị cân đối ở giữa màn hình PC lớn
        mainCard.innerHTML = `
            <div style="width: 100%; max-width: 500px; background: rgba(20, 24, 40, 0.7); padding: 30px; border-radius: 24px; border: 3px solid #ffcb05; box-shadow: 0 12px 40px rgba(0,0,0,0.5); box-sizing: border-box;">
                <div style="display: flex; justify-content: space-between; font-size: 0.85rem; color: #ffcb05; margin-bottom: 15px; font-weight: bold;">
                    <span>📖 HỌC TỪ VỰNG: <span style="background:#ffcb05; color:#000; padding:2px 8px; border-radius:10px;">VÒNG ${this.currentRound}/2</span></span>
                    <span>TỪ: ${this.currentIndex + 1}/${this.currentLessonData.length}</span>
                </div>
                <div style="width: 100%; height: 180px; border-radius: 12px; overflow: hidden; margin-bottom: 15px; border: 2px solid #333; background: #000;">
                    <img src="https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=500&q=80" style="width: 100%; height: 100%; object-fit: cover;">
                </div>
                <h1 style="font-size: 2.8rem; margin: 5px 0; letter-spacing: 1px; color: #fff;">${currentItem.word}</h1>
                <p style="font-size: 1.3rem; color: #f1c40f; font-weight: bold; margin-bottom: 20px;">🎯 ${currentItem.meaning}</p>

                ${currentItem.enChunk ? `
                <div style="background: rgba(52, 152, 219, 0.12); border-left: 4px solid #3498db; padding: 12px; border-radius: 6px; margin-bottom: 15px; text-align: left;">
                    <div style="color: #3498db; font-size: 1.1rem; font-weight: bold; line-height: 1.4;">${currentItem.enChunk}</div>
                    <div style="color: #ccc; font-size: 0.9rem; font-style: italic; margin-top: 4px;">(${currentItem.viChunk || ''})</div>
                </div>` : ''}

                <div style="display: flex; gap: 12px; margin-top: 20px;">
                    <button id="v1PlayBtn" style="flex: 1; padding: 14px; background: #3498db; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: 0.2s;" onmouseover="this.style.background='#2980b9'" onmouseout="this.style.background='#3498db'">🔊 PHÁT ÂM</button>
                    <button id="v1NextBtn" style="flex: 1; padding: 14px; background: #2ecc71; color: white; border: none; border-radius: 10px; font-weight: bold; cursor: pointer; font-size: 1rem; transition: 0.2s;" onmouseover="this.style.background='#27ae60'" onmouseout="this.style.background='#2ecc71'">${isLast ? "TỚI HỘI THOẠI 💬" : "TIẾP THEO ⏩"}</button>
                </div>
            </div>
        `;

        const playBtn = document.getElementById("v1PlayBtn");
        playBtn.onclick = () => this.speak(currentItem.word, true);
        setTimeout(() => { if(document.getElementById("v1PlayBtn")) playBtn.click(); }, 300);

        document.getElementById("v1NextBtn").onclick = () => {
            this.currentIndex++;
            this.render();
        };
    },

    // --- KHUNG GIAO DIỆN HỘI THOẠI CÁC TRAINER (VÒNG 3) ---
    async renderConversationCard() {
        // 1. Giới hạn tối đa 6 từ đầu tiên để hội thoại chạy theo hiệp ngắn gọn
        if (this.currentLessonData.length > 6) {
            this.currentLessonData = this.currentLessonData.slice(0, 6);
        }

        // ================= XỬ LÝ KHI HOÀN THÀNH HỌC TỪ VỰNG =================
        if (this.currentIndex >= this.currentLessonData.length) {
            console.log("📘 [VocabularyModule] Đã học xong từ vựng. Đang chuyển sang Trắc nghiệm...");
            this.endLearning();
            return;
        }
        // ====================================================================

        const currentItem = this.currentLessonData[this.currentIndex];
        const mainCard = document.getElementById("mainCard");

        // Danh sách vài chục Trainer đối thủ để random (Lấy sprite chuẩn từ Showdown)
        const trainerList = [
            "blue", "ethan", "lyra", "kris", "brendan", "may", "lucas", "dawn", "hilbert", "hilda", 
            "nate", "rosa", "calem", "serena", "elio", "selene", "chase", "elaine", "victor", "gloria",
            "steven", "cynthia", "alder", "iris", "diantha", "lance", "wallace", "volkner", "flannery",
            "elesa", "skyla", "marlon", "roxie", "giovanni", "cyrus", "ghetsis", "lysandre", "guzma",
            "blue-gen7", "red-gen7", "brock", "misty", "ltsurge", "erika", "koga", "sabrina", "blaine"
        ];
        const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
        const randomTrainer = trainerList[randInt(0, trainerList.length - 1)];

        // ✅ ĐÃ SỬA: Bọc khung chiến trường bằng thẻ div max-width 700px để hiển thị tuyệt đẹp trên PC và ôm sát trên Mobile
        mainCard.innerHTML = `
            <div style="width: 100%; max-width: 700px; display: flex; flex-direction: column; box-sizing: border-box;">

                <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #ffcb05; margin-bottom: 10px; font-weight: bold; padding: 0 4px;">
                    <span>💬 HỘI THOẠI LUYỆN PHẢN XẠ (VÒNG 3/2)</span>
                    <span>HIỆP: ${this.currentIndex + 1}/${this.currentLessonData.length}</span>
                </div>

                <div id="battle-layer" style="position: relative; width: 100%; height: 420px; background: #2c3e50; border: 3px solid #ffcb05; border-radius: 16px; overflow: hidden; margin-bottom: 15px; box-shadow: 0 8px 32px rgba(0,0,0,0.5);">

                    <div id="pokeA" style="position: absolute; transform: translate(-50%, -50%); display: flex; align-items: flex-end; gap: 4px; pointer-events: auto; cursor: pointer; transition: all 0.3s; z-index: 1010;">
                        <img src="https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/versions/generation-v/black-white/animated/25.gif" alt="Pikachu GIF" style="height: 55px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4));" />
                        <img src="https://play.pokemonshowdown.com/sprites/trainers/red.png" alt="Satoshi Red" style="height: 90px; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));" />
                    </div>

                    <div id="pokeB" style="position: absolute; transform: translate(-50%, -50%); display: flex; align-items: flex-end; gap: 4px; pointer-events: auto; cursor: pointer; transition: all 0.3s; z-index: 1010;">
                        <img src="https://play.pokemonshowdown.com/sprites/trainers/${randomTrainer}.png" alt="Rival Trainer" style="height: 90px; object-fit: contain; filter: drop-shadow(0 4px 8px rgba(0,0,0,0.4));" />
                        <img id="enemyPkmGif" src="" alt="Enemy Pokémon GIF" style="height: 55px; filter: drop-shadow(0 2px 6px rgba(0,0,0,0.4)); display: none;" />
                    </div>

                    <div id="wild-container"></div>

                    <div id="bubble-text-A" class="speech-bubble" style="display:none; position: absolute; max-width: 160px; background: #fff; color: #111; border: 2px solid #222; border-radius: 12px; padding: 8px; box-shadow: 0 6px 14px rgba(0,0,0,0.25); z-index: 1020; font-size: 14px; font-weight: 500; word-wrap: break-word;"></div>
                    <div id="bubble-text-B" class="speech-bubble" style="display:none; position: absolute; max-width: 160px; background: #fff; color: #111; border: 2px solid #222; border-radius: 12px; padding: 8px; box-shadow: 0 6px 14px rgba(0,0,0,0.25); z-index: 1020; font-size: 14px; font-weight: 500; word-wrap: break-word;"></div>

                    <div id="bubble-image-B" class="image-bubble" style="display:none; position: absolute; background: #fff; border: 2px solid #222; border-radius: 12px; padding: 6px; box-shadow: 0 6px 14px rgba(0,0,0,0.25); z-index: 1200;"></div>
                </div>

                <div id="battle-status-bar" style="background: #141622; border: 2px solid #ffcb05; padding: 14px; border-radius: 12px; text-align: center; font-weight: bold; color: #ffcb05; font-size: 0.95rem; box-shadow: 0 4px 15px rgba(0,0,0,0.3);">
                    ${this.turnPhase === "ask" ? "👉 ẤN VÀO SATOSHI & PIKACHU (TRÁI) ĐỂ HỎI" : "👉 ẤN VÀO TRAINER ĐỐI THỦ (PHẢI) ĐỂ TRẢ LỜI"}
                </div>
            </div>
        `;

        // 3. Khai báo các hàm tiện ích nội bộ để tính toán vị trí
        const placeSpriteRandom = (el) => {
            el.style.left = randInt(22, 40) + "%";
            if (el.id === "pokeB") el.style.left = randInt(60, 78) + "%"; 
            el.style.top = randInt(55, 75) + "%"; 
        };

        const positionBubbleAbove = (bubble, sprite, offsetY = 85) => {
            bubble.style.left = `${sprite.offsetLeft}px`;
            bubble.style.top = `${sprite.offsetTop - offsetY}px`;
            bubble.style.transform = "translateX(-50%)";
        };

        const hideAllBubbles = () => {
            document.getElementById("bubble-text-A").style.display = "none";
            document.getElementById("bubble-text-B").style.display = "none";
            document.getElementById("bubble-image-B").style.display = "none";
        };

        // 4. Hàm gọi trực tiếp PokéAPI lấy GIF
        const getLivePokemonGifUrl = async () => {
            try {
                const randomId = randInt(1, 649);
                const response = await fetch(`https://pokeapi.co/api/v2/pokemon/${randomId}`);
                const data = await response.json();
                const gifUrl = data.sprites?.versions?.["generation-v"]?.["black-white"]?.animated?.front_default;
                return gifUrl || data.sprites?.front_default || "";
            } catch (err) {
                console.error("Lỗi fetch PokéAPI: ", err);
                return `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/1.png`;
            }
        };

        const A = document.getElementById("pokeA");
        const B = document.getElementById("pokeB");
        const enemyPkmGif = document.getElementById("enemyPkmGif");

        const enemyPkmSrc = await getLivePokemonGifUrl();
        if (enemyPkmSrc) {
            enemyPkmGif.src = enemyPkmSrc;
            enemyPkmGif.style.display = "block";
        }

        placeSpriteRandom(A);
        placeSpriteRandom(B);

        // 5. Render bầy Pokémon hoang dã rải quanh viền
        const wildContainer = document.getElementById("wild-container");
        wildContainer.innerHTML = "";

        for (let i = 0; i < 4; i++) {
            getLivePokemonGifUrl().then(src => {
                if (!src) return;
                const wildImg = document.createElement("img");
                wildImg.src = src;
                wildImg.style.cssText = `position: absolute; height: 42px; opacity: 0.8; transform: translate(-50%, -50%);`;

                const side = randInt(0, 3);
                if (side === 0) { wildImg.style.top = "8%"; wildImg.style.left = `${randInt(10, 90)}%`; }
                else if (side === 1) { wildImg.style.top = "92%"; wildImg.style.left = `${randInt(10, 90)}%`; }
                else if (side === 2) { wildImg.style.left = "8%"; wildImg.style.top = `${randInt(10, 90)}%`; }
                else { wildImg.style.left = "92%"; wildImg.style.top = `${randInt(10, 90)}%`; }

                wildContainer.appendChild(wildImg);
            });
        }

        // 6. Gán sự kiện Click trực tiếp lên khối nhân vật
        A.onclick = async () => {
            if (this.turnPhase !== "ask") return;
            hideAllBubbles();

            const bubbleTextA = document.getElementById("bubble-text-A");
            positionBubbleAbove(bubbleTextA, A);
            bubbleTextA.style.display = "block";

            A.style.transform = "translate(-50%, -50%) scale(1.15)";
            setTimeout(() => A.style.transform = "translate(-50%, -50%) scale(1)", 300);

            if (typeof this.speak === "function") this.speak(currentItem.question, true);

            this.typeText(bubbleTextA, currentItem.question, currentItem.word, () => {
                this.turnPhase = "answer";
                const statusBar = document.getElementById("battle-status-bar");
                statusBar.innerText = "👉 ĐẾN LƯỢT! ẤN VÀO TRAINER ĐỐI THỦ (PHẢI) ĐỂ TRẢ LỜI";
                statusBar.style.color = "#3498db";
                statusBar.style.borderColor = "#3498db";
            });
        };

        B.onclick = async () => {
            if (this.turnPhase !== "answer") return;
            hideAllBubbles();

            const bubbleTextB = document.getElementById("bubble-text-B");
            const bubbleImageB = document.getElementById("bubble-image-B");

            positionBubbleAbove(bubbleTextB, B);
            bubbleTextB.style.display = "block";

            B.style.transform = "translate(-50%, -50%) scale(1.15)";
            setTimeout(() => B.style.transform = "translate(-50%, -50%) scale(1)", 300);

            if (typeof this.speak === "function") this.speak(currentItem.answer, false);

            this.typeText(bubbleTextB, currentItem.answer, currentItem.word, () => {
                let imgUrl = "";
                if (typeof window.getImageFromMap === "function") {
                    imgUrl = window.getImageFromMap(currentItem.word);
                }

                if (imgUrl) {
                    bubbleImageB.innerHTML = `<img src="${imgUrl}" style="width: 50px; height: 50px; object-fit: contain; border-radius: 6px; display: block;" />`;
                    bubbleImageB.style.left = `${B.offsetLeft + 50}px`;
                    bubbleImageB.style.top = `${B.offsetTop - 50}px`;
                    bubbleImageB.style.display = "block";
                }

                setTimeout(() => {
                    hideAllBubbles();
                    this.currentIndex++;
                    this.turnPhase = "ask";
                    this.render();
                }, 2000);
            });
        };
    },

    endLearning() {
        const mainCard = document.getElementById("mainCard");
        if (mainCard) mainCard.style.display = "none";

        console.log("⚔️ Toàn bộ 2 vòng từ vựng và 1 lượt hội thoại hoàn tất! Bắt đầu trận chiến...");

        if (typeof window.startPokemonBattle === "function") {
            window.startPokemonBattle();
        } else {
            const quizOverlay = document.getElementById("quiz-overlay");
            if (quizOverlay) quizOverlay.style.display = "flex";
            if (window.QuizManager && typeof window.QuizManager.ask === "function") {
                window.QuizManager.ask(() => {});
            }
        }
    }
};
