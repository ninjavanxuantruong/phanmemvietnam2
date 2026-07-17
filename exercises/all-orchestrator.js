/**
 * ============================================================================
 * all-orchestrator.js — ĐIỀU PHỐI CHÍNH
 * ============================================================================
 * File này CHỈ điều phối (chọn cấp độ -> tải dữ liệu -> chạy tuần tự 5 module
 * -> hỏi học lại/đã thuộc). Không chứa logic riêng của module nào. Sửa nội
 * dung 1 module thì sửa file module đó, KHÔNG sửa ở đây.
 * ============================================================================
 */

import {
  initTTSVoice, injectSharedStyles, getWordBank, loadSessionData,
  renderLevelSelect, renderEndOfSessionPrompt, resetInstructionMemory,
  showTransition,
} from "./all-shared.js";

import { runIntroModule } from "./module-1-intro.js";
import { runListeningModule } from "./module-2-listening.js";
import { runSpeakingModule } from "./module-3-speaking.js";
import { runReadingModule } from "./module-4-reading.js";
import { runWritingModule } from "./module-5-writing.js";

const MODULES = [
  { id: "intro",     label: "🌸 Giới thiệu", emoji: "🌸", run: runIntroModule },
  { id: "listening", label: "🎧 Nghe",        emoji: "🎧", run: runListeningModule },
  { id: "speaking",  label: "🎙️ Nói",         emoji: "🎙️", run: runSpeakingModule },
  { id: "reading",   label: "📖 Đọc",         emoji: "📖", run: runReadingModule },
  { id: "writing",   label: "✍️ Viết",        emoji: "✍️", run: runWritingModule },
];

function setCard(html) {
  document.getElementById("mainCard").innerHTML = html;
}

function updateProgress(idx) {
  const pct = Math.round((idx / MODULES.length) * 100);
  const bar = document.getElementById("progressBar");
  if (bar) bar.style.width = pct + "%";

  const wrap = document.getElementById("progressSteps");
  if (wrap) {
    wrap.innerHTML = MODULES.map((m, i) => {
      const cls = i < idx ? "done" : i === idx ? "active" : "";
      return `<span class="step-dot ${cls}">${m.emoji} ${m.label.replace(/^\S+\s/, "")}</span>`;
    }).join("");
  }

  const label = document.getElementById("stageLabel");
  if (label) label.textContent = MODULES[idx]?.label || "✅ Hoàn thành!";
}

async function runFullSession(sessionVocab, poolData, level) {
  resetInstructionMemory(); // mỗi lượt chạy trọn 5 module là 1 "buổi" mới -> nghe lại hướng dẫn

  for (let i = 0; i < MODULES.length; i++) {
    updateProgress(i);
    const rootEl = document.getElementById("mainCard");
    await MODULES[i].run({ sessionVocab, poolData, level, rootEl });
  }
  updateProgress(MODULES.length);
}

async function main() {
  injectSharedStyles();
  await initTTSVoice();

  const wordBank = getWordBank();
  if (!wordBank.length) {
    setCard(`
      <div style="text-align:center;padding:40px;color:#ff6b6b;">
        ⚠️ Chưa có danh sách từ vựng (wordBank).<br/>
        <span style="color:#aaa;font-size:14px;">Hãy chọn từ ở trang danh sách từ trước.</span>
      </div>`);
    return;
  }

  // 1. Chọn cấp độ
  setCard(`<div style="text-align:center;padding:20px;color:#aaa;">Đang tải...</div>`);
  const level = await renderLevelSelect(document.getElementById("mainCard"));

  // 2. Tải dữ liệu buổi học (cache F5-safe qua all-shared.js)
  setCard(`
    <div style="text-align:center;padding:40px;">
      <div style="font-size:48px;animation:bounce 0.8s ease infinite alternate;">📚</div>
      <p style="color:#aaa;margin-top:16px;">Đang chuẩn bị bài học...</p>
    </div>`);

  let sessionVocab, poolData;
  try {
    ({ sessionVocab, poolData } = await loadSessionData(level));
  } catch (e) {
    console.error("Lỗi tải dữ liệu buổi học:", e);
    setCard(`<div style="text-align:center;padding:40px;color:#ff6b6b;">⚠️ Không tải được dữ liệu. Kiểm tra kết nối mạng.</div>`);
    return;
  }

  if (!sessionVocab.length) {
    setCard(`
      <div style="text-align:center;padding:40px;color:#ff6b6b;">
        ⚠️ Không tìm thấy từ vựng phù hợp cho cấp độ này.<br/>
        <span style="color:#aaa;font-size:14px;">Kiểm tra lại wordBank hoặc phạm vi bài học (SHEET_BAI_HOC).</span>
      </div>`);
    return;
  }

  await showTransition("🎮", "Let's start learning!",
    `Today you'll learn ${sessionVocab.length} new words through 5 fun activities!`);

  // 3. Vòng lặp buổi học — cho phép "Học lại" lặp vô hạn với CÙNG bộ từ
  let keepGoing = true;
  while (keepGoing) {
    await runFullSession(sessionVocab, poolData, level);
    const choice = await renderEndOfSessionPrompt(document.getElementById("mainCard"));
    keepGoing = choice === "replay";
  }

  // 4. Kết thúc hẳn buổi học — dọn lựa chọn mascot để buổi sau chọn lại
  localStorage.removeItem("selected_instructor_idx");

  setCard(`
    <div style="text-align:center;padding:30px;">
      <div style="font-size:64px;">🏆</div>
      <h2 style="color:var(--poke-yellow);">Xuất sắc! Hoàn thành bài học hôm nay!</h2>
      <p style="color:#aaa;font-size:16px;">Điểm đã được lưu tự động.</p>
      <a href="summary.html" style="display:inline-block;margin-top:20px;padding:14px 28px;
        background:var(--poke-yellow);color:#333;font-weight:bold;border-radius:14px;
        text-decoration:none;font-size:18px;">📊 Xem tổng kết</a>
    </div>`);
  const mini = document.getElementById("miniScore");
  if (mini) mini.textContent = "🏆 Xong!";
}

main();