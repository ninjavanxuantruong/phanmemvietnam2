// ✅ URL Google Sheet 1: lịch học lớp
const SCHEDULE_URL = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";

// ✅ URL Google Sheet 2: danh sách từ vựng
const VOCAB_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

// ✅ Biến toàn cục
let suggestedUnitRaw = "";     // ví dụ: "6-3-1 Getting Started"
let normalizedUnitCode = "";   // ví dụ: "631"
let wordBank = [];             // từ vựng lấy từ Sheet 2

// ✅ Hàm chuẩn hóa mã bài học
function normalizeUnit(str) {
  if (!str || typeof str !== "string") return "";
  return str
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^0-9]/g, "")
    .trim();
}

// ✅ Hàm chuyển ngày hôm nay thành số nguyên kiểu ddmmyyyy
function getTodayAsNumber() {
  const now = new Date();
  const dd = now.getDate();
  const mm = now.getMonth() + 1;
  const yyyy = now.getFullYear();
  return parseInt(`${dd}${mm}${yyyy}`); // ví dụ: 3082025
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ✅ Hàm lấy tên bài học chuẩn từ Sheet 2 theo mã
async function resolveLessonNameFromSheet2(unitCode) {
  try {
    const res = await fetch(VOCAB_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    for (let row of rows) {
      const unitRaw = row.c[1]?.v?.toString().trim();
      const unitNormalized = normalizeUnit(unitRaw);

      console.log("🔍 Đang dò tên bài học từ Sheet 2:", {
        unitRaw,
        unitNormalized,
        targetCode: unitCode
      });

      if (unitNormalized === unitCode) {
        suggestedUnitRaw = unitRaw;
        document.getElementById("suggestedLesson").textContent = suggestedUnitRaw;
        console.log("✅ Đã cập nhật tên bài học chuẩn từ Sheet 2:", suggestedUnitRaw);
        return;
      }
    }

    console.warn("⚠️ Không tìm thấy tên bài học tương ứng trong Sheet 2");

  } catch (err) {
    console.error("❌ Lỗi khi dò tên bài học từ Sheet 2:", err);
  }
}

// ✅ Hàm lấy bài học hôm nay từ Sheet 1
async function fetchSuggestedLesson() {
  const className = localStorage.getItem("trainerClass")?.trim().toLowerCase();
  const isVerified = localStorage.getItem("isVerifiedStudent") === "true";
  const todayNum = getTodayAsNumber();

  console.log("🔍 Lớp học:", className);
  console.log("🔍 Số ngày hôm nay:", todayNum);
  console.log("🔍 Đã xác thực:", isVerified);

  if (!isVerified) {
    document.getElementById("btnLearnSuggested").disabled = true;
    document.getElementById("suggestedLesson").textContent = "Bạn chưa được thầy Tình cấp nick. Hãy chọn bài khác.";
    console.warn("❌ Học sinh chưa xác thực. Ẩn chức năng 1.");
    return;
  }

  try {
    const res = await fetch(SCHEDULE_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    for (let row of rows) {
      const sheetClass = row.c[0]?.v?.toString().trim().toLowerCase();
      const sheetDateRaw = row.c[1]?.v?.toString().trim();
      const sheetDateNum = parseInt(sheetDateRaw.replaceAll("/", "").replaceAll("-", ""));
      console.log(`🔍 Dòng đang xét: lớp=${sheetClass}, ngày=${sheetDateRaw}, bài=${row.c[2]?.v}`);
      console.log(`🔍 So sánh ngày số: ${sheetDateNum} === ${todayNum} →`, sheetDateNum === todayNum);

      if (sheetClass === className && sheetDateNum === todayNum) {
        const sheetLesson = row.c[2]?.v?.toString().trim();
        suggestedUnitRaw = sheetLesson;
        normalizedUnitCode = normalizeUnit(sheetLesson);

        // ✅ Gọi hàm để lấy tên chuẩn từ Sheet 2
        await resolveLessonNameFromSheet2(normalizedUnitCode);

        console.log("✅ Mã bài chuẩn hóa:", normalizedUnitCode);
        return;
      }
    }

    document.getElementById("suggestedLesson").textContent = "Không có bài học đề xuất hôm nay.";
    document.getElementById("btnLearnSuggested").disabled = true;
    console.warn("📭 Không tìm thấy bài học hôm nay trong lịch lớp.");

  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu lịch học:", err);
  }
}

// ✅ Hàm lấy từ vựng từ Sheet 2 theo mã bài
async function fetchVocabularyFromUnit(unitCode) {
  try {
    const res = await fetch(VOCAB_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    wordBank = [];

    rows.forEach(row => {
      const unitRaw = row.c[1]?.v?.toString().trim();
      const word = row.c[2]?.v?.toString().trim();
      const unitNormalized = normalizeUnit(unitRaw);

      console.log("🔍 Đang xét dòng từ Sheet 2:", {
        unitRaw,
        unitNormalized,
        targetCode: unitCode
      });

      if (unitNormalized === unitCode) {
        wordBank.push(word);
      }
    });

    wordBank = shuffleArray(wordBank);

    console.log("📦 Từ vựng lấy được:", wordBank);

    if (wordBank.length === 0) {
      alert("Không tìm thấy từ vựng cho bài học này.");
      return;
    }

    localStorage.setItem("wordBank", JSON.stringify(wordBank));
    localStorage.setItem("victoryTotalWords", wordBank.length);
    localStorage.setItem("selectedLesson", suggestedUnitRaw);
    window.location.href = "exercise.html";

  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu từ vựng:", err);
  }
}

// ✅ Gắn sự kiện cho các nút
document.addEventListener("DOMContentLoaded", () => {
  fetchSuggestedLesson();

  const btn1 = document.getElementById("btnLearnSuggested");
  const btn2 = document.getElementById("btnChooseOther");
  const btn3 = document.getElementById("btnClassCompetition");

  if (btn1) {
    btn1.addEventListener("click", () => {
      console.log("🎯 Đã ấn nút học bài đề xuất");
      if (normalizedUnitCode) {
        fetchVocabularyFromUnit(normalizedUnitCode);
      } else {
        alert("Không có bài học đề xuất hôm nay.");
      }
    });
  }

  if (btn2) {
    btn2.addEventListener("click", () => {
      console.log("📚 Đã ấn nút chọn bài khác");
      window.location.href = "script.html";
    });
  }

  if (btn3) {
    btn3.addEventListener("click", () => {
      console.log("🏆 Đã ấn nút cuộc thi cả lớp");
      alert("Chức năng cuộc thi sẽ được cập nhật sau!");
    });
  }
});
