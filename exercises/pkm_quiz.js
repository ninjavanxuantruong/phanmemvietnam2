/**
 * ==========================================
 * POKEMON QUIZ MANAGER - FULL LOGIC (V1.2)
 * 2 Independent Queues: Word & Task
 * ==========================================
 */

window.QuizManager = {
    callback: null,
    correctAnswer: "",
    currentLessonData: [], // Từ vựng bài hiện tại
    poolData: [],          // Từ vựng bài 3011 -> Max (để lấy nhiễu)

    // 2 BỘ ĐẾM ĐỘC LẬP
    wordQueue: [],
    taskQueue: [],

    COLS: {
        LESSON_NAME: 1, WORD: 2, PRESENT_SENT: 8, 
        QUESTION: 9, FINAL_ANS: 11, MEANING: 24
    },

    /**
     * Nạp dữ liệu và xác định giới hạn bài học Max
     */
    async prepareData() {
        const storedData = sessionStorage.getItem('allVocabData');
        const missionData = localStorage.getItem('current_mission');
        if (!storedData || !missionData) return false;

        const allRows = JSON.parse(storedData);
        const missionObj = JSON.parse(missionData);
        const currentLessonId = missionObj.id;

        // 1. Tìm mã bài Max từ bảng phân phối bài học
        let maxLessonCode = 3011;
        try {
            const res = await fetch(window.SHEET_BAI_HOC);
            const sheetRows = await res.json();
            const data = sheetRows.data || sheetRows;
            const codes = data.map(r => parseInt(Object.values(r)[2])).filter(n => !isNaN(n));
            maxLessonCode = Math.max(...codes, 3011);
        } catch (e) { console.warn("Dùng mặc định 3011"); }

        this.currentLessonData = [];
        this.poolData = [];

        allRows.forEach(row => {
            const r = Array.isArray(row) ? row : Object.values(row);
            const lessonId = (r[this.COLS.LESSON_NAME] || "").toString().trim();
            const unitNum = parseInt(lessonId.replace(/\D/g, ""));

            // Trong prepareData, bổ sung thêm fields cho item:
            const item = {
                word: r[this.COLS.WORD] || "",
                meaning: r[this.COLS.MEANING] || "",
                question: r[this.COLS.QUESTION] || "",
                finalAns: r[this.COLS.FINAL_ANS] || "",
                presentSent: r[this.COLS.PRESENT_SENT] || "", // Thêm cho dạng 4, 5, 9
                soundPun: r[this.COLS.SOUND_PUN] || "",       // Thêm cho dạng 7
                punSentence: r[this.COLS.PUN_SENTENCE] || "", // Thêm cho dạng 8
                lessonId: lessonId
            };

            if (item.word) {
                if (lessonId === currentLessonId) this.currentLessonData.push(item);
                if (unitNum >= 3011 && unitNum <= maxLessonCode) this.poolData.push(item);
            }
        });

        // Nạp lần đầu cho cả 2 bộ đếm
        this.refreshWordQueue();
        this.refreshTaskQueue();

        return this.currentLessonData.length > 0;
    },

    /**
     * RESET RIÊNG TỪ VỰNG
     */
    refreshWordQueue() {
        this.wordQueue = [...this.currentLessonData].sort(() => 0.5 - Math.random());
        console.log("🔄 [Queue] Đã làm mới vòng lặp TỪ VỰNG");
    },

    /**
     * RESET RIÊNG DẠNG BÀI
     */
    refreshTaskQueue() {
        this.taskQueue = [1, 2, 3, 4, 5, 6].sort(() => 0.5 - Math.random());
        console.log("🔄 [Queue] Đã nạp vòng lặp 6 dạng bài");
    },

    /**
     * ĐIỀU PHỐI (Bắt cặp 1 từ - 1 dạng)
     */
    async ask(onFinish) {
        this.callback = onFinish;

        if (this.currentLessonData.length === 0) {
            const ok = await this.prepareData();
            if (!ok) return;
        }

        // Kiểm tra độc lập từng hàng đợi
        if (this.wordQueue.length === 0) this.refreshWordQueue();
        if (this.taskQueue.length === 0) this.refreshTaskQueue();

        const target = this.wordQueue.shift();
        const type = this.taskQueue.shift();

        console.log(`🎯 Đang đố: "${target.word}" | Dạng bài: ${type}`);

        const method = `taskType${type}`;
        if (this[method]) {
            await this[method](target);
        } else {
            if (this.callback) this.callback(true);
        }
    },

    // --- HÀM TIỆN ÍCH ---

    async speak(text) {
        return new Promise(resolve => {
            window.speechSynthesis.cancel();
            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = "en-US";
            utter.onend = resolve;
            window.speechSynthesis.speak(utter);
        });
    },

    renderUI(questionText, options, correctValue) {
        this.correctAnswer = correctValue;
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (wordBox) wordBox.innerText = questionText;
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
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.7)';
        }
    },

    handleAnswer(selected, btn) {
        const isCorrect = (selected === this.correctAnswer);
        btn.style.background = isCorrect ? "#2ecc71" : "#e74c3c";
        btn.style.color = "white";

        const allBtns = document.querySelectorAll('.option-btn');
        allBtns.forEach(b => b.style.pointerEvents = 'none');

        setTimeout(() => {
            const overlay = document.getElementById('quiz-overlay');
            if (overlay) overlay.style.display = 'none';
            if (this.callback) this.callback(isCorrect);
        }, 1200);
    },

    // --- LOGIC CHI TIẾT CÁC DẠNG BÀI ---

    /**
     * Dạng 1: Nghĩa của từ (Nhiễu cùng bài)
     */
    /**
     * Dạng 1: Nghĩa của từ
     * Yêu cầu: Đọc hướng dẫn + Đọc từ -> Chọn Nghĩa
     */
    async taskType1(target) {
        const instruction = "What is the meaning of this word?";
        const correctAns = target.meaning;

        // 1. Lấy danh sách nhiễu
        let wrongs = this.currentLessonData
            .map(item => item.meaning)
            .filter(m => m && m !== correctAns);

        if (wrongs.length < 3) {
            const extra = this.poolData.map(i => i.meaning).filter(m => m && m !== correctAns);
            wrongs = [...wrongs, ...extra];
        }

        const finalWrongs = [...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [correctAns, ...finalWrongs].sort(() => 0.5 - Math.random());

        // 2. Hiển thị UI trước khi đọc
        this.renderUI(`${instruction}\n\n"${target.word}"`, options, correctAns);

        // 3. Đọc hướng dẫn và đọc từ mục tiêu
        await this.speak(instruction);
        await this.speak(target.word);
    },

    /**
     * Dạng 2: Đáp án cho câu hỏi
     * Yêu cầu: Đọc hướng dẫn + Đọc câu hỏi -> Chọn Đáp án (Final Ans)
     */
    async taskType2(target) {
        if (!target.question || !target.finalAns) return this.ask(this.callback);

        const instruction = "Answer the question.";
        const correctAns = target.finalAns;

        // 1. Lấy nhiễu từ bài khác
        let wrongs = this.poolData
            .filter(item => item.lessonId !== target.lessonId)
            .map(item => item.finalAns)
            .filter(a => a && a !== correctAns);

        const finalWrongs = [...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [correctAns, ...finalWrongs].sort(() => 0.5 - Math.random());

        // 2. Hiển thị UI
        this.renderUI(`${instruction}\n\nQ: ${target.question}`, options, correctAns);

        // 3. Đọc hướng dẫn và đọc nội dung câu hỏi
        await this.speak(instruction);
        await this.speak(target.question);
    },

    /**
     * Dạng 3: Câu hỏi cho đáp án
     * Yêu cầu: Đọc hướng dẫn + Đọc đáp án -> Chọn Câu hỏi (Question)
     */
    async taskType3(target) {
        if (!target.question || !target.finalAns) return this.ask(this.callback);

        const instruction = "Choose the correct question for this answer.";
        const correctAns = target.question;

        // 1. Lấy nhiễu từ bài khác
        let wrongs = this.poolData
            .filter(item => item.lessonId !== target.lessonId)
            .map(item => item.question)
            .filter(q => q && q !== correctAns);

        const finalWrongs = [...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [correctAns, ...finalWrongs].sort(() => 0.5 - Math.random());

        // 2. Hiển thị UI
        this.renderUI(`${instruction}\n\nAns: ${target.finalAns}`, options, correctAns);

        // 3. Đọc hướng dẫn và đọc nội dung đáp án
        await this.speak(instruction);
        await this.speak(target.finalAns);
    },
    /**
     * Dạng 4: Nghe và điền từ vào câu (Dùng Cột I và Cột C)
     */
    async taskType4(target) {
        if (!target.presentSent) return this.ask(this.callback);

        const instruction = "Listen and complete the sentence.";
        const correctAns = target.word;

        // Tạo câu hỏi có dấu gạch dưới
        const displaySent = target.presentSent.replace(new RegExp(correctAns, 'gi'), "_______");

        let wrongs = this.poolData
            .map(item => item.word)
            .filter(w => w && w.toLowerCase() !== correctAns.toLowerCase());

        const opts = [correctAns, ...[...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3)].sort(() => 0.5 - Math.random());

        this.renderUI(`${instruction}\n\n"${displaySent}"`, opts, correctAns);

        await this.speak(instruction);
        await this.speak(target.presentSent); // Đọc cả câu đầy đủ để người dùng nghe từ còn thiếu
    },

    /**
     * Dạng 5: Nghe và chọn câu chính xác (Dùng Cột I)
     */
    async taskType5(target) {
        if (!target.presentSent) return this.ask(this.callback);

        const instruction = "Listen and choose the correct sentence.";
        const correctAns = target.presentSent;

        let wrongs = this.poolData
            .filter(item => item.lessonId !== target.lessonId)
            .map(item => item.presentSent)
            .filter(s => s && s !== correctAns);

        const opts = [correctAns, ...[...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3)].sort(() => 0.5 - Math.random());

        // Hiển thị biểu tượng loa để ép người dùng phải nghe
        this.renderUI(`${instruction}\n\n🔊 Press to listen again`, opts, correctAns);

        await this.speak(instruction);
        await this.speak(target.presentSent);
    },

    /**
    /**
    /**
     * Dạng 6: Luyện nói (Speaking Mode)
     * Sửa lỗi: Hiện UI trước, đọc sau, bấm bóng mới nghe.
     */
    async taskType6(target) {
        // 1. Xác định nội dung cần nói
        const possibleTexts = [target.presentSent, target.question, target.finalAns].filter(t => t && t.length > 0);
        const textToSay = (possibleTexts.length > 0) 
            ? possibleTexts[Math.floor(Math.random() * possibleTexts.length)] 
            : target.word;

        const instruction = "Read this out loud!";

        // 2. Render giao diện ngay lập tức (Xóa bỏ trạng thái đơ)
        this.renderUI_Speaking(instruction, textToSay);

        // 3. Đọc hướng dẫn và câu đố (Không chặn luồng UI)
        this.speak(instruction).then(() => {
            this.speak(textToSay);
        });
    },

    /**
     * Hàm render riêng cho Speaking để nhúng CSS và PokéBall
     */
    renderUI_Speaking(instruction, textToSay) {
        this.correctAnswer = textToSay;
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.backgroundColor = 'rgba(0, 0, 0, 0.9)'; // Nền tối để nổi bật quả bóng
        }

        if (wordBox) {
            // ĐÃ XÓA dòng hiển thị "${textToSay}" ở đây
            wordBox.innerHTML = `
                <div style="font-family: sans-serif; text-align: center; padding: 10px;">
                    <div style="font-size: 18px; color: #aaa; margin-bottom: 10px;">${instruction}</div>
                    <div style="font-size: 14px; color: #ffeb3b;">(Listen to the sound and repeat)</div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div id="speechResult" style="color: #fff; margin-bottom: 20px; font-size: 16px; min-height: 40px; text-align: center;">
                    Tap the PokéBall and Start Speaking
                </div>

                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px;">
                    <button id="btn-mic-ball" style="background: none; border: none; cursor: pointer; transition: transform 0.2s;">
                        <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" 
                             alt="PokéBall" style="width: 120px; filter: drop-shadow(0 0 10px #fff);" />
                    </button>

                    <button id="btn-listen-again" style="background: #444; color: white; border: none; padding: 8px 20px; border-radius: 20px; cursor: pointer;">
                        🔊 Listen Again
                    </button>
                </div>
            `;

            // Gán sự kiện cho các nút vừa tạo
            const micBtn = document.getElementById('btn-mic-ball');
            const resultDiv = document.getElementById('speechResult');

            document.getElementById('btn-listen-again').onclick = () => this.speak(textToSay);

            micBtn.onclick = () => {
                this.startListeningLogic(textToSay, micBtn, resultDiv);
            };
        }
    },

    /**
     * Logic nhận diện giọng nói khi nhấn bóng
     */
    startListeningLogic(targetText, micBtn, resultDiv) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            resultDiv.innerText = "❌ Browser not supported!";
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";

        // Hiệu ứng khi đang nghe
        micBtn.style.transform = "scale(1.2) rotate(20deg)";
        resultDiv.innerHTML = "<span style='color: #00e5ff;'>⚡ Pokémon is listening...</span>";

        recognition.start();

        recognition.onresult = (event) => {
            micBtn.style.transform = "scale(1)";
            const transcript = event.results[0][0].transcript;
            const accuracy = this.checkAccuracy(transcript, targetText);
            const isPass = accuracy >= 50;

            resultDiv.innerHTML = `
                <div style="font-size: 14px; color: #ccc;">"I heard: ${transcript}"</div>
                <div style="font-size: 20px; color: ${isPass ? '#2ecc71' : '#e74c3c'}; font-weight: bold;">
                    ${isPass ? '✨ GOTCHA!' : '💨 ESCAPED!'} (${accuracy}%)
                </div>
            `;

            setTimeout(() => {
                document.getElementById('quiz-overlay').style.display = 'none';
                if (this.callback) this.callback(isPass);
            }, 2000);
        };

        recognition.onerror = (err) => {
            micBtn.style.transform = "scale(1)";
            resultDiv.innerHTML = `<span style="color: #ff5252;">❌ Error: ${err.error}</span>`;
        };
    },

    checkAccuracy(userText, targetText) {
        const clean = (str) => str.toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/);
        const userWords = clean(userText);
        const targetWords = clean(targetText);
        let correct = 0;
        targetWords.forEach(word => {
            if (userWords.includes(word)) correct++;
        });
        return Math.round((correct / targetWords.length) * 100);
    }
};

