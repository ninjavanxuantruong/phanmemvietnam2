// ✅ choice1.js
const todayISO = new Date().toISOString().split("T")[0];
const className = localStorage.getItem("trainerClass")?.trim().toLowerCase();

if (!className) {
  document.getElementById("lessonList").innerHTML = "<p>❌ Không tìm thấy lớp đã chọn.</p>";
  document.getElementById("scheduleTable").style.display = "none";
  document.getElementById("statusMessage").textContent = "Vui lòng chọn lớp trước.";
  throw new Error("Không có className");
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
          <input type="checkbox" value="${item.code}" data-title="${item.title}" />
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

  const selectedCodes = checked.map(input => input.value);
  const selectedTitles = checked.map(input => input.dataset.title);

  console.log("🎯 Đã chọn học các bài:", selectedTitles);
  localStorage.setItem("selectedCodes", JSON.stringify(selectedCodes));
  localStorage.setItem("selectedTitles", JSON.stringify(selectedTitles));
  window.location.href = "exercise.html";
});
