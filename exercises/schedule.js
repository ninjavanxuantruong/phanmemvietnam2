// ✅ URL Google Sheet
const SCHEDULE_URL = "https://docs.google.com/spreadsheets/d/1xdGIaXekYFQqm1K6ZZyX5pcrmrmjFdSgTJeW27yZJmQ/gviz/tq?tqx=out:json";
const VOCAB_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";


// ✅ Biến toàn cục
let wordBank = [];
let suggestedUnitRaw = "";
let normalizedUnitCode = "";

const spacedConfig = {
  "2": [4, 11, 25],
  "3": [4, 11, 25],
  "4": [4, 11, 25],
  "5": [4, 11, 25],
  "6": [4, 11, 25]
};

// ✅ Chuẩn hóa mã bài
function normalizeUnit(str) {
  if (!str || typeof str !== "string") return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^0-9]/g, "").trim();
}

function extractCodeFromTitle(title) {
  if (!title || typeof title !== "string") return "";

  // Tách theo dấu cách hoặc dấu gạch
  const parts = title.trim().split(/[-\s.]+/);

  // Kiểm tra đúng định dạng: 1 số - 2 số - 1 số
  if (parts.length >= 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
    return parts[0] + parts[1] + parts[2]; // Ví dụ: "4" + "04" + "1" → "4041"
  }

  return ""; // Không khớp định dạng
}


async function resolveTitlesFromSheet2(codeList) {
  const res = await fetch(VOCAB_URL);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const titleMap = {};

  for (let row of rows) {
    const rawTitle = row.c[1]?.v?.toString().trim(); // cột B: tiêu đề bài học
    if (!rawTitle) continue;

    const code = extractCodeFromTitle(rawTitle); // ✅ tách đúng mã bài từ tiêu đề
    if (codeList.includes(code)) {
      titleMap[code] = rawTitle; // ✅ giữ nguyên tiêu đề gốc
    }
  }

  return titleMap;
}



// ✅ Chuyển ngày dạng "dd/mm/yyyy" → "yyyy-mm-dd"
function convertSheetDateToISO(dateStr) {
  if (!dateStr || typeof dateStr !== "string") return "";
  const parts = dateStr.split("/").map(p => p.trim());
  if (parts.length !== 3) return "";

  let [dd, mm, yyyy] = parts;
  if (dd.length === 1) dd = "0" + dd;
  if (mm.length === 1) mm = "0" + mm;

  const isoStr = `${yyyy}-${mm}-${dd}`;
  const testDate = new Date(isoStr);
  if (isNaN(testDate.getTime())) {
    console.warn("⚠️ Ngày không hợp lệ:", dateStr);
    return "";
  }

  return isoStr;
}

// ✅ Xáo trộn mảng (Fisher–Yates shuffle)
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


// ✅ Hàm thêm bài vào lịch với logic ưu tiên
function addLesson(schedule, iso, entry) {
  const priority = { new: 1, review: 2, related: 3, old: 4 };

  if (!schedule[iso]) {
    schedule[iso] = entry;
    return;
  }

  const existing = schedule[iso];

  if (priority[entry.type] < priority[existing.type]) {
    // entry quan trọng hơn → đẩy bài cũ xuống
    let nextDate = new Date(iso);
    nextDate.setDate(nextDate.getDate() + 1);
    addLesson(schedule, nextDate.toISOString().split("T")[0], existing);
    schedule[iso] = entry;
  } else {
    // entry kém ưu tiên hơn → đẩy entry xuống
    let nextDate = new Date(iso);
    nextDate.setDate(nextDate.getDate() + 1);
    addLesson(schedule, nextDate.toISOString().split("T")[0], entry);
  }
}


