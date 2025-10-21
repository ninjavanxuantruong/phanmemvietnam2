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

  // 1. Xoá học sinh cũ trong collection "hocsinh"
  const snapshot = await getDocs(collection(db, "hocsinh"));
  let totalRead = 0;
  let totalDeleted = 0;
  const deletedDates = new Set();

  for (const docSnap of snapshot.docs) {
    totalRead++;
    const data = docSnap.data();
    const id = docSnap.id;
    const dateCode = data.date;

    if (!dateCode || !/^\d{6}$/.test(dateCode)) continue;

    if (isOlderThan8Days(dateCode)) {
      await deleteDoc(doc(db, "hocsinh", id));
      totalDeleted++;
      deletedDates.add(dateCode);
    }
  }

  console.log("📊 Đã xoá", totalDeleted, "học sinh cũ");

  // 2. Xoá dữ liệu ngày cũ trong summary-<lớp>-recent
  // 2. Xoá dữ liệu ngày cũ trong summary-<lớp>-recent
  const classes = ["2", "3", "4", "5", "6"];
  for (const className of classes) {
    const ref = doc(db, "tonghop", `summary-${className}-recent`);
    const snap = await getDoc(ref);
    if (!snap.exists()) continue;

    const data = snap.data();
    const newDayData = {};
    const newDays = [];

    for (const dateCode of data.days || []) {
      if (!isOlderThan8Days(dateCode)) {
        newDayData[dateCode] = data.dayData[dateCode];
        newDays.push(dateCode);
      } else {
        console.log(`🗑️ Xoá ngày ${dateCode} khỏi summary-${className}-recent`);
      }
    }

    data.dayData = newDayData;
    data.days = newDays;

    await setDoc(ref, data);
  }


  // 3. Xoá hẳn các document summary-<lớp>-<dateCode> cũ
  for (const className of classes) {
    const tonghopRef = collection(db, "tonghop");
    const tonghopSnap = await getDocs(tonghopRef);

    for (const docSnap of tonghopSnap.docs) {
      const id = docSnap.id;
      // Kiểm tra dạng id: summary-<lớp>-<dateCode>
      const match = id.match(/^summary-(\d+)-(\d{6})$/);
      if (match) {
        const dateCode = match[2];
        if (isOlderThan8Days(dateCode)) {
          await deleteDoc(doc(db, "tonghop", id));
          console.log(`🗑️ Đã xoá document ${id} vì quá 8 ngày`);
        }
      }
    }
  }

  alert("✅ Đã xoá dữ liệu cũ thành công.");
}



