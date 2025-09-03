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
  const entries = Object.entries(data)
    .filter(([date]) => date >= todayISO)
    .sort(([a], [b]) => new Date(a) - new Date(b));

  let stt = 1;
  for (let [dateStr, lessons] of entries) {
    for (let lesson of lessons) {
      const label =
        lesson.type === "new" ? "Bài mới - Phải học" :
        lesson.type === "review" ? "Ôn tập bài mới - Nên học" :
        lesson.type === "related" ? "Bài liên quan bài mới - Nên học" :
        lesson.type === "old" ? "Bài cũ - Nên học lại" :
        lesson.type;

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
      if (unitCodes.includes(normalizeUnit(unitRaw))) {
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

// ✅ Xáo trộn từ vựng
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
