/** Hiện TỪNG CỤM riêng (theo dấu "/") để dịch, giống đúng runOverviewD3 cũ —
 *  không chỉ lấy cụm đầu tiên. Đúng >=70% số cụm mới tính là qua câu. */
function translateAllChunksQuestion(rootEl, viChunks, enChunks) {
  const tracker = makeAttemptTracker();
  return new Promise(resolve => {
    const render = async () => {
      const reveal = shouldRevealAnswer(tracker);
      const rowsHTML = viChunks.map((vi, i) => `
        <div style="display:flex;gap:8px;margin-bottom:10px;align-items:center;">
          <div style="flex:1;background:rgba(255,82,82,.15);border:2px solid #ef5350;border-radius:8px;
            padding:10px;font-weight:600;color:#ffab91;text-align:center;">${vi}</div>
          <input type="text" class="pkl-chunk-input" data-idx="${i}" data-ans="${enChunks[i]}"
            value="${reveal ? enChunks[i] : ""}" placeholder="Type English..."
            style="flex:1;padding:10px;border-radius:8px;border:2px solid rgba(255,203,5,.4);
            background:rgba(255,255,255,.1);color:#fff;"/>
        </div>`).join("");

      rootEl.innerHTML = `
        <div style="color:#aaa;font-size:13px;margin-bottom:10px;text-align:center;">Translate each phrase into English!</div>
        ${rowsHTML}
        <div style="text-align:center;margin-top:10px;"><button class="poke-btn yellow" id="pklChunkSubmit">✅ Check</button></div>
        <div class="pkl-mcq-feedback" id="pklChunkFeedback"></div>`;

      const inputs = Array.from(rootEl.querySelectorAll(".pkl-chunk-input"));
      if (inputs[0]) setTimeout(() => inputs[0].focus(), 100);
      inputs.forEach((inp, i) => {
        inp.onkeydown = e => {
          if (e.key === "Enter") {
            if (inputs[i + 1]) inputs[i + 1].focus();
            else document.getElementById("pklChunkSubmit").click();
          }
        };
      });

      document.getElementById("pklChunkSubmit").onclick = async () => {
        let correctCount = 0;
        for (const inp of inputs) {
          const user = (inp.value || "").trim().toLowerCase();
          const ans = (inp.dataset.ans || "").trim().toLowerCase();
          const ok = user === ans;
          if (ok) correctCount++;
          inp.style.borderColor = ok ? "#4caf50" : "#e74c3c";
          if (user) await speakEN(inp.value);
        }
        const ratio = correctCount / inputs.length;
        const feedback = document.getElementById("pklChunkFeedback");
        if (ratio >= 0.7) {
          feedback.textContent = "🎉 " + randomPick(POSITIVE_FEEDBACK) + ` (${correctCount}/${inputs.length})`;
          feedback.style.color = "#69f0ae";
          const attemptsUsed = tracker.attempt;
          await new Promise(r => setTimeout(r, 1300));
          resolve(attemptsUsed);
        } else {
          feedback.innerHTML = "💡 " + randomPick(ENCOURAGE_RETRY) + ` (${correctCount}/${inputs.length} đúng)`;
          feedback.style.color = "#ffd54f";
          const retryBtn = document.createElement("button");
          retryBtn.className = "poke-btn yellow";
          retryBtn.style.marginTop = "10px";
          retryBtn.textContent = "🔄 Try again";
          retryBtn.onclick = () => { goToNextAttempt(tracker); render(); };
          feedback.after(retryBtn);
        }
      };

      await speakInstructionOnce("tb-translate-chunk", "Translate each phrase into English!");
    };
    render();
  });
}
