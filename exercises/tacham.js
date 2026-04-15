// ==========================================
// 1. CẤU HÌNH DỮ LIỆU
// ==========================================
const soundConfig = {
  // --- NGUYÊN ÂM NGẮN ---
  AE: ["ai", "au", "a", "e"],                 // plaid, laugh, cat, many
  EH: ["ea", "ie", "e", "a"],                 // head, friend, bed, any
  IH: ["ui", "i", "y", "e", "o"],             // build, sit, gym, pretty, women
  AA: ["au", "al", "o", "a"],                 // aunt, calm, hot, father
  AH: ["ou", "oo", "u", "o", "a"],            // young, blood, cup, son, about
  AO: ["ought", "ough", "aw", "au", "al", "oar", "oor"], // thought, bought, saw, cause, ball, board, door
  UH: ["ou", "oo", "u", "o"],                 // could, foot, put, wolf
  UW: ["u-e", "oo", "ew", "ue", "ui", "ou", "oe", "o"], // flute, food, chew, blue, fruit, group, shoe, do

  // --- NGUYÊN ÂM DÀI / DIPHTHONG ---
  EY: ["eigh", "a-e", "ai", "ay", "ea", "ey", "ei", "a"], // eight, cake, rain, day, great, they, vein, baby
  IY: ["e-e", "ee", "ea", "ie", "ei", "ey", "y", "i"],    // scene, see, eat, field, receive, key, happy, police
  AY: ["i-e", "igh", "ie", "y", "i"],         // time, light, pie, sky, kind
  OW: ["ough", "o-e", "oa", "ow", "oe", "o"], // though, home, boat, snow, toe, go
  OY: ["oi", "oy"],                           // coin, boy
  AW: ["ou", "ow"],                           // out, cow

  // --- R-COLORED (Xóa dấu cách ở Key để khớp với cleanS) ---
  ER: ["ear", "er", "ir", "ur", "or"],        // learn, her, bird, turn, word
  AAR: ["ar"],                                // car, star
  AOR: ["ore", "oar", "oor", "or"],           // more, board, door, for
  EHR: ["air", "are", "ear", "ere"],          // air, care, bear, there
  IHR: ["eer", "ear", "ere"],                 // deer, near, here
  UHR: ["ure", "our"],                        // pure, tour
  AYER: ["ire", "yer"],                       // fire, buyer

  // --- PHỤ ÂM ---
  P: ["pp", "p"],                             // happy, pen
  T: ["tt", "ed", "t"],                       // butter, walked, ten
  K: ["ck", "ch", "qu", "k", "c", "q", "x"],  // back, school, quick, kite, cat, queen, box
  F: ["ff", "ph", "gh", "f"],                 // off, phone, laugh, fish
  TH: ["th"],                                 // thin
  DH: ["th"],                                 // this
  S: ["ss", "ps", "ce", "s", "c"], // mess, psychology, face, city, rose, sun, center
  Z: ["zz", "s", "z", "x"],                   // buzz, has, zebra, xylophone
  HH: ["wh", "h"],                            // who, hat
  SH: ["ssi", "sh", "ti", "ci", "ch", "s"],   // mission, ship, nation, special, chef, sugar
  ZH: ["si", "s", "ge"],                      // vision, measure, garage
  CH: ["tch", "ch", "t"],                     // watch, chin, future
  JH: ["ge", "gi", "j", "g", "d"],            // cage, giant, jam, gym, soldier
  B: ["bb", "b"],                             // rabbit, big
  D: ["dd", "ed", "d"],                       // ladder, played, dog
  G: ["gg", "gh", "g"],                       // egg, ghost, go
  V: ["ve", "v", "f"],                        // cave, van, of
  M: ["mm", "mb", "mn", "m"],                 // hammer, comb, hymn, map
  N: ["nn", "kn", "gn", "pn", "n"],           // dinner, know, gnaw, pneumonia, no
  NG: ["ng", "n"],                            // sing, bank
  L: ["ll", "l"],                             // bell, lip
  R: ["rr", "wr", "r"],                       // mirror, write, red
  W: ["wh", "w", "u"],                        // wheel, wet, quick
  Y: ["u", "y", "i"],                              // yes, onion

  // --- SUFFIXES (Các hậu tố đặc biệt) ---
  SHN: ["tion", "sion", "cian"],              // action, extension, musician
  CHER: ["ture"],                             // nature, picture
  ZHER: ["sure"],                             // measure, treasure
  SHL: ["cial", "tial"],                      // social, partial
  AHS: ["ous"],                               // famous, curious
  JH_IH_JH: ["age"]                           // village, cabbage
};

