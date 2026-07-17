/**
 * ============================================================================
 * module-5-writing.js — MODULE 5: VIẾT
 * ============================================================================
 * Không có mascot. Điểm lưu vào result_overview (đúng slot all.js cũ dùng
 * cho phần "tổng quan" — coi như phần Viết kế thừa vai trò đó).
 *
 * Ghi chú kỹ thuật: phần "kéo-thả chữ cái" ở Mầm non được cài đặt bằng CHẠM
 * (tap) thay vì kéo-thả HTML5 thật (drag&drop chuẩn HTML5 hoạt động kém trên
 * cảm ứng di động). Chạm chữ cái sẽ tự "rơi" vào ô trống tiếp theo — về mặt
 * hiệu ứng thị giác vẫn giống ghép chữ, nhưng dễ dùng trên điện thoại/máy
 * tính bảng hơn hẳn drag&drop thật. Nếu bạn vẫn muốn drag&drop HTML5 thật,
 * báo mình chỉnh lại — sẽ phức tạp hơn nhưng làm được.
 *
 * Luồng theo cấp độ:
 *  - Mầm non: Chạm chữ cái rời ghép từ đang hiển thị sẵn trên màn hình
 *  - Dễ:      A) PokéWord điền chữ thiếu / B) Viết từ nhìn ảnh mờ
 *  - TB:      A) Viết từ từ nghĩa tiếng Việt / B) Dịch cụm từ
 *  - Khó:     A) Sắp xếp câu thành chữ hoàn chỉnh (gõ lại cả câu) / B) Dịch câu tự do
 * ============================================================================
 */

import {
  LEVELS, speakEN, speakInstructionOnce, askTypedAnswer,
  buildDistractors, shuffle, randomPick, createScoreTracker,
  recordQuestionPassed, saveWritingResult, showTransition, updateMiniScore,
  getImageFromMap, injectSharedStyles, makeAttemptTracker, shouldRevealAnswer,
  goToNextAttempt, POSITIVE_FEEDBACK, ENCOURAGE_RETRY,
} from "./all-shared.js";

// ============================================================================
// STYLE RIÊNG CỦA MODULE 5
// ============================================================================

function injectModule5Styles() {
  if (document.getElementById("pkl-m5-style")) return;
  const style = document.createElement("style");
  style.id = "pkl-m5-style";
  style.textContent = `
    .pkl-arrange-bank { display:flex; flex-wrap:wrap; gap:8px; justify-content:center; }
    .pkl-arrange-chip {
      padding:8px 14px; border-radius:16px; border:2px solid #ff9800; background:rgba(255,152,0,.15);
      color:#ffd54f; cursor:pointer; font-weight:600; font-size:18px; transition:opacity .2s;
    }
    .pkl-arrange-chip.used { opacity:.3; pointer-events:none; }
    .pkl-letter-slot {
      width:40px; height:46px; border:2px dashed rgba(255,255,255,.3); border-radius:8px;
      display:flex; align-items:center; justify-content:center; font-size:22px; font-weight:800; color:#FFCB05;
    }
    .pkl-pw-grid { display:flex; flex-wrap:wrap; gap:6px; justify-content:center; }
    .pkl-pw-cell {
      width:38px; height:44px; border-radius:6px; display:flex; align-items:center; justify-content:center;
      font-size:20px; font-weight:800; background:rgba(255,255,255,.08); color:#f0f0f0;
    }
    .pkl-pw-cell.filled { background:rgba(255,203,5,.15); color:#FFCB05; }
    .pkl-pw-input {
      width:100%; height:100%; background:transparent; border:none; color:#fff200;
      text-align:center; font-size:20px; font-weight:800; outline:none;
    }
    .pkl-blur-img { filter:blur(6px); transition:filter .4s; }
    textarea.pkl-typed-input { resize:none; font-family:inherit; }
  `;
  document.head.appendChild(style);
}

