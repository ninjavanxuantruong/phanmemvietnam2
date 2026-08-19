/**
 * ==========================================
 * PKM GARDEN — LOGIC VƯỜN CÂY + CHUỒNG TRẠI (bản kho công cụ)
 * ==========================================
 * Yêu cầu: pkm_garden.html PHẢI có sẵn các phần tử/CSS effect tương ứng
 * (xem danh sách #id ở khối "DOM CONTRACT" bên dưới, và các class hiệu
 * ứng .fx-water/.fx-sickle/.fx-sparkle/.fx-bubble sẽ đi kèm trong CSS
 * của HTML — file HTML mình gửi riêng sẽ khớp đúng các id/class này).
 *
 * Cấu trúc file:
 *   1. Hạ tầng chung (Firebase lịch học + sheet từ vựng -> "bài hôm nay")
 *   2. State: đất / chuồng / kho công cụ / tiền
 *   3. Mở khoá đất & chuồng theo số bài đã học
 *   4. Vòng đời cây & Pokémon nuôi (trồng/mua -> chăm sóc -> chín -> thu
 *      hoạch/héo) — dùng công cụ tiêu hao thay vì 1 nút "Chăm sóc" chung
 *   5. Hiệu ứng hình ảnh khi dùng công cụ
 *   6. Render UI: ruộng cây (lưới ô riêng từng cây) + chuồng mở (Pokémon
 *      đi lại tự do) + thanh kho đồ + 2 shop (hạt/con giống dùng DV,
 *      công cụ dùng EXP)
 *   7. Khởi động
 * ==========================================
 *
 * DOM CONTRACT (các #id mà pkm_garden.html cần có sẵn):
 *   #gardenDV #gardenEXP #lessonsLearnedTag      -> thanh trên cùng
 *   #landField                                    -> lưới các ô đất
 *   #barnPen                                      -> khu chuồng mở (Pokémon đi lại)
 *   #addAnimalBtn                                 -> nút (+) thêm Pokémon nuôi trong #barnPen
 *   #toolbar                                      -> 4 nút công cụ (data-tool="water|fertilizer|sickle|brush")
 *   #toolBanner                                   -> banner "Đang cầm: ..."
 *   #shopSeedsModal #shopSeedsTitle #shopSeedsList -> shop hạt/con giống (DV)
 *   #shopToolsModal #shopToolsList                -> shop công cụ (EXP)
 *   #gardenToast                                  -> toast thông báo
 *   #quiz-overlay #quiz-word #quiz-options         -> modal câu hỏi (pkm_quiz.js tự bật/tắt)
 */

const CFG = window.GardenConfig;
const STORAGE_KEY = "pkm_garden_state";

// ===== 1. HẠ TẦNG CHUNG (Firebase lịch học + sheet từ vựng) =====

let _firebaseRefs = null;
async function getFirebaseRefs() {
    if (_firebaseRefs) return _firebaseRefs;
    const { initializeApp } = await import(
        "https://www.gstatic.com/firebasejs/10.5.0/firebase-app.js"
    );
    const { getFirestore, doc, getDoc } = await import(
        "https://www.gstatic.com/firebasejs/10.5.0/firebase-firestore.js"
    );
    const app = initializeApp(CFG.LESSON_FIREBASE_CONFIG, "gardenLessonApp");
    const db = getFirestore(app);
    _firebaseRefs = { db, doc, getDoc };
    return _firebaseRefs;
}

const realTrainerClass = localStorage.getItem("trainerClass") || "1";

function extractCodeFromTitle(title) {
    if (!title || typeof title !== "string") return "";
    const parts = title.trim().split(/[-\s.]+/);
    if (
        parts.length >= 3 &&
        /^\d+$/.test(parts[0]) &&
        /^\d+$/.test(parts[1]) &&
        /^\d+$/.test(parts[2])
    ) {
        return parts[0] + parts[1] + parts[2];
    }
    return "";
}

function rowsToArr(r) {
    return Array.isArray(r) ? r : Object.values(r);
}

let _vocabCache = null;
async function ensureVocabRows() {
    if (_vocabCache) return _vocabCache;
    let rows = [];
    const cachedData = sessionStorage.getItem("allVocabData");
    if (cachedData) {
        rows = JSON.parse(cachedData);
    } else {
        const response = await fetch(window.SHEET_URL);
        const json = await response.json();
        rows = json.data || json;
        sessionStorage.setItem("allVocabData", JSON.stringify(rows));
    }
    const colID = window.COLS_URL?.ID !== undefined ? window.COLS_URL.ID : 1;
    const colWord =
        window.COLS_URL?.WORD !== undefined ? window.COLS_URL.WORD : 2;
    _vocabCache = { rows, colID, colWord };
    return _vocabCache;
}

