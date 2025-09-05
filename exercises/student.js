if (sessionStorage.getItem("authenticated") !== "true") {
  alert("Bạn chưa đăng nhập. Đang chuyển về trang đăng nhập...");
  window.location.href = "student-login.html";
}
function normalize(str) {
  return str.trim().toLowerCase();
}

const SHEET_STUDENT_LIST = "https://docs.google.com/spreadsheets/d/1XmiM7fIGqo3eq8QMuhvxj4G3LrGBzsbQHs_gk0KXdTc/gviz/tq?tqx=out:json";

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  deleteDoc
} from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

// ✅ Khởi tạo Firebase
const firebaseConfig = {
  apiKey: "AIzaSyBQ1pPmSdBV8M8YdVbpKhw_DOetmzIMwXU",
  authDomain: "lop-hoc-thay-tinh.firebaseapp.com",
  projectId: "lop-hoc-thay-tinh",
  storageBucket: "lop-hoc-thay-tinh.firebasestorage.app",
  messagingSenderId: "391812475288",
  appId: "1:391812475288:web:ca4c275ac776d69deb23ed"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// ✅ Xóa dữ liệu cũ hơn 8 ngày
function isOlderThan8Days(dateCode) {
  if (!/^\d{6}$/.test(dateCode)) {
    console.warn("⚠️ Sai định dạng ngày:", dateCode);
    return false;
  }

  const day = parseInt(dateCode.slice(0, 2), 10);
  const month = parseInt(dateCode.slice(2, 4), 10) - 1;
  const year = 2000 + parseInt(dateCode.slice(4, 6), 10); // giả sử năm 20xx

  const entryDate = new Date(year, month, day);
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - 8);

  const entryStr = entryDate.toLocaleDateString("vi-VN");
  const cutoffStr = cutoffDate.toLocaleDateString("vi-VN");

  const isOld = entryDate < cutoffDate;
  
  return isOld;
}


async function cleanOldEntries() {
  
  const snapshot = await getDocs(collection(db, "hocsinh"));
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    const id = docSnap.id;
    const dateCode = data.date;

    if (!dateCode) {
      console.warn("⚠️ Không có trường date trong:", id);
      continue;
    }

    if (isOlderThan8Days(dateCode)) {
      await deleteDoc(doc(db, "hocsinh", id));
      
    } else {
      
    }
  }
}


// ✅ Tính điểm xếp hạng
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