// ✅ Gắn sự kiện cho các nút
//document.getElementById("generateSummaryBtn").addEventListener("click", generateSummaryFromRawData);

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

  const tableBody = document.getElementById("studentTableBody");
  const tableHead = document.getElementById("studentTableHead");
  tableBody.innerHTML = "";
  tableHead.innerHTML = "";
  document.getElementById("rankingTable").style.display = "table";

  // ✅ Lấy doc summary chung
  const ref = doc(db, "tonghop", `summary-${selectedClass}-recent`);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    alert(`⚠️ Không tìm thấy dữ liệu tổng hợp cho lớp ${selectedClass}.`);
    return;
  }

  const data = snap.data();
  const allDates = [...data.days].sort((a, b) => b.localeCompare(a)); // mới -> cũ
  const studentMap = {};

  for (const date of allDates) {
    const students = data.dayData[date] || {};
    for (const name in students) {
      const key = `${normalizeName(name)}_${selectedClass}`;
      if (!studentMap[key]) studentMap[key] = [];
      studentMap[key].push({ ...students[name], date, name });
    }
  }

  const formatDate = code => `${code.slice(0,2)}-${code.slice(2,4)}-${code.slice(4)}`;
  const keyMap = { tonghop: "tongHopScore", hieuqua: "hieuQuaScore", chamchi: "chamChiScore" };
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

  await showDailyParticipationFromSummary(selectedClass);

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
// ✅ Đọc từ summary-{class}-recent và hiển thị đầy đủ: đã làm / chưa làm / điểm kém
async function showDailyParticipationFromSummary(className) {
  // Lấy doc summary chung
  const ref = doc(db, "tonghop", `summary-${className}-recent`);
  const snap = await getDoc(ref);
  const reportBox = document.getElementById("dailyReportContent");
  if (!snap.exists()) {
    reportBox.innerHTML = "<p>⚠️ Chưa có summary chung cho lớp này.</p>";
    return;
  }

  const data = snap.data();
  const allDates = [...(data.days || [])].sort((a, b) => b.localeCompare(a)); // mới -> cũ
  const dayData = data.dayData || {};

  // Lấy danh sách học sinh từ Sheet
  const studentList = await fetchStudentListFromSheet();
  const classStudents = studentList[className] || [];

  reportBox.innerHTML = "";

  const weakTracker = {}; // tên => [{date, type}]
  const formatDM = dc => `${dc.slice(0,2)}/${dc.slice(2,4)}`;

  // 📅 Lặp qua từng ngày để hiển thị báo cáo chi tiết
  for (const dateCode of allDates) {
    const students = dayData[dateCode] || {};
    const doneSet = new Set();
    const needImprove = [];
    const notDoneList = [];

    for (const name in students) {
      doneSet.add(normalizeName(name));
      const rating = (students[name].rating || "").trim();
      if (rating === "⚠️ Cần cải thiện") {
        needImprove.push(name);
      }
    }

    for (const s of classStudents) {
      if (!doneSet.has(normalizeName(s.name))) {
        notDoneList.push(s.name);
      }
    }

    // Ghi lại trạng thái yếu cho tổng hợp
    const allWeak = [
      ...notDoneList.map(n => ({ name: n, type: "chưa làm bài", date: dateCode })),
      ...needImprove.map(n => ({ name: n, type: "điểm kém", date: dateCode }))
    ];
    for (const item of allWeak) {
      if (!weakTracker[item.name]) weakTracker[item.name] = [];
      weakTracker[item.name].push({ date: item.date, type: item.type });
    }

    // ✅ Hiển thị báo cáo từng ngày
    const formattedDate = formatDM(dateCode);
    const section = document.createElement("div");
    section.style.marginTop = "20px";
    section.innerHTML = `
      <h4>📅 Ngày ${formattedDate}</h4>

      <p>✅ Đã làm bài (${classStudents.filter(s => doneSet.has(normalizeName(s.name))).length}): 
        <span id="done-${dateCode}" data-class="${className}" data-date="${formattedDate}" data-type="done">
          ${classStudents.filter(s => doneSet.has(normalizeName(s.name))).map(s => s.name).join(", ") || "Không có"}
        </span>
        <button onclick="copyToClipboard('done-${dateCode}')">📋 Sao chép</button>
      </p>

      <p>❌ Chưa làm bài (${notDoneList.length}): 
        <span id="notdone-${dateCode}" data-class="${className}" data-date="${formattedDate}" data-type="notdone">
          ${notDoneList.join(", ") || "Không có"}
        </span>
        <button onclick="copyToClipboard('notdone-${dateCode}')">📋 Sao chép</button>
      </p>

      <p>⚠️ Điểm kém (${needImprove.length}): 
        <span id="needimprove-${dateCode}" data-class="${className}" data-date="${formattedDate}" data-type="needimprove">
          ${needImprove.join(", ") || "Không có"}
        </span>
        <button onclick="copyToClipboard('needimprove-${dateCode}')">📋 Sao chép</button>
      </p>

      <hr>
    `;
    reportBox.appendChild(section);
  }

  // 🔔 Tổng hợp danh sách đặc biệt
  const needAttention = [];   // >= 3 ngày yếu
  const notDoneTwoDays = [];  // hôm nay + hôm qua đều chưa làm bài

  const todayCode = allDates[0];
  const yesterdayCode = allDates[1] || null;

  for (const name in weakTracker) {
    const history = weakTracker[name];

    // Gom nhóm theo type
    const grouped = {};
    for (const h of history) {
      if (!grouped[h.type]) grouped[h.type] = [];
      grouped[h.type].push(h.date);
    }

    const parts = [];
    for (const type in grouped) {
      const dates = grouped[type]
        .sort((a,b)=>b.localeCompare(a))
        .map(formatDM);
      parts.push(`${type} (${dates.join(", ")})`);
    }
    const detail = parts.join(" - ");

    // ✅ Danh sách 1: học sinh có >= 3 ngày yếu
    if (history.length >= 3) {
      needAttention.push({
        name,
        count: history.length,
        detail
      });
    }

    // ✅ Danh sách 2: hôm nay và hôm qua đều "chưa làm bài"
    if (todayCode && yesterdayCode) {
      const todayWeak = history.find(h => h.date === todayCode && h.type === "chưa làm bài");
      const yesterdayWeak = history.find(h => h.date === yesterdayCode && h.type === "chưa làm bài");
      if (todayWeak && yesterdayWeak) {
        notDoneTwoDays.push(name);
      }
    }
  }

  // Sắp xếp danh sách cần quan tâm theo số ngày yếu giảm dần
  needAttention.sort((a, b) => b.count - a.count);

  // Hiển thị danh sách 1: Học sinh cần quan tâm (chia block 10 bạn)
  if (needAttention.length > 0) {
    for (let i = 0; i < needAttention.length; i += 10) {
      const chunk = needAttention.slice(i, i + 10);
      const lines = chunk.map(item => 
        `• ${item.name} ${item.count} ngày yếu: ${item.detail}`
      );
      const section = document.createElement("div");
      section.innerHTML = `
        <h4>🔔 Học sinh cần quan tâm (${chunk.length}/${needAttention.length})</h4>
        <p id="need-attention-${i}" data-class="${className}" data-type="needAttention" data-raw="${lines.join("\n")}">
          ${lines.join("<br>")}
        </p>
        <button onclick="copyToClipboard('need-attention-${i}')">📋 Sao chép</button>
        <hr>
      `;
      reportBox.prepend(section);
    }
  }

  // Hiển thị danh sách 2: Học sinh chưa làm bài qua nay (chỉ tên, 1 dòng)
  if (notDoneTwoDays.length > 0) {
    const section2 = document.createElement("div");
    section2.innerHTML = `
      <h4>❌ Học sinh chưa làm bài qua nay (${notDoneTwoDays.length})</h4>
      <p id="notdone-twodays" data-class="${className}" data-type="notdone2days" data-raw="${notDoneTwoDays.join(", ")}">
        ${notDoneTwoDays.join(", ")}
      </p>
      <button onclick="copyToClipboard('notdone-twodays')">📋 Sao chép</button>
      <hr>
    `;
    reportBox.prepend(section2);
  }

  reportBox.scrollIntoView({ behavior: "smooth" });
  console.log("📋 Đã hiển thị báo cáo theo summary chung.");
}





