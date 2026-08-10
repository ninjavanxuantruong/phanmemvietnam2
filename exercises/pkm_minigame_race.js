/**
 * ==========================================
 * PKM MINIGAME — ĐUA XE CHỌN ĐÁP ÁN — pkm_minigame_race.js
 * ==========================================
 * Thay lớp "nút bấm A/B/C/D" bằng 1 minigame đua xe: mỗi đáp án hiện thành
 * 1 BIỂN BÁO trên đường đua, học sinh chạm vào biển đúng để xe tự lái tới
 * và "cán đích" biển đó.
 *
 * Chơi được với 2 → 5 đáp án (tự co giãn layout theo số lượng), có hoặc
 * không có ảnh minh hoạ đều được.
 *
 * Tuân thủ ĐÚNG hợp đồng của pkm_minigame_router.js — xem chi tiết ở đó.
 * File này KHÔNG tự chấm đúng/sai — chỉ báo lại giá trị học sinh đã chọn
 * qua onAnswer(value, domEl), phần còn lại (khen/sửa/attempt) do askMCQ lo.
 *
 * NẠP SAU pkm_minigame_router.js, TRƯỚC all-orchestrator.js.
 */

let _pkrStylesInjected = false;
function injectRaceStyles() {
  if (_pkrStylesInjected) return;
  _pkrStylesInjected = true;
  const style = document.createElement("style");
  style.textContent = `
    .pkr-wrap { padding: 6px 2px 2px; }
    .pkr-road {
      position: relative; background: #2c2c34; border-radius: 14px;
      padding: 14px 10px 16px; overflow: hidden;
      border: 2px solid rgba(255,255,255,.08);
    }
    .pkr-signs {
      display: grid; gap: 10px;
      grid-template-columns: repeat(var(--pkr-cols, 2), 1fr);
    }
    @media (max-width: 480px) {
      .pkr-signs { grid-template-columns: repeat(min(var(--pkr-cols, 2), 2), 1fr); }
    }
    .pkr-sign {
      background: rgba(255,255,255,.08); border: 3px solid #8d6e63; border-radius: 12px;
      padding: 10px 8px; text-align: center; cursor: pointer;
      transition: transform .15s, border-color .15s, opacity .2s;
      color: #f0f0f0; font-weight: 700; font-size: 14px; -webkit-tap-highlight-color: transparent;
    }
    .pkr-sign:active { transform: scale(0.95); }
    .pkr-sign.pkr-reveal {
      border-color: #4caf50; box-shadow: 0 0 0 3px rgba(76,175,80,.3);
      animation: pkrGlow 1s ease infinite alternate;
    }
    @keyframes pkrGlow {
      from { box-shadow: 0 0 0 2px rgba(76,175,80,.25); }
      to   { box-shadow: 0 0 0 8px rgba(76,175,80,.05); }
    }
    .pkr-sign img {
      width: 100%; aspect-ratio: 1/1; object-fit: cover; border-radius: 8px; margin-bottom: 6px;
      background: rgba(255,255,255,.06);
    }
    .pkr-sign.pkr-locked { pointer-events: none; opacity: .5; }
    .pkr-sign.pkr-chosen-wrong { border-color: #e74c3c; }
    .pkr-sign.pkr-chosen-right { border-color: #4caf50; }
    .pkr-track { position: relative; height: 44px; margin-top: 14px; }
    .pkr-road-line {
      position: absolute; bottom: 8px; left: 0; right: 0; height: 4px;
      background-image: repeating-linear-gradient(90deg, #555 0 20px, transparent 20px 40px);
    }
    .pkr-car {
      position: absolute; bottom: 0; left: 4px; font-size: 32px; line-height: 1;
      transition: left .9s cubic-bezier(.3,.7,.2,1);
      transform: scaleX(-1);
    }
    .pkr-car.pkr-driving { filter: drop-shadow(0 0 6px rgba(255,203,5,.6)); }
  `;
  document.head.appendChild(style);
}

function runRaceGame({ stage, options, correctValue, reveal, onAnswer }) {
  injectRaceStyles();

  const cols = Math.min(options.length, 3); // tối đa 3 cột, còn lại tự xuống dòng
  stage.innerHTML = `
    <div class="pkr-wrap">
      <div class="pkr-road">
        <div class="pkr-signs" id="pkrSigns" style="--pkr-cols:${cols}"></div>
        <div class="pkr-track">
          <div class="pkr-road-line"></div>
          <div class="pkr-car" id="pkrCar">🚗</div>
        </div>
      </div>
    </div>
  `;

  const signsWrap = stage.querySelector("#pkrSigns");
  const car = stage.querySelector("#pkrCar");
  let locked = false;

  options.forEach((opt) => {
    const sign = document.createElement("div");
    sign.className = "pkr-sign";
    sign.dataset.value = opt.value;
    if (reveal && opt.value === correctValue) sign.classList.add("pkr-reveal");
    sign.innerHTML = opt.imageUrl
      ? `<img src="${opt.imageUrl}" alt="" onerror="this.style.display='none';"/><div>${opt.label}</div>`
      : `<div>${opt.label}</div>`;

    sign.onclick = () => {
      if (locked) return;
      locked = true;
      signsWrap.querySelectorAll(".pkr-sign").forEach((s) => s.classList.add("pkr-locked"));

      // Lái xe di chuyển ngang tới đúng vị trí biển báo vừa chạm
      const roadRect = stage.querySelector(".pkr-road").getBoundingClientRect();
      const signRect = sign.getBoundingClientRect();
      const targetLeft = Math.max(4, signRect.left - roadRect.left);

      car.classList.add("pkr-driving");
      car.style.left = targetLeft + "px";

      setTimeout(() => {
        sign.classList.add(opt.value === correctValue ? "pkr-chosen-right" : "pkr-chosen-wrong");
        onAnswer(opt.value, sign);
      }, 850);
    };

    signsWrap.appendChild(sign);
  });
}

// Chơi được từ 2 tới 5 đáp án, không bắt buộc phải có ảnh.
window.PkmMinigameRouter?.register("race", runRaceGame, {
  minOptions: 2,
  maxOptions: 5,
  requiresImage: false,
});
