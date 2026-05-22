/**
 * =======================================================
 * POKEMON VOCABULARY LEARNING MODULE - 2 ROUNDS VERSION
 * =======================================================
 */

window.VocabularyModule = {
    currentLessonData: [],
    currentIndex: 0,
    currentRound: 1, // Vòng học hiện tại (1 hoặc 2)

    // Khớp chính xác chỉ số cột dữ liệu của bạn
    COLS: {
        LESSON_NAME: 1, WORD: 2, PHRASE_EN: 3, PHRASE_VI: 4,
        PRESENT_SENT: 8, QUESTION: 9, KEYWORD_FIX: 10, FINAL_ANS: 11,
        MEANING: 24, SOUND_PUN: 25, PUN_SENTENCE: 26,
    },

    // Hàm bốc dữ liệu từ sessionStorage giống cấu trúc Quiz
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
                    // Tách âm / Phân đoạn cụm từ ngắn
                    enChunk: (r[this.COLS.PHRASE_EN] || "").toString().trim(),
                    viChunk: (r[this.COLS.PHRASE_VI] || "").toString().trim(),
                    // Chuyển sang lấy Câu hỏi & Câu trả lời hoàn chỉnh
                    question: (r[this.COLS.QUESTION] || "").toString().trim(),
                    answer: (r[this.COLS.FINAL_ANS] || "").toString().trim(),
                });
            }
        });
        this.currentLessonData = listVocabs;
        return listVocabs;
    },

    // Khởi động Module học từ vựng
    async start() {
        const data = await this.fetchAllVocabData();

        if (!data || data.length === 0) {
            console.log("⏩ Không có dữ liệu từ vựng, vào thẳng trận đấu.");
            this.endLearning();
            return;
        }

        this.currentIndex = 0;
        this.currentRound = 1; // Bắt đầu từ vòng 1

        let mainCard = document.getElementById("mainCard");
        if (!mainCard) {
            mainCard = document.createElement("div");
            mainCard.id = "mainCard";
            document.body.appendChild(mainCard);
        }

        // Giao diện CSS bao phủ trung tâm cực đẹp
        mainCard.style = `
            position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%);
            background: rgba(15, 15, 25, 0.98); padding: 25px; border-radius: 20px;
            max-width: 480px; width: 92%; border: 4px solid #ffcb05; color: white;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; text-align: center; z-index: 99999;
            box-shadow: 0 0 30px rgba(0,0,0,0.9); display: block; box-sizing: border-box;
        `;

        this.render();
    },

    // Vẽ giao diện chi tiết từng từ
    render() {
        // Kiểm tra nếu đã đi hết danh sách từ của vòng hiện tại
        if (this.currentIndex >= this.currentLessonData.length) {
            if (this.currentRound === 1) {
                // Chuyển sang vòng số 2
                this.currentRound = 2;
                this.currentIndex = 0;
                alert("🌟 Chúc mừng bạn đã hoàn thành Vòng 1! Hãy ôn tập lại nhanh ở Vòng 2 trước khi xung trận!");
            } else {
                // Đã xong cả 2 vòng
                this.endLearning();
                return;
            }
        }

        const currentItem = this.currentLessonData[this.currentIndex];
        const mainCard = document.getElementById("mainCard");
        if (!mainCard) return;

        // Xử lý tạo link ảnh minh họa (Ưu tiên ảnh từ QuizManager nếu có, hoặc tạo ảnh từ Unsplash sạch sẽ)
        let imgUrl = `https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&q=80`; // Ảnh mặc định học tập
        if (currentItem.word) {
            imgUrl = `https://source.unsplash.com/400x250/?${encodeURIComponent(currentItem.word)}`;
            // Nếu bạn có hàm bốc ảnh riêng trong QuizManager, hãy thay thế bằng dòng dưới:
            // if (window.QuizManager && typeof window.QuizManager.getImage === 'function') imgUrl = window.QuizManager.getImage(currentItem.word);
        }

        // Định dạng nút bấm theo tiến độ vòng chơi
        const isLastWordOfRound2 = (this.currentRound === 2 && this.currentIndex === this.currentLessonData.length - 1);
        const nextBtnText = isLastWordOfRound2 ? "VÀO CHIẾN ĐẤU ⚔️" : "TIẾP THEO ⏩";
        const nextBtnBg = isLastWordOfRound2 ? "#e74c3c" : "#2ecc71";

        mainCard.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.9rem; font-weight: bold; color: #ffcb05; margin-bottom: 15px; border-bottom: 1px solid #333; padding-bottom: 8px;">
                <span>📖 LƯỢT HỌC: <span style="background:#ffcb05; color:#000; padding:2px 8px; border-radius:10px;">VÒNG ${this.currentRound}/2</span></span>
                <span>TỪ: ${this.currentIndex + 1}/${this.currentLessonData.length}</span>
            </div>

            <div style="width: 100%; height: 160px; border-radius: 12px; overflow: hidden; margin-bottom: 15px; border: 2px solid #444; background: #000;">
                <img src="${imgUrl}" alt="vocab-img" style="width: 100%; height: 100%; object-fit: cover;" onerror="this.src='https://images.unsplash.com/photo-1546410531-bb4caa6b424d?w=400&q=80'">
            </div>

            <div style="margin-bottom: 15px;">
                <h1 style="font-size: 2.6rem; color: #fff; margin: 5px 0; text-shadow: 0 2px 4px rgba(0,0,0,0.6); letter-spacing: 1px;">${currentItem.word}</h1>
                <p style="font-size: 1.25rem; color: #f1c40f; font-weight: bold; margin: 5px 0;">🎯 ${currentItem.meaning}</p>
            </div>

            ${currentItem.enChunk ? `
            <div style="background: rgba(255, 255, 255, 0.04); border-left: 4px solid #3498db; padding: 10px; border-radius: 4px; margin-bottom: 12px; text-align: left;">
                <div style="color: #3498db; font-size: 1.1rem; font-weight: bold; font-family: monospace; letter-spacing: 0.5px;">${currentItem.enChunk}</div>
                <div style="color: #bbb; font-size: 0.9rem; margin-top: 4px; font-style: italic;">(${currentItem.viChunk || ''})</div>
            </div>
            ` : ''}

            ${currentItem.question ? `
            <div style="background: rgba(46, 204, 113, 0.05); border: 1px dashed #2ecc71; padding: 10px; border-radius: 8px; margin-bottom: 20px; text-align: left;">
                <div style="font-size: 0.85rem; color: #2ecc71; font-weight: bold; margin-bottom: 2px;">❓ CÂU HỎI TRẬN ĐẤU:</div>
                <div style="color: #fff; font-size: 0.95rem; margin-bottom: 6px;">${currentItem.question}</div>
                <div style="font-size: 0.85rem; color: #e67e22; font-weight: bold; margin-bottom: 2px;">🔑 ĐÁP ÁN:</div>
                <div style="color: #e67e22; font-size: 1rem; font-weight: bold;">${currentItem.answer}</div>
            </div>
            ` : ''}

            <div style="display: flex; gap: 12px;">
                <button id="v1PlayBtn" style="flex: 1; padding: 12px; background: #3498db; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 0 #2980b9; transition: 0.1s;">🔊 PHÁT ÂM</button>
                <button id="v1NextBtn" style="flex: 1; padding: 12px; background: ${nextBtnBg}; color: white; border: none; border-radius: 8px; font-weight: bold; font-size: 0.95rem; cursor: pointer; box-shadow: 0 4px 0 rgba(0,0,0,0.2); transition: 0.1s;">${nextBtnText}</button>
            </div>
        `;

        // Logic xử lý phát thanh âm thanh bằng giọng đọc AI
        const playBtn = document.getElementById("v1PlayBtn");
        playBtn.onclick = () => {
            if (window.QuizManager && typeof window.QuizManager.speak === "function") {
                window.QuizManager.speak(currentItem.word);
            } else {
                window.speechSynthesis.cancel();
                const utter = new SpeechSynthesisUtterance(currentItem.word);
                utter.lang = "en-US";
                utter.rate = 0.85; // Đọc chậm một chút cho học sinh dễ nghe tách âm
                window.speechSynthesis.speak(utter);
            }
        };

        // Tự động phát âm ngay khi xuất hiện từ mới để tạo phản xạ nghe
        setTimeout(() => {
            if(document.getElementById("v1PlayBtn")) playBtn.click();
        }, 300);

        // Sự kiện click chuyển từ tiếp theo hoặc kết thúc học
        document.getElementById("v1NextBtn").onclick = () => {
            this.currentIndex++;
            this.render();
        };
    },

    // Kết thúc khóa học từ vựng, dọn dẹp UI và kích hoạt trận đấu Pokémon
    endLearning() {
        const mainCard = document.getElementById("mainCard");
        if (mainCard) mainCard.style.display = "none";

        console.log("⚔️ Đã hoàn thành xuất sắc 2 vòng học từ vựng! Kích hoạt trận đấu Pokémon...");

        if (typeof window.startPokemonBattle === "function") {
            window.startPokemonBattle();
        } else {
            // Dự phòng nếu luồng pkm_battle.js gặp sự cố bất ngờ
            const quizOverlay = document.getElementById("quiz-overlay");
            if (quizOverlay) quizOverlay.style.display = "flex";
            if (window.QuizManager && typeof window.QuizManager.ask === "function") {
                window.QuizManager.ask(() => {});
            }
        }
    }
};
