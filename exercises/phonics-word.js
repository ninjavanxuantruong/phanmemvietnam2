import { phonicsBank } from './phonics-bank.js';

// Nhóm nguyên âm và phụ âm để ưu tiên tra
const vowelUnits = new Set(['groupA','groupE','groupI','groupO','groupU','unit1','unit2','unit3','unit4','unit5','unit6']);
const consonantUnits = new Set(['unit7','unit8','unit9','unit10','unit11']);

// ===== Helpers =====
function findPhonic(key, preferVowel = false, preferConsonant = false) {
  const lowerKey = key.toLowerCase();
  if (preferVowel) {
    const hit = phonicsBank.find(x => x.key.toLowerCase() === lowerKey && vowelUnits.has(x.unit));
    if (hit) return hit;
  }
  if (preferConsonant) {
    const hit = phonicsBank.find(x => x.key.toLowerCase() === lowerKey && consonantUnits.has(x.unit));
    if (hit) return hit;
  }
  return phonicsBank.find(x => x.key.toLowerCase() === lowerKey);
}

// Phát file mp3 IPA từ GitHub
function playIPA(ipa) {
  if (!ipa || !ipa.startsWith('/') || !ipa.endsWith('/')) return;
  const core = ipa.slice(1, -1); // bỏ dấu "/"
  const url = `https://raw.githubusercontent.com/ninjavanxuantruong/mp3vietnam2/main/${encodeURIComponent(core)}.mp3`;
  const audio = new Audio(url);
  audio.play();
}

// Đọc cả từ bằng TTS
function speakWord(word) {
  if (!word) return;
  const utter = new SpeechSynthesisUtterance(word);
  utter.lang = 'en-US';
  speechSynthesis.speak(utter);
}

// ===== Lấy giá trị từ wheel =====
function getSelectedFromWheel(el) {
  const wheelRect = el.getBoundingClientRect();
  const centerY = wheelRect.top + wheelRect.height / 2;
  let nearest = null, nearestDist = Infinity;
  el.querySelectorAll('.item').forEach(item => {
    const r = item.getBoundingClientRect();
    const itemCenter = r.top + r.height / 2;
    const d = Math.abs(itemCenter - centerY);
    if (d < nearestDist) { nearestDist = d; nearest = item; }
  });
  if (!nearest) return '';
  const val = nearest.textContent.trim();
  return val === '(trống)' ? '' : val;
}

// ===== Build cụm =====
function buildOnsetKey(w1, w2) {
  const c1 = getSelectedFromWheel(w1);
  const c2 = getSelectedFromWheel(w2);
  const pair = `${c1}${c2}`;
  if (pair && findPhonic(pair, false, true)) return pair;
  return c1 || c2 || '';
}

function buildVowelKey(w3, w4, w7) {
  const v1 = getSelectedFromWheel(w3);
  const v2 = getSelectedFromWheel(w4);
  const e7 = getSelectedFromWheel(w7);
  const simpleVowel = new Set(['a','e','i','o','u']);

  if (e7 === 'e' && v2 === '' && simpleVowel.has(v1)) {
    const key = `${v1}-e`;
    if (findPhonic(key, true, false)) return key;
  }
  const cluster = `${v1}${v2}`;
  if (cluster && findPhonic(cluster, true, false)) return cluster;
  return v1 || '';
}

function buildCodaKey(w5, w6) {
  const c3 = getSelectedFromWheel(w5);
  const c4 = getSelectedFromWheel(w6);
  const pair = `${c3}${c4}`;
  if (pair && findPhonic(pair, false, true)) return pair;
  return c3 || c4 || '';
}

function buildWholeWord(w1,w2,w3,w4,w5,w6,w7) {
  return `${getSelectedFromWheel(w1)}${getSelectedFromWheel(w2)}${getSelectedFromWheel(w3)}${getSelectedFromWheel(w4)}${getSelectedFromWheel(w5)}${getSelectedFromWheel(w6)}${getSelectedFromWheel(w7)}`;
}

// ===== Gắn sự kiện nút =====
export function initPhonicsWord(wheels, outputs) {
  const {w1,w2,w3,w4,w5,w6,w7} = wheels;
  const {outOnset,ipaOnset,outVowel,ipaVowel,outCoda,ipaCoda,wordPreview} = outputs;

  document.getElementById('btnOnset').addEventListener('click', () => {
    const key = buildOnsetKey(w1,w2);
    outOnset.textContent = key || '—';
    ipaOnset.textContent = '';
    if (!key) return;
    const hit = findPhonic(key, false, true);
    if (hit?.ipa) {
      ipaOnset.textContent = hit.ipa;
      playIPA(hit.ipa);
    }
  });

  document.getElementById('btnVowel').addEventListener('click', () => {
    const key = buildVowelKey(w3,w4,w7);
    outVowel.textContent = key || '—';
    ipaVowel.textContent = '';
    if (!key) return;
    const hit = findPhonic(key, true, false);
    if (hit?.ipa) {
      ipaVowel.textContent = hit.ipa;
      playIPA(hit.ipa);
    }
  });

  document.getElementById('btnCoda').addEventListener('click', () => {
    const key = buildCodaKey(w5,w6);
    outCoda.textContent = key || '—';
    ipaCoda.textContent = '';
    if (!key) return;
    const hit = findPhonic(key, false, true);
    if (hit?.ipa) {
      ipaCoda.textContent = hit.ipa;
      playIPA(hit.ipa);
    }
  });

  document.getElementById('btnWhole').addEventListener('click', () => {
    const word = buildWholeWord(w1,w2,w3,w4,w5,w6,w7);
    wordPreview.textContent = word || '—';
    if (word) speakWord(word);
  });
}
