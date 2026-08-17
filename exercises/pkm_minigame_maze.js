/**
 * ==========================================
 * pkm_minigame_maze.js — MÊ CUNG TỪ VỰNG (độc lập hoàn toàn)
 * ==========================================
 * Cùng nhóm "introPresent" với pkm_minigame_flipbook.js — dùng CHUNG dữ liệu
 * rounds từ module-1-intro.js (buildIntroRounds) và CHUNG logic dạy-từ với
 * flipbook qua pkm_intro_round_helpers.js. Chỉ khác cách THỂ HIỆN.
 *
 * Thứ tự chơi (khác flipbook — mỗi game được tự chọn thứ tự riêng, module
 * không quan tâm): PHA 1 chạy hết mọi round "present" (mỗi lần 1 ảnh xuất
 * hiện ở 1 góc ngẫu nhiên trong mê cung), xong mới sang PHA 2 chạy hết mọi
 * round "phonicsSpeak". Ăn xong 1 ảnh -> ảnh biến mất, ảnh tiếp theo xuất
 * hiện ở góc khác.
 *
 * Bản đồ mê cung sinh ngẫu nhiên MỖI BUỔI HỌC (randomized DFS/recursive
 * backtracker) — đảm bảo mọi ô đều có đường đi tới (không có ô bị cô lập).
 */

import { PkmGameLauncher, getImageFromMap, prefetchImagesBatch, shuffle } from "./all-shared.js";
import { readPresentSequence, readPhonicsSequence, runMicRepeat, playPopSound } from "./pkm_intro_round_helpers.js";

const COLS = 8, ROWS = 6;
const DIR_DELTA = { N: [0, -1], S: [0, 1], E: [1, 0], W: [-1, 0] };
const OPPOSITE = { N: "S", S: "N", E: "W", W: "E" };

const el = id => document.getElementById(id);

// ============================================================================
// SINH MÊ CUNG (randomized DFS — đảm bảo mọi ô đều có đường tới)
// ============================================================================
function generateMaze(cols, rows) {
  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ N: false, E: false, S: false, W: false, visited: false })));

  function carve(x, y) {
    grid[y][x].visited = true;
    const dirs = shuffle(["N", "E", "S", "W"]);
    for (const d of dirs) {
      const [dx, dy] = DIR_DELTA[d];
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || nx >= cols || ny < 0 || ny >= rows) continue;
      if (grid[ny][nx].visited) continue;
      grid[y][x][d] = true;
      grid[ny][nx][OPPOSITE[d]] = true;
      carve(nx, ny);
    }
  }
  carve(0, 0);
  return grid;
}

// ============================================================================
// TRẠNG THÁI CHUNG
// ============================================================================
let maze = null;
let cellSize = 56;
let player = { x: 0, y: 0 };
let orderedRounds = [];
let roundCursor = 0;
let results = [];
let targetCell = null;
let moveLocked = false;

// ============================================================================
// VẼ MÊ CUNG
// ============================================================================
function renderMaze() {
  const wrap = el("pkzMazeWrap");
  wrap.style.width = (COLS * cellSize) + "px";
  wrap.style.height = (ROWS * cellSize) + "px";
  wrap.innerHTML = "";
  const wallT = Math.max(4, Math.round(cellSize * 0.1));

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      const c = maze[y][x];
      const cell = document.createElement("div");
      cell.className = "pkz-cell";
      cell.style.left = (x * cellSize) + "px";
      cell.style.top = (y * cellSize) + "px";
      cell.style.width = cellSize + "px";
      cell.style.height = cellSize + "px";
      wrap.appendChild(cell);

      if (!c.N) addWallRect(wrap, x * cellSize, y * cellSize, cellSize, wallT);
      if (!c.W) addWallRect(wrap, x * cellSize, y * cellSize, wallT, cellSize);
      if (x === COLS - 1 && !c.E) addWallRect(wrap, (x + 1) * cellSize - wallT, y * cellSize, wallT, cellSize);
      if (y === ROWS - 1 && !c.S) addWallRect(wrap, x * cellSize, (y + 1) * cellSize - wallT, cellSize, wallT);
    }
  }

  const playerEl = document.createElement("div");
  playerEl.className = "pkz-player";
  playerEl.id = "pkzPlayerEl";
  playerEl.textContent = "🧒";
  playerEl.style.width = cellSize + "px";
  playerEl.style.height = cellSize + "px";
  wrap.appendChild(playerEl);

  renderPlayerPosition();
}

