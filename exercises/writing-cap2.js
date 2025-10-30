// ===== Config =====
const writingSheetUrl2 = "https://docs.google.com/spreadsheets/d/17JUJya5fIL3BfH4-Ysfm1MKbfFFtOmgYQ9C6aiCo5S0/gviz/tq?tqx=out:json&sheet=2";

// ===== State =====
let writingInputs = [];
let writingScore = 0;

// ===== Helpers =====
async function fetchWritingData() {
  const res = await fetch(writingSheetUrl2);
  const text = await res.text();
  const json = JSON.parse(text.substring(47).slice(0, -2));
  return json.table.rows;
}

// ===== Main loader =====
async function startWritingCap2() {
  const container = document.getElementById("writingContainer");
  container.innerHTML = "";

  const rows = await fetchWritingData();

  // Gom theo số bài (cột A)
  const lessonNumbers = [...new Set(rows.map(r => r.c[0]?.v).filter(v => v !== undefined))];
  const selectedLesson = lessonNumbers[Math.floor(Math.random() * lessonNumbers.length)];
  const lessonRows = rows.filter(r => r.c[0]?.v === selectedLesson);

  // Đề bài (cột B)
  const title = lessonRows[0]?.c[1]?.v || "Đề bài không xác định";
  const titleEl = document.createElement("h3");
  titleEl.innerText = `📝 ${title}`;
  container.appendChild(titleEl);

  writingInputs = [];

  // Các mục (cột C) + gợi ý câu hỏi (cột D) + gợi ý câu trả lời (cột E)
  lessonRows.forEach((r) => {
    const label = r.c[2]?.v || "";
    const hintQ = r.c[3]?.v || "";
    const hintA = r.c[4]?.v || "";

    const block = document.createElement("div");
    block.className = "question-block";

    const labelEl = document.createElement("label");
    labelEl.innerHTML = `<strong>${label}</strong>`;
    block.appendChild(labelEl);

    const input = document.createElement("textarea");
    input.rows = 3;
    input.style.width = "100%";
    input.style.marginTop = "8px";
    input.placeholder = "Viết câu trả lời tại đây...";
    block.appendChild(input);

    writingInputs.push(input);

    // Container hiển thị gợi ý
    const hintBox = document.createElement("div");
    hintBox.style.marginTop = "8px";
    block.appendChild(hintBox);

    // Nút gợi ý câu hỏi
    if (hintQ?.trim()) {
      const hintQBtn = document.createElement("button");
      hintQBtn.innerText = "💡 Gợi ý câu hỏi";
      hintQBtn.className = "btn primary";
      hintQBtn.style.marginRight = "8px";

      const hintQEl = document.createElement("div");
      hintQEl.style.display = "none";
      hintQEl.style.marginTop = "6px";
      hintQEl.style.color = "#2d3436";
      hintQEl.innerText = hintQ;

      hintQBtn.onclick = () => {
        hintQEl.style.display = hintQEl.style.display === "none" ? "block" : "none";
      };

      hintBox.appendChild(hintQBtn);
      hintBox.appendChild(hintQEl);
    }

    // Nút gợi ý câu trả lời
    if (hintA?.trim()) {
      const hintABtn = document.createElement("button");
      hintABtn.innerText = "💡 Gợi ý câu trả lời";
      hintABtn.className = "btn primary";

      const hintAEl = document.createElement("div");
      hintAEl.style.display = "none";
      hintAEl.style.marginTop = "6px";
      hintAEl.style.color = "#636e72";
      hintAEl.innerText = hintA;

      hintABtn.onclick = () => {
        hintAEl.style.display = hintAEl.style.display === "none" ? "block" : "none";
      };

      hintBox.appendChild(hintABtn);
      hintBox.appendChild(hintAEl);
    }

    container.appendChild(block);
  });

  const submitBtn = document.createElement("button");
  submitBtn.innerText = "✅ Nộp bài viết";
  submitBtn.className = "btn success";
  submitBtn.style.marginTop = "20px";
  submitBtn.onclick = () => {
    gradeWritingCap2();
  };
  container.appendChild(submitBtn);
}

// ===== Grading =====
function gradeWritingCap2() {
  writingScore = 0;
  const total = writingInputs.length;

  writingInputs.forEach(input => {
    const val = input.value?.trim();
    if (val) writingScore++;
    // 🔒 Khóa không cho sửa nữa
    input.disabled = true;
  });

  // 🔒 Khóa nút nộp
  const submitBtn = document.querySelector("#writingContainer .btn.success");
  if (submitBtn) submitBtn.disabled = true;

  // 🔒 Khóa các nút gợi ý
  document.querySelectorAll("#writingContainer .btn.primary").forEach(btn => {
    btn.disabled = true;
  });

  const resultBox = document.createElement("div");
  resultBox.style.marginTop = "20px";
  resultBox.style.fontWeight = "bold";
  resultBox.innerText = `🎯 Bạn đã hoàn thành ${writingScore}/${total} mục.`;
  document.getElementById("writingContainer").appendChild(resultBox);

  // Lưu điểm riêng cho Writing cấp 2
  localStorage.setItem("result_writingcap2", JSON.stringify({
    score: writingScore,
    total: total
  }));

  // ✅ Đồng bộ vào tổng điểm chung result_grade8
  const prevResult = JSON.parse(localStorage.getItem("result_grade8") || "{}");
  const prevWriting = JSON.parse(localStorage.getItem("result_writingcap2") || "{}");

  // Cập nhật tổng: trừ điểm cũ, cộng điểm mới
  const updatedResult = {
    score: (prevResult.score || 0) - (prevWriting.score || 0) + writingScore,
    total: (prevResult.total || 0) - (prevWriting.total || 0) + total
  };

  localStorage.setItem("result_grade8", JSON.stringify(updatedResult));

}
