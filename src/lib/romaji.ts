// Chuyển đổi giữa romaji và kana.
// - kanaToRomaji: kana → romaji Hepburn (dùng để hiển thị và để kiểm tra dữ liệu).
// - romaToKana: gõ romaji → kana (chế độ "Romaji tự đổi" khi luyện gõ).
// - typingHint: kana → chuỗi romaji mà khi gõ vào romaToKana sẽ ra đúng kana đó.
import { ALL, toHira, toKata } from './kana';

const MACRON: Record<string, string> = { a: 'ā', i: 'ī', u: 'ū', e: 'ē', o: 'ō' };

/** Bảng Hepburn cho Hiragana (1 hoặc 2 chữ). */
const HEP: Record<string, string> = {};
for (const it of ALL) {
  const h = toHira(it.k);
  if (!(h in HEP)) HEP[h] = it.r;
}
Object.assign(HEP, {
  を: 'o', ぢ: 'ji', づ: 'zu', ゐ: 'i', ゑ: 'e',
  ぁ: 'a', ぃ: 'i', ぅ: 'u', ぇ: 'e', ぉ: 'o', ゃ: 'ya', ゅ: 'yu', ょ: 'yo', ゎ: 'wa',
  いぇ: 'ye', うぉ: 'wo', ゔぁ: 'va', ゔぃ: 'vi', ゔぇ: 've', ゔぉ: 'vo', つぁ: 'tsa', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
  くぁ: 'kwa', ぐぁ: 'gwa', ぢゃ: 'ja', ぢゅ: 'ju', ぢょ: 'jo', てゅ: 'tyu', でゅ: 'dyu', ふゅ: 'fyu',
});

const PUNCT: Record<string, string> = {
  '、': ', ', '。': '. ', '？': '? ', '！': '! ', '「': '"', '」': '"', '『': '"', '』': '"',
  '～': '~', '〜': '~', '・': ' ', '　': ' ', '（': '(', '）': ')', '：': ': ',
};

export interface RomajiOptions {
  /** Viết trường âm bằng dấu gạch (ō, ū…) như Hepburn chuẩn. Mặc định: true. */
  macrons?: boolean;
  /** Viết hoa chữ cái đầu. */
  capitalize?: boolean;
}

/** Kana → romaji Hepburn. Không tự biết trợ từ は/へ/を đọc là wa/e/o. */
export function kanaToRomaji(text: string, opts: RomajiOptions = {}): string {
  const macrons = opts.macrons !== false;
  const s = toHira(text);
  let out = '';
  let sokuon = false;
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === 'っ') {
      sokuon = true;
      i++;
      continue;
    }
    if (c === 'ー') {
      const m = out.match(/[aiueo]$/);
      if (m) out = macrons ? out.slice(0, -1) + MACRON[m[0]] : out + m[0];
      i++;
      continue;
    }
    if (c === 'ん') {
      const next = s[i + 1];
      out += next && /[あいうえおやゆよぁぃぅぇぉゃゅょ]/.test(next) ? "n'" : 'n';
      sokuon = false;
      i++;
      continue;
    }
    const two = s.slice(i, i + 2);
    let r = two.length === 2 ? HEP[two] : undefined;
    let len = 2;
    if (r === undefined) {
      r = HEP[c];
      len = 1;
    }
    if (r === undefined) {
      out += PUNCT[c] ?? c;
      sokuon = false;
      i++;
      continue;
    }
    if (sokuon) {
      r = (r.startsWith('ch') ? 't' : r[0]) + r;
      sokuon = false;
    }
    if (macrons && len === 1 && out.length) {
      const prev = out[out.length - 1];
      if ((prev === 'o' && (c === 'う' || c === 'お')) || (prev === 'u' && c === 'う') || (prev === 'a' && c === 'あ') || (prev === 'e' && c === 'え')) {
        out = out.slice(0, -1) + MACRON[prev];
        i++;
        continue;
      }
    }
    out += r;
    i += len;
  }
  out = out.replace(/ {2,}/g, ' ').replace(/ ([,.?!])/g, '$1').trim();
  return opts.capitalize ? out.charAt(0).toUpperCase() + out.slice(1) : out;
}

// ---------------------------------------------------------------------------
// Gõ romaji → kana (giống bộ gõ IME): chữ thường → Hiragana, CHỮ HOA → Katakana.

