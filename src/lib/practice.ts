// Các hàm thuần (không đụng DOM) dùng cho phần luyện tập: lấy danh sách từ để gõ,
// đáp án câu, chấm bài gõ… Dùng chung cho app, validate và test.
import type { Lesson, OrderItem, VocabItem } from './schema';
import { hasKanji, hasLatin, toHira } from './kana';
import { kanaToRomaji, normalizeAnswer } from './romaji';

export interface FlatWord extends VocabItem {
  group: string;
  /** Khoá duy nhất trong bài, dùng để lưu tiến độ. */
  key: string;
}

export function flatVocab(L: Lesson): FlatWord[] {
  const out: FlatWord[] = [];
  for (const g of L.vocab) for (const w of g.items) out.push({ ...w, group: g.group, key: `${L.lesson}:${w.jp}` });
  return out;
}

export interface TypingItem {
  /** Đề bằng romaji. */
  q: string;
  /** Đề bằng nghĩa tiếng Việt. */
  vi: string;
  /** Nhóm / ghi chú nhỏ dưới đề. */
  sec?: string;
  /** Đáp án (kana). */
  a: string;
}

const typable = (s: string) => !hasLatin(s) && !hasKanji(s) && normalizeAnswer(s).length > 0;

/** Từ vựng dùng để luyện gõ (bỏ từ có chữ Latin/Kanji và cụm quá dài). */
export function typingWords(L: Lesson): TypingItem[] {
  return flatVocab(L)
    .filter((w) => typable(w.jp) && normalizeAnswer(w.jp).length <= 12)
    .map((w) => ({ q: w.romaji, vi: w.vi, sec: w.group, a: w.jp }));
}

const PARTICLE: Record<string, string> = { は: 'wa', を: 'o', へ: 'e' };

/** Đáp án khi gõ cả câu (các từ viết liền), hoặc null nếu câu có chữ không gõ được. */
export function sentenceAnswer(o: OrderItem): string | null {
  return o.words.some((w) => !typable(w)) ? null : o.words.join('');
}

export function typingSentences(L: Lesson): TypingItem[] {
  const out: TypingItem[] = [];
  for (const o of L.order) {
    const a = sentenceAnswer(o);
    if (!a) continue;
    const q = o.words.map((w) => PARTICLE[w] ?? kanaToRomaji(w)).join(' ');
    out.push({ q, vi: o.vi, sec: 'Gõ cả câu (không cần dấu cách)', a });
  }
  return out;
}

export type TypingVerdict =
  | { ok: true }
  | { ok: false; reason: 'kanji' | 'script' | 'particle' | 'wrong' };

/** Chấm câu trả lời gõ: báo Kanji, sai bảng chữ, gõ わ/お/え thay trợ từ は/を/へ. */
export function gradeTyping(input: string, answer: string): TypingVerdict {
  const u = normalizeAnswer(input);
  const t = normalizeAnswer(answer);
  if (u === t) return { ok: true };
  if (hasKanji(u)) return { ok: false, reason: 'kanji' };
  const uh = toHira(u), th = toHira(t);
  if (uh === th) return { ok: false, reason: 'script' };
  if (
    uh.length === th.length &&
    [...th].every((c, i) => c === uh[i] || (c === 'は' && uh[i] === 'わ') || (c === 'を' && uh[i] === 'お') || (c === 'へ' && uh[i] === 'え'))
  )
    return { ok: false, reason: 'particle' };
  return { ok: false, reason: 'wrong' };
}

/** Câu sắp xếp đúng khi từng vị trí trùng chữ với đáp án (các từ giống nhau đổi chỗ được). */
export const orderIsCorrect = (built: string[], words: string[]) =>
  built.length === words.length && built.every((w, i) => w === words[i]);
