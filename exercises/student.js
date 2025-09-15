if (sessionStorage.getItem("authenticated") !== "true") {
  alert("Bạn chưa đăng nhập. Đang chuyển về trang đăng nhập...");
  window.location.href = "student-login.html";
}
function normalize(str) {
  return str.trim().toLowerCase();
}

const SHEET_STUDENT_LIST = "https://docs.google.com/spreadsheets/d/1XmiM7fIGqo3eq8QMuhvxj4G3LrGBzsbQHs_gk0KXdTc/gviz/tq?tqx=out:json";

import {
  initializeApp
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  deleteDoc,
  query,
  where
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";


const firebaseConfig = {
  apiKey: "AIzaSyBQ1pPmSdBV8M8YdVbpKhw_DOetmzIMwXU",
  authDomain: "lop-hoc-thay-tinh.firebaseapp.com",
  projectId: "lop-hoc-thay-tinh",
  storageBucket: "lop-hoc-thay-tinh.appspot.com",
  messagingSenderId: "391812475288",
  appId: "1:391812475288:web:ca4c275ac776d69deb23ed"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

function renderDateCheckboxes(dateList) {
  const container = document.getElementById("dateCheckboxList");
  container.innerHTML = "<strong>Chọn ngày:</strong><br/>";

  dateList.forEach(code => {
    const label = `${code.slice(0,2)}-${code.slice(2,4)}-${code.slice(4)}`;
    const checkbox = document.createElement("label");
    checkbox.style.display = "block";
    checkbox.innerHTML = `
      <input type="checkbox" value="${code}" class="date-checkbox" />
      ${label}
    `;
    container.appendChild(checkbox);
  });
}
function getSelectedDates() {
  return Array.from(document.querySelectorAll(".date-checkbox:checked"))
    .map(cb => cb.value);
}
function isOlderThan8Days(dateCode) {
  const day = parseInt(dateCode.slice(0, 2), 10);
  const month = parseInt(dateCode.slice(2, 4), 10) - 1;
  const year = 2000 + parseInt(dateCode.slice(4, 6), 10);
  const entryDate = new Date(year, month, day);

  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 8);

  return entryDate < cutoffDate;
}

async function cleanOldEntries() {
  console.log("🧹 Bắt đầu xoá dữ liệu cũ...");

  const snapshot = await getDocs(collection(db, "hocsinh"));
  let totalRead = 0;
  let totalDeleted = 0;
  const deletedDates = new Set();

  for (const docSnap of snapshot.docs) {
    totalRead++;
    const data = docSnap.data();
    const id = docSnap.id;
    const dateCode = data.date;

    if (!dateCode || !/^\d{6}$/.test(dateCode)) {
      console.log(`⚠️ Bỏ qua document không có mã ngày hợp lệ: ${id}`);
      continue;
    }

    if (isOlderThan8Days(dateCode)) {
      console.log(`🗑️ Xoá học sinh: ${id} (ngày ${dateCode})`);
      await deleteDoc(doc(db, "hocsinh", id));
      totalDeleted++;
      deletedDates.add(dateCode);
    } else {
      console.log(`✅ Giữ lại học sinh: ${id} (ngày ${dateCode})`);
    }
  }

  console.log("📊 Tổng số document đã đọc:", totalRead);
  console.log("📊 Tổng số học sinh đã xoá:", totalDeleted);
  console.log("📊 Danh sách ngày đã xoá:", Array.from(deletedDates));

  // ✅ Xoá dữ liệu tổng hợp theo ngày
  let totalSummaryDeleted = 0;
  for (const dateCode of deletedDates) {
    const classes = ["2", "3", "4", "5", "6"];
    for (const className of classes) {
      const summaryId = `summary-${className}-${dateCode}`;
      await deleteDoc(doc(db, "tonghop", summaryId));
      console.log(`🗑️ Xoá tổng hợp: ${summaryId}`);
      totalSummaryDeleted++;
    }
  }

  console.log("📊 Tổng số bản tổng hợp đã xoá:", totalSummaryDeleted);
  alert("✅ Đã xoá dữ liệu cũ thành công.");
}


// ===============================
// 🧠 PHẦN 2 — Đọc & ghi dữ liệu tổng hợp theo lớp + ngày
// ===============================
async function generateSummaryFromRawData() {
  const selectedClass = document.getElementById("firebaseClassSelect").value;
  const selectedDates = getSelectedDates();

  if (!selectedClass || selectedDates.length === 0) {
    alert("❌ Vui lòng chọn lớp và ít nhất một ngày.");
    return;
  }

  console.log("📥 Đang đọc dữ liệu gốc từ collection 'hocsinh'...");

  const snapshot = await getDocs(collection(db, "hocsinh"));
  const classList = selectedClass === "all"
    ? ["2", "3", "4", "5", "6"]
    : [selectedClass];

  const studentMap = {};

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const { name, class: className, date, score, max, doneParts, duration, rating } = data;

    if (!name || !className || !date || !selectedDates.includes(date)) continue;
    if (!classList.includes(className)) continue;

    const key = `${normalizeName(name)}_${className}`;
    if (!studentMap[key]) studentMap[key] = [];

    studentMap[key].push({ name, className, date, score, max, doneParts, duration, rating });
  }

  console.log("📊 Đã tổng hợp dữ liệu từ 'hocsinh':", studentMap);

  // ✅ Ghi lên tonghop
  let totalWritten = 0;
  for (const className of classList) {
    for (const dateCode of selectedDates) {
      const students = {};

      for (const key in studentMap) {
        const [nameKey, keyClass] = key.split("_");
        if (keyClass !== className) continue;

        const entries = studentMap[key];
        const entry = entries.find(e => e.date === dateCode);
        if (!entry) continue;

        students[entry.name] = {
          score: entry.score,
          max: entry.max,
          doneParts: entry.doneParts,
          duration: entry.duration || null,
          rating: entry.rating || "–"
        };
      }

      if (Object.keys(students).length === 0) {
        console.log(`⚠️ Không có dữ liệu để ghi: summary-${className}-${dateCode}`);
        continue;
      }

      const payload = {
        class: className,
        date: dateCode,
        students
      };

      await setDoc(doc(db, "tonghop", `summary-${className}-${dateCode}`), payload);
      console.log(`✅ Đã ghi: summary-${className}-${dateCode}`, payload);
      totalWritten++;
    }
  }

  alert(`✅ Đã ghi ${totalWritten} bản tổng hợp từ dữ liệu gốc.`);
}