function buildLessonPreviewByCode(rows, colID, colWord, code) {
    if (!code) return null;
    let fullId = null;
    const words = [];
    const seen = new Set();
    for (const r of rows) {
        const d = rowsToArr(r);
        const unitRaw = d[colID]?.toString().trim();
        if (!unitRaw) continue;
        if (extractCodeFromTitle(unitRaw) !== code) continue;
        if (!fullId) fullId = unitRaw;
        const w = d[colWord];
        if (w && !seen.has(w)) {
            seen.add(w);
            words.push(w);
        }
    }
    if (!fullId) return null;
    const namePart = fullId.includes(" ")
        ? fullId.substring(fullId.indexOf(" ") + 1)
        : "";
    return { fullId, lessonName: namePart.trim() || fullId, words };
}

function getMaxNewLessonCode(lichData) {
    let max = 0;
    Object.values(lichData || {}).forEach((entry) => {
        if (entry && entry.type === "new" && entry.code) {
            const n = parseInt(entry.code, 10);
            if (!isNaN(n) && n > max) max = n;
        }
    });
    return max;
}

function pickPersonalizedFillLesson(rows, colID, colWord, lichData, passedMaps) {
    const maxCode = getMaxNewLessonCode(lichData);
    if (!maxCode) return null;
    const uniqueIds = [
        ...new Set(
            rows
                .map((r) => rowsToArr(r)[colID]?.toString().trim())
                .filter((id) => id && id.startsWith(realTrainerClass + "-")),
        ),
    ];
    const candidates = uniqueIds.filter((id) => {
        const code = extractCodeFromTitle(id);
        const n = parseInt(code, 10);
        return code && !isNaN(n) && n < maxCode && !passedMaps.includes(id);
    });
    const pool =
        candidates.length > 0
            ? candidates
            : uniqueIds.filter((id) => !passedMaps.includes(id));
    if (pool.length === 0) return null;
    const pickedId = pool[Math.floor(Math.random() * pool.length)];
    const namePart = pickedId.includes(" ")
        ? pickedId.substring(pickedId.indexOf(" ") + 1)
        : "";
    const words = rows
        .filter((r) => rowsToArr(r)[colID]?.toString().trim() === pickedId)
        .map((r) => rowsToArr(r)[colWord])
        .filter(Boolean);
    return { fullId: pickedId, lessonName: namePart.trim() || pickedId, words };
}

// Lấy đúng "bài đề xuất hôm nay" (offset 0) như dải 3 ngày trong pkm_map.js,
// rồi gán vào localStorage("current_mission") + sessionStorage("allVocabData")
// để window.QuizManager.prepareData() đọc được y hệt cách các game khác dùng.
async function loadTodayMissionForQuiz() {
    const { rows, colID, colWord } = await ensureVocabRows();
    const iso = new Date().toISOString().split("T")[0];
    const passedMaps = JSON.parse(localStorage.getItem("pkm_passed_maps")) || [];

    let lichData = {};
    try {
        const { db, doc, getDoc } = await getFirebaseRefs();
        const snap = await getDoc(doc(db, "lich", realTrainerClass));
        if (snap.exists()) lichData = snap.data();
    } catch (e) {
        console.warn("⚠️ [Garden] Không tải được lịch học hôm nay:", e);
    }

    const entry = lichData[iso];
    let mission = null;

    if (entry && entry.code) {
        const preview = buildLessonPreviewByCode(rows, colID, colWord, entry.code);
        if (preview) {
            mission = { id: preview.fullId, type: "quest", class: realTrainerClass };
            localStorage.setItem("selected_lesson_name", preview.lessonName);
        }
    }
    if (!mission) {
        const fill = pickPersonalizedFillLesson(
            rows,
            colID,
            colWord,
            lichData,
            passedMaps,
        );
        if (fill) {
            mission = {
                id: fill.fullId,
                type: "quest_fill",
                class: realTrainerClass,
            };
            localStorage.setItem("selected_lesson_name", fill.lessonName);
        }
    }
    if (mission) localStorage.setItem("current_mission", JSON.stringify(mission));
    return !!mission;
}

