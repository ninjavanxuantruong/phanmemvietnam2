// skillEffects.js

// 1. Tạo layer chung cho mọi hiệu ứng
function createEffectLayer(container) {
  const layer = document.createElement("div");
  Object.assign(layer.style, {
    position: "fixed",
    top: 0,
    left: 0,
    width: "100%",
    height: "100%",
    pointerEvents: "none",
    zIndex: 2000,
  });
  container.appendChild(layer);
  return layer;
}

// 2. Helper nhỏ
function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function dist(x1, y1, x2, y2) {
  const dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx*dx + dy*dy);
}

export const skillEffects = {
  /**
   * Tackle (phiên bản chậm): quả cầu ánh sáng bay chậm và fade
   */
  Tackle(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Gồng chiêu
    const attacker = document.elementFromPoint(x, y);
    if (attacker && attacker.tagName === "IMG") {
      attacker.style.animation = "attackPose 1.2s ease-in-out";
    }

    // Quả cầu
    const orb = document.createElement("div");
    Object.assign(orb.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      transform: "translate(-50%, -50%)",
      width: "100px",
      height: "100px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(255,255,140,0.9) 30%, rgba(255,200,0,0.8) 70%, transparent 100%)",
      boxShadow: "0 0 80px rgba(255,255,150,0.9), 0 0 120px rgba(255,180,0,0.8)",
      zIndex: 1002,
      transition: "top 1.5s ease-out, left 1.5s ease-out, opacity 1.5s ease-out, transform 1.5s ease-out",
    });
    layer.appendChild(orb);

    // Chậm rãi bắt đầu
    setTimeout(() => {
      orb.style.top = `${targetY}px`;
      orb.style.left = `${targetX}px`;
      orb.style.opacity = "0";
      orb.style.transform = "translate(-50%, -50%) scale(1.6)";
    }, 300);

    // Nổ nhẹ khi chạm
    setTimeout(() => {
      const boom = document.createElement("div");
      Object.assign(boom.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "60px",
        height: "60px",
        transform: "translate(-50%, -50%) scale(1)",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,240,120,1) 30%, rgba(255,160,0,0.9) 70%, transparent 100%)",
        boxShadow: "0 0 60px rgba(255,220,120,0.9), 0 0 120px rgba(255,160,0,0.8)",
        opacity: "1",
        zIndex: 1003,
        transition: "transform 0.6s ease-out, opacity 0.6s ease-out",
      });
      layer.appendChild(boom);

      requestAnimationFrame(() => {
        boom.style.transform = "translate(-50%, -50%) scale(2.2)";
        boom.style.opacity = "0";
      });
    }, 1900);

    // Cleanup
    setTimeout(() => {
      layer.remove();
    }, 3000);
  },

  /**
   * Headbutt (phiên bản chậm): tạo clone lao tới rồi nổ nhẹ
   */
  Headbutt(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const attacker = document.elementFromPoint(x, y);
    if (attacker && attacker.tagName === "IMG") {
      attacker.style.animation = "attackPose 1s ease-in-out"; // ⬅️ tăng từ 0.5s lên 1s
      attacker.style.opacity = "0";
    }

    const clone = document.createElement("img");
    clone.src = attacker?.src || "";
    Object.assign(clone.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      transform: "translate(-50%, -50%) scale(1.4)",
      height: "180px",
      opacity: "0.9",
      zIndex: 1002,
      transition: "top 1.2s ease-out, left 1.2s ease-out, opacity 1.2s ease-out" // ⬅️ tăng từ 0.6s lên 1.2s
    });
    layer.appendChild(clone);

    setTimeout(() => {
      clone.style.top = `${targetY}px`;
      clone.style.left = `${targetX}px`;
      clone.style.opacity = "0";
      clone.style.transform = "translate(-50%, -50%) scale(1.6)";
    }, 150); // ⬅️ giữ nguyên delay khởi động

    setTimeout(() => {
      const impact = document.createElement("div");
      Object.assign(impact.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "40px",
        height: "40px",
        background: "radial-gradient(circle, red 40%, orange 80%, transparent 100%)",
        borderRadius: "50%",
        transform: "translate(-50%, -50%) scale(1)",
        opacity: "1",
        zIndex: 1003,
        transition: "transform 0.6s ease-out, opacity 0.6s ease-out" // ⬅️ tăng từ 0.3s lên 0.6s
      });
      layer.appendChild(impact);

      setTimeout(() => {
        impact.style.transform = "translate(-50%, -50%) scale(2)";
        impact.style.opacity = "0";
      }, 100);
    }, 1400); // ⬅️ tăng từ 700ms lên 1400ms

    setTimeout(() => {
      if (attacker) attacker.style.opacity = "1";
      layer.remove();
    }, 2200); // ⬅️ tăng từ 1000ms lên 2200ms
  },


  // ─────────────────────────────────────────────────────────
  // 🔥 HỆ LỬA (Fire)
  // ─────────────────────────────────────────────────────────

  /**
   * Ember: đốm lửa nhỏ bay chậm để lại vệt sáng, nổ đỏ cam khi chạm
   */
  /**
   * Ember: đốm lửa nhỏ bay chậm, để lại vệt sáng, nổ đỏ cam khi chạm
   */
  Ember(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Đốm lửa
    const ember = document.createElement("div");
    Object.assign(ember.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      transform: "translate(-50%, -50%)",
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(255,200,0,1) 35%, rgba(255,80,0,0.95) 80%, transparent 100%)",
      boxShadow: "0 0 30px rgba(255,200,0,0.9), 0 0 60px rgba(255,80,0,0.85)",
      transition: "top 1.4s linear, left 1.4s linear",
      zIndex: 1003,
    });
    layer.appendChild(ember);

    // Vệt sáng mờ theo sau
    const trail = document.createElement("div");
    Object.assign(trail.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "8px",
      height: "8px",
      borderRadius: "4px",
      background: "linear-gradient(90deg, rgba(255,220,120,0.8), rgba(255,120,0,0.6))",
      boxShadow: "0 0 16px rgba(255,180,0,0.9), 0 0 26px rgba(255,80,0,0.7)",
      transform: "translate(-50%, -50%)",
      transition: "top 1.4s linear, left 1.4s linear, opacity 0.7s ease-out",
      zIndex: 1002,
    });
    layer.appendChild(trail);

    // Bay
    setTimeout(() => {
      ember.style.top = `${targetY}px`;
      ember.style.left = `${targetX}px`;
      trail.style.top = `${targetY}px`;
      trail.style.left = `${targetX}px`;
      trail.style.opacity = "0.25";
    }, 200);

    // Nổ đỏ cam khi chạm
    setTimeout(() => {
      const boom = document.createElement("div");
      Object.assign(boom.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "84px",
        height: "84px",
        borderRadius: "50%",
        transform: "translate(-50%, -50%) scale(0.85)",
        background: "radial-gradient(circle, rgba(255,240,140,1) 30%, rgba(255,110,0,1) 70%, transparent 100%)",
        boxShadow: "0 0 90px rgba(255,210,120,0.95), 0 0 160px rgba(255,100,0,0.9)",
        opacity: "1",
        zIndex: 1004,
        transition: "transform 0.7s ease-out, opacity 0.7s ease-out",
      });
      layer.appendChild(boom);

      requestAnimationFrame(() => {
        boom.style.transform = "translate(-50%, -50%) scale(1.9)";
        boom.style.opacity = "0";
      });
    }, 1500);

    setTimeout(() => layer.remove(), 2450);
  },

  /**
   * Flame Wheel: vòng lửa xoay quanh attacker, lao tới và bùng sáng + tia lửa văng khi chạm
   */
  "Flame Wheel"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Vòng lửa
    const wheel = document.createElement("div");
    Object.assign(wheel.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "132px",
      height: "132px",
      borderRadius: "50%",
      border: "6px solid rgba(255,120,0,0.95)",
      boxShadow: "0 0 40px rgba(255,140,0,0.95), inset 0 0 32px rgba(255,60,0,0.85)",
      transform: "translate(-50%, -50%) rotate(0deg)",
      transition: "top 1.4s ease-out, left 1.4s ease-out, transform 1.4s linear",
      zIndex: 1002,
    });
    layer.appendChild(wheel);

    // Lõi lửa
    const core = document.createElement("div");
    Object.assign(core.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "64px",
      height: "64px",
      borderRadius: "50%",
      transform: "translate(-50%, -50%)",
      background: "radial-gradient(circle, rgba(255,230,120,1) 35%, rgba(255,100,0,0.95) 80%, transparent 100%)",
      boxShadow: "0 0 64px rgba(255,200,120,0.95), 0 0 120px rgba(255,100,0,0.9)",
      transition: "top 1.4s ease-out, left 1.4s ease-out, transform 1.2s ease-out",
      zIndex: 1003,
    });
    layer.appendChild(core);

    // Quay nhẹ trước khi lao
    let angle = 0;
    const spin = setInterval(() => {
      angle += 12;
      wheel.style.transform = `translate(-50%, -50%) rotate(${angle}deg)`;
    }, 36);

    // Lao tới
    setTimeout(() => {
      wheel.style.top = `${targetY}px`;
      wheel.style.left = `${targetX}px`;
      core.style.top = `${targetY}px`;
      core.style.left = `${targetX}px`;
      core.style.transform = "translate(-50%, -50%) scale(1.08)";
    }, 240);

    // Bùng sáng + tia lửa văng
    setTimeout(() => {
      clearInterval(spin);
      wheel.style.opacity = "0";

      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "170px",
        height: "170px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,210,90,1) 25%, rgba(255,120,0,1) 70%, transparent 100%)",
        boxShadow: "0 0 140px rgba(255,200,120,0.95), 0 0 220px rgba(255,120,0,0.9)",
        transform: "translate(-50%, -50%) scale(0.85)",
        opacity: "1",
        zIndex: 1004,
        transition: "transform 0.75s ease-out, opacity 0.75s ease-out",
      });
      layer.appendChild(burst);

      // Tia lửa văng
      const sparksCount = 10;
      for (let i = 0; i < sparksCount; i++) {
        const spark = document.createElement("div");
        const angle = (Math.PI * 2 * i) / sparksCount;
        const dx = Math.cos(angle) * (24 + Math.random() * 46);
        const dy = Math.sin(angle) * (24 + Math.random() * 46);
        Object.assign(spark.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "6px",
          height: "6px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,220,120,1) 40%, rgba(255,120,0,0.95) 80%)",
          boxShadow: "0 0 24px rgba(255,190,100,0.95), 0 0 60px rgba(255,100,0,0.85)",
          transform: "translate(-50%, -50%)",
          opacity: "1",
          zIndex: 1005,
          transition: "top 0.7s ease-out, left 0.7s ease-out, opacity 0.7s ease-out",
        });
        layer.appendChild(spark);
        requestAnimationFrame(() => {
          spark.style.top = `${targetY + dy}px`;
          spark.style.left = `${targetX + dx}px`;
          spark.style.opacity = "0";
        });
      }

      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(1.7)";
        burst.style.opacity = "0";
      });
    }, 1550);

    setTimeout(() => layer.remove(), 2600);
  },

  /**
   * Fire Spin: 3 vòng xoáy bao quanh mục tiêu, kết thúc bằng cột lửa xoáy bùng lên
   */
  "Fire Spin"(container, { targetX, targetY }) {
    const layer = createEffectLayer(container);

    const rings = [];
    const colors = [
      "rgba(255,130,0,0.95)",
      "rgba(255,90,0,0.9)",
      "rgba(255,160,30,0.9)",
    ];

    // Vòng xoáy
    for (let i = 0; i < 3; i++) {
      const r = document.createElement("div");
      const size = 120 + i * 26;
      Object.assign(r.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        transform: "translate(-50%, -50%) rotate(0deg) scale(0.65)",
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        border: `6px solid ${colors[i]}`,
        boxShadow: "0 0 30px rgba(255,140,0,0.9), inset 0 0 30px rgba(255,60,0,0.85)",
        zIndex: 1003 + i,
        opacity: "0.98",
        transition: "transform 1.6s ease-in-out, opacity 1.2s ease-out",
      });
      rings.push(r);
      layer.appendChild(r);
    }

    // Xoáy mạnh dần
    setTimeout(() => {
      rings.forEach((r, idx) => {
        const rot = 360 * (idx + 1);
        r.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(1.0)`;
      });
    }, 120);

    setTimeout(() => {
      rings.forEach((r, idx) => {
        const rot = 720 * (idx + 1);
        r.style.transform = `translate(-50%, -50%) rotate(${rot}deg) scale(0.75)`;
        r.style.opacity = "0.0";
      });
    }, 1500);

    // Cột lửa xoáy bùng lên (tornado flame)
    setTimeout(() => {
      const tornado = document.createElement("div");
      Object.assign(tornado.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        background: "conic-gradient(from 0deg, rgba(255,160,30,0.95), rgba(255,90,0,0.9), rgba(255,220,120,0.95), rgba(255,160,30,0.95))",
        boxShadow: "0 0 140px rgba(255,180,100,0.95), 0 0 220px rgba(255,90,0,0.85)",
        transform: "translate(-50%, -50%) scale(0.8) rotate(0deg)",
        opacity: "0.95",
        zIndex: 1006,
        transition: "transform 1s ease-out, opacity 1s ease-out",
      });
      layer.appendChild(tornado);

      let ang = 0;
      const spin = setInterval(() => {
        ang += 22;
        tornado.style.transform = `translate(-50%, -50%) scale(1.2) rotate(${ang}deg)`;
      }, 50);

      setTimeout(() => {
        clearInterval(spin);
        tornado.style.opacity = "0";
        tornado.style.transform = "translate(-50%, -50%) scale(1.5) rotate(720deg)";
      }, 1000);
    }, 1700);

    setTimeout(() => layer.remove(), 2900);
  },

  /**
   * Flamethrower: (giữ bản cũ) luồng lửa nhiều đoạn flicker + burst cháy lan hoành tráng khi chạm
   */
  Flamethrower(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // 1) Luồng lửa nhiều đoạn (flicker sống động)
    const dx = targetX - x;
    const dy = targetY - y;
    const d  = Math.sqrt(dx*dx + dy*dy);
    const segments = Math.max(6, Math.floor(d / 80));
    const stepX = dx / segments;
    const stepY = dy / segments;

    const flames = [];
    for (let i = 0; i < segments; i++) {
      const seg = document.createElement("div");
      const px = x + stepX * i;
      const py = y + stepY * i;
      const w = 30 + Math.random() * 22;
      const h = 30 + Math.random() * 22;

      Object.assign(seg.style, {
        position: "fixed",
        top: `${py}px`,
        left: `${px}px`,
        transform: "translate(-50%, -50%) scale(0.6) rotate(0deg)",
        width: `${w}px`,
        height: `${h}px`,
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,240,140,1) 35%, rgba(255,120,0,0.95) 80%, transparent 100%)",
        boxShadow: "0 0 40px rgba(255,200,120,0.9), 0 0 80px rgba(255,100,0,0.85)",
        zIndex: 1002,
        opacity: "0",
        transition: "opacity 0.25s ease-out, transform 0.25s ease-out",
      });
      flames.push(seg);
      layer.appendChild(seg);
    }

    // Flicker dọc đường phun
    flames.forEach((seg, i) => {
      setTimeout(() => {
        seg.style.opacity = "1";
        seg.style.transform = "translate(-50%, -50%) scale(1) rotate(8deg)";
      }, 80 + i * 60);

      setTimeout(() => {
        seg.style.transform = "translate(-50%, -50%) scale(1.08) rotate(-6deg)";
      }, 220 + i * 60);
    });

    // 2) Tắt hẳn lửa trước khi va chạm (để không che hiệu ứng cuối)
    setTimeout(() => {
      flames.forEach((seg, i) => {
        setTimeout(() => {
          seg.style.opacity = "0";
          seg.style.transform = "translate(-50%, -50%) scale(0.7) rotate(0deg)";
        }, i * 25);
      });
    }, 1050);

    // 3) Va chạm hoành tráng (Burst + Shock Ring + Sparks + Embers), ép reflow để chắc chắn transition chạy
    setTimeout(() => {
      // Rung nhẹ (shake)
      const shakeKeyframes = [
        "translate(0, 0)", "translate(2px, -2px)", "translate(-2px, 2px)",
        "translate(2px, 2px)", "translate(-2px, -2px)", "translate(0, 0)"
      ];
      let si = 0;
      const shaker = setInterval(() => {
        layer.style.transform = shakeKeyframes[si % shakeKeyframes.length];
        si++;
      }, 20);
      setTimeout(() => { clearInterval(shaker); layer.style.transform = "translate(0,0)"; }, 200);

      // Burst (nổ lớn)
      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "220px",
        height: "220px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,240,170,1) 28%, rgba(255,120,0,1) 72%, transparent 100%)",
        boxShadow: "0 0 200px rgba(255,200,120,0.95), 0 0 300px rgba(255,120,0,0.9)",
        transform: "translate(-50%, -50%) scale(0.7)",
        opacity: "0.01",
        zIndex: 1010,
        transition: "transform 0.75s ease-out, opacity 0.75s ease-out",
      });
      layer.appendChild(burst);

      // Shock ring (vòng xung kích)
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "70px",
        height: "70px",
        borderRadius: "50%",
        border: "3px solid rgba(255,210,120,0.95)",
        boxShadow: "0 0 40px rgba(255,200,120,0.8)",
        transform: "translate(-50%, -50%) scale(0.55)",
        opacity: "0.01",
        zIndex: 1011,
        transition: "transform 0.85s ease-out, opacity 0.85s ease-out",
      });
      layer.appendChild(ring);

      // Ép reflow để đảm bảo transition khởi chạy
      // (đọc layout thuộc tính sẽ ép trình duyệt tính toán trước khi ta thay đổi style)
      // eslint-disable-next-line no-unused-vars
      const _force1 = burst.offsetWidth;
      const _force2 = ring.offsetWidth;

      // Bật hiệu ứng: xuất hiện rồi nở ra
      burst.style.opacity = "1";
      burst.style.transform = "translate(-50%, -50%) scale(1.6)";
      ring.style.opacity = "1";
      ring.style.transform = "translate(-50%, -50%) scale(2.3)";

      // Sparks (tia lửa văng)
      const sparksCount = 18;
      for (let i = 0; i < sparksCount; i++) {
        const spark = document.createElement("div");
        const ang = (Math.PI * 2 * i) / sparksCount + Math.random() * 0.3;
        const r = 48 + Math.random() * 78;
        Object.assign(spark.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "7px",
          height: "7px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,230,140,1) 40%, rgba(255,120,0,0.95) 80%)",
          boxShadow: "0 0 30px rgba(255,190,100,0.95), 0 0 80px rgba(255,100,0,0.85)",
          transform: "translate(-50%, -50%)",
          opacity: "1",
          zIndex: 1012,
          transition: "top 0.9s ease-out, left 0.9s ease-out, opacity 0.9s ease-out",
        });
        layer.appendChild(spark);
        // ép reflow rồi animate
        const _force3 = spark.offsetWidth; // eslint-disable-line no-unused-vars
        spark.style.top = `${targetY + Math.sin(ang) * r}px`;
        spark.style.left = `${targetX + Math.cos(ang) * r}px`;
        spark.style.opacity = "0";
      }

      // Embers (than hồng rơi)
      const embers = 10;
      for (let i = 0; i < embers; i++) {
        const ember = document.createElement("div");
        const vx = (Math.random() * 2 - 1) * 34;
        const vy = 55 + Math.random() * 80;
        Object.assign(ember.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "6px",
          height: "10px",
          borderRadius: "3px",
          background: "linear-gradient(180deg, rgba(255,220,140,1), rgba(255,80,0,0.95))",
          boxShadow: "0 0 20px rgba(255,160,80,0.9)",
          transform: "translate(-50%, -50%)",
          opacity: "1",
          zIndex: 1009,
          transition: "top 1s ease-out, left 1s ease-out, opacity 1s ease-out",
        });
        layer.appendChild(ember);
        const _force4 = ember.offsetWidth; // eslint-disable-line no-unused-vars
        ember.style.top = `${targetY + vy}px`;
        ember.style.left = `${targetX + vx}px`;
        ember.style.opacity = "0";
      }

      // 4) Heatwave (sóng nhiệt) xuất hiện trễ, để không che burst
      setTimeout(() => {
        const heatwave = document.createElement("div");
        Object.assign(heatwave.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "280px",
          height: "280px",
          borderRadius: "50%",
          background: "radial-gradient(circle, rgba(255,200,100,0.35) 22%, rgba(255,120,0,0.18) 60%, transparent 100%)",
          filter: "blur(14px)",
          transform: "translate(-50%, -50%) scale(0.85)",
          opacity: "0.01",
          zIndex: 1008, // thấp hơn burst/ring để không che
          transition: "transform 1.2s ease-out, opacity 1.2s ease-out",
        });
        layer.appendChild(heatwave);
        const _force5 = heatwave.offsetWidth; // eslint-disable-line no-unused-vars
        heatwave.style.opacity = "0.7";
        heatwave.style.transform = "translate(-50%, -50%) scale(1.35)";
      }, 150);

      // 5) Fade out burst + ring sau khi nở
      setTimeout(() => {
        burst.style.opacity = "0";
        ring.style.opacity = "0";
      }, 650);

    }, 1280); // mốc va chạm

    // 6) Cleanup đủ lâu để thấy hết hiệu ứng
    setTimeout(() => { layer.remove(); }, 3300);
  },
"Water Gun"(container, { x, y, targetX, targetY }) {
  const layer = createEffectLayer(container);

  // Tạo tia nước (projectile)
  const stream = document.createElement("div");
  Object.assign(stream.style, {
    position: "fixed",
    top: `${y}px`,
    left: `${x}px`,
    width: "24px",
    height: "24px",
    borderRadius: "50%",
    background: "radial-gradient(circle, #aef 40%, #39f 80%)",
    boxShadow: "0 0 20px #6cf",
    transform: "translate(-50%, -50%)",
    opacity: "1",
    zIndex: 1002,
    transition: "top 0.6s linear, left 0.6s linear, opacity 0.3s ease-out",
  });
  layer.appendChild(stream);

  // Bay từ attacker tới target
  setTimeout(() => {
    stream.style.top = `${targetY}px`;
    stream.style.left = `${targetX}px`;
  }, 50);

  // Khi chạm: splash + giọt bắn
  setTimeout(() => {
    // Ẩn tia chính
    stream.style.opacity = "0";

    // Splash
    const splash = document.createElement("div");
    Object.assign(splash.style, {
      position: "fixed",
      top: `${targetY}px`,
      left: `${targetX}px`,
      width: "80px",
      height: "80px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(190,230,255,1) 35%, rgba(80,160,255,0.9) 75%, transparent 100%)",
      boxShadow: "0 0 60px rgba(150,210,255,0.9)",
      transform: "translate(-50%, -50%) scale(0.7)",
      opacity: "1",
      zIndex: 1004,
      transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
    });
    layer.appendChild(splash);

    requestAnimationFrame(() => {
      splash.style.transform = "translate(-50%, -50%) scale(1.5)";
      splash.style.opacity = "0";
    });

    // Giọt bắn
    for (let i = 0; i < 8; i++) {
      const drop = document.createElement("div");
      const ang = (Math.PI * 2 * i) / 8 + Math.random() * 0.3;
      const r = 30 + Math.random() * 40;
      Object.assign(drop.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: "#39f",
        boxShadow: "0 0 18px #6cf",
        transform: "translate(-50%, -50%)",
        opacity: "1",
        zIndex: 1005,
        transition: "top 0.6s ease-out, left 0.6s ease-out, opacity 0.6s ease-out",
      });
      layer.appendChild(drop);
      requestAnimationFrame(() => {
        drop.style.top = `${targetY + Math.sin(ang) * r}px`;
        drop.style.left = `${targetX + Math.cos(ang) * r}px`;
        drop.style.opacity = "0";
      });
    }
  }, 650);

  // Cleanup
  setTimeout(() => { layer.remove(); }, 1600);
},


  "Bubble Beam"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    for (let i = 0; i < 8; i++) {
      const bubble = document.createElement("div");
      const offsetY = (Math.random() - 0.5) * 40;
      Object.assign(bubble.style, {
        position: "fixed",
        top: `${y + offsetY}px`,
        left: `${x}px`,
        width: "28px",
        height: "28px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(200,240,255,0.9) 40%, rgba(100,180,255,0.7) 80%)",
        boxShadow: "0 0 20px #9cf",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "0.9",
        transition: "top 1.2s linear, left 1.2s linear, opacity 0.6s ease-out",
        zIndex: 1002,
      });
      layer.appendChild(bubble);

      setTimeout(() => {
        bubble.style.top = `${targetY}px`;
        bubble.style.left = `${targetX}px`;
      }, 100 + i * 80);

      // Nổ bong bóng
      setTimeout(() => {
        bubble.style.transform = "translate(-50%, -50%) scale(1.6)";
        bubble.style.opacity = "0";
      }, 1300 + i * 80);
    }

    setTimeout(() => layer.remove(), 2500);
  },

"Aqua Tail"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const dx = targetX - x;
    const dy = targetY - y;
    const angle = Math.atan2(dy, dx);

    // Dải nước hình oval (đuôi nước)
    const tail = document.createElement("div");
    Object.assign(tail.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "100px",
      height: "50px",
      borderRadius: "50%",
      background: "radial-gradient(circle at 30% 50%, rgba(180,230,255,0.9), rgba(80,160,255,0.8) 70%, transparent 100%)",
      boxShadow: "0 0 40px rgba(120,200,255,0.8)",
      filter: "blur(2px)",
      transform: `translate(-50%, -50%) rotate(${angle - Math.PI/4}rad) scale(0.6)`,
      opacity: "0.9",
      zIndex: 1002,
      transition: "top 0.9s ease-out, left 0.9s ease-out, transform 0.9s ease-out, opacity 0.6s ease-out",
    });
    layer.appendChild(tail);

    // Quét tới target
    setTimeout(() => {
      tail.style.top = `${targetY}px`;
      tail.style.left = `${targetX}px`;
      tail.style.transform = `translate(-50%, -50%) rotate(${angle + Math.PI/6}rad) scale(1.0)`;
    }, 100);

    // Va chạm: sóng nước + giọt bắn
    setTimeout(() => {
      // Sóng nước
      const wave = document.createElement("div");
      Object.assign(wave.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        border: "8px solid rgba(120,190,255,0.9)",
        boxShadow: "0 0 50px rgba(120,190,255,0.8)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1004,
        transition: "transform 0.8s ease-out, opacity 0.8s ease-out",
      });
      layer.appendChild(wave);
      requestAnimationFrame(() => {
        wave.style.transform = "translate(-50%, -50%) scale(2.0)";
        wave.style.opacity = "0";
      });

      // Giọt nước bắn
      for (let i = 0; i < 14; i++) {
        const drop = document.createElement("div");
        const ang = (Math.PI * 2 * i) / 14 + Math.random() * 0.3;
        const r = 50 + Math.random() * 70;
        Object.assign(drop.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "10px",
          height: "10px",
          borderRadius: "50%",
          background: "radial-gradient(circle, #aef, #39f)",
          boxShadow: "0 0 20px #6cf",
          transform: "translate(-50%, -50%)",
          opacity: "1",
          zIndex: 1005,
          transition: "top 0.9s ease-out, left 0.9s ease-out, opacity 0.9s ease-out",
        });
        layer.appendChild(drop);
        const _f = drop.offsetWidth;
        drop.style.top = `${targetY + Math.sin(ang) * r}px`;
        drop.style.left = `${targetX + Math.cos(ang) * r}px`;
        drop.style.opacity = "0";
      }
    }, 1000);

    // Cleanup
    setTimeout(() => { tail.style.opacity = "0"; }, 1300);
    setTimeout(() => { layer.remove(); }, 2200);
  },



"Hydro Pump"(container, { x, y, targetX, targetY }) {
  const layer = createEffectLayer(container);

  const angle = Math.atan2(targetY - y, targetX - x);

  // Luồng nước mạnh (beam) chạy từ attacker tới target
  const beam = document.createElement("div");
  Object.assign(beam.style, {
    position: "fixed",
    top: `${y}px`,
    left: `${x}px`,
    width: "320px",
    height: "90px",
    borderRadius: "45px",
    background: "linear-gradient(90deg, rgba(200,240,255,1), rgba(80,160,255,1), rgba(80,160,255,0))",
    boxShadow: "0 0 80px rgba(120,200,255,0.95), inset 0 0 30px rgba(180,230,255,0.9)",
    transformOrigin: "left center",
    transform: `translate(-50%, -50%) rotate(${angle}rad) scaleX(0)`,
    opacity: "1",
    zIndex: 1002,
    transition: "transform 1.2s ease-out, opacity 0.8s ease-out",
  });
  layer.appendChild(beam);

  // Ép reflow và bật beam
  const _force = beam.offsetWidth;
  beam.style.transform = `translate(-50%, -50%) rotate(${angle}rad) scaleX(1)`;

  // Nháy áp lực dọc beam (pressure flashes)
  const flashes = [];
  const flashCount = 6;
  for (let i = 0; i < flashCount; i++) {
    const flash = document.createElement("div");
    const t = i / (flashCount - 1);
    const fx = x + (targetX - x) * t;
    const fy = y + (targetY - y) * t;
    Object.assign(flash.style, {
      position: "fixed",
      top: `${fy}px`,
      left: `${fx}px`,
      width: "28px",
      height: "28px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(200,240,255,0.9) 40%, rgba(80,160,255,0.8) 80%)",
      boxShadow: "0 0 28px rgba(150,210,255,0.9)",
      transform: "translate(-50%, -50%) scale(0.6)",
      opacity: "0",
      zIndex: 1003,
      transition: "opacity 0.35s ease-out, transform 0.35s ease-out",
    });
    flashes.push(flash);
    layer.appendChild(flash);
    setTimeout(() => {
      flash.style.opacity = "1";
      flash.style.transform = "translate(-50%, -50%) scale(1)";
    }, 120 + i * 120);
    setTimeout(() => {
      flash.style.opacity = "0";
      flash.style.transform = "translate(-50%, -50%) scale(0.8)";
    }, 420 + i * 120);
  }

  // Va chạm cực mạnh: nổ nước + vòng sóng + giọt bắn
  setTimeout(() => {
    // Nổ nước lớn
    const splash = document.createElement("div");
    Object.assign(splash.style, {
      position: "fixed",
      top: `${targetY}px`,
      left: `${targetX}px`,
      width: "260px",
      height: "260px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(200,240,255,1) 35%, rgba(80,160,255,1) 70%, transparent 100%)",
      boxShadow: "0 0 160px rgba(150,210,255,0.95), 0 0 260px rgba(80,160,255,0.9)",
      transform: "translate(-50%, -50%) scale(0.8)",
      opacity: "1",
      zIndex: 1010,
      transition: "transform 0.9s ease-out, opacity 0.9s ease-out",
    });
    layer.appendChild(splash);

    // Vòng sóng lan
    const ring = document.createElement("div");
    Object.assign(ring.style, {
      position: "fixed",
      top: `${targetY}px`,
      left: `${targetX}px`,
      width: "90px",
      height: "90px",
      borderRadius: "50%",
      border: "5px solid rgba(160,210,255,0.95)",
      boxShadow: "0 0 50px rgba(160,210,255,0.85)",
      transform: "translate(-50%, -50%) scale(0.6)",
      opacity: "1",
      zIndex: 1011,
      transition: "transform 1.0s ease-out, opacity 1.0s ease-out",
    });
    layer.appendChild(ring);

    // Ép reflow
    const _f1 = splash.offsetWidth; // eslint-disable-line no-unused-vars
    const _f2 = ring.offsetWidth;   // eslint-disable-line no-unused-vars

    // Animate nở ra
    splash.style.transform = "translate(-50%, -50%) scale(1.6)";
    splash.style.opacity = "0";
    ring.style.transform = "translate(-50%, -50%) scale(2.5)";
    ring.style.opacity = "0";

    // Giọt nước bắn tung tóe
    for (let i = 0; i < 24; i++) {
      const drop = document.createElement("div");
      const ang = (Math.PI * 2 * i) / 24 + Math.random() * 0.25;
      const r = 70 + Math.random() * 110;
      Object.assign(drop.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: "#39f",
        boxShadow: "0 0 24px #6cf",
        transform: "translate(-50%, -50%)",
        opacity: "1",
        zIndex: 1012,
        transition: "top 1.0s ease-out, left 1.0s ease-out, opacity 1.0s ease-out",
      });
      layer.appendChild(drop);
      const _f = drop.offsetWidth; // eslint-disable-line no-unused-vars
      drop.style.top = `${targetY + Math.sin(ang) * r}px`;
      drop.style.left = `${targetX + Math.cos(ang) * r}px`;
      drop.style.opacity = "0";
    }

    // Tắt beam sau va chạm
    setTimeout(() => { beam.style.opacity = "0"; }, 200);

  }, 1200);

  // Cleanup đủ lâu để thấy hết hiệu ứng
  setTimeout(() => { layer.remove(); }, 3200);
},
// hệ lá


  "Razor Leaf"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const count = 8;
    for (let i = 0; i < count; i++) {
      const leaf = document.createElement("div");
      const size = 20 + Math.random() * 10;
      const curveY = (Math.random() - 0.5) * 70;

      Object.assign(leaf.style, {
        position: "fixed",
        top: `${y}px`,
        left: `${x}px`,
        width: `${size}px`,
        height: `${size/2}px`,
        background: "linear-gradient(90deg, #2ecc71, #27ae60)",
        borderRadius: "10px",
        transform: "translate(-50%, -50%) rotate(0deg)",
        boxShadow: "0 0 12px rgba(46,204,113,0.5)",
        opacity: "1",
        zIndex: 1002,
        transition: "top 1.2s ease-in, left 1.2s ease-in, transform 1.2s ease-in, opacity 0.6s ease-out",
      });
      layer.appendChild(leaf);

      setTimeout(() => {
        leaf.style.top = `${targetY + curveY}px`;
        leaf.style.left = `${targetX}px`;
        leaf.style.transform = `translate(-50%, -50%) rotate(${360 + Math.random()*180}deg)`;
      }, 100 + i * 80);

      // Va chạm: vỡ vụn
      setTimeout(() => {
        leaf.style.opacity = "0";
        // Vòng cắt xanh
        if (i === Math.floor(count / 2)) {
          const ring = document.createElement("div");
          Object.assign(ring.style, {
            position: "fixed",
            top: `${targetY}px`,
            left: `${targetX}px`,
            width: "70px",
            height: "70px",
            borderRadius: "50%",
            border: "4px dashed rgba(39,174,96,0.9)",
            transform: "translate(-50%, -50%) scale(0.6)",
            opacity: "1",
            zIndex: 1005,
            transition: "transform 0.7s ease-out, opacity 0.7s ease-out",
          });
          layer.appendChild(ring);
          requestAnimationFrame(() => {
            ring.style.transform = "translate(-50%, -50%) scale(2.0)";
            ring.style.opacity = "0";
          });
        }
      }, 1300 + i * 80);
    }

    setTimeout(() => { layer.remove(); }, 2500);
  },

  

  "Vine Whip"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Create full-screen SVG overlay (no transforms, precise coordinates)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: 1002,
    });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    layer.appendChild(svg);

    // Helper to make a vine path from attacker to target
    const makeVine = (width, color, glow) => {
      const p = document.createElementNS("http://www.w3.org/2000/svg", "path");
      p.setAttribute("d", `M ${x} ${y} L ${targetX} ${targetY}`);
      p.setAttribute("fill", "none");
      p.setAttribute("stroke", color);
      p.setAttribute("stroke-width", width);
      p.setAttribute("stroke-linecap", "round");
      p.setAttribute("stroke-linejoin", "round");
      p.style.filter = glow;
      // Wave motion via dashed stroke
      p.setAttribute("stroke-dasharray", "14 8");
      p.setAttribute("stroke-dashoffset", "140");
      return p;
    };

    // Two parallel vines: inner bright + outer soft glow
    const vineOuter = makeVine(10, "#2ecc71", "drop-shadow(0 0 10px rgba(46,204,113,0.7))");
    const vineInner = makeVine(6, "#27ae60", "drop-shadow(0 0 6px rgba(39,174,96,0.7))");
    svg.appendChild(vineOuter);
    svg.appendChild(vineInner);

    // Animate dashoffset to simulate wave motion
    let offset = 140;
    const wave = setInterval(() => {
      offset -= 8;
      vineOuter.setAttribute("stroke-dashoffset", `${offset}`);
      vineInner.setAttribute("stroke-dashoffset", `${offset}`);
    }, 30);

    // Impact: ring + leaf shards (vines stay visible briefly)
    setTimeout(() => {
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        border: "5px solid rgba(46,204,113,0.9)",
        boxShadow: "0 0 24px rgba(46,204,113,0.7)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1005,
        transition: "transform 0.7s ease-out, opacity 0.7s ease-out",
      });
      layer.appendChild(ring);
      requestAnimationFrame(() => {
        ring.style.transform = "translate(-50%, -50%) scale(2.0)";
        ring.style.opacity = "0";
      });

      // Leaf shards
      const shards = 10;
      for (let i = 0; i < shards; i++) {
        const shard = document.createElement("div");
        const ang = (Math.PI * 2 * i) / shards + Math.random() * 0.25;
        const r = 40 + Math.random() * 60;
        Object.assign(shard.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "12px",
          height: "6px",
          background: "linear-gradient(90deg, #2ecc71, #27ae60)",
          borderRadius: "3px",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1006,
          transition: "top 0.8s ease-out, left 0.8s ease-out, opacity 0.8s ease-out, transform 0.8s ease-out",
        });
        layer.appendChild(shard);
        const _f = shard.offsetWidth; // force reflow
        shard.style.top = `${targetY + Math.sin(ang) * r}px`;
        shard.style.left = `${targetX + Math.cos(ang) * r}px`;
        shard.style.transform = `translate(-50%, -50%) rotate(${(Math.random() * 2 - 1) * 45}deg)`;
        shard.style.opacity = "0";
      }
    }, 600);

    // Stop wave and cleanup (vines persist a moment after impact)
    setTimeout(() => { clearInterval(wave); }, 1400);
    setTimeout(() => { layer.remove(); }, 2000);
  },

  "Solar Beam"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Aura charge quanh attacker
    const charge = document.createElement("div");
    Object.assign(charge.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "140px",
      height: "140px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(255,255,180,0.8) 30%, rgba(46,204,113,0.7) 70%, transparent 100%)",
      boxShadow: "0 0 60px rgba(255,255,180,0.9), 0 0 100px rgba(46,204,113,0.8)",
      transform: "translate(-50%, -50%) scale(0.8)",
      opacity: "0",
      zIndex: 1002,
      transition: "transform 0.8s ease-out, opacity 0.8s ease-out",
    });
    layer.appendChild(charge);

    requestAnimationFrame(() => {
      charge.style.opacity = "1";
      charge.style.transform = "translate(-50%, -50%) scale(1.1)";
    });

    // SVG beam từ attacker → target
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: 1003,
    });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    layer.appendChild(svg);

    const beam = document.createElementNS("http://www.w3.org/2000/svg", "line");
    beam.setAttribute("x1", x);
    beam.setAttribute("y1", y);
    beam.setAttribute("x2", targetX);
    beam.setAttribute("y2", targetY);
    beam.setAttribute("stroke", "url(#solarGradient)");
    beam.setAttribute("stroke-width", "24");
    beam.setAttribute("stroke-linecap", "round");
    beam.style.opacity = "0";

    // Gradient cho beam
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", "solarGradient");
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "100%");
    grad.setAttribute("y2", "0%");
    const stop1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop1.setAttribute("offset", "0%");
    stop1.setAttribute("stop-color", "rgba(255,255,180,1)");
    const stop2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    stop2.setAttribute("offset", "100%");
    stop2.setAttribute("stop-color", "rgba(46,204,113,1)");
    grad.appendChild(stop1);
    grad.appendChild(stop2);
    defs.appendChild(grad);
    svg.appendChild(defs);
    svg.appendChild(beam);

    // Bắn beam sau khi gồng
    setTimeout(() => {
      beam.style.transition = "opacity 0.3s ease-in";
      beam.style.opacity = "1";
    }, 600);

    // Va chạm
    setTimeout(() => {
      charge.style.opacity = "0"; // tắt aura

      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "240px",
        height: "240px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,200,1) 28%, rgba(46,204,113,1) 72%, transparent 100%)",
        boxShadow: "0 0 200px rgba(255,255,200,0.95), 0 0 300px rgba(46,204,113,0.9)",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 0.9s ease-out, opacity 0.9s ease-out",
      });
      layer.appendChild(burst);

      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "90px",
        height: "90px",
        borderRadius: "50%",
        border: "5px solid rgba(255,255,200,0.95)",
        boxShadow: "0 0 50px rgba(255,255,200,0.85)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1011,
        transition: "transform 1.0s ease-out, opacity 1.0s ease-out",
      });
      layer.appendChild(ring);

      // Tia sáng nhỏ
      for (let i = 0; i < 16; i++) {
        const ray = document.createElement("div");
        const ang = (Math.PI * 2 * i) / 16 + Math.random() * 0.2;
        const r = 70 + Math.random() * 110;
        Object.assign(ray.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "12px",
          height: "2px",
          background: "linear-gradient(90deg, rgba(255,255,220,1), rgba(46,204,113,0.8))",
          borderRadius: "1px",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1012,
          transition: "top 1.0s ease-out, left 1.0s ease-out, opacity 1.0s ease-out, transform 1.0s ease-out",
        });
        layer.appendChild(ray);
        const _f = ray.offsetWidth;
        ray.style.top = `${targetY + Math.sin(ang) * r}px`;
        ray.style.left = `${targetX + Math.cos(ang) * r}px`;
        ray.style.transform = `translate(-50%, -50%) rotate(${(ang*180/Math.PI)}deg)`;
        ray.style.opacity = "0";
      }

      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(1.6)";
        burst.style.opacity = "0";
        ring.style.transform = "translate(-50%, -50%) scale(2.5)";
        ring.style.opacity = "0";
      });
    }, 1600);

    // Cleanup
    setTimeout(() => { beam.style.opacity = "0"; }, 1900);
    setTimeout(() => { layer.remove(); }, 2800);
  },

  "Seed Bomb"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Hạt giống bay
    const seed = document.createElement("div");
    Object.assign(seed.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "20px",
      height: "20px",
      borderRadius: "50%",
      background: "radial-gradient(circle, #7f8c8d 40%, #95a5a6 80%)",
      boxShadow: "0 0 12px rgba(127,140,141,0.6)",
      transform: "translate(-50%, -50%)",
      opacity: "1",
      zIndex: 1002,
      transition: "top 0.9s ease-out, left 0.9s ease-out",
    });
    layer.appendChild(seed);

    // Bay đến target
    setTimeout(() => {
      seed.style.top = `${targetY}px`;
      seed.style.left = `${targetX}px`;
    }, 50);

    // Khi chạm: mọc dây leo bao quanh
    setTimeout(() => {
      seed.style.opacity = "0";

      // Vòng dây leo bao quanh target
      for (let i = 0; i < 3; i++) {
        const vine = document.createElement("div");
        Object.assign(vine.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "0px",
          height: "0px",
          border: "4px solid rgba(39,174,96,0.9)",
          borderRadius: "50%",
          boxShadow: "0 0 20px rgba(39,174,96,0.7)",
          transform: "translate(-50%, -50%) scale(0.5)",
          opacity: "1",
          zIndex: 1005,
          transition: "width 0.8s ease-out, height 0.8s ease-out, transform 0.8s ease-out, opacity 1.2s ease-out",
        });
        layer.appendChild(vine);

        // Animate vòng dây leo lớn dần
        setTimeout(() => {
          vine.style.width = `${80 + i * 30}px`;
          vine.style.height = `${80 + i * 30}px`;
          vine.style.transform = "translate(-50%, -50%) scale(1)";
          vine.style.opacity = "0.9";
        }, 50 + i * 150);
      }

      // Các nhánh dây leo văng ra như trói
      for (let i = 0; i < 6; i++) {
        const tendril = document.createElement("div");
        const ang = (Math.PI * 2 * i) / 6;
        const r = 60;
        Object.assign(tendril.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "0px",
          height: "6px",
          background: "linear-gradient(90deg, #27ae60, #2ecc71)",
          borderRadius: "3px",
          transformOrigin: "left center",
          transform: `rotate(${ang}rad)`,
          opacity: "1",
          zIndex: 1006,
          transition: "width 0.8s ease-out, opacity 0.8s ease-out",
        });
        layer.appendChild(tendril);

        // Animate mọc ra
        setTimeout(() => {
          tendril.style.width = `${r}px`;
        }, 100 + i * 100);
      }
    }, 1000);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 2500);
  },

  "Spark"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Full-screen SVG for precise attacker → target coordinates
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: 1003,
    });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    layer.appendChild(svg);

    // Utility: build one crackling bolt polyline
    const makeBolt = (jitterAmp = 10, segments = 9, colorOuter = "#ffeb99", colorInner = "#fff") => {
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const px = x + (targetX - x) * t;
        const py = y + (targetY - y) * t + (Math.sin(t * Math.PI * 2) * (i % 2 === 0 ? jitterAmp : -jitterAmp));
        pts.push(`${px},${py}`);
      }
      const outer = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      outer.setAttribute("points", pts.join(" "));
      outer.setAttribute("fill", "none");
      outer.setAttribute("stroke", colorOuter);
      outer.setAttribute("stroke-width", "16");
      outer.setAttribute("stroke-linecap", "round");
      outer.setAttribute("stroke-linejoin", "round");
      outer.style.filter = "drop-shadow(0 0 16px rgba(255,230,120,0.95))";
      outer.style.opacity = "0";

      const inner = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      inner.setAttribute("points", pts.join(" "));
      inner.setAttribute("fill", "none");
      inner.setAttribute("stroke", colorInner);
      inner.setAttribute("stroke-width", "7");
      inner.setAttribute("stroke-linecap", "round");
      inner.setAttribute("stroke-linejoin", "round");
      inner.style.filter = "drop-shadow(0 0 8px rgba(255,255,220,0.95))";
      inner.style.opacity = "0";

      // Crackle dash
      outer.setAttribute("stroke-dasharray", "20 10");
      inner.setAttribute("stroke-dasharray", "12 7");

      svg.appendChild(outer);
      svg.appendChild(inner);

      return { outer, inner };
    };

    // Create multiple bolts (Spark = energetic multi-arc)
    const bolts = [];
    const boltCount = 3; // center + two slight variants
    for (let i = 0; i < boltCount; i++) {
      const jitter = 10 + i * 4; // each bolt crackles differently
      bolts.push(makeBolt(jitter));
    }

    // Appear in a rapid flash sequence from the attacker
    bolts.forEach(({ outer, inner }, idx) => {
      setTimeout(() => {
        outer.style.transition = "opacity 90ms ease-out";
        inner.style.transition = "opacity 90ms ease-out";
        outer.style.opacity = "1";
        inner.style.opacity = "1";
      }, 40 * idx);
    });

    // Animate crackle for all bolts
    let dash = 0;
    const crackle = setInterval(() => {
      dash += 6;
      bolts.forEach(({ outer, inner }) => {
        outer.setAttribute("stroke-dashoffset", `${dash}`);
        inner.setAttribute("stroke-dashoffset", `${dash}`);
      });
    }, 28);

    // Along-the-path spark particles (travelers)
    const travelers = 10;
    for (let i = 0; i < travelers; i++) {
      const t = i / (travelers - 1);
      const px = x + (targetX - x) * t;
      const py = y + (targetY - y) * t;
      const spark = document.createElement("div");
      Object.assign(spark.style, {
        position: "fixed",
        top: `${py}px`,
        left: `${px}px`,
        width: "8px",
        height: "8px",
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff 40%, #ffd84d 80%)",
        boxShadow: "0 0 14px rgba(255,220,100,0.9)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "0",
        zIndex: 1004,
        transition: "opacity 120ms ease-out, transform 120ms ease-out",
      });
      layer.appendChild(spark);
      setTimeout(() => {
        spark.style.opacity = "1";
        spark.style.transform = "translate(-50%, -50%) scale(1)";
      }, 60 + i * 30);
      setTimeout(() => {
        spark.style.opacity = "0";
        spark.style.transform = "translate(-50%, -50%) scale(0.6)";
      }, 260 + i * 30);
    }

    // Impact: golden burst + electric ring + dense branching forks + subtle shake
    setTimeout(() => {
      // Subtle shake
      const shakes = ["translate(0,0)", "translate(2px,-2px)", "translate(-2px,2px)", "translate(2px,2px)", "translate(-2px,-2px)"];
      let si = 0;
      const shaker = setInterval(() => {
        layer.style.transform = shakes[si % shakes.length];
        si++;
      }, 18);
      setTimeout(() => { clearInterval(shaker); layer.style.transform = "translate(0,0)"; }, 180);

      // Burst
      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "160px",
        height: "160px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,220,1) 30%, rgba(255,215,100,0.95) 70%, transparent 100%)",
        boxShadow: "0 0 200px rgba(255,240,160,0.95)",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 280ms ease-out, opacity 280ms ease-out",
      });
      layer.appendChild(burst);
      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(1.55)";
        burst.style.opacity = "0";
      });

      // Electric ring
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "84px",
        height: "84px",
        borderRadius: "50%",
        border: "4px solid rgba(255,230,120,0.95)",
        boxShadow: "0 0 60px rgba(255,230,120,0.85)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1011,
        transition: "transform 340ms ease-out, opacity 340ms ease-out",
      });
      layer.appendChild(ring);
      requestAnimationFrame(() => {
        ring.style.transform = "translate(-50%, -50%) scale(2.4)";
        ring.style.opacity = "0";
      });

      // Dense branching forks
      const forks = 12;
      for (let i = 0; i < forks; i++) {
        const fork = document.createElement("div");
        const ang = (Math.PI * 2 * i) / forks + Math.random() * 0.28;
        const r = 52 + Math.random() * 78;
        Object.assign(fork.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "34px",
          height: "2px",
          background: "linear-gradient(90deg, #fff, #ffd84d)",
          borderRadius: "1px",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1012,
          transition: "top 320ms ease-out, left 320ms ease-out, opacity 320ms ease-out, transform 320ms ease-out",
        });
        layer.appendChild(fork);
        const _f = fork.offsetWidth; // force reflow
        fork.style.top = `${targetY + Math.sin(ang) * r}px`;
        fork.style.left = `${targetX + Math.cos(ang) * r}px`;
        fork.style.transform = `translate(-50%, -50%) rotate(${(ang * 180) / Math.PI}deg)`;
        fork.style.opacity = "0";
      }
    }, 320);

    // Fade bolts after impact
    setTimeout(() => {
      clearInterval(crackle);
      bolts.forEach(({ outer, inner }) => {
        outer.style.transition = "opacity 140ms ease-out";
        inner.style.transition = "opacity 140ms ease-out";
        outer.style.opacity = "0";
        inner.style.opacity = "0";
      });
    }, 700);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 1300);
  },


  "Thunder Shock"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // SVG toàn màn hình
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: 1003,
    });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    layer.appendChild(svg);

    // Polyline zig-zag nhỏ
    const segments = 6;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px = x + (targetX - x) * t;
      const py = y + (targetY - y) * t + (Math.sin(t * Math.PI * 2) * (i % 2 === 0 ? 4 : -4)); // lệch nhỏ
      points.push(`${px},${py}`);
    }

    // Outer glow vàng (mảnh hơn)
    const boltOuter = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    boltOuter.setAttribute("points", points.join(" "));
    boltOuter.setAttribute("fill", "none");
    boltOuter.setAttribute("stroke", "#ffeb99");
    boltOuter.setAttribute("stroke-width", "5"); // nhỏ hơn 1/3
    boltOuter.setAttribute("stroke-linecap", "round");
    boltOuter.setAttribute("stroke-linejoin", "round");
    boltOuter.style.filter = "drop-shadow(0 0 6px rgba(255,230,100,0.9))";
    boltOuter.style.opacity = "0";

    // Inner core trắng
    const boltInner = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    boltInner.setAttribute("points", points.join(" "));
    boltInner.setAttribute("fill", "none");
    boltInner.setAttribute("stroke", "#fff");
    boltInner.setAttribute("stroke-width", "2"); // rất mảnh
    boltInner.setAttribute("stroke-linecap", "round");
    boltInner.setAttribute("stroke-linejoin", "round");
    boltInner.style.filter = "drop-shadow(0 0 3px rgba(255,255,200,0.95))";
    boltInner.style.opacity = "0";

    svg.appendChild(boltOuter);
    svg.appendChild(boltInner);

    // Hiện tia điện nhanh
    requestAnimationFrame(() => {
      boltOuter.style.transition = "opacity 80ms ease-out";
      boltInner.style.transition = "opacity 80ms ease-out";
      boltOuter.style.opacity = "1";
      boltInner.style.opacity = "1";
    });

    // Va chạm nhỏ gọn
    setTimeout(() => {
      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "60px",
        height: "60px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,200,1) 40%, rgba(255,220,100,0.9) 80%, transparent 100%)",
        boxShadow: "0 0 40px rgba(255,240,150,0.9)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 200ms ease-out, opacity 200ms ease-out",
      });
      layer.appendChild(burst);
      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(1.2)";
        burst.style.opacity = "0";
      });
    }, 200);

    // Fade bolt
    setTimeout(() => {
      boltOuter.style.transition = "opacity 100ms ease-out";
      boltInner.style.transition = "opacity 100ms ease-out";
      boltOuter.style.opacity = "0";
      boltInner.style.opacity = "0";
    }, 400);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 800);
  },


  "Thunder Shock"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // SVG toàn màn hình
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: 1003,
    });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    layer.appendChild(svg);

    // Polyline zig-zag nhỏ
    const segments = 6;
    const points = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px = x + (targetX - x) * t;
      const py = y + (targetY - y) * t + (Math.sin(t * Math.PI * 2) * (i % 2 === 0 ? 4 : -4));
      points.push(`${px},${py}`);
    }

    // Outer glow vàng
    const boltOuter = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    boltOuter.setAttribute("points", points.join(" "));
    boltOuter.setAttribute("fill", "none");
    boltOuter.setAttribute("stroke", "#ffeb99");
    boltOuter.setAttribute("stroke-width", "5");
    boltOuter.setAttribute("stroke-linecap", "round");
    boltOuter.setAttribute("stroke-linejoin", "round");
    boltOuter.style.filter = "drop-shadow(0 0 6px rgba(255,230,100,0.9))";
    boltOuter.style.opacity = "0";

    // Inner core trắng
    const boltInner = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    boltInner.setAttribute("points", points.join(" "));
    boltInner.setAttribute("fill", "none");
    boltInner.setAttribute("stroke", "#fff");
    boltInner.setAttribute("stroke-width", "2");
    boltInner.setAttribute("stroke-linecap", "round");
    boltInner.setAttribute("stroke-linejoin", "round");
    boltInner.style.filter = "drop-shadow(0 0 3px rgba(255,255,200,0.95))";
    boltInner.style.opacity = "0";

    svg.appendChild(boltOuter);
    svg.appendChild(boltInner);

    // Hiện tia điện nhanh
    requestAnimationFrame(() => {
      boltOuter.style.transition = "opacity 80ms ease-out";
      boltInner.style.transition = "opacity 80ms ease-out";
      boltOuter.style.opacity = "1";
      boltInner.style.opacity = "1";
    });

    // Va chạm nhỏ gọn
    setTimeout(() => {
      // Burst nhỏ
      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "70px",
        height: "70px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,200,1) 40%, rgba(255,220,100,0.9) 80%, transparent 100%)",
        boxShadow: "0 0 50px rgba(255,240,150,0.9)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 200ms ease-out, opacity 200ms ease-out",
      });
      layer.appendChild(burst);
      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(1.3)";
        burst.style.opacity = "0";
      });

      // Ring nhỏ
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "40px",
        height: "40px",
        borderRadius: "50%",
        border: "2px solid rgba(255,230,120,0.95)",
        boxShadow: "0 0 20px rgba(255,230,120,0.8)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1011,
        transition: "transform 250ms ease-out, opacity 250ms ease-out",
      });
      layer.appendChild(ring);
      requestAnimationFrame(() => {
        ring.style.transform = "translate(-50%, -50%) scale(1.8)";
        ring.style.opacity = "0";
      });

      // Vài nhánh điện nhỏ
      for (let i = 0; i < 4; i++) {
        const fork = document.createElement("div");
        const ang = (Math.PI * 2 * i) / 4 + Math.random() * 0.2;
        const r = 25 + Math.random() * 30;
        Object.assign(fork.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "20px",
          height: "2px",
          background: "linear-gradient(90deg, #fff, #ffd84d)",
          borderRadius: "1px",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1012,
          transition: "top 200ms ease-out, left 200ms ease-out, opacity 200ms ease-out, transform 200ms ease-out",
        });
        layer.appendChild(fork);
        const _f = fork.offsetWidth;
        fork.style.top = `${targetY + Math.sin(ang) * r}px`;
        fork.style.left = `${targetX + Math.cos(ang) * r}px`;
        fork.style.transform = `translate(-50%, -50%) rotate(${(ang * 180) / Math.PI}deg)`;
        fork.style.opacity = "0";
      }
    }, 200);

    // Fade bolt
    setTimeout(() => {
      boltOuter.style.transition = "opacity 100ms ease-out";
      boltInner.style.transition = "opacity 100ms ease-out";
      boltOuter.style.opacity = "0";
      boltInner.style.opacity = "0";
    }, 400);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 900);
  },


  "Thunderbolt"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Full-screen SVG for precise coordinates
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: 1003,
    });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    layer.appendChild(svg);

    // Define a straight beam (slight micro-jitter to feel alive)
    const segments = 10;
    const pts = [];
    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const px = x + (targetX - x) * t;
      const py = y + (targetY - y) * t + (Math.sin(t * Math.PI * 4) * (i % 2 === 0 ? 2 : -2)); // subtle jitter
      pts.push(`${px},${py}`);
    }

    // Gradient for golden beam
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "linearGradient");
    grad.setAttribute("id", "tbGradient");
    grad.setAttribute("x1", "0%");
    grad.setAttribute("y1", "0%");
    grad.setAttribute("x2", "100%");
    grad.setAttribute("y2", "0%");
    const g1 = document.createElementNS("http://www.w3.org/2000/svg", "stop"); g1.setAttribute("offset", "0%"); g1.setAttribute("stop-color", "#fff");
    const g2 = document.createElementNS("http://www.w3.org/2000/svg", "stop"); g2.setAttribute("offset", "100%"); g2.setAttribute("stop-color", "#ffd84d");
    grad.appendChild(g1); grad.appendChild(g2);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // Outer glow beam
    const beamOuter = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    beamOuter.setAttribute("points", pts.join(" "));
    beamOuter.setAttribute("fill", "none");
    beamOuter.setAttribute("stroke", "#ffeb99");
    beamOuter.setAttribute("stroke-width", "22");
    beamOuter.setAttribute("stroke-linecap", "round");
    beamOuter.setAttribute("stroke-linejoin", "round");
    beamOuter.style.filter = "drop-shadow(0 0 18px rgba(255,230,120,0.95))";
    beamOuter.style.opacity = "0";

    // Inner bright core with gradient
    const beamInner = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
    beamInner.setAttribute("points", pts.join(" "));
    beamInner.setAttribute("fill", "none");
    beamInner.setAttribute("stroke", "url(#tbGradient)");
    beamInner.setAttribute("stroke-width", "10");
    beamInner.setAttribute("stroke-linecap", "round");
    beamInner.setAttribute("stroke-linejoin", "round");
    beamInner.style.filter = "drop-shadow(0 0 10px rgba(255,255,200,0.95))";
    beamInner.style.opacity = "0";

    // Subtle energy flow via dash
    beamOuter.setAttribute("stroke-dasharray", "30 18");
    beamInner.setAttribute("stroke-dasharray", "18 12");

    svg.appendChild(beamOuter);
    svg.appendChild(beamInner);

    // Appear quickly (powerful beam)
    requestAnimationFrame(() => {
      beamOuter.style.transition = "opacity 120ms ease-out";
      beamInner.style.transition = "opacity 120ms ease-out";
      beamOuter.style.opacity = "1";
      beamInner.style.opacity = "1";
    });

    // Flow animation
    let dash = 0;
    const flow = setInterval(() => {
      dash += 8;
      beamOuter.setAttribute("stroke-dashoffset", `${dash}`);
      beamInner.setAttribute("stroke-dashoffset", `${dash}`);
    }, 28);

    // Traveling pulses along the beam
    const pulseCount = 4;
    for (let i = 0; i < pulseCount; i++) {
      const pulse = document.createElement("div");
      Object.assign(pulse.style, {
        position: "fixed",
        top: `${y}px`,
        left: `${x}px`,
        width: "10px",
        height: "10px",
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff 40%, #ffd84d 80%)",
        boxShadow: "0 0 20px rgba(255,220,100,0.95)",
        transform: "translate(-50%, -50%)",
        opacity: "0",
        zIndex: 1004,
        transition: "top 500ms linear, left 500ms linear, opacity 100ms ease-out",
      });
      layer.appendChild(pulse);

      setTimeout(() => {
        pulse.style.opacity = "1";
        pulse.style.top = `${targetY}px`;
        pulse.style.left = `${targetX}px`;
      }, 80 + i * 120);

      setTimeout(() => { pulse.style.opacity = "0"; }, 620 + i * 120);
    }

    // Impact: big golden burst, dual rings, many forks, stronger shake, lingering corona
    setTimeout(() => {
      // Stronger shake
      const shakes = ["translate(0,0)", "translate(3px,-3px)", "translate(-3px,3px)", "translate(3px,3px)", "translate(-3px,-3px)"];
      let si = 0;
      const shaker = setInterval(() => {
        layer.style.transform = shakes[si % shakes.length];
        si++;
      }, 16);
      setTimeout(() => { clearInterval(shaker); layer.style.transform = "translate(0,0)"; }, 220);

      // Burst
      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "200px",
        height: "200px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,220,1) 28%, rgba(255,215,100,0.95) 70%, transparent 100%)",
        boxShadow: "0 0 260px rgba(255,240,160,0.95)",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 320ms ease-out, opacity 320ms ease-out",
      });
      layer.appendChild(burst);
      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(1.6)";
        burst.style.opacity = "0";
      });

      // Inner ring
      const ring1 = document.createElement("div");
      Object.assign(ring1.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "90px",
        height: "90px",
        borderRadius: "50%",
        border: "4px solid rgba(255,230,120,0.95)",
        boxShadow: "0 0 60px rgba(255,230,120,0.85)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1011,
        transition: "transform 340ms ease-out, opacity 340ms ease-out",
      });
      layer.appendChild(ring1);

      // Outer ring
      const ring2 = document.createElement("div");
      Object.assign(ring2.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "140px",
        height: "140px",
        borderRadius: "50%",
        border: "3px solid rgba(255,220,100,0.85)",
        boxShadow: "0 0 80px rgba(255,220,100,0.75)",
        transform: "translate(-50%, -50%) scale(0.5)",
        opacity: "1",
        zIndex: 1011,
        transition: "transform 420ms ease-out, opacity 420ms ease-out",
      });
      layer.appendChild(ring2);

      requestAnimationFrame(() => {
        ring1.style.transform = "translate(-50%, -50%) scale(2.3)";
        ring1.style.opacity = "0";
        ring2.style.transform = "translate(-50%, -50%) scale(2.0)";
        ring2.style.opacity = "0";
      });

      // Many forks (strong branching arcs)
      const forks = 16;
      for (let i = 0; i < forks; i++) {
        const fork = document.createElement("div");
        const ang = (Math.PI * 2 * i) / forks + Math.random() * 0.22;
        const r = 64 + Math.random() * 96;
        Object.assign(fork.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "40px",
          height: "2px",
          background: "linear-gradient(90deg, #fff, #ffd84d)",
          borderRadius: "1px",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1012,
          transition: "top 340ms ease-out, left 340ms ease-out, opacity 340ms ease-out, transform 340ms ease-out",
        });
        layer.appendChild(fork);
        const _f = fork.offsetWidth;
        fork.style.top = `${targetY + Math.sin(ang) * r}px`;
        fork.style.left = `${targetX + Math.cos(ang) * r}px`;
        fork.style.transform = `translate(-50%, -50%) rotate(${(ang * 180) / Math.PI}deg)`;
        fork.style.opacity = "0";
      }

      // Lingering corona (afterglow)
      const corona = document.createElement("div");
      Object.assign(corona.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "220px",
        height: "220px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,245,180,0.35) 30%, rgba(255,220,100,0.25) 70%, transparent 100%)",
        transform: "translate(-50%, -50%) scale(0.9)",
        opacity: "1",
        zIndex: 1009,
        transition: "opacity 500ms ease-out, transform 500ms ease-out",
      });
      layer.appendChild(corona);
      requestAnimationFrame(() => {
        corona.style.opacity = "0";
        corona.style.transform = "translate(-50%, -50%) scale(1.1)";
      });
    }, 320);

    // Fade beam out after impact
    setTimeout(() => {
      clearInterval(flow);
      beamOuter.style.transition = "opacity 160ms ease-out";
      beamInner.style.transition = "opacity 160ms ease-out";
      beamOuter.style.opacity = "0";
      beamInner.style.opacity = "0";
    }, 780);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 1400);
  },



  "Thunder"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Full-screen SVG to draw vertical sky → target bolts (origin = sky, not attacker)
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: 1005,
    });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    layer.appendChild(svg);

    // Cloud build-up above target (golden storm cloud)
    const cloud = document.createElement("div");
    Object.assign(cloud.style, {
      position: "fixed",
      top: `${Math.max(targetY - 160, 40)}px`,
      left: `${targetX}px`,
      width: "240px",
      height: "120px",
      borderRadius: "60px",
      background: "radial-gradient(circle at 50% 30%, rgba(255,235,150,0.7), rgba(255,210,90,0.6) 50%, rgba(0,0,0,0) 70%)",
      boxShadow: "0 0 80px rgba(255,220,120,0.7)",
      transform: "translate(-50%, -50%) scale(0.7)",
      opacity: "0",
      zIndex: 1004,
      transition: "opacity 300ms ease-out, transform 300ms ease-out",
    });
    layer.appendChild(cloud);
    requestAnimationFrame(() => {
      cloud.style.opacity = "1";
      cloud.style.transform = "translate(-50%, -50%) scale(1)";
    });

    // Helper: one lightning bolt from sky to target
    const makeBolt = (offsetX = 0, thicknessOuter = 26, thicknessInner = 12, jitterAmp = 10) => {
      const skyX = targetX + offsetX;
      const skyY = Math.max(targetY - 260, 30);
      const segments = 9;
      const pts = [];
      for (let i = 0; i <= segments; i++) {
        const t = i / segments;
        const px = skyX + Math.sin(t * Math.PI * 2) * (i % 2 === 0 ? jitterAmp : -jitterAmp);
        const py = skyY + (targetY - skyY) * t + (Math.random() * 6 - 3);
        pts.push(`${px},${py}`);
      }

      const outer = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      outer.setAttribute("points", pts.join(" "));
      outer.setAttribute("fill", "none");
      outer.setAttribute("stroke", "#ffeb99");
      outer.setAttribute("stroke-width", thicknessOuter);
      outer.setAttribute("stroke-linecap", "round");
      outer.setAttribute("stroke-linejoin", "round");
      outer.style.filter = "drop-shadow(0 0 20px rgba(255,230,120,0.95))";
      outer.style.opacity = "0";

      const inner = document.createElementNS("http://www.w3.org/2000/svg", "polyline");
      inner.setAttribute("points", pts.join(" "));
      inner.setAttribute("fill", "none");
      inner.setAttribute("stroke", "#fff");
      inner.setAttribute("stroke-width", thicknessInner);
      inner.setAttribute("stroke-linecap", "round");
      inner.setAttribute("stroke-linejoin", "round");
      inner.style.filter = "drop-shadow(0 0 12px rgba(255,255,220,0.95))";
      inner.style.opacity = "0";

      svg.appendChild(outer);
      svg.appendChild(inner);
      return { outer, inner, skyX, skyY };
    };

    // Create three staggered bolts (center + left + right) for epic feel
    const bolts = [
      makeBolt(0, 28, 14, 12),
      makeBolt(-30, 22, 10, 10),
      makeBolt(30, 22, 10, 10),
    ];

    // Screen flash overlay (brief white-yellow flash)
    const flash = document.createElement("div");
    Object.assign(flash.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "rgba(255,245,180,0.0)",
      zIndex: 1006,
      transition: "background 120ms ease-out",
    });
    layer.appendChild(flash);

    // Sequential strikes: show bolts with rapid flash and strong shake
    const strongShake = () => {
      const shakes = ["translate(0,0)", "translate(4px,-4px)", "translate(-4px,4px)", "translate(4px,4px)", "translate(-4px,-4px)"];
      let si = 0;
      const shaker = setInterval(() => {
        layer.style.transform = shakes[si % shakes.length];
        si++;
      }, 14);
      setTimeout(() => { clearInterval(shaker); layer.style.transform = "translate(0,0)"; }, 220);
    };

    bolts.forEach(({ outer, inner }, idx) => {
      setTimeout(() => {
        outer.style.transition = "opacity 100ms ease-out";
        inner.style.transition = "opacity 100ms ease-out";
        outer.style.opacity = "1";
        inner.style.opacity = "1";

        flash.style.background = "rgba(255,245,180,0.35)";
        setTimeout(() => { flash.style.background = "rgba(255,245,180,0.0)"; }, 120);

        strongShake();
      }, 180 * idx);
    });

    // Impact: massive golden burst + dual shock rings + many forks + afterglow corona
    setTimeout(() => {
      // Big burst
      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "240px",
        height: "240px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,255,220,1) 26%, rgba(255,215,100,0.95) 72%, transparent 100%)",
        boxShadow: "0 0 320px rgba(255,240,160,0.95)",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 360ms ease-out, opacity 360ms ease-out",
      });
      layer.appendChild(burst);
      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(1.8)";
        burst.style.opacity = "0";
      });

      // Inner shock ring
      const ring1 = document.createElement("div");
      Object.assign(ring1.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "110px",
        height: "110px",
        borderRadius: "50%",
        border: "5px solid rgba(255,230,120,0.95)",
        boxShadow: "0 0 80px rgba(255,230,120,0.85)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1011,
        transition: "transform 420ms ease-out, opacity 420ms ease-out",
      });
      layer.appendChild(ring1);

      // Outer shock ring
      const ring2 = document.createElement("div");
      Object.assign(ring2.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "170px",
        height: "170px",
        borderRadius: "50%",
        border: "4px solid rgba(255,220,100,0.85)",
        boxShadow: "0 0 100px rgba(255,220,100,0.75)",
        transform: "translate(-50%, -50%) scale(0.5)",
        opacity: "1",
        zIndex: 1011,
        transition: "transform 520ms ease-out, opacity 520ms ease-out",
      });
      layer.appendChild(ring2);

      requestAnimationFrame(() => {
        ring1.style.transform = "translate(-50%, -50%) scale(2.6)";
        ring1.style.opacity = "0";
        ring2.style.transform = "translate(-50%, -50%) scale(2.2)";
        ring2.style.opacity = "0";
      });

      // Many forks (radiating arcs)
      const forks = 20;
      for (let i = 0; i < forks; i++) {
        const fork = document.createElement("div");
        const ang = (Math.PI * 2 * i) / forks + Math.random() * 0.2;
        const r = 80 + Math.random() * 120;
        Object.assign(fork.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "46px",
          height: "2px",
          background: "linear-gradient(90deg, #fff, #ffd84d)",
          borderRadius: "1px",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1012,
          transition: "top 380ms ease-out, left 380ms ease-out, opacity 380ms ease-out, transform 380ms ease-out",
        });
        layer.appendChild(fork);
        const _f = fork.offsetWidth;
        fork.style.top = `${targetY + Math.sin(ang) * r}px`;
        fork.style.left = `${targetX + Math.cos(ang) * r}px`;
        fork.style.transform = `translate(-50%, -50%) rotate(${(ang * 180) / Math.PI}deg)`;
        fork.style.opacity = "0";
      }

      // Afterglow corona
      const corona = document.createElement("div");
      Object.assign(corona.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "260px",
        height: "260px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(255,245,180,0.35) 30%, rgba(255,220,100,0.25) 70%, transparent 100%)",
        transform: "translate(-50%, -50%) scale(0.9)",
        opacity: "1",
        zIndex: 1009,
        transition: "opacity 600ms ease-out, transform 600ms ease-out",
      });
      layer.appendChild(corona);
      requestAnimationFrame(() => {
        corona.style.opacity = "0";
        corona.style.transform = "translate(-50%, -50%) scale(1.1)";
      });
    }, 540);

    // Fade bolts after impact
    setTimeout(() => {
      bolts.forEach(({ outer, inner }) => {
        outer.style.transition = "opacity 180ms ease-out";
        inner.style.transition = "opacity 180ms ease-out";
        outer.style.opacity = "0";
        inner.style.opacity = "0";
      });
      cloud.style.opacity = "0";
    }, 900);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 1600);
  },


//hệ băng
  "Powder Snow"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const count = 18; // số hạt tuyết
    const duration = 800; // ms di chuyển
    const dx = targetX - x;
    const dy = targetY - y;

    // Tạo các hạt tuyết bay từ attacker → target
    for (let i = 0; i < count; i++) {
      const t = Math.random();           // vị trí bắt đầu dọc theo đường bay
      const startX = x + dx * (t * 0.15);
      const startY = y + dy * (t * 0.15);
      const driftX = (Math.random() - 0.5) * 40; // lệch nhẹ cho cảm giác tự nhiên
      const driftY = (Math.random() - 0.5) * 24;

      const flake = document.createElement("div");
      const size = 6 + Math.random() * 4;
      Object.assign(flake.style, {
        position: "fixed",
        top: `${startY}px`,
        left: `${startX}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff 40%, #dff 80%)",
        boxShadow: "0 0 10px rgba(200,240,255,0.9)",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "0",
        zIndex: 1003,
        transition: `top ${duration}ms linear, left ${duration}ms linear, opacity 180ms ease-out, transform 180ms ease-out`,
      });
      layer.appendChild(flake);

      // xuất hiện và dịch chuyển
      setTimeout(() => {
        flake.style.opacity = "1";
        flake.style.transform = "translate(-50%, -50%) scale(1)";
        flake.style.top = `${targetY + driftY}px`;
        flake.style.left = `${targetX + driftX}px`;
      }, 40 + i * 30);

      // mờ dần trước va chạm
      setTimeout(() => {
        flake.style.opacity = "0.2";
      }, 40 + i * 30 + duration - 180);
    }

    // Va chạm: vòng băng nhỏ + bụi sương lạnh
    setTimeout(() => {
      // vòng băng
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "70px",
        height: "70px",
        borderRadius: "50%",
        border: "4px solid rgba(190,230,255,0.95)",
        boxShadow: "0 0 30px rgba(160,210,255,0.85)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 360ms ease-out, opacity 360ms ease-out",
      });
      layer.appendChild(ring);
      requestAnimationFrame(() => {
        ring.style.transform = "translate(-50%, -50%) scale(1.8)";
        ring.style.opacity = "0";
      });

      // bụi sương lạnh
      const frost = document.createElement("div");
      Object.assign(frost.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "120px",
        height: "120px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(220,245,255,0.5) 30%, rgba(200,235,255,0.3) 60%, transparent 100%)",
        filter: "blur(2px)",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "0.9",
        zIndex: 1009,
        transition: "opacity 500ms ease-out, transform 500ms ease-out",
      });
      layer.appendChild(frost);
      requestAnimationFrame(() => {
        frost.style.opacity = "0";
        frost.style.transform = "translate(-50%, -50%) scale(1.1)";
      });
    }, 40 + (count - 1) * 30 + duration - 40);

    // Dọn dẹp
    setTimeout(() => { layer.remove(); }, 1600);
  },

  "Ice Shard"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const shardCount = 6;
    for (let i = 0; i < shardCount; i++) {
      const shard = document.createElement("div");
      const size = 14 + Math.random() * 6;
      const offsetY = (Math.random() - 0.5) * 40;

      Object.assign(shard.style, {
        position: "fixed",
        top: `${y + offsetY}px`,
        left: `${x}px`,
        width: `${size}px`,
        height: `${size/2}px`,
        background: "linear-gradient(90deg, #dff, #9cf, #39f)",
        borderRadius: "3px",
        transform: "translate(-50%, -50%) rotate(0deg) scale(0.8)",
        boxShadow: "0 0 12px rgba(150,220,255,0.9)",
        opacity: "0.9",
        zIndex: 1003,
        transition: "top 0.7s linear, left 0.7s linear, transform 0.7s linear, opacity 0.4s ease-out",
      });
      layer.appendChild(shard);

      // Bay tới target
      setTimeout(() => {
        shard.style.top = `${targetY}px`;
        shard.style.left = `${targetX}px`;
        shard.style.transform = `translate(-50%, -50%) rotate(${Math.random()*360}deg) scale(1)`;
      }, 50 + i * 80);

      // Va chạm: vỡ vụn
      setTimeout(() => {
        shard.style.opacity = "0";

        // Vòng băng nhỏ
        const ring = document.createElement("div");
        Object.assign(ring.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "60px",
          height: "60px",
          borderRadius: "50%",
          border: "3px solid rgba(180,220,255,0.95)",
          boxShadow: "0 0 30px rgba(160,210,255,0.8)",
          transform: "translate(-50%, -50%) scale(0.6)",
          opacity: "1",
          zIndex: 1010,
          transition: "transform 0.5s ease-out, opacity 0.5s ease-out",
        });
        layer.appendChild(ring);
        requestAnimationFrame(() => {
          ring.style.transform = "translate(-50%, -50%) scale(1.8)";
          ring.style.opacity = "0";
        });

        // Mảnh băng vụn
        for (let j = 0; j < 6; j++) {
          const frag = document.createElement("div");
          const ang = (Math.PI * 2 * j) / 6 + Math.random() * 0.3;
          const r = 20 + Math.random() * 30;
          Object.assign(frag.style, {
            position: "fixed",
            top: `${targetY}px`,
            left: `${targetX}px`,
            width: "6px",
            height: "6px",
            borderRadius: "2px",
            background: "radial-gradient(circle, #fff, #9cf)",
            boxShadow: "0 0 10px #9cf",
            transform: "translate(-50%, -50%)",
            opacity: "1",
            zIndex: 1011,
            transition: "top 0.5s ease-out, left 0.5s ease-out, opacity 0.5s ease-out",
          });
          layer.appendChild(frag);
          const _f = frag.offsetWidth;
          frag.style.top = `${targetY + Math.sin(ang) * r}px`;
          frag.style.left = `${targetX + Math.cos(ang) * r}px`;
          frag.style.opacity = "0";
        }
      }, 800 + i * 80);
    }

    // Cleanup
    setTimeout(() => { layer.remove(); }, 2000);
  },


  "Ice Beam"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const dx = targetX - x;
    const dy = targetY - y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx*dx + dy*dy);

    // Thời gian beam và buffer để va chạm chắc chắn
    const beamGrow = 300;  // ms
    const impactBuffer = 60; // ms
    const freezeHold = 1200; // ms (gấp đôi so với trước)

    // Beam outer glow
    const beamOuter = document.createElement("div");
    Object.assign(beamOuter.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "0px",
      height: "20px",
      borderRadius: "10px",
      background: "linear-gradient(90deg, rgba(200,240,255,0.9), rgba(150,210,255,0.8), rgba(100,180,255,0))",
      boxShadow: "0 0 30px rgba(150,220,255,0.9)",
      transformOrigin: "left center",
      transform: `rotate(${angle}rad)`,
      opacity: "1",
      zIndex: 1003,
      transition: `width ${beamGrow}ms ease-out, opacity 400ms ease-out`,
    });
    layer.appendChild(beamOuter);

    // Beam inner core
    const beamInner = document.createElement("div");
    Object.assign(beamInner.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "0px",
      height: "8px",
      borderRadius: "4px",
      background: "linear-gradient(90deg, #fff, #dff, rgba(200,240,255,0))",
      boxShadow: "0 0 20px rgba(220,250,255,0.95)",
      transformOrigin: "left center",
      transform: `rotate(${angle}rad)`,
      opacity: "1",
      zIndex: 1004,
      transition: `width ${beamGrow}ms ease-out, opacity 400ms ease-out`,
    });
    layer.appendChild(beamInner);

    // Ép reflow rồi kéo dài beam
    const _r1 = beamOuter.offsetWidth;
    const _r2 = beamInner.offsetWidth;
    beamOuter.style.width = `${distance}px`;
    beamInner.style.width = `${distance}px`;

    // Va chạm: freeze luôn chắc chắn sau beamGrow + buffer
    setTimeout(() => {
      // Frost overlay (giữ lâu)
      const frost = document.createElement("div");
      Object.assign(frost.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "150px",
        height: "150px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(220,245,255,0.6) 35%, rgba(200,235,255,0.4) 65%, transparent 100%)",
        filter: "blur(2px)",
        transform: "translate(-50%, -50%) scale(0.7)",
        opacity: "0",
        zIndex: 1009,
        transition: `opacity 240ms ease-out, transform 240ms ease-out`,
      });
      layer.appendChild(frost);
      const _rf = frost.offsetWidth;
      frost.style.opacity = "1";
      frost.style.transform = "translate(-50%, -50%) scale(1.0)";

      // Vòng băng
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "90px",
        height: "90px",
        borderRadius: "50%",
        border: "5px solid rgba(180,220,255,0.95)",
        boxShadow: "0 0 40px rgba(160,210,255,0.9)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 600ms ease-out, opacity 600ms ease-out",
      });
      layer.appendChild(ring);
      const _rr = ring.offsetWidth;
      ring.style.transform = "translate(-50%, -50%) scale(2.0)";
      ring.style.opacity = "0";

      // Tinh thể băng mọc quanh (đặt trước, animate sau để không miss)
      const shards = [];
      for (let i = 0; i < 8; i++) {
        const shard = document.createElement("div");
        const ang = (Math.PI * 2 * i) / 8;
        Object.assign(shard.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "14px",
          height: "28px",
          background: "linear-gradient(180deg, #dff, #9cf)",
          borderRadius: "4px",
          transform: `translate(-50%, -50%) rotate(${ang}rad) scale(0.2)`,
          opacity: "1",
          zIndex: 1011,
          transition: `top 380ms ease-out, left 380ms ease-out, transform 380ms ease-out, opacity 500ms ease-out`,
        });
        layer.appendChild(shard);
        shards.push({ shard, ang });
      }

      // Ép reflow rồi cho shards mọc ra vòng quanh
      shards.forEach(({ shard, ang }) => {
        const _rs = shard.offsetWidth;
        const r = 40;
        shard.style.top = `${targetY + Math.sin(ang) * r}px`;
        shard.style.left = `${targetX + Math.cos(ang) * r}px`;
        shard.style.transform = `translate(-50%, -50%) rotate(${ang}rad) scale(1)`;
      });

      // Giữ trạng thái đóng băng lâu hơn, rồi mờ dần
      setTimeout(() => {
        frost.style.opacity = "0";
        shards.forEach(({ shard }) => { shard.style.opacity = "0"; });
      }, freezeHold);

    }, beamGrow + impactBuffer);

    // Beam fade sau khi freeze bắt đầu
    setTimeout(() => {
      beamOuter.style.opacity = "0";
      beamInner.style.opacity = "0";
    }, beamGrow + impactBuffer + 200);

    // Cleanup sau khi mọi thứ mờ dần
    setTimeout(() => { layer.remove(); }, beamGrow + impactBuffer + freezeHold + 700);
  },


  "Blizzard"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Lớp phủ lạnh toàn màn hình (nhẹ)
    const storm = document.createElement("div");
    Object.assign(storm.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      background: "radial-gradient(circle at center, rgba(220,245,255,0.25), rgba(180,220,255,0.18), transparent 80%)",
      opacity: "0",
      zIndex: 1002,
      transition: "opacity 360ms ease-out",
    });
    layer.appendChild(storm);
    requestAnimationFrame(() => { storm.style.opacity = "1"; });

    // Tham số hội tụ
    const snowCount = 48;
    const travel = 900;     // ms di chuyển vào trong
    const stagger = 18;     // ms trễ giữa các hạt
    const convergeRadius = Math.min(Math.max(window.innerWidth, window.innerHeight), 1200) / 2 - 40;

    // Hoa tuyết từ ngoài vào trong
    for (let i = 0; i < snowCount; i++) {
      const flake = document.createElement("div");
      const size = 6 + Math.random() * 8;

      // Chọn vị trí xuất phát ở vòng ngoài
      const ang = Math.random() * Math.PI * 2;
      const startX = targetX + Math.cos(ang) * (convergeRadius + Math.random() * 120);
      const startY = targetY + Math.sin(ang) * (convergeRadius + Math.random() * 120);

      Object.assign(flake.style, {
        position: "fixed",
        top: `${startY}px`,
        left: `${startX}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff 40%, #dff 80%)",
        boxShadow: "0 0 10px rgba(200,240,255,0.9)",
        transform: "translate(-50%, -50%) scale(0.9)",
        opacity: "0.0",
        zIndex: 1003,
        transition: `top ${travel}ms ease-in, left ${travel}ms ease-in, opacity 200ms ease-out, transform 200ms ease-out`,
      });
      layer.appendChild(flake);

      // Ép reflow rồi cho xuất hiện & chạy vào
      setTimeout(() => {
        const _rf = flake.offsetWidth;
        flake.style.opacity = "1";
        flake.style.transform = "translate(-50%, -50%) scale(1)";
        flake.style.top = `${targetY}px`;
        flake.style.left = `${targetX}px`;
      }, 60 + i * stagger);
    }

    // Thời điểm hội tụ xong (mốc nổ)
    const impactTime = 60 + (snowCount - 1) * stagger + travel + 40;

    // Nổ băng + rung màn hình
    setTimeout(() => {
      // Rung mạnh
      const shakes = [
        "translate(0,0)", "translate(4px,-4px)", "translate(-4px,4px)",
        "translate(4px,4px)", "translate(-4px,-4px)"
      ];
      let si = 0;
      const shaker = setInterval(() => {
        layer.style.transform = shakes[si % shakes.length];
        si++;
      }, 24);
      setTimeout(() => { clearInterval(shaker); layer.style.transform = "translate(0,0)"; }, 420);

      // Vòng nổ băng lớn
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "180px",
        height: "180px",
        borderRadius: "50%",
        border: "8px solid rgba(180,220,255,0.95)",
        boxShadow: "0 0 90px rgba(160,210,255,0.9)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 520ms ease-out, opacity 520ms ease-out",
      });
      layer.appendChild(ring);
      const _rr = ring.offsetWidth;
      ring.style.transform = "translate(-50%, -50%) scale(2.6)";
      ring.style.opacity = "0";

      // Mảnh băng sắc văng ra (từ tâm)
      const shards = 22;
      for (let i = 0; i < shards; i++) {
        const frag = document.createElement("div");
        const a = (Math.PI * 2 * i) / shards + Math.random() * 0.25;
        const r = 80 + Math.random() * 120;
        Object.assign(frag.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "8px",
          height: "16px",
          borderRadius: "3px",
          background: "linear-gradient(180deg, #fff, #9cf)",
          boxShadow: "0 0 14px rgba(150,220,255,0.9)",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1011,
          transition: "top 420ms ease-out, left 420ms ease-out, opacity 420ms ease-out, transform 420ms ease-out",
        });
        layer.appendChild(frag);
        const _rf = frag.offsetWidth;
        frag.style.top = `${targetY + Math.sin(a) * r}px`;
        frag.style.left = `${targetX + Math.cos(a) * r}px`;
        frag.style.transform = `translate(-50%, -50%) rotate(${(a * 180) / Math.PI}deg)`;
        frag.style.opacity = "0";
      }

      // Sương lạnh bùng ra
      const frost = document.createElement("div");
      Object.assign(frost.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "240px",
        height: "240px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(220,245,255,0.55) 35%, rgba(200,235,255,0.35) 65%, transparent 100%)",
        filter: "blur(2px)",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "0.0",
        zIndex: 1009,
        transition: "opacity 380ms ease-out, transform 380ms ease-out",
      });
      layer.appendChild(frost);
      const _rfr = frost.offsetWidth;
      frost.style.opacity = "1";
      frost.style.transform = "translate(-50%, -50%) scale(1.2)";
      setTimeout(() => {
        frost.style.opacity = "0";
        frost.style.transform = "translate(-50%, -50%) scale(1.3)";
      }, 420);
    }, impactTime);

    // Dọn dẹp
    setTimeout(() => { layer.remove(); }, impactTime + 900);
  },


  "Rock Throw"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // SVG để vẽ viên đá góc cạnh
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    Object.assign(svg.style, {
      position: "fixed",
      top: "0",
      left: "0",
      width: "100vw",
      height: "100vh",
      pointerEvents: "none",
      zIndex: 1003,
    });
    svg.setAttribute("viewBox", `0 0 ${window.innerWidth} ${window.innerHeight}`);
    layer.appendChild(svg);

    // Gradient shading
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    grad.setAttribute("id", "rockGrad");
    grad.setAttribute("cx", "30%");
    grad.setAttribute("cy", "30%");
    grad.setAttribute("r", "70%");
    const s1 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s1.setAttribute("offset", "0%");
    s1.setAttribute("stop-color", "#b9b9b9");
    const s2 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s2.setAttribute("offset", "70%");
    s2.setAttribute("stop-color", "#666666");
    const s3 = document.createElementNS("http://www.w3.org/2000/svg", "stop");
    s3.setAttribute("offset", "100%");
    s3.setAttribute("stop-color", "#4a4a4a");
    grad.appendChild(s1); grad.appendChild(s2); grad.appendChild(s3);
    defs.appendChild(grad);
    svg.appendChild(defs);

    // Rock polygon
    const rockGroup = document.createElementNS("http://www.w3.org/2000/svg", "g");
    rockGroup.setAttribute("transform", `translate(${x}, ${y}) scale(0.9)`);
    svg.appendChild(rockGroup);

    const rock = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    rock.setAttribute("points", "-18,4 -12,12 4,16 16,8 14,-6 2,-16 -10,-12 -14,-2");
    rock.setAttribute("fill", "url(#rockGrad)");
    rock.setAttribute("stroke", "#2f2f2f");
    rock.setAttribute("stroke-width", "2");
    rock.style.filter = "drop-shadow(0 0 8px rgba(80,80,80,0.6))";
    rockGroup.appendChild(rock);

    // Quỹ đạo cong
    const midX = (x + targetX) / 2;
    const midY = (y + targetY) / 2 - 60;

    // Bay chậm hơn: gấp đôi thời gian (1.2s + 1.0s)
    setTimeout(() => {
      rockGroup.style.transition = "transform 1.2s ease-in";
      rockGroup.style.transform = `translate(${midX}px, ${midY}px) scale(1.0) rotate(14deg)`;
    }, 40);

    setTimeout(() => {
      rockGroup.style.transition = "transform 1.0s ease-in";
      rockGroup.style.transform = `translate(${targetX}px, ${targetY}px) scale(1.1) rotate(22deg)`;
    }, 1280);

    // Va chạm (giữ nguyên)
    setTimeout(() => {
      rock.style.opacity = "0";

      const dust = document.createElement("div");
      Object.assign(dust.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "90px",
        height: "90px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(120,100,80,0.65) 30%, transparent 70%)",
        filter: "blur(4px)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 0.6s ease-out, opacity 0.6s ease-out",
      });
      layer.appendChild(dust);
      requestAnimationFrame(() => {
        dust.style.transform = "translate(-50%, -50%) scale(1.9)";
        dust.style.opacity = "0";
      });

      for (let i = 0; i < 7; i++) {
        const frag = document.createElement("div");
        const ang = (Math.PI * 2 * i) / 7 + Math.random() * 0.3;
        const r = 30 + Math.random() * 44;
        Object.assign(frag.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "12px",
          height: "8px",
          background: "linear-gradient(135deg, #9a9a9a, #555)",
          borderRadius: "2px",
          boxShadow: "0 0 6px rgba(80,80,80,0.6)",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1011,
          transition: "top 0.6s ease-out, left 0.6s ease-out, opacity 0.6s ease-out, transform 0.6s ease-out",
        });
        layer.appendChild(frag);
        const _f = frag.offsetWidth;
        frag.style.top = `${targetY + Math.sin(ang) * r}px`;
        frag.style.left = `${targetX + Math.cos(ang) * r}px`;
        frag.style.transform = `translate(-50%, -50%) rotate(${(ang * 180) / Math.PI + (Math.random()*30-15)}deg)`;
        frag.style.opacity = "0";
      }
    }, 2300);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 3000);
  },


  "Rock Tomb"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Bụi đất ban đầu quanh target
    const dust = document.createElement("div");
    Object.assign(dust.style, {
      position: "fixed",
      top: `${targetY}px`,
      left: `${targetX}px`,
      width: "160px",
      height: "160px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(120,100,80,0.5) 30%, transparent 70%)",
      filter: "blur(6px)",
      transform: "translate(-50%, -50%) scale(0.6)",
      opacity: "0",
      zIndex: 1005,
      transition: "opacity 0.4s ease-out, transform 0.4s ease-out",
    });
    layer.appendChild(dust);
    requestAnimationFrame(() => {
      dust.style.opacity = "1";
      dust.style.transform = "translate(-50%, -50%) scale(1.2)";
    });

    // Tạo nhiều phiến đá quanh target
    const rockCount = 5;
    for (let i = 0; i < rockCount; i++) {
      const angle = (Math.PI * 2 * i) / rockCount + Math.random() * 0.3;
      const radius = 60 + Math.random() * 20;
      const startY = targetY + Math.sin(angle) * radius + 80; // bắt đầu thấp hơn
      const startX = targetX + Math.cos(angle) * radius;

      const rock = document.createElement("div");
      const w = 40 + Math.random() * 20;
      const h = 60 + Math.random() * 30;
      Object.assign(rock.style, {
        position: "fixed",
        top: `${startY}px`,
        left: `${startX}px`,
        width: `${w}px`,
        height: `${h}px`,
        background: "linear-gradient(135deg, #aaa, #555)",
        clipPath: "polygon(20% 0%, 80% 10%, 100% 50%, 70% 100%, 30% 90%, 0% 40%)",
        boxShadow: "inset -4px -6px 8px rgba(0,0,0,0.5), 0 0 12px rgba(60,60,60,0.6)",
        transform: "translate(-50%, -50%) scale(0.8) rotate(0deg)",
        opacity: "0",
        zIndex: 1006,
        transition: "top 0.6s ease-out, opacity 0.4s ease-out, transform 0.6s ease-out",
      });
      layer.appendChild(rock);

      // Animate trồi lên
      setTimeout(() => {
        rock.style.top = `${targetY + Math.sin(angle) * radius}px`;
        rock.style.opacity = "1";
        rock.style.transform = `translate(-50%, -50%) scale(1) rotate(${(Math.random()*30-15)}deg)`;
      }, 200 + i * 120);
    }

    // Bụi đất bùng ra khi đá khép lại
    setTimeout(() => {
      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "200px",
        height: "200px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(120,100,80,0.6) 30%, transparent 70%)",
        filter: "blur(8px)",
        transform: "translate(-50%, -50%) scale(0.8)",
        opacity: "1",
        zIndex: 1004,
        transition: "transform 0.8s ease-out, opacity 0.8s ease-out",
      });
      layer.appendChild(burst);
      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(2.0)";
        burst.style.opacity = "0";
      });
    }, 1200);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 2500);
  },


  "Stone Edge"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const blades = 6;            // số mũi đá
    const travel = 520;          // thời gian bay nhanh (ms)
    const stagger = 60;          // trễ giữa từng mũi (ms)

    // Tạo mũi đá sắc nhọn từ attacker → target
    for (let i = 0; i < blades; i++) {
      const blade = document.createElement("div");

      // Kích thước và hình dạng “lưỡi đá” (tam giác dài, góc cạnh)
      const w = 38 + Math.random() * 10;
      const h = 88 + Math.random() * 16;

      // Độ lệch góc để tạo cảm giác tấn công fan-out nhẹ
      const spread = (Math.random() - 0.5) * 0.32; // rad

      Object.assign(blade.style, {
        position: "fixed",
        top: `${y}px`,
        left: `${x}px`,
        width: `${w}px`,
        height: `${h}px`,
        background: "linear-gradient(135deg, #c7c7c7 10%, #8b8b8b 60%, #595959 100%)",
        boxShadow: "inset -6px -10px 12px rgba(0,0,0,0.45), 0 0 12px rgba(60,60,60,0.55)",
        clipPath: "polygon(50% 0%, 100% 70%, 70% 100%, 30% 100%, 0% 70%)",
        transform: "translate(-50%, -50%) rotate(0deg) scale(0.9)",
        opacity: "0.98",
        zIndex: 1006,
        transition: `top ${travel}ms cubic-bezier(0.2,0.8,0.2,1), left ${travel}ms cubic-bezier(0.2,0.8,0.2,1), transform ${travel}ms linear`,
      });
      layer.appendChild(blade);

      // Tính hướng bay
      const dx = targetX - x;
      const dy = targetY - y;
      const baseAngle = Math.atan2(dy, dx) + spread;

      // Điểm đích có lệch nhẹ để mỗi mũi khác nhau
      const dist = Math.hypot(dx, dy);
      const endX = x + Math.cos(baseAngle) * dist;
      const endY = y + Math.sin(baseAngle) * dist;

      // Trễ từng mũi, rồi bay
      setTimeout(() => {
        // Ép reflow trước khi animate
        const _rf = blade.offsetWidth;
        blade.style.top = `${endY}px`;
        blade.style.left = `${endX}px`;
        blade.style.transform = `translate(-50%, -50%) rotate(${(baseAngle * 180) / Math.PI + (Math.random() * 10 - 5)}deg) scale(1.0)`;
      }, 60 + i * stagger);

      // Va chạm cho từng mũi
      setTimeout(() => {
        blade.style.opacity = "0";

        // Vòng bụi đất nhỏ (impact ring)
        const ring = document.createElement("div");
        Object.assign(ring.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "90px",
          height: "90px",
          borderRadius: "50%",
          border: "6px solid rgba(120,100,80,0.75)",
          boxShadow: "0 0 40px rgba(120,100,80,0.6)",
          transform: "translate(-50%, -50%) scale(0.6)",
          opacity: "1",
          zIndex: 1010,
          transition: "transform 360ms ease-out, opacity 360ms ease-out",
        });
        layer.appendChild(ring);
        requestAnimationFrame(() => {
          ring.style.transform = "translate(-50%, -50%) scale(1.9)";
          ring.style.opacity = "0";
        });

        // Mảnh vỡ sắc bén (debris)
        const debris = 8;
        for (let j = 0; j < debris; j++) {
          const frag = document.createElement("div");
          const ang = (Math.PI * 2 * j) / debris + Math.random() * 0.28;
          const r = 36 + Math.random() * 54;
          const fw = 12, fh = 6;
          Object.assign(frag.style, {
            position: "fixed",
            top: `${targetY}px`,
            left: `${targetX}px`,
            width: `${fw}px`,
            height: `${fh}px`,
            background: "linear-gradient(135deg, #b0b0b0, #666)",
            borderRadius: "2px",
            boxShadow: "0 0 8px rgba(60,60,60,0.6)",
            transform: "translate(-50%, -50%) rotate(0deg)",
            opacity: "1",
            zIndex: 1011,
            transition: "top 380ms ease-out, left 380ms ease-out, opacity 420ms ease-out, transform 380ms ease-out",
          });
          layer.appendChild(frag);
          const _f = frag.offsetWidth;
          frag.style.top = `${targetY + Math.sin(ang) * r}px`;
          frag.style.left = `${targetX + Math.cos(ang) * r}px`;
          frag.style.transform = `translate(-50%, -50%) rotate(${(ang * 180) / Math.PI + (Math.random() * 30 - 15)}deg)`;
          frag.style.opacity = "0";
        }

        // Vệt cắt sắc (slash lines) ngắn
        const slashes = 3;
        for (let s = 0; s < slashes; s++) {
          const slash = document.createElement("div");
          const ang = baseAngle + (Math.random() - 0.5) * 0.35;
          const len = 44 + Math.random() * 20;
          Object.assign(slash.style, {
            position: "fixed",
            top: `${targetY}px`,
            left: `${targetX}px`,
            width: `${len}px`,
            height: "3px",
            background: "linear-gradient(90deg, rgba(220,220,220,0.95), rgba(120,120,120,0.9))",
            borderRadius: "2px",
            transform: `translate(-50%, -50%) rotate(${(ang * 180) / Math.PI}deg) scale(0.7)`,
            opacity: "1",
            zIndex: 1012,
            transition: "opacity 260ms ease-out, transform 260ms ease-out",
          });
          layer.appendChild(slash);
          requestAnimationFrame(() => {
            slash.style.opacity = "0";
            slash.style.transform = `translate(-50%, -50%) rotate(${(ang * 180) / Math.PI}deg) scale(1.1)`;
          });
        }
      }, 60 + i * stagger + travel);
    }

    // Dọn dẹp
    setTimeout(() => { layer.remove(); }, 1500 + blades * stagger);
  },


  "Earthquake"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Aura báo hiệu từ attacker
    const aura = document.createElement("div");
    Object.assign(aura.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "160px",
      height: "160px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(160,140,110,0.35) 30%, rgba(120,100,80,0.25) 70%, transparent 100%)",
      filter: "blur(3px)",
      transform: "translate(-50%, -50%) scale(0.8)",
      opacity: "0",
      zIndex: 1003,
      transition: "opacity 600ms ease-out, transform 600ms ease-out",
    });
    layer.appendChild(aura);
    requestAnimationFrame(() => {
      aura.style.opacity = "1";
      aura.style.transform = "translate(-50%, -50%) scale(1.2)";
    });

    // Hàm rung màn hình nhiều pha (giống Thunder/Blizzard)
    const shakeSequence = (strengthPx, duration, interval) => {
      const offsets = [
        `translate(0,0)`,
        `translate(${ strengthPx}px,${-strengthPx}px)`,
        `translate(${-strengthPx}px,${ strengthPx}px)`,
        `translate(${ strengthPx}px,${ strengthPx}px)`,
        `translate(${-strengthPx}px,${-strengthPx}px)`
      ];
      let i = 0;
      const id = setInterval(() => {
        layer.style.transform = offsets[i % offsets.length];
        i++;
      }, interval);
      setTimeout(() => { clearInterval(id); layer.style.transform = "translate(0,0)"; }, duration);
    };

    // Chuỗi rung 3 pha (chậm gấp đôi)
    setTimeout(() => shakeSequence(3, 400, 30), 600);   // warm-up
    setTimeout(() => shakeSequence(7, 600, 24), 1200);  // peak mạnh
    setTimeout(() => shakeSequence(4, 400, 30), 1900);  // cool-down

    // Bụi đất lớn
    setTimeout(() => {
      const dust = document.createElement("div");
      Object.assign(dust.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "280px",
        height: "280px",
        borderRadius: "50%",
        background: "radial-gradient(circle, rgba(140,120,95,0.55) 28%, rgba(120,100,80,0.35) 58%, transparent 100%)",
        filter: "blur(3px)",
        transform: "translate(-50%, -50%) scale(0.7)",
        opacity: "1",
        zIndex: 1005,
        transition: "transform 1.2s ease-out, opacity 1.2s ease-out",
      });
      layer.appendChild(dust);
      requestAnimationFrame(() => {
        dust.style.transform = "translate(-50%, -50%) scale(2.6)";
        dust.style.opacity = "0";
      });

      // Debris văng ra chậm hơn
      for (let i = 0; i < 14; i++) {
        const frag = document.createElement("div");
        const ang = Math.random() * Math.PI * 2;
        const r = 70 + Math.random() * 120;
        Object.assign(frag.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "16px",
          height: "12px",
          background: "linear-gradient(135deg, #9a8f82, #4f4640)",
          borderRadius: "2px",
          boxShadow: "0 0 8px rgba(60,50,40,0.6)",
          transform: "translate(-50%, -50%) rotate(0deg)",
          opacity: "1",
          zIndex: 1006,
          transition: "top 1s ease-out, left 1s ease-out, opacity 1s ease-out, transform 1s ease-out",
        });
        layer.appendChild(frag);
        const _f = frag.offsetWidth;
        frag.style.top = `${targetY + Math.sin(ang) * r}px`;
        frag.style.left = `${targetX + Math.cos(ang) * r}px`;
        frag.style.transform = `translate(-50%, -50%) rotate(${(ang*180/Math.PI)+(Math.random()*30-15)}deg)`;
        frag.style.opacity = "0";
      }
    }, 1200);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 3000);
  },


  //hệ gió
  "Gust"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const dx = targetX - x;
    const dy = targetY - y;
    const angle = Math.atan2(dy, dx);
    const distance = Math.sqrt(dx*dx + dy*dy);

    // Vệt gió chính
    const gust = document.createElement("div");
    Object.assign(gust.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "0px",
      height: "30px",
      borderRadius: "15px",
      background: "linear-gradient(90deg, rgba(255,255,255,0.8), rgba(200,240,255,0.5), rgba(180,220,255,0))",
      filter: "blur(2px)",
      boxShadow: "0 0 20px rgba(200,240,255,0.6)",
      transformOrigin: "left center",
      transform: `rotate(${angle}rad)`,
      opacity: "1",
      zIndex: 1003,
      transition: "width 0.5s ease-out, opacity 0.6s ease-out",
    });
    layer.appendChild(gust);

    // Animate vệt gió dài ra
    requestAnimationFrame(() => {
      gust.style.width = `${distance}px`;
    });

    // Lá/hạt bụi bay theo
    const particles = 8;
    for (let i = 0; i < particles; i++) {
      const p = document.createElement("div");
      const size = 6 + Math.random() * 6;
      Object.assign(p.style, {
        position: "fixed",
        top: `${y + (Math.random() - 0.5) * 40}px`,
        left: `${x + (Math.random() - 0.5) * 40}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff, #cceeff)",
        opacity: "0.9",
        zIndex: 1004,
        transform: "translate(-50%, -50%) scale(0.8)",
        transition: "top 0.6s linear, left 0.6s linear, opacity 0.6s ease-out",
      });
      layer.appendChild(p);

      // Bay theo hướng gió
      setTimeout(() => {
        p.style.top = `${targetY + (Math.random() - 0.5) * 40}px`;
        p.style.left = `${targetX + (Math.random() - 0.5) * 40}px`;
        p.style.opacity = "0";
      }, 40 + i * 40);
    }

    // Va chạm: xoáy gió nhỏ
    setTimeout(() => {
      const swirl = document.createElement("div");
      Object.assign(swirl.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "80px",
        height: "80px",
        borderRadius: "50%",
        border: "4px solid rgba(200,240,255,0.9)",
        boxShadow: "0 0 40px rgba(200,240,255,0.7)",
        transform: "translate(-50%, -50%) scale(0.6) rotate(0deg)",
        opacity: "1",
        zIndex: 1010,
        transition: "transform 0.6s ease-out, opacity 0.6s ease-out",
      });
      layer.appendChild(swirl);
      requestAnimationFrame(() => {
        swirl.style.transform = "translate(-50%, -50%) scale(1.6) rotate(180deg)";
        swirl.style.opacity = "0";
      });
    }, 500);

    // Fade gust
    setTimeout(() => {
      gust.style.opacity = "0";
    }, 600);

    // Cleanup
    setTimeout(() => { layer.remove(); }, 1200);
  },


  "Air Cutter"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const dx = targetX - x;
    const dy = targetY - y;
    const angle = Math.atan2(dy, dx);
    const duration = 1000; // chậm 1/2

    // Box chứa lưỡi liềm
    const bladeBox = document.createElement("div");
    Object.assign(bladeBox.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "96px",
      height: "96px",
      transform: `translate(-50%, -50%) rotate(${angle}rad)`,
      opacity: "1",
      zIndex: 1006,
      transition: `top ${duration}ms linear, left ${duration}ms linear, transform ${duration}ms linear, opacity 300ms ease-out`,
    });
    layer.appendChild(bladeBox);

    // SVG lưỡi liềm chuẩn
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", "96");
    svg.setAttribute("height", "96");
    svg.setAttribute("viewBox", "0 0 96 96");
    bladeBox.appendChild(svg);

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
    grad.setAttribute("id", "airCutterGrad");
    grad.setAttribute("cx", "28%"); grad.setAttribute("cy", "50%"); grad.setAttribute("r", "70%");
    grad.innerHTML = `
      <stop offset="0%" stop-color="#fff"/>
      <stop offset="65%" stop-color="#dff3ff"/>
      <stop offset="100%" stop-color="rgba(200,240,255,0)"/>
    `;
    defs.appendChild(grad);

    const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
    mask.setAttribute("id", "crescentMask");
    mask.innerHTML = `
      <rect x="0" y="0" width="96" height="96" fill="black"/>
      <circle cx="48" cy="48" r="38" fill="white"/>
      <circle cx="32" cy="48" r="30" fill="black"/>
    `;
    defs.appendChild(mask);
    svg.appendChild(defs);

    const crescent = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    crescent.setAttribute("cx", "48"); crescent.setAttribute("cy", "48"); crescent.setAttribute("r", "38");
    crescent.setAttribute("fill", "url(#airCutterGrad)");
    crescent.setAttribute("mask", "url(#crescentMask)");
    crescent.style.filter = "drop-shadow(0 0 14px rgba(200,240,255,0.9))";
    svg.appendChild(crescent);

    // Ép reflow
    const _r = bladeBox.offsetWidth;

    // Animate bay tới target
    requestAnimationFrame(() => {
      bladeBox.style.top = `${targetY}px`;
      bladeBox.style.left = `${targetX}px`;
      bladeBox.style.transform = `translate(-50%, -50%) rotate(${angle}rad)`;
    });

    // Impact luôn chạy sau duration + buffer
    setTimeout(() => {
      bladeBox.style.opacity = "0";

      // Vệt cắt sáng
      const slash = document.createElement("div");
      Object.assign(slash.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "140px",
        height: "6px",
        background: "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(180,220,255,0.85))",
        borderRadius: "3px",
        transform: `translate(-50%, -50%) rotate(${(angle * 180) / Math.PI}deg) scale(0.7)`,
        opacity: "1",
        zIndex: 1010,
        transition: "transform 600ms ease-out, opacity 600ms ease-out",
      });
      layer.appendChild(slash);
      requestAnimationFrame(() => {
        slash.style.transform = `translate(-50%, -50%) rotate(${(angle * 180) / Math.PI}deg) scale(1.6)`;
        slash.style.opacity = "0";
      });

      // Vòng gió
      const burst = document.createElement("div");
      Object.assign(burst.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "110px",
        height: "110px",
        borderRadius: "50%",
        border: "4px solid rgba(200,240,255,0.85)",
        boxShadow: "0 0 44px rgba(200,240,255,0.65)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1011,
        transition: "transform 800ms ease-out, opacity 800ms ease-out",
      });
      layer.appendChild(burst);
      requestAnimationFrame(() => {
        burst.style.transform = "translate(-50%, -50%) scale(2.1)";
        burst.style.opacity = "0";
      });
    }, duration + 50);

    // Cleanup
    setTimeout(() => { layer.remove(); }, duration + 1600);
  },


  "Air Slash"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    const count = 14;
    const duration = 800;
    const impactDelay = 60;

    for (let i = 0; i < count; i++) {
      // Vị trí xuất phát ngẫu nhiên quanh target
      const angle = Math.random() * Math.PI * 2;
      const radius = 180 + Math.random() * 120;
      const startX = targetX + Math.cos(angle) * radius;
      const startY = targetY + Math.sin(angle) * radius;

      const flyAngle = Math.atan2(targetY - startY, targetX - startX);

      // Container cho lưỡi liềm
      const bladeBox = document.createElement("div");
      Object.assign(bladeBox.style, {
        position: "fixed",
        top: `${startY}px`,
        left: `${startX}px`,
        width: "60px",
        height: "60px",
        transform: `translate(-50%, -50%) rotate(${flyAngle}rad)`,
        opacity: "1",
        zIndex: 1006,
        transition: `top ${duration}ms linear, left ${duration}ms linear, transform ${duration}ms linear, opacity 300ms ease-out`,
      });
      layer.appendChild(bladeBox);

      // SVG lưỡi liềm nhỏ
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("width", "60");
      svg.setAttribute("height", "60");
      svg.setAttribute("viewBox", "0 0 60 60");
      bladeBox.appendChild(svg);

      const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
      const grad = document.createElementNS("http://www.w3.org/2000/svg", "radialGradient");
      grad.setAttribute("id", `airSlashGrad${i}`);
      grad.setAttribute("cx", "28%"); grad.setAttribute("cy", "50%"); grad.setAttribute("r", "70%");
      grad.innerHTML = `
        <stop offset="0%" stop-color="#fff"/>
        <stop offset="65%" stop-color="#dff3ff"/>
        <stop offset="100%" stop-color="rgba(200,240,255,0)"/>
      `;
      defs.appendChild(grad);

      const mask = document.createElementNS("http://www.w3.org/2000/svg", "mask");
      mask.setAttribute("id", `crescentMask${i}`);
      mask.innerHTML = `
        <rect x="0" y="0" width="60" height="60" fill="black"/>
        <circle cx="30" cy="30" r="24" fill="white"/>
        <circle cx="18" cy="30" r="18" fill="black"/>
      `;
      defs.appendChild(mask);
      svg.appendChild(defs);

      const crescent = document.createElementNS("http://www.w3.org/2000/svg", "circle");
      crescent.setAttribute("cx", "30"); crescent.setAttribute("cy", "30"); crescent.setAttribute("r", "24");
      crescent.setAttribute("fill", `url(#airSlashGrad${i})`);
      crescent.setAttribute("mask", `url(#crescentMask${i})`);
      crescent.style.filter = "drop-shadow(0 0 10px rgba(200,240,255,0.8))";
      svg.appendChild(crescent);

      // Ép reflow
      const _r = bladeBox.offsetWidth;

      // Animate bay tới target
      setTimeout(() => {
        bladeBox.style.top = `${targetY}px`;
        bladeBox.style.left = `${targetX}px`;
        bladeBox.style.transform = `translate(-50%, -50%) rotate(${flyAngle}rad)`;
      }, i * 40);

      // Va chạm
      setTimeout(() => {
        bladeBox.style.opacity = "0";

        // Vệt cắt sáng
        const slash = document.createElement("div");
        Object.assign(slash.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "100px",
          height: "4px",
          background: "linear-gradient(90deg, rgba(255,255,255,0.95), rgba(180,220,255,0.85))",
          borderRadius: "2px",
          transform: `translate(-50%, -50%) rotate(${(flyAngle * 180) / Math.PI}deg) scale(0.7)`,
          opacity: "1",
          zIndex: 1010,
          transition: "transform 500ms ease-out, opacity 500ms ease-out",
        });
        layer.appendChild(slash);
        requestAnimationFrame(() => {
          slash.style.transform = `translate(-50%, -50%) rotate(${(flyAngle * 180) / Math.PI}deg) scale(1.4)`;
          slash.style.opacity = "0";
        });

        // Vòng gió nhỏ
        const burst = document.createElement("div");
        Object.assign(burst.style, {
          position: "fixed",
          top: `${targetY}px`,
          left: `${targetX}px`,
          width: "80px",
          height: "80px",
          borderRadius: "50%",
          border: "3px solid rgba(200,240,255,0.85)",
          boxShadow: "0 0 30px rgba(200,240,255,0.6)",
          transform: "translate(-50%, -50%) scale(0.6)",
          opacity: "1",
          zIndex: 1011,
          transition: "transform 600ms ease-out, opacity 600ms ease-out",
        });
        layer.appendChild(burst);
        requestAnimationFrame(() => {
          burst.style.transform = "translate(-50%, -50%) scale(1.8)";
          burst.style.opacity = "0";
        });
      }, i * 40 + duration + impactDelay);
    }

    // Cleanup
    setTimeout(() => { layer.remove(); }, count * 40 + duration + 1200);
  },


  "Hurricane"(container, { x, y, targetX, targetY }) {
    const layer = createEffectLayer(container);

    // Timings (cinematic but responsive)
    const preCharge = 600;      // attacker aura buildup
    const buildTime = 1000;     // vortex build/scale
    const spinTime = 1400;      // continuous spin phase
    const convergeTime = 900;   // particles converge
    const peakHold = 500;       // hold before final blast
    const cleanupDelay = 1200;

    // Inject keyframes for smooth rotation
    const style = document.createElement("style");
    style.textContent = `
      @keyframes spinCW { from { transform: translate(-50%, -50%) rotate(0deg) scale(1); } to { transform: translate(-50%, -50%) rotate(360deg) scale(1); } }
      @keyframes spinCCW { from { transform: translate(-50%, -50%) rotate(0deg) scale(1); } to { transform: translate(-50%, -50%) rotate(-360deg) scale(1); } }
    `;
    layer.appendChild(style);

    // Screen shake (Thunder/Blizzard style)
    const shake = (strengthPx, duration, interval) => {
      const offsets = [
        `translate(0,0)`,
        `translate(${ strengthPx}px,${-strengthPx}px)`,
        `translate(${-strengthPx}px,${ strengthPx}px)`,
        `translate(${ strengthPx}px,${ strengthPx}px)`,
        `translate(${-strengthPx}px,${-strengthPx}px)`
      ];
      let i = 0;
      const id = setInterval(() => {
        layer.style.transform = offsets[i % offsets.length];
        i++;
      }, interval);
      setTimeout(() => { clearInterval(id); layer.style.transform = "translate(0,0)"; }, duration);
    };

    // Origin cue at attacker
    const aura = document.createElement("div");
    Object.assign(aura.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      width: "160px",
      height: "160px",
      borderRadius: "50%",
      background: "radial-gradient(circle, rgba(220,245,255,0.35) 30%, rgba(200,235,255,0.25) 65%, transparent 100%)",
      filter: "blur(2px)",
      transform: "translate(-50%, -50%) scale(0.7)",
      opacity: "0",
      zIndex: 1003,
      transition: `opacity ${preCharge}ms ease-out, transform ${preCharge}ms ease-out`,
    });
    layer.appendChild(aura);
    requestAnimationFrame(() => {
      aura.style.opacity = "1";
      aura.style.transform = "translate(-50%, -50%) scale(1.1)";
    });

    // Ambient haze
    const haze = document.createElement("div");
    Object.assign(haze.style, {
      position: "fixed",
      top: "0", left: "0",
      width: "100vw", height: "100vh",
      background: "radial-gradient(circle at center, rgba(220,245,255,0.18), rgba(190,230,255,0.12), transparent 70%)",
      opacity: "0",
      zIndex: 1002,
      transition: "opacity 500ms ease-out",
    });
    layer.appendChild(haze);
    requestAnimationFrame(() => { haze.style.opacity = "1"; });

    // Vortex core layers at target (conic-gradient spirals)
    const vortexLayers = [];
    const sizes = [140, 200, 260]; // stacked to suggest 3D height
    const borders = ["rgba(200,240,255,0.65)", "rgba(200,240,255,0.5)", "rgba(200,240,255,0.4)"];

    for (let i = 0; i < sizes.length; i++) {
      const v = document.createElement("div");
      const size = sizes[i];
      Object.assign(v.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        // Conic spiral + subtle radial mask via background layering
        background: `
          conic-gradient(
            from 0deg,
            transparent 0deg 45deg,
            rgba(200,240,255,0.35) 45deg 90deg,
            transparent 90deg 180deg,
            rgba(200,240,255,0.35) 180deg 225deg,
            transparent 225deg 360deg
          ),
          radial-gradient(circle, rgba(220,245,255,0.25) 30%, transparent 70%)
        `,
        boxShadow: "0 0 50px rgba(200,240,255,0.6)",
        transform: "translate(-50%, -50%) scale(0.5) rotate(0deg)",
        opacity: "0",
        zIndex: 1006 + i,
        transition: `transform ${buildTime}ms ease-out, opacity 600ms ease-out`,
        border: `3px solid ${borders[i]}`,
      });
      layer.appendChild(v);
      vortexLayers.push(v);
    }

    // Build and start spinning the vortex
    setTimeout(() => {
      vortexLayers.forEach((v, idx) => {
        v.style.opacity = "1";
        v.style.transform = `translate(-50%, -50%) scale(${1.1 + idx * 0.15}) rotate(0deg)`;
        // alternate spin directions for depth
        v.style.animation = `${idx % 2 ? 'spinCCW' : 'spinCW'} ${spinTime}ms linear infinite`;
      });
    }, preCharge - 200);

    // Wind-borne debris/particles converging in spiral fashion
    const particles = 24;
    for (let i = 0; i < particles; i++) {
      const p = document.createElement("div");
      const size = 6 + Math.random() * 6;
      const ang = Math.random() * Math.PI * 2;
      const r = 220 + Math.random() * 140;
      const startX = targetX + Math.cos(ang) * r;
      const startY = targetY + Math.sin(ang) * r;
      Object.assign(p.style, {
        position: "fixed",
        top: `${startY}px`,
        left: `${startX}px`,
        width: `${size}px`,
        height: `${size}px`,
        borderRadius: "50%",
        background: "radial-gradient(circle, #fff, #cceeff)",
        opacity: "0.95",
        zIndex: 1008,
        transform: "translate(-50%, -50%)",
        transition: `top ${convergeTime}ms ease-in, left ${convergeTime}ms ease-in, opacity 800ms ease-out`,
      });
      layer.appendChild(p);
      // slight stagger and a gentle arc by biasing midpoint
      const midBias = 0.25 + Math.random() * 0.25;
      const midX = targetX + Math.cos(ang + 0.8) * (r * midBias);
      const midY = targetY + Math.sin(ang + 0.8) * (r * midBias);

      // two-step path: toward biased midpoint, then into center
      setTimeout(() => {
        p.style.top = `${midY}px`;
        p.style.left = `${midX}px`;
      }, preCharge + i * 40);

      setTimeout(() => {
        p.style.top = `${targetY}px`;
        p.style.left = `${targetX}px`;
        p.style.opacity = "0";
      }, preCharge + i * 40 + convergeTime * 0.6);
    }

    // Thunder-style multi-phase screen shake at crescendo
    setTimeout(() => shake(3, 360, 28), preCharge + buildTime - 160);               // warm-up
    setTimeout(() => shake(7, 560, 22), preCharge + buildTime + 120);                // peak
    setTimeout(() => shake(4, 360, 28), preCharge + buildTime + 120 + 560 + 40);     // cool-down

    // Impact flash (brief blue-white)
    setTimeout(() => {
      const flash = document.createElement("div");
      Object.assign(flash.style, {
        position: "fixed",
        top: "0", left: "0",
        width: "100vw", height: "100vh",
        background: "rgba(220,245,255,0.32)",
        opacity: "0",
        zIndex: 1015,
        transition: "opacity 160ms ease-out",
      });
      layer.appendChild(flash);
      requestAnimationFrame(() => { flash.style.opacity = "1"; });
      setTimeout(() => { flash.style.opacity = "0"; }, 180);
      setTimeout(() => { flash.remove(); }, 420);
    }, preCharge + buildTime + 140);

    // Final wind blast ring
    setTimeout(() => {
      const ring = document.createElement("div");
      Object.assign(ring.style, {
        position: "fixed",
        top: `${targetY}px`,
        left: `${targetX}px`,
        width: "240px",
        height: "240px",
        borderRadius: "50%",
        border: "6px solid rgba(200,240,255,0.9)",
        boxShadow: "0 0 80px rgba(200,240,255,0.7)",
        transform: "translate(-50%, -50%) scale(0.6)",
        opacity: "1",
        zIndex: 1012,
        transition: "transform 800ms ease-out, opacity 800ms ease-out",
      });
      layer.appendChild(ring);
      const _rr = ring.offsetWidth;
      ring.style.transform = "translate(-50%, -50%) scale(2.4)";
      ring.style.opacity = "0";
    }, preCharge + buildTime + peakHold);

    // Fade aura and vortex layers
    setTimeout(() => {
      aura.style.opacity = "0";
      vortexLayers.forEach(v => {
        v.style.animation = ""; // stop spin
        v.style.transition = "opacity 300ms ease-out";
        v.style.opacity = "0";
      });
    }, preCharge + buildTime + peakHold + 300);

    // Cleanup
    setTimeout(() => { layer.remove(); }, preCharge + buildTime + spinTime + peakHold + cleanupDelay);
  },






 

};
