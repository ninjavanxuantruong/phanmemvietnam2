// ✅ URL Google Sheet
const SCHEDULE_URL = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
const VOCAB_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

// ✅ Biến toàn cục
let suggestedUnitRaw = "";
let normalizedUnitCode = "";
let wordBank = [];

const spacedConfig = {
  "2": [4, 11, 25],
  "3": [4, 11, 25],
  "4": [4, 11, 25],
  "5": [4, 11, 25],
  "6": [4, 11, 25]
};

// ✅ Hàm tiện ích
function normalizeUnit(str) {
  if (!str || typeof str !== "string") return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^0-9]/g, "").trim();
}

function getTodayAsNumber() {
  const now = new Date();
  return parseInt(`${now.getDate()}${now.getMonth() + 1}${now.getFullYear()}`);
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

// ✅ Lấy tên bài học từ Sheet 2
async function resolveLessonNameFromSheet2(unitCode) {
  try {
    const res = await fetch(VOCAB_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    for (let row of rows) {
      const unitRaw = row.c[1]?.v?.toString().trim();
      if (normalizeUnit(unitRaw) === unitCode) {
        suggestedUnitRaw = unitRaw;
        return;
      }
    }
  } catch (err) {
    console.error("❌ Lỗi khi dò tên bài học:", err);
  }
}

// ✅ Lấy bài học hôm nay từ Sheet 1
async function fetchSuggestedLesson(className) {
  const todayNum = getTodayAsNumber();

  try {
    const res = await fetch(SCHEDULE_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    for (let row of rows) {
      const sheetClass = row.c[0]?.v?.toString().trim().toLowerCase();
      const sheetDateRaw = row.c[1]?.v?.toString().trim();
      const sheetDateNum = parseInt(sheetDateRaw.replaceAll("/", "").replaceAll("-", ""));
      const sheetLesson = row.c[2]?.v?.toString().trim();
      const relatedRaw = row.c[3]?.v?.toString().trim();

      if (sheetClass === className && sheetDateNum === todayNum) {
        suggestedUnitRaw = sheetLesson;
        normalizedUnitCode = normalizeUnit(sheetLesson);
        await resolveLessonNameFromSheet2(normalizedUnitCode);

        const relatedCodes = relatedRaw
          ? relatedRaw.split(",").map(code => normalizeUnit(code.trim())).filter(Boolean)
          : [];

        const res2 = await fetch(VOCAB_URL);
        const text2 = await res2.text();
        const json2 = JSON.parse(text2.substring(47).slice(0, -2));
        const rows2 = json2.table.rows;

        const relatedTitles = relatedCodes.map(code => {
          const found = rows2.find(row => normalizeUnit(row.c[1]?.v) === code);
          return found ? { code, title: found.c[1]?.v } : { code, title: code };
        });

        const baseDateStr = new Date().toISOString().split("T")[0];
        const reviewOffsets = spacedConfig[className] || [4, 11, 25];
        const scheduleArray = generateLessonSchedule(normalizedUnitCode, relatedCodes, baseDateStr, reviewOffsets);

        mergeScheduleWithFirebase(scheduleArray, relatedTitles, suggestedUnitRaw, className);
        return;
      }
    }

    document.getElementById("lessonList").innerHTML = "<p>Không có bài học đề xuất hôm nay.</p>";
    document.getElementById("btnLearnSuggested").disabled = true;
  } catch (err) {
    console.error("❌ Lỗi khi lấy dữ liệu lịch học:", err);
  }
}

// ✅ Tính toán lịch học theo ngày ISO
function generateLessonSchedule(mainCode, relatedCodes, baseDateStr, reviewOffsets) {
  const baseDate = new Date(baseDateStr);
  const schedule = [];

  schedule.push({ date: baseDateStr, code: mainCode, type: "new", relatedTo: "" });

  for (let offset of reviewOffsets) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offset);
    schedule.push({ date: d.toISOString().split("T")[0], code: mainCode, type: "review", relatedTo: mainCode });
  }

  let relatedIndex = 0;
  let nextDate = new Date(baseDate);
  const usedDates = new Set(schedule.map(item => item.date));

  while (relatedIndex < relatedCodes.length) {
    nextDate.setDate(nextDate.getDate() + 1);
    const dateStr = nextDate.toISOString().split("T")[0];
    if (usedDates.has(dateStr)) continue;

    schedule.push({ date: dateStr, code: relatedCodes[relatedIndex], type: "related", relatedTo: mainCode });
    usedDates.add(dateStr);
    relatedIndex++;
  }

  return schedule;
}

// ✅ Gộp và ghi lịch học vào Firebase
async function mergeScheduleWithFirebase(scheduleArray, relatedTitles, mainTitle, className) {
  const docRef = window.doc(window.db, "lich", className);

  try {
    const snapshot = await window.getDoc(docRef);
    const existingData = snapshot.exists() ? snapshot.data() : {};
    const merged = { ...existingData };

    const todayISO = new Date().toISOString().split("T")[0];
    const todayMainCode = scheduleArray.find(i => i.date === todayISO && i.type === "new")?.code;
    const normalizedTodayMainCode = normalizeUnit(todayMainCode || "");

    for (let date in merged) {
      merged[date] = merged[date].filter(e =>
        !(normalizeUnit(e.relatedTo) !== normalizedTodayMainCode && (e.type === "related" || e.type === "review"))
      );
    }

    scheduleArray.forEach(item => {
      const title = getTitleFromCode(item.code, relatedTitles, mainTitle);
      const entry = { code: item.code, title, type: item.type, relatedTo: item.relatedTo || "" };

      if (!merged[item.date]) merged[item.date] = [];
      const exists = merged[item.date].some(e =>
        normalizeUnit(e.code) === normalizeUnit(entry.code) && e.type === entry.type
      );
      if (!exists) merged[item.date].push(entry);
    });

    await window.setDoc(docRef, merged);
    console.log("📤 Đã ghi lịch học vào Firebase:", merged);
  } catch (err) {
    console.error("❌ Lỗi khi ghi lịch học:", err.message);
  }
}

// ✅ Hiển thị bài học hôm nay từ Firebase
async function showTodayLessonFromFirebase(className) {
  const todayISO = new Date().toISOString().split("T")[0];
  const docRef = window.doc(window.db, "lich", className);

  try {
    const snapshot = await window.getDoc(docRef);
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    const todayLessons = data[todayISO] || [];
    if (todayLessons.length === 0) return;

    const res = await fetch(VOCAB_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    const updatedLessons = todayLessons.map(item => {
      const found = rows.find(row => normalizeUnit(row.c[1]?.v) === item.code);
      const title = found?.c[1]?.v || item.title || item.code;
      return { ...item, title };
    });

    renderLessonChecklist(updatedLessons);
    document.getElementById("btnLearnSuggested").disabled = false;
  } catch (err) {
    console.error("❌ Lỗi khi hiển thị bài học hôm nay:", err.message);
  }
}

// ✅ Hiển thị bảng lịch học từ hôm nay trở đi
async function renderFullScheduleFromFirebase(className) {
  const docRef = window.doc(window.db, "lich", className);
  const today = new Date();

  try {
    const snapshot = await window.getDoc(docRef);
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    const tableBody = document.querySelector("#scheduleTable tbody");
    tableBody.innerHTML = "";

    const entries = Object.entries(data)
      .filter(([dateStr]) => new Date(dateStr) >= today)
      .sort(([a], [b]) => new Date(a) - new Date(b));

    let stt = 1;
    for (let [dateStr, lessons] of entries) {
      for (let lesson of lessons) {
        const row = document.createElement("tr");
        row.innerHTML = `
          <td>${stt++}</td>
          <td>${dateStr}</td>
          <td>${lesson.title}</td>
          <td>${lesson.type === "new" ? "Bài mới" : lesson.type === "review" ? "Ôn tập bài cũ" : "Bài liên quan"}</td>
          <td>${lesson.relatedTo || ""}</td>
        `;
        tableBody.appendChild(row);
      }
    }

    console.log("📋 Đã hiển thị lịch học từ hôm nay trở đi");
  } catch (err) {
    console.error("❌ Lỗi khi hiển thị bảng lịch học:", err.message);
  }
}

// ✅ Hiển thị danh sách bài học hôm nay để chọn
function renderLessonChecklist(todayLessons) {
  const container = document.getElementById("lessonList");
  container.innerHTML = "";

  const sorted = [...todayLessons].sort((a, b) => {
    const order = { new: 0, related: 1, review: 2 };
    return order[a.type] - order[b.type];
  });

  sorted.forEach(item => {
    const label = item.type === "new"
      ? "Bài mới"
      : item.type === "related"
      ? `Liên quan đến ${item.relatedTo}`
      : `Ôn tập của ${item.relatedTo}`;

    const div = document.createElement("div");
    div.innerHTML = `
      <label>
        <input type="checkbox" value="${normalizeUnit(item.code)}" data-title="${item.title}" />
        ${item.title} (${label})
      </label>
    `;
    container.appendChild(div);
  });

  document.getElementById("btnLearnSuggested").disabled = false;
}

// ✅ Lấy từ vựng từ một bài
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
      if (normalizeUnit(unitRaw) === unitCode) {
        wordBank.push(word);
      }
    });

    wordBank = shuffleArray(wordBank);

    if (wordBank.length === 0) {
      alert("Không tìm thấy từ vựng cho bài học này.");
      return;
    }

    localStorage.setItem("wordBank", JSON.stringify(wordBank));
    localStorage.setItem("victoryTotalWords", wordBank.length);
    localStorage.setItem("selectedLesson", suggestedUnitRaw);
    window.location.href = "exercise.html";
  } catch (err) {
    console.error("❌ Lỗi khi lấy từ vựng:", err);
  }
}

