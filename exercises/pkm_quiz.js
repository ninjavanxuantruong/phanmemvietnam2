/**
 * ==========================================
 * POKEMON QUIZ MANAGER - FULL DATA & MCQ LOGIC
 * ==========================================
 */

window.QuizManager = {
    callback: null,
    correctAnswer: "",
    currentLessonData: [], // Chứa full object dữ liệu từng hàng

    // Cấu hình các cột index (JS đếm từ 0)
    COLS: {
        LESSON_NAME: 1,   // Cột B
        WORD: 2,          // Cột C (CÂU HỎI)
        DRILL_PHRASE: 3,  // Cột D
        DRILL_ANSWER: 4,  // Cột E
        SUB_TOPIC: 5,     // Cột F
        MAIN_TOPIC: 6,    // Cột G
        PRESENT_SENT: 8,  // Cột I
        QUESTION: 9,      // Cột J
        SUGGEST_ANS: 10,  // Cột K
        FINAL_ANS: 11,    // Cột L
        MEANING: 24,      // Cột Y (NGHĨA)
        SOUND_PUN: 33,    // Cột AH
        PUN_SENTENCE: 34  // Cột AI
    },

    /**
     * Lấy toàn bộ các cột dữ liệu dựa trên bài học hiện tại
     */
    prepareData() {
        const storedData = sessionStorage.getItem('allVocabData');
        const missionData = localStorage.getItem('current_mission');

        if (!storedData || !missionData) {
            console.error("❌ [Quiz] Thiếu allVocabData hoặc current_mission!");
            return false;
        }

        try {
            const missionObj = JSON.parse(missionData);
            const targetLesson = missionObj.id; // Lấy ID bài học (VD: "5-02-2 Our homes")
            const allRows = JSON.parse(storedData);

            // LỌC: Lấy các hàng thuộc bài học này và map đầy đủ các cột
            this.currentLessonData = allRows.filter(row => {
                const r = Array.isArray(row) ? row : Object.values(row);
                return r[this.COLS.LESSON_NAME]?.toString().trim() === targetLesson.trim();
            }).map(row => {
                const r = Array.isArray(row) ? row : Object.values(row);
                return {
                    lesson: r[this.COLS.LESSON_NAME] || "",
                    word: r[this.COLS.WORD] || "",           // Cột 2
                    drillPhrase: r[this.COLS.DRILL_PHRASE] || "",
                    drillAnswer: r[this.COLS.DRILL_ANSWER] || "",
                    subTopic: r[this.COLS.SUB_TOPIC] || "",
                    mainTopic: r[this.COLS.MAIN_TOPIC] || "",
                    presentSent: r[this.COLS.PRESENT_SENT] || "",
                    question: r[this.COLS.QUESTION] || "",
                    suggestAns: r[this.COLS.SUGGEST_ANS] || "",
                    finalAns: r[this.COLS.FINAL_ANS] || "",
                    meaning: r[this.COLS.MEANING] || "",     // Cột 24
                    soundPun: r[this.COLS.SOUND_PUN] || "",
                    punSentence: r[this.COLS.PUN_SENTENCE] || ""
                };
            }).filter(item => item.word !== "" && item.meaning !== ""); 

            console.log(`✅ [Quiz] Đã nạp FULL dữ liệu ${this.currentLessonData.length} từ bài [${targetLesson}]`);
            return this.currentLessonData.length > 0;

        } catch (e) {
            console.error("❌ [Quiz] Lỗi chuẩn bị dữ liệu:", e);
            return false;
        }
    },

    /**
     * Logic Trắc nghiệm: Từ (Cột 2) -> Nghĩa (Cột 24)
     */
    async ask(onFinish) {
        this.callback = onFinish;

        if (this.currentLessonData.length === 0) {
            if (!this.prepareData()) return;
        }

        // 1. Chọn ngẫu nhiên hàng mục tiêu làm câu hỏi
        const targetIndex = Math.floor(Math.random() * this.currentLessonData.length);
        const target = this.currentLessonData[targetIndex];

        // LOGIC CHỐT: Câu hỏi là Word (Cột 2), Đáp án đúng là Meaning (Cột 24)
        const displayQuestion = target.word; 
        this.correctAnswer = target.meaning;

        // 2. Tạo danh sách đáp án nhiễu (Wrongs)
        // Lấy nghĩa (Cột 24) của tất cả các từ khác TRONG CÙNG BÀI HỌC
        let otherMeanings = this.currentLessonData
            .filter((_, idx) => idx !== targetIndex)
            .map(item => item.meaning);

        // Lấy ngẫu nhiên 3 nghĩa sai (không trùng lặp)
        let wrongs = [...new Set(otherMeanings)]
            .sort(() => 0.5 - Math.random())
            .slice(0, 3);

        // 3. Gộp và trộn ngẫu nhiên 4 đáp án
        let options = [this.correctAnswer, ...wrongs].sort(() => 0.5 - Math.random());

        // 4. Hiển thị UI
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (wordBox) wordBox.innerText = displayQuestion;
        if (optionsBox) {
            optionsBox.innerHTML = "";
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.innerText = opt;
                btn.onclick = () => this.handleAnswer(opt, btn);
                optionsBox.appendChild(btn);
            });
        }

        if (overlay) {
            overlay.style.display = 'flex';
            // Sửa điểm 1: Chỉnh nền trong suốt thay vì đen xì
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.6)'; 
        }
        console.log("📖 Đang đố từ:", displayQuestion, "->", this.correctAnswer);
    },

    /**
     * Xử lý click chọn đáp án
     */
    handleAnswer(selected, btn) {
        const isCorrect = (selected === this.correctAnswer);

        // Hiệu ứng nút
        btn.style.background = isCorrect ? "#2ecc71" : "#e74c3c";
        btn.style.color = "white";

        // Khóa các nút
        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');

        // Hiện đáp án đúng nếu chọn sai
        if (!isCorrect) {
            allBtns.forEach(b => {
                if (b.innerText === this.correctAnswer) b.style.border = "3px solid #2ecc71";
            });
        }

        // Sửa điểm 2: Xử lý delay để ẩn hẳn pop-up rồi mới báo kết quả ra chiêu
        setTimeout(() => {
            const overlay = document.getElementById('quiz-overlay');
            if (overlay) overlay.style.display = 'none';

            // Đợi thêm một khoảng ngắn để hiệu ứng ẩn hoàn tất trước khi Pokemon ra chiêu
            setTimeout(() => {
                if (this.callback) this.callback(isCorrect);
            }, 3000); // 300ms là đủ để mắt người thấy Pop-up đã biến mất hẳn
        }, 1000); // Giữ kết quả đúng/sai trong 1 giây để người dùng kịp nhìn
    }
};