// ===== 2. STATE: ĐẤT / CHUỒNG / KHO CÔNG CỤ / TIỀN =====

function loadState() {
    let state = { lands: [], barn: [], tools: {} };
    try {
        const raw = JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
        if (raw && Array.isArray(raw.lands) && Array.isArray(raw.barn)) {
            state = raw;
        }
    } catch (e) {
        /* dữ liệu hỏng -> tạo mới */
    }
    // Đảm bảo đủ khoá công cụ mặc định (kể cả state cũ trước khi có kho đồ)
    state.tools = Object.assign(
        Object.fromEntries(Object.keys(CFG.TOOLS).map((k) => [k, 0])),
        state.tools || {},
    );
    return state;
}

function saveState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function getDV() {
    return parseInt(localStorage.getItem("pkm_global_dv")) || 0;
}
function getEXP() {
    return parseInt(localStorage.getItem("pkm_global_exp")) || 0;
}
function addCurrency(dv, exp) {
    if (dv) localStorage.setItem("pkm_global_dv", getDV() + dv);
    if (exp) localStorage.setItem("pkm_global_exp", getEXP() + exp);
}
function spendCurrency(dv, exp) {
    if (getDV() < dv || getEXP() < exp) return false;
    addCurrency(-dv, -exp);
    return true;
}

function getLessonsLearnedCount() {
    const passed = JSON.parse(localStorage.getItem("pkm_passed_maps")) || [];
    return passed.length;
}

// ===== 3. MỞ KHOÁ ĐẤT / CHUỒNG =====

function getUnlockedSlotCount(lessonsLearned) {
    let count = 0;
    for (const threshold of CFG.UNLOCK_THRESHOLDS) {
        if (lessonsLearned >= threshold) count++;
        else break;
    }
    return Math.max(1, count);
}

function lessonsNeededForNextSlot(lessonsLearned) {
    const next = CFG.UNLOCK_THRESHOLDS.find((t) => t > lessonsLearned);
    return next === undefined ? null : next - lessonsLearned;
}

// ===== 4. VÒNG ĐỜI CÂY / POKÉMON NUÔI =====

function findTier(kind, id) {
    const list = kind === "plant" ? CFG.PLANT_TIERS : CFG.ANIMAL_TIERS;
    return list.find((t) => t.id === id) || null;
}
function tierGrowMs(tier) {
    return tier.days * 24 * 60 * 60 * 1000;
}

// "empty" | "growing" | "ready" | "wilted"
function computePlotStatus(plot, kind) {
    if (!plot || !plot.tierId) return "empty";
    if (plot.wilted) return "wilted";
    const tier = findTier(kind, plot.tierId);
    if (!tier) return "empty";
    const matureAt = plot.plantedAt + tierGrowMs(tier);
    const now = Date.now();
    if (now < matureAt) return "growing";
    if (now - matureAt > CFG.WILT_GRACE_MS) return "wilted";
    return "ready";
}

function refreshWiltStatus(state) {
    let changed = false;
    ["lands", "barn"].forEach((key) => {
        const kind = key === "lands" ? "plant" : "animal";
        state[key].forEach((plot) => {
            if (plot && plot.tierId && !plot.wilted) {
                if (computePlotStatus(plot, kind) === "wilted") {
                    plot.wilted = true;
                    changed = true;
                }
            }
        });
    });
    if (changed) saveState(state);
    return state;
}

function buyAndPlant(state, key, idx, tierId) {
    const kind = key === "lands" ? "plant" : "animal";
    const tier = findTier(kind, tierId);
    if (!tier) return { ok: false, msg: "Không tìm thấy loại này." };
    const cost = kind === "plant" ? tier.seedCostDV : tier.priceDV;
    if (!spendCurrency(cost, 0)) return { ok: false, msg: `Không đủ ${cost} Danh Vọng.` };
    state[key][idx] = { tierId, plantedAt: Date.now(), careCount: 0, wilted: false };
    saveState(state);
    return { ok: true };
}

function clearWiltedPlot(state, key, idx) {
    state[key][idx] = null;
    saveState(state);
}