// ✅ Lấy từ vựng từ nhiều bài
async function fetchVocabularyFromMultipleUnits(unitCodes) {
  try {
    const res = await fetch(VOCAB_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    wordBank = [];

    rows.forEach(row => {
      const unitRaw = row.c[1]?.v?.toString().trim();
      const word = row.c[2]?.v?.toString().trim();
      if (unitCodes.includes(normalizeUnit(unitRaw))) {
        wordBank.push(word);
      }
    });

    wordBank = shuffleArray(wordBank);

    if (wordBank.length === 0) {
      alert("Không tìm thấy từ vựng cho các bài đã chọn.");
      return;
    }

    localStorage.setItem("wordBank", JSON.stringify(wordBank));
    localStorage.setItem("victoryTotalWords", wordBank.length);
    window.location.href = "exercise.html";
  } catch (err) {
    console.error("❌ Lỗi khi lấy từ vựng:", err);
  }
}

// ✅ Dọn lịch cũ theo từng lớp
async function cleanOldScheduleFromFirebase() {
  const classList = ["2", "3", "4", "5", "6"];
  const THRESHOLD_DAYS = 30;
  const today = new Date();

  for (let className of classList) {
    const docRef = window.doc(window.db, "lich", className);
    try {
      const snapshot = await window.getDoc(docRef);
      if (!snapshot.exists()) continue;

      const data = snapshot.data();
      const cleaned = {};

      for (let dateStr in data) {
        const date = new Date(dateStr);
        const diffDays = (today - date) / (1000 * 60 * 60 * 24);
        if (diffDays <= THRESHOLD_DAYS) {
          cleaned[dateStr] = data[dateStr];
        } else {
          console.log(`🧹 Đã xóa lịch ngày ${dateStr} của lớp ${className}`);
        }
      }

      await window.setDoc(docRef, cleaned);
      console.log(`✅ Đã dọn lịch cũ cho lớp ${className}`);
    } catch (err) {
      console.error(`❌ Lỗi khi dọn lịch lớp ${className}:`, err.message);
    }
  }
}

// ✅ Lấy tiêu đề từ mã bài
function getTitleFromCode(code, relatedTitles, mainTitle) {
  if (normalizeUnit(mainTitle) === code) return mainTitle;
  const found = relatedTitles.find(item => item.code === code);
  return found ? found.title : code;
}

// ✅ Gắn sự kiện khi trang tải
document.addEventListener("DOMContentLoaded", () => {
  cleanOldScheduleFromFirebase();

  const classSelect = document.getElementById("classSelect");
  if (classSelect) {
    classSelect.addEventListener("change", () => {
      const className = classSelect.value.trim().toLowerCase();
      if (!className) return;
      showTodayLessonFromFirebase(className);
      renderFullScheduleFromFirebase(className);
    });
  }

  const btnLearn = document.getElementById("btnLearnSuggested");
  if (btnLearn) {
    btnLearn.addEventListener("click", () => {
      const checked = Array.from(document.querySelectorAll("#lessonList input[type='checkbox']:checked"));
      if (checked.length === 0) {
        alert("Bạn chưa chọn bài nào.");
        return;
      }

      const selectedCodes = checked.map(input => input.value);
      const selectedTitles = checked.map(input => input.dataset.title);

      alert("Bạn đã chọn: " + selectedTitles.join(", "));
      fetchVocabularyFromMultipleUnits(selectedCodes);
    });
  }
});
