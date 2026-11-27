// Logic của bàn phím kana trên màn hình (thuần, có test).
import { toHira, toKata } from './kana';

/** Các cột bàn phím (đọc từ phải sang trái như bảng kana). Dấu cách = ô trống. */
export const KB_COLS = ['あいうえお', 'かきくけこ', 'さしすせそ', 'たちつてと', 'なにぬねの', 'はひふへほ', 'まみむめも', 'や ゆ よ', 'らりるれろ', 'わ を ん'];

const PLAIN = 'かきくけこさしすせそたちつてとはひふへほう';
const DAKU = 'がぎぐげござじずぜぞだぢづでどばびぶべぼゔ';
const HA = 'はひふへほ';
const PA = 'ぱぴぷぺぽ';
const BIG = 'あいうえおやゆよつわ';
const SMALL = 'ぁぃぅぇぉゃゅょっゎ';

export type Mark = 'daku' | 'handa' | 'small';

/** Thêm / bỏ dấu cho chữ cuối: か→が→か, は→ぱ→は, ぱ+゛→ば, や→ゃ, つ→っ… */
export function cycleMark(ch: string, kind: Mark): string {
  const h = toHira(ch);
  const isK = h !== ch;
  const back = (x: string) => (isK ? toKata(x) : x);
  const swap = (a: string, b: string) => {
    let i = a.indexOf(h);
    if (i >= 0) return b[i];
    i = b.indexOf(h);
    if (i >= 0) return a[i];
    return null;
  };
  let r: string | null = null;
  if (kind === 'daku') {
    r = swap(PLAIN, DAKU);
    if (!r) {
      const i = PA.indexOf(h);
      if (i >= 0) r = DAKU[15 + i]; // ぱ → ば
    }
  } else if (kind === 'handa') {
    r = swap(HA, PA);
    if (!r) {
      const i = DAKU.indexOf(h);
      if (i >= 15 && i < 20) r = PA[i - 15]; // ば → ぱ
    }
  } else {
    r = swap(BIG, SMALL);
  }
  return r ? back(r) : ch;
}
