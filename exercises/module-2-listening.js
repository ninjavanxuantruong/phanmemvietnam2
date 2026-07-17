/**
 * ============================================================================
 * module-2-listening.js — MODULE 2: NGHE
 * ============================================================================
 * Không có mascot (mascot chỉ ở Module 1). Sửa gì trong module này thì chỉ
 * sửa file này, không ảnh hưởng module khác.
 *
 * Luồng theo cấp độ:
 *  - Mầm non: Nghe từ đơn -> chạm đúng hình (4 hình, cố định, không random)
 *  - Dễ:      A) Nghe Q&A điền 1 từ (có ảnh gợi ý) / B) Nghe -> chọn câu đúng
 *  - TB:      A) Nghe đoạn nhiều câu điền từng chỗ trống / B) Nghe đoạn dài chọn đáp án
 *  - Khó:     A) Hội thoại dài trả lời suy luận / B) Nghe đoạn nhiễu, giới hạn nghe lại
 * ============================================================================
 */

import {
  LEVELS, speakEN, speakInstructionOnce, askMCQ, askTypedAnswer,
  buildDistractors, shuffle, randomPick, createScoreTracker,
  recordQuestionPassed, saveListeningResult, showTransition, updateMiniScore,
  getImageFromMap, injectSharedStyles, escapeRegExp,
} from "./all-shared.js";

// ============================================================================
// HELPER RIÊNG CỦA MODULE 2
// ============================================================================

// Thay từ mục tiêu bằng "___" trong 1 câu (word-boundary, không phân biệt hoa/thường)
function blankOut(sentence, target) {
  if (!sentence || !target) return sentence || "";
  const re = new RegExp(`\\b${escapeRegExp(target)}\\b`, "gi");
  return sentence.replace(re, "___");
}

// Nút "Nghe lại" có giới hạn số lần (dùng cho cấp Khó)
function renderLimitedReplay(container, text, maxTimes = 2) {
  let used = 0;
  const btn = document.createElement("button");
  btn.className = "poke-btn blue";
  btn.style.marginTop = "10px";
  const updateLabel = () => { btn.textContent = `🔊 Listen again (${maxTimes - used} left)`; };
  updateLabel();
  btn.onclick = async () => {
    if (used >= maxTimes) return;
    used++;
    btn.disabled = used >= maxTimes;
    updateLabel();
    await speakEN(text, 0.9);
  };
  container.appendChild(btn);
  return btn;
}

// ============================================================================
// MẦM NON — nghe từ đơn, chạm đúng hình (cố định, không random)
// ============================================================================

