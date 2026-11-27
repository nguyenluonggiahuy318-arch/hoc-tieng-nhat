// Kiểm tra toàn bộ nội dung trong content/ (giống npm run validate, chạy trong npm test).
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ConfusablesSchema, LessonSchema, LoanwordsSchema, SoDemSchema, type Lesson } from '../../src/lib/schema';
import { checkConfusables, checkLesson, checkLoanwords, checkSoDem, hintRoundTrips } from '../../src/lib/checks';
import { orderIsCorrect, sentenceAnswer, typingSentences, typingWords } from '../../src/lib/practice';
import { joinWords } from '../../src/lib/romaji';

const DIR = new URL('../../content/', import.meta.url);
const read = (rel: string) => JSON.parse(fs.readFileSync(new URL(rel, DIR), 'utf8'));
const files = fs.readdirSync(new URL('lessons/', DIR)).filter((f) => /^bai-\d+\.json$/.test(f));

describe.each(files)('%s', (f) => {
  const raw = read('lessons/' + f);
  const parsed = LessonSchema.safeParse(raw);
  it('đúng schema', () => expect(parsed.success ? [] : parsed.error.issues).toEqual([]));
  const L = raw as Lesson;
  it('không có lỗi nội dung', () => expect(checkLesson(L, path.basename(f)).filter((i) => i.level === 'error')).toEqual([]));
  it('đáp án điền chỗ trống nằm trong danh sách lựa chọn', () => {
    for (const q of L.fill) {
      expect(q.options, q.q).toContain(q.answer);
      expect(q.q.split('＿＿').length - 1, q.q).toBe(1);
    }
  });
  it('mọi câu sắp xếp đều giải được', () => {
    for (const o of L.order) {
      // bấm đúng thứ tự các từ đang có trong ngân hàng từ → được chấm đúng
      expect(orderIsCorrect([...o.words], o.words)).toBe(true);
      expect(joinWords(o.words)).toMatch(/。$/);
    }
  });
  it('mọi từ vựng / câu gõ theo gợi ý romaji đều được chấm đúng', () => {
    for (const w of typingWords(L)) expect(hintRoundTrips(w.a), w.a).toBe(true);
    for (const s of typingSentences(L)) expect(hintRoundTrips(s.a), s.a).toBe(true);
  });
  it('câu gõ có đáp án khi không chứa chữ Latin', () => {
    for (const o of L.order) if (!o.words.some((w) => /[A-Za-z]/.test(w))) expect(sentenceAnswer(o)).toBeTruthy();
  });
});

describe('các file nội dung khác', () => {
  it('so-dem.json', () => {
    const d = SoDemSchema.parse(read('so-dem.json'));
    expect(checkSoDem(d).filter((i) => i.level === 'error')).toEqual([]);
  });
  it('tu-muon.json', () => {
    const d = LoanwordsSchema.parse(read('tu-muon.json'));
    expect(checkLoanwords(d)).toEqual([]);
  });
  it('de-nham.json', () => {
    const d = ConfusablesSchema.parse(read('de-nham.json'));
    expect(checkConfusables(d)).toEqual([]);
  });
});
