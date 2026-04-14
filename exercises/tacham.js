// ==========================================
// 1. CẤU HÌNH DỮ LIỆU
// ==========================================
const soundConfig = {
    AE: ["a"],
    EH: ["e", "ea"],
    IH: ["i", "y"],
    AA: ["o", "a"],
    AH: ["u", "o", "a"],
    "AA R": ["ar"],
    "AO R": ["or"],
    ER: ["ir", "ur", "er"],
    EY: ["ai", "ay", "a-e", "ey", "a"],
    IY: ["ee", "ea", "e-e", "ey", "ie", "e"],
    AY: ["i-e", "ie", "igh", "y", "i"],
    OW: ["o-e", "oa", "ow", "o"],
    UW: ["u-e", "ew", "ue", "ui", "oo", "u"],
    UH: ["u", "oo"],
    "EH R": ["air", "are"],
    "IH R": ["ear", "eer", "ere"],
    "UH R": ["ure", "our"],
    AO: ["aw", "au", "al"],
    "AY ER": ["ire"],
    P: ["p"],
    T: ["t"],
    K: ["k", "c", "ck"],
    F: ["f", "ph"],
    TH: ["th"],
    S: ["s", "ce"],
    HH: ["h"],
    SH: ["sh"],
    CH: ["ch"],
    B: ["b"],
    D: ["d"],
    G: ["g"],
    V: ["v"],
    DH: ["TH"],
    Z: ["z", "s"],
    ZH: ["zh"],
    JH: ["j", "ge"],
    M: ["m", "mb"],
    N: ["n", "kn", "gn"],
    NG: ["ng"],
    L: ["l"],
    R: ["r", "wr"],
    W: ["w", "wh"],
    Y: ["y"],
    "SH N": ["tion", "sion", "cian"],
    "CH ER": ["ture"],
    "ZH ER": ["sure"],
    "SH L": ["cial", "tial"],
    "AH S": ["ous"],
    "JH IH JH": ["age"],
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

        statusIdx.innerHTML =
            "<b style='color:#28a745'>✅ PokéDict sẵn sàng!</b>";
        inputIdx.disabled = false;
        btnIdx.disabled = false;
    } catch (err) {
        statusIdx.innerHTML =
            "<b style='color:#dc3545'>❌ Lỗi tải dữ liệu. Kiểm tra kết nối!</b>";
        console.error(err);
    }
}