// Dùng CÔNG CỤ CHĂM SÓC (nước/phân bón cho cây, chà tắm cho Pokémon nuôi).
// Luôn mở câu hỏi từ vựng "bài hôm nay" trước — đúng/sai không ảnh hưởng.
async function useCareTool(state, key, idx, toolId, onDone) {
    const kind = key === "lands" ? "plant" : "animal";
    const plot = state[key][idx];
    if (!plot || !plot.tierId) return onDone(false, "Ô này trống, không có gì để chăm.");
    const status = computePlotStatus(plot, kind);
    if (status === "empty" || status === "wilted") {
        return onDone(false, status === "wilted" ? "Đã héo rũ rồi 😢" : "Ô này trống.");
    }
    if (state.tools[toolId] <= 0) {
        return onDone(false, `Bạn đã hết ${CFG.TOOLS[toolId].name}, ghé shop mua thêm nhé.`);
    }

    const finishCare = () => {
        state.tools[toolId]--;
        plot.careCount = (plot.careCount || 0) + 1;
        saveState(state);
        onDone(true, null, toolId);
    };

    const runQuizThenCare = () => {
        let settled = false;
        const finish = () => {
            if (settled) return;
            settled = true;
            finishCare();
        };
        if (window.QuizManager) {
            // Phòng khi không tải được câu hỏi (lỗi dữ liệu) khiến nút bị
            // treo mãi — sau 90s không phản hồi thì vẫn cho chăm sóc.
            setTimeout(finish, 90000);
            window.QuizManager.ask(() => finish());
        } else {
            finish();
        }
    };

    try {
        const hasMission = await loadTodayMissionForQuiz();
        if (hasMission && window.QuizManager) {
            const ready = await window.QuizManager.prepareData();
            if (ready) {
                window.QuizManager.loadLevel();
                window.QuizManager.initSkillPools();
            }
        }
    } catch (e) {
        console.warn("⚠️ [Garden] Không chuẩn bị được câu hỏi hôm nay:", e);
    }
    runQuizThenCare();
}

// Thu hoạch CÂY: bắt buộc cầm Liềm Cắt (tốn 1 liềm).
function harvestPlant(state, idx) {
    const plot = state.lands[idx];
    if (!plot || !plot.tierId) return { ok: false, msg: "Ô này trống." };
    const status = computePlotStatus(plot, "plant");
    if (status === "wilted") {
        state.lands[idx] = null;
        saveState(state);
        return { ok: false, msg: "Đã héo rũ, mất trắng rồi 😢" };
    }
    if (status !== "ready") return { ok: false, msg: "Cây chưa chín, chờ thêm nhé." };
    if (!plot.careCount) return { ok: false, msg: "Cần chăm sóc ít nhất 1 lần trước khi cắt." };
    if (state.tools.sickle <= 0) return { ok: false, msg: "Bạn hết Liềm Cắt rồi, ghé shop mua thêm." };
    const tier = findTier("plant", plot.tierId);
    state.tools.sickle--;
    addCurrency(tier.harvestDV, tier.harvestEXP);
    state.lands[idx] = null;
    saveState(state);
    return { ok: true, tier };
}

// Thu hoạch POKÉMON NUÔI: không cần công cụ, chạm trực tiếp khi đã đủ ngày.
function harvestAnimal(state, idx) {
    const plot = state.barn[idx];
    if (!plot || !plot.tierId) return { ok: false, msg: "Chuồng này trống." };
    const status = computePlotStatus(plot, "animal");
    if (status === "wilted") {
        state.barn[idx] = null;
        saveState(state);
        return { ok: false, msg: "Pokémon đã bỏ đi vì bị bỏ bê 😢" };
    }
    if (status !== "ready") return { ok: false, msg: "Chưa đến ngày thu hoạch." };
    if (!plot.careCount) return { ok: false, msg: "Cần chăm sóc (chà tắm) ít nhất 1 lần trước." };
    const tier = findTier("animal", plot.tierId);
    addCurrency(tier.harvestDV, tier.harvestEXP);
    state.barn[idx] = null;
    saveState(state);
    return { ok: true, tier };
}