// ============================================================================
// HELPER: askTypedAnswerFuzzy — nhập tự do, chấm theo % từ khớp (dịch câu Khó-B)
// (viết riêng ở đây vì chỉ module này cần so khớp theo %, tránh sửa lại
// askTypedAnswer dùng chung cho các module khác)
// ============================================================================

function checkPercentMatchLocal(heard, target, threshold = 60) {
  const clean = s => (s || "").toLowerCase().replace(/[^a-z0-9\s]/g, "").trim().split(/\s+/).filter(Boolean);
  const h = clean(heard), t = clean(target);
  if (!t.length) return false;
  const correct = t.filter(w => h.includes(w)).length;
  return Math.round((correct / t.length) * 100) >= threshold;
}

function askTypedAnswerFuzzy(cfg) {
  const {
    container, instructionKey, instructionText, questionHTML,
    correctValue, placeholder = "Type your sentence...", threshold = 60,
  } = cfg;
  const tracker = makeAttemptTracker();

  return new Promise(resolve => {
    const render = async () => {
      const reveal = shouldRevealAnswer(tracker);
      container.innerHTML = `
        <div class="pkl-mcq-question">${questionHTML}</div>
        <div style="text-align:center;margin:14px 0;">
          <textarea id="pklFuzzyInput" class="pkl-typed-input" rows="2" style="min-height:60px;" placeholder="${placeholder}">${reveal ? correctValue : ""}</textarea>
        </div>
        <div style="text-align:center;"><button class="poke-btn yellow" id="pklFuzzySubmit">✅ Check</button></div>
        <div class="pkl-mcq-feedback" id="pklFuzzyFeedback"></div>
      `;
      const input = container.querySelector("#pklFuzzyInput");
      const submitBtn = container.querySelector("#pklFuzzySubmit");
      const feedback = container.querySelector("#pklFuzzyFeedback");
      input.focus();

      submitBtn.onclick = async () => {
        if (container.dataset.locked === "1") return;
        container.dataset.locked = "1";
        submitBtn.disabled = true; input.disabled = true;
        const userVal = input.value;
        if (userVal.trim()) await speakEN(userVal);
        const isCorrect = checkPercentMatchLocal(userVal, correctValue, threshold);
        if (isCorrect) {
          input.classList.add("pkl-reveal");
          feedback.textContent = "🎉 " + randomPick(POSITIVE_FEEDBACK);
          feedback.style.color = "#69f0ae";
          const attemptsUsed = tracker.attempt;
          await new Promise(r => setTimeout(r, 1200));
          resolve(attemptsUsed);
        } else {
          feedback.innerHTML = "💡 " + randomPick(ENCOURAGE_RETRY) + ` (Suggested: <b>${correctValue}</b>)`;
          feedback.style.color = "#ffd54f";
          const retryBtn = document.createElement("button");
          retryBtn.className = "poke-btn yellow";
          retryBtn.style.marginTop = "10px";
          retryBtn.textContent = "🔄 Try again";
          retryBtn.onclick = () => { goToNextAttempt(tracker); render(); };
          feedback.after(retryBtn);
        }
      };
      container.dataset.locked = "0";
      await speakInstructionOnce(instructionKey, instructionText);
    };
    render();
  });
}

// ============================================================================
// MẦM NON — chạm chữ cái rời ghép từ ĐANG HIỂN THỊ SẴN (nhìn-và-chép)
// ============================================================================