// ✅ Hàm sao chép danh sách (bản mới)
window.copyToClipboard = function(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const rawNames = el.getAttribute("data-raw") || el.textContent.trim();

  const className = el.getAttribute("data-class") || "";
  const date = el.getAttribute("data-date") || "";
  const type = el.getAttribute("data-type");

  let formatted = "";

  if (type === "done") {
    formatted = `Danh sách học sinh lớp ${className} đã làm bài ngày ${date}: ${rawNames}`;
  } else if (type === "notdone") {
    formatted = `Danh sách học sinh lớp ${className} chưa làm bài ngày ${date}: ${rawNames}`;
  } else if (type === "needimprove") {
    formatted = `Danh sách học sinh lớp ${className} cần cải thiện ngày ${date}: ${rawNames}`;
  } else if (type === "needAttention") {
    formatted = `🔔 Học sinh lớp ${className} cần quan tâm:\n${rawNames}`;
  } else if (type === "notdone2days") {
    formatted = `❌ Học sinh lớp ${className} chưa làm bài qua nay: ${rawNames}`;
  } else {
    formatted = rawNames;
  }

  navigator.clipboard.writeText(formatted);
  console.log(`📋 Đã sao chép: ${formatted}`);
};


document.addEventListener("DOMContentLoaded", () => {
  // renderDateCheckboxes(generateRecentDateCodes());
});
