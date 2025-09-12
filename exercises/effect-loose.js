// effect-loose.js

// ——————————————————————————————————————————————————
// 1. IMPORTS & FIREBASE SETUP
// ——————————————————————————————————————————————————
import { initializeApp, getApp } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js";
import { pokemonData } from "./pokemonData.js";
import { skillEffects } from "./skillEffects.js";

const firebaseConfig = {
  apiKey: "AIzaSyCCVdzWiiFvcWiHVJN-x33YKarsjyziS8E",
  authDomain: "pokemon-capture-10d03.firebaseapp.com",
  projectId: "pokemon-capture-10d03",
  storageBucket: "pokemon-capture-10d03.appspot.com",
  messagingSenderId: "1068125543917",
  appId: "1:1068125543917:web:57de4365ee56729ea8dbe4"
};

let app;
try { app = initializeApp(firebaseConfig); }
catch { app = getApp(); }
const db = getFirestore(app);

(async () => {
  const name = localStorage.getItem("trainerName") || "Không tên";
  const cls = localStorage.getItem("trainerClass") || "Chưa có lớp";
  const ref = doc(db, "bosuutap", `${name.trim()}-${cls.trim()}`);
  try {
    const snap = await getDoc(ref);
    window.selectedPokemonID = snap.exists() ? snap.data().selected : 25;
  } catch {
    window.selectedPokemonID = 25;
  }
})();

// ——————————————————————————————————————————————————
// 2. HELPERS & KEYFRAMES
// ——————————————————————————————————————————————————

function injectGlobalStyles() {
  if (document.getElementById("poke-effect-styles")) return;
  const s = document.createElement("style");
  s.id = "poke-effect-styles";
  s.innerHTML = `
    @keyframes shake { 0%,100%{transform:translate(-50%,-50%)rotate(0);}25%{transform:translate(-50%,-50%)rotate(10deg);}50%{transform:translate(-50%,-50%)rotate(-10deg);}75%{transform:translate(-50%,-50%)rotate(10deg);} }
    @keyframes beamFlash { 0%{opacity:0;transform:translate(-50%,-50%)scale(0.5);}50%{opacity:1;transform:translate(-50%,-50%)scale(1.2);}100%{opacity:0;transform:translate(-50%,-50%)scale(1.6);} }
    @keyframes faint { 0%{opacity:1;transform:translate(-50%,-50%)scale(1.4);}50%{opacity:0.5;transform:translate(-50%,-50%)rotate(20deg)scale(1.2);}100%{opacity:0;transform:translate(-50%,-50%)rotate(90deg)scale(0.8);} }
    @keyframes chase { 0%{top:40%;left:30%;}25%{top:35%;left:50%;}50%{top:45%;left:40%;}75%{top:38%;left:60%;}100%{top:40%;left:30%;} }
    @keyframes dodge { 0%{top:60%;left:70%;}25%{top:65%;left:50%;}50%{top:55%;left:60%;}75%{top:62%;left:40%;}100%{top:60%;left:70%;} }
    @keyframes zigzag { 0%{top:40%;left:40%;}25%{top:35%;left:60%;}50%{top:45%;left:50%;}75%{top:38%;left:70%;}100%{top:40%;left:40%;} }
    @keyframes circle { 0%{transform:translate(-50%,-50%)rotate(0);}100%{transform:translate(-50%,-50%)rotate(360deg);} }
    @keyframes hop { 0%{top:50%;}50%{top:40%;}100%{top:50%;} }
    @keyframes slideX { 0%{left:10%;}100%{left:90%;} }
    @keyframes slideY { 0%{top:10%;}100%{top:90%;} }
    @keyframes diagonal { 0%{top:10%;left:10%;}100%{top:90%;left:90%;} }
    @keyframes teleportOut { 0%{opacity:1;transform:scale(1);}100%{opacity:0;transform:scale(0.5);} }
    @keyframes teleportIn  { 0%{opacity:0;transform:scale(0.5);}100%{opacity:1;transform:scale(1.4);} }
  `;
  document.head.appendChild(s);
}

function getPokemonInfo(id) {
  return pokemonData.find(p => p.id === id) || {
    id,
    type: "normal",
    skills: ["Tackle"],
    power: 30,
    size: "medium"
  };
}

function getAllNormalSkills() {
  const all = new Set();
  for (const p of pokemonData) {
    if (p.type === "normal" && Array.isArray(p.skills)) {
      p.skills.forEach(name => {
        if (skillEffects[name]) all.add(name);
      });
    }
  }
  return Array.from(all);
}