function dragLettersQuestion(rootEl, word, imageUrl) {
  const letters = word.toUpperCase().split("");
  const tracker = makeAttemptTracker();

  return new Promise(resolve => {
    const render = async () => {
      const reveal = shouldRevealAnswer(tracker);
      const displayLetters = reveal ? letters : shuffle(letters);

      rootEl.innerHTML = `
        <div style="text-align:center;">
          ${imageUrl ? `<img src="${imageUrl}" style="height:110px;border-radius:10px;"/><br/>` : ""}
          <div style="font-size:28px;font-weight:800;color:#FFCB05;margin:10px 0;letter-spacing:5px;">${word.toUpperCase()}</div>
          <div style="color:#aaa;font-size:13px;">👆 Tap the letters to copy the word above!</div>
        </div>
        <div id="pklLetterSlots" style="display:flex;gap:6px;justify-content:center;margin:14px 0;flex-wrap:wrap;"></div>
        <div class="pkl-arrange-bank" id="pklLetterBank"></div>
        <div class="pkl-mcq-feedback" id="pklLetterFeedback"></div>
      `;
      const slotsWrap = document.getElementById("pklLetterSlots");
      const bank = document.getElementById("pklLetterBank");
      const picked = [];

      letters.forEach(() => {
        const slot = document.createElement("div");
        slot.className = "pkl-letter-slot";
        slotsWrap.appendChild(slot);
      });

      displayLetters.forEach(ch => {
        const chip = document.createElement("button");
        chip.className = "pkl-arrange-chip";
        chip.textContent = ch;
        chip.onclick = async () => {
          if (chip.classList.contains("used") || picked.length >= letters.length) return;
          picked.push(ch);
          chip.classList.add("used");
          const slotEls = slotsWrap.querySelectorAll(".pkl-letter-slot");
          slotEls[picked.length - 1].textContent = ch;
          await speakEN(ch, 0.6);
          if (picked.length === letters.length) await checkResult();
        };
        bank.appendChild(chip);
      });

      const checkResult = async () => {
        const feedback = document.getElementById("pklLetterFeedback");
        const guess = picked.join("");
        if (guess === word.toUpperCase()) {
          await speakEN(word, 0.8);
          feedback.textContent = "🎉 " + randomPick(POSITIVE_FEEDBACK);
          feedback.style.color = "#69f0ae";
          const attemptsUsed = tracker.attempt;
          await new Promise(r => setTimeout(r, 1300));
          resolve(attemptsUsed);
        } else {
          feedback.innerHTML = "💡 " + randomPick(ENCOURAGE_RETRY);
          feedback.style.color = "#ffd54f";
          const retryBtn = document.createElement("button");
          retryBtn.className = "poke-btn yellow";
          retryBtn.style.marginTop = "10px";
          retryBtn.textContent = "🔄 Try again";
          retryBtn.onclick = () => { goToNextAttempt(tracker); render(); };
          feedback.after(retryBtn);
        }
      };

      await speakInstructionOnce("mamnon-drag-letters", "Tap the letters in order to copy the word you see!");
    };
    render();
  });
}