// ✅ Tạo lịch học từ ngày gốc
function generateLessonSchedule(mainCode, relatedCodes, baseDateStr, reviewOffsets) {
  const baseDate = new Date(baseDateStr);
  const schedule = [];
  const usedDates = new Map(); // date → số lượng bài đã gán
  const newLessonDates = new Set(); // ✅ ngày đã có bài mới

  // ✅ Gán bài mới vào ngày gốc — luôn đứng một mình
  const baseISO = baseDate.toISOString().split("T")[0];
  schedule.push({ date: baseISO, code: mainCode, type: "new", relatedTo: mainCode });
  usedDates.set(baseISO, 1);
  newLessonDates.add(baseISO); // ✅ đánh dấu ngày có bài mới

  // ✅ Gán bài ôn tập vào các ngày offset
  for (let offset of reviewOffsets) {
    const d = new Date(baseDate);
    d.setDate(d.getDate() + offset);
    let iso = d.toISOString().split("T")[0];

    // ✅ Nếu ngày có bài mới hoặc đã đủ 2 bài → lùi
    while (newLessonDates.has(iso) || (usedDates.get(iso) || 0) >= 2) {
      d.setDate(d.getDate() + 1);
      iso = d.toISOString().split("T")[0];
    }

    schedule.push({ date: iso, code: mainCode, type: "review", relatedTo: mainCode });
    usedDates.set(iso, (usedDates.get(iso) || 0) + 1);
  }

  // ✅ Gán bài liên quan vào các ngày tiếp theo
  let relatedIndex = 0;
  let nextDate = new Date(baseDate);
  while (relatedIndex < relatedCodes.length) {
    nextDate.setDate(nextDate.getDate() + 1);
    let iso = nextDate.toISOString().split("T")[0];

    // ✅ Nếu ngày có bài mới hoặc đã đủ 2 bài → lùi
    while (newLessonDates.has(iso) || (usedDates.get(iso) || 0) >= 2) {
      nextDate.setDate(nextDate.getDate() + 1);
      iso = nextDate.toISOString().split("T")[0];
    }

    schedule.push({ date: iso, code: relatedCodes[relatedIndex], type: "related", relatedTo: mainCode });
    usedDates.set(iso, (usedDates.get(iso) || 0) + 1);
    relatedIndex++;
  }

  console.log(`📅 Lịch học tạo từ ngày ${baseDateStr} cho bài ${mainCode}:`, schedule);
  return schedule;
}

function buildFullScheduleFromLessons(lessonList, reviewOffsets) {
  const schedule = {};

  // Bước 1: Gán bài mới
  for (let lesson of lessonList) {
    const iso = lesson.baseDate;
    if (!iso) continue;

    addLesson(schedule, iso, {
      code: lesson.code,
      title: lesson.title,
      type: "new",
      relatedTo: lesson.code
    });
  }

  // Bước 2: Gán bài ôn tập
  for (let lesson of lessonList) {
    for (let offset of reviewOffsets) {
      const d = new Date(lesson.baseDate);
      d.setDate(d.getDate() + offset);
      const iso = d.toISOString().split("T")[0];

      addLesson(schedule, iso, {
        code: lesson.code,
        title: lesson.code,
        type: "review",
        relatedTo: lesson.code
      });
    }
  }

  // Bước 3: Gán bài liên quan
  for (let lesson of lessonList) {
    let d = new Date(lesson.baseDate);
    d.setDate(d.getDate() + 1);

    for (let relatedCode of lesson.relatedCodes || []) {
      const iso = d.toISOString().split("T")[0];

      addLesson(schedule, iso, {
        code: relatedCode,
        title: relatedCode,
        type: "related",
        relatedTo: lesson.code
      });

      d.setDate(d.getDate() + 1);
    }
  }

  console.log("📅 Lịch học đã xây dựng:", schedule);
  return schedule;
}



// ✅ Tạo lại toàn bộ lịch học từ Sheet theo lớp
async function generateFullScheduleFromSheet(className) {
  try {
    const res = await fetch(SCHEDULE_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    const lessonList = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      if (!row || !row.c || !row.c[0] || !row.c[1] || !row.c[2]) continue;

      const sheetClass = row.c[0].v.toString().trim().toLowerCase();
      if (!sheetClass.includes(className)) continue;

      const mainRaw = row.c[2].v.toString().trim();
      const relatedRaw = row.c[3]?.v?.toString().trim() || "";

      const mainCode = normalizeUnit(mainRaw);
      const relatedCodes = relatedRaw
        ? relatedRaw.split(",").map(code => normalizeUnit(code.trim())).filter(Boolean)
        : [];

      const rawDate = row.c[1].v.toString().trim();
      const baseDate = convertSheetDateToISO(rawDate);

      lessonList.push({
        code: mainCode,
        title: mainRaw,
        relatedCodes,
        baseDate
      });
    }

    const reviewOffsets = spacedConfig[className] || [4, 11, 25];
    const fullSchedule = buildFullScheduleFromLessons(lessonList, reviewOffsets);

    // Tính ngày xa nhất có thể (KHÔNG lưu vào lịch)
    const lastLesson = lessonList[lessonList.length - 1];
    let maxDate = new Date(lastLesson.baseDate);
    const maxOffset = Math.max(...reviewOffsets);
    maxDate.setDate(maxDate.getDate() + maxOffset);
    if (lastLesson.relatedCodes && lastLesson.relatedCodes.length > 0) {
      maxDate.setDate(maxDate.getDate() + lastLesson.relatedCodes.length);
    }
    const maxDateISO = maxDate.toISOString().split("T")[0];

    // Ghi lịch mới
    const docRef = window.doc(window.db, "lich", className);
    await window.setDoc(docRef, fullSchedule);
    console.log("✅ Đã ghi toàn bộ lịch mới vào Firebase cho lớp:", className);

    // Bổ sung bài cũ dùng maxDate tính sẵn (không cần _maxDate trong doc)
    await autoFillOldLessons(className, fullSchedule, maxDateISO);

    // Hiển thị
    renderFullScheduleFromFirebase(className);
    showTodayLessonFromFirebase(className);
  } catch (err) {
    console.error("❌ Lỗi khi tạo lại lịch học:", err.message);
  }
}



