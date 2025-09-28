// =============== Firebase import & config ===============
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, setDoc, updateDoc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";

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

// =============== Google Sheet config ===============
const SHEET_ID = "1RRnMZJJd6U8_gQp80k5S_w7Li58nEts2mT5Nxg7CPIQ";

// =============== Helpers ===============

// Fetch toàn bộ sheet theo tên lớp
async function fetchSheetValues(sheetName) {
  const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&headers=0&sheet=${encodeURIComponent(sheetName)}`;
  const res = await fetch(url);
  const text = await res.text();
  let cleaned = text.replace(/^\)\]\}'\s*\n?/, "");
  if (cleaned.includes("google.visualization.Query.setResponse(")) {
    const start = cleaned.indexOf("(") + 1;
    const end = cleaned.lastIndexOf(")");
    cleaned = cleaned.substring(start, end);
  }
  const obj = JSON.parse(cleaned);
  const values = obj.table.rows.map(r => r.c.map(c => (c?.v != null ? String(c.v) : "")));
  console.log("=== DEBUG fetchSheetValues ===");
  console.log("Sheet:", sheetName, "Rows:", values.length);
  return values;
}

// Chuẩn hoá nickname
function normalizeNickname(raw) {
  return String(raw || "")
    .toLowerCase()
    .trim()
    .replace(/^[\s,.;]+|[\s,.;]+$/g, "")
    .replace(/\s+/g, " ");
}

// dd/mm/yyyy -> ISO
function ddmmyyyyToISO(dateStr) {
  const m = String(dateStr).match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return null;
  return `${m[3]}-${m[2].padStart(2,"0")}-${m[1].padStart(2,"0")}`;
}
// ISO -> dd/mm/yyyy
function isoToDDMMYYYY(isoStr) {
  if (!isoStr) return "";
  const [y, m, d] = isoStr.split("-");
  return `${d}/${m}/${y}`;
}

// Parse ngày từ header (dd/mm hoặc dd/mm/yyyy) -> ISO
// Parse ngày từ header (hỗ trợ Date(YYYY,MM,DD), dd/mm/yyyy, dd/mm) -> ISO YYYY-MM-DD
function parseHeaderDateToISO(cellText, fallbackYear) {
  const s = String(cellText || "").trim();

  // Case 1: Date(YYYY,MM,DD) từ GViz (MM là zero-based)
  let m = s.match(/^Date\((\d{4}),\s*(\d{1,2}),\s*(\d{1,2})\)$/);
  if (m) {
    const y = m[1];
    const mo = String(Number(m[2]) + 1).padStart(2, "0");
    const d = String(Number(m[3])).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }

  // Case 2: dd/mm/yyyy
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }

  // Case 3: dd/mm (dùng fallbackYear)
  m = s.match(/^(\d{1,2})\/(\d{1,2})$/);
  if (m && fallbackYear) {
    const d = m[1].padStart(2, "0");
    const mo = m[2].padStart(2, "0");
    const y = String(fallbackYear);
    return `${y}-${mo}-${d}`;
  }

  return null;
}


// Đọc dấu điểm danh
function normalizeMark(raw) {
  const s = String(raw || "").toLowerCase().trim();
  const noSpace = s.replace(/\s+/g, "");
  if (noSpace === "x") return "x";
  if (noSpace === "1/2x" || noSpace === "0.5x" || s === "half" || s === "nửa" || s === "½x") return "half";
  if (noSpace === "cp") return "cp";
  if (noSpace === "kp" || noSpace === "k") return "kp";
  return noSpace.length ? "other" : "";
}

// Parse ngày trong ô học sinh: Date(YYYY,MM,DD) hoặc dd/mm[/yyyy] -> ISO
function parseAnyDateToISO(val, fallbackYear) {
  if (!val) return null;
  const s = String(val).trim();

  let m = s.match(/^Date\((\d{4}),(\d{1,2}),(\d{1,2})\)$/);
  if (m) {
    const y = m[1];
    const mo = String(Number(m[2]) + 1).padStart(2,"0");
    const d = m[3].padStart(2,"0");
    return `${y}-${mo}-${d}`;
  }

  m = s.match(/^(\d{1,2})\/(\d{1,2})(?:\/(\d{4}))?$/);
  if (m) {
    const d = m[1].padStart(2,"0");
    const mo = m[2].padStart(2,"0");
    const y = m[3] || fallbackYear;
    return `${y}-${mo}-${d}`;
  }

  return null;
}

// =============== Tìm cột nộp tiền từ dòng 1 ===============
// Chỉ check tháng/năm để tránh lệch do múi giờ/locale
function findPaidColIndexFromLine1(headerLine1, month, year) {
  console.log("=== DEBUG: DÒ CỘT NỘP TIỀN Ở DÒNG 1 ===");
  console.log("Header dòng 1 raw:", headerLine1);

  let paidColIndex = null;
  headerLine1.forEach((cell, idx) => {
    const iso = parseHeaderDateToISO(cell, year);
    if (!iso) {
      console.log(`D1[${idx}] skip (không parse được):`, cell);
      return;
    }
    const d = new Date(iso);
    const ok = d.getFullYear() === Number(year) && (d.getMonth() + 1) === Number(month);
    console.log(`D1[${idx}]`, { cell, iso, y: d.getFullYear(), m: d.getMonth() + 1, ok });
    if (ok) {
      paidColIndex = idx;
      console.log(">>> MATCH cột nộp tiền tại index", idx, "cell:", cell, "iso:", iso);
    }
  });

  console.log("Kết quả paidColIndex:", paidColIndex);
  return paidColIndex;
}


// =============== Tổng hợp lớp (dòng 1 = cột nộp tiền theo tháng/năm, dòng 2 = ngày học) ===============
async function summarizeClassMonth(className, month, year) {
  const values = await fetchSheetValues(className);
  if (values.length < 4) throw new Error("Sheet thiếu dữ liệu (cần >= 4 dòng)");

  const headerLine1 = values[0];
  const headerLine2 = values[1];

  console.log("=== DEBUG summarize ===");
  console.log("Class:", className, "Month/Year:", month, year);
  console.log("Header dòng 1:", headerLine1);
  console.log("Header dòng 2:", headerLine2);

  const paidColIndex = findPaidColIndexFromLine1(headerLine1, month, year);
  if (paidColIndex === null) {
    throw new Error(`Không tìm thấy cột nộp tiền cho tháng ${month}/${year}`);
  }

  // Dò các cột ngày học ở dòng 2
  const dayCols = [];
  headerLine2.forEach((cell, idx) => {
    const iso = parseHeaderDateToISO(cell, year);
    if (!iso) return;
    const d = new Date(iso);
    const ok = d.getFullYear() === Number(year) && d.getMonth() + 1 === Number(month);
    if (ok) dayCols.push({ idx, iso });
  });
  console.log("DayCols:", dayCols);

  const rowsOut = [];
  const classSummaryObj = {};
  let totalClassMoney = 0, totalPaid = 0, totalUnpaid = 0;

  for (let r = 3; r < values.length; r++) {
    const row = values[r];
    const realName = row[1] || "";
    const parentName = row[2] || "";
    const heSo = parseFloat(row[3] || 0);
    const nickname = normalizeNickname(row[4] || "");
    if (!nickname) continue;

    let totalX = 0, totalHalf = 0, totalCP = 0, totalKP = 0, totalOther = 0;
    const daysISO = { x: [], half: [], cp: [], kp: [], other: [] };

    dayCols.forEach(({ idx, iso }) => {
      const mark = normalizeMark(row[idx]);
      if (mark === "x") { totalX += 1; daysISO.x.push(iso); }
      else if (mark === "half") { totalHalf += 1; daysISO.half.push(iso); }
      else if (mark === "cp") { totalCP += 1; daysISO.cp.push(iso); }
      else if (mark === "kp") { totalKP += 1; daysISO.kp.push(iso); }
      else if (mark === "other") { totalOther += 1; daysISO.other.push(iso); }
    });

    const totalBuoi = totalX + 0.5 * totalHalf;
    const totalMoney = Math.round(totalBuoi * heSo);

    const paidCell = row[paidColIndex] || "";
    const isoPaid = parseAnyDateToISO(paidCell, year);
    const paid = !!isoPaid;
    const paidDate = isoPaid || null;

    totalClassMoney += totalMoney;
    if (paid) totalPaid += totalMoney; else totalUnpaid += totalMoney;

    await setDoc(doc(db, "parents", `${nickname}-${className}`), {
      realName,
      nickname,
      class: Number(className),
      parentName,
      [`${month}-${year}`]: {
        totalX, totalHalf, totalCP, totalKP, totalOther,
        totalMoney, paid, paidDate, daysISO
      }
    }, { merge: true });

    rowsOut.push({
      order: r,
      realName, nickname, parentName,
      heSo,
      totalX, totalHalf, totalCP, totalKP, totalOther,
      totalMoney, paid, paidDate
    });
    classSummaryObj[nickname] = {
      order: r,
      realName, nickname, parentName,
      heSo,
      totalX, totalHalf, totalCP, totalKP, totalOther,
      totalMoney, paid, paidDate
    };
  }

  await setDoc(doc(db, "money", `${className}-${month}-${year}`), {
    _summary: { totalClassMoney, totalPaid, totalUnpaid },
    ...classSummaryObj
  }, { merge: true });

  return { rowsOut, totals: { totalClassMoney, totalPaid, totalUnpaid } };
}

// =============== Cập nhật nộp tiền (dòng 1 = cột nộp tiền theo tháng/năm) ===============
async function updatePaymentsFromSheet(className, month, year, currentRows) {
  const values = await fetchSheetValues(className);
  if (values.length < 4) throw new Error("Sheet thiếu dữ liệu (cần >= 4 dòng)");

  const headerLine1 = values[0];
  console.log("=== DEBUG payments ===");
  console.log("Class:", className, "Month/Year:", month, year);
  console.log("Header dòng 1:", headerLine1);

  const paidColIndex = findPaidColIndexFromLine1(headerLine1, month, year);
  if (paidColIndex === null) {
    throw new Error(`Không tìm thấy cột nộp tiền cho tháng ${month}/${year}`);
  }

  for (let r = 3; r < values.length; r++) {
    const row = values[r];
    const nickname = normalizeNickname(row[4] || "");
    if (!nickname) continue;

    const paidCell = row[paidColIndex] || "";
    const iso = parseAnyDateToISO(paidCell, year);
    const paid = !!iso;
    const paidDate = iso || null;

    console.log("Row", r, "nick:", nickname, "paidCell:", paidCell, "=> ISO:", iso);

    let needUpdate = true;
    if (currentRows) {
      const rowObj = currentRows.find(x => x.nickname === nickname);
      if (rowObj && rowObj.paid === paid && rowObj.paidDate === paidDate) {
        needUpdate = false;
      }
    }

    if (needUpdate) {
      await updateDoc(doc(db, "parents", `${nickname}-${className}`), {
        [`${month}-${year}.paid`]: paid,
        [`${month}-${year}.paidDate`]: paidDate
      });
      await updateDoc(doc(db, "money", `${className}-${month}-${year}`), {
        [`${nickname}.paid`]: paid,
        [`${nickname}.paidDate`]: paidDate
      });

      if (currentRows) {
        const rowObj = currentRows.find(x => x.nickname === nickname);
        if (rowObj) {
          rowObj.paid = paid;
          rowObj.paidDate = paidDate;
        }
      }
    }
  }

  if (currentRows) {
    const totals = recomputeTotals(currentRows);
    await updateDoc(doc(db, "money", `${className}-${month}-${year}`), {
      "_summary.totalClassMoney": totals.totalClassMoney,
      "_summary.totalPaid": totals.totalPaid,
      "_summary.totalUnpaid": totals.totalUnpaid
    });
    return totals;
  }
  return null;
}
// =============== View data from Firestore (1 read) ===============
async function viewDataFromFirestore(className, month, year) {
  const ref = doc(db, "money", `${className}-${month}-${year}`);
  const snap = await getDoc(ref);
  if (!snap.exists()) throw new Error("Chưa có dữ liệu tổng hợp trên Firestore cho lớp/tháng này.");

  const data = snap.data();
  const totals = data._summary || { totalClassMoney: 0, totalPaid: 0, totalUnpaid: 0 };

  const rowsOut = Object.entries(data)
    .filter(([key]) => key !== "_summary")
    .map(([_, v]) => ({
      order: v.order || 9999,
      realName: v.realName || "",
      nickname: v.nickname || "",
      parentName: v.parentName || "",
      heSo: v.heSo || "",
      totalX: v.totalX || 0,
      totalHalf: v.totalHalf || 0,
      totalCP: v.totalCP || 0,
      totalKP: v.totalKP || 0,
      totalOther: v.totalOther || 0,
      totalMoney: v.totalMoney || 0,
      paid: !!v.paid,
      paidDate: v.paidDate || null
    }))
    .sort((a,b) => a.order - b.order);

  return { rowsOut, totals };
}

// =============== UI wiring ===============
const classSelect = document.getElementById("classSelect");
const monthSelect = document.getElementById("monthSelect");
const yearInput = document.getElementById("yearInput");
const summarizeBtn = document.getElementById("summarizeBtn");
const paymentsBtn = document.getElementById("paymentsBtn");
const viewBtn = document.getElementById("viewBtn");
const summaryTBody = document.querySelector("#summaryTable tbody");

const totalClassMoneyEl = document.getElementById("totalClassMoney");
const totalPaidEl = document.getElementById("totalPaid");
const totalUnpaidEl = document.getElementById("totalUnpaid");

let lastRows = null;

summarizeBtn.addEventListener("click", async () => {
  const cls = classSelect.value;
  const month = Number(monthSelect.value);
  const year = Number(yearInput.value);

  summarizeBtn.disabled = true;
  paymentsBtn.disabled = true;
  viewBtn.disabled = true;
  summarizeBtn.textContent = "Đang tổng hợp...";

  try {
    const { rowsOut, totals } = await summarizeClassMonth(cls, month, year);
    lastRows = rowsOut;
    renderSummary(rowsOut, totals);
  } catch (e) {
    alert("Lỗi tổng hợp: " + e.message);
    console.error(e);
  } finally {
    summarizeBtn.disabled = false;
    summarizeBtn.textContent = "Tổng hợp";
    paymentsBtn.disabled = false;
    viewBtn.disabled = false;
  }
});

paymentsBtn.addEventListener("click", async () => {
  const cls = classSelect.value;
  const month = Number(monthSelect.value);
  const year = Number(yearInput.value);

  paymentsBtn.disabled = true;
  viewBtn.disabled = true;
  paymentsBtn.textContent = "Đang cập nhật nộp tiền...";

  try {
    const totals = await updatePaymentsFromSheet(cls, month, year, lastRows);
    if (lastRows && totals) {
      renderSummary(lastRows, totals);
    } else {
      alert("Đã đồng bộ trạng thái nộp tiền từ sheet.");
    }
  } catch (e) {
    alert("Lỗi cập nhật nộp tiền: " + e.message);
    console.error(e);
  } finally {
    paymentsBtn.disabled = false;
    paymentsBtn.textContent = "Cập nhật nộp tiền";
    viewBtn.disabled = false;
  }
});

viewBtn.addEventListener("click", async () => {
  const cls = classSelect.value;
  const month = Number(monthSelect.value);
  const year = Number(yearInput.value);

  viewBtn.disabled = true;
  viewBtn.textContent = "Đang tải dữ liệu...";

  try {
    const { rowsOut, totals } = await viewDataFromFirestore(cls, month, year);
    lastRows = rowsOut;
    renderSummary(rowsOut, totals);
  } catch (e) {
    alert("Lỗi xem dữ liệu: " + e.message);
    console.error(e);
  } finally {
    viewBtn.disabled = false;
    viewBtn.textContent = "Xem dữ liệu";
  }
});

// Render summary table and row-level toggle
function renderSummary(rows, totals) {
  summaryTBody.innerHTML = "";
  rows.forEach((r, i) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${i + 1}</td>
      <td>${r.realName || ""}</td>
      <td>${r.nickname || ""}</td>
      <td>${r.parentName || ""}</td>
      <td>${isFinite(r.heSo) ? r.heSo : ""}</td>
      <td>${r.totalX}</td>
      <td>${r.totalHalf}</td>
      <td>${r.totalCP}</td>
      <td>${r.totalKP}</td>
      <td>${r.totalOther}</td>
      <td>${(r.totalMoney || 0).toLocaleString("vi-VN")}</td>
      <td class="${r.paid ? "paid-true" : "paid-false"}">${r.paid ? "Đã nộp" : "Chưa nộp"}</td>
      <td>${r.paidDate ? isoToDDMMYYYY(r.paidDate) : ""}</td>
      <td><button class="secondary" data-nick="${r.nickname}">${r.paid ? "Huỷ nộp" : "Đánh dấu đã nộp"}</button></td>
    `;
    summaryTBody.appendChild(tr);
  });

  summaryTBody.querySelectorAll("button.secondary").forEach(btn => {
    btn.addEventListener("click", async (ev) => {
      const nick = ev.currentTarget.dataset.nick;
      const row = rows.find(x => x.nickname === nick);
      const newPaid = !row.paid;
      let newDateISO = row.paidDate;

      const cls = classSelect.value;
      const month = Number(monthSelect.value);
      const year = Number(yearInput.value);

      if (newPaid) {
        const d = prompt("Nhập ngày nộp (dd/mm/yyyy) hoặc để trống để dùng hôm nay:");
        newDateISO = d ? ddmmyyyyToISO(d) : new Date().toISOString().slice(0,10);
      } else {
        newDateISO = null;
      }

      try {
        await updateDoc(doc(db, "parents", `${nick}-${cls}`), {
          [`${month}-${year}.paid`]: !!newPaid,
          [`${month}-${year}.paidDate`]: newDateISO
        });
        await updateDoc(doc(db, "money", `${cls}-${month}-${year}`), {
          [`${nick}.paid`]: !!newPaid,
          [`${nick}.paidDate`]: newDateISO
        });

        row.paid = newPaid;
        row.paidDate = newDateISO;

        const totals2 = recomputeTotals(rows);
        await updateDoc(doc(db, "money", `${cls}-${month}-${year}`), {
          "_summary.totalClassMoney": totals2.totalClassMoney,
          "_summary.totalPaid": totals2.totalPaid,
          "_summary.totalUnpaid": totals2.totalUnpaid
        });
        renderSummary(rows, totals2);
      } catch (e) {
        alert("Cập nhật thất bại: " + e.message);
        console.error(e);
      }
    });
  });

  totalClassMoneyEl.textContent = (totals?.totalClassMoney || 0).toLocaleString("vi-VN");
  totalPaidEl.textContent = (totals?.totalPaid || 0).toLocaleString("vi-VN");
  totalUnpaidEl.textContent = (totals?.totalUnpaid || 0).toLocaleString("vi-VN");
}

function recomputeTotals(rows) {
  let totalClassMoney = 0, totalPaid = 0, totalUnpaid = 0;
  rows.forEach(r => {
    const m = r.totalMoney || 0;
    totalClassMoney += m;
    if (r.paid) totalPaid += m; else totalUnpaid += m;
  });
  return { totalClassMoney, totalPaid, totalUnpaid };
}
