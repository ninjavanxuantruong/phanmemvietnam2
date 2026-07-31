/**
 * ==========================================
 * PKM SCORE SYSTEM — ghi điểm dùng chung cho mọi game
 * ==========================================
 * Dùng chung cho pkm_battle.js, pkm_block.js, và mọi game Pokémon sau này.
 * Nạp file này (thẻ <script src="pkm_score.js">) TRƯỚC script của game.
 *
 * CÁCH DÙNG trong 1 game:
 *   1. Ngay trong callback của QuizManager.ask((isCorrect) => { ... }),
 *      gọi PkmScore.recordAnswer(isCorrect) — CHỈ gọi khi thật sự có 1 câu
 *      quiz vừa được hỏi (bỏ qua các lượt không có quiz, ví dụ lượt chỉ có
 *      địch đánh mà không có phe mình).
 *      → Hàm tự nhận diện đúng kỹ năng (nghe/nói/đọc/viết) nhờ đọc
 *        window.QuizManager.skillCycleIndex, KHÔNG cần truyền tay.
 *   2. Lúc thắng/thua (victory()/defeat()), gọi PkmScore.commitSession()
 *      → ghi CỘNG DỒN vào 2 nơi:
 *         - pkm_skill_scores : chi tiết đúng/tổng theo 4 kỹ năng
 *           (listening/speaking/reading/writing)
 *         - result_battle    : tổng điểm "🎮 Trò chơi" — dùng CHUNG cho
 *           Battle + Block + mọi game sau này, cộng dồn xuyên suốt.
 *      (EXP/DV/streak KHÔNG nằm trong file này — mỗi game tự tính riêng.)
 *
 * LƯU Ý QUAN TRỌNG: pkm_quiz.js (dùng chung, KHÔNG sửa) không lộ ra ngoài
 * "câu vừa hỏi thuộc kỹ năng nào" qua callback của ask(). Nhưng nó có biến
 * đếm nội bộ `skillCycleIndex` — tăng đúng 1 lần cho MỖI câu hỏi THẬT SỰ
 * được hỏi (kể cả các lượt bị "bỏ qua do thiếu dữ liệu" — mỗi lượt bỏ qua
 * cũng tự tăng biến này), xoay vòng đúng thứ tự SKILL_ORDER bên dưới. Vì
 * giữa lúc pickNextTypeName() tăng biến này và lúc callback (isCorrect)
 * được gọi không có lần tăng nào khác xảy ra, nên (skillCycleIndex - 1)
 * luôn đúng là chỉ số của kỹ năng vừa hỏi — kể cả khi có các lượt bỏ qua
 * xảy ra trước đó trong cùng 1 lần gọi ask().
 *
 * SKILL_ORDER dưới đây PHẢI khớp đúng thứ tự với SKILL_ORDER trong
 * pkm_quiz.js (hiện là ["listening","speaking","reading","writing"]) —
 * nếu sau này đổi thứ tự bên đó thì nhớ đổi luôn ở đây.
 */

window.PkmScore = {
    SKILL_ORDER: ["listening", "speaking", "reading", "writing"],

    session: {
        correctCount: 0,
        wrongCount: 0,
        totalCount: 0,
        introRecorded: false, // đảm bảo "Giới thiệu" chỉ cộng đúng 1 lần / ván
        skillStats: {
            intro: { correct: 0, total: 0 },
            listening: { correct: 0, total: 0 },
            speaking: { correct: 0, total: 0 },
            reading: { correct: 0, total: 0 },
            writing: { correct: 0, total: 0 },
        },
    },

    // Gọi lúc bắt đầu 1 ván mới (không bắt buộc — hầu hết game hiện tại
    // tải lại trang mỗi ván nên session đã sạch sẵn từ đầu; hàm này hữu ích
    // nếu sau này có game cho chơi lại nhiều ván mà không tải lại trang).
    reset() {
        this.session = {
            correctCount: 0,
            wrongCount: 0,
            totalCount: 0,
            introRecorded: false,
            skillStats: {
                intro: { correct: 0, total: 0 },
                listening: { correct: 0, total: 0 },
                speaking: { correct: 0, total: 0 },
                reading: { correct: 0, total: 0 },
                writing: { correct: 0, total: 0 },
            },
        };
    },

    // Suy ra kỹ năng của câu VỪA hỏi từ skillCycleIndex của QuizManager.
    getSkillJustAsked() {
        if (!window.QuizManager || typeof window.QuizManager.skillCycleIndex !== "number") return null;
        const order = this.SKILL_ORDER;
        const idx = ((window.QuizManager.skillCycleIndex - 1) % order.length + order.length) % order.length;
        return order[idx];
    },

    // Gọi ngay trong callback của QuizManager.ask((isCorrect) => ...).
    // Trả về tên kỹ năng vừa ghi (để game gọi có thể dùng nếu cần), hoặc
    // null nếu không xác định được (ví dụ QuizManager chưa sẵn sàng).
    recordAnswer(isCorrect) {
        // Hễ đã gọi tới quiz là chắc chắn đã học xong phần Giới thiệu (Vocabulary-
        // Module) từ trước rồi — cộng cố định 3 điểm, CHỈ 1 LẦN cho mỗi ván chơi.
        if (!this.session.introRecorded) {
            this.session.introRecorded = true;
            this.session.skillStats.intro.correct += 3;
            this.session.skillStats.intro.total += 3;
        }

        const skillName = this.getSkillJustAsked();
        this.session.totalCount++;
        if (isCorrect) this.session.correctCount++; else this.session.wrongCount++;
        if (skillName && this.session.skillStats[skillName]) {
            this.session.skillStats[skillName].total++;
            if (isCorrect) this.session.skillStats[skillName].correct++;
        }
        return skillName;
    },

    // Ghi cộng dồn kết quả của ván vừa chơi vào localStorage — gọi 1 lần
    // lúc thắng/thua (victory()/defeat()).
    commitSession() {
        try {
            // 1. Tổng điểm "Trò chơi" — dùng CHUNG key với mọi game
            const prevTotal = JSON.parse(localStorage.getItem("result_battle")) || { score: 0, total: 0 };
            const updatedTotal = {
                score: (prevTotal.score || 0) + this.session.correctCount,
                total: (prevTotal.total || 0) + this.session.totalCount,
            };
            localStorage.setItem("result_battle", JSON.stringify(updatedTotal));

            // 2. Chi tiết theo 4 kỹ năng — cộng dồn qua mọi ván, mọi game
            const defaultSkills = () => ({
                intro: { correct: 0, total: 0 },
                listening: { correct: 0, total: 0 },
                speaking: { correct: 0, total: 0 },
                reading: { correct: 0, total: 0 },
                writing: { correct: 0, total: 0 },
            });
            const prevSkills = JSON.parse(localStorage.getItem("pkm_skill_scores")) || defaultSkills();
            Object.keys(this.session.skillStats).forEach(skill => {
                if (!prevSkills[skill]) prevSkills[skill] = { correct: 0, total: 0 };
                prevSkills[skill].correct += this.session.skillStats[skill].correct;
                prevSkills[skill].total += this.session.skillStats[skill].total;
            });
            localStorage.setItem("pkm_skill_scores", JSON.stringify(prevSkills));

            if (!localStorage.getItem("startTime_global")) {
                localStorage.setItem("startTime_global", Date.now().toString());
            }

            console.log("📊 [PkmScore] Đã ghi cộng dồn:", updatedTotal, prevSkills);
        } catch (e) {
            console.error("❌ [PkmScore] Lỗi lưu kết quả:", e);
        }
    },
};