// ✅ Hiển thị bảng xếp hạng
window.renderRanking = async function () {
  

  document.getElementById("rankingTable").style.display = "table";

  const selectedClass = document.getElementById("classFilter").value;
  const rankingType = document.getElementById("rankingType").value;
  const tableBody = document.getElementById("studentTableBody");
  tableBody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "hocsinh"));
  const studentMap = {};

  snapshot.forEach(docSnap => {
    const entry = docSnap.data();
    if (!selectedClass || entry.class === selectedClass) {
      const key = `${normalize(entry.name)}_${normalize(entry.class)}`;

      if (!studentMap[key]) studentMap[key] = [];
      studentMap[key].push(entry);
    }
  });

  const rankingList = [];

  for (const key in studentMap) {
    const [name, className] = key.split("_");
    const entries = studentMap[key];
    const scores = calculateScores(entries);

    rankingList.push({
      name,
      className,
      ...scores
    });
  }

  const keyMap = {
    tonghop: "tongHopScore",
    hieuqua: "hieuQuaScore",
    chamchi: "chamChiScore"
  };

  const sortKey = keyMap[rankingType] || "tongHopScore";
  
  
  rankingList.sort((a, b) => b[sortKey] - a[sortKey]);


  const headerRow = `<tr>
    <th>STT</th>
    <th>Họ tên – lớp</th>
    <th>Tổng điểm</th>
    <th>Phần/ngày</th>
    <th>Ngày làm</th>
    <th>Hiệu quả</th>
    <th>Chăm chỉ</th>
    <th>Tổng hợp</th>
  </tr>`;
  tableBody.innerHTML = headerRow;

  rankingList.forEach((student, index) => {
    const row = `<tr>
      <td>${index + 1}</td>
      <td>${student.name} – lớp ${student.className}</td>
      <td>${student.totalScore}/${student.totalMax}</td>
      <td>${student.avgParts}</td>
      <td>${student.daysDone}</td>
      <td>${student.hieuQuaScore}</td>
      <td>${student.chamChiScore}</td>
      <td><strong>${student.tongHopScore}</strong></td>
    </tr>`;
    tableBody.innerHTML += row;
  });

  if (rankingList.length === 0) {
    tableBody.innerHTML += `<tr><td colspan="8">Không có dữ liệu để xếp hạng.</td></tr>`;
  }
};
// ✅ Hiển thị bảng theo từng ngày
window.renderStudentSummary = async function () {
  
  document.getElementById("rankingTable").style.display = "table";

  const selectedClass = document.getElementById("classFilter").value;
  const rankingType = document.getElementById("rankingType").value;
  const tableBody = document.getElementById("studentTableBody");
  tableBody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "hocsinh"));
  const studentMap = {};
  const allDates = [];

  snapshot.forEach(docSnap => {
    const entry = docSnap.data();
    if (!selectedClass || entry.class === selectedClass) {
      const key = `${normalize(entry.name)}_${normalize(entry.class)}`;
      if (!studentMap[key]) studentMap[key] = [];
      studentMap[key].push(entry);
      allDates.push(entry.date);
    }
  });

  const recentDates = [...new Set(allDates)]
  .filter(code => /^\d{6}$/.test(code)) // chỉ giữ mã ngày hợp lệ
  .sort((a, b) => {
    const dateA = new Date(2000 + parseInt(a.slice(4)), parseInt(a.slice(2, 4)) - 1, parseInt(a.slice(0, 2)));
    const dateB = new Date(2000 + parseInt(b.slice(4)), parseInt(b.slice(2, 4)) - 1, parseInt(b.slice(0, 2)));
    return dateB - dateA; // sắp xếp từ mới nhất đến cũ nhất
  })
  .slice(0, 8);

  const formatDate = code => `${code.slice(0,2)}-${code.slice(2,4)}-${code.slice(4)}`;

  const keyMap = {
    tonghop: "tongHopScore",
    hieuqua: "hieuQuaScore",
    chamchi: "chamChiScore"
  };
  const sortKey = keyMap[rankingType] || "tongHopScore";

  const rankingList = [];

  for (const key in studentMap) {
    const [name, className] = key.split("_");
    const entries = studentMap[key];

    let totalScore = 0;
    let totalMax = 0;
    let totalParts = 0;
    let daysDone = 0;

    const dayCells = recentDates.map(date => {
      const entry = entries.find(e => e.date === date);
      if (entry) {
        totalScore += entry.score;
        totalMax += entry.max;
        totalParts += entry.doneParts;
        daysDone++;
        const durationText = entry.duration ? `${entry.duration} phút` : "–";
        return `<td>${entry.score}/${entry.max} – ${entry.doneParts} phần – ${durationText} – ${entry.rating}</td>`;
      } else {
        return `<td>–</td>`;
      }
    });

    const scorePercent = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    const avgParts = daysDone > 0 ? totalParts / daysDone : 0;

    const hieuQuaScore = scorePercent + totalScore / 2;
    const chamChiScore = totalScore + avgParts * 10 + daysDone * 20;
    const tongHopScore = chamChiScore * 1.2 + hieuQuaScore * 0.8;

    let summaryRating = "–";
    if (daysDone >= 7) summaryRating = "Tuyệt vời";
    else if (daysDone >= 5) summaryRating = "Chăm";
    else if (daysDone >= 3) summaryRating = "Hơi lười";
    else summaryRating = "Lười quá";

    rankingList.push({
      name,
      className,
      dayCells,
      summaryRating,
      hieuQuaScore: Math.round(hieuQuaScore),
      chamChiScore: Math.round(chamChiScore),
      tongHopScore: Math.round(tongHopScore)
    });
  }

  rankingList.sort((a, b) => b[sortKey] - a[sortKey]);

  const headerRow = `<tr>
    <th>STT</th>
    <th>Họ tên – lớp</th>
    ${recentDates.map(d => `<th>${formatDate(d)}</th>`).join("")}
    <th>Đánh giá chung</th>
    <th>Hiệu quả</th>
    <th>Chăm chỉ</th>
    <th>Tổng hợp</th>
  </tr>`;
  document.getElementById("studentTableHead").innerHTML = headerRow;


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
    tableBody.innerHTML += `<tr><td colspan="${2 + recentDates.length + 4}">Không có dữ liệu cho lớp đã chọn.</td></tr>`;
  }

  // ✅ Gọi phần điểm danh tự động
  await showDailyParticipation(studentMap, recentDates);
};

