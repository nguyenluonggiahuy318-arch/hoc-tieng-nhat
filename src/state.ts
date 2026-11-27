// Trạng thái dùng chung toàn app (signals). Các giá trị cần nhớ được lưu vào localStorage.
import { computed, effect, signal, type Signal } from '@preact/signals';
import { ALL, BASIC, ROWS, display, groupOk, type KanaItem, type Script } from './lib/kana';
import { load, store } from './lib/storage';
import { LESSON_NUMBERS } from './lib/content';

export function persisted<T>(key: string, def: T, ok: (v: unknown) => boolean = () => true): Signal<T> {
  const v = load<unknown>(key, def);
  const s = signal<T>(ok(v) ? (v as T) : def);
  effect(() => store(key, s.value));
  return s;
}

export const script = persisted<Script>('script', 'hira', (v) => v === 'hira' || v === 'kata');
export const hideRomaji = persisted<boolean>('hideRomaji', false, (v) => typeof v === 'boolean');
export const lessonNo = persisted<number>('lesson', LESSON_NUMBERS[LESSON_NUMBERS.length - 1] ?? 1, (v) => typeof v === 'number' && LESSON_NUMBERS.includes(v));

// --------------------------------------------------------------- tiến độ chữ cái

export interface Stat {
  c: number; // số lần đúng
  w: number; // số lần sai
  st: number; // chuỗi đúng liên tiếp
}
type Stats = Record<string, Stat>;

/** Khoá là chữ đang hiển thị, nên Hiragana và Katakana được tính riêng. */
export const kanaStats = signal<Stats>(load<Stats>('kana', {}));
export const vocabStats = signal<Stats>(load<Stats>('vocab', {}));

function bump(stats: Signal<Stats>, storeKey: string, key: string, ok: boolean) {
  const prev = stats.value[key] ?? { c: 0, w: 0, st: 0 };
  const next = ok ? { c: prev.c + 1, w: prev.w, st: prev.st + 1 } : { c: prev.c, w: prev.w + 1, st: 0 };
  stats.value = { ...stats.value, [key]: next };
  store(storeKey, stats.value);
}
export const recordKana = (ch: string, ok: boolean) => bump(kanaStats, 'kana', ch, ok);
export const recordVocab = (key: string, ok: boolean) => bump(vocabStats, 'vocab', key, ok);

/** 0 = chưa học, 1 = hay sai (đỏ), 2 = đang học (vàng), 3 = đúng 3 lần liền (xanh). */
export function kanaLevel(ch: string): 0 | 1 | 2 | 3 {
  const s = kanaStats.value[ch];
  if (!s || (!s.c && !s.w)) return 0;
  if (s.st >= 3) return 3;
  if (s.w > s.c) return 1;
  return 2;
}

/** Chữ hay sai được hỏi nhiều hơn, chữ đã thuộc ít hơn. */
export function kanaWeight(it: KanaItem): number {
  const s = kanaStats.value[display(it, script.value)];
  if (!s) return 1.4;
  if (s.st >= 3) return 0.35;
  return Math.max(0.4, 1 + Math.min(s.w, 4) * 0.45 - Math.min(s.st, 2) * 0.25);
}

export const isWeakKana = (ch: string) => {
  const s = kanaStats.value[ch];
  return !!s && s.w > 0 && s.st < 3;
};
export const isWeakWord = (key: string) => {
  const s = vocabStats.value[key];
  return !!s && s.w > 0 && s.st < 2;
};

export function resetKanaStats(sc: Script) {
  const next: Stats = {};
  const mine = new Set(ALL.map((i) => display(i, sc)));
  for (const [k, v] of Object.entries(kanaStats.value)) if (!mine.has(k)) next[k] = v;
  kanaStats.value = next;
  store('kana', next);
}
export function resetVocabStats() {
  vocabStats.value = {};
  store('vocab', {});
}

export const basicLearned = computed(() => BASIC.filter((i) => kanaLevel(display(i, script.value)) === 3).length);

// --------------------------------------------------------------- hàng chữ được chọn

const basicRows = () => ROWS.filter((r) => r.group === 'basic').map((r) => r.key);
export const selectedRows = persisted<string[]>('rows', basicRows(), (v) => Array.isArray(v) && v.every((x) => typeof x === 'string'));

/** Các chữ đang luyện (theo hàng đã chọn và bảng chữ hiện tại). Không bao giờ rỗng. */
export const kanaPool = computed<KanaItem[]>(() => {
  const sel = new Set(selectedRows.value);
  const p = ALL.filter((i) => sel.has(i.row) && groupOk(i.group, script.value));
  return p.length ? p : BASIC.slice();
});

export function setRows(keys: string[]) {
  selectedRows.value = keys.length ? keys : basicRows();
}