function addWallRect(wrap, left, top, w, h) {
  const wall = document.createElement("div");
  wall.className = "pkz-wall";
  wall.style.left = left + "px"; wall.style.top = top + "px";
  wall.style.width = w + "px"; wall.style.height = h + "px";
  wrap.appendChild(wall);
}

function renderPlayerPosition() {
  const p = el("pkzPlayerEl");
  if (!p) return;
  p.style.left = (player.x * cellSize) + "px";
  p.style.top = (player.y * cellSize) + "px";
}

function computeCellSize() {
  const vp = el("pkzViewport");
  const availW = vp.clientWidth - 16, availH = vp.clientHeight - 16;
  cellSize = Math.max(34, Math.min(64, Math.floor(Math.min(availW / COLS, availH / ROWS))));
}

// ============================================================================
// SINH VỊ TRÍ ẢNH MỤC TIÊU MỚI (1 ô ngẫu nhiên khác vị trí người chơi)
// ============================================================================
function spawnTarget(round) {
  let cell;
  do {
    cell = { x: Math.floor(Math.random() * COLS), y: Math.floor(Math.random() * ROWS) };
  } while (cell.x === player.x && cell.y === player.y);

  targetCell = cell;
  const wrap = el("pkzMazeWrap");
  const old = wrap.querySelector(".pkz-target");
  if (old) old.remove();

  const t = document.createElement("div");
  t.className = "pkz-target";
  t.id = "pkzTargetEl";
  t.style.left = (cell.x * cellSize + cellSize * 0.12) + "px";
  t.style.top = (cell.y * cellSize + cellSize * 0.12) + "px";
  t.style.width = (cellSize * 0.76) + "px";
  t.style.height = (cellSize * 0.76) + "px";
  t.innerHTML = `<img src="${getImageFromMap(round.imageKeyword) || ""}" alt=""/>`;
  wrap.appendChild(t);
}

// ============================================================================
// DI CHUYỂN
// ============================================================================
function tryMove(dir) {
  if (moveLocked) return;
  const c = maze[player.y][player.x];
  if (!c[dir]) return; // có tường, không đi được
  const [dx, dy] = DIR_DELTA[dir];
  player.x += dx; player.y += dy;
  renderPlayerPosition();

  if (targetCell && player.x === targetCell.x && player.y === targetCell.y) {
    onReachTarget();
  }
}

function attachControls() {
  el("pkzUp").onclick = () => tryMove("N");
  el("pkzDown").onclick = () => tryMove("S");
  el("pkzLeft").onclick = () => tryMove("W");
  el("pkzRight").onclick = () => tryMove("E");

  let startX = null, startY = null;
  const vp = el("pkzViewport");
  vp.addEventListener("touchstart", e => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; }, { passive: true });
  vp.addEventListener("touchend", e => {
    if (startX === null) return;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    startX = null; startY = null;
    if (Math.max(Math.abs(dx), Math.abs(dy)) < 32) return;
    if (Math.abs(dx) > Math.abs(dy)) tryMove(dx < 0 ? "W" : "E");
    else tryMove(dy < 0 ? "N" : "S");
  }, { passive: true });
}

