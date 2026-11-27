// Bảng chữ cái (Hiragana / Katakana). Đây là dữ liệu cố định của hệ chữ, không phải từ vựng
// theo bài, nên nằm trong code. Các chữ được lưu ở dạng Katakana; Hiragana tạo bằng toHira().

export type Script = 'hira' | 'kata';

export interface KanaItem {
  /** Chữ Katakana (khoá chính). */
  k: string;
  /** Romaji chính (Hepburn). */
  r: string;
  /** Các cách gõ được chấp nhận, phần tử đầu là r. */
  a: string[];
  /** Hàng chứa chữ, ví dụ "basic:ka". */
  row: string;
  group: GroupId;
}

export type GroupId = 'basic' | 'daku' | 'yoon' | 'ext';

export interface KanaGroup {
  id: GroupId;
  name: string;
  note: string;
  cols: number;
  small?: boolean;
  kataOnly?: boolean;
  head: string[] | null;
  rows: [string, (KanaItem | null)[]][];
}

export interface KanaRow {
  key: string;
  group: GroupId;
  items: KanaItem[];
}

export const toHira = (s: string) => s.replace(/[ァ-ヶ]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0x60));
export const toKata = (s: string) => s.replace(/[ぁ-ゖ]/g, (c) => String.fromCharCode(c.charCodeAt(0) + 0x60));

const K = (k: string, r: string, alt?: string) =>
  ({ k, r, a: [r].concat(alt ? alt.split(',') : []), row: '', group: 'basic' }) as KanaItem;
const _ = null;

export const GROUPS: KanaGroup[] = [
  {
    id: 'basic', name: 'Cơ bản', note: '46 chữ', cols: 5, head: ['a', 'i', 'u', 'e', 'o'],
    rows: [
      ['a', [K('ア', 'a'), K('イ', 'i'), K('ウ', 'u'), K('エ', 'e'), K('オ', 'o')]],
      ['ka', [K('カ', 'ka'), K('キ', 'ki'), K('ク', 'ku'), K('ケ', 'ke'), K('コ', 'ko')]],
      ['sa', [K('サ', 'sa'), K('シ', 'shi', 'si'), K('ス', 'su'), K('セ', 'se'), K('ソ', 'so')]],
      ['ta', [K('タ', 'ta'), K('チ', 'chi', 'ti'), K('ツ', 'tsu', 'tu'), K('テ', 'te'), K('ト', 'to')]],
      ['na', [K('ナ', 'na'), K('ニ', 'ni'), K('ヌ', 'nu'), K('ネ', 'ne'), K('ノ', 'no')]],
      ['ha', [K('ハ', 'ha'), K('ヒ', 'hi'), K('フ', 'fu', 'hu'), K('ヘ', 'he'), K('ホ', 'ho')]],
      ['ma', [K('マ', 'ma'), K('ミ', 'mi'), K('ム', 'mu'), K('メ', 'me'), K('モ', 'mo')]],
      ['ya', [K('ヤ', 'ya'), _, K('ユ', 'yu'), _, K('ヨ', 'yo')]],
      ['ra', [K('ラ', 'ra'), K('リ', 'ri'), K('ル', 'ru'), K('レ', 're'), K('ロ', 'ro')]],
      ['wa', [K('ワ', 'wa'), _, _, _, K('ヲ', 'wo', 'o')]],
      ['n', [K('ン', 'n', 'nn'), _, _, _, _]],
    ],
  },
  {
    id: 'daku', name: 'Biến âm', note: '゛ và ゜', cols: 5, head: ['a', 'i', 'u', 'e', 'o'],
    rows: [
      ['ga', [K('ガ', 'ga'), K('ギ', 'gi'), K('グ', 'gu'), K('ゲ', 'ge'), K('ゴ', 'go')]],
      ['za', [K('ザ', 'za'), K('ジ', 'ji', 'zi'), K('ズ', 'zu'), K('ゼ', 'ze'), K('ゾ', 'zo')]],
      ['da', [K('ダ', 'da'), K('ヂ', 'ji', 'di'), K('ヅ', 'zu', 'du'), K('デ', 'de'), K('ド', 'do')]],
      ['ba', [K('バ', 'ba'), K('ビ', 'bi'), K('ブ', 'bu'), K('ベ', 'be'), K('ボ', 'bo')]],
      ['pa', [K('パ', 'pa'), K('ピ', 'pi'), K('プ', 'pu'), K('ペ', 'pe'), K('ポ', 'po')]],
    ],
  },
  {
    id: 'yoon', name: 'Âm ghép', note: 'chữ cột i + ya/yu/yo nhỏ', cols: 3, small: true, head: ['ya', 'yu', 'yo'],
    rows: [
      ['kya', [K('キャ', 'kya'), K('キュ', 'kyu'), K('キョ', 'kyo')]],
      ['sha', [K('シャ', 'sha', 'sya'), K('シュ', 'shu', 'syu'), K('ショ', 'sho', 'syo')]],
      ['cha', [K('チャ', 'cha', 'tya'), K('チュ', 'chu', 'tyu'), K('チョ', 'cho', 'tyo')]],
      ['nya', [K('ニャ', 'nya'), K('ニュ', 'nyu'), K('ニョ', 'nyo')]],
      ['hya', [K('ヒャ', 'hya'), K('ヒュ', 'hyu'), K('ヒョ', 'hyo')]],
      ['mya', [K('ミャ', 'mya'), K('ミュ', 'myu'), K('ミョ', 'myo')]],
      ['rya', [K('リャ', 'rya'), K('リュ', 'ryu'), K('リョ', 'ryo')]],
      ['gya', [K('ギャ', 'gya'), K('ギュ', 'gyu'), K('ギョ', 'gyo')]],
      ['ja', [K('ジャ', 'ja', 'zya,jya'), K('ジュ', 'ju', 'zyu,jyu'), K('ジョ', 'jo', 'zyo,jyo')]],
      ['bya', [K('ビャ', 'bya'), K('ビュ', 'byu'), K('ビョ', 'byo')]],
      ['pya', [K('ピャ', 'pya'), K('ピュ', 'pyu'), K('ピョ', 'pyo')]],
    ],
  },
  {
    id: 'ext', name: 'Âm mở rộng', note: 'chỉ dùng trong Katakana, cho từ nước ngoài', cols: 4, small: true, kataOnly: true, head: null,
    rows: [
      ['fa', [K('ファ', 'fa'), K('フィ', 'fi'), K('フェ', 'fe'), K('フォ', 'fo')]],
      ['ti', [K('ティ', 'ti'), K('ディ', 'di'), K('トゥ', 'tu'), K('ドゥ', 'du')]],
      ['she', [K('シェ', 'she'), K('ジェ', 'je'), K('チェ', 'che'), K('ヴ', 'vu')]],
      ['wi', [K('ウィ', 'wi'), K('ウェ', 'we'), _, _]],
    ],
  },
];