const RK: Record<string, string> = {};
for (const it of ALL) for (const r of it.a) if (r !== 'nn' && !(r in RK)) RK[r] = toHira(it.k);
Object.assign(RK, {
  thi: 'てぃ', dhi: 'でぃ', twu: 'とぅ', dwu: 'どぅ', thu: 'てゅ', dhu: 'でゅ',
  xa: 'ぁ', xi: 'ぃ', xu: 'ぅ', xe: 'ぇ', xo: 'ぉ', la: 'ぁ', li: 'ぃ', lu: 'ぅ', le: 'ぇ', lo: 'ぉ',
  xya: 'ゃ', xyu: 'ゅ', xyo: 'ょ', lya: 'ゃ', lyu: 'ゅ', lyo: 'ょ', xwa: 'ゎ', lwa: 'ゎ',
  xtu: 'っ', ltu: 'っ', xtsu: 'っ', ltsu: 'っ',
  ye: 'いぇ', wi: 'うぃ', we: 'うぇ', wo: 'を', wyi: 'ゐ', wye: 'ゑ',
  va: 'ゔぁ', vi: 'ゔぃ', vu: 'ゔ', ve: 'ゔぇ', vo: 'ゔぉ',
  tsa: 'つぁ', tsi: 'つぃ', tse: 'つぇ', tso: 'つぉ',
  dya: 'ぢゃ', dyu: 'ぢゅ', dyo: 'ぢょ', fyu: 'ふゅ',
  ca: 'か', cu: 'く', co: 'こ', qa: 'くぁ', kwa: 'くぁ', gwa: 'ぐぁ',
});
const RKP = new Set<string>();
for (const k of Object.keys(RK)) for (let i = 1; i <= k.length; i++) RKP.add(k.slice(0, i));

/**
 * Đổi romaji sang kana. final=false: phần cuối chưa gõ xong được giữ nguyên
 * (ví dụ "ky" đang chờ chữ tiếp theo); final=true: đổi hết (n cuối → ん).
 */
