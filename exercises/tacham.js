// ==========================================
// 1. CẤU HÌNH DỮ LIỆU
// ==========================================
const soundConfig = {
    "AE": ["a"], "EH": ["e", "ea"], "IH": ["i", "y"], "AA": ["o", "a"],
    "AH": ["u", "o", "a"],
    "AA R": ["ar"], "AO R": ["or"], "ER": ["ir", "ur", "er"],
    "EY": ["ai", "ay", "a-e", "ey", "a"], 
    "IY": ["ee", "ea", "e-e", "ey", "ie", "e"],
    "AY": ["i-e", "ie", "igh", "y", "i"],
    "OW": ["o-e", "oa", "ow", "o"],
    "UW": ["u-e", "ew", "ue", "ui", "oo", "u"],
    "UH": ["u", "oo"],
    "EH R": ["air", "are"], "IH R": ["ear", "eer", "ere"],
    "UH R": ["ure", "our"], "AO": ["aw", "au", "al"],
    "AY ER": ["ire"],
    "P": ["p"], "T": ["t"], "K": ["k", "c", "ck"], 
    "F": ["f", "ph"], "TH": ["th"], "S": ["s", "ce"], 
    "HH": ["h"], "SH": ["sh"], "CH": ["ch"],
    "B": ["b"], "D": ["d"], "G": ["g"], "V": ["v"], 
    "DH": ["TH"], "Z": ["z", "s"], "ZH": ["zh"], 
    "JH": ["j", "ge"], "M": ["m", "mb"], "N": ["n", "kn", "gn"], 
    "NG": ["ng"], "L": ["l"], "R": ["r", "wr"], "W": ["w", "wh"], "Y": ["y"],
    "SH N": ["tion", "sion", "cian"], "CH ER": ["ture"],
    "ZH ER": ["sure"], "SH L": ["cial", "tial"],
    "AH S": ["ous"], "JH IH JH": ["age"]
};

const arpabetToIpa = {
    "EY": "eɪ", "IY": "iː", "AE": "æ", "EH": "ɛ", "IH": "ɪ",
    "AA": "ɒ", "AH": "ʌ", "AO": "ɔː", "UW": "uː", "OW": "əʊ",
    "AY": "aɪ", "AW": "aʊ", "OY": "ɔɪ", "ER": "ɜː", "UH": "ʊ",
    "P": "p", "T": "t", "K": "k", "F": "f", "TH": "θ", "S": "s",
    "HH": "h", "SH": "ʃ", "CH": "ʧ", "B": "b", "D": "d", "G": "g",
    "V": "v", "DH": "ð", "Z": "z", "ZH": "ʒ", "JH": "ʤ", "M": "m",
    "N": "n", "NG": "ŋ", "L": "l", "R": "r", "W": "w", "Y": "j",
    "AX": "ə", "eə": "eə", "ɪə": "ɪə", "ʊə": "ʊə", "aɪə": "aɪə"
};

const DATA_URL = "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/data.txt";
const MP3_BASE_URL = "https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/";

let dictMap = new Map();

// ==========================================
// 2. CÁC HÀM TIỆN ÍCH
// ==========================================

function findBestPhonics(word, cleanArpabet) {
    const possible = soundConfig[cleanArpabet];
    if (!possible) return cleanArpabet.toLowerCase();

    for (let ph of possible) {
        if (ph.includes('-e')) {
            const letter = ph.split('-')[0];
            const regex = new RegExp(letter + "[a-z]e");
            if (regex.test(word.toLowerCase())) return ph;
        } 
        else if (word.toLowerCase().includes(ph)) {
            return ph;
        }
    }
    return possible[0];
}

function playSound(ipaName) {
    // Ký hiệu IPA có thể chứa các ký tự đặc biệt, đảm bảo file mp3 trên server khớp tên
    const audio = new Audio(`${MP3_BASE_URL}${ipaName}.mp3`);
    audio.play().catch(e => console.warn("Không tìm thấy file âm thanh cho âm:", ipaName));
}

// ==========================================
// 3. KHỞI TẠO VÀ XỬ LÝ SỰ KIỆN
// ==========================================

async function initDictionary() {
    const statusIdx = document.getElementById('status');
    const inputIdx = document.getElementById('wordInput');
    const btnIdx = document.getElementById('btnRun');

    try {
        const response = await fetch(DATA_URL);
        const text = await response.text();
        const lines = text.split('\n');

        lines.forEach(line => {
            const cleanLine = line.split('#')[0].trim();
            if (!cleanLine) return;
            const parts = cleanLine.split(/\s+/); 
            if (parts.length >= 2) {
                let word = parts[0].toLowerCase();
                const sounds = parts.slice(1).join(' ').trim();
                if (!dictMap.has(word)) dictMap.set(word, sounds);
            }
        });

        statusIdx.innerHTML = "<b style='color:#28a745'>✅ PokéDict sẵn sàng!</b>";
        inputIdx.disabled = false;
        btnIdx.disabled = false;
    } catch (err) {
        statusIdx.innerHTML = "<b style='color:#dc3545'>❌ Lỗi tải dữ liệu. Kiểm tra kết nối!</b>";
        console.error(err);
    }
}

function handleSplit() {
    const wordInput = document.getElementById('wordInput');
    const resultArea = document.getElementById('resultArea');
    const word = wordInput.value.trim().toLowerCase();

    if (!word) return;
    resultArea.innerHTML = '';

    const rawSounds = dictMap.get(word);
    if (!rawSounds) {
        resultArea.innerHTML = `<p style="color:#dc3545; width:100%">Không tìm thấy từ "${word}"!</p>`;
        return;
    }

    const soundArray = rawSounds.split(/\s+/);

    soundArray.forEach((sound, index) => {
        let ipa = "";
        let audioFile = ""; // Biến để xác định file mp3 cần đọc
        let cleanSound = sound.replace(/[0-9]/g, ""); 

        // 1. LOGIC XỬ LÝ ÂM I (Sửa lỗi cho happily)
        if (cleanSound === "IY") {
            if (index === soundArray.length - 1 || word.endsWith("ly")) {
                ipa = "i";      // Hiển thị trên màn hình là /i/ cho đẹp
                audioFile = "ɪ"; // Nhưng vẫn bắt nó tìm file ɪ.mp3 để đọc
            } else {
                ipa = "iː";
                audioFile = "iː";
            }
        } 
        // 2. LOGIC ANH - ANH (Ơ và Ă)
        else if (sound.startsWith("AH")) {
            ipa = sound.endsWith("0") ? "ə" : "ʌ";
            audioFile = ipa;
        } 
        else if (cleanSound === "ER") {
            ipa = (index === soundArray.length - 1) ? "ə" : "ɜː";
            audioFile = ipa;
        }
        else if (cleanSound === "AA") {
            ipa = "ɒ";
            audioFile = ipa;
        }
        else {
            ipa = arpabetToIpa[cleanSound] || cleanSound.toLowerCase();
            audioFile = ipa;
        }

        const phLabel = findBestPhonics(word, cleanSound);

        const unit = document.createElement('div');
        unit.className = 'sound-unit';
        unit.innerHTML = `
            <span>/${ipa}/</span>
            <small>${phLabel}</small>
        `;

        // Gọi phát âm thanh bằng audioFile thay vì ipa
        unit.onclick = () => playSound(audioFile); 
        resultArea.appendChild(unit);
    });
}

// Chạy khởi tạo ngay khi trang load xong
document.addEventListener('DOMContentLoaded', initDictionary);
