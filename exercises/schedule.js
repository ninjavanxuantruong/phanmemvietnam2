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
  const usedDates = new Map(); // date → số lượng bài đã gán
  const newLessonDates = [];   // danh sách bài mới đã gán

  // ✅ Bước 1: Gán bài mới vào ngày gốc
  for (let lesson of lessonList) {
    const iso = lesson.baseDate;
    if (!iso) continue;

    if (!schedule[iso]) schedule[iso] = [];
    schedule[iso].push({
      code: lesson.code,
      title: lesson.title,
      type: "new",
      relatedTo: lesson.code
    });

    usedDates.set(iso, (usedDates.get(iso) || 0) + 1);
    newLessonDates.push({ code: lesson.code, date: iso });
  }

  // ✅ Bước 2: Gán bài ôn tập theo offset từ ngày gốc
  for (let item of newLessonDates) {
    for (let offset of reviewOffsets) {
      const d = new Date(item.date);
      d.setDate(d.getDate() + offset);
      let iso = d.toISOString().split("T")[0];

      // ✅ Nếu ngày có bài mới hoặc đủ 2 bài → lùi
      while ((schedule[iso]?.some(e => e.type === "new")) || (usedDates.get(iso) || 0) >= 2) {
        d.setDate(d.getDate() + 1);
        iso = d.toISOString().split("T")[0];
      }

      if (!schedule[iso]) schedule[iso] = [];
      schedule[iso].push({
        code: item.code,
        title: item.code,
        type: "review",
        relatedTo: item.code
      });

      usedDates.set(iso, (usedDates.get(iso) || 0) + 1);
    }
  }

  // ✅ Bước 3: Gán bài liên quan sau bài mới
  for (let lesson of lessonList) {
    let d = new Date(lesson.baseDate);
    d.setDate(d.getDate() + 1); // bắt đầu từ ngày sau bài mới

    for (let relatedCode of lesson.relatedCodes || []) {
      let iso = d.toISOString().split("T")[0];

      // ✅ Nếu ngày có bài mới hoặc đủ 2 bài → lùi
      while ((schedule[iso]?.some(e => e.type === "new")) || (usedDates.get(iso) || 0) >= 2) {
        d.setDate(d.getDate() + 1);
        iso = d.toISOString().split("T")[0];
      }

      if (!schedule[iso]) schedule[iso] = [];
      schedule[iso].push({
        code: relatedCode,
        title: relatedCode,
        type: "related",
        relatedTo: lesson.code
      });

      usedDates.set(iso, (usedDates.get(iso) || 0) + 1);
      d.setDate(d.getDate() + 1); // tiếp tục ngày sau
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
      if (!row || !row.c || !row.c[0] || !row.c[1] || !row.c[2]) {
        console.warn(`⚠️ Bỏ qua dòng ${i + 1} vì thiếu dữ liệu`);
        continue;
      }

      const sheetClass = row.c[0].v.toString().trim().toLowerCase();
      if (!sheetClass.includes(className)) {
        console.warn(`⚠️ Bỏ qua dòng ${i + 1} vì lớp không khớp: lớp trong Sheet = ${sheetClass}, lớp đã chọn = ${className}`);
        continue;
      }

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
        baseDate // ✅ dùng ngày gốc từ Sheet
      });


    }

    const reviewOffsets = spacedConfig[className] || [4, 11, 25];
    const fullSchedule = buildFullScheduleFromLessons(lessonList, reviewOffsets);

    const docRef = window.doc(window.db, "lich", className);
    await window.setDoc(docRef, fullSchedule);
    console.log("✅ Đã ghi toàn bộ lịch mới vào Firebase cho lớp:", className);

    await autoFillOldLessons(className, fullSchedule);
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
  const usedCodes = Object.values(currentSchedule).flat().map(item => normalizeUnit(item.code));

  // ✅ Loại trừ thêm các bài bổ sung trước hôm nay
  const preservedCodes = Object.values(preserved).flat().map(item => normalizeUnit(item.code));

  // ✅ Tìm bài cũ từ Sheet 2
  const res = await fetch(VOCAB_URL);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const allUnits = rows.map(row => {
    const raw = row.c[1]?.v?.toString().trim();
    return extractCodeFromTitle(raw);
  }).filter(Boolean);

  const newCodes = Object.values(currentSchedule).flat()
    .filter(item => item.type === "new")
    .map(item => normalizeUnit(item.code));

  const highestCode = newCodes.sort().reverse()[0];
  const sortedOldUnits = allUnits
    .filter(code => code < highestCode)
    .sort((a, b) => {
      const [la, lb] = [parseInt(a[0]), parseInt(b[0])];
      return lb - la || b.localeCompare(a);
    });

  

  


  // ✅ Tìm các ngày trống từ hôm nay trở đi
  const allDates = Object.keys(currentSchedule).sort((a, b) => new Date(a) - new Date(b));
  const maxDate = new Date(allDates[allDates.length - 1]);

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

  // ✅ Nếu không đủ bài để gán → cho phép dùng lại bài đã từng bổ sung
  const totalNeeded = emptyDates.length * 2;
  if (finalUnits.length < totalNeeded) {
    console.warn("⚠️ Không đủ bài mới để bổ sung, cho phép dùng lại bài đã từng bổ sung trước hôm nay");
    excluded = new Set(usedCodes); // bỏ preservedCodes ra khỏi excluded
    finalUnits = [...new Set(sortedOldUnits.filter(code => !excluded.has(code)))];
  }

  // ✅ Log kiểm tra
  console.log("🔍 Tổng số bài cũ có thể dùng:", sortedOldUnits.length);
  console.log("🔍 Số bài đã học:", usedCodes.length);
  console.log("🔍 Số bài đã từng bổ sung:", preservedCodes.length);
  console.log("🔍 Tổng số bài bị loại:", excluded.size);
  console.log("🔍 Bài còn lại để bổ sung:", finalUnits.length);
  console.log("🔍 Danh sách bài còn lại:", finalUnits);

  // ✅ Tra title từ Sheet 2
  const titleMap = {};
  for (let row of rows) {
    const rawTitle = row.c[1]?.v?.toString().trim();
    const code = extractCodeFromTitle(rawTitle);
    if (finalUnits.includes(code)) {
      titleMap[code] = rawTitle;
    }


  }

  // ✅ Gán bài bổ sung vào lịch và bosung mới — mỗi ngày 1 bài khác nhau
  const bosungSchedule = {};
  let unitIndex = 0;

  for (let date of emptyDates) {
    const entries = [];

    for (let j = 0; j < 2; j++) {
      // ✅ Nếu hết bài → quay lại đầu danh sách
      if (unitIndex >= finalUnits.length) unitIndex = 0;

      const code = finalUnits[unitIndex];
      const entry = {
        code,
        title: titleMap[code] || code,
        type: "old",
        relatedTo: ""
      };

      entries.push(entry);
      unitIndex++;
    }

    if (entries.length > 0) {
      currentSchedule[date] = entries;
      bosungSchedule[date] = entries;
      console.log(`📅 Gán ${entries.length} bài vào ngày ${date}:`, entries.map(e => e.code).join(", "));
    }
  }



  // ✅ Ghi lịch mới vào Firebase
  const docRef = window.doc(window.db, "lich", className);
  await window.setDoc(docRef, currentSchedule);

  // ✅ Gộp dữ liệu cũ + mới → ghi vào bosung
  let finalBosung;

  if (finalUnits.length < totalNeeded) {
    console.warn("⚠️ Không đủ bài để bổ sung, cho phép quay vòng lại từ đầu — reset bosung");
    finalBosung = bosungSchedule;

    // ✅ THÊM LOG KIỂM TRA RESET
    console.log("🧹 Đã RESET bosung — chỉ ghi lại bài vừa bổ sung:");
    console.table(bosungSchedule);
  } else {
    finalBosung = { ...preserved, ...bosungSchedule };

    // ✅ THÊM LOG KIỂM TRA GỘP
    console.log("📦 Đã GỘP bosung — giữ lại bài cũ và thêm bài mới:");
    console.log("🗂 preserved:", Object.keys(preserved).length, "ngày");
    console.log("🆕 bosung mới:", Object.keys(bosungSchedule).length, "ngày");
  }


  await window.setDoc(bosungRef, finalBosung);


  console.log("✅ Đã cập nhật lịch bổ sung và giữ lại dữ liệu cũ trước hôm nay");
}