// ===== 5. HIỆU ỨNG HÌNH ẢNH =====
// targetEl: phần tử sprite (cây / Pokémon) vừa được tác động, cần
// position:relative (hoặc absolute) sẵn trong CSS của HTML.
const EFFECT_PARTICLES = {
    water: { cls: "fx-water", particle: "💧", count: 6 },
    fertilizer: { cls: "fx-sparkle", particle: "✨", count: 6 },
    brush: { cls: "fx-bubble", particle: "🫧", count: 6 },
    sickle: { cls: "fx-sickle", particle: "💥", count: 1 },
};
function playEffect(targetEl, toolId) {
    if (!targetEl) return;
    const spec = EFFECT_PARTICLES[toolId];
    if (!spec) return;
    const wrap = document.createElement("div");
    wrap.className = `fx-layer ${spec.cls}`;
    for (let i = 0; i < spec.count; i++) {
        const p = document.createElement("span");
        p.className = "fx-particle";
        p.textContent = spec.particle;
        p.style.left = 10 + Math.random() * 80 + "%";
        p.style.animationDelay = Math.random() * 0.25 + "s";
        wrap.appendChild(p);
    }
    targetEl.appendChild(wrap);
    setTimeout(() => wrap.remove(), 1100);
}

// ===== 6. RENDER UI =====

let gameState = loadState();
let selectedTool = null; // 'water' | 'fertilizer' | 'sickle' | 'brush' | null
const barnSpriteEls = {}; // idx -> DOM element (giữ lại để không giật hình khi render lại)
const barnWanderTimers = {}; // idx -> intervalId

function fmtNum(n) {
    return Number.isInteger(n) ? n : n.toFixed(1);
}

function updateTopBar() {
    document.getElementById("gardenDV").textContent = fmtNum(getDV());
    document.getElementById("gardenEXP").textContent = fmtNum(getEXP());
    const lessons = getLessonsLearnedCount();
    document.getElementById("lessonsLearnedTag").textContent = `📘 Đã học ${lessons} bài`;
}

function updateToolbar() {
    Object.keys(CFG.TOOLS).forEach((toolId) => {
        const btn = document.querySelector(`#toolbar [data-tool="${toolId}"]`);
        if (!btn) return;
        btn.querySelector(".tool-count").textContent = gameState.tools[toolId];
        btn.classList.toggle("selected", selectedTool === toolId);
    });
    const banner = document.getElementById("toolBanner");
    if (selectedTool) {
        const t = CFG.TOOLS[selectedTool];
        banner.style.display = "flex";
        banner.innerHTML = `Đang cầm: ${t.emoji} <b>${t.name}</b> — chạm vào mục tiêu để dùng <button id="cancelToolBtn">✕</button>`;
        document.getElementById("cancelToolBtn").onclick = () => {
            selectedTool = null;
            updateToolbar();
        };
    } else {
        banner.style.display = "none";
        banner.innerHTML = "";
    }
}

function selectTool(toolId) {
    selectedTool = selectedTool === toolId ? null : toolId;
    updateToolbar();
}
window.selectTool = selectTool;

function timeLeftLabel(plot, kind) {
    const tier = findTier(kind, plot.tierId);
    const matureAt = plot.plantedAt + tierGrowMs(tier);
    const now = Date.now();
    if (now < matureAt) {
        const ms = matureAt - now;
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        return `⏳ ${h}g ${m}p`;
    }
    const deadline = matureAt + CFG.WILT_GRACE_MS;
    const ms = deadline - now;
    const h = Math.max(0, Math.floor(ms / 3600000));
    const m = Math.max(0, Math.floor((ms % 3600000) / 60000));
    return `✅ Sẵn sàng (héo sau ${h}g ${m}p)`;
}

// ---- Ruộng cây: mỗi cây 1 ô riêng ----
function renderLandField() {
    const container = document.getElementById("landField");
    if (!container) return;
    container.innerHTML = "";
    const lessons = getLessonsLearnedCount();
    const unlocked = getUnlockedSlotCount(lessons);
    const total = CFG.UNLOCK_THRESHOLDS.length;

    for (let i = 0; i < total; i++) {
        const cell = document.createElement("div");
        cell.className = "land-plot";

        if (i >= unlocked) {
            const needed = lessonsNeededForNextSlot(lessons);
            cell.classList.add("locked");
            cell.innerHTML = `<div class="plot-lock">🔒</div><div class="plot-lock-text">Học thêm ${needed ?? "?"} bài</div>`;
            container.appendChild(cell);
            continue;
        }

        const plot = gameState.lands[i] || null;
        const status = plot ? computePlotStatus(plot, "plant") : "empty";

        if (status === "empty") {
            cell.classList.add("empty");
            cell.innerHTML = `<div class="plot-plus">＋</div>`;
            cell.onclick = () => openSeedShop("lands", i);
            container.appendChild(cell);
            continue;
        }

        if (status === "wilted") {
            cell.classList.add("wilted");
            const tier = findTier("plant", plot.tierId);
            cell.innerHTML = `
                <div class="plot-sprite">🥀</div>
                <div class="plot-name">${tier ? tier.name : ""}</div>
                <div class="plot-status">Đã héo</div>
                <button class="plot-clear-btn">Dọn đất</button>`;
            cell.querySelector(".plot-clear-btn").onclick = (e) => {
                e.stopPropagation();
                clearWiltedPlot(gameState, "lands", i);
                renderLandField();
            };
            container.appendChild(cell);
            continue;
        }

        const tier = findTier("plant", plot.tierId);
        cell.classList.add(status);
        cell.innerHTML = `
            <div class="plot-sprite">${status === "ready" ? tier.emoji : tier.growEmoji}</div>
            <div class="plot-name">${tier.name}</div>
            <div class="plot-status">${timeLeftLabel(plot, "plant")}</div>
            <div class="plot-care">🩺 x${plot.careCount || 0}</div>`;
        cell.onclick = () => handlePlantTap(i, cell.querySelector(".plot-sprite"));
        container.appendChild(cell);
    }
}

