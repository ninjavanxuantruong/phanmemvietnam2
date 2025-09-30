import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCVdzWiiFvcWiHVJN-x33YKarsjyziS8E",
  authDomain: "pokemon-capture-10d03.firebaseapp.com",
  projectId: "pokemon-capture-10d03",
  storageBucket: "pokemon-capture-10d03.firebasestorage.app",
  messagingSenderId: "1068125543917",
  appId: "1:1068125543917:web:57de4365ee56729ea8dbe4"
};
let app; try { app = initializeApp(firebaseConfig); } catch { app = getApp(); }
const db = getFirestore(app);

const infoBox = document.getElementById("infoBox");
const monthsBox = document.getElementById("monthsBox");

// 👉 Lấy trainerName + trainerClass từ localStorage
const trainerName = (localStorage.getItem("trainerName") || "").toLowerCase().trim();
const trainerClass = localStorage.getItem("trainerClass") || "";
const docId = `${trainerName}-${trainerClass}`;

async function loadParentData() {
  if (!trainerName || !trainerClass) {
    infoBox.innerHTML = "<p>❌ Chưa có thông tin học sinh trong localStorage</p>";
    return;
  }

  try {
    const ref = doc(db, "parents", docId);
    const snap = await getDoc(ref);
    if (!snap.exists()) {
      infoBox.innerHTML = "<p>❌ Không tìm thấy dữ liệu học sinh trên hệ thống</p>";
      return;
    }

    const data = snap.data();

    // Thông tin chung
    const realName = data.realName || "";
    const nickname = data.nickname || trainerName;
    const parentName = data.parentName || "";

    // Tính tổng tiền chưa nộp + liệt kê tháng/năm chưa nộp
    let unpaidList = [];
    Object.entries(data).forEach(([key, val]) => {
      if (key.match(/^\d{1,2}-\d{4}$/)) {
        if (!val.paid) {
          unpaidList.push({
            monthYear: key,
            money: val.totalMoney || 0
          });
        }
      }
    });

    let unpaidText = "Không còn nợ học phí 🎉";
    if (unpaidList.length > 0) {
      unpaidText = unpaidList.map(u =>
        `Tháng ${u.monthYear}: ${u.money.toLocaleString("vi-VN")} VND`
      ).join("<br>");
    }

    // Render phần thông tin riêng
    infoBox.innerHTML = `
      <h2>Thông tin học sinh</h2>
      <p><b>Tên học sinh:</b> ${realName}</p>
      <p><b>Nickname:</b> ${nickname}</p>
      <p><b>Phụ huynh:</b> ${parentName}</p>
      <p><b>Đánh giá:</b> (sẽ bổ sung sau)</p>
      <p class="summary">💰 Tiền chưa nộp:<br>${unpaidText}</p>
    `;

    // Render phần chi tiết từng tháng
    monthsBox.innerHTML = "";
    Object.entries(data).forEach(([key, val]) => {
      if (!key.match(/^\d{1,2}-\d{4}$/)) return; // chỉ lấy key dạng "7-2025"

      const monthDiv = document.createElement("div");
      monthDiv.className = "month";

      const header = document.createElement("div");
      header.className = "month-header";
      header.textContent = `Tháng ${key}`;
      header.onclick = () => {
        body.style.display = body.style.display === "none" ? "block" : "none";
      };

      const body = document.createElement("div");
      body.className = "month-body";

      // Helper: format danh sách ngày
      function formatDays(list) {
        if (!list || list.length === 0) return "(không có)";
        return list.map(d => d.split("-").reverse().join("/")).join(", ");
      }

      body.innerHTML = `
        <p><b>Buổi học:</b> ${val.totalX || 0} <br><i>Ngày:</i> ${formatDays(val.daysISO?.x)}</p>
        <p><b>Buổi học 1 nửa:</b> ${val.totalHalf || 0} <br><i>Ngày:</i> ${formatDays(val.daysISO?.half)}</p>
        <p><b>Nghỉ có phép (CP):</b> ${val.totalCP || 0} <br><i>Ngày:</i> ${formatDays(val.daysISO?.cp)}</p>
        <p><b>Nghỉ không phép (KP):</b> ${val.totalKP || 0} <br><i>Ngày:</i> ${formatDays(val.daysISO?.kp)}</p>
        <p><b>Khác:</b> ${val.totalOther || 0} <br><i>Ngày:</i> ${formatDays(val.daysISO?.other)}</p>
        <hr>
        <p><b>Tổng tiền:</b> ${(val.totalMoney || 0).toLocaleString("vi-VN")} VND</p>
        <p><b>Trạng thái:</b> <span class="${val.paid ? "paid-true" : "paid-false"}">${val.paid ? "Đã nộp" : "Chưa nộp"}</span></p>
        <p><b>Ngày nộp:</b> ${val.paidDate || "-"}</p>
      `;

      monthDiv.appendChild(header);
      monthDiv.appendChild(body);
      monthsBox.appendChild(monthDiv);
    });

  } catch (e) {
    console.error(e);
    infoBox.innerHTML = "<p>❌ Lỗi tải dữ liệu: " + e.message + "</p>";
  }
}

loadParentData();
