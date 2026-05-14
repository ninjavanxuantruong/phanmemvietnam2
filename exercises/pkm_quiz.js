/**
 * ==========================================
 * POKEMON QUIZ MANAGER - FULL LOGIC (V1.2)
 * 2 Independent Queues: Word & Task
 * ==========================================
 */
// Thêm chuỗi thời gian ngẫu nhiên để trình duyệt buộc phải tải lại file mới nhất từ server
import imageCache from "./imagecache2.js?update=now";
window.QuizManager = {
    callback: null,
    correctAnswer: "",
    currentLessonData: [],
    poolData: [],
    wordQueue: [],
    taskQueue: [],
    timer: null,
    userInteracted: false, // ✅ Cần thiết cho màn hình Ready

    // Cập nhật vị trí cột (Giả sử cột 25, 26 - bạn chỉnh lại số nếu khác)
    COLS: {
        LESSON_NAME: 1, 
        WORD: 2, 
        PHRASE_EN: 3,  // Cột D: Cụm tiếng Anh
        PHRASE_VI: 4,  // Cột E: Cụm tiếng Việt
        PRESENT_SENT: 8, 
        QUESTION: 9,
        KEYWORD_FIX: 10,
        FINAL_ANS: 11, 
        MEANING: 24,
        SOUND_PUN: 25, 
        PUN_SENTENCE: 26 
    },
    /**
     * Hàm dùng chung để xử lý phản hồi Đúng/Sai
     * @param {boolean} isCorrect - Kết quả người dùng
     * @param {string} correctValue - Đáp án đúng để hiển thị nếu làm sai
     */
    showFeedback(isCorrect, correctValue) {
        const allBtns = document.querySelectorAll('.option-btn');
        const inputEl = document.getElementById('writing-input');
        const wordBox = document.getElementById('quiz-word');
        const overlay = document.getElementById('quiz-overlay'); // Thêm dòng này

        if (!isCorrect) {
            if (wordBox) {
                // Sếp giữ nguyên logic tạo feedbackDiv nhưng thêm background mờ nhẹ để dễ đọc chữ
                const feedbackDiv = document.createElement('div');
                feedbackDiv.style = "color: #e74c3c; margin-top: 15px; font-weight: bold; background: rgba(255,255,255,0.9); padding: 10px; border-radius: 10px; animation: shake 0.5s; border: 2px solid #e74c3c;";
                feedbackDiv.innerHTML = `❌ Correct: <span style="color: #2ecc71">${correctValue}</span>`;
                wordBox.appendChild(feedbackDiv);
            }
        }

        allBtns.forEach(b => b.style.pointerEvents = 'none');
        if (inputEl) inputEl.disabled = true;

        setTimeout(() => {
            if (overlay) {
                overlay.style.display = 'none';
                overlay.style.backgroundColor = 'transparent'; // Đảm bảo reset về trong suốt
            }
            if (this.callback) this.callback(isCorrect);
        }, 2000);
    },

    /**
     * Khởi động bộ đếm ngược 15 giây
     */
    startAutoSkipTimer() {
        this.stopTimer();
        this.timer = setTimeout(() => {
            console.log("⏰ [Timer] Đã hết 15s, tự động bỏ qua.");
            this.handleSkip();
        }, 15000);
    },

    stopTimer() {
        if (this.timer) {
            clearTimeout(this.timer);
            this.timer = null;
        }
    },
    // 3. Hàm bắt đầu đếm giờ (Đây là hàm sếp đang thiếu)
    startTimer(customDuration) {
        this.stopTimer(); // Xóa cái cũ trước khi tạo cái mới
        const duration = customDuration || this.timerDuration;

        console.log(`Bắt đầu đếm ngược: ${duration / 1000}s`);

        this.timer = setTimeout(() => {
            console.log("Hết giờ!");
            this.handleSkip(); // Tự động bỏ qua khi hết thời gian
        }, duration);
    },

    handleSkip() {
        this.stopTimer();
        window.speechSynthesis.cancel();
        const overlay = document.getElementById('quiz-overlay');
        if (overlay) overlay.style.display = 'none';
        if (this.callback) this.callback(false);
    },

    async isMicrophoneAvailable() {
        try {
            const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
            if (!SpeechRecognition) return false;
            const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
            stream.getTracks().forEach(track => track.stop());
            return true;
        } catch (err) {
            console.warn("🎙️ Micro không khả dụng:", err.name);
            return false;
        }
    },

    showReadyScreen(onConfirm) {
        const overlay = document.createElement('div');
        overlay.id = 'ready-overlay';
        // Đổi background từ rgba(0,0,0,0.95) sang 0.7 hoặc 0.8 để vẫn thấy mờ mờ phía sau
        overlay.style = `position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.7); display: flex; align-items: center; justify-content: center; z-index: 10000; color: white; text-align: center; backdrop-filter: blur(4px);`;
        overlay.innerHTML = `
            <div style="background: #222; padding: 30px; border-radius: 20px; border: 2px solid #444; width: 80%; max-width: 300px;">
                <img src="https://cdn-icons-png.flaticon.com/512/188/188940.png" style="width: 80px; margin-bottom: 20px;">
                <h2 style="margin-bottom: 10px;">Are you ready?</h2>
                <button id="btn-ready-ok" style="background: #2ecc71; color: white; border: none; padding: 12px 40px; border-radius: 25px; font-size: 18px; font-weight: bold; cursor: pointer; width: 100%;">OK!</button>
            </div>`;
        document.body.appendChild(overlay);
        document.getElementById('btn-ready-ok').onclick = async () => {
            await this.speak(""); // Mồi âm thanh
            overlay.remove();
            if (onConfirm) onConfirm();
        };
    },
    // Thêm hàm này vào trong QuizManager của sếp
    ensureDot(text) {
        if (!text) return "";
        text = text.trim();
        // Nếu kết thúc không phải là dấu chấm, dấu hỏi hoặc dấu chấm than thì thêm dấu chấm
        if (!/[.!?]$/.test(text)) {
            return text + ".";
        }
        return text;
    },

    async refreshTaskQueue() {
        let tasks = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20];
        const micOk = await this.isMicrophoneAvailable();
        if (!micOk) tasks = tasks.filter(t => t !== 6);
        this.taskQueue = tasks.sort(() => 0.5 - Math.random());
    },
    normalize(text) {
        if (!text) return "";
        return text.toString()
            .toLowerCase()
            .trim()
            .replace(/[.,!?;:]/g, "") // Bỏ các dấu câu để so sánh cho chuẩn
            .replace(/\s+/g, " ");    // Khoảng trắng thừa thành 1 khoảng trắng
    },

    // Thêm hàm bổ trợ này vào trong đối tượng QuizManager
    normalizeUnitId(unitStr) {
        if (!unitStr) return 0;
        // Xử lý cả dạng MS3011 hoặc 3-11-1
        if (unitStr.includes('-')) {
            const parts = unitStr.split("-");
            if (parts.length < 3) return 0;
            const [cls, lesson, part] = parts;
            return parseInt(cls) * 1000 + parseInt(lesson) * 10 + parseInt(part);
        }
        // Nếu là dạng MS3011 thì chỉ lấy số
        return parseInt(unitStr.replace(/\D/g, ""));
    },

    async getMaxLessonCodeFromServer() {
        const trainerClass = localStorage.getItem("trainerClass")?.trim() || "";
        // Biến SHEET_BAI_HOC lấy từ window.SHEET_BAI_HOC đã định nghĩa ở global
        const sheetUrl = window.SHEET_BAI_HOC; 

        try {
            console.log(`[MaxSearch] Đang fetch dữ liệu cho lớp: ${trainerClass}`);
            const res = await fetch(sheetUrl);
            const rows = await res.json();

            const baiList = rows
                .map(r => {
                    const lop = (r[0] || "").toString().trim(); // Cột A
                    const bai = (r[2] || "").toString().trim(); // Cột C (giả định đây là mã ID bài)
                    return (lop === trainerClass && bai) ? this.normalizeUnitId(bai) : null;
                })
                .filter(v => typeof v === "number" && !isNaN(v) && v > 0);

            if (baiList.length === 0) return null;
            return Math.max(...baiList);
        } catch (err) {
            console.error("❌ Lỗi lấy maxLessonCode từ server:", err);
            return null;
        }
    },

    async prepareData() {
        const storedData = sessionStorage.getItem('allVocabData');
        const missionData = localStorage.getItem('current_mission');
        if (!storedData || !missionData) return false;

        const allRows = JSON.parse(storedData);
        const missionObj = JSON.parse(missionData);
        const currentLessonId = missionObj.id;

        // 1. Tính toán Max Lesson Code động
        const currentUnitNum = this.normalizeUnitId(currentLessonId);
        let serverMax = await this.getMaxLessonCodeFromServer();

        // Đối chiếu: cái nào lớn hơn thì lấy làm max
        let finalMax = Math.max(serverMax || 0, currentUnitNum);
        let minLessonCode = 2011; // Sếp chốt min là 2011

        console.log(`[MaxSearch] Min: ${minLessonCode} | Max Server: ${serverMax} | Bài hiện tại: ${currentUnitNum}`);
        console.log(`[MaxSearch] CHỐT MAX CUỐI CÙNG: ${finalMax}`);

        this.currentLessonData = [];
        this.poolData = [];

        allRows.forEach(row => {
            const r = Array.isArray(row) ? row : Object.values(row);
            const lessonId = (r[this.COLS.LESSON_NAME] || "").toString().trim();
            const unitNum = this.normalizeUnitId(lessonId);

            const item = {
                word: r[this.COLS.WORD] || "",
                meaning: r[this.COLS.MEANING] || "",
                colD: r[this.COLS.PHRASE_EN] || "", 
                colE: r[this.COLS.PHRASE_VI] || "",
                question: r[this.COLS.QUESTION] || "",
                keywordFix: r[this.COLS.KEYWORD_FIX] || "",
                finalAns: r[this.COLS.FINAL_ANS] || "",
                presentSent: r[this.COLS.PRESENT_SENT] || "",
                soundPun: r[this.COLS.SOUND_PUN] || "",
                punSentence: r[this.COLS.PUN_SENTENCE] || "",
                lessonId: lessonId
            };

            if (item.word) {
                // Lọc bài hiện tại
                if (lessonId === currentLessonId) {
                    this.currentLessonData.push(item);
                }
                // Lọc kho pool nhiễu theo dải [2011 -> finalMax]
                if (unitNum >= minLessonCode && unitNum <= finalMax) {
                    this.poolData.push(item);
                }
            }
        });

        console.log(`[DataReady] Pool size: ${this.poolData.length} câu nhiễu.`);
        this.refreshWordQueue();
        await this.refreshTaskQueue();
        return this.currentLessonData.length > 0;
    },

    refreshWordQueue() {
        this.wordQueue = [...this.currentLessonData].sort(() => 0.5 - Math.random());
    },

    async ask(onFinish) {
        this.callback = onFinish;
        if (this.currentLessonData.length === 0) {
            const ok = await this.prepareData();
            if (!ok) return;
        }

        if (!this.userInteracted) {
            this.showReadyScreen(() => {
                this.userInteracted = true;
                this.executeAsk();
            });
        } else {
            this.executeAsk();
        }
    },

    async executeAsk() {
        if (this.wordQueue.length === 0) this.refreshWordQueue();
        if (this.taskQueue.length === 0) await this.refreshTaskQueue();

        // ✅ ÉP TRONG SUỐT TRƯỚC KHI GỌI TASK
        const overlay = document.getElementById('quiz-overlay');
        if (overlay) {
            overlay.style.backgroundColor = 'transparent'; 
            overlay.style.backdropFilter = 'none'; // Bỏ mờ kính nếu có
        }

        const target = this.wordQueue.shift();
        const type = this.taskQueue.shift();
        // ... (Giữ nguyên logic target/candidates của sếp bên dưới)
        let actualTarget = target;
        if (Math.random() < 0.3 && this.poolData.length >= 3) {
            const candidates = this.poolData
                .filter(item => item.lessonId !== target.lessonId && item.word)
                .sort(() => 0.5 - Math.random())
                .slice(0, 3);
            if (candidates.length > 0) {
                actualTarget = candidates[Math.floor(Math.random() * candidates.length)];
            }
        }

        const method = `taskType${type}`;
        console.group("%c[PKM QUIZ RUNNING]", "color: #ffcb05; background: #3b4cca; padding: 2px 5px; border-radius: 3px;");
        console.log("%cDạng bài: %c" + method, "color: #555;", "color: #ff0000; font-weight: bold;");
        console.log("%cTừ mục tiêu: %c" + (actualTarget.word || "Không có từ"), "color: #555;", "color: #008000; font-weight: bold;");
        
        if (this[method]) {
            await this[method](actualTarget);
        } else {
            if (this.callback) this.callback(true);
        }
    },

    /**
     * Hàm phát âm thanh
     * @param {string} text - Văn bản cần đọc
     * @param {number} rate - Tốc độ đọc (1.0 là bình thường, 0.5 là chậm 50%)
     */
    async speak(text, rate = 1.0) {
        return new Promise(resolve => {
            // Hủy các yêu cầu đọc trước đó để tránh bị chồng chéo âm thanh
            window.speechSynthesis.cancel();

            if (!text) {
                resolve();
                return;
            }

            const utter = new SpeechSynthesisUtterance(text);
            utter.lang = "en-US";
            utter.rate = rate; // ✅ Thiết lập tốc độ đọc linh hoạt

            // Khi đọc xong thì mới giải quyết Promise (để dùng await)
            utter.onend = () => {
                resolve();
            };

            // Xử lý lỗi nếu có (ví dụ trình duyệt chặn âm thanh)
            utter.onerror = (err) => {
                console.error("SpeechSynthesis Error:", err);
                resolve();
            };

            window.speechSynthesis.speak(utter);
        });
    },

    renderUI(questionText, options, correctValue) {
        this.stopTimer(); // Dừng timer cũ
        this.correctAnswer = correctValue;

        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        // 1. Cấu hình hộp câu hỏi (Làm nổi bật chữ trên nền trong suốt)
        if (wordBox) {
            wordBox.innerText = questionText;
            // Thêm nền đen mờ nhẹ (0.6) để chữ trắng dễ đọc hơn khi đè lên ảnh Pokémon
            wordBox.style.background = "rgba(0, 0, 0, 0.6)"; 
            wordBox.style.padding = "20px";
            wordBox.style.borderRadius = "15px";
            wordBox.style.color = "#ffffff";
            wordBox.style.boxShadow = "0 4px 15px rgba(0,0,0,0.3)";
            wordBox.style.fontSize = "1.2rem";
            wordBox.style.fontWeight = "bold";
        }

        // 2. Cấu hình danh sách đáp án
        if (optionsBox) {
            optionsBox.innerHTML = "";
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.innerText = opt;
                // Thêm style trực tiếp để nút bấm trông xịn hơn trên nền trong suốt
                btn.style.margin = "8px";
                btn.style.padding = "12px 20px";
                btn.style.cursor = "pointer";

                btn.onclick = () => {
                    this.stopTimer(); // Dừng timer khi người dùng đã trả lời
                    this.handleAnswer(opt, btn);
                };
                optionsBox.appendChild(btn);
            });

            // Thêm nút Bỏ qua ở dưới cùng
            const skipBtn = document.createElement('button');
            skipBtn.innerText = "⏭ Skip (15s)";
            // Nền nút skip mờ hơn để không chiếm spotlight
            skipBtn.style = "margin-top:20px; background:rgba(255,255,255,0.1); border:1px solid rgba(255,255,255,0.3); color:#ddd; cursor:pointer; padding:8px 15px; border-radius:8px; font-size:13px; transition: 0.3s;";

            skipBtn.onmouseover = () => skipBtn.style.background = "rgba(255,255,255,0.2)";
            skipBtn.onmouseout = () => skipBtn.style.background = "rgba(255,255,255,0.1)";

            skipBtn.onclick = () => this.handleSkip();
            optionsBox.appendChild(skipBtn);
        }

        // 3. Cấu hình Overlay TRONG SUỐT
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.backgroundColor = 'transparent'; // ✅ Xóa bỏ màu nền tối
            overlay.style.backgroundImage = 'none';      // ✅ Xóa gradient nếu có
            overlay.style.backdropFilter = 'none';      // ✅ Không làm mờ (blur) phía sau
        }

        this.startAutoSkipTimer(); // Bắt đầu đếm ngược cho câu mới
    },

    handleAnswer(selected, btn) {
        const isCorrect = (selected === this.correctAnswer);

        // Đổi màu nút người dùng vừa chọn
        btn.style.background = isCorrect ? "#2ecc71" : "#e74c3c";
        btn.style.color = "white";

        // Gọi hàm phản hồi dùng chung
        this.showFeedback(isCorrect, this.correctAnswer);
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
    /**
     * Dạng 2: Đáp án cho câu hỏi
     */
    async taskType2(target) {
        if (!target.question || !target.finalAns) return this.ask(this.callback);

        const instruction = "Answer the question.";
        const correctAns = target.finalAns;

        // 1. Lấy nhiễu
        // Ưu tiên lấy từ poolData (các bài khác)
        let wrongs = this.poolData
            .filter(item => item.word !== target.word) // Tránh trùng từ hiện tại
            .map(item => item.finalAns)
            .filter(a => a && a !== correctAns);

        // Bảo hiểm: Nếu không đủ 3 nhiễu, lấy thêm từ chính bài hiện tại
        if (wrongs.length < 3) {
            const currentWrongs = this.currentLessonData
                .map(item => item.finalAns)
                .filter(a => a && a !== correctAns);
            wrongs = [...wrongs, ...currentWrongs];
        }

        const finalWrongs = [...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [correctAns, ...finalWrongs].sort(() => 0.5 - Math.random());

        this.renderUI(`${instruction}\n\nQ: ${target.question}`, options, correctAns);

        await this.speak(instruction);
        await this.speak(target.question);
    },

    /**
     * Dạng 3: Câu hỏi cho đáp án
     */
    async taskType3(target) {
        if (!target.question || !target.finalAns) return this.ask(this.callback);

        const instruction = "Choose the correct question for this answer.";
        const correctAns = target.question;

        // 1. Lấy nhiễu
        let wrongs = this.poolData
            .filter(item => item.word !== target.word)
            .map(item => item.question)
            .filter(q => q && q !== correctAns);

        // Bảo hiểm tương tự Dạng 2
        if (wrongs.length < 3) {
            const currentWrongs = this.currentLessonData
                .map(item => item.question)
                .filter(q => q && q !== correctAns);
            wrongs = [...wrongs, ...currentWrongs];
        }

        const finalWrongs = [...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [correctAns, ...finalWrongs].sort(() => 0.5 - Math.random());

        this.renderUI(`${instruction}\n\nAns: ${target.finalAns}`, options, correctAns);

        await this.speak(instruction);
        await this.speak(target.finalAns);
    },
    /**
     * Dạng 4: Nghe và điền từ vào câu (Dùng Cột I và Cột C)
     */
    /**
     * Dạng 4: Nghe điền từ vào cặp Câu hỏi - Câu trả lời
     * Logic: Hiển thị Q & Ans nhưng ẩn [word], máy đọc đầy đủ cả 2 câu.
     */
    async taskType4(target) {
        if (!target.question || !target.finalAns) return this.ask(this.callback);

        // Dừng timer để không tính giờ lúc đang chuẩn bị
        this.stopTimer(); 

        const instruction = "Listen and fill in the missing word.";
        const correctAns = target.word.trim();
        const regex = new RegExp(`\\b${correctAns}\\b`, 'gi');
        const displayQ = target.question.replace(regex, "_______");
        const displayAns = target.finalAns.replace(regex, "_______");
        const fullDisplayText = `Q: ${displayQ}\nAns: ${displayAns}`;
        const textToSpeak = `${target.question}. ${target.finalAns}`;

        // Render UI (Chưa tính giờ)
        let wrongs = this.poolData
            .map(item => item.word)
            .filter(w => w && w.toLowerCase() !== correctAns.toLowerCase());
        const finalWrongs = [...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [correctAns, ...finalWrongs].sort(() => 0.5 - Math.random());

        this.renderUI_WithRepeat(instruction, fullDisplayText, options, correctAns, textToSpeak);

        // PHÁT ÂM THANH
        await this.speak(instruction);
        await this.speak(textToSpeak);

        // SAU KHI ĐỌC XONG MỚI CHẠY TIMER (Ví dụ cho 20 giây)
        this.startTimer(15000); 
    },

    /**
     * Hàm render bổ sung có nút Nghe lại cho các dạng nghe
     */
    renderUI_WithRepeat(instruction, questionText, options, correctValue, textToSpeak) {
        this.renderUI(`${instruction}\n\n${questionText}`, options, correctValue);

        const optionsBox = document.getElementById('quiz-options');
        if (optionsBox) {
            // Thêm nút Nghe lại 🔊 vào trên hàng nút đáp án hoặc dưới cùng
            const repeatBtn = document.createElement('button');
            repeatBtn.innerHTML = "🔊 Listen Again";
            repeatBtn.style = "margin-bottom:15px; background:#3498db; color:white; border:none; cursor:pointer; padding:8px 20px; border-radius:20px; font-weight:bold; width:100%;";
            repeatBtn.onclick = () => this.speak(textToSpeak);

            // Chèn vào đầu danh sách options
            optionsBox.insertBefore(repeatBtn, optionsBox.firstChild);
        }
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
        this.stopTimer();
        this.correctAnswer = textToSay;
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) {
            overlay.style.display = 'flex';
            // SỬA TẠI ĐÂY: Thay rgba(0,0,0,0.9) thành transparent
            overlay.style.backgroundColor = 'transparent'; 
            overlay.style.backdropFilter = 'none'; // Đảm bảo không bị mờ
        }

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="font-family: sans-serif; text-align: center; padding: 10px;">
                    <div style="font-size: 18px; color: #aaa; margin-bottom: 10px;">${instruction}</div>
                    <div style="font-size: 14px; color: #ffeb3b;">(Listen and repeat)</div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div id="speechResult" style="color: #fff; margin-bottom: 20px; font-size: 16px; min-height: 40px; text-align: center;">
                    Tap the PokéBall and Speak
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <button id="btn-mic-ball" style="background: none; border: none; cursor: pointer; transition: transform 0.2s;">
                        <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" style="width: 100px; filter: drop-shadow(0 0 10px #fff);" />
                    </button>
                    <button id="btn-listen-again" style="background: #444; color: white; border: none; padding: 5px 15px; border-radius: 15px; cursor: pointer; font-size:12px;">🔊 Listen</button>
                    <button id="btn-skip-speak" style="background: none; color: #666; border: 1px solid #444; padding: 3px 10px; border-radius: 5px; cursor: pointer; font-size:11px; margin-top:10px;">Skip this turn</button>
                </div>
            `;

            document.getElementById('btn-listen-again').onclick = () => this.speak(textToSay);
            document.getElementById('btn-skip-speak').onclick = () => this.handleSkip();
            document.getElementById('btn-mic-ball').onclick = () => {
                this.stopTimer(); // Dừng đếm ngược khi bắt đầu nói
                this.startListeningLogic(textToSay, document.getElementById('btn-mic-ball'), document.getElementById('speechResult'));
            };
        }
        this.startAutoSkipTimer();
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

            this.showFeedback(isPass, targetText);
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
    },

    /**
     * Dạng 7: Nói theo kịch bản (Q & Ans)
     * Yêu cầu: Hiển thị cả Q và Ans, không đọc mẫu, check accuracy >= 70%
     */
    async taskType7(target) {
        if (!target.question || !target.finalAns) return this.ask(this.callback);

        const instruction = "Read the script out loud!";
        // Gộp cả câu hỏi và câu trả lời thành kịch bản
        const scriptToSay = `Q: ${target.question}\nAns: ${target.finalAns}`;
        // Văn bản thuần để máy check giọng nói (bỏ chữ Q: và Ans:)
        const cleanScript = `${target.question} ${target.finalAns}`;

        // 1. Hiển thị giao diện Speaking (Dùng UI PokéBall)
        this.renderUI_ScriptSpeaking(instruction, scriptToSay, cleanScript);

        // 2. Chỉ đọc hướng dẫn, không đọc nội dung kịch bản
        await this.speak(instruction);
    },

    /**
     * Render UI riêng cho Dạng 7 (Không có nút Listen Again)
     */
    renderUI_ScriptSpeaking(instruction, displayScript, cleanScript) {
        this.stopTimer();
        this.correctAnswer = cleanScript;
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');
        

        if (overlay) {
            overlay.style.display = 'flex';
            // SỬA TẠI ĐÂY:
            overlay.style.backgroundColor = 'transparent';
            overlay.style.backdropFilter = 'none';
        }

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="font-family: sans-serif; text-align: center; padding: 10px;">
                    <div style="font-size: 16px; color: #aaa; margin-bottom: 10px;">${instruction}</div>
                    <div style="font-size: 20px; color: #fff; line-height: 1.5; background: #333; padding: 15px; border-radius: 10px; border-left: 5px solid #f1c40f;">
                        ${displayScript.replace(/\n/g, '<br>')}
                    </div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div id="speechResult" style="color: #fff; margin-bottom: 20px; font-size: 16px; min-height: 40px; text-align: center;">
                    Tap the PokéBall and Read the script
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 10px;">
                    <button id="btn-mic-ball-7" style="background: none; border: none; cursor: pointer; transition: transform 0.2s;">
                        <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" style="width: 100px; filter: drop-shadow(0 0 10px #f1c40f);" />
                    </button>
                    <button id="btn-skip-speak-7" style="background: none; color: #666; border: 1px solid #444; padding: 3px 10px; border-radius: 5px; cursor: pointer; font-size:11px; margin-top:10px;">Skip this turn</button>
                </div>
            `;

            document.getElementById('btn-skip-speak-7').onclick = () => this.handleSkip();
            document.getElementById('btn-mic-ball-7').onclick = () => {
                this.stopTimer();
                // ✅ Truyền 70 vào tham số accuracy yêu cầu
                this.startListeningLogic_V2(cleanScript, document.getElementById('btn-mic-ball-7'), document.getElementById('speechResult'), 70);
            };
        }
        this.startAutoSkipTimer();
    },

    /**
     * Bản nâng cấp của startListeningLogic để tùy chỉnh mức độ % vượt qua
     */
    startListeningLogic_V2(targetText, micBtn, resultDiv, passScore = 70) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
            resultDiv.innerText = "❌ Browser not supported!";
            return;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = "en-US";
        micBtn.style.transform = "scale(1.2) rotate(20deg)";
        resultDiv.innerHTML = "<span style='color: #f1c40f;'>⚡ Recording script...</span>";

        recognition.start();

        recognition.onresult = (event) => {
            micBtn.style.transform = "scale(1)";
            const transcript = event.results[0][0].transcript;
            const accuracy = this.checkAccuracy(transcript, targetText);
            const isPass = accuracy >= passScore; // Kiểm tra theo 70%

            resultDiv.innerHTML = `
                <div style="font-size: 13px; color: #ccc;">"Detected: ${transcript}"</div>
                <div style="font-size: 18px; color: ${isPass ? '#2ecc71' : '#e74c3c'}; font-weight: bold; margin-top:5px;">
                    ${isPass ? '✨ PERFECT SCRIPT!' : '💨 MISREAD!'} (${accuracy}%)
                </div>
            `;

            this.showFeedback(isPass, targetText);
        };

        recognition.onerror = () => {
            micBtn.style.transform = "scale(1)";
            resultDiv.innerHTML = `<span style="color: #ff5252;">❌ Mic error, try again!</span>`;
        };
    },

    /**
     * Dạng 8: Viết từ vựng từ nghĩa tiếng Việt (Cột Y)
     * Yêu cầu: Hiển thị nghĩa -> Người dùng gõ từ tiếng Anh -> Check đúng/sai
     */
    async taskType8(target) {
        if (!target.meaning || !target.word) return this.ask(this.callback);

        const instruction = "Type the English word for this meaning:";
        const correctAns = target.word.trim();
        const questionText = target.meaning;

        // 1. Render giao diện nhập liệu
        this.renderUI_Writing(instruction, questionText, correctAns);

        // 2. Đọc hướng dẫn và nghĩa (nếu sếp muốn máy đọc cả nghĩa tiếng Việt thì đổi lang, 
        // nhưng thường dạng viết chỉ cần đọc hướng dẫn)
        await this.speak(instruction);
    },

    /**
     * Giao diện riêng cho dạng Viết
     */
    /**
     * Giao diện riêng cho dạng Viết (Nâng cấp: Gợi ý chữ đầu + Gạch dưới)
     */
    renderUI_Writing(instruction, questionText, correctValue) {
        this.stopTimer();
        this.correctAnswer = correctValue;

        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        // 1. Xử lý nền trong suốt tuyệt đối (Stage 6: Invisible Personalization)
        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.backgroundColor = 'transparent';
            overlay.style.backdropFilter = 'none';
            overlay.style.backgroundImage = 'none';
        }

        // 2. Tạo chuỗi gợi ý: Chữ đầu viết hoa + các dấu gạch dưới
        const hintText = correctValue.split('').map((char, index) => {
            if (index === 0) return char.toUpperCase(); 
            if (char === " ") return "&nbsp;&nbsp;";    
            return "_";
        }).join(' ');

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="font-family: sans-serif; text-align: center; padding: 10px;">
                    <div style="font-size: 14px; color: #aaa; margin-bottom: 5px;">${instruction}</div>
                    <div style="font-size: 22px; color: #2ecc71; font-weight: bold; margin-bottom: 15px;">
                        ${questionText}
                    </div>
                    <div style="font-size: 20px; color: #ffeb3b; letter-spacing: 2px; font-family: monospace;">
                        ${hintText}
                    </div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div style="display: flex; flex-direction: column; align-items: center; gap: 15px; width: 100%;">
                    <input type="text" id="writing-input" autocomplete="off" autofocus
                        style="width: 80%; padding: 12px; font-size: 18px; border-radius: 10px; border: 2px solid #555; background: #222; color: #fff; text-align: center;" 
                        placeholder="Type the full word..." />

                    <button id="btn-submit-writing" 
                        style="background: #3498db; color: white; border: none; padding: 10px 40px; border-radius: 25px; font-size: 16px; font-weight: bold; cursor: pointer; width: 80%;">
                        CHECK
                    </button>

                    <button id="btn-skip-writing" style="background: none; color: #666; border: 1px solid #444; padding: 3px 10px; border-radius: 5px; cursor: pointer; font-size:11px;">Skip</button>
                </div>
            `;

            const inputEl = document.getElementById('writing-input');
            const submitBtn = document.getElementById('btn-submit-writing');

            const checkWriting = () => {
                const userVal = inputEl.value.trim().toLowerCase();
                const correctVal = correctValue.toLowerCase();
                const isCorrect = (userVal === correctVal);

                inputEl.disabled = true;
                inputEl.style.borderColor = isCorrect ? "#2ecc71" : "#e74c3c";
                submitBtn.style.background = isCorrect ? "#2ecc71" : "#e74c3c";
                submitBtn.innerText = isCorrect ? "✨ CORRECT!" : "❌ WRONG!";

                // Nếu sai, hiển thị đáp án đúng sau chữ WRONG
                if(!isCorrect) {
                    submitBtn.innerHTML = `❌ ${correctValue.toUpperCase()}`;
                }

                this.showFeedback(isCorrect, correctValue);
            };

            submitBtn.onclick = checkWriting;
            inputEl.onkeypress = (e) => { if (e.key === 'Enter') checkWriting(); };
            document.getElementById('btn-skip-writing').onclick = () => this.handleSkip();

            setTimeout(() => inputEl.focus(), 100);
        }
        this.startAutoSkipTimer();
    },

    /**
     * Dạng 9: Sắp xếp câu (Sentence Unscramble)
     * Lấy Q & Ans, chặt nhỏ thành các nút để người dùng xếp lại.
     */
    /**
     * Dạng 9 (Cập nhật): Sắp xếp câu (1 trong 3 nguồn ngẫu nhiên)
     */
    async taskType9(target) {
        // 1. Tạo danh sách các câu có sẵn dữ liệu
        const sources = [
            { text: target.question, label: "Question" },
            { text: target.finalAns, label: "Answer" },
            { text: target.presentSent, label: "Presentation" }
        ].filter(s => s.text && s.text.trim().length > 0);

        if (sources.length === 0) return this.ask(this.callback);

        // 2. Bốc ngẫu nhiên 1 nguồn
        const selectedSource = sources[Math.floor(Math.random() * sources.length)];
        const originalText = selectedSource.text.trim();

        const instruction = `Unscramble the ${selectedSource.label}!`;

        // 3. Tách từ và dấu câu
        const wordsArray = originalText.match(/[\w']+|[^\w\s]/g);
        if (!wordsArray) return this.ask(this.callback);

        const correctSequence = [...wordsArray];
        const shuffledWords = [...wordsArray].sort(() => 0.5 - Math.random());

        // 4. Render UI
        this.renderUI_Unscramble(instruction, shuffledWords, correctSequence);

        await this.speak(instruction);
    },
    renderUI_Unscramble(instruction, shuffledWords, correctSequence) {
        this.stopTimer();
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) overlay.style.display = 'flex';

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="font-size: 14px; color: #aaa; margin-bottom: 10px;">${instruction}</div>
                <div id="unscramble-result" style="min-height: 60px; background: rgba(255,255,255,0.1); border: 2px dashed #555; border-radius: 10px; padding: 10px; display: flex; flex-wrap: wrap; gap: 5px; justify-content: center; align-items: center;">
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div id="unscramble-pool" style="display: flex; flex-wrap: wrap; gap: 8px; justify-content: center; margin-bottom: 20px;"></div>
                <div style="display: flex; gap: 10px; width: 100%;">
                    <button id="btn-unscramble-reset" style="flex: 1; background: #666; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer;">Reset</button>
                    <button id="btn-unscramble-check" style="flex: 2; background: #3498db; color: white; border: none; padding: 12px; border-radius: 8px; cursor: pointer; font-weight: bold;">CHECK</button>
                </div>
            `;

            const resultArea = document.getElementById('unscramble-result');
            const poolArea = document.getElementById('unscramble-pool');
            let userSequence = [];

            shuffledWords.forEach((word) => {
                const btn = document.createElement('button');
                btn.innerText = word;
                btn.className = "word-block-btn"; // Sếp có thể thêm CSS cho class này
                btn.style = "background: #444; color: white; border: 1px solid #666; padding: 8px 15px; border-radius: 8px; cursor: pointer; font-size: 16px; transition: 0.2s;";

                btn.onclick = () => {
                    userSequence.push(word);
                    btn.style.visibility = 'hidden'; // Dùng visibility để không làm nhảy vị trí các từ còn lại

                    const resBtn = document.createElement('span');
                    resBtn.innerText = word;
                    resBtn.style = "background: #2ecc71; color: white; padding: 5px 10px; border-radius: 5px; font-weight: bold; animation: popIn 0.3s;";
                    resultArea.appendChild(resBtn);
                };
                poolArea.appendChild(btn);
            });

            document.getElementById('btn-unscramble-reset').onclick = () => {
                userSequence = [];
                resultArea.innerHTML = "";
                Array.from(poolArea.children).forEach(btn => btn.style.visibility = 'visible');
            };

            document.getElementById('btn-unscramble-check').onclick = () => {
                const isCorrect = JSON.stringify(userSequence) === JSON.stringify(correctSequence);
                // Dùng dấu cách để nối lại câu khi hiện đáp án đúng
                const fullCorrectSentence = correctSequence.join(' ').replace(/\s([?.!,])/g, '$1'); 

                this.showFeedback(isCorrect, fullCorrectSentence);
            };
        }
        this.startAutoSkipTimer();
    },

    /**
     * Dạng 10: Nghe đoạn văn chọn đáp án đúng
     * Trộn presentSent của mục tiêu với các câu khác để tạo "đoạn văn"
     */
    async taskType10(target) {
        if (!target.presentSent || !target.question || !target.finalAns) return this.ask(this.callback);

        this.stopTimer();

        const instruction = "Listen to the 6-sentence paragraph and answer.";

        // --- LOGIC MỚI: LẤY 5 CÂU TỪ 5 BÀI KHÁC NHAU ---
        let noiseSentences = [];

        // 1. Lọc danh sách các bài có presentSent và không phải bài hiện tại
        let otherLessons = this.poolData.filter(item => 
            item.word !== target.word && 
            item.presentSent && 
            item.presentSent.trim() !== ""
        );

        // 2. Trộn ngẫu nhiên danh sách các bài này
        otherLessons.sort(() => 0.5 - Math.random());

        // 3. Lấy tối đa 5 bài khác nhau, mỗi bài 1 câu
        let selectedLessons = otherLessons.slice(0, 5);
        noiseSentences = selectedLessons.map(item => item.presentSent.trim());

        // 4. Dự phòng: Nếu không đủ 5 bài khác nhau, lấy thêm câu từ chính các bài đó (nhưng câu khác)
        if (noiseSentences.length < 5) {
            let extraNeeded = 5 - noiseSentences.length;
            let extraSentences = this.poolData
                .filter(item => item.presentSent && !noiseSentences.includes(item.presentSent.trim()) && item.presentSent.trim() !== target.presentSent.trim())
                .map(item => item.presentSent.trim())
                .sort(() => 0.5 - Math.random())
                .slice(0, extraNeeded);
            noiseSentences = [...noiseSentences, ...extraSentences];
        }

        // Trộn câu đúng của bài hiện tại vào 5 câu nhiễu
        const paragraphArray = [target.presentSent.trim(), ...noiseSentences].sort(() => 0.5 - Math.random());
        const fullParagraph = paragraphArray.join(". , "); 

        // --- PHẦN ĐÁP ÁN VÀ RENDER GIỮ NGUYÊN ---
        const correctAns = target.finalAns;
        let wrongs = this.poolData
            .filter(item => item.word !== target.word && item.finalAns)
            .map(item => item.finalAns)
            .filter(a => a !== correctAns);
        const finalWrongs = [...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [correctAns, ...finalWrongs].sort(() => 0.5 - Math.random());

        this.renderUI_ListeningParagraph(instruction, target.question, options, correctAns, fullParagraph);

        // QUY TRÌNH ĐỌC TỰ ĐỘNG
        await this.speak(instruction);

        const btnPlay = document.getElementById('btn-play-paragraph');
        if (btnPlay) {
            btnPlay.disabled = true;
            btnPlay.innerText = "⏳";
        }

        await this.speak(fullParagraph);
        await this.speak("The question is: " + target.question);

        if (btnPlay) {
            btnPlay.disabled = false;
            btnPlay.innerText = "🔊";
        }
        this.startTimer(40000); 
    },
    renderUI_ListeningParagraph(instruction, questionText, options, correctValue, paragraphText) {
        this.stopTimer();
        this.correctAnswer = correctValue;
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) overlay.style.display = 'flex';

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="font-family: sans-serif; text-align: center; padding: 10px;">
                    <div style="font-size: 14px; color: #aaa; margin-bottom: 10px;">${instruction}</div>
                    <button id="btn-play-paragraph" style="background: #9b59b6; color: white; border: none; width: 80px; height: 80px; border-radius: 50%; cursor: pointer; font-size: 30px; box-shadow: 0 0 15px rgba(155,89,182,0.5); transition: transform 0.2s;">
                        🔊
                    </button>
                    <div style="margin-top: 15px; font-size: 18px; color: #ffeb3b; font-weight: bold; line-height: 1.4;">
                        Q: ${questionText}
                    </div>
                </div>
            `;

            document.getElementById('btn-play-paragraph').onclick = async (e) => {
                const btn = e.currentTarget;
                if (btn.disabled) return; // Chống bấm nhiều lần

                btn.disabled = true; // Khóa nút
                btn.style.opacity = "0.5";
                btn.style.transform = "scale(0.9)";
                btn.innerText = "⏳";

                await this.speak(paragraphText, 0.5);

                btn.disabled = false; // Mở khóa
                btn.style.opacity = "1";
                btn.style.transform = "scale(1)";
                btn.innerText = "🔊";
            };
        }

        if (optionsBox) {
            optionsBox.innerHTML = "";
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.innerText = opt;
                btn.onclick = () => {
                    this.stopTimer();
                    this.handleAnswer(opt, btn); // Sẽ gọi showFeedback đã viết trước đó
                };
                optionsBox.appendChild(btn);
            });

            const skipBtn = document.createElement('button');
            skipBtn.innerText = "⏭ Skip (15s)";
            skipBtn.style = "margin-top:15px; background:none; border:1px solid #666; color:#666; cursor:pointer; padding:5px 10px; border-radius:5px; font-size:11px;";
            skipBtn.onclick = () => this.handleSkip();
            optionsBox.appendChild(skipBtn);
        }
        
    },

    /**
     * Dạng 11: Luyện nói nâng cao (Vocab 2)
     /**
     /**
     * Dạng 11: Nói từ dựa trên hình ảnh (Vocab 2)
     * Tích hợp lấy ảnh từ ImageCache.js và LocalStorage
     */
    /**
     * Dạng 11: Vocab 2 - Nói từ qua hình ảnh
     * Sử dụng hệ thống 5 lớp ảnh thực tế từ imagecache2.js
     */
    async taskType11(target) {
        // Hiện thông báo đang tải ảnh để người dùng không thấy màn hình trống
        this.renderLoading(); 

        try {
            // Gọi hàm getImage từ instance imageCache
            // Nó sẽ tự check LocalStorage -> Unsplash -> Pexels -> Pixabay...
            const imageResult = await imageCache.getImage(target.word);
            const imgSrc = imageResult ? imageResult.url : "";

            const instruction = "Look at the picture and say the word.";
            const meaningText = target.meaning || "???";

            // Render giao diện chính
            this.renderUI_Vocab2(instruction, imgSrc, meaningText, target);

            // Đọc hướng dẫn
            await this.speak(instruction);

        } catch (error) {
            console.error("❌ Lỗi tải ảnh từ imagecache2:", error);
            // Nếu lỗi quá nặng, dùng ảnh Pokéball chữa cháy
            const fallbackImg = "https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png";
            this.renderUI_Vocab2("Look and say!", fallbackImg, target.meaning, target);
        }
    },

    // Hàm phụ để hiển thị trạng thái chờ nếu ảnh tải hơi lâu (do fetch nhiều lớp)
    renderLoading() {
        const wordBox = document.getElementById('quiz-word');
        if (wordBox) {
            wordBox.innerHTML = `<div style="color: #ffd54f; font-size: 14px;">🔍 Đang tìm ảnh thực tế...</div>`;
        }
    },

    renderUI_Vocab2(instruction, imgSrc, meaningText, target) {
        this.stopTimer();
        this.correctAnswer = target.word;
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) overlay.style.display = 'flex';

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="text-align: center;">
                    <p style="font-size: 14px; color: #aaa; margin-bottom: 8px;">${instruction}</p>
                    <div class="image-container" style="min-height: 150px; display: flex; align-items: center; justify-content: center;">
                        ${imgSrc 
                            ? `<img src="${imgSrc}" style="max-width:180px; border-radius:15px; border: 3px solid #ffd54f; box-shadow: 0 4px 15px rgba(0,0,0,0.3);"/>` 
                            : `<div style="color: #666; font-style: italic;">(No image available)</div>`
                        }
                    </div>
                    <div style="font-size: 26px; font-weight: bold; color: #ffd54f; margin: 15px 0;">${meaningText}</div>
                    <button id="btn-v2-listen" class="poke-btn yellow" style="padding: 8px 20px; font-size: 14px;">
                        🔊 Listen Hint
                    </button>
                </div>
            `;
            
            document.getElementById('btn-v2-listen').onclick = () => {
                this.speak(target.question || target.word);
            };
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div style="text-align: center;">
                    <div id="v2-status" style="margin-bottom: 10px; color: #2ecc71; font-weight: bold;">Press to Speak</div>

                    <div style="display: flex; align-items: center; justify-content: center; gap: 20px;">
                        <!-- Nút Speak giữ nguyên -->
                        <button id="btn-v2-speak" class="poke-btn blue" style="width: 80px; height: 80px; border-radius: 50%; padding: 0; display: inline-flex; align-items: center; justify-content: center;">
                            <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" style="width:40px; filter: brightness(0) invert(1);"/>
                        </button>

                        <!-- THÊM NÚT SKIP -->
                        <button id="btn-v2-skip" class="poke-btn gray" style="padding: 10px 20px; font-size: 14px; border-radius: 15px; background: #666; color: white; border: none; cursor: pointer;">
                            ⏩ SKIP
                        </button>
                    </div>

                    <div id="v2-result" style="margin-top: 15px; color: #fff; font-size: 16px; min-height: 24px;"></div>
                </div>
            `;

            // GÁN SỰ KIỆN CHO NÚT SKIP
            document.getElementById('btn-v2-skip').onclick = () => {
                this.stopTimer(); // Dừng đếm ngược
                this.showFeedback(false, target.word); // Tính là không đúng và chuyển câu
            };

            const btnSpeak = document.getElementById('btn-v2-speak');
            const status = document.getElementById('v2-status');
            const resultDiv = document.getElementById('v2-result');

            btnSpeak.onclick = () => {
                const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
                if (!SR) return alert("Microphone not supported");

                const rec = new SR();
                rec.lang = "en-US";
                
                rec.onstart = () => {
                    status.innerText = "🎙️ Listening...";
                    status.style.color = "#f1c40f";
                    btnSpeak.style.transform = "scale(1.1)";
                    btnSpeak.style.boxShadow = "0 0 20px #3498db";
                };

                rec.onresult = (e) => {
                    const transcript = e.results[0][0].transcript.toLowerCase().trim();
                    const targetWord = target.word.toLowerCase().replace(/[^a-z0-9'\s]/g, "");
                    
                    const isCorrect = transcript.includes(targetWord);
                    resultDiv.innerHTML = `You said: <span style="color: #ffd54f;">"${transcript}"</span>`;
                    
                    btnSpeak.style.transform = "scale(1)";
                    btnSpeak.style.boxShadow = "none";

                    setTimeout(() => {
                        this.showFeedback(isCorrect, target.word);
                    }, 1000);
                };

                rec.onerror = () => {
                    status.innerText = "Error! Try again.";
                    btnSpeak.style.transform = "scale(1)";
                };

                rec.start();
            };
        }
        this.startAutoSkipTimer();
    },

    /**
     * Dạng 12: Trắc nghiệm hình ảnh (Tương ứng D3)
     * 1 hình ảnh câu hỏi và 4 đáp án văn bản
     */
    async taskType12(target) {
        this.renderLoading();

        try {
            // Tận dụng cache từ local hoặc fetch mới qua 5 lớp
            const imageResult = await imageCache.getImage(target.word);
            const imgSrc = imageResult ? imageResult.url : "";

            // 1. Lấy danh sách từ trong CÙNG bài (loại trừ từ đúng)
            const sameLessonWords = [...new Set(
                this.poolData
                    .filter(item => item.lessonId === target.lessonId && item.word !== target.word)
                    .map(item => item.word)
            )];

            // 2. Lấy danh sách từ BÀI KHÁC
            const otherLessonWords = [...new Set(
                this.poolData
                    .filter(item => item.lessonId !== target.lessonId && item.word !== target.word)
                    .map(item => item.word)
            )];

            let distractors = [];

            // Lấy 1 từ cùng bài (nếu có)
            if (sameLessonWords.length > 0) {
                const randomSame = sameLessonWords[Math.floor(Math.random() * sameLessonWords.length)];
                distractors.push(randomSame);
            }

            // Lấy các từ còn lại từ bài khác để đủ 3 đáp án phụ
            const needed = 3 - distractors.length;
            const randomOthers = otherLessonWords
                .sort(() => 0.5 - Math.random())
                .slice(0, needed);

            distractors = distractors.concat(randomOthers);

            // Trường hợp hy hữu nếu vẫn thiếu (do pool quá ít), lấy đại từ bất kỳ miễn là không trùng
            if (distractors.length < 3) {
                const allUnique = [...new Set(this.poolData.map(i => i.word).filter(w => w !== target.word && !distractors.includes(w)))];
                distractors = distractors.concat(allUnique.slice(0, 3 - distractors.length));
            }

            // 3. Trộn đáp án đúng với đáp án nhiễu
            const options = [target.word, ...distractors].sort(() => 0.5 - Math.random());

            console.log(`[Dạng 12] Từ đúng: ${target.word} | Nhiễu: ${distractors.join(", ")}`);

            this.renderUI_ImageChoice(imgSrc, options, target);

            this.speak("Look at the picture. Which word is it?");

        } catch (error) {
            console.error("❌ Lỗi Dạng 12:", error);
            this.handleSkip();
        }
    },

    renderUI_ImageChoice(imgSrc, options, target) {
        this.stopTimer();
        this.correctAnswer = target.word;

        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) overlay.style.display = 'flex';

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="text-align: center;">
                    <p style="font-size: 14px; color: #aaa; margin-bottom: 10px;">Choose the correct word</p>
                    <div class="image-container" style="min-height: 180px; display: flex; align-items: center; justify-content: center;">
                        <img src="${imgSrc || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'}" 
                             style="max-width:200px; border-radius:15px; border: 4px solid #3498db; box-shadow: 0 5px 15px rgba(0,0,0,0.5);"/>
                    </div>
                    <div style="margin-top: 10px; font-style: italic; color: #ffd54f;">"${target.meaning}"</div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `<div class="options-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 10px;"></div>`;
            const grid = optionsBox.querySelector('.options-grid');

            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'poke-btn white option-btn';
                btn.style = "padding: 15px 5px; font-weight: bold; font-size: 16px; text-transform: capitalize;";
                btn.innerText = opt;

                btn.onclick = () => {
                    this.stopTimer(); // Dừng timer ngay khi bấm
                    const isCorrect = (opt === target.word);
                    this.showFeedback(isCorrect, target.word);
                };
                grid.appendChild(btn);
            });
        }

        this.startAutoSkipTimer();
    },

    /**
     * Dạng 13: Viết từ dựa trên ảnh làm mờ (Blurred Image Writing)
     * Gợi ý: Chữ cái đầu + các dấu gạch dưới (_)
     */
    async taskType13(target) {
        this.renderLoading();

        try {
            // Lấy ảnh thực tế từ hệ thống 5 lớp
            const imageResult = await imageCache.getImage(target.word);
            const imgSrc = imageResult ? imageResult.url : "";

            // Tạo chuỗi gợi ý: Chữ cái đầu + (_) cho các chữ còn lại
            // Ví dụ: "apple" -> "a _ _ _ _"
            const firstChar = target.word.charAt(0);
            const placeholder = firstChar + " " + "_ ".repeat(target.word.length - 1).trim();

            this.renderUI_ImageWriting(imgSrc, placeholder, target);

            // Đọc từ để người dùng có thêm manh mối âm thanh
            this.speak("Look at the blurred image and write the word.");

        } catch (error) {
            console.error("❌ Lỗi Dạng 13:", error);
            this.handleSkip();
        }
    },

    renderUI_ImageWriting(imgSrc, placeholder, target) {
        this.stopTimer();
        this.correctAnswer = target.word;

        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) overlay.style.display = 'flex';

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="text-align: center;">
                    <p style="font-size: 14px; color: #aaa; margin-bottom: 10px;">Type the word you see</p>
                    <div class="image-container" style="position: relative; min-height: 180px; display: flex; align-items: center; justify-content: center;">
                        <img src="${imgSrc || 'https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/items/poke-ball.png'}" 
                             id="blurImg"
                             style="max-width:220px; border-radius:15px; border: 4px solid #ffd54f; filter: blur(8px); transition: filter 0.5s ease;"/>
                    </div>
                    <div id="hint-text" style="font-size: 20px; letter-spacing: 4px; color: #ffd54f; margin: 15px 0; font-family: monospace;">
                        ${placeholder}
                    </div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div style="text-align: center; padding: 0 10px;">
                    <input type="text" id="writing-input" 
                           placeholder="Type here..." 
                           autocomplete="off"
                           style="width: 80%; padding: 12px; border-radius: 10px; border: 2px solid #3498db; background: #222; color: #fff; font-size: 18px; text-align: center; outline: none;"/>
                    <div style="margin-top: 15px; display: flex; justify-content: center; gap: 10px;">
    <button id="btn-submit-w" class="poke-btn yellow">Check</button>
    <button id="btn-hint-w" class="poke-btn blue">🔊</button>
    <!-- Nút Hint mới thêm -->
    <button id="btn-meaning-hint" style="padding: 8px 15px; background: #555; color: #fff; border-radius: 8px; border: none; cursor: pointer;">Hint</button>
</div>
                </div>
            `;

            const inputEl = document.getElementById('writing-input');
            const btnSubmit = document.getElementById('btn-submit-w');
            const imgEl = document.getElementById('blurImg');

            // Tự động focus vào ô nhập
            setTimeout(() => inputEl.focus(), 500);

            const checkResult = () => {
                const userVal = inputEl.value.trim().toLowerCase();
                if (!userVal) return;

                this.stopTimer();
                // Bỏ làm mờ ảnh khi trả lời
                if (imgEl) imgEl.style.filter = "none";

                const isCorrect = (userVal === target.word.toLowerCase());
                this.showFeedback(isCorrect, target.word);
            };

            btnSubmit.onclick = checkResult;
            // Logic hiển thị nghĩa khi ấn nút Hint
            document.getElementById('btn-meaning-hint').onclick = function() {
                const hintEl = document.getElementById('hint-text');
                if (hintEl) {
                    // Lấy nghĩa từ dữ liệu target
                    const meaning = target.meaning || "No meaning available";
                    hintEl.innerHTML = `<span style="font-family: sans-serif; letter-spacing: 0; color: #4ade80;">${meaning}</span>`;
                }
                // Vô hiệu hóa nút sau khi xem để tránh bấm nhầm
                this.disabled = true;
                this.style.opacity = "0.5";
                // Tự động focus lại ô nhập để người dùng gõ tiếp
                inputEl.focus();
            };
            inputEl.onkeydown = (e) => { if (e.key === "Enter") checkResult(); };
            document.getElementById('btn-hint-w').onclick = () => this.speak(target.word);
        }

        this.startTimer(30000);
    },

    /**
     * Dạng 14: PokéWord (Điền chữ cái vào ô trống)
     * Hiển thị một phần từ, yêu cầu điền các chữ cái còn thiếu.
     */
    async taskType14(target) {
        this.renderLoading();

        // Chuẩn hóa từ: Bỏ ký tự đặc biệt, viết hoa
        const cleanWord = target.word.replace(/[^a-zA-Z]/g, "").toUpperCase();
        const letters = cleanWord.split("");

        // Thuật toán lấy ngẫu nhiên các vị trí trống (khoảng 50% số chữ cái)
        const missingIndices = [];
        const numMissing = Math.max(1, Math.floor(letters.length / 2));
        while (missingIndices.length < numMissing) {
            const r = Math.floor(Math.random() * letters.length);
            if (!missingIndices.includes(r)) missingIndices.push(r);
        }

        this.renderUI_Pokeword(cleanWord, letters, missingIndices, target);
    },

    renderUI_Pokeword(cleanWord, letters, missingIndices, target) {
        this.stopTimer();
        this.correctAnswer = cleanWord;

        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) overlay.style.display = 'flex';

        // 1. Hiển thị Grid ô chữ
        if (wordBox) {
            const cellsHTML = letters.map((ch, i) => {
                if (missingIndices.includes(i)) {
                    return `<div class="pw-cell" style="width:35px; height:45px; border:2px solid #3498db; display:inline-flex; align-items:center; justify-content:center; margin:2px; border-radius:5px; background:#222;">
                                <input type="text" maxlength="1" class="pw-input" 
                                       style="width:100%; height:100%; background:transparent; border:none; color:#ffd54f; text-align:center; font-size:20px; font-weight:bold; outline:none; text-transform:uppercase;"/>
                            </div>`;
                }
                return `<div class="pw-cell" style="width:35px; height:45px; border:2px solid #555; display:inline-flex; align-items:center; justify-content:center; margin:2px; border-radius:5px; background:#333; color:#fff; font-size:20px; font-weight:bold;">${ch}</div>`;
            }).join("");

            wordBox.innerHTML = `
                <div style="text-align: center;">
                    <p style="font-size: 14px; color: #aaa; margin-bottom: 10px;">Fill in the missing letters</p>
                    <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 4px; margin-bottom: 15px;">
                        ${cellsHTML}
                    </div>
                    <div id="pw-hint-box" style="font-size: 16px; color: #ffd54f; min-height: 24px; font-style: italic;">
                        📘 Gợi ý: ${target.meaning}
                    </div>
                </div>
            `;
        }

        // 2. Hiển thị Nút xác nhận
        if (optionsBox) {
            optionsBox.innerHTML = `
                <div style="text-align: center; margin-top: 10px;">
                    <button id="btn-submit-pw" class="poke-btn green" style="width: 150px; padding: 12px;">Confirm</button>
                    <button id="btn-audio-pw" class="poke-btn blue" style="margin-left:10px;">🔊</button>
                </div>
            `;

            const inputs = document.querySelectorAll('.pw-input');
            const btnSubmit = document.getElementById('btn-submit-pw');

            // Tự động nhảy ô khi gõ
            inputs.forEach((inp, i) => {
                inp.oninput = () => {
                    if (inp.value.length === 1 && inputs[i + 1]) {
                        inputs[i + 1].focus();
                    }
                };
                // Quay lại ô trước khi bấm Backspace
                inp.onkeydown = (e) => {
                    if (e.key === "Backspace" && !inp.value && inputs[i - 1]) {
                        inputs[i - 1].focus();
                    }
                    if (e.key === "Enter") checkAction();
                };
            });

            // Focus vào ô đầu tiên
            if (inputs[0]) setTimeout(() => inputs[0].focus(), 500);

            const checkAction = () => {
                let userGuess = "";
                const cells = document.querySelectorAll('.pw-cell');
                cells.forEach(cell => {
                    const input = cell.querySelector('input');
                    userGuess += input ? (input.value || "_") : cell.innerText;
                });

                const isCorrect = (userGuess.toUpperCase() === cleanWord);
                this.stopTimer();
                this.showFeedback(isCorrect, target.word);
            };

            btnSubmit.onclick = checkAction;
            document.getElementById('btn-audio-pw').onclick = () => this.speak(target.word);
        }

        // PokéWord có thời gian suy nghĩ lâu hơn một chút (20s)
        this.startAutoSkipTimer(30000); 
    },

    /**
     * Dạng 15: Dịch cụm từ (Tách khối theo dấu / hoặc xuống dòng)
     * Thời gian: 40s | Đọc tên dạng bài khi bắt đầu
     */
    async taskType15(target) {
        // 1. Đọc tên dạng bài ngay khi bắt đầu
        await this.speak("phrase translation");

        this.stopTimer();

        // 2. Tách dữ liệu: Hỗ trợ cả dấu "/" và dấu xuống dòng "\n"
        const splitPattern = /[\/\n]/; 
        const enArray = (target.colD || "").split(splitPattern).map(s => s.trim()).filter(s => s !== "");
        const viArray = (target.colE || "").split(splitPattern).map(s => s.trim()).filter(s => s !== "");

        // Ghép cặp dữ liệu thành từng dòng (row)
        let chunks = viArray.map((vi, i) => ({
            vi: vi,
            en: enArray[i] || ""
        })).filter(item => item.en !== "");

        if (chunks.length === 0) {
            chunks.push({ en: target.word, vi: target.meaning });
        }

        this.renderUI_PhraseTranslation(chunks, target);
    },

    renderUI_PhraseTranslation(chunks, target) {
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (wordBox) {
            const currentIdx = this.currentLessonData.length - this.wordQueue.length;

            const rowsHTML = chunks.map((c, i) => `
                <div class="pair-row" style="display: flex; gap: 10px; margin-bottom: 12px; align-items: stretch;">
                    <!-- Chữ màu đỏ đậm trên nền hồng nhạt -->
                    <div class="vi-block" style="flex: 1; background: #ffe9e9; border: 1px solid #ff7675; border-radius: 10px; padding: 12px; color: #d63031; font-weight: bold; display: flex; align-items: center; justify-content: center; text-align: center;">
                        ${c.vi}
                    </div>
                    <!-- Chữ màu đen/xám đậm trên nền xanh nhạt -->
                    <input type="text" class="en-input-ov" data-ans="${c.en}" 
                           placeholder="Nhập cụm tiếng Anh..." 
                           autocomplete="off"
                           style="flex: 1.2; background: #ebf5ff; border: 1px solid #3498db; border-radius: 10px; padding: 12px; color: #2d3436; font-weight: bold; outline: none;"/>
                </div>
            `).join("");

            wordBox.innerHTML = `
                <div style="width: 100%; max-width: 550px; margin: 0 auto; background: #fff; padding: 10px; border-radius: 10px;">
                    <div style="color: #d39e00; font-size: 13px; text-align: left; margin-bottom: 15px; font-weight: bold;">
                        🧱 Dịch cụm | ${currentIdx}/${this.currentLessonData.length} | Điểm: ${this.score || 0}
                    </div>
                    <div style="max-height: 400px; overflow-y: auto; padding-right: 8px;">
                        ${rowsHTML}
                    </div>
                </div>
            `;
        }

        if (optionsBox) {
            // Chỉnh nút bấm sang màu xám, chữ đen theo image_64f53d.png
            optionsBox.innerHTML = `
                <div style="display: flex; gap: 12px; justify-content: flex-start; margin-top: 15px;">
                    <button id="ov3Submit" class="poke-btn" style="padding: 12px 25px; background: #e0e0e0; border: 1px solid #999; border-radius: 5px; color: #000; font-weight: bold;">
                        <span style="background: #27ae60; border-radius: 4px; padding: 2px 4px; color: #fff; font-size: 10px;">✅</span> Kiểm tra
                    </button>
                    <button id="ov3Skip" class="poke-btn" style="padding: 12px 25px; background: #eee; border: 1px solid #999; border-radius: 5px; color: #000; font-weight: bold;">
                        ⏭ Bỏ qua
                    </button>
                </div>
            `;

            const btnSubmit = document.getElementById('ov3Submit');
            const inputs = document.querySelectorAll('.en-input-ov');

            if (inputs[0]) setTimeout(() => inputs[0].focus(), 400);

            inputs.forEach((inp, idx) => {
                inp.onkeydown = (e) => {
                    if (e.key === "Enter") {
                        if (inputs[idx + 1]) inputs[idx + 1].focus();
                        else btnSubmit.click();
                    }
                };
            });

            btnSubmit.onclick = () => {
                let correctCount = 0;
                inputs.forEach(inp => {
                    const user = inp.value.trim().toLowerCase();
                    const ans = inp.dataset.ans.trim().toLowerCase();
                    if (user === ans && user !== "") {
                        correctCount++;
                        inp.style.borderColor = "#2ecc71";
                        inp.style.background = "#dff9fb";
                        inp.style.color = "#12893d"; // Chữ xanh khi đúng
                    } else {
                        inp.style.borderColor = "#e74c3c";
                        inp.style.background = "#fff0f0";
                        inp.value = `${inp.value} ➔ ${inp.dataset.ans}`;
                        inp.style.color = "#d63031"; // Chữ đỏ khi sai
                    }
                    inp.readOnly = true;
                });

                const ratio = correctCount / inputs.length;
                this.showFeedback(ratio >= 0.7, `Đúng ${correctCount}/${inputs.length}`);
            };

            document.getElementById('ov3Skip').onclick = () => this.handleSkip();
        }

        if (overlay) overlay.style.display = 'flex';
        this.timer = setTimeout(() => this.handleSkip(), 60000); 
    },
    /**
     * Dạng 16: Đọc hiểu đoạn văn (Tương tự Dạng 10 nhưng hiện text, không đọc)
     * Thời gian: 30s | Bốc 5 câu từ 5 bài khác nhau
     */
    /**
     * Dạng 16: Đọc hiểu đoạn văn (Cơ chế lọc nội dung độc bản)
     * Thời gian: 30s | Đảm bảo 6 câu có nội dung khác nhau hoàn toàn
     */
    async taskType16(target) {
        if (!target.presentSent || !target.question || !target.finalAns) return this.ask(this.callback);

        this.stopTimer();

        const instruction = "Read the 6-sentence paragraph and answer the question.";

        // --- LOGIC LỌC NỘI DUNG ĐỘC BẢN & THÊM DẤU CHẤM ---
        const ensureDot = (str) => {
            str = str.trim();
            if (!str) return "";
            // Nếu câu chưa kết thúc bằng dấu chấm, hỏi hoặc cảm thán thì thêm dấu chấm
            if (!/[.!?]$/.test(str)) return str + ".";
            return str;
        };

        let usedTexts = new Set();
        let noiseSentences = [];

        const targetSentence = ensureDot(target.presentSent);
        usedTexts.add(targetSentence.toLowerCase());

        // Lấy danh sách tiềm năng và trộn
        let potentialLessons = this.poolData.filter(item => 
            item.word !== target.word && 
            item.presentSent && 
            item.presentSent.trim() !== ""
        ).sort(() => 0.5 - Math.random());

        for (let item of potentialLessons) {
            let currentText = ensureDot(item.presentSent);
            if (!usedTexts.has(currentText.toLowerCase())) {
                noiseSentences.push(currentText);
                usedTexts.add(currentText.toLowerCase());
            }
            if (noiseSentences.length >= 5) break;
        }

        // Trộn câu đúng vào 5 câu nhiễu
        const paragraphArray = [targetSentence, ...noiseSentences].sort(() => 0.5 - Math.random());

        // Nối các câu bằng dấu cách (Vì mỗi câu đã có dấu chấm ở hàm ensureDot)
        const fullParagraphText = paragraphArray.join(" ");

        // --- CHUẨN BỊ ĐÁP ÁN ---
        const correctAns = target.finalAns;
        let wrongs = this.poolData
            .filter(item => item.word !== target.word && item.finalAns)
            .map(item => item.finalAns)
            .filter(a => a !== correctAns);
        const finalWrongs = [...new Set(wrongs)].sort(() => 0.5 - Math.random()).slice(0, 3);
        const options = [correctAns, ...finalWrongs].sort(() => 0.5 - Math.random());

        // Render giao diện
        this.renderUI_ReadingParagraph(instruction, fullParagraphText, target.question, options, correctAns);

        await this.speak(instruction);
        this.startTimer(40000); 
    },

    renderUI_ReadingParagraph(instruction, paragraph, question, options, correctValue) {
        this.correctAnswer = correctValue;
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) overlay.style.display = 'flex';

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="width: 100%; max-width: 600px; margin: 0 auto; text-align: left; background: #fff; padding: 20px; border-radius: 15px; box-shadow: 0 4px 15px rgba(0,0,0,0.1);">
                    <div style="color: #636e72; font-size: 13px; margin-bottom: 10px; font-weight: bold; border-bottom: 1px solid #eee; padding-bottom: 5px;">
                        📖 READING COMPREHENSION
                    </div>
                    <!-- Đoạn văn 6 câu hiện ở đây -->
                    <div style="font-size: 16px; color: #2d3436; line-height: 1.6; margin-bottom: 20px; font-style: italic; background: #f9f9f9; padding: 15px; border-left: 5px solid #0984e3;">
                        "${paragraph}"
                    </div>
                    <!-- Câu hỏi -->
                    <div style="font-size: 18px; color: #d39e00; font-weight: bold; line-height: 1.4;">
                        ❓ Q: ${question}
                    </div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = "";
            options.forEach(opt => {
                const btn = document.createElement('button');
                btn.className = 'option-btn';
                btn.style = "margin-bottom: 10px; width: 100%; text-align: left; padding: 12px 20px;";
                btn.innerText = opt;
                btn.onclick = () => {
                    this.stopTimer();
                    this.handleAnswer(opt, btn);
                };
                optionsBox.appendChild(btn);
            });

            // Nút Skip
            const skipBtn = document.createElement('button');
            skipBtn.innerText = "⏭ Skip turn";
            skipBtn.style = "margin-top:10px; background:none; border:1px solid #ccc; color:#999; cursor:pointer; padding:8px 15px; border-radius:5px; font-size:12px;";
            skipBtn.onclick = () => this.handleSkip();
            optionsBox.appendChild(skipBtn);
        }
    },

    async taskType17(target) {
        if (!target.word) return this.ask(this.callback);
        this.stopTimer();

        const instruction = "Unscramble the letters to form the correct word.";

        // Xáo trộn từ (ví dụ: elephant -> h-a-n-t-e-l-e-p)
        const scrambled = target.word.split('')
            .sort(() => 0.5 - Math.random())
            .join('-')
            .toLowerCase();

        // Gợi ý: Ký tự đầu + Nghĩa của từ
        const hintText = `First letter: "${target.word[0].toUpperCase()}" | Meaning: ${target.meaning}`;

        this.renderUI_ScrambledWord(instruction, scrambled, hintText, target);

        await this.speak(instruction);
        // Thiết lập thời gian 20 giây như sếp yêu cầu
        this.startTimer(30000); 
    },
    renderUI_ScrambledWord(instruction, scrambled, hintText, target) {
        this.correctAnswer = target.word;
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');

        if (overlay) overlay.style.display = 'flex';

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="text-align: center; padding: 20px;">
                    <div style="color: #636e72; font-size: 13px; margin-bottom: 15px; font-weight: bold; text-transform: uppercase;">
                        🧩 Word Scramble
                    </div>
                    <div style="font-size: 28px; color: #0984e3; font-weight: bold; letter-spacing: 2px; background: #e1f5fe; padding: 15px; border-radius: 10px; border: 2px dashed #0984e3;">
                        ${scrambled}
                    </div>
                    <!-- Vùng hiển thị gợi ý (ẩn mặc định) -->
                    <div id="hidden-hint" style="display: none; margin-top: 15px; padding: 10px; background: #fff9db; border: 1px solid #fab005; border-radius: 8px; color: #e67e22; font-size: 14px; font-style: italic;">
                        ${hintText}
                    </div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div style="text-align: center; padding: 0 10px;">
                    <input type="text" id="scramble-input" 
                           placeholder="Type your answer here..." 
                           autocomplete="off"
                           style="width: 90%; padding: 12px; border-radius: 10px; border: 2px solid #0984e3; background: #222; color: #fff; font-size: 20px; text-align: center; outline: none;"/>

                    <div style="margin-top: 20px; display: flex; justify-content: center; gap: 10px;">
                        <button id="btn-submit-scramble" class="poke-btn yellow" style="min-width: 120px;">CHECK</button>
                        <button id="btn-show-hint" class="poke-btn blue" style="min-width: 80px;">💡 HINT</button>
                    </div>
                </div>
            `;

            const inputEl = document.getElementById('scramble-input');
            const hintEl = document.getElementById('hidden-hint');

            // Tự động focus để sếp gõ luôn cho nhanh
            setTimeout(() => inputEl.focus(), 500);

            // Logic khi ấn nút Check hoặc Enter
            const checkAction = () => {
                const userVal = inputEl.value.trim().toLowerCase();
                if (!userVal) return;
                this.stopTimer();
                const isCorrect = (userVal === target.word.toLowerCase());
                this.showFeedback(isCorrect, target.word);
            };

            document.getElementById('btn-submit-scramble').onclick = checkAction;
            inputEl.onkeydown = (e) => { if (e.key === "Enter") checkAction(); };

            // Logic hiện gợi ý khi ấn nút HINT
            document.getElementById('btn-show-hint').onclick = () => {
                hintEl.style.display = 'block';
                this.speak(target.meaning); // Đọc nghĩa khi hiện gợi ý
            };
        }
    },

    // --- DẠNG 18: CLOZE TEST (DEBUG MODE) ---
    async taskType18(target) {
        if (typeof this.stopTimer === 'function') this.stopTimer();
        this.userAnswers = {};
        // ✅ 1. Đọc hướng dẫn dẫn nhập
        const instruction = "Fill in the blanks";
        if (typeof this.speak === 'function') {
            this.speak(instruction);
        }

        // 1. Lấy 2 từ khác bài để đục lỗ bổ sung
        const otherItems = (this.poolData || [])
            .filter(item => item.lessonId !== target.lessonId && item.word !== target.word && item.presentSent)
            .sort(() => 0.5 - Math.random())
            .slice(0, 2);

        const mainItems = [target, ...otherItems];
        const targetWords = mainItems.map(item => item.word);

        // 2. Lấy 4 câu nền (filler)
        const fillerSentences = (this.poolData || [])
            .filter(item => !targetWords.includes(item.word) && item.presentSent)
            .sort(() => 0.5 - Math.random())
            .slice(0, 4)
            .map(item => this.ensureDot(item.presentSent));

        // 3. TRỘN TẤT CẢ CÂU TRƯỚC (3 câu chứa từ khóa + 4 câu nền)
        const fullSentences = [
            ...mainItems.map(item => ({ word: item.word, text: this.ensureDot(item.presentSent) })),
            ...fillerSentences.map(text => ({ word: null, text: text }))
        ].sort(() => 0.5 - Math.random());

        // 4. ĐỤC LỖ THEO THỨ TỰ XUẤT HIỆN TRONG ĐOẠN VĂN
        let blankCount = 0;
        const finalMainItems = []; // Lưu lại để chấm điểm đúng thứ tự 1-2-3

        const paragraphText = fullSentences.map(obj => {
            if (obj.word) {
                blankCount++;
                finalMainItems.push(obj); // Ghi nhớ từ gốc của lỗ (blankCount)
                const regex = new RegExp(`\\b${obj.word}\\b`, 'gi');
                return obj.text.replace(regex, `___(${blankCount})___`);
            }
            return obj.text;
        }).join(" ");

        // 5. Trộn 3 từ đáp án để hiển thị dưới nút
        const displayOptions = [...targetWords].sort(() => 0.5 - Math.random());

        this.renderUI_SimpleReading(paragraphText, displayOptions, finalMainItems);
        if (typeof this.startTimer === 'function') this.startTimer(45000);
    },
    renderUI_SimpleReading(paragraph, options, finalMainItems) {
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const quizOverlay = document.getElementById('quiz-overlay'); 
        const _self = this;

        if (quizOverlay) quizOverlay.style.display = 'flex';

        if (wordBox) {
            wordBox.style.textAlign = "left";
            wordBox.innerHTML = `
                <b style="color: #6c5ce7; display: block; margin-bottom: 10px;">📝 ĐIỀN TỪ VÀO ĐOẠN VĂN:</b>
                <div style="line-height: 2.2;">
                    ${paragraph.replace(/___\((\d+)\)___/g, (m, p1) => 
                        `<span id="ans-${p1}" style="color: #d63031; font-weight: bold; border-bottom: 2px solid #6c5ce7; min-width: 60px; display: inline-block; text-align: center; margin: 0 5px;">(${p1})</span>`
                    )}
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div id="temp-btns" style="display: flex; gap: 10px; flex-wrap: wrap; justify-content: center; margin-bottom: 15px;">
                    ${options.map(opt => `<button class="cloze-btn" style="padding: 10px 15px; border-radius: 8px; background: #6c5ce7; color: white; border: none; font-weight: bold; cursor: pointer;">${opt}</button>`).join('')}
                </div>
                <button id="btn-check-18" class="poke-btn yellow" style="width: 100%; height: 45px; font-weight: bold;">KIỂM TRA (ĐÚNG 2/3 LÀ ĐẠT)</button>
            `;

            const buttons = optionsBox.querySelectorAll('.cloze-btn');
            buttons.forEach(btn => {
                btn.onclick = function() {
                    const word = this.innerText;
                    for (let i = 1; i <= 3; i++) {
                        if (!_self.userAnswers[i]) {
                            _self.userAnswers[i] = word;
                            const targetBlank = document.getElementById(`ans-${i}`);
                            if (targetBlank) targetBlank.innerText = word;
                            this.style.opacity = "0.3";
                            this.style.pointerEvents = "none";
                            break;
                        }
                    }
                };
            });

            document.getElementById('btn-check-18').onclick = function() {
                _self.stopTimer();
                let correctCount = 0;

                // Chấm điểm theo thứ tự 1-2-3 đã lưu trong finalMainItems
                finalMainItems.forEach((item, idx) => {
                    if (_self.userAnswers[idx + 1] === item.word) {
                        correctCount++;
                    }
                });

                const passed = (correctCount >= 2);
                _self.showFeedback(passed, finalMainItems.map(i => i.word).join(", "));
            };
        }
    },
    //dạng 19: nối câu hỏi câu trả lời
    async taskType19(target) {
        if (typeof this.stopTimer === 'function') this.stopTimer();
        this.selectedQuestion = null; 
        this.userMatches = {};
        // ✅ Thêm phần đọc đề ngay khi vào bài
        if (typeof this.speak === 'function') {
            this.speak("Match the pairs.");
        }

        // 1. Hàm hỗ trợ lấy nội dung: Ưu tiên question/finalAns
        const getQA = (item) => ({
            q: item.question || "No Question",
            a: item.finalAns || "No Answer", // Đã đổi thành finalAns theo code của sếp
            id: Math.random().toString(36).substr(2, 9)
        });

        // 2. Lấy cặp chính từ bài hiện tại
        const mainPair = getQA(target);

        // 3. Lấy thêm 3 cặp từ poolData (Lọc những bài có đủ Q&A)
        const others = (this.poolData || [])
            .filter(item => item.lessonId !== target.lessonId && item.question && item.finalAns)
            .sort(() => 0.5 - Math.random())
            .slice(0, 3)
            .map(item => getQA(item));

        // 4. Tổng hợp 4 cặp
        const matchingPairs = [mainPair, ...others];

        // 5. Trộn 2 cột độc lập
        const shuffledQ = [...matchingPairs].sort(() => 0.5 - Math.random());
        const shuffledA = [...matchingPairs].sort(() => 0.5 - Math.random());

        this.renderUI_Matching(shuffledQ, shuffledA, matchingPairs);
        if (typeof this.startTimer === 'function') this.startTimer(45000);
    },
    renderUI_Matching(questions, answers, originalPairs) {
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const quizOverlay = document.getElementById('quiz-overlay');
        const _self = this;

        const pairColors = ["#FFD1DC", "#B3E5FC", "#C8E6C9", "#FFF9C4"]; 
        let currentColorIdx = 0;

        if (quizOverlay) quizOverlay.style.display = 'flex';

        if (wordBox) {
            wordBox.style.background = "transparent";
            wordBox.innerHTML = `<b style="color: #ffcb05; text-shadow: 2px 2px #000; font-size: 18px;">🧩 MATCHING THE Q AND A</b>`;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div style="display: flex; gap: 10px; margin-bottom: 10px;">
                    <div id="col-q" style="flex: 1; display: flex; flex-direction: column; gap: 8px;"></div>
                    <div id="col-a" style="flex: 1; display: flex; flex-direction: column; gap: 8px;"></div>
                </div>
                <div id="matching-answer-box" style="display:none; margin-bottom:10px; padding:10px; background:#fff; border-radius:8px; font-size:12px; border:2px solid #e74c3c;"></div>
                <button id="btn-submit-19" class="poke-btn yellow" style="width: 100%; height: 45px; font-weight: bold;">SUBMIT MATCHES</button>
            `;

            const colQ = document.getElementById('col-q');
            const colA = document.getElementById('col-a');

            // Render cột Q (Giữ nguyên code chuẩn của sếp)
            questions.forEach(item => {
                const div = document.createElement('div');
                div.className = "match-node q-node";
                div.innerText = item.q;
                div.dataset.id = item.id;
                div.style = "background:#fff; padding:10px; border-radius:8px; cursor:pointer; border:2px solid #ccc; font-size:13px; text-align:center; min-height:50px; display:flex; align-items:center; justify-content:center; box-shadow: 2px 2px 5px rgba(0,0,0,0.1); transition: 0.3s;";
                div.onclick = function() {
                    if (this.dataset.matched === "true") return;
                    colQ.querySelectorAll('.q-node').forEach(n => {
                        if (n.dataset.matched !== "true") { n.style.borderColor = "#ccc"; n.style.background = "#fff"; }
                    });
                    this.style.borderColor = "#6c5ce7";
                    this.style.background = "#f0edff";
                    _self.selectedQuestion = this;
                };
                colQ.appendChild(div);
            });

            // Render cột A (Giữ nguyên code chuẩn của sếp)
            answers.forEach(item => {
                const div = document.createElement('div');
                div.className = "match-node a-node";
                div.innerText = item.a;
                div.dataset.id = item.id;
                div.style = "background:#fff; padding:10px; border-radius:8px; cursor:pointer; border:2px solid #ccc; font-size:13px; text-align:center; min-height:50px; display:flex; align-items:center; justify-content:center; box-shadow: 2px 2px 5px rgba(0,0,0,0.1); transition: 0.3s;";
                div.onclick = function() {
                    if (!_self.selectedQuestion || this.dataset.matched === "true") return;
                    const selectedColor = pairColors[currentColorIdx % pairColors.length];
                    _self.userMatches[_self.selectedQuestion.dataset.id] = this.dataset.id;
                    this.dataset.matched = "true";
                    _self.selectedQuestion.dataset.matched = "true";
                    this.style.background = selectedColor;
                    this.style.borderColor = "#333";
                    _self.selectedQuestion.style.background = selectedColor;
                    _self.selectedQuestion.style.borderColor = "#333";
                    currentColorIdx++;
                    _self.selectedQuestion = null;
                };
                colA.appendChild(div);
            });

            document.getElementById('btn-submit-19').onclick = function() {
                _self.stopTimer();
                let correctCount = 0;
                let correctInfo = "";

                originalPairs.forEach(p => {
                    if (_self.userMatches[p.id] === p.id) {
                        correctCount++;
                    } else {
                        // Gom đáp án đúng cho những câu bị nối sai
                        correctInfo += `<div style="color:#e74c3c">✘ ${p.q.substring(0,10)}... → ${p.a}</div>`;
                    }
                });

                if (correctCount < 3) {
                    // Nếu sai quá nhiều, hiện box đáp án ngay trên nút Submit
                    const ansBox = document.getElementById('matching-answer-box');
                    ansBox.style.display = "block";
                    ansBox.innerHTML = `<b>Correct Answers:</b>${correctInfo}`;

                    // Đợi 3 giây cho sếp nhìn rồi mới nhảy feedback
                    setTimeout(() => {
                        _self.showFeedback(false, `Đúng ${correctCount}/4 cặp`);
                    }, 3000);
                } else {
                    _self.showFeedback(true, "Great job!");
                }
            };
        }
    },
    //dạng 20: trả lời câu hỏi

    async taskType20(target) {
        if (typeof this.stopTimer === 'function') this.stopTimer();

        const instruction = "Answer the question"; // Câu lệnh hướng dẫn
        const questionText = target.question || "Please answer the question.";

        // ✅ 1. Trích xuất keyword từ cột K (keywordFix)
        const rawK = target.keywordFix || "";
        const keywords = rawK.match(/"([^"]+)"/g)?.map(item => 
            this.normalize(item.replace(/"/g, ""))
        ) || [];

        // ✅ 2. Câu mẫu cột L (finalAns) làm Suggestion
        const suggestion = target.finalAns || "No suggestion available.";

        // ✅ 3. Đọc hướng dẫn trước, sau đó mới đọc câu hỏi
        if (typeof this.speak === 'function') {
            await this.speak(instruction); 
            // Nghỉ một chút giữa lệnh và câu hỏi cho tự nhiên
            await new Promise(resolve => setTimeout(resolve, 500)); 
            this.speak(questionText);
        }

        // 4. Render giao diện
        this.renderUI_Speaking_Type20(questionText, keywords, suggestion);
    },
    renderUI_Speaking_Type20(question, keywords, suggestion) {
        this.stopTimer();
        const wordBox = document.getElementById('quiz-word');
        const optionsBox = document.getElementById('quiz-options');
        const overlay = document.getElementById('quiz-overlay');
        const _self = this;

        if (overlay) {
            overlay.style.display = 'flex';
            overlay.style.backgroundColor = 'transparent'; // Ép về trong suốt
            overlay.style.backdropFilter = 'none';        // Bỏ hiệu ứng mờ
        }

        if (wordBox) {
            wordBox.innerHTML = `
                <div style="font-family: sans-serif; text-align: center; padding: 10px;">
                    <div style="font-size: 16px; color: #aaa; margin-bottom: 10px;">Answer the question:</div>
                    <div style="font-size: 20px; color: #fff; font-weight: bold; line-height: 1.4;">${question}</div>
                </div>
            `;
        }

        if (optionsBox) {
            optionsBox.innerHTML = `
                <div id="speechResult" style="color: #2ecc71; margin-bottom: 20px; font-size: 16px; min-height: 40px; text-align: center; font-style: italic;">
                    Tap the PokéBall and Answer
                </div>
                <div style="display: flex; flex-direction: column; align-items: center; gap: 12px;">
                    <button id="btn-mic-ball" style="background: none; border: none; cursor: pointer; transition: 0.2s;">
                        <img src="https://cdn-icons-png.flaticon.com/512/361/361998.png" style="width: 90px; filter: drop-shadow(0 0 10px #ffcb05);" />
                    </button>

                    <div style="display: flex; gap: 10px;">
                        <button id="btn-listen-q" style="background: #444; color: white; border: none; padding: 6px 15px; border-radius: 20px; cursor: pointer; font-size:12px;">🔊 Listen Question</button>
                        <button id="btn-skip-20" style="background: none; color: #888; border: 1px solid #444; padding: 6px 15px; border-radius: 20px; cursor: pointer; font-size:12px;">Skip turn</button>
                    </div>
                </div>
            `;

            // Gán sự kiện
            document.getElementById('btn-listen-q').onclick = () => this.speak(question);
            document.getElementById('btn-skip-20').onclick = () => {
                this.stopTimer();
                // Truyền suggestion (câu mẫu) vào feedback để người dùng biết lẽ ra nên nói gì
                this.showFeedback(false, suggestion); 
            };

            document.getElementById('btn-mic-ball').onclick = function() {
                const btn = this;
                const resultDisplay = document.getElementById('speechResult');
                const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

                if (!SpeechRecognition) return;

                const recognition = new SpeechRecognition();
                recognition.lang = 'en-US';

                resultDisplay.innerText = "Listening...";
                resultDisplay.style.color = "#ffcb05";
                btn.style.transform = "scale(1.2)";
                btn.style.filter = "drop-shadow(0 0 20px #ffcb05)";

                recognition.onresult = (event) => {
                    const userInput = event.results[0][0].transcript;
                    const normInput = _self.normalize(userInput);

                    // 1. Hiện ngay lập tức những gì máy nghe được
                    resultDisplay.innerHTML = `I heard: <span style="color: #fff;">"${userInput}"</span>`;

                    // 2. Kiểm tra đúng/sai
                    let isCorrect = (keywords.length === 0) ? true : keywords.some(kw => normInput.includes(kw));

                    // 3. Hiệu ứng chữ sau khi máy nghe xong
                    setTimeout(() => {
                        if (isCorrect) {
                            resultDisplay.innerHTML = `<span style="color: #2ecc71;">✓ I heard: "${userInput}"</span>`;
                            setTimeout(() => _self.showFeedback(true, "Excellent!"), 1000);
                        } else {
                            resultDisplay.innerHTML = `<span style="color: #ff4757;">✗ I heard: "${userInput}"</span>`;
                            // Nếu sai, hiện cột L (suggestion) cho sếp xem đáp án đúng
                            setTimeout(() => _self.showFeedback(false, suggestion), 1200);
                        }
                    }, 500);
                };

                recognition.onerror = () => {
                    resultDisplay.innerText = "❌ Didn't catch that. Try again!";
                    resultDisplay.style.color = "#ff4757";
                    btn.style.transform = "scale(1)";
                };

                recognition.onspeechend = () => {
                    recognition.stop();
                    btn.style.transform = "scale(1)";
                    btn.style.filter = "drop-shadow(0 0 10px #ffcb05)";
                };

                recognition.start();
            };
        }
    }
};