function handlePlantTap(idx, spriteEl) {
    if (!selectedTool) return showToast("Hãy chọn công cụ ở kho đồ trước đã.");
    const tool = CFG.TOOLS[selectedTool];

    if (tool.use === "harvest") {
        const r = harvestPlant(gameState, idx);
        if (r.ok) {
            playEffect(spriteEl, "sickle");
            showToast(`🎉 Thu hoạch ${r.tier.name}! +${fmtNum(r.tier.harvestDV)} DV +${fmtNum(r.tier.harvestEXP)} KN`);
        } else showToast(r.msg);
        updateToolbar();
        renderLandField();
        return;
    }

    if (tool.use !== "plant_care") return showToast(`${tool.name} không dùng cho cây được.`);
    useCareTool(gameState, "lands", idx, selectedTool, (ok, msg, toolId) => {
        if (ok) playEffect(spriteEl, toolId);
        else if (msg) showToast(msg);
        updateToolbar();
        renderLandField();
    });
}

// ---- Chuồng mở: Pokémon đi lại tự do trong khu ----
function renderBarnPen() {
    const pen = document.getElementById("barnPen");
    if (!pen) return;
    const lessons = getLessonsLearnedCount();
    const unlocked = getUnlockedSlotCount(lessons);

    // Dọn sprite của các ô đã trống / khoá
    Object.keys(barnSpriteEls).forEach((key) => {
        const i = Number(key);
        const plot = gameState.barn[i];
        const stillValid = i < unlocked && plot && plot.tierId && !plot.wilted;
        if (!stillValid) {
            clearInterval(barnWanderTimers[i]);
            delete barnWanderTimers[i];
            barnSpriteEls[key].remove();
            delete barnSpriteEls[key];
        }
    });

    for (let i = 0; i < unlocked; i++) {
        const plot = gameState.barn[i];
        if (!plot || !plot.tierId) continue;
        const status = computePlotStatus(plot, "animal");
        const tier = findTier("animal", plot.tierId);

        if (status === "wilted") {
            if (barnSpriteEls[i]) {
                clearInterval(barnWanderTimers[i]);
                delete barnWanderTimers[i];
                barnSpriteEls[i].remove();
                delete barnSpriteEls[i];
            }
            continue; // hiện thông báo héo ở badge chuồng chung, xử lý ở updateBarnEmptyHint
        }

        let el = barnSpriteEls[i];
        if (!el) {
            el = document.createElement("div");
            el.className = "barn-sprite";
            el.style.left = 10 + Math.random() * 70 + "%";
            el.style.top = 15 + Math.random() * 60 + "%";
            el.innerHTML = `
                <img src="${CFG.POKEMON_ANI_URL(tier.pokemon)}" alt="${tier.name}">
                <div class="barn-badge"></div>
                <div class="barn-name">${tier.name}</div>`;
            pen.appendChild(el);
            barnSpriteEls[i] = el;
            startWander(el, i);
            el.onclick = () => handleAnimalTap(i, el.querySelector("img"));
        }
        el.querySelector(".barn-badge").textContent = status === "ready" ? "✨" : "💤";
        el.querySelector(".barn-name").textContent = `${tier.name} · ${status === "ready" ? "Sẵn sàng" : timeLeftLabel(plot, "animal")}`;
    }

    updateBarnEmptyHint(unlocked);
}