async function autoFillOldLessons(className, currentSchedule) {
  console.log("📌 Bắt đầu bổ sung bài cũ cho lớp:", className);

  const todayISO = new Date().toISOString().split("T")[0];
  const bosungRef = window.doc(window.db, "bosung", className);

  // ✅ Lấy dữ liệu bổ sung cũ từ Firebase
  const bosungSnap = await window.getDoc(bosungRef);
  const oldBosung = bosungSnap.exists() ? bosungSnap.data() : {};

  // ✅ Giữ lại các ngày trước hôm nay
  const preserved = {};
  for (let date in oldBosung) {
    if (date < todayISO) {
      preserved[date] = oldBosung[date];
    }
  }

  // ✅ Loại trừ tất cả mã bài đã có trong lịch
  const usedCodes = Object.values(currentSchedule).map(item => normalizeUnit(item.code));

  // ✅ Loại trừ thêm các bài bổ sung trước hôm nay
  const preservedCodes = Object.values(preserved).map(item => normalizeUnit(item.code));

  // ✅ Tìm bài cũ từ Sheet 2
  const res = await fetch(VOCAB_URL);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const allUnits = rows.map(row => {
    const raw = row.c[1]?.v?.toString().trim();
    return extractCodeFromTitle(raw);
  }).filter(Boolean);

  const newCodes = Object.values(currentSchedule)
    .filter(item => item.type === "new")
    .map(item => normalizeUnit(item.code));

  const highestCode = newCodes.sort().reverse()[0];
  const sortedOldUnits = allUnits.filter(code => code < highestCode);

  // ✅ Tìm các ngày trống từ hôm nay trở đi
  let maxDate;
  if (currentSchedule._maxDate) {
    maxDate = new Date(currentSchedule._maxDate);
  } else {
    const allDates = Object.keys(currentSchedule).sort((a, b) => new Date(a) - new Date(b));
    maxDate = new Date(allDates[allDates.length - 1]);
  }


  const emptyDates = [];
  const d = new Date(todayISO);
  while (d <= maxDate) {
    const iso = d.toISOString().split("T")[0];
    if (!currentSchedule[iso]) emptyDates.push(iso);
    d.setDate(d.getDate() + 1);
  }

  console.log("📅 Ngày trống cần bổ sung:", emptyDates);

  // ✅ Loại trừ bài đã học và bài từng bổ sung trước hôm nay
  let excluded = new Set([...usedCodes, ...preservedCodes]);
  let finalUnits = [...new Set(sortedOldUnits.filter(code => !excluded.has(code)))];

  // ✅ Random danh sách bài còn lại
  finalUnits = shuffleArray(finalUnits);

  // ✅ Nếu không đủ bài để gán → cho phép dùng lại bài đã từng bổ sung
  const totalNeeded = emptyDates.length;
  if (finalUnits.length < totalNeeded) {
    console.warn("⚠️ Không đủ bài mới để bổ sung, cho phép dùng lại bài đã từng bổ sung trước hôm nay");
    excluded = new Set(usedCodes); // bỏ preservedCodes ra khỏi excluded
    finalUnits = [...new Set(sortedOldUnits.filter(code => !excluded.has(code)))];
    finalUnits = shuffleArray(finalUnits); // random lại
  }

  // ✅ Tra title từ Sheet 2
  const titleMap = {};
  for (let row of rows) {
    const rawTitle = row.c[1]?.v?.toString().trim();
    const code = extractCodeFromTitle(rawTitle);
    if (finalUnits.includes(code)) {
      titleMap[code] = rawTitle;
    }
  }

  // ✅ Gán bài bổ sung vào lịch và bosung mới — mỗi ngày 1 bài
  const bosungSchedule = {};
  let unitIndex = 0;

  for (let date of emptyDates) {
    if (unitIndex >= finalUnits.length) unitIndex = 0; // quay vòng nếu hết bài

    const code = finalUnits[unitIndex];
    const entry = {
      code,
      title: titleMap[code] || code,
      type: "old",
      relatedTo: ""
    };

    addLesson(currentSchedule, date, entry); // dùng addLesson để tránh xung đột
    bosungSchedule[date] = entry;

    console.log(`📅 Gán bài bổ sung ${code} vào ngày ${date}`);
    unitIndex++;
  }

  // ✅ Ghi lịch mới vào Firebase
  const docRef = window.doc(window.db, "lich", className);
  await window.setDoc(docRef, currentSchedule);

  // ✅ Gộp dữ liệu cũ + mới → ghi vào bosung
  const finalBosung = { ...preserved, ...bosungSchedule };
  await window.setDoc(bosungRef, finalBosung);

  console.log("✅ Đã cập nhật lịch bổ sung:", finalBosung);
}




