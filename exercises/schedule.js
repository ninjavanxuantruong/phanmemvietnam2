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

async function resolveTitlesFromSheet2(codeList) {
  const res = await fetch(VOCAB_URL);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const titleMap = {};

  for (let row of rows) {
    const rawTitle = row.c[1]?.v?.toString().trim(); // cột B
    const normalized = normalizeUnit(rawTitle);
    if (codeList.includes(normalized)) {
      titleMap[normalized] = rawTitle;
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

  schedule.push({ date: baseDateStr, code: mainCode, type: "new", relatedTo: mainCode }); // ✅ gắn chính nó


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

  console.log(`📅 Lịch học tạo từ ngày ${baseDateStr} cho bài ${mainCode}:`, schedule);
  return schedule;
}

// ✅ Tạo lại toàn bộ lịch học từ Sheet theo lớp
async function generateFullScheduleFromSheet(className) {
  try {
    const res = await fetch(SCHEDULE_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    const finalSchedule = {};

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

      const rawDate = row.c[1].v.toString().trim();
      const baseDateStr = convertSheetDateToISO(rawDate);
      if (!baseDateStr) {
        console.warn(`⚠️ Bỏ qua dòng ${i + 1} vì ngày không hợp lệ: ${rawDate}`);
        continue;
      }

      const mainRaw = row.c[2].v.toString().trim();
      const relatedRaw = row.c[3]?.v?.toString().trim() || "";

      const mainCode = normalizeUnit(mainRaw);
      const relatedCodes = relatedRaw
        ? relatedRaw.split(",").map(code => normalizeUnit(code.trim())).filter(Boolean)
        : [];

      console.log(`🔍 Dòng ${i + 1}: lớp=${sheetClass}, ngày=${baseDateStr}, bài=${mainCode}, liên quan=[${relatedCodes.join(", ")}]`);

      const reviewOffsets = spacedConfig[className] || [4, 11, 25];
      const scheduleArray = generateLessonSchedule(mainCode, relatedCodes, baseDateStr, reviewOffsets);

      scheduleArray.forEach(item => {
        if (!finalSchedule[item.date]) finalSchedule[item.date] = [];
        finalSchedule[item.date].push({
          code: item.code,
          title: "", // ✅ để trống, sẽ gắn sau khi tra
          type: item.type,
          relatedTo: item.relatedTo || ""
        });

      });
    }

    // ✅ Lấy toàn bộ mã bài đã dùng
    const allCodes = Object.values(finalSchedule).flat().map(item => item.code);
    const uniqueCodes = [...new Set(allCodes)];

    // ✅ Tra tên bài học từ Sheet 2
    const titleMap = await resolveTitlesFromSheet2(uniqueCodes);

    // ✅ Gắn lại title cho từng bài
    for (let date in finalSchedule) {
      finalSchedule[date] = finalSchedule[date].map(item => ({
        ...item,
        title: titleMap[item.code] || item.code
      }));
    }


    const docRef = window.doc(window.db, "lich", className);
    await window.setDoc(docRef, finalSchedule);
    console.log("✅ Đã ghi toàn bộ lịch mới vào Firebase cho lớp:", className);
    console.log("📤 Nội dung đã ghi:", finalSchedule);

    await autoFillOldLessons(className, finalSchedule);


    renderFullScheduleFromFirebase(className);
    showTodayLessonFromFirebase(className); // dùng hàm mới thay vì chỉ hôm nay
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
  const excluded = new Set([...usedCodes, ...preservedCodes]);

  // ✅ Tìm bài cũ từ Sheet 2
  const res = await fetch(VOCAB_URL);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const allUnits = rows.map(row => {
    const raw = row.c[1]?.v?.toString().trim();
    return normalizeUnit(raw);
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

  const finalUnits = sortedOldUnits.filter(code => !excluded.has(code));
  console.log("✅ Bài được chọn để bổ sung:", finalUnits);

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

  // ✅ Tra title từ Sheet 2
  const titleMap = {};
  for (let row of rows) {
    const rawTitle = row.c[1]?.v?.toString().trim();
    const normalized = normalizeUnit(rawTitle);
    if (finalUnits.includes(normalized)) {
      titleMap[normalized] = rawTitle;
    }
  }

  // ✅ Gán bài bổ sung vào lịch và bosung mới
  const bosungSchedule = {};
  for (let i = 0; i < emptyDates.length && i < finalUnits.length; i++) {
    const date = emptyDates[i];
    const code = finalUnits[i];
    const entry = {
      code,
      title: titleMap[code] || code,
      type: "old",
      relatedTo: ""
    };

    currentSchedule[date] = [entry];
    bosungSchedule[date] = [entry];

    console.log(`📅 Gán bài ${code} vào ngày ${date}`);
  }

  // ✅ Nếu không còn bài nào để bổ sung → reset bosung
  const docRef = window.doc(window.db, "lich", className);
  await window.setDoc(docRef, currentSchedule);

  const finalBosung = Object.keys(bosungSchedule).length === 0
    ? {} // ✅ reset nếu hết bài
    : { ...preserved, ...bosungSchedule };

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
      for (let lesson of lessons) {
        const row = document.createElement("tr");

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

        row.innerHTML = `
          <td>${stt++}</td>
          <td>${dateStr}</td>
          <td>${lesson.title}</td>
          <td>${label}</td>
          <td>${lesson.relatedTo || ""}</td>
        `;
        tableBody.appendChild(row);
      }
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