function updateBarnEmptyHint(unlocked) {
    const pen = document.getElementById("barnPen");
    let hint = document.getElementById("barnEmptyHint");
    const hasAnyAnimal = gameState.barn.some((p) => p && p.tierId);
    const hasWilted = gameState.barn.some((p) => p && p.wilted);
    if (!hasAnyAnimal && !hasWilted) {
        if (!hint) {
            hint = document.createElement("div");
            hint.id = "barnEmptyHint";
            hint.className = "barn-empty-hint";
            hint.textContent = "Chuồng đang trống — bấm (+) để nuôi Pokémon nào!";
            pen.appendChild(hint);
        }
    } else if (hint) {
        hint.remove();
    }
    if (hasWilted) {
        showToast("Có Pokémon bị bỏ bê quá lâu và bỏ đi mất rồi 😢 Bấm (+) để nuôi bé mới.");
        gameState.barn = gameState.barn.map((p) => (p && p.wilted ? null : p));
        saveState(gameState);
    }
}

function startWander(el, idx) {
    const pen = document.getElementById("barnPen");
    const move = () => {
        if (!pen.contains(el)) return;
        const nx = 6 + Math.random() * 80;
        const ny = 12 + Math.random() * 68;
        const curX = parseFloat(el.style.left);
        const img = el.querySelector("img");
        if (img) img.style.transform = nx < curX ? "scaleX(-1)" : "scaleX(1)";
        el.style.transition = "left 2.6s ease-in-out, top 2.6s ease-in-out";
        el.style.left = nx + "%";
        el.style.top = ny + "%";
    };
    move();
    barnWanderTimers[idx] = setInterval(move, 3400);
}

function handleAnimalTap(idx, imgEl) {
    if (!selectedTool) {
        // Không cầm công cụ -> vẫn cho phép thử thu hoạch trực tiếp (không cần công cụ)
        const r = harvestAnimal(gameState, idx);
        if (r.ok) {
            showToast(`🎉 Thu hoạch ${r.tier.name}! +${fmtNum(r.tier.harvestDV)} DV +${fmtNum(r.tier.harvestEXP)} KN`);
            renderBarnPen();
        } else if (r.msg !== "Chưa đến ngày thu hoạch.") {
            showToast(r.msg);
        } else {
            showToast("Chưa đến ngày thu hoạch. Chọn 🧽 Chà Tắm để chăm sóc trong lúc chờ nhé.");
        }
        return;
    }
    const tool = CFG.TOOLS[selectedTool];
    if (tool.use !== "animal_care") return showToast(`${tool.name} không dùng cho Pokémon nuôi được.`);
    useCareTool(gameState, "barn", idx, selectedTool, (ok, msg, toolId) => {
        if (ok) playEffect(imgEl.closest(".barn-sprite"), toolId);
        else if (msg) showToast(msg);
        updateToolbar();
        renderBarnPen();
    });
}

function addAnimalClicked() {
    const lessons = getLessonsLearnedCount();
    const unlocked = getUnlockedSlotCount(lessons);
    const freeIdx = gameState.barn.findIndex(
        (p, i) => i < unlocked && (!p || !p.tierId),
    );
    if (freeIdx === -1) {
        const needed = lessonsNeededForNextSlot(lessons);
        return showToast(
            needed
                ? `Chuồng đã đầy hết! Học thêm ${needed} bài để mở chuồng mới.`
                : "Chuồng đã đầy hết rồi!",
        );
    }
    openSeedShop("barn", freeIdx);
}

