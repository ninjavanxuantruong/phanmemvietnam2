// ===== Cấu hình & Biến toàn cục =====


const STICKMAN_ACTIONS = [
    { desc: "1", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(1).png" },
    { desc: "2", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(2).png" },
    { desc: "3", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(3).png" },
    { desc: "4", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(4).png" },
    { desc: "5", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(5).png" },
    { desc: "6", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(6).png" },
    { desc: "7", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(7).png" },
    { desc: "8", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(8).png" },
    { desc: "9", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(9).png" },
    { desc: "10", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(10).png" },
    { desc: "11", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(11).png" },
    { desc: "12", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(12).png" },
    { desc: "13", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(13).png" },
    { desc: "14", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(14).png" },
    { desc: "15", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(15).png" },
    { desc: "16", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(16).png" },
    { desc: "17", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(17).png" },
    { desc: "18", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(18).png" },
    { desc: "19", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(19).png" },
    { desc: "20", img: "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/e%20(20).png" }
];

let gamePool = [];
let currentIndex = 0;

// 1. Helper: Chuyển Unit dạng "3-1-1" thành số 3011 để so sánh
function normalizeUnitId(unitStr) {
    if (!unitStr) return 0;
    const parts = unitStr.split("-");
    if (parts.length < 3) return 0;
    return parseInt(parts[0], 10) * 1000 + parseInt(parts[1], 10) * 10 + parseInt(parts[2], 10);
}

// 2. Lấy Max Lesson Code theo lớp (Fetch lần 1)
async function getMaxLessonCode() {
    const trainerClass = localStorage.getItem("trainerClass")?.trim() || "";
    try {
        const res = await fetch(SHEET_BAI_HOC);
        const data = await res.json();
        const rows = data.rows || data;

        const baiList = rows.map((r) => {
            const lop = (r.c ? r.c[0]?.v : r[0])?.toString().trim();
            const bai = (r.c ? r.c[2]?.v : r[2])?.toString().trim();
            return lop === trainerClass && bai ? parseInt(bai, 10) : null;
        }).filter((v) => typeof v === "number");

        return baiList.length === 0 ? null : Math.max(...baiList);
    } catch (e) {
        console.error("Lỗi lấy maxLessonCode:", e);
        return null;
    }
}

// 3. Tải và lọc dữ liệu (Fetch lần 2)
async function fetchPhysicalData() {
    try {
        const maxCode = await getMaxLessonCode();
        const response = await fetch(SHEET_URL);
        const data = await response.json();
        const rows = data.rows || data;

        const selectedTopic = localStorage.getItem("selectedTopic") || "ALL";

        return rows.map(r => {
            const lessonName = (r.c ? r.c[1]?.v : r[1])?.toString() || "";
            const questionJ = (r.c ? r.c[9]?.v : r[9])?.toString() || "";   // Cột J
            const answerL = (r.c ? r.c[11]?.v : r[11])?.toString() || "";  // Cột L
            const topicValue = (r.c ? r.c[6]?.v : r[6])?.toString() || ""; // Cột G

            return {
                question: questionJ.trim(),
                answer: answerL.trim(),
                unitNum: normalizeUnitId(lessonName),
                topic: topicValue.trim()
            };
        }).filter(item => {
            const hasData = item.question && item.answer;
            const isInRange = item.unitNum >= 3011 && (maxCode ? item.unitNum <= maxCode : true);
            const matchesTopic = (selectedTopic === "ALL" || item.topic === selectedTopic);
            return hasData && isInRange && matchesTopic;
        });
    } catch (e) {
        console.error("Lỗi fetch dữ liệu:", e);
        return [];
    }
}

// 4. Chuẩn bị Game: 1 đúng - 1 sai (khác bài)
async function initGame() {
    const rawData = await fetchPhysicalData();
    if (rawData.length === 0) {
        document.getElementById("question").textContent = "Không có dữ liệu phù hợp!";
        return;
    }

    // Trộn ngẫu nhiên danh sách
    gamePool = rawData.sort(() => Math.random() - 0.5).map(item => {
        const correct = item.answer;

        // Lấy đáp án sai từ câu có unitNum khác
        let wrongPool = rawData.filter(d => d.unitNum !== item.unitNum);
        if (wrongPool.length === 0) {
            wrongPool = rawData.filter(d => d.answer !== correct);
        }

        const randomWrong = wrongPool[Math.floor(Math.random() * wrongPool.length)];
        const wrong = randomWrong ? randomWrong.answer : "N/A";

        // Bốc 2 động tác
        const actions = [...STICKMAN_ACTIONS].sort(() => 0.5 - Math.random());

        return {
            question: item.question,
            options: [
                { text: correct, isCorrect: true, action: actions[0] },
                { text: wrong, isCorrect: false, action: actions[1] }
            ].sort(() => 0.5 - Math.random())
        };
    });

    renderQuestion();
}

// 5. Hiển thị
function renderQuestion() {
    if (currentIndex >= gamePool.length) {
        alert("🎉 Chúc mừng! Bạn đã hoàn thành bài tập.");
        return;
    }

    const current = gamePool[currentIndex];
    document.getElementById("question").textContent = current.question;
    document.getElementById("current-step").textContent = currentIndex + 1;
    document.getElementById("total-step").textContent = gamePool.length;

    current.options.forEach((opt, i) => {
        document.getElementById(`text-${i}`).textContent = opt.text;
        document.getElementById(`img-${i}`).src = opt.action.img;
        document.getElementById(`desc-${i}`).textContent = `(${opt.action.desc})`;
    });
}

// 6. Kiểm tra đáp án
window.checkAnswer = function(idx) {
    const isCorrect = gamePool[currentIndex].options[idx].isCorrect;
    if (isCorrect) {
        currentIndex++;
        renderQuestion();
    } else {
        alert("❌ Sai rồi! Tập trung nhìn kỹ đáp án đúng nhé.");
    }
};

// Khởi động khi load trang
document.addEventListener("DOMContentLoaded", initGame);