export const ROWS: KanaRow[] = [];
export const ALL: KanaItem[] = [];
for (const g of GROUPS) {
  for (const [id, cells] of g.rows) {
    const key = g.id + ':' + id;
    const items = cells.filter((c): c is KanaItem => !!c);
    for (const it of items) {
      it.row = key;
      it.group = g.id;
      ALL.push(it);
    }
    ROWS.push({ key, group: g.id, items });
  }
}
/** Tra cứu theo chữ Katakana. */
export const BY: Record<string, KanaItem> = Object.fromEntries(ALL.map((i) => [i.k, i]));
export const BASIC = ALL.filter((i) => i.group === 'basic');
export const groupById = (id: GroupId) => GROUPS.find((g) => g.id === id)!;

/** Chữ hiển thị theo bảng chữ đang chọn. */
export const display = (it: KanaItem, script: Script) => (script === 'hira' ? toHira(it.k) : it.k);
/** Nhóm chữ có dùng được với bảng chữ đang chọn không (âm mở rộng chỉ có ở Katakana). */
export const groupOk = (g: GroupId, script: Script) => !(script === 'hira' && groupById(g).kataOnly);

/** Các nhóm chữ trông giống nhau: dùng làm đáp án nhiễu. */
export const LOOKALIKES: Record<Script, string[][]> = {
  kata: [['シ', 'ツ'], ['ソ', 'ン'], ['ク', 'ケ', 'タ'], ['ウ', 'ワ', 'フ'], ['ス', 'ヌ'], ['チ', 'テ'], ['コ', 'ユ'], ['ノ', 'メ'], ['マ', 'ム'], ['ヲ', 'ラ'], ['ジ', 'ヅ'], ['ン', 'シ'], ['ソ', 'ツ']],
  hira: [['さ', 'ち'], ['き', 'さ'], ['ぬ', 'め'], ['ね', 'れ', 'わ'], ['る', 'ろ'], ['は', 'ほ', 'け'], ['い', 'り'], ['こ', 'に'], ['あ', 'お'], ['し', 'つ'], ['ま', 'も'], ['く', 'へ'], ['う', 'ら'], ['ぬ', 'ね'], ['め', 'の']],
};

export function lookalikes(it: KanaItem, script: Script): KanaItem[] {
  const ch = display(it, script);
  const out = new Set<KanaItem>();
  for (const g of LOOKALIKES[script]) {
    if (!g.includes(ch)) continue;
    for (const x of g) if (x !== ch && BY[toKata(x)]) out.add(BY[toKata(x)]);
  }
  return [...out];
}

export const isKanaChar = (c: string) => /[぀-ヿ]/.test(c);
export const hasKatakana = (s: string) => /[ァ-ヺ]/.test(s);
export const hasHiragana = (s: string) => /[ぁ-ゖ]/.test(s);
export const hasKanji = (s: string) => /[㐀-鿿豈-﫿]/.test(s);
export const hasLatin = (s: string) => /[A-Za-zＡ-Ｚａ-ｚ]/.test(s);
