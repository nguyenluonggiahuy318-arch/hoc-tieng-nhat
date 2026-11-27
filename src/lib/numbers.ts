// Cách đọc số và các đơn vị đếm (tuổi, tầng, quận, giá…).
// Quy tắc biến âm của từng đơn vị đếm nằm trong content/so-dem.json, code chỉ áp dụng.

export const DIGITS = ['ぜろ', 'いち', 'に', 'さん', 'よん', 'ご', 'ろく', 'なな', 'はち', 'きゅう'];
export const ALT_DIGITS: Record<number, string> = { 0: 'れい', 4: 'し', 7: 'しち', 9: 'く' };
const H100: Record<number, string> = { 1: 'ひゃく', 2: 'にひゃく', 3: 'さんびゃく', 4: 'よんひゃく', 5: 'ごひゃく', 6: 'ろっぴゃく', 7: 'ななひゃく', 8: 'はっぴゃく', 9: 'きゅうひゃく' };
const H1000: Record<number, string> = { 1: 'せん', 2: 'にせん', 3: 'さんぜん', 4: 'よんせん', 5: 'ごせん', 6: 'ろくせん', 7: 'ななせん', 8: 'はっせん', 9: 'きゅうせん' };

export const MAX_NUMBER = 99_999_999;

export interface CounterDef {
  id: string;
  name: string;
  suffix: string;
  /** Cách đọc đặc biệt khi chữ số hàng đơn vị là d (1–9), đã gồm đơn vị: {"1": "いっかい"}. */
  digit?: Record<string, string>;
  /** Dùng thay cho "じゅう + đơn vị" khi số tròn chục: "じゅっかい". */
  ten?: string;
  /** Cách đọc riêng của cả số: {"20": "はたち"}. */
  special?: Record<string, string>;
}

type Part = [number, string];

function under1e4(n: number, beforeMan = false): Part[] {
  const p: Part[] = [];
  const th = Math.floor(n / 1000), h = Math.floor(n / 100) % 10, t = Math.floor(n / 10) % 10, o = n % 10;
  if (th) p.push([th * 1000, th === 1 && beforeMan ? 'いっせん' : H1000[th]]);
  if (h) p.push([h * 100, H100[h]]);
  if (t) p.push([t * 10, t === 1 ? 'じゅう' : DIGITS[t] + 'じゅう']);
  if (o) p.push([o, DIGITS[o]]);
  return p;
}

/** Tách số thành từng hàng: 368 → [[300,'さんびゃく'],[60,'ろくじゅう'],[8,'はち']]. */
export function numberParts(n: number): Part[] {
  if (!Number.isInteger(n) || n < 0 || n > MAX_NUMBER) throw new RangeError('Số không hợp lệ: ' + n);
  if (n === 0) return [[0, 'ぜろ']];
  const man = Math.floor(n / 10000), rest = n % 10000;
  const p: Part[] = [];
  if (man) p.push([man * 10000, under1e4(man, true).map((x) => x[1]).join('') + 'まん']);
  return p.concat(under1e4(rest));
}

export const readNumber = (n: number) => numberParts(n).map((x) => x[1]).join('');
export const readNumberSpaced = (n: number) => numberParts(n).map((x) => x[1]).join(' ');

/** Cách đọc "ghép thẳng", không biến âm: 300 → さんひゃく, 8000 → はちせん. */
function plainUnder1e4(n: number): string {
  const th = Math.floor(n / 1000), h = Math.floor(n / 100) % 10, t = Math.floor(n / 10) % 10, o = n % 10;
  let s = '';
  if (th) s += (th === 1 ? '' : DIGITS[th]) + 'せん';
  if (h) s += (h === 1 ? '' : DIGITS[h]) + 'ひゃく';
  if (t) s += (t === 1 ? '' : DIGITS[t]) + 'じゅう';
  if (o) s += DIGITS[o];
  return s;
}
export function plainNumber(n: number): string {
  if (n === 0) return 'ぜろ';
  const man = Math.floor(n / 10000), rest = n % 10000;
  return (man ? (man === 1 ? 'いち' : plainUnder1e4(man)) + 'まん' : '') + plainUnder1e4(rest);
}

/** Số có cách đọc biến âm (khác với ghép thẳng) không: 300, 600, 800, 3000, 8000… */
export const isIrregularNumber = (n: number) => readNumber(n) !== plainNumber(n);

export interface ReadOptions {
  /** Cách giữa các hàng: "さんぜん はっぴゃく えん". */
  spaced?: boolean;
}

/** Đọc số kèm đơn vị đếm, áp dụng quy tắc biến âm của đơn vị. */
export function readCounter(n: number, c: CounterDef, opts: ReadOptions = {}): string {
  const sp = opts.spaced ? ' ' : '';
  const special = c.special?.[String(n)];
  if (special) return special;
  const o = n % 10, base = n - o;
  const pre = base ? (opts.spaced ? readNumberSpaced(base) : readNumber(base)) : '';
  if (o === 0) {
    if (c.ten && /じゅう$/.test(pre)) return pre.slice(0, -3) + c.ten;
    return pre + sp + c.suffix;
  }
  const last = c.digit?.[String(o)] ?? DIGITS[o] + c.suffix;
  return pre + (pre ? sp : '') + last;
}

/** Cách đọc ghép thẳng của số + đơn vị (dùng để tìm biến âm và làm đáp án nhiễu). */
export function plainCounter(n: number, c: CounterDef): string {
  const o = n % 10, base = n - o;
  return (base ? plainNumber(base) : '') + (o ? DIGITS[o] : '') + c.suffix;
}

export const isIrregularCounter = (n: number, c: CounterDef) => readCounter(n, c) !== plainCounter(n, c);

/** Một cách đọc sai hay gặp, dùng làm đáp án nhiễu. */
export function trapReading(n: number, c?: CounterDef): string | null {
  const right = c ? readCounter(n, c) : readNumber(n);
  const plain = c ? plainCounter(n, c) : plainNumber(n);
  if (plain !== right) return plain;
  if (/^(ひゃく|せん)/.test(right)) return 'いち' + right;
  return null;
}

export const formatVi = (n: number) => n.toLocaleString('vi-VN');
export const formatEn = (n: number) => n.toLocaleString('en-US');

/** Điền số vào nhãn: "Tầng {n}" → "Tầng 3"; "{n:en}" dùng dấu phẩy kiểu Nhật. */
export const fillLabel = (tpl: string, n: number) => tpl.replace('{n:en}', formatEn(n)).replace('{n}', formatVi(n));