window.handleSplit = async function(wordIn, areaOut) {
    function groupSyllables(units) {
        let syllables = [];
        let currentSyllable = [];

        for (let i = 0; i < units.length; i++) {
            let current = units[i];
            let next = units[i + 1];
            let afterNext = units[i + 2];

            currentSyllable.push(current);

            // Kiểm tra xem đây có phải là nguyên âm không
            if (current.type === "vowel") {
                let shouldSplit = false;

                if (next) {
                    // QUY TẮC 2: Chia đôi phụ âm (VC-CV)
                    // Nếu sau nguyên âm là 2 phụ âm trở lên (như 'ns' trong 'insect')
                    if (next.type === "consonant" && afterNext && afterNext.type === "consonant") {
                        currentSyllable.push(next); // Lôi 1 phụ âm về phần này
                        shouldSplit = true;
                        i++; // Nhảy qua phụ âm đã lôi
                    } 
                    // QUY TẮC 1: Ngắt sau nguyên âm (V-CV)
                    else {
                        shouldSplit = true;
                    }
                }

                // KIỂM TRA ĐẶC BIỆT: Nếu phía sau không còn nguyên âm nào nữa 
                // thì đây là âm tiết cuối, không được ngắt (để nó ôm nốt phụ âm cuối)
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
    //phần còn lại
    const wordInput = document.getElementById("wordInput");
    const resultArea = document.getElementById("resultArea");
    let word = wordInput.value.trim().toLowerCase();
    if (!word) return;
    resultArea.innerHTML = "";

    const rawSounds = dictMap.get(word);
    if (!rawSounds) {
        resultArea.innerHTML = `<p style="color:#dc3545; width:100%">Không tìm thấy từ "${word}"!</p>`;
        return;
    }

    const soundArray = rawSounds.split(/\s+/);
    const consonants = ["P","T","K","F","TH","S","HH","SH","CH","B","D","G","V","DH","Z","ZH","JH","M","N","NG","L","R","W","Y"];

    let units = new Array(soundArray.length).fill(null);
    let searchWord = word;

    // --- BƯỚC 1: RÀ VÀ CHỐT PHỤ ÂM (Giữ nguyên logic cũ) ---
    soundArray.forEach((sound, index) => {
        let cleanSound = sound.replace(/[0-9]/g, "");
        if (consonants.includes(cleanSound)) {
            let configs = soundConfig[cleanSound] || [cleanSound.toLowerCase()];
            let extendedConfigs = [];
            configs.forEach(c => {
                extendedConfigs.push(c);
                if (c.length === 1) extendedConfigs.push(c + c); 
            });
            extendedConfigs.sort((a, b) => b.length - a.length);

            for (let g of extendedConfigs) {
                let pos = searchWord.indexOf(g);
                if (pos !== -1) {
                    let actualStart = word.length - searchWord.length + pos;
                    units[index] = { type: "consonant", text: g, sound: sound, startIndex: actualStart };
                    let head = searchWord.substring(0, pos);
                    let tail = searchWord.substring(pos + g.length);
                    searchWord = head + " ".repeat(g.length) + tail;
                    break;
                }
            }
        }
    });

    // --- BƯỚC 2: ĐIỀN NGUYÊN ÂM (Giữ nguyên logic cũ) ---
    soundArray.forEach((sound, index) => {
        if (units[index]) return; 
        let currentStart = 0;
        for (let i = 0; i < index; i++) {
            if (units[i]) currentStart = units[i].startIndex + units[i].text.length;
        }
        let nextAnchor = units.find((u, i) => i > index && u);
        let currentEnd = nextAnchor ? nextAnchor.startIndex : word.length;
        let matchedLetters = word.substring(currentStart, currentEnd);

        if (index === soundArray.length - 1 && matchedLetters.endsWith('e') && matchedLetters.length > 1) {
            matchedLetters = matchedLetters.slice(0, -1);
        }

        units[index] = { type: "vowel", text: matchedLetters, sound: sound, startIndex: currentStart };
    });

    // --- BƯỚC 3: GỘP ÂM ĐẶC BIỆT (Xử lý cưỡng bức ar, or, ju:) ---
    let mergedUnits = [];
    for (let i = 0; i < units.length; i++) {
        let current = units[i];
        let next = units[i + 1];

        if (!current) continue;

        let curSound = current.sound.replace(/[0-9]/g, "");
        let nextSound = next ? next.sound.replace(/[0-9]/g, "") : "";

        // 1. Xử lý ju: (Y + UW)
        if (next && curSound === "Y" && nextSound === "UW") {
            mergedUnits.push({
                type: "vowel",
                text: current.text + next.text, // Lấy cả chữ ở ô Y và ô UW (thường là 'u')
                sound: "Y_UW",
                startIndex: current.startIndex
            });
            i++; 
        } 
        // 2. Xử lý vần R đặc thù (AA + R -> ar, AO + R -> or)
        else if (next && (curSound === "AA" || curSound === "AO" || curSound === "ER") && nextSound === "R") {
            mergedUnits.push({
                type: "vowel",
                text: current.text + next.text, // Ép chữ 'a' và 'r' vào chung một ô
                sound: curSound + "_R",        // Đánh dấu để Render IPA dài
                startIndex: current.startIndex
            });
            i++; // Bỏ qua ô R vì đã bị "nuốt" vào ô trước
        }
        else {
            mergedUnits.push(current);
        }
    }

    // --- BƯỚC 3.5: CHIA NHÓM ÂM TIẾT ---
    const syllableGroups = groupSyllables(mergedUnits);

    // --- BƯỚC 4: RENDER THEO NHÓM + NÚT BLENDING (Xử lý âm nối tiếp) ---
    syllableGroups.forEach((group, groupIndex) => {
        const groupWrapper = document.createElement("div");
        groupWrapper.style.cssText = "display: inline-flex; flex-direction: column; align-items: center; margin: 10px;";

        const syllableContainer = document.createElement("div");
        syllableContainer.style.cssText = "display: flex; border: 1px solid #ddd; padding: 4px; border-radius: 12px; background: #fff; box-shadow: 0 2px 4px rgba(0,0,0,0.05);";

        // Mảng chứa các ký hiệu IPA riêng lẻ để đọc nối tiếp
        let groupIpaList = []; 

        group.forEach((unit) => {
            if (!unit || !unit.text) return;

            let cleanSound = unit.sound.replace(/[0-9]/g, "");
            let ipa = "";

            if (unit.sound === "Y_UW") { ipa = "juː"; }
            else if (unit.sound === "AA_R") { ipa = "ɑː"; }
            else if (unit.sound === "AO_R") { ipa = "ɔː"; }
            else if (unit.sound === "ER_R") { ipa = "ɜː"; }
            else if (cleanSound === "IY" && (unit === mergedUnits[mergedUnits.length-1] || word.endsWith("ly"))) { ipa = "i"; }
            else if (unit.sound.startsWith("AH")) { ipa = unit.sound.endsWith("0") ? "ə" : "ʌ"; }
            else if (cleanSound === "ER") { ipa = (unit === mergedUnits[mergedUnits.length-1]) ? "ə" : "ɜː"; }
            else if (cleanSound === "AA") { ipa = "ɒ"; }
            else { ipa = arpabetToIpa[cleanSound] || cleanSound.toLowerCase(); }

            groupIpaList.push(ipa); 

            const div = document.createElement("div");
            div.className = "sound-unit";
            div.style.background = unit.type === "consonant" ? "#e3f2fd" : "#fff9c4";
            div.innerHTML = `<span style="font-size: 28px; color: #2a75bb; font-weight: bold;">${unit.text}</span><small style="display: block;">/${ipa}/</small>`;

            // Ấn vào từng âm vẫn đọc file lẻ như cũ
            div.onclick = (e) => { e.stopPropagation(); playSound(ipa); };
            syllableContainer.appendChild(div);
        });

        // 2. Nút Blending: Đọc nhanh các âm cạnh nhau
        const blendBtn = document.createElement("button");
        blendBtn.innerHTML = "🔊";
        blendBtn.style.cssText = "margin-top: 5px; border: none; background: #f0f0f0; border-radius: 50%; width: 35px; height: 35px; cursor: pointer; font-size: 16px;";

        blendBtn.onclick = async () => {
            // Lặp qua danh sách IPA và phát lần lượt
            for (let i = 0; i < groupIpaList.length; i++) {
                // Gọi hàm playSound cũ của ông để đảm bảo đúng file
                playSound(groupIpaList[i]);

                // THAY THẾ SETTIMEOUT 50ms:
                // Đợi cho đến khi cái âm vừa gọi ở trên phát xong hoàn toàn
                await new Promise(resolve => {
                    // Tạo một đối tượng audio tạm để theo dõi thời gian của file đó
                    const tempAudio = new Audio(`sounds/${groupIpaList[i]}.mp3`);
                    tempAudio.onended = resolve;

                    // Nếu file có vấn đề, tự động nhảy sang âm tiếp theo sau 600ms để không kẹt
                    setTimeout(resolve, 100); 
                });
            }
        };

        groupWrapper.appendChild(syllableContainer);
        groupWrapper.appendChild(blendBtn);
        resultArea.appendChild(groupWrapper);

        if (groupIndex < syllableGroups.length - 1) {
            const hyphen = document.createElement("span");
            hyphen.innerText = "-";
            hyphen.style.cssText = "font-size: 30px; color: #ccc; align-self: flex-start; margin-top: 15px;";
            resultArea.appendChild(hyphen);
        }
    });

    // --- BƯỚC 4.5: NÚT ĐỌC TOÀN BỘ TỪ (Dùng Web Speech API) ---
    const fullWordBtn = document.createElement("div");
    fullWordBtn.style.cssText = "width: 100%; text-align: center; margin-top: 20px; padding-top: 10px; border-top: 2px solid #eee;";

    // Tạo nút dùng trình duyệt để đọc từ gốc
    const btn = document.createElement("button");
    btn.style.cssText = "padding: 12px 24px; font-size: 18px; background: #2a75bb; color: white; border: none; border-radius: 25px; cursor: pointer; font-weight: bold;";
    btn.innerHTML = `🔊 Đọc cả từ: ${word}`;
    btn.onclick = () => {
        const utterance = new SpeechSynthesisUtterance(word);
        utterance.lang = 'en-GB'; // Đọc giọng Anh-Anh cho chuẩn
        window.speechSynthesis.speak(utterance);
    };

    fullWordBtn.appendChild(btn);
    resultArea.appendChild(fullWordBtn);

    // --- BƯỚC 5: XỬ LÝ CHỮ CÂM (Silent E, v.v.) ---
    let usedIndices = new Set();
    mergedUnits.forEach(u => { if (u && u.text) for (let i = 0; i < u.text.length; i++) usedIndices.add(u.startIndex + i); });

    for (let i = 0; i < word.length; i++) {
        if (!usedIndices.has(i)) {
            const silentUnit = document.createElement("div");
            silentUnit.className = "sound-unit";
            silentUnit.style.cssText = "opacity: 0.5; background: #f5f5f5; display: inline-block; margin: 4px; border: 1px solid #eee;";
            silentUnit.innerHTML = `<span style="font-size: 28px; color: #999;">${word[i]}</span><small style="display: block;">🔇</small>`;
            resultArea.appendChild(silentUnit);
        }
    }
}

// Chạy khởi tạo ngay khi trang load xong
document.addEventListener("DOMContentLoaded", initDictionary);
