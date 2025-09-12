// skillEffects.js

// 1. Tạo layer chung cho mọi hiệu ứng
function createEffectLayer(container) {
  const layer = document.createElement("div");
  Object.assign(layer.style, {
    position:   "fixed",
    top:        0,
    left:       0,
    width:      "100%",
    height:     "100%",
    pointerEvents: "none",
    zIndex:     2000
  });
  container.appendChild(layer);
  return layer;
}

export const skillEffects = {
  /**
   * Tackle: tạo quả cầu sáng lan rộng rồi fade out
   */
  Tackle(container, { x, y, targetX, targetY }) {
    const layer = document.createElement("div");
    Object.assign(layer.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 2000
    });
    container.appendChild(layer);

    // 1. Gồng chiêu: Pokémon ra chiêu thực hiện attackPose
    const attacker = document.elementFromPoint(x, y);
    if (attacker && attacker.tagName === "IMG") {
      attacker.style.animation = "attackPose 0.6s ease-in-out";
    }

    // 2. Tạo quả cầu lửa
    const fireball = document.createElement("div");
    Object.assign(fireball.style, {
      position: "fixed",
      top: `${y}px`,
      left: `${x}px`,
      transform: "translate(-50%, -50%)",
      width: "100px",
      height: "100px",
      borderRadius: "50%",
      background: "radial-gradient(circle, yellow 40%, orange 80%, transparent 100%)",
      boxShadow: "0 0 80px yellow, 0 0 120px orange",
      zIndex: 1002,
      transition: "top 0.5s ease-out, left 0.5s ease-out, opacity 0.5s ease-out"
    });
    layer.appendChild(fireball);

    // 3. Bay về phía đối thủ
    setTimeout(() => {
      fireball.style.top = `${targetY}px`;
      fireball.style.left = `${targetX}px`;
      fireball.style.opacity = "0";
      fireball.style.transform = "translate(-50%, -50%) scale(1.6)";
    }, 50);

    // 4. Cleanup
    setTimeout(() => {
      layer.remove();
    }, 1200);
  },



  /**
   * Headbutt: tạo chấm hồng ở đầu, scale lên rồi fade
   */
  Headbutt(container, { x, y, targetX, targetY }) {
    const layer = document.createElement("div");
    Object.assign(layer.style, {
      position: "fixed",
      top: 0,
      left: 0,
      width: "100%",
      height: "100%",
      pointerEvents: "none",
      zIndex: 2000
    });
    container.appendChild(layer);

    // 1. Gồng chiêu: Pokémon gốc thực hiện attackPose
    const attacker = document.elementFromPoint(x, y);
    if (attacker && attacker.tagName === "IMG") {
      attacker.style.animation = "attackPose 0.5s ease-in-out";
      attacker.style.opacity = "0"; // ✅ Biến mất tạm thời
    }

    // 2. Tạo bản sao để lao tới
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
      transition: "top 0.6s ease-out, left 0.6s ease-out, opacity 0.6s ease-out"
    });
    layer.appendChild(clone);

    // 3. Lao tới vị trí đối thủ
    setTimeout(() => {
      clone.style.top = `${targetY}px`;
      clone.style.left = `${targetX}px`;
      clone.style.opacity = "0";
      clone.style.transform = "translate(-50%, -50%) scale(1.6)";
    }, 100); // ✅ delay nhẹ để tạo cảm giác nặng lực

    // 4. Va chạm: tạo hiệu ứng nổ nhỏ
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
        transition: "transform 0.3s ease-out, opacity 0.3s ease-out"
      });
      layer.appendChild(impact);

      setTimeout(() => {
        impact.style.transform = "translate(-50%, -50%) scale(2)";
        impact.style.opacity = "0";
      }, 50);
    }, 700); // sau khi clone chạm

    // 5. Hiện lại Pokémon gốc
    setTimeout(() => {
      if (attacker) attacker.style.opacity = "1";
      layer.remove();
    }, 1000);
  }


};
