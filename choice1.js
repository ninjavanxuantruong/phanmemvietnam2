// ✅ choice1.js — phiên bản đầy đủ

const todayISO = new Date().toISOString().split("T")[0];
const className = localStorage.getItem("trainerClass")?.trim().toLowerCase();
const VOCAB_URL = "https://docs.google.com/spreadsheets/d/1KaYYyvkjFxVVobRHNs9tDxW7S79-c5Q4mWEKch6oqks/gviz/tq?tqx=out:json";

if (!className) {
  document.getElementById("lessonList").innerHTML = "<p>❌ Không tìm thấy lớp đã chọn.</p>";
  document.getElementById("scheduleTable").style.display = "none";
  document.getElementById("statusMessage").textContent = "Vui lòng chọn lớp trước.";
  throw new Error("Không có trainerClass");
}

const docRef = window.doc(window.db, "lich", className);
window.getDoc(docRef).then(snapshot => {
  if (!snapshot.exists()) {
    document.getElementById("lessonList").innerHTML = "<p>❌ Không có lịch học nào cho lớp này.</p>";
    return;
  }

  const data = snapshot.data();
  const todayLessons = data[todayISO] || [];

  // ✅ Hiển thị bài học hôm nay
  const container = document.getElementById("lessonList");
  container.innerHTML = "";
  if (todayLessons.length === 0) {
    container.innerHTML = "<p>📭 Không có bài học nào hôm nay.</p>";
  } else {
    todayLessons.forEach(item => {
      const label =
        item.type === "new" ? "Bài mới" :
        item.type === "related" ? `Liên quan đến ${item.relatedTo}` :
        item.type === "review" ? `Ôn tập của ${item.relatedTo}` :
        item.type === "old" ? "Bài cũ" : item.type;

      const div = document.createElement("div");
      div.innerHTML = `
        <label>
          <input type="checkbox" value="${normalizeUnit(item.code)}" data-title="${item.title}" />
          ${item.title} (${label})
        </label>
      `;
      container.appendChild(div);
    });
  }

  // ✅ Hiển thị lịch từ hôm nay trở đi
  const tableBody = document.querySelector("#scheduleTable tbody");
  tableBody.innerHTML = "";
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yesterdayISO = yesterday.toISOString().split("T")[0];

  const entries = Object.entries(data)
    .filter(([date]) => date >= yesterdayISO)
    .sort(([a], [b]) => new Date(a) - new Date(b));


  let stt = 1;
  for (let [dateStr, lessons] of entries) {
    const row = document.createElement("tr");

    const [yyyy, mm, dd] = dateStr.split("-");
    const formattedDate = `${dd}/${mm}/${yyyy}`;

    const combined = lessons.map(l => {
      const label =
        l.type === "new" ? "Bài mới – Phù hợp" :
        l.type === "review" ? "Ôn tập – Nên học lại" :
        l.type === "related" ? "Liên quan – Nên học" :
        l.type === "old" ? "Bài cũ – Nên học lại" :
        l.type;

      const related = l.relatedTo ? ` (liên quan ${l.relatedTo})` : "";
      return `${l.title} – ${label}${related}`;
    }).join("<br>");

    const codes = lessons.map(l => normalizeUnit(l.code));
    const titles = lessons.map(l => l.title);

    const button = document.createElement("button");
    button.textContent = "Học bài";
    button.style.padding = "6px 12px";
    button.style.borderRadius = "6px";
    button.style.border = "none";
    button.style.background = "#4caf50";
    button.style.color = "white";
    button.style.cursor = "pointer";
    button.onclick = () => {
      localStorage.setItem("selectedCodes", JSON.stringify(codes));
      localStorage.setItem("selectedTitles", JSON.stringify(titles));
      localStorage.setItem("selectedLesson", titles.join(", "));
      fetchVocabularyFromSelectedCodes(codes);
    };

    const noteCell = document.createElement("td");
    noteCell.appendChild(button);

    row.innerHTML = `
      <td>${formattedDate}</td>
      <td>${combined}</td>
    `;
    row.appendChild(noteCell);

    // ✅ Gán class nếu là hôm nay
    const todayISO = new Date().toISOString().split("T")[0];
    if (dateStr === todayISO) {
      row.classList.add("today-row");
    }

    tableBody.appendChild(row);
  }





  document.getElementById("btnLearnSuggested").disabled = false;
}).catch(err => {
  console.error("❌ Lỗi khi lấy lịch học:", err);
  document.getElementById("lessonList").innerHTML = "<p>❌ Lỗi khi tải dữ liệu.</p>";
});

// ✅ Gắn sự kiện nút học bài đề xuất
document.getElementById("btnLearnSuggested").addEventListener("click", () => {
  const checked = Array.from(document.querySelectorAll("#lessonList input[type='checkbox']:checked"));
  if (checked.length === 0) {
    alert("Bạn chưa chọn bài nào.");
    return;
  }

  const selectedCodes = checked.map(input => normalizeUnit(input.value));
  const selectedTitles = checked.map(input => input.dataset.title);

  localStorage.setItem("selectedCodes", JSON.stringify(selectedCodes));
  localStorage.setItem("selectedTitles", JSON.stringify(selectedTitles));
  localStorage.setItem("selectedLesson", selectedTitles.join(", "));


  fetchVocabularyFromSelectedCodes(selectedCodes);
});

// ✅ Lấy từ vựng từ Google Sheets theo mã bài
async function fetchVocabularyFromSelectedCodes(unitCodes) {
  try {
    const res = await fetch(VOCAB_URL);
    const text = await res.text();
    const json = JSON.parse(text.substring(47).slice(0, -2));
    const rows = json.table.rows;

    let wordBank = [];

    rows.forEach(row => {
      const unitRaw = row.c[1]?.v?.toString().trim();
      const word = row.c[2]?.v?.toString().trim();
      const code = extractCodeFromTitle(unitRaw); // ✅ dùng hàm mới

      if (unitCodes.includes(code)) {
        wordBank.push(word);
      }
    });


    wordBank = shuffleArray(wordBank);

    localStorage.setItem("wordBank", JSON.stringify(wordBank));
    localStorage.setItem("victoryTotalWords", wordBank.length);
    console.log("📦 Từ vựng đã lấy:", wordBank);

    window.location.href = "exercise.html";
  } catch (err) {
    console.error("❌ Lỗi khi lấy từ vựng:", err);
    alert("Không thể lấy từ vựng. Vui lòng thử lại sau.");
  }
}

// ✅ Chuẩn hóa mã bài
function normalizeUnit(str) {
  if (!str || typeof str !== "string") return "";
  return str.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^0-9]/g, "").trim();
}

function extractCodeFromTitle(title) {
  if (!title || typeof title !== "string") return "";
  const parts = title.trim().split(/[-\s.]+/);
  if (parts.length >= 3 && /^\d+$/.test(parts[0]) && /^\d+$/.test(parts[1]) && /^\d+$/.test(parts[2])) {
    return parts[0] + parts[1] + parts[2]; // ví dụ: "4" + "04" + "2" → "4042"
  }
  return "";
}

// ✅ Xáo trộn từ vựng
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