async function writeMamNon(rootEl, sessionVocab, tracker) {
  for (const w of sessionVocab) {
    const imgSrc = getImageFromMap(w.imageKeyword || w.word) || "";
    const attempts = await dragLettersQuestion(rootEl, w.word, imgSrc);
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// DỄ — A: PokéWord (điền chữ thiếu)
// ============================================================================

function pokewordQuestion(rootEl, word, meaning) {
  const letters = word.toUpperCase().split("");
  const tracker = makeAttemptTracker();
  const missingIndices = shuffle(letters.map((_, i) => i))
    .slice(0, Math.max(1, Math.floor(letters.length / 2)))
    .sort((a, b) => a - b);

  return new Promise(resolve => {
    const render = async () => {
      const reveal = shouldRevealAnswer(tracker);
      const cellsHTML = letters.map((ch, i) => {
        if (missingIndices.includes(i)) {
          return `<div class="pkl-pw-cell"><input maxlength="1" class="pkl-pw-input" data-i="${i}" value="${reveal ? ch : ""}"/></div>`;
        }
        return `<div class="pkl-pw-cell filled">${ch}</div>`;
      }).join("");

      rootEl.innerHTML = `
        <div style="text-align:center;color:#aaa;font-size:13px;margin-bottom:10px;">💡 ${meaning}</div>
        <div class="pkl-pw-grid">${cellsHTML}</div>
        <div style="text-align:center;margin-top:14px;"><button class="poke-btn yellow" id="pklPwCheck">✅ Check</button></div>
        <div class="pkl-mcq-feedback" id="pklPwFeedback"></div>
      `;
      const inputs = Array.from(rootEl.querySelectorAll(".pkl-pw-input"));
      inputs.forEach((inp, idx) => {
        inp.oninput = () => { if (inp.value && inputs[idx + 1]) inputs[idx + 1].focus(); };
        inp.onkeydown = e => { if (e.key === "Enter") document.getElementById("pklPwCheck").click(); };
      });
      if (inputs[0]) setTimeout(() => inputs[0].focus(), 100);

      document.getElementById("pklPwCheck").onclick = async () => {
        const guess = letters.map((ch, i) => {
          if (!missingIndices.includes(i)) return ch;
          const inp = inputs[missingIndices.indexOf(i)];
          return (inp.value || "_").toUpperCase();
        }).join("");
        const feedback = document.getElementById("pklPwFeedback");
        await speakEN(word, 0.8);
        if (guess === word.toUpperCase()) {
          feedback.textContent = "🎉 " + randomPick(POSITIVE_FEEDBACK);
          feedback.style.color = "#69f0ae";
          const attemptsUsed = tracker.attempt;
          await new Promise(r => setTimeout(r, 1200));
          resolve(attemptsUsed);
        } else {
          feedback.innerHTML = "💡 " + randomPick(ENCOURAGE_RETRY) + ` (Answer: <b>${word.toUpperCase()}</b>)`;
          feedback.style.color = "#ffd54f";
          const retryBtn = document.createElement("button");
          retryBtn.className = "poke-btn yellow";
          retryBtn.style.marginTop = "10px";
          retryBtn.textContent = "🔄 Try again";
          retryBtn.onclick = () => { goToNextAttempt(tracker); render(); };
          feedback.after(retryBtn);
        }
      };
      await speakInstructionOnce("de-pokeword", "Fill in the missing letters!");
    };
    render();
  });
}

async function writeDe_Pokeword(rootEl, sessionVocab, tracker) {
  for (const w of sessionVocab) {
    const attempts = await pokewordQuestion(rootEl, w.word, w.meaning);
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// DỄ — B: Viết từ nhìn ảnh mờ
// ============================================================================

async function writeDe_BlurredImage(rootEl, sessionVocab, tracker) {
  for (const w of sessionVocab) {
    const imgSrc = getImageFromMap(w.imageKeyword || w.word) || "";
    const attempts = await askTypedAnswer({
      container: rootEl,
      instructionKey: "de-blurred-image",
      instructionText: "Look at the blurry picture and write the word!",
      questionHTML: imgSrc
        ? `<img src="${imgSrc}" class="pkl-blur-img" style="height:120px;border-radius:10px;"/>`
        : `<div style="font-size:15px;color:#aaa;">${w.meaning}</div>`,
      correctValue: w.word,
      placeholder: "Type the word...",
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// TRUNG BÌNH — A: Viết từ từ nghĩa tiếng Việt
// ============================================================================

async function writeTB_FromMeaning(rootEl, sessionVocab, tracker) {
  for (const w of sessionVocab) {
    const attempts = await askTypedAnswer({
      container: rootEl,
      instructionKey: "tb-from-meaning",
      instructionText: "Write the English word for this meaning!",
      questionHTML: `<div style="font-size:20px;color:#ffd54f;">${w.meaning}</div>`,
      correctValue: w.word,
      placeholder: "Type the English word...",
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// TRUNG BÌNH — B: Dịch cụm từ
// ============================================================================

async function writeTB_TranslateChunk(rootEl, sessionVocab, tracker) {
  const usable = sessionVocab.filter(w => w.enChunk && w.viChunk);
  const list = usable.length ? usable : sessionVocab;
  for (const w of list) {
    const enFirst = (w.enChunk || w.word).split("/")[0].trim();
    const viFirst = (w.viChunk || w.meaning).split("/")[0].trim();
    const attempts = await askTypedAnswer({
      container: rootEl,
      instructionKey: "tb-translate-chunk",
      instructionText: "Translate this Vietnamese phrase into English!",
      questionHTML: `<div style="font-size:19px;color:#ffd54f;">"${viFirst}"</div>`,
      correctValue: enFirst,
      placeholder: "Type the English phrase...",
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// KHÓ — A: Sắp xếp câu thành chữ hoàn chỉnh (gõ lại cả câu, có ngân hàng từ gợi ý)
// ============================================================================

async function writeKho_FullSentence(rootEl, sessionVocab, tracker) {
  const usable = sessionVocab.filter(w => w.answerRaw || w.presentSent);
  const list = usable.length ? usable : sessionVocab;
  for (const w of list) {
    const sentence = w.answerRaw || w.presentSent || `I like the ${w.word}.`;
    const wordBank = shuffle(sentence.replace(/[.,!?]/g, "").split(/\s+/).filter(Boolean));
    const attempts = await askTypedAnswer({
      container: rootEl,
      instructionKey: "kho-full-sentence",
      instructionText: "Use the word bank to write the complete sentence!",
      questionHTML: `
        <div style="color:#aaa;font-size:13px;margin-bottom:8px;">Word bank: ${wordBank.join(", ")}</div>
        <div style="font-size:15px;color:#ccc;">Write the full sentence:</div>`,
      correctValue: sentence,
      placeholder: "Type the full sentence...",
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// KHÓ — B: Dịch câu tự do (chấm theo % từ khớp — không quá khắt khe)
// ============================================================================

async function writeKho_FreeTranslate(rootEl, sessionVocab, tracker) {
  const usable = sessionVocab.filter(w => w.enChunk && w.viChunk);
  const list = usable.length ? usable : sessionVocab;
  for (const w of list) {
    const enFull = (w.enChunk || w.answerRaw || w.word).split("/").join(" ").trim();
    const viFull = (w.viChunk || w.meaning).split("/").join(" ").trim();
    const attempts = await askTypedAnswerFuzzy({
      container: rootEl,
      instructionKey: "kho-free-translate",
      instructionText: "Translate this sentence into English — it's okay if it's not word-for-word perfect!",
      questionHTML: `<div style="font-size:18px;color:#ffd54f;">"${viFull}"</div>`,
      correctValue: enFull,
      placeholder: "Type your translation...",
      threshold: 60,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// HÀM CHÍNH — export để orchestrator gọi
// ============================================================================

export async function runWritingModule(ctx) {
  const { sessionVocab, poolData, level, rootEl } = ctx;
  injectSharedStyles();
  injectModule5Styles();
  await showTransition("✍️", "Writing Time!", "Let's write some English!");

  const tracker = createScoreTracker();

  if (level === LEVELS.MAM_NON) {
    await writeMamNon(rootEl, sessionVocab, tracker);
  } else if (level === LEVELS.DE) {
    const candidates = [
      () => writeDe_Pokeword(rootEl, sessionVocab, tracker),
      () => writeDe_BlurredImage(rootEl, sessionVocab, tracker),
    ];
    await randomPick(candidates)();
  } else if (level === LEVELS.TRUNG_BINH) {
    const candidates = [
      () => writeTB_FromMeaning(rootEl, sessionVocab, tracker),
      () => writeTB_TranslateChunk(rootEl, sessionVocab, tracker),
    ];
    await randomPick(candidates)();
  } else if (level === LEVELS.KHO) {
    const candidates = [
      () => writeKho_FullSentence(rootEl, sessionVocab, tracker),
      () => writeKho_FreeTranslate(rootEl, sessionVocab, tracker),
    ];
    await randomPick(candidates)();
  }

  saveWritingResult(tracker.assessScore, tracker.total);
  await showTransition("🎉", "Great writing!", "Look how much English you can write now!");
}