function createSprite(id, role) {
  const pos = role === "my"
    ? { top: "60%", left: "70%" }
    : { top: "40%", left: "30%" };
  const img = document.createElement("img");
  img.src = `https://raw.githubusercontent.com/PokeAPI/sprites/master/sprites/pokemon/${id}.png`;
  img.dataset.pokeId = id;
  Object.assign(img.style, {
    position: "fixed",
    top: pos.top,
    left: pos.left,
    transform: "translate(-50%,-50%) scale(1.4)",
    height: "180px",
    boxShadow: role === "my"
      ? "0 0 30px rgba(255,255,0,0.9)"
      : "0 0 30px rgba(255,255,255,0.9)",
    zIndex: 1000
  });
  return img;
}
function animateSpriteSequence(sprite, totalMs, role) {
  let currentTop = parseFloat(sprite.style.top) || 50;
  let currentLeft = parseFloat(sprite.style.left) || 50;
  const moveCount = Math.floor(totalMs / 1500);
  const moveTypes = ["slideX", "slideY", "diagonal", "teleport", "chase", "hop"];
  const isMy = role === "my";

  for (let i = 0; i < moveCount; i++) {
    const delay = i * 1500;
    setTimeout(() => {
      const move = moveTypes[Math.floor(Math.random() * moveTypes.length)];
      let newTop = currentTop;
      let newLeft = currentLeft;

      const randTop = Math.random() * 90 + 5;
      const randLeft = Math.random() * 90 + 5;

      if (move === "slideX") {
        newLeft = randLeft;
        sprite.style.animation = "slideX 1.5s ease-in-out";
      } else if (move === "slideY") {
        newTop = randTop;
        sprite.style.animation = "slideY 1.5s ease-in-out";
      } else if (move === "diagonal") {
        newTop = randTop;
        newLeft = randLeft;
        sprite.style.animation = "diagonal 1.5s ease-in-out";
      } else if (move === "teleport") {
        sprite.style.animation = "teleportOut 0.3s ease-in-out";
        setTimeout(() => {
          newTop = Math.random() * 90 + 5;
          newLeft = Math.random() * 90 + 5;
          sprite.style.top = `${newTop}%`;
          sprite.style.left = `${newLeft}%`;
          sprite.style.animation = "teleportIn 0.3s ease-in-out";
          currentTop = newTop;
          currentLeft = newLeft;
        }, 300);
        return;
      } else {
        sprite.style.animation = `${move} 1.5s ease-in-out`;
        newTop = randTop;
        newLeft = randLeft;
      }

      // Nếu là bước cuối → ép vị trí kết thúc theo hướng
      if (i === moveCount - 1) {
        newLeft = isMy ? Math.random() * 20 + 70 : Math.random() * 20 + 10;
        newTop = Math.random() * 80 + 10;
      }

      sprite.style.top = `${newTop}%`;
      sprite.style.left = `${newLeft}%`;
      currentTop = newTop;
      currentLeft = newLeft;
    }, delay);
  }
}
function animatePokeBall(container) {
  injectGlobalStyles();
  return new Promise(resolve => {
    const ball = document.createElement("img");
    ball.src = "https://cdn-icons-png.flaticon.com/512/361/361998.png";
    Object.assign(ball.style, {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%,-50%)",
      height: "120px",
      zIndex: 1000,
      animation: "shake 0.5s ease-in-out 2"
    });
    container.append(ball);

    setTimeout(() => {
      ball.remove();
      const beam = document.createElement("div");
      Object.assign(beam.style, {
        position: "fixed",
        top: "50%",
        left: "50%",
        transform: "translate(-50%,-50%)",
        width: "200px",
        height: "200px",
        background: "radial-gradient(circle, rgba(255,255,255,0.8) 0%, transparent 70%)",
        borderRadius: "50%",
        zIndex: 999,
        animation: "beamFlash 1s ease-out forwards"
      });
      container.append(beam);

      setTimeout(() => {
        beam.remove();
        resolve();
      }, 1000);
    }, 1100);
  });
}

function animateSkillEffect(pokemonId, skills, container, targetId) {
  const source = document.querySelector(`img[data-poke-id="${pokemonId}"]`);
  const target = document.querySelector(`img[data-poke-id="${targetId}"]`);
  if (!source || !target) return;

  const { x: x1, y: y1 } = source.getBoundingClientRect();
  const { x: x2, y: y2 } = target.getBoundingClientRect();

  skills.forEach(name => {
    const fn = skillEffects[name];
    if (typeof fn === "function") {
      fn(container, { x: x1, y: y1, targetX: x2, targetY: y2 });
    }
  });
}

// ——————————————————————————————————————————————————
// 3. PUBLIC API: SHOW DEFEAT EFFECT
// ——————————————————————————————————————————————————

export async function showDefeatEffect(container = document.body) {
  await animatePokeBall(container);

  const myId = window.selectedPokemonID || 25;
  const wildId = Math.floor(Math.random() * 649) + 1;

  const totalMs = Math.floor(Math.random() * 3000 + 5000); // 5–8s

  const mySprite = createSprite(myId, "my");
  const wildSprite = createSprite(wildId, "wild");
  container.append(mySprite, wildSprite);

  animateSpriteSequence(mySprite, totalMs, "my");
  animateSpriteSequence(wildSprite, totalMs, "wild");

  setTimeout(() => {
    const normalSkills = getAllNormalSkills();



    const chosen = normalSkills.length > 0
      ? [normalSkills[Math.floor(Math.random() * normalSkills.length)]]
      : ["Tackle"]; // fallback nếu không có chiêu hệ normal

    animateSkillEffect(wildId, chosen, container, myId);

    // Pokémon của bạn bị đánh bại
    setTimeout(() => {
      mySprite.style.animation = "faint 1s ease-in-out forwards";
    }, 1000);

    // Thông báo thất bại
    setTimeout(() => {
      const result = document.createElement("div");
      result.textContent = "❌ Pokémon của bạn đã bị đánh bại!";
      Object.assign(result.style, {
        position: "fixed",
        top: "85%",
        left: "50%",
        transform: "translateX(-50%)",
        fontSize: "22px",
        color: "#ff4444",
        textShadow: "2px 2px 6px black",
        zIndex: 1003
      });
      container.appendChild(result);
    }, 1600);
  }, totalMs + 200);
}
