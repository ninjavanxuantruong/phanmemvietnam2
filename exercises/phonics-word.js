// ====== Hàm phát âm từ file mp3 trên GitHub (chuẩn tham khảo) ======
function playIPAFromText(text) {
  const match = text.match(/\/([^/]+)\//); // lấy phần giữa dấu gạch chéo
  const ipa = match?.[1];
  if (ipa) {
    const url = `https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/${encodeURIComponent(ipa)}.mp3`;
    const audio = new Audio(url);
    audio.play();
  } else {
    console.warn("Không tìm thấy IPA trong nút:", text);
  }
}

document.addEventListener("DOMContentLoaded", () => {
  console.log("📦 Khởi động Phonics Word Builder");

  // ====== Danh sách âm ======
  const CONSONANTS_SINGLE = ['', 'b','c','d','f','g','h','j','k','l','m','n','p','q','r','s','t','v','w','x','y','z'];
  const VOWELS_SINGLE    = ['', 'a','e','i','o','u','y'];
  const MAGIC_E          = ['', 'e'];

  // ====== Ánh xạ chữ cái → IPA ======
  const ipaMap = {
    // nguyên âm đơn
    'a':'æ','e':'ɛ','i':'ɪ','o':'ɒ','u':'ʌ','y':'j',
    // phụ âm đơn
    'b':'b','c':'k','d':'d','f':'f','g':'g','h':'h','j':'ʤ','k':'k',
    'l':'l','m':'m','n':'n','p':'p','q':'k','r':'r','s':'s','t':'t',
    'v':'v','w':'w','x':'ks','z':'z',
    // cụm phụ âm phổ biến (onset/coda)
    'ng':'ŋ','ch':'ʧ','sh':'ʃ','th':'θ','ph':'f','wh':'w',
    // nguyên âm đôi (chỉ xử lý 2 nguyên âm liền nhau như yêu cầu giai đoạn này)
    'ai':'eɪ','ay':'eɪ','ea':'iː','ee':'iː','ie':'aɪ','oa':'oʊ','oo':'uː','ou':'aʊ','oi':'ɔɪ','oy':'ɔɪ'
  };

  // ====== Helpers ======
  function withEmptySlots(items) { return [''].concat(items, ['', '']); }
  function createWheel(el, items) {
    el.innerHTML = '';
    const top = document.createElement('div'); top.className = 'spacer'; el.appendChild(top);
    withEmptySlots(items).forEach(txt => {
      const div = document.createElement('div');
      const isEmpty = (txt === '');
      div.className = 'item' + (isEmpty ? ' empty' : '');
      div.textContent = isEmpty ? '(trống)' : txt;
      el.appendChild(div);
    });
    const bottom = document.createElement('div'); bottom.className = 'spacer'; el.appendChild(bottom);
  }
  function getSelected(wheel) {
    const rect = wheel.getBoundingClientRect();
    const centerY = rect.top + rect.height / 2;
    let nearest = null, dist = 1e9;
    wheel.querySelectorAll('.item').forEach(it => {
      const r = it.getBoundingClientRect();
      const c = r.top + r.height / 2;
      const d = Math.abs(c - centerY);
      if (d < dist) { dist = d; nearest = it; }
    });
    if (!nearest) return '';
    const val = nearest.textContent.trim();
    return val === '(trống)' ? '' : val;
  }

  // ====== Wheel elements ======
  const w1 = document.getElementById('w1');
  const w2 = document.getElementById('w2');
  const w3 = document.getElementById('w3');
  const w4 = document.getElementById('w4');
  const w5 = document.getElementById('w5');
  const w6 = document.getElementById('w6');
  const w7 = document.getElementById('w7');

  // Tạo nội dung cho từng wheel
  createWheel(w1, CONSONANTS_SINGLE);
  createWheel(w2, CONSONANTS_SINGLE);
  createWheel(w3, VOWELS_SINGLE);
  createWheel(w4, VOWELS_SINGLE);
  createWheel(w5, CONSONANTS_SINGLE);
  createWheel(w6, CONSONANTS_SINGLE);
  createWheel(w7, MAGIC_E);

  // ====== 7 ô hiển thị ======
  const part1 = document.getElementById('part1');
  const part2 = document.getElementById('part2');
  const part3 = document.getElementById('part3');
  const part4 = document.getElementById('part4');
  const part5 = document.getElementById('part5');
  const part6 = document.getElementById('part6');
  const part7 = document.getElementById('part7');

  // ====== Cập nhật hiển thị chữ và log ======
  function updateWord() {
    const v1 = getSelected(w1) || '—';
    const v2 = getSelected(w2) || '—';
    const v3 = getSelected(w3) || '—';
    const v4 = getSelected(w4) || '—';
    const v5 = getSelected(w5) || '—';
    const v6 = getSelected(w6) || '—';
    const v7 = getSelected(w7) || '—';

    part1.textContent = v1;
    part2.textContent = v2;
    part3.textContent = v3;
    part4.textContent = v4;
    part5.textContent = v5;
    part6.textContent = v6;
    part7.textContent = v7;

    console.log(`🔁 updateWord -> part1:${v1} | part2:${v2} | part3:${v3} | part4:${v4} | part5:${v5} | part6:${v6} | part7:${v7}`);
  }

  // Cập nhật khi cuộn
  [w1, w2, w3, w4, w5, w6, w7].forEach((wheel, idx) => {
    let t;
    wheel.addEventListener('scroll', () => {
      console.log(`🌀 scroll wheel ${idx+1} (${wheel.getAttribute('aria-label')})`);
      if (t) clearTimeout(t);
      t = setTimeout(updateWord, 120);
    }, { passive: true });
  });

  // Khởi động lần đầu
  updateWord();

  // ====== Gộp cặp: onset (1–2), vowel (3–4), coda (5–6) ======
  function normalize(val) {
    return (val && val !== '—') ? val.toLowerCase() : '';
  }

  function getOnsetKey() {
    const p1 = normalize(part1.textContent.trim());
    const p2 = normalize(part2.textContent.trim());
    if (p1 && p2) {
      const combo = p1 + p2;
      if (ipaMap[combo]) return combo;
    }
    return p1 || p2 || '';
  }

  function getVowelKey() {
    const v1 = normalize(part3.textContent.trim());
    const v2 = normalize(part4.textContent.trim());
    if (v1 && v2) {
      const combo = v1 + v2;
      if (ipaMap[combo]) return combo;
    }
    return v1 || v2 || '';
  }

  function getCodaKey() {
    const c1 = normalize(part5.textContent.trim());
    const c2 = normalize(part6.textContent.trim());
    if (c1 && c2) {
      const combo = c1 + c2;
      if (ipaMap[combo]) return combo;
    }
    return c1 || c2 || '';
  }

  // ====== Phát âm theo key ======
  function speakKey(key, label) {
    if (!key) {
      console.warn(`⚠️ ${label}: trống, không đọc`);
      return;
    }
    const ipa = ipaMap[key];
    if (!ipa) {
      console.warn(`❓ ${label}: không có IPA cho "${key}"`);
      return;
    }
    const fakeText = `${key} - /${ipa}/`;
    console.log(`🔊 ${label}: ${fakeText} -> /${ipa}.mp3`);
    playIPAFromText(fakeText);
  }

  // ====== Gắn click: dùng cặp tương ứng ======
  part1.addEventListener('click', () => speakKey(getOnsetKey(), 'Onset (1–2)'));
  part2.addEventListener('click', () => speakKey(getOnsetKey(), 'Onset (1–2)'));

  part3.addEventListener('click', () => speakKey(getVowelKey(), 'Vowel (3–4)'));
  part4.addEventListener('click', () => speakKey(getVowelKey(), 'Vowel (3–4)'));

  part5.addEventListener('click', () => speakKey(getCodaKey(), 'Coda (5–6)'));
  part6.addEventListener('click', () => speakKey(getCodaKey(), 'Coda (5–6)'));

  part7.addEventListener('click', () => {
    const m = normalize(part7.textContent.trim());
    speakKey(m, 'Magic‑e (7)');
  });

  // (Giữ UX chặn double-tap zoom nếu cần)
  [part1, part2, part3, part4, part5, part6, part7].forEach(el => {
    el.addEventListener('touchend', e => { e.preventDefault(); }, { passive: false });
  });
});