// ============================================================================
// ĂN ẢNH -> HIỆN THẺ HỌC TỪ
// ============================================================================
async function onReachTarget() {
  moveLocked = true;
  playPopSound();
  const round = orderedRounds[roundCursor];
  el("pkzTargetEl")?.remove();
  targetCell = null;

  el("pkzCardImg").src = getImageFromMap(round.imageKeyword) || "";
  el("pkzCardOverlay").classList.add("show");
  const continueBtn = el("pkzCardContinueBtn");
  continueBtn.disabled = true;

  if (round.type === "present") renderPresentCard(round);
  else renderPhonicsCard(round);

  // ─── Dự phòng bị đơ: sau 5s tự mở nút Tiếp tục dù đọc/nói dở gì đi nữa ───
  let watchdogFired = false;
  const watchdog = setTimeout(() => {
    watchdogFired = true;
    if (results[roundCursor] === undefined) results[roundCursor] = round.type === "present" ? null : { attemptsUsed: 2 };
    continueBtn.disabled = false;
  }, 5000);

  if (round.type === "present") {
    await readPresentSequence(round);
    if (!watchdogFired) results[roundCursor] = null;
  } else {
    await readPhonicsSequence(round, el("pkzPhonicsBox"));
    const attemptsUsed = await runMicRepeat(round, {
      statusEl: el("pkzSpeakStatus"), micEl: el("pkzMic"),
      finishBtnEl: el("pkzMicFinishBtn"), resultEl: el("pkzSpeakResult"),
    });
    if (!watchdogFired) results[roundCursor] = { attemptsUsed };
  }
  clearTimeout(watchdog);
  continueBtn.disabled = false;

  continueBtn.onclick = () => {
    el("pkzCardOverlay").classList.remove("show");
    roundCursor++;
    updateProgress();
    moveLocked = false;
    advanceOrFinish();
  };
}

function renderPresentCard(round) {
  el("pkzCardContent").innerHTML = `
    <div class="pkz-word-row">
      ${round.word.split(" ").map(p => `<span class="pkz-word-tap" data-w="${p}">${p.toUpperCase()}</span>`).join("")}
    </div>
    <div class="pkz-meaning">${round.meaning}</div>
    ${round.ah ? `<div class="pkz-ah">💡 ${round.ah.en ? round.ah.en + " : " : ""}${round.ah.vi || ""}</div>` : ""}
    ${round.ai ? `<div class="pkz-ai">✨ ${round.ai}</div>` : ""}
  `;
}

function renderPhonicsCard(round) {
  el("pkzCardContent").innerHTML = `
    <div class="pkz-phonics-word">${round.word.toUpperCase()}</div>
    <div id="pkzPhonicsBox"></div>
    <div class="pkz-speak-status" id="pkzSpeakStatus"></div>
    <div class="pkz-mic-wrap"><div class="pkz-mic-ring locked" id="pkzMic">🎤</div></div>
    <button class="pkz-btn" id="pkzMicFinishBtn" style="display:none;margin:8px auto 0;">✅ Xong</button>
    <div class="pkz-speak-result" id="pkzSpeakResult"></div>
  `;
}

// ============================================================================
// ĐIỀU KHIỂN PHA / KẾT THÚC
// ============================================================================
function updateProgress() {
  el("pkzProgress").textContent = `${roundCursor}/${orderedRounds.length}`;
}

function advanceOrFinish() {
  if (roundCursor >= orderedRounds.length) { finish(); return; }
  spawnTarget(orderedRounds[roundCursor]);
}

function finish() {
  PkmGameLauncher.finishAndReturn("introPresent", results);
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

  // PHA 1: hết mọi round "present" -> PHA 2: hết mọi round "phonicsSpeak"
  const presentRounds = payload.rounds.filter(r => r.type === "present");
  const phonicsRounds = payload.rounds.filter(r => r.type === "phonicsSpeak");
  orderedRounds = [...presentRounds, ...phonicsRounds];
  results = [];

  await new Promise(resolve => { el("pkzStartBtn").onclick = resolve; });
  el("pkzStartOverlay").remove();

  const keywords = [...new Set(payload.rounds.map(r => r.imageKeyword).filter(Boolean))];
  await prefetchImagesBatch(keywords);

  computeCellSize();
  maze = generateMaze(COLS, ROWS);
  player = { x: 0, y: 0 };
  renderMaze();
  attachControls();
  updateProgress();

  spawnTarget(orderedRounds[0]);
}

main();
