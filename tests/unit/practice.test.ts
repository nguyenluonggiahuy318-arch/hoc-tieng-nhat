import { describe, expect, it } from 'vitest';
import { gradeTyping } from '../../src/lib/practice';
import { Deck } from '../../src/lib/random';
import { checkLesson, htmlProblems } from '../../src/lib/checks';
import type { Lesson } from '../../src/lib/schema';

describe('chấm bài gõ', () => {
  it('đúng (bỏ qua dấu cách, dấu câu)', () => expect(gradeTyping('わたしは がくせいです。', 'わたしはがくせいです')).toEqual({ ok: true }));
  it('có Kanji', () => expect(gradeTyping('私', 'わたし')).toEqual({ ok: false, reason: 'kanji' }));
  it('đúng âm, sai bảng chữ', () => expect(gradeTyping('べとなむ', 'ベトナム')).toEqual({ ok: false, reason: 'script' }));
  it('gõ わ thay trợ từ は', () => expect(gradeTyping('わたしわがくせいです', 'わたしはがくせいです')).toEqual({ ok: false, reason: 'particle' }));
  it('gõ お thay trợ từ を', () => expect(gradeTyping('これおください', 'これをください')).toEqual({ ok: false, reason: 'particle' }));
  it('sai hẳn', () => expect(gradeTyping('ほん', 'ノート')).toEqual({ ok: false, reason: 'wrong' }));
});

describe('Deck: đi hết mọi câu rồi mới lặp, không lặp ngay câu vừa ra', () => {
  it('mỗi vòng gồm đủ các phần tử', () => {
    const d = new Deck([1, 2, 3, 4, 5]);
    for (let round = 0; round < 20; round++) {
      const seen = new Set(Array.from({ length: 5 }, () => d.next()));
      expect(seen.size).toBe(5);
    }
  });
  it('không lặp liền nhau giữa hai vòng', () => {
    const d = new Deck(['a', 'b']);
    let prev = d.next();
    for (let i = 0; i < 200; i++) {
      const x = d.next();
      expect(x).not.toBe(prev);
      prev = x;
    }
  });
});

describe('bộ kiểm tra nội dung bắt được lỗi', () => {
  const base: Lesson = {
    lesson: 9,
    title: 'だい９か',
    sources: [],
    vocab: [{ group: 'A', items: [{ jp: 'ほん', romaji: 'hon', phienam: 'Hon', vi: 'Sách' }] }],
    grammar: [],
    fill: [],
    order: [],
    corrections: [],
  };
  const errs = (L: Lesson, f = 'bai-9.json') => checkLesson(L, f).filter((i) => i.level === 'error').map((i) => i.msg);
  it('bài hợp lệ', () => expect(errs(base)).toEqual([]));
  it('sai tên file', () => expect(errs(base, 'bai-8.json').join()).toContain('không khớp tên file'));
  it('romaji sai', () => {
    const L = structuredClone(base);
    L.vocab[0].items[0].romaji = 'hin';
    expect(errs(L).join()).toContain('romaji');
  });
  it('từ trùng', () => {
    const L = structuredClone(base);
    L.vocab.push({ group: 'B', items: [{ jp: 'ほん', romaji: 'hon', phienam: '', vi: 'Sách' }] });
    expect(errs(L).join()).toContain('trùng');
  });
  it('đáp án không có trong lựa chọn / thiếu chỗ trống', () => {
    const L = structuredClone(base);
    L.fill.push({ q: 'これは ほんです。', options: ['は', 'も'], answer: 'の', vi: '…', why: '…' });
    const e = errs(L).join();
    expect(e).toContain('không có trong danh sách lựa chọn');
    expect(e).toContain('đúng 1 chỗ trống');
  });
  it('HTML không an toàn', () => {
    expect(htmlProblems('<b>ok</b> <a href="#so-dem">x</a>')).toEqual([]);
    expect(htmlProblems('<script>alert(1)</script>').length).toBeGreaterThan(0);
    expect(htmlProblems('<b onclick="x()">a</b>').length).toBeGreaterThan(0);
    expect(htmlProblems('<a href="javascript:x">a</a>').length).toBeGreaterThan(0);
  });
});
