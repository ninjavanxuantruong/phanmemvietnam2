  /**
   * ============================================================================
   * pkm_minigame_balldrop.js — MINIGAME THẢ KẸO VÀO LỌ (dùng cho category
   * "quickCheck" — hiện dùng cho Stage B "Quick check" của Module 1, sau này
   * có thể thêm nhiều game khác cùng nhóm "quickCheck" trong all-shared.js)
   * ============================================================================
   * File riêng biệt, KHÔNG đụng gì các game khác hay all-shared.js (chỉ IMPORT
   * hạ tầng thuần từ đó). Dùng chung cơ chế PkmGameLauncher.launch()/
   * getLaunchPayload()/finishAndReturn() — xem all-shared.js.
   *
   * CƠ CHẾ:
   *  - Mỗi round: 1 câu hỏi (promptHTML) + tối đa 4 lựa chọn, mỗi lựa chọn gắn
   *    với 1 lọ có màu cố định (đỏ/vàng/lục/lam).
   *  - Chạm vào lọ nào -> kẹo bay từ máy phát xuống lọ đó:
   *      + Đúng lọ chứa đáp án đúng -> TÍNH ĐÚNG.
   *      + Sai lọ -> TÍNH SAI NGAY (không cho thả lại câu đó), tô sáng lọ đúng.
   *  - Chạm ra ngoài mọi lọ (thả trượt) -> KHÔNG có gì xảy ra, vẫn chờ thả tiếp.
   *  - Hết `round.answerMs` (mặc định 12s) mà chưa thả -> tính sai, tô sáng lọ đúng.
   *
   * HỢP ĐỒNG DỮ LIỆU (payload.rounds) — mỗi round:
   *   {
   *     type: "mcq" | "image-mcq",         // thiếu -> tự suy ra từ options có imageUrl hay không
   *     instructionKey, instructionText,   // đọc hướng dẫn 1 lần/buổi
   *     promptHTML,                        // nội dung câu hỏi hiện phía trên
   *     speakPromptText,                   // đọc lên khi câu hỏi xuất hiện
   *     rate,                              // tốc độ đọc (mặc định 1)
   *     optionLang, promptLang,            // "en" | "vi" — ngôn ngữ đọc cho lựa chọn / câu hỏi
   *     options: [{ label, value, imageUrl?, speakText? }],  // tối đa 4, dư thì cắt bớt
   *     correctValue,
   *     answerMs,                          // khung giờ trả lời (mặc định 12000)
   *   }
   *
   * KẾT QUẢ TRẢ VỀ: finishAndReturn(moduleId, results) — results là mảng
   * { correct: boolean } theo đúng thứ tự rounds.
   * ============================================================================
   */

  import {
    PkmGameLauncher, speakEN, speakVI, speakInstructionOnce, initTTSVoice,
    randomPick, POSITIVE_FEEDBACK, ENCOURAGE_RETRY, SFX,
  } from "./all-shared.js";

  const ANSWER_MS = 12000;
  const PAUSE_AFTER_MS = 900;
  const JAR_COLORS = ["#e53935", "#ffd54f", "#43a047", "#3b6fe0"];

  function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
  function speakByLang(text, lang, rate) { return lang === "vi" ? speakVI(text, rate) : speakEN(text, rate); }

  // ============================================================================
  // CHUẨN HOÁ ROUND
  // ============================================================================
  function normalizeRound(round) {
    const hasOptions = Array.isArray(round.options);
    const type = round.type || (hasOptions
      ? (round.options.some(o => o.imageUrl) ? "image-mcq" : "mcq")
      : "mcq");
    return {
      type,
      instructionKey: round.instructionKey,
      instructionText: round.instructionText,
      promptHTML: round.promptHTML || round.questionHTML || "",
      speakPromptText: round.speakPromptText,
      rate: round.rate || 1,
      optionLang: round.optionLang || "en",
      promptLang: round.promptLang || "en",
      options: (round.options || []).slice(0, 4),
      correctValue: round.correctValue,
      answerMs: round.answerMs || ANSWER_MS,
    };
  }

  // ============================================================================
  // DOM HELPERS
  // ============================================================================
  const el = id => document.getElementById(id);

  function renderJars(round) {
    const wrap = el("pkdJarsWrap");
    wrap.innerHTML = "";
    round.options.forEach((opt, i) => {
      const color = JAR_COLORS[i % JAR_COLORS.length];
      const jar = document.createElement("div");
      jar.className = "pkd-jar";
      jar.dataset.value = opt.value;
      jar.innerHTML = `
        <div class="pkd-jar-candy-pile" style="background:${color};"></div>
        <div class="pkd-jar-body" style="border-color:${color};">
          ${opt.imageUrl
            ? `<img src="${opt.imageUrl}" alt="" onerror="this.style.display='none';"/>`
            : `<span class="pkd-jar-label">${opt.label}</span>`}
        </div>`;
      wrap.appendChild(jar);
    });
  }

  function highlightCorrectJar(correctValue) {
    const jar = el("pkdJarsWrap").querySelector(`.pkd-jar[data-value="${CSS.escape(String(correctValue))}"]`);
    jar?.classList.add("pkd-jar-correct");
  }

  function startTimerBar(ms) {
    const bar = el("pkdTimerBar");
    bar.style.transition = "none";
    bar.style.transform = "scaleX(1)";
    void bar.offsetWidth; // ép reflow để animation chạy lại từ đầu mỗi round
    requestAnimationFrame(() => {
      bar.style.transition = `transform ${ms}ms linear`;
      bar.style.transform = "scaleX(0)";
    });
  }

  // ============================================================================
  // 1 VÒNG CÂU HỎI
  // ============================================================================
  function playRound(round, idx, total) {
    const r = normalizeRound(round);

    el("pkdProgress").textContent = `${idx + 1}/${total}`;
    el("pkdPromptCard").innerHTML = r.promptHTML || "";
    el("pkdFeedback").textContent = "";
    renderJars(r);
    startTimerBar(r.answerMs);

    return new Promise(resolve => {
      let settled = false;
      let timeoutTimer = null;
      const dispenser = el("pkdDispenser");
      const scene = el("pkdScene");

      const finish = (isCorrect) => {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        setTimeout(() => resolve(isCorrect), 60);
      };

      function handleDrop(opt, jarEl, color) {
        if (settled) return;
        settled = true;
        clearTimeout(timeoutTimer);
        el("pkdJarsWrap").querySelectorAll(".pkd-jar").forEach(j => j.classList.add("pkd-locked"));

        // Hoạt ảnh kẹo bay từ máy phát -> lọ vừa chạm
        const candy = document.createElement("div");
        candy.className = "pkd-candy-flying";
        candy.style.background = color;
        scene.appendChild(candy);
        const dRect = dispenser.getBoundingClientRect();
        const jRect = jarEl.getBoundingClientRect();
        const sRect = scene.getBoundingClientRect();
        candy.style.left = (dRect.left - sRect.left + dRect.width / 2 - 11) + "px";
        candy.style.top = (dRect.top - sRect.top + dRect.height / 2 - 11) + "px";
        requestAnimationFrame(() => {
          candy.style.left = (jRect.left - sRect.left + jRect.width / 2 - 11) + "px";
          candy.style.top = (jRect.top - sRect.top + 10) + "px";
          candy.style.transform = "scale(1.3)";
        });

        setTimeout(async () => {
          candy.remove();
          const isCorrect = opt.value === r.correctValue;
          SFX[isCorrect ? "correct" : "wrong"]();
          jarEl.classList.add(isCorrect ? "pkd-jar-correct" : "pkd-jar-wrong");
          if (!isCorrect) highlightCorrectJar(r.correctValue);
          const feedback = el("pkdFeedback");
          feedback.textContent = isCorrect ? "🎉 " + randomPick(POSITIVE_FEEDBACK) : "💡 " + randomPick(ENCOURAGE_RETRY);
          feedback.style.color = isCorrect ? "#69f0ae" : "#ffd54f";
          await speakByLang(opt.speakText || opt.label || opt.value, r.optionLang, r.rate);
          await sleep(PAUSE_AFTER_MS);
          finish(isCorrect);
        }, 440);
      }

      el("pkdJarsWrap").querySelectorAll(".pkd-jar").forEach(jarEl => {
        const idxColor = Array.from(el("pkdJarsWrap").children).indexOf(jarEl);
        const opt = r.options[idxColor];
        const color = JAR_COLORS[idxColor % JAR_COLORS.length];
        jarEl.onclick = () => handleDrop(opt, jarEl, color);
      });

      (async () => {
        if (r.instructionKey) await speakInstructionOnce(r.instructionKey, r.instructionText);
        if (r.speakPromptText) await speakByLang(r.speakPromptText, r.promptLang, r.rate);
        timeoutTimer = setTimeout(() => {
          if (settled) return;
          el("pkdJarsWrap").querySelectorAll(".pkd-jar").forEach(j => j.classList.add("pkd-locked"));
          highlightCorrectJar(r.correctValue);
          const feedback = el("pkdFeedback");
          feedback.textContent = "⏰ Hết giờ! " + randomPick(ENCOURAGE_RETRY);
          feedback.style.color = "#ffd54f";
          setTimeout(() => finish(false), PAUSE_AFTER_MS);
        }, r.answerMs);
      })();
    });
  }

  // ============================================================================
  // MAIN
  // ============================================================================
  async function main() {
    const payload = PkmGameLauncher.getLaunchPayload();
    if (!payload || !Array.isArray(payload.rounds) || !payload.rounds.length) {
      location.href = "all-shared.html";
      return;
    }

    await new Promise(resolve => {
      el("pkdStartBtn").onclick = () => {
        // Làm nóng speechSynthesis ngay trong cử chỉ chạm (mobile).
        try {
          const unlock = new SpeechSynthesisUtterance(" ");
          unlock.volume = 0;
          window.speechSynthesis.speak(unlock);
        } catch (e) {}
        resolve();
      };
    });
    el("pkdStartOverlay").remove();

    await initTTSVoice();

    const results = [];
    for (let i = 0; i < payload.rounds.length; i++) {
      const isCorrect = await playRound(payload.rounds[i], i, payload.rounds.length);
      results.push({ correct: isCorrect });
    }

    PkmGameLauncher.finishAndReturn(payload.moduleId, results);
  }

  main();