// ✅ Hiển thị bảng lịch học từ hôm nay trở đi
async function renderFullScheduleFromFirebase(className) {
  const docRef = window.doc(window.db, "lich", className);
  const today = new Date();

  try {
    const snapshot = await window.getDoc(docRef);
    if (!snapshot.exists()) {
      console.warn("📭 Không có lịch học nào trong Firebase cho lớp", className);
      return;
    }

    const data = snapshot.data();
    const tableBody = document.querySelector("#scheduleTable tbody");
    tableBody.innerHTML = "";

    const entries = Object.entries(data)
    .sort(([a], [b]) => new Date(a) - new Date(b));



    let stt = 1;
    for (let [dateStr, lessons] of entries) {
      const row = document.createElement("tr");

      const titles = lessons.map(l => l.title).join("<br>");
      const labels = lessons.map(l => {
        return l.type === "new"
          ? "Bài mới - Phải học"
          : l.type === "review"
          ? "Ôn tập bài mới - Nên học"
          : l.type === "related"
          ? "Bài liên quan bài mới - Nên học"
          : l.type === "old"
          ? "Bài cũ"
          : l.type;
      }).join("<br>");

      const related = lessons.map(l => l.relatedTo || "").join("<br>");

      row.innerHTML = `
        <td>${stt++}</td>
        <td>${dateStr}</td>
        <td>${titles}</td>
        <td>${labels}</td>
        <td>${related}</td>
      `;
      tableBody.appendChild(row);
    }



    console.log("📋 Đã hiển thị lịch học từ hôm nay trở đi cho lớp", className);
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
    const label =
      item.type === "new"
        ? "Bài mới"
        : item.type === "related"
        ? `Liên quan đến ${item.relatedTo}`
        : item.type === "old"
        ? "Bài cũ"
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

  console.log("📑 Đã hiển thị danh sách bài học hôm nay:", sorted);
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