export function romaToKana(s: string, final: boolean, forceKata = false): string {
  let out = '';
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (!/[a-zA-Z'\-]/.test(c)) {
      out += c;
      i++;
      continue;
    }
    const rest = s.slice(i);
    const l = rest.toLowerCase();
    const kata = forceKata || /[A-Z]/.test(c);
    const K = (x: string) => (kata ? toKata(x) : x);
    if (c === '-') {
      out += 'ー';
      i++;
      continue;
    }
    if (c === "'") {
      i++;
      continue;
    }
    if (l[0] === 'n') {
      const n1 = l[1];
      const n2 = l[2];
      if (n1 === undefined) {
        if (final) {
          out += K('ん');
          i++;
          continue;
        }
        out += rest;
        break;
      }
      if (n1 === 'n') {
        if (n2 === undefined && !final) {
          out += rest;
          break;
        }
        out += K('ん');
        i += n2 !== undefined && /[aiueoy]/.test(n2) ? 1 : 2;
        continue;
      }
      if (n1 === "'") {
        out += K('ん');
        i += 2;
        continue;
      }
      if (!/[aiueoy]/.test(n1)) {
        out += K('ん');
        i++;
        continue;
      }
    }
    if (l.length > 1 && l[0] === l[1] && /[bcdfghjkmpqrstvwxyz]/.test(l[0])) {
      out += K('っ');
      i++;
      continue;
    }
    if (l.startsWith('tch')) {
      out += K('っ');
      i++;
      continue;
    }
    let hit = false;
    for (let n = 4; n >= 1; n--) {
      const p = l.slice(0, n);
      if (p.length === n && RK[p]) {
        out += K(RK[p]);
        i += n;
        hit = true;
        break;
      }
    }
    if (hit) continue;
    if (!final && RKP.has(l)) {
      out += rest;
      break;
    }
    out += c;
    i++;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Gợi ý cách gõ: kana → romaji để gõ ở chế độ "Romaji tự đổi".

const TYPE: Record<string, string> = { ...HEP };
Object.assign(TYPE, {
  を: 'wo', ぢ: 'di', づ: 'du', ゐ: 'wyi', ゑ: 'wye',
  てぃ: 'thi', でぃ: 'dhi', とぅ: 'twu', どぅ: 'dwu', てゅ: 'thu', でゅ: 'dhu',
  ぁ: 'xa', ぃ: 'xi', ぅ: 'xu', ぇ: 'xe', ぉ: 'xo', ゃ: 'xya', ゅ: 'xyu', ょ: 'xyo', ゎ: 'xwa',
  うぉ: 'u' + 'xo', くぁ: 'qa', ぐぁ: 'gwa', ぢゃ: 'dya', ぢゅ: 'dyu', ぢょ: 'dyo', つぃ: 'tsi', つぇ: 'tse', つぉ: 'tso',
});

interface Unit {
  kana: string;
  kata: boolean;
}
function units(s: string): Unit[] {
  const out: Unit[] = [];
  let i = 0;
  while (i < s.length) {
    const two = toHira(s.slice(i, i + 2));
    const len = two.length === 2 && TYPE[two] !== undefined && /^[぀-ヿ]{2}$/.test(s.slice(i, i + 2)) ? 2 : 1;
    const kana = s.slice(i, i + len);
    out.push({ kana, kata: /[ァ-ヺ]/.test(kana) });
    i += len;
  }
  return out;
}

const startsVowelOrY = (u: Unit | undefined) => !!u && /^[あいうえおやゆよぁぃぅぇぉゃゅょ]/.test(toHira(u.kana));

/** Chuỗi romaji để gõ ra đúng kana `answer` ở chế độ "Romaji tự đổi". */
export function typingHint(answer: string): string {
  const us = units(answer);
  let out = '';
  for (let i = 0; i < us.length; i++) {
    const u = us[i];
    const h = toHira(u.kana);
    const up = (x: string) => (u.kata ? x.toUpperCase() : x);
    if (u.kana === 'ー') {
      out += '-';
      continue;
    }
    if (h === 'ん') {
      out += up(startsVowelOrY(us[i + 1]) ? "n'" : 'n');
      continue;
    }
    if (h === 'っ') {
      const nx = us[i + 1] ? TYPE[toHira(us[i + 1].kana)] : undefined;
      if (nx && /^[bcdfghjkmpqrstvwxyz]/.test(nx)) out += up(nx.startsWith('ch') ? 't' : nx[0]);
      else out += up('xtu');
      continue;
    }
    const r = TYPE[h];
    out += r === undefined ? u.kana : up(r);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Tiện ích chung

/** Bỏ dấu cách, dấu câu, dấu ～ để so sánh câu trả lời. */
export const normalizeAnswer = (s: string) => s.replace(/[\s、。，．,.!?！？「」『』…〜～・"]/g, '');

/** Bỏ "(…)", "……", dấu cách: dùng cho máy đọc. */
export const speakable = (t: string) => t.replace(/\(.*?\)|（.*?）/g, '').replace(/\b[AB]:/g, '').replace(/[…\s]/g, '');

/**
 * Chuẩn hoá romaji để so sánh lỏng: bỏ dấu, gộp trường âm (ō = ou = oo),
 * gộp m/n trước b/p/m, và gộp wa/ha, o/wo, e/he (trợ từ).
 */
export function looseRomaji(s: string): string {
  return s
    .toLowerCase()
    .replace(/[āâ]/g, 'aa').replace(/[īî]/g, 'ii').replace(/[ūû]/g, 'uu').replace(/[ēê]/g, 'ee').replace(/[ōô]/g, 'ou')
    .replace(/[^a-z]/g, '')
    .replace(/oo/g, 'ou')
    .replace(/m(?=[bpm])/g, 'n')
    .replace(/wa/g, 'ha').replace(/wo/g, 'o').replace(/he/g, 'e');
}

/** Romaji trong dữ liệu có khớp với kana không (so sánh lỏng). */
export function romajiMatches(jp: string, romaji: string): boolean {
  return looseRomaji(kanaToRomaji(jp, { macrons: false })) === looseRomaji(romaji);
}

const ATTACH = /^(は|が|を|に|へ|で|と|も|の|や|か、?|から|まで|より|よ|ね|です.*|でした.*|じゃ ありません.*|では ありません.*|ます.*|ません.*|ました.*|ませんでした.*)$/;

/** Ghép các từ của câu sắp xếp thành câu viết tự nhiên: "わたしは ベトナムじんです。" */
export function joinWords(words: string[]): string {
  let s = '';
  words.forEach((w, i) => {
    if (i === 0) s = w;
    else if (ATTACH.test(w) || /[、,]$/.test(words[i - 1])) s += w;
    else s += ' ' + w;
  });
  if (!/[。？！?!]$/.test(s)) s += '。';
  return s;
}