async function listenMamNon(rootEl, sessionVocab, poolData, tracker) {
  for (const w of sessionVocab) {
    const distractorWords = buildDistractors(w, poolData, { field: "word", count: 3, extra: sessionVocab });
    const options = shuffle([w.word, ...distractorWords]).map(val => {
      const found = [w, ...poolData, ...sessionVocab].find(p => p.word === val) || w;
      return { label: "", value: val, imageUrl: getImageFromMap(found.imageKeyword || val) || "" };
    });
    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "listen-mamnon",
      instructionText: "Listen carefully and tap the correct picture!",
      questionHTML: `<div style="font-size:44px;">🎧</div>`,
      options, correctValue: w.word,
      speakPromptText: w.word,
      rate: 0.85,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// DỄ — A: Nghe Q&A điền 1 từ (có ảnh gợi ý)
// ============================================================================

async function listenDe_FillBlank(rootEl, sessionVocab, tracker) {
  const withQA = sessionVocab.filter(w => w.question && w.answerRaw);
  const list = withQA.length ? withQA : sessionVocab;
  for (const w of list) {
    const q = w.question || `I have a ${w.word}.`;
    const a = w.answerRaw || w.meaning;
    const displayQ = blankOut(q, w.word);
    const displayA = blankOut(a, w.word);
    const imgSrc = getImageFromMap(w.imageKeyword || w.word) || "";

    rootEl.innerHTML = `
      <div class="dialogue-box" style="background:rgba(93,171,70,.15);border:2px solid #ffd54f;border-radius:14px;padding:16px;text-align:center;">
        ${imgSrc ? `<img src="${imgSrc}" style="height:70px;border-radius:8px;margin-bottom:8px;"/><br/>` : ""}
        <div style="font-size:18px;color:#fff;">🗣 ${displayQ}</div>
        <div style="font-size:18px;color:#ffd700;margin-top:6px;">🗣 ${displayA}</div>
      </div>`;
    renderLimitedReplay(rootEl, `${q}. ${a}`, 99); // Dễ: không giới hạn nghe lại

    await speakInstructionOnce("de-fill-blank", "Listen and type the missing word!");
    await speakEN(q, 0.9);
    await new Promise(r => setTimeout(r, 300));
    await speakEN(a, 0.9);

    const attempts = await askTypedAnswer({
      container: rootEl,
      instructionKey: "de-fill-blank-2", // đã đọc hướng dẫn ở trên rồi nên key khác rỗng nhưng không phát lại nhờ Set
      instructionText: "Listen and type the missing word!",
      questionHTML: `<div style="font-size:15px;color:#ccc;">${displayQ}<br/>${displayA}</div>`,
      correctValue: w.word,
      placeholder: "Missing word...",
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// DỄ — B: Nghe -> chọn câu đúng (4 lựa chọn)
// ============================================================================

async function listenDe_ChooseSentence(rootEl, sessionVocab, poolData, tracker) {
  for (const w of sessionVocab) {
    const targetSentence = w.presentSent || w.question || `This is a ${w.word}.`;
    const distractors = buildDistractors({ ...w, presentSent: targetSentence }, poolData, { field: "presentSent", count: 3 });
    const finalOptions = distractors.length >= 3 ? distractors
      : buildDistractors(w, poolData, { field: "question", count: 3, extra: sessionVocab });

    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "de-choose-sentence",
      instructionText: "Listen carefully, then choose the sentence you heard!",
      questionHTML: `<div style="font-size:36px;">🔊</div>`,
      options: shuffle([targetSentence, ...finalOptions]).map(v => ({ label: v, value: v })),
      correctValue: targetSentence,
      speakPromptText: targetSentence,
      rate: 0.9,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// TRUNG BÌNH — A: Nghe đoạn nhiều câu, điền từng chỗ trống
// ============================================================================

async function listenTB_FillParagraph(rootEl, sessionVocab, poolData, tracker) {
  // Ghép 1 đoạn văn từ các câu ví dụ (session + vài câu nhiễu của pool) để tạo bối cảnh,
  // sau đó lần lượt hỏi điền từng từ mục tiêu (giữ đúng cơ chế attempt/reveal từng câu).
  const usable = sessionVocab.filter(w => w.presentSent);
  const list = usable.length ? usable : sessionVocab;

  const fillerSentences = shuffle(poolData.filter(p => p.presentSent && !list.includes(p)))
    .slice(0, 3).map(p => p.presentSent);

  for (const w of list) {
    const sentence = w.presentSent || `I like the ${w.word}.`;
    const contextSentences = shuffle([sentence, ...fillerSentences]);
    const fullParagraph = contextSentences
      .map(s => (s === sentence ? blankOut(s, w.word) : s))
      .join(" ");

    rootEl.innerHTML = `
      <div style="background:rgba(255,253,231,.1);border:2px solid #fdd835;border-radius:12px;padding:16px;font-size:17px;text-align:center;">
        ${fullParagraph}
      </div>`;
    renderLimitedReplay(rootEl, contextSentences.join(". "), 3);

    await speakInstructionOnce("tb-fill-paragraph", "Listen to the paragraph and fill in the missing word!");
    await speakEN(contextSentences.join(". "), 0.9);

    const attempts = await askTypedAnswer({
      container: rootEl,
      instructionKey: "tb-fill-paragraph-2",
      instructionText: "Listen to the paragraph and fill in the missing word!",
      questionHTML: `<div style="font-size:15px;color:#ccc;">${fullParagraph}</div>`,
      correctValue: w.word,
      placeholder: "Missing word...",
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// TRUNG BÌNH — B: Nghe đoạn dài, chọn đáp án
// ============================================================================

async function listenTB_LongChoose(rootEl, sessionVocab, poolData, tracker) {
  const usable = sessionVocab.filter(w => w.question && w.answerRaw);
  const list = usable.length ? usable : sessionVocab;

  for (const w of list) {
    const fillerSentences = shuffle(poolData.filter(p => p.presentSent)).slice(0, 3).map(p => p.presentSent);
    const paragraph = shuffle([w.presentSent || w.question, ...fillerSentences]).filter(Boolean).join(". ");
    const distractors = buildDistractors(w, poolData, { field: "answerRaw", count: 3, extra: sessionVocab });

    rootEl.innerHTML = `
      <div style="background:rgba(255,253,231,.1);border:2px solid #fdd835;border-radius:12px;padding:16px;font-size:16px;text-align:center;">
        ${paragraph}
      </div>
      <div style="text-align:center;margin-top:10px;font-size:16px;color:#ffd54f;">❓ ${w.question}</div>`;
    renderLimitedReplay(rootEl, paragraph, 3);

    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "tb-long-choose",
      instructionText: "Listen to the paragraph, then answer the question!",
      questionHTML: `<div style="font-size:16px;color:#ffd54f;">❓ ${w.question}</div>`,
      options: shuffle([w.answerRaw, ...distractors]).map(v => ({ label: v, value: v })),
      correctValue: w.answerRaw,
      speakPromptText: paragraph,
      rate: 0.9,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// KHÓ — A: Hội thoại dài, trả lời suy luận
// ============================================================================

async function listenKho_Inference(rootEl, sessionVocab, poolData, tracker) {
  const usable = sessionVocab.filter(w => w.question && w.answerRaw);
  const list = usable.length ? usable : sessionVocab;

  for (const w of list) {
    const dialogue = `${w.question} ${w.answerRaw}`;
    const distractors = buildDistractors(w, poolData, { field: "word", count: 3, extra: sessionVocab });

    rootEl.innerHTML = `
      <div style="background:rgba(255,253,231,.08);border:2px solid #fdd835;border-radius:12px;padding:16px;font-size:16px;text-align:center;">
        <div>🗣 ${w.question}</div>
        <div style="color:#ffd700;margin-top:6px;">🗣 ${w.answerRaw}</div>
      </div>`;
    renderLimitedReplay(rootEl, dialogue, 1); // Khó: giới hạn nghe lại chặt hơn

    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "kho-inference",
      instructionText: "Listen to the conversation, then guess which word they are talking about!",
      questionHTML: `<div style="font-size:15px;color:#ccc;">What word are they talking about?</div>`,
      options: shuffle([w.word, ...distractors]).map(v => ({ label: v, value: v })),
      correctValue: w.word,
      speakPromptText: dialogue,
      rate: 0.95,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// KHÓ — B: Nghe đoạn nhiều nhiễu, giới hạn số lần nghe lại
// ============================================================================

async function listenKho_LimitedReplay(rootEl, sessionVocab, poolData, tracker) {
  const usable = sessionVocab.filter(w => w.question && w.answerRaw);
  const list = usable.length ? usable : sessionVocab;

  for (const w of list) {
    const fillerSentences = shuffle(poolData.filter(p => p.presentSent)).slice(0, 5).map(p => p.presentSent);
    const paragraph = shuffle([w.presentSent || w.question, ...fillerSentences]).filter(Boolean).join(". ");
    const distractors = buildDistractors(w, poolData, { field: "answerRaw", count: 3, extra: sessionVocab });

    rootEl.innerHTML = `
      <div style="background:rgba(255,253,231,.08);border:2px solid #fdd835;border-radius:12px;padding:16px;font-size:15px;text-align:center;">
        🔊 (${fillerSentences.length + 1}-sentence paragraph — listen carefully, replay is limited!)
      </div>`;
    renderLimitedReplay(rootEl, paragraph, 1);

    const attempts = await askMCQ({
      container: rootEl,
      instructionKey: "kho-limited-replay",
      instructionText: "This is a long paragraph. You only get 1 replay, so listen carefully!",
      questionHTML: `<div style="font-size:16px;color:#ffd54f;">❓ ${w.question}</div>`,
      options: shuffle([w.answerRaw, ...distractors]).map(v => ({ label: v, value: v })),
      correctValue: w.answerRaw,
      speakPromptText: paragraph,
      rate: 0.95,
    });
    recordQuestionPassed(tracker, attempts);
    updateMiniScore(tracker.displayScore, tracker.total);
  }
}

// ============================================================================
// HÀM CHÍNH — export để orchestrator gọi
// ============================================================================

export async function runListeningModule(ctx) {
  const { sessionVocab, poolData, level, rootEl } = ctx;
  injectSharedStyles();

  await showTransition("🎧", "Listening Time!", "Let's listen carefully!");

  const tracker = createScoreTracker();

  if (level === LEVELS.MAM_NON) {
    await listenMamNon(rootEl, sessionVocab, poolData, tracker);
  } else if (level === LEVELS.DE) {
    const candidates = [
      () => listenDe_FillBlank(rootEl, sessionVocab, tracker),
      () => listenDe_ChooseSentence(rootEl, sessionVocab, poolData, tracker),
    ];
    await randomPick(candidates)();
  } else if (level === LEVELS.TRUNG_BINH) {
    const candidates = [
      () => listenTB_FillParagraph(rootEl, sessionVocab, poolData, tracker),
      () => listenTB_LongChoose(rootEl, sessionVocab, poolData, tracker),
    ];
    await randomPick(candidates)();
  } else if (level === LEVELS.KHO) {
    const candidates = [
      () => listenKho_Inference(rootEl, sessionVocab, poolData, tracker),
      () => listenKho_LimitedReplay(rootEl, sessionVocab, poolData, tracker),
    ];
    await randomPick(candidates)();
  }

  saveListeningResult(tracker.assessScore, tracker.total);
  await showTransition("🎉", "Great listening!", "You did an amazing job!");
}