const arpabetToIpa = {
    EY: "eɪ",
    IY: "iː",
    AE: "æ",
    EH: "ɛ",
    IH: "ɪ",
    AA: "ɒ",
    AH: "ʌ",
    AO: "ɔː",
    UW: "uː",
    OW: "oʊ",
    AY: "aɪ",
    AW: "aʊ",
    OY: "ɔɪ",
    ER: "ɜː",
    UH: "ʊ",
    Y_UW: "juː",
    P: "p",
    T: "t",
    K: "k",
    F: "f",
    TH: "θ",
    S: "s",
    HH: "h",
    SH: "ʃ",
    CH: "ʧ",
    B: "b",
    D: "d",
    G: "g",
    V: "v",
    DH: "ð",
    Z: "z",
    ZH: "ʒ",
    JH: "ʤ",
    M: "m",
    N: "n",
    NG: "ŋ",
    L: "l",
    R: "r",
    W: "w",
    Y: "j",
    AX: "ə",
    eə: "eə",
    ɪə: "ɪə",
    ʊə: "ʊə",
    aɪə: "aɪə",
};

const DATA_URL =
    "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/data.txt";
const MP3_BASE_URL =
    "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/";

let dictMap = new Map();

// ==========================================
// 2. CÁC HÀM TIỆN ÍCH
// ==========================================

function findBestPhonics(word, cleanArpabet) {
    const possible = soundConfig[cleanArpabet];
    if (!possible) return cleanArpabet.toLowerCase();

    for (let ph of possible) {
        if (ph.includes("-e")) {
            const letter = ph.split("-")[0];
            const regex = new RegExp(letter + "[a-z]e");
            if (regex.test(word.toLowerCase())) return ph;
        } else if (word.toLowerCase().includes(ph)) {
            return ph;
        }
    }
    return possible[0];
}

function playSound(ipaName) {
    // Ký hiệu IPA có thể chứa các ký tự đặc biệt, đảm bảo file mp3 trên server khớp tên
    const audio = new Audio(`${MP3_BASE_URL}${ipaName}.mp3`);
    audio
        .play()
        .catch((e) =>
            console.warn("Không tìm thấy file âm thanh cho âm:", ipaName),
        );
}

// ==========================================
// 3. KHỞI TẠO VÀ XỬ LÝ SỰ KIỆN
// ==========================================

async function initDictionary() {
    // 1. Lấy các phần tử
    const statusIdx = document.getElementById("status");
    const inputIdx = document.getElementById("wordInput");
    const btnIdx = document.getElementById("btnRun");

    try {
        const response = await fetch(DATA_URL);
        const text = await response.text();
        const lines = text.split("\n");

        lines.forEach((line) => {
            const cleanLine = line.split("#")[0].trim();
            if (!cleanLine) return;
            const parts = cleanLine.split(/\s+/);
            if (parts.length >= 2) {
                let word = parts[0].toLowerCase();
                const sounds = parts.slice(1).join(" ").trim();
                if (!dictMap.has(word)) dictMap.set(word, sounds);
            }
        });

        // 2. CHỈ CẬP NHẬT NẾU PHẦN TỬ TỒN TẠI (Sửa lỗi Null ở đây)
        if (statusIdx) {
            statusIdx.innerHTML = "<b style='color:#28a745'>✅ PokéDict sẵn sàng!</b>";
        }
        if (inputIdx) inputIdx.disabled = false;
        if (btnIdx) btnIdx.disabled = false;

        console.log("✅ PokéDict đã nạp dữ liệu thành công.");

    } catch (err) {
        // Tương tự, kiểm tra trước khi gán innerHTML
        if (statusIdx) {
            statusIdx.innerHTML = "<b style='color:#dc3545'>❌ Lỗi tải dữ liệu!</b>";
        }
        console.error("Lỗi tải từ điển:", err);
    }
}