// ✅ Hiển thị bảng lịch học từ hôm nay trở đi (mỗi ngày 1 bài duy nhất)
async function renderFullScheduleFromFirebase(className) {
  const docRef = window.doc(window.db, "lich", className);

  try {
    const snapshot = await window.getDoc(docRef);
    if (!snapshot.exists()) {
      console.warn("📭 Không có lịch học nào trong Firebase cho lớp", className);
      return;
    }

    const data = snapshot.data();
    const tableBody = document.querySelector("#scheduleTable tbody");
    tableBody.innerHTML = "";

    // Sắp xếp ngày tăng dần
    const entries = Object.entries(data)
      .sort(([a], [b]) => new Date(a) - new Date(b));

    let stt = 1;
    for (let [dateStr, lesson] of entries) {
      // lesson là object duy nhất
      const label =
        lesson.type === "new"
          ? "Bài mới - Phải học"
          : lesson.type === "review"
          ? "Ôn tập bài mới - Nên học"
          : lesson.type === "related"
          ? "Bài liên quan bài mới - Nên học"
          : lesson.type === "old"
          ? "Bài cũ"
          : lesson.type;

      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${stt++}</td>
        <td>${dateStr}</td>
        <td>${lesson.title}</td>
        <td>${label}</td>
        <td>${lesson.relatedTo || ""}</td>
      `;
      tableBody.appendChild(row);
    }

    console.log("📋 Đã hiển thị lịch học từ hôm nay trở đi cho lớp", className);
  } catch (err) {
    console.error("❌ Lỗi khi hiển thị bảng lịch học:", err.message);
  }
}

// ✅ Hiển thị bảng lịch học từ hôm nay trở đi
// ✅ Hiển thị bảng lịch học từ hôm nay trở đi (mỗi ngày 1 bài duy nhất)
async function showTodayLessonFromFirebase(className) {
  const todayISO = new Date().toISOString().split("T")[0];
  const docRef = window.doc(window.db, "lich", className);

  try {
    const snapshot = await window.getDoc(docRef);
    if (!snapshot.exists()) return;

    const data = snapshot.data();
    const todayLesson = data[todayISO];
    if (!todayLesson) {
      console.warn("📭 Không có bài học nào hôm nay cho lớp", className);
      return;
    }

    renderLessonChecklist(todayLesson);
  } catch (err) {
    console.error("❌ Lỗi khi hiển thị bài học hôm nay:", err.message);
  }
}



// ✅ Hiển thị danh sách bài học hôm nay để chọn
function renderLessonChecklist(todayLesson) {
  const container = document.getElementById("lessonList");
  container.innerHTML = "";

  const label =
    todayLesson.type === "new"
      ? "Bài mới"
      : todayLesson.type === "related"
      ? `Liên quan đến ${todayLesson.relatedTo}`
      : todayLesson.type === "old"
      ? "Bài cũ"
      : `Ôn tập của ${todayLesson.relatedTo}`;

  const div = document.createElement("div");
  div.innerHTML = `
    <label>
      <input type="checkbox" value="${normalizeUnit(todayLesson.code)}" data-title="${todayLesson.title}" />
      ${todayLesson.title} (${label})
    </label>
  `;
  container.appendChild(div);

  console.log("📑 Đã hiển thị bài học hôm nay:", todayLesson);
  document.getElementById("btnLearnSuggested").disabled = false;
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
    if (todayLessons.length === 0) {
      console.warn("📭 Không có bài học nào hôm nay cho lớp", className);
      return;
    }

    renderLessonChecklist(todayLessons);
  } catch (err) {
    console.error("❌ Lỗi khi hiển thị bài học hôm nay:", err.message);
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

    console.log("📦 Từ vựng đã lấy:", wordBank);
    localStorage.setItem("wordBank", JSON.stringify(wordBank));
    localStorage.setItem("victoryTotalWords", wordBank.length);
    window.location.href = "exercise.html";
  } catch (err) {
    console.error("❌ Lỗi khi lấy từ vựng:", err);
  }
}

// ✅ Gắn sự kiện khi trang tải
document.addEventListener("DOMContentLoaded", () => {
  const classSelect = document.getElementById("classSelect");
  if (classSelect) {
    classSelect.addEventListener("change", () => {
      const className = classSelect.value.trim().toLowerCase();
      if (!className) return;
      console.log("🎯 Đã chọn lớp:", className);
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

      console.log("🎯 Đã chọn học các bài:", selectedTitles);
      fetchVocabularyFromMultipleUnits(selectedCodes);
    });
  }
});