// ✅ Gắn sự kiện cho các nút
document.getElementById("generateSummaryBtn").addEventListener("click", generateSummaryFromRawData);

document.getElementById("cleanOldBtn").addEventListener("click", cleanOldEntries);

// ===============================
// 📊 PHẦN 3A — Hiển thị bảng thống kê theo lớp + ngày
// ===============================

// ✅ Hàm chuẩn hóa tên học sinh
function normalizeName(str) {
  return str.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ✅ Hàm tính điểm xếp hạng
function calculateScores(entries) {
  let totalScore = 0;
  let totalMax = 0;
  let totalParts = 0;
  let daysDone = 0;

  entries.forEach(entry => {
    totalScore += entry.score;
    totalMax += entry.max;
    totalParts += entry.doneParts;
    daysDone++;
  });

  const scorePercent = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
  const avgParts = daysDone > 0 ? totalParts / daysDone : 0;

  const hieuQuaScore = scorePercent + totalScore / 2;
  const chamChiScore = totalScore + avgParts * 10 + daysDone * 20;
  const tongHopScore = chamChiScore * 1.2 + hieuQuaScore * 0.8;

  return {
    totalScore,
    totalMax,
    avgParts: avgParts.toFixed(1),
    daysDone,
    hieuQuaScore: Math.round(hieuQuaScore),
    chamChiScore: Math.round(chamChiScore),
    tongHopScore: Math.round(tongHopScore)
  };
}

// ✅ Hàm hiển thị bảng thống kê theo lớp + ngày
window.renderStudentSummary = async function () {
  const selectedClass = document.getElementById("classFilter").value;
  const rankingType = document.getElementById("rankingType").value;

  if (!selectedClass) {
    alert("❌ Vui lòng chọn lớp.");
    return;
  }

  console.log("📊 Đang hiển thị thống kê cho lớp", selectedClass);

  const tableBody = document.getElementById("studentTableBody");
  const tableHead = document.getElementById("studentTableHead");
  tableBody.innerHTML = "";
  tableHead.innerHTML = "";
  document.getElementById("rankingTable").style.display = "table";

  const studentMap = {};
  const allDates = [];

  // ✅ Tự động lấy tất cả document có lớp phù hợp
  const snapshot = await getDocs(collection(db, "tonghop"));
  snapshot.forEach(docSnap => {
    const docId = docSnap.id;
    if (!docId.startsWith(`summary-${selectedClass}-`)) return;

    const dateCode = docId.split("-")[2];
    allDates.push(dateCode);

    const data = docSnap.data();
    const students = data.students || {};

    for (const name in students) {
      const key = `${normalizeName(name)}_${selectedClass}`;
      if (!studentMap[key]) studentMap[key] = [];

      studentMap[key].push({
        ...students[name],
        date: dateCode,
        name
      });
    }
  });

  if (allDates.length === 0) {
    alert(`⚠️ Không tìm thấy dữ liệu tổng hợp cho lớp ${selectedClass}.`);
    return;
  }

  window.studentMap = studentMap;

  const formatDate = code => `${code.slice(0,2)}-${code.slice(2,4)}-${code.slice(4)}`;
  const keyMap = {
    tonghop: "tongHopScore",
    hieuqua: "hieuQuaScore",
    chamchi: "chamChiScore"
  };
  const sortKey = keyMap[rankingType] || "tongHopScore";

  const rankingList = [];

  for (const key in studentMap) {
    const [nameKey, className] = key.split("_");
    const entries = studentMap[key];

    const scores = calculateScores(entries);

    const dayCells = allDates.map(date => {
      const entry = entries.find(e => e.date === date);
      if (entry) {
        const durationText = entry.duration ? `${entry.duration} phút` : "–";
        return `<td>${entry.score}/${entry.max} – ${entry.doneParts} phần – ${durationText} – ${entry.rating}</td>`;
      } else {
        return `<td>–</td>`;
      }
    });

    let summaryRating = "–";
    if (scores.daysDone >= 7) summaryRating = "Tuyệt vời";
    else if (scores.daysDone >= 5) summaryRating = "Chăm";
    else if (scores.daysDone >= 3) summaryRating = "Hơi lười";
    else summaryRating = "Lười quá";

    rankingList.push({
      name: entries[0].name,
      className,
      dayCells,
      summaryRating,
      ...scores
    });
  }

  rankingList.sort((a, b) => b[sortKey] - a[sortKey]);

  const headerRow = `<tr>
    <th>STT</th>
    <th>Họ tên – lớp</th>
    ${allDates.map(d => `<th>${formatDate(d)}</th>`).join("")}
    <th>Đánh giá chung</th>
    <th>Hiệu quả</th>
    <th>Chăm chỉ</th>
    <th>Tổng hợp</th>
  </tr>`;
  tableHead.innerHTML = headerRow;

  rankingList.forEach((student, index) => {
    const row = `<tr>
      <td>${index + 1}</td>
      <td>${student.name} – lớp ${student.className}</td>
      ${student.dayCells.join("")}
      <td>${student.summaryRating}</td>
      <td>${student.hieuQuaScore}</td>
      <td>${student.chamChiScore}</td>
      <td><strong>${student.tongHopScore}</strong></td>
    </tr>`;
    tableBody.innerHTML += row;
  });

  if (rankingList.length === 0) {
    tableBody.innerHTML += `<tr><td colspan="${2 + allDates.length + 4}">Không có dữ liệu cho lớp đã chọn.</td></tr>`;
  }

  // ✅ Gọi phần điểm danh tự động
  await showDailyParticipation(studentMap, allDates);
};

// ===============================
// 📋 PHẦN 3B — Báo cáo học sinh đã làm / chưa làm
// ===============================

// ✅ Hàm lấy danh sách học sinh từ Google Sheets
async function fetchStudentListFromSheet() {
  const SHEET_STUDENT_LIST = "https://docs.google.com/spreadsheets/d/1XmiM7fIGqo3eq8QMuhvxj4G3LrGBzsbQHs_gk0KXdTc/gviz/tq?tqx=out:json";
  const res = await fetch(SHEET_STUDENT_LIST);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  const rows = json.table.rows;

  const studentMap = {};
  rows.forEach(row => {
    const name = row.c[0]?.v?.toString().trim();
    const className = row.c[1]?.v?.toString().trim();
    if (!name || !className) return;

    const normalized = normalizeName(name);
    if (!studentMap[className]) studentMap[className] = [];
    studentMap[className].push({ name, normalized });
  });

  console.log("📋 Đã lấy danh sách học sinh từ Sheet:", studentMap);
  return studentMap;
}

// ✅ Hàm hiển thị báo cáo theo ngày
async function showDailyParticipation(studentMap, recentDates) {
  const selectedClass = document.getElementById("classFilter").value;
  const studentList = await fetchStudentListFromSheet();
  const classStudents = studentList[selectedClass] || [];

  const reportBox = document.getElementById("dailyReportContent");
  reportBox.innerHTML = "";

  const sortedDates = [...recentDates].sort((a, b) => b.localeCompare(a)); // từ mới đến cũ
  const weakTracker = {}; // tên → danh sách ngày yếu

  // 📅 Lặp qua từng ngày để hiển thị báo cáo và ghi trạng thái yếu
  for (const dateCode of sortedDates) {
    const doneSet = new Set();
    const notDone = [];
    const needImprove = [];

    for (const key in studentMap) {
      const [name, className] = key.split("_");
      if (className !== selectedClass) continue;

      const entries = studentMap[key];
      const entry = entries.find(e => e.date === dateCode);
      if (!entry) continue;

      const normalized = normalizeName(name);
      doneSet.add(normalized);

      const rating = entry.rating || "";
      if (rating.trim() === "⚠️ Cần cải thiện") {
        needImprove.push(entry.name);
      }
    }

    const notDoneList = classStudents
      .filter(s => !doneSet.has(normalizeName(s.name)))
      .map(s => s.name);

    const doneList = classStudents
      .filter(s => doneSet.has(normalizeName(s.name)))
      .map(s => s.name);

    // Ghi lại trạng thái yếu để tổng hợp sau
    const allWeak = [...notDoneList, ...needImprove];
    for (const name of allWeak) {
      if (!weakTracker[name]) weakTracker[name] = [];
      weakTracker[name].push({
        date: dateCode,
        type: notDoneList.includes(name) ? "chưa làm bài" : "cần cải thiện"
      });
    }

    // Hiển thị báo cáo từng ngày
    const formattedDate = `${dateCode.slice(0,2)}-${dateCode.slice(2,4)}-${dateCode.slice(4)}`;
    const section = document.createElement("div");
    section.style.marginTop = "20px";

    section.innerHTML = `
      <h4>📅 Ngày ${formattedDate}</h4>

      <p>✅ Đã làm bài (${doneList.length}): <span 
        id="done-${dateCode}" 
        data-class="${selectedClass}" 
        data-date="${formattedDate}" 
        data-type="done"
      >
        ${doneList.join(", ") || "Không có"}
      </span>
      <button onclick="copyToClipboard('done-${dateCode}')">📋 Sao chép</button></p>

      <p>❌ Chưa làm bài (${notDoneList.length}): <span 
        id="notdone-${dateCode}" 
        data-class="${selectedClass}" 
        data-date="${formattedDate}" 
        data-type="notdone"
      >
        ${notDoneList.join(", ") || "Không có"}
      </span>
      <button onclick="copyToClipboard('notdone-${dateCode}')">📋 Sao chép</button></p>

      <p>⚠️ Cần cải thiện (${needImprove.length}): <span 
        id="needimprove-${dateCode}" 
        data-class="${selectedClass}" 
        data-date="${formattedDate}" 
        data-type="needimprove"
      >
        ${needImprove.join(", ") || "Không có"}
      </span>
      <button onclick="copyToClipboard('needimprove-${dateCode}')">📋 Sao chép</button></p>

      <hr>
    `;
    reportBox.appendChild(section);
  }

  // 📊 Tổng hợp học sinh yếu: hôm nay & hôm qua đều yếu, thống kê tất cả ngày yếu
  const weakAlerts = [];
  const sortedDatesByData = [...recentDates].sort((a, b) => b.localeCompare(a)); // từ mới đến cũ
  const todayCode = sortedDatesByData[0];
  const yesterdayCode = sortedDatesByData[1] || null;

  for (const name in weakTracker) {
    const history = weakTracker[name];
    const todayWeak = todayCode ? history.find(h => h.date === todayCode) : null;
    const yesterdayWeak = yesterdayCode ? history.find(h => h.date === yesterdayCode) : null;

    if (todayWeak && yesterdayWeak) {
      // Lấy toàn bộ các ngày yếu trong recentDates
      const allWeakDays = history
        .sort((a, b) => b.date.localeCompare(a.date))
        .map(h => `${h.type} (${h.date.slice(0,2)}/${h.date.slice(2,4)})`)
        .join(", ");
      weakAlerts.push(`${name} (${history.length} ngày: ${allWeakDays})`);
    }
  }

  // 🔔 Hiển thị cảnh báo duy nhất
  if (weakAlerts.length > 0) {
    const alertTextPlain = weakAlerts.join("\n");
    const alertTextHTML = weakAlerts.map(line => `• ${line}`).join("<br>");

    const alertSection = document.createElement("div");
    alertSection.style.marginBottom = "20px";

    alertSection.innerHTML = `
      <h4>🔔 Học sinh cần quan tâm (${weakAlerts.length})</h4>
      <p id="weak-alerts" data-class="${selectedClass}" data-type="weak" data-raw="${alertTextPlain}">
        ${alertTextHTML}
      </p>
      <button onclick="copyToClipboard('weak-alerts')">📋 Sao chép</button>
      <hr>
    `;
    reportBox.prepend(alertSection);
  }

  reportBox.scrollIntoView({ behavior: "smooth" });
  console.log("📋 Đã hiển thị báo cáo điểm danh theo ngày.");
}



// ✅ Hàm sao chép danh sách
window.copyToClipboard = function(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const rawNames = el.getAttribute("data-raw") || el.textContent.trim();

  const className = el.getAttribute("data-class");
  const date = el.getAttribute("data-date");
  const type = el.getAttribute("data-type");

  let label = "";
  if (type === "done") label = "đã làm bài";
  else if (type === "notdone") label = "chưa làm bài";
  else if (type === "needimprove") label = "cần cải thiện";

  const formatted = `Danh sách học sinh lớp ${className} ${label} ngày ${date}: ${rawNames}`;
  navigator.clipboard.writeText(formatted);
  console.log(`📋 Đã sao chép: ${formatted}`);
};


function generateRecentDateCodes(n = 8) {
  const list = [];
  const today = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const code = `${String(d.getDate()).padStart(2, '0')}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getFullYear()).slice(-2)}`;
    list.push(code);
  }
  return list;
}

// ✅ Gọi khi trang vừa load
document.addEventListener("DOMContentLoaded", () => {
  renderDateCheckboxes(generateRecentDateCodes());
});