// ✅ Hàm chuẩn hóa tên học sinh
function normalizeName(str) {
  return str.toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

// ✅ Lấy danh sách học sinh từ Google Sheets
async function fetchStudentListFromSheet() {
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

  return studentMap;
}

// ✅ Đối chiếu học sinh đã làm bài và chưa làm bài theo ngày
async function showDailyParticipation(studentMap, recentDates) {
  const selectedClass = document.getElementById("classFilter").value;
  const studentList = await fetchStudentListFromSheet();
  const classStudents = studentList[selectedClass] || [];

  const participationMap = {}; // { dateCode: { done: Set, notDone: [] } }

  recentDates.forEach(dateCode => {
    participationMap[dateCode] = { done: new Set(), notDone: [] };

    for (const key in studentMap) {
      const [name, className] = key.split("_");
      if (className !== selectedClass) continue;

      const entries = studentMap[key];
      const hasEntry = entries.some(e => e.date === dateCode);
      const normalized = normalizeName(name);

      if (hasEntry) {
        participationMap[dateCode].done.add(normalized);
      }
    }

    const notDone = classStudents
    .filter(s => !participationMap[dateCode].done.has(s.normalized))
    .map(s => s.name);

    participationMap[dateCode].notDone = notDone;
  });

  const reportBox = document.getElementById("dailyReportContent");
  reportBox.innerHTML = "";

  recentDates.forEach(dateCode => {
    const { done, notDone } = participationMap[dateCode];
    const formattedDate = `${dateCode.slice(0,2)}-${dateCode.slice(2,4)}-${dateCode.slice(4)}`;

    const section = document.createElement("div");
    section.style.marginTop = "20px";
    section.innerHTML = `
      <h4>📅 Ngày ${formattedDate}</h4>
      <p>✅ Đã làm bài (${done.size}): <span 
  id="done-${dateCode}" 
  data-class="${selectedClass}" 
  data-date="${formattedDate}" 
  data-type="done"
>
  ${classStudents.filter(s => done.has(s.normalized)).map(s => s.name).join(", ") || "Không có"}
</span>


        <button onclick="copyToClipboard('done-${dateCode}')">📋 Sao chép</button></p>
      <p>❌ Chưa làm bài (${notDone.length}): <span 
  id="notdone-${dateCode}" 
  data-class="${selectedClass}" 
  data-date="${formattedDate}" 
  data-type="notdone"
>
  ${notDone.join(", ") || "Không có"}
</span>

        <button onclick="copyToClipboard('notdone-${dateCode}')">📋 Sao chép</button></p>
      <hr>
    `;
    reportBox.appendChild(section);
  });

  reportBox.scrollIntoView({ behavior: "smooth" });
}


// ✅ Gọi khi cần kiểm tra
// showDailyParticipation();
window.copyToClipboard = function(id) {
  const el = document.getElementById(id);
  if (!el) return;

  const rawNames = el.textContent.trim();
  const className = el.getAttribute("data-class");
  const date = el.getAttribute("data-date");
  const type = el.getAttribute("data-type"); // "done" hoặc "notdone"

  const label = type === "done" ? "đã làm bài" : "chưa làm bài";
  const formatted = `Danh sách học sinh lớp ${className} ${label} ngày ${date}: ${rawNames}`;
  navigator.clipboard.writeText(formatted);
};





// ✅ Gọi xóa khi trang mở
cleanOldEntries();
