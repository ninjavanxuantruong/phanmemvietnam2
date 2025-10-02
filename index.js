async function startApp() {
  const name = document.getElementById("studentName").value.trim();
  const className = document.getElementById("studentClass").value.trim();
  const password = document.getElementById("studentPassword").value.trim();
  const errorBox = document.getElementById("errorMessage");

  if (!name || !className) {
    errorBox.textContent = "⚠️ Vui lòng nhập đầy đủ tên và lớp.";
    return;
  }

  const studentList = await fetchStudentList();

  const cleanedName = cleanInput(name);
  const cleanedClass = cleanInput(className);

  const matchedStudent = studentList.find(s =>
    cleanInput(s.name) === cleanedName &&
    cleanInput(s.class) === cleanedClass
  );

  localStorage.setItem("trainerName", cleanedName);
  localStorage.setItem("trainerClass", cleanedClass);
  localStorage.setItem("startTime_global", Date.now());

  if (matchedStudent) {
    localStorage.setItem("isVerifiedStudent", "true");
    localStorage.setItem("studentPassword", matchedStudent.password || "");
    window.location.href = "choice.html";
  } else {
    localStorage.setItem("isVerifiedStudent", "false");
    alert("⚠️ Bạn chưa được cấp nick. Bạn vẫn có thể tiếp tục học.");
  }
}