window.handleSplit = async function(wordIn, areaOut) {
    // 1. HÀM CHIA NHÓM ÂM TIẾT (GIỮ NGUYÊN GỐC)
    function groupSyllables(units) {
        let syllables = [];
        let currentSyllable = [];
        for (let i = 0; i < units.length; i++) {
            let current = units[i];
            let next = units[i + 1];
            let afterNext = units[i + 2];
            currentSyllable.push(current);
            if (current.type === "vowel") {
                let shouldSplit = false;
                if (next) {
                    if (next.type === "consonant" && afterNext && afterNext.type === "consonant") {
                        currentSyllable.push(next); 
                        shouldSplit = true;
                        i++; 
                    } else { shouldSplit = true; }
                }
                let hasMoreVowels = false;
                for (let j = i + 1; j < units.length; j++) {
                    if (units[j].type === "vowel") { hasMoreVowels = true; break; }
                }
                if (shouldSplit && hasMoreVowels) {
                    syllables.push(currentSyllable);
                    currentSyllable = [];
                }
            }
        }
        if (currentSyllable.length > 0) syllables.push(currentSyllable);
        return syllables;
    }

    // 2. CHUẨN BỊ ĐẦU VÀO
    let input = wordIn || document.getElementById("wordInput")?.value?.trim()?.toLowerCase();
    if (!input) return;
    const resultArea = areaOut || document.getElementById("resultArea");
    if (!resultArea) return;

    resultArea.innerHTML = "";
    const words = input.split(/\s+/); // Tách cụm thành từng từ

    // ==========================================
    // VÒNG LẶP XỬ LÝ TỪNG TỪ (THEO YÊU CẦU CỤM TỪ)
    // ==========================================
    for (const word of words) {
        const wordBlock = document.createElement("div");
        wordBlock.className = "word-block";
        // CSS để các từ đứng cạnh nhau, có khoảng cách đẹp
        wordBlock.style.cssText = "display: inline-flex; align-items: flex-start; flex-wrap: wrap; margin-right: 50px; margin-bottom: 30px; border: 1px solid #f0f0f0; padding: 10px; border-radius: 15px; background: #fafafa;";
        resultArea.appendChild(wordBlock);

        const rawSounds = dictMap.get(word);
        if (!rawSounds) {
            wordBlock.innerHTML = `<p style="color:#dc3545; margin: 10px;">"${word}" (?)</p>`;
            continue;
        }

        const soundArray = rawSounds.split(/\s+/);
        const consonants = ["P","T","K","F","TH","S","HH","SH","CH","B","D","G","V","DH","Z","ZH","JH","M","N","NG","L","R","W","Y"];
        let units = new Array(soundArray.length).fill(null);
        let searchWord = word;

        // ==========================================
        // BƯỚC 1 & 2 CẢI TIẾN: RÀ SOÁT TỊNH TIẾN
        // ==========================================
        let lastIndex = 0; // Biến đánh dấu vị trí chữ cái cuối cùng đã xử lý

        soundArray.forEach((sound, index) => {
            let cleanSound = sound.replace(/[0-9]/g, "");
            let isConsonant = consonants.includes(cleanSound);

            // Tìm phạm vi chữ cái có thể thuộc về âm này
            // Không được tìm ngược về trước lastIndex
            let searchRegion = word.substring(lastIndex);
            let found = false;

            if (isConsonant) {
                let configs = soundConfig[cleanSound] || [cleanSound.toLowerCase()];
                let ext = [];
                configs.forEach(c => { ext.push(c); if (c.length === 1) ext.push(c+c); });
                ext.sort((a, b) => b.length - a.length);

                for (let g of ext) {
                    let pos = searchRegion.indexOf(g);
                    // CHỈ CHẤP NHẬN nếu phụ âm này nằm rất gần vị trí hiện tại 
                    // (tránh việc âm Y nhảy xuống cuối từ nhặt chữ y)
                    if (pos !== -1 && pos < 3) { 
                        let actualStart = lastIndex + pos;
                        units[index] = { type: "consonant", text: g, sound: sound, startIndex: actualStart };
                        lastIndex = actualStart + g.length;
                        found = true;
                        break;
                    }
                }
            }

            // Nếu là nguyên âm hoặc phụ âm không tìm thấy bằng config (Bước 2 dự phòng)
            if (!found) {
                // Tìm "neo" tiếp theo là một phụ âm đã biết để giới hạn vùng nhặt chữ
                let nextAnchorPos = word.length;
                for (let j = index + 1; j < soundArray.length; j++) {
                    let nextS = soundArray[j].replace(/[0-9]/g, "");
                    if (consonants.includes(nextS)) {
                        // Thử tìm vị trí phụ âm tiếp theo trong từ
                        let nextConfigs = soundConfig[nextS] || [nextS.toLowerCase()];
                        for (let nc of nextConfigs) {
                            let p = word.indexOf(nc, lastIndex);
                            if (p !== -1) { nextAnchorPos = Math.min(nextAnchorPos, p); break; }
                        }
                        if (nextAnchorPos < word.length) break;
                    }
                }

                // Nhặt toàn bộ chữ cái từ lastIndex đến neo tiếp theo
                let matched = word.substring(lastIndex, nextAnchorPos);

                // Nếu có nhiều hơn 1 nguyên âm liên tiếp mà vùng matched quá dài, 
                // ta chia đôi hoặc nhặt 1 ký tự để dành cho âm sau
                if (matched.length > 1 && index < soundArray.length - 1 && !consonants.includes(soundArray[index+1].replace(/[0-9]/g, ""))) {
                     matched = matched[0]; 
                }

                units[index] = { type: "vowel", text: matched, sound: sound, startIndex: lastIndex };
                lastIndex += matched.length;
            }
        });

        // BƯỚC 3: GỘP ÂM ĐẶC BIỆT (GIỮ NGUYÊN)
        // ==========================================
        // BƯỚC 3: GỘP ÂM ĐẶC BIỆT (PHIÊN BẢN CHÍNH XÁC)
        // ==========================================
        let mergedUnits = [];
        for (let i = 0; i < units.length; i++) {
            let cur = units[i];
            let next = units[i + 1];
            if (!cur) continue;

            let curS = cur.sound.replace(/[0-9]/g, "");
            let nextS = next ? next.sound.replace(/[0-9]/g, "") : "";

            // Gộp Y + UW (/ju:/)
            if (next && curS === "Y" && nextS === "UW") {
                // Kiểm tra xem chữ cái của 2 âm này có bị chồng lấn không
                let combinedText = cur.text;
                if (cur.startIndex !== next.startIndex) {
                    // Nếu là 2 chữ cái khác nhau (ví dụ: e+w trong few) thì mới cộng
                    // Nếu là 1 chữ cái (u trong January) thì giữ nguyên cur.text
                    if (!cur.text.includes(next.text)) {
                        combinedText = cur.text + next.text;
                    }
                }
                mergedUnits.push({ 
                    type: "vowel", 
                    text: combinedText, 
                    sound: "Y_UW", 
                    startIndex: cur.startIndex 
                });
                i++; 
            } 
            // Gộp âm R (ER, AR, OR)
            else if (next && (curS === "AA" || curS === "AO" || curS === "ER") && nextS === "R") {
                mergedUnits.push({ 
                    type: "vowel", 
                    text: cur.text + next.text, 
                    sound: curS + "_R", 
                    startIndex: cur.startIndex 
                });
                i++;
            } 
            // KHÔNG THAY ĐỔI: Giữ nguyên các âm đơn lẻ khác
            else {
                mergedUnits.push(cur);
            }
        }

        // BƯỚC 4: RENDER & NÚT BLENDING (CHÈN VÀO wordBlock)
        // ==========================================
        // BƯỚC 5: XỬ LÝ CHỮ CÂM & SẮP XẾP (LOGIC MỚI)
        // ==========================================

        // 5.1. Xác định các vị trí chữ cái đã được dùng
        let usedPositions = new Set(); // Đổi tên biến để tránh trùng lặp
        mergedUnits.forEach(u => { 
            if (u?.text) {
                for (let i = 0; i < u.text.length; i++) usedPositions.add(u.startIndex + i); 
            }
        });

        // 5.2. Nhặt những chữ cái còn sót lại làm chữ câm
        for (let i = 0; i < word.length; i++) {
            if (!usedPositions.has(i)) {
                mergedUnits.push({ 
                    type: "silent", 
                    text: word[i], 
                    startIndex: i, 
                    sound: "SILENT" 
                });
            }
        }

        // 5.3. SẮP XẾP LẠI TOÀN BỘ TRƯỚC KHI CHIA ÂM TIẾT
        // Đây là bước quan trọng nhất để 'e' đứng đúng chỗ trong "games"
        mergedUnits.sort((a, b) => a.startIndex - b.startIndex);

        // ==========================================
        // BƯỚC 4: RENDER (GIỮ NGUYÊN LOGIC CỦA BẠN)
        // ==========================================
        const syllableGroups = groupSyllables(mergedUnits);
        syllableGroups.forEach((group, groupIndex) => {
            const groupWrapper = document.createElement("div");
            groupWrapper.dataset.index = group[0].startIndex;
            groupWrapper.style.cssText = "display: inline-flex; flex-direction: column; align-items: center; margin: 10px;";

            const syllableContainer = document.createElement("div");
            syllableContainer.style.cssText = "display: flex; border: 1px solid #ddd; padding: 4px; border-radius: 12px; background: #fff;";

            let groupIpaList = [];
            group.forEach((unit) => {
                if (!unit || !unit.text) return;

                const div = document.createElement("div");

                // Kiểm tra nếu là chữ câm thì vẽ kiểu câm
                if (unit.type === "silent") {
                    div.className = "sound-unit silent";
                    div.dataset.index = unit.startIndex;
                    div.style.cssText = "opacity: 0.5; background: #f5f5f5; display: inline-block; margin: 4px; border: 1px solid #eee; border-radius: 12px; text-align: center;";
                    div.innerHTML = `<span style="font-size: 28px; color: #999; font-weight: bold;">${unit.text}</span><small style="display: block;">🔇</small>`;
                } 
                // Nếu không thì chạy logic IPA cũ của bạn
                else {
                    let cleanS = unit.sound.replace(/[0-9]/g, "");
                    let ipa = "";
                    if (unit.sound === "Y_UW") ipa = "juː";
                    else if (unit.sound === "AA_R") ipa = "ɑː";
                    else if (unit.sound === "AO_R") ipa = "ɔː";
                    else if (unit.sound === "ER_R") ipa = "ɜː";
                    else if (cleanS === "IY" && (unit === mergedUnits[mergedUnits.length-1] || word.endsWith("ly"))) ipa = "ɪ";
                    else if (unit.sound.startsWith("AH")) ipa = unit.sound.endsWith("0") ? "ə" : "ʌ";
                    else if (cleanS === "ER") ipa = (unit === mergedUnits[mergedUnits.length-1]) ? "ə" : "ɜː";
                    else if (cleanS === "AA") ipa = "ɒ";
                    else ipa = arpabetToIpa[cleanS] || cleanS.toLowerCase();

                    groupIpaList.push(ipa);
                    div.className = "sound-unit";
                    div.style.background = unit.type === "consonant" ? "#e3f2fd" : "#fff9c4";
                    div.innerHTML = `<span style="font-size: 28px; color: #2a75bb; font-weight: bold;">${unit.text}</span><small style="display: block;">/${ipa}/</small>`;
                    div.onclick = (e) => { e.stopPropagation(); playSound(ipa); };
                }
                syllableContainer.appendChild(div);
            });

            const blendBtn = document.createElement("button");
            blendBtn.innerHTML = "🔊";
            blendBtn.style.cssText = "margin-top: 5px; border: none; background: #f0f0f0; border-radius: 50%; width: 35px; height: 35px; cursor: pointer;";
            blendBtn.onclick = async () => {
                for (const ipa of groupIpaList) {
                    playSound(ipa);
                    await new Promise(res => { setTimeout(res, 500); }); 
                }
            };
            groupWrapper.appendChild(syllableContainer);
            groupWrapper.appendChild(blendBtn);
            wordBlock.appendChild(groupWrapper);

            if (groupIndex < syllableGroups.length - 1) {
                const hyphen = document.createElement("span");
                hyphen.innerText = "-";
                hyphen.style.cssText = "font-size: 30px; color: #ccc; margin-top: 15px;";
                wordBlock.appendChild(hyphen);
            }
        });

        // --- BƯỚC 4.5 CỦA BẠN (Nút đọc từng từ nhỏ gọn bên dưới) ---
        if (!areaOut) {
            const wordFooter = document.createElement("div");
            wordFooter.style.cssText = "width: 100%; text-align: center; margin-top: 10px;";
            const btn = document.createElement("button");
            btn.style.cssText = "padding: 5px 15px; background: #2a75bb; color: white; border: none; border-radius: 20px; cursor: pointer; font-size: 13px;";
            btn.innerHTML = `Đọc: ${word}`;
            btn.onclick = () => {
                const ut = new SpeechSynthesisUtterance(word);
                ut.lang = 'en-GB'; window.speechSynthesis.speak(ut);
            };
            wordFooter.appendChild(btn);
            wordBlock.appendChild(wordFooter);
        }
    }

    // --- BƯỚC 4.5 NÂNG CẤP (Nút đọc cả cụm/câu to đùng ở dưới cùng) ---
    if (!areaOut && words.length > 1) {
        const footer = document.createElement("div");
        footer.style.cssText = "width: 100%; text-align: center; margin-top: 40px; border-top: 2px solid #eee; padding-top: 20px;";
        const btnAll = document.createElement("button");
        btnAll.style.cssText = "padding: 15px 30px; font-size: 18px; background: #28a745; color: white; border: none; border-radius: 30px; cursor: pointer; font-weight: bold;";
        btnAll.innerHTML = `🔊 Đọc cả cụm: ${input}`;
        btnAll.onclick = () => {
            const ut = new SpeechSynthesisUtterance(input);
            ut.lang = 'en-GB'; window.speechSynthesis.speak(ut);
        };
        footer.appendChild(btnAll);
        resultArea.appendChild(footer);
    }
};

// Chạy khởi tạo ngay khi trang load xong
document.addEventListener("DOMContentLoaded", initDictionary);
