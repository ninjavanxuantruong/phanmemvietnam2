// 📌 URL API Google Sheets
let url = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";
let wordBank = []; // Danh sách từ vựng đã chọn

// 📌 Hàm lấy dữ liệu từ Google Sheets
async function fetchGoogleSheetsData() {
    try {
        let response = await fetch(url);
        let text = await response.text();
        let jsonData = JSON.parse(text.substring(47).slice(0, -2));

        let rows = jsonData.table.rows;
        let topicSet = new Set();
        let unitSet = new Set();

        rows.forEach(row => {
            if (row.c[0]?.v) topicSet.add(row.c[0].v);
            if (row.c[1]?.v) unitSet.add(row.c[1].v);
        });

        let topicSelect = document.getElementById("topicSelect");
        let unitSelect = document.getElementById("unitSelect");

        topicSet.forEach(topic => {
            let option = document.createElement("option");
            option.value = topic;
            option.textContent = topic;
            topicSelect.appendChild(option);
        });

        unitSet.forEach(unit => {
            let option = document.createElement("option");
            option.value = unit;
            option.textContent = unit;
            unitSelect.appendChild(option);
        });

    } catch (error) {
        console.error("❌ Lỗi khi tải dữ liệu:", error);
    }
}

// 📌 Hàm lấy danh sách từ vựng theo lựa chọn của người dùng
function loadWords() {
    let selectedTopic = document.getElementById("topicSelect").value;
    let selectedUnit = document.getElementById("unitSelect").value;
    let userWords = document.getElementById("wordListInput").value.split(/[,.;:\s]+/).filter(word => word.trim() !== "");

    wordBank = [];

    fetch(url).then(response => response.text()).then(text => {
        let jsonData = JSON.parse(text.substring(47).slice(0, -2));
        let rows = jsonData.table.rows;

        rows.forEach(row => {
            let topic = row.c[0]?.v || "";
            let unit = row.c[1]?.v || "";
            let word = row.c[2]?.v || "";

            if ((selectedTopic && topic === selectedTopic) || 
                (selectedUnit && unit.toString() === selectedUnit) || 
                (userWords.includes(word))) {
                wordBank.push(word);
            }

        });

        wordBank = shuffleArray(wordBank);

        document.getElementById("wordDisplay").innerHTML = `<p>${wordBank.join(", ")}</p>`;
        document.getElementById("exerciseButton").style.display = "block";
    });
}

// 📌 Hàm xáo trộn từ vựng
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        let j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

// 📌 Hàm chuyển sang phần bài tập
function startExercises() {
     localStorage.setItem("wordBank", JSON.stringify(wordBank));
     localStorage.setItem("victoryTotalWords", wordBank.length);  // 🆕 Biến RIÊNG cho checkVictory
     console.log("🔍 Số từ phục vụ kiểm tra chiến thắng:", localStorage.getItem("victoryTotalWords"));

     window.location.href = "exercise.html";

}

// 🚀 Khởi chạy khi tải trang
document.addEventListener("DOMContentLoaded", fetchGoogleSheetsData);