// ---- Shop hạt giống / con giống (DV) ----
function openSeedShop(key, idx) {
    const kind = key === "lands" ? "plant" : "animal";
    const tiers = kind === "plant" ? CFG.PLANT_TIERS : CFG.ANIMAL_TIERS;
    const modal = document.getElementById("shopSeedsModal");
    const list = document.getElementById("shopSeedsList");
    document.getElementById("shopSeedsTitle").textContent =
        kind === "plant" ? "🌱 Chọn hạt giống" : "🐣 Chọn Pokémon để nuôi";
    list.innerHTML = "";

    tiers.forEach((tier) => {
        const cost = kind === "plant" ? tier.seedCostDV : tier.priceDV;
        const item = document.createElement("div");
        item.className = "shop-item";
        const thumb =
            kind === "plant"
                ? `<div class="shop-item-emoji">${tier.emoji}</div>`
                : `<img class="shop-item-emoji shop-item-img" src="${CFG.POKEMON_ANI_URL(tier.pokemon)}" alt="${tier.name}">`;
        item.innerHTML = `
            ${thumb}
            <div class="shop-item-info">
                <div class="shop-item-name">${tier.name}</div>
                <div class="shop-item-sub">${tier.days} ngày · Thu ${fmtNum(tier.harvestDV)} DV + ${fmtNum(tier.harvestEXP)} KN</div>
            </div>
            <button class="shop-buy-btn">${fmtNum(cost)} DV</button>`;
        item.querySelector(".shop-buy-btn").onclick = () => {
            const r = buyAndPlant(gameState, key, idx, tier.id);
            if (r.ok) {
                closeSeedShop();
                renderAll();
            } else showToast(r.msg);
        };
        list.appendChild(item);
    });
    modal.style.display = "flex";
}
function closeSeedShop() {
    document.getElementById("shopSeedsModal").style.display = "none";
}
window.closeSeedShop = closeSeedShop;

// ---- Shop công cụ (EXP) ----
function openToolShop() {
    const list = document.getElementById("shopToolsList");
    list.innerHTML = "";
    Object.values(CFG.TOOLS).forEach((tool) => {
        const item = document.createElement("div");
        item.className = "shop-item";
        item.innerHTML = `
            <div class="shop-item-emoji">${tool.emoji}</div>
            <div class="shop-item-info">
                <div class="shop-item-name">${tool.name}</div>
                <div class="shop-item-sub">Đang có: ${gameState.tools[tool.id]} · ${tool.costEXP} KN / cái</div>
            </div>
            <div class="qty-buy">
                <button class="qty-btn" data-d="-1">−</button>
                <span class="qty-val">1</span>
                <button class="qty-btn" data-d="1">+</button>
                <button class="shop-buy-btn">Mua</button>
            </div>`;
        const qtyEl = item.querySelector(".qty-val");
        let qty = 1;
        item.querySelectorAll(".qty-btn").forEach((btn) => {
            btn.onclick = () => {
                qty = Math.max(1, qty + Number(btn.dataset.d));
                qtyEl.textContent = qty;
            };
        });
        item.querySelector(".shop-buy-btn").onclick = () => {
            const totalCost = tool.costEXP * qty;
            if (!spendCurrency(0, totalCost)) return showToast(`Không đủ ${totalCost} KN.`);
            gameState.tools[tool.id] += qty;
            saveState(gameState);
            showToast(`Đã mua ${qty} ${tool.name}!`);
            openToolShop(); // vẽ lại số lượng đang có
            updateTopBar();
            updateToolbar();
        };
        list.appendChild(item);
    });
    document.getElementById("shopToolsModal").style.display = "flex";
}
window.openToolShop = openToolShop;
function closeToolShop() {
    document.getElementById("shopToolsModal").style.display = "none";
}
window.closeToolShop = closeToolShop;

// ---- Toast ----
let _toastTimer = null;
function showToast(text) {
    const toast = document.getElementById("gardenToast");
    if (!toast) return;
    toast.textContent = text;
    toast.classList.add("show");
    clearTimeout(_toastTimer);
    _toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
}

function renderAll() {
    gameState = refreshWiltStatus(gameState);
    updateTopBar();
    updateToolbar();
    renderLandField();
    renderBarnPen();
}

// ===== 7. KHỞI ĐỘNG =====

function initGarden() {
    const total = CFG.UNLOCK_THRESHOLDS.length;
    while (gameState.lands.length < total) gameState.lands.push(null);
    while (gameState.barn.length < total) gameState.barn.push(null);
    saveState(gameState);

    if (window.QuizManager) window.QuizManager.prepareData();

    Object.keys(CFG.TOOLS).forEach((toolId) => {
        const btn = document.querySelector(`#toolbar [data-tool="${toolId}"]`);
        if (btn) btn.onclick = () => selectTool(toolId);
    });
    const addBtn = document.getElementById("addAnimalBtn");
    if (addBtn) addBtn.onclick = addAnimalClicked;

    renderAll();
    // Cập nhật đếm ngược mỗi phút (không recreate sprite Pokémon đang đi lại)
    setInterval(renderAll, 60 * 1000);
}

document.addEventListener("DOMContentLoaded", initGarden);
