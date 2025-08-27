if (sessionStorage.getItem("authenticated") !== "true") {
  alert("Bạn chưa đăng nhập. Đang chuyển về trang đăng nhập...");
  window.location.href = "student-login.html";
}

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
  const today = new Date();
  const cutoff = new Date(today.getTime() - 8 * 24 * 60 * 60 * 1000);
  const cutoffCode = `${String(cutoff.getDate()).padStart(2, '0')}${String(cutoff.getMonth() + 1).padStart(2, '0')}${String(cutoff.getFullYear()).slice(-2)}`;
  return dateCode < cutoffCode;
}

async function cleanOldEntries() {
  const snapshot = await getDocs(collection(db, "hocsinh"));
  for (const docSnap of snapshot.docs) {
    const data = docSnap.data();
    if (isOlderThan8Days(data.date)) {
      await deleteDoc(doc(db, "hocsinh", docSnap.id));
      console.log("🗑️ Đã xóa:", docSnap.id);
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
      const key = `${entry.name}_${entry.class}`;
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

  rankingList.sort((a, b) => b[`${rankingType}Score`] - a[`${rankingType}Score`]);

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
  const tableBody = document.getElementById("studentTableBody");
  tableBody.innerHTML = "";

  const snapshot = await getDocs(collection(db, "hocsinh"));
  const studentMap = {};
  const allDates = [];

  snapshot.forEach(docSnap => {
    const entry = docSnap.data();
    if (!selectedClass || entry.class === selectedClass) {
      const key = `${entry.name}_${entry.class}`;
      if (!studentMap[key]) studentMap[key] = [];
      studentMap[key].push(entry);
      allDates.push(entry.date);
    }
  });

  const recentDates = [...new Set(allDates)].sort((a, b) => b - a).slice(0, 8);
  const formatDate = code => `${code.slice(0,2)}-${code.slice(2,4)}-${code.slice(4)}`;

  const headerRow = `<tr>
    <th>STT</th>
    <th>Họ tên – lớp</th>
    ${recentDates.map(d => `<th>${formatDate(d)}</th>`).join("")}
    <th>Đánh giá cả tuần</th>
    <th>Hiệu quả</th>
    <th>Chăm chỉ</th>
    <th>Tổng hợp</th>
  </tr>`;
  tableBody.innerHTML = headerRow;

  let rowCount = 0;
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
        return `<td>${entry.score}/${entry.max} – ${entry.doneParts} phần – ${entry.rating}</td>`;
      } else {
        return `<td>–</td>`;
      }
    });

    // ✅ Đánh giá chung theo số ngày làm
    let summaryRating = "–";
    if (daysDone >= 7) summaryRating = "Tuyệt vời";
    else if (daysDone >= 5) summaryRating = "Chăm";
    else if (daysDone >= 3) summaryRating = "Hơi lười";
    else summaryRating = "Lười quá";

    // ✅ Tính điểm hiệu quả, chăm chỉ, tổng hợp
    const scorePercent = totalMax > 0 ? (totalScore / totalMax) * 100 : 0;
    const avgParts = daysDone > 0 ? totalParts / daysDone : 0;

    const hieuQuaScore = scorePercent + totalScore / 2;
    const chamChiScore = totalScore + avgParts * 10 + daysDone * 20;
    const tongHopScore = chamChiScore * 1.2 + hieuQuaScore * 0.8;

    const row = `<tr>
      <td>${++rowCount}</td>
      <td>${name} – lớp ${className}</td>
      ${dayCells.join("")}
      <td>${summaryRating}</td>
      <td>${Math.round(hieuQuaScore)}</td>
      <td>${Math.round(chamChiScore)}</td>
      <td><strong>${Math.round(tongHopScore)}</strong></td>
    </tr>`;

    tableBody.innerHTML += row;
  }

  if (rowCount === 0) {
    tableBody.innerHTML += `<tr><td colspan="${2 + recentDates.length + 4}">Không có dữ liệu cho lớp đã chọn.</td></tr>`;
  }
};


// ✅ Gọi xóa khi trang mở
cleanOldEntries();
