import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { mergeLesson, mergeSoDem, summary } from '../../scripts/merge';
import { lessonHints } from '../../scripts/inbox/scan';
import type { Lesson, SoDem } from '../../src/lib/schema';
import { checkLesson } from '../../src/lib/checks';

const read = <T>(rel: string) => JSON.parse(fs.readFileSync(new URL('../../content/' + rel, import.meta.url), 'utf8')) as T;

describe('gộp nội dung bài', () => {
  const bai3 = read<Lesson>('lessons/bai-3.json');
  const draft = {
    lesson: 3,
    sources: ['mau.pdf'],
    vocab: [
      { group: 'Nơi chốn', items: [{ jp: 'きょうしつ', romaji: 'kyōshitsu', phienam: 'Kyôôshitsư', vi: 'Phòng học' }, { jp: 'じどうはんばいき', romaji: 'jidōhanbaiki', phienam: 'Jiđôôhambaiki', vi: 'Máy bán hàng tự động' }] },
      { group: 'Mới', items: [{ jp: 'デパート', romaji: 'depāto', phienam: 'Đêpaatô', vi: 'Cửa hàng bách hoá' }] },
    ],
    grammar: [{ ...bai3.grammar[0], examples: [...bai3.grammar[0].examples, { jp: 'そこは じむしょです。', romaji: 'Soko wa jimusho desu.', vi: 'Chỗ đó là văn phòng.' }] }],
    fill: [bai3.fill[0]],
    order: [bai3.order[0], { vi: 'Chỗ kia là văn phòng.', words: ['あそこ', 'は', 'じむしょ', 'です'] }],
    corrections: ["PDF ghi 'なしょ' → sửa thành 'ばしょ'", 'Ví dụ sửa lỗi mới'],
  };

  it('chỉ thêm mục mới, không tạo trùng, không mất mục cũ', () => {
    const { lesson, stats } = mergeLesson(bai3, draft);
    expect(stats).toMatchObject({ vocab: 2, grammar: 0, examples: 1, fill: 0, order: 1, corrections: 1, created: false });
    const n = (L: Lesson) => L.vocab.reduce((a, g) => a + g.items.length, 0);
    expect(n(lesson)).toBe(n(bai3) + 2);
    expect(lesson.vocab.find((g) => g.group === 'Mới')?.items).toHaveLength(1);
    expect(lesson.grammar[0].examples.length).toBe(bai3.grammar[0].examples.length + 1);
    expect(lesson.sources).toContain('mau.pdf');
    expect(checkLesson(lesson, 'bai-3.json').filter((i) => i.level === 'error')).toEqual([]);
    expect(summary(stats)).toBe('Bài 3: +2 từ, +0 mẫu ngữ pháp, +1 ví dụ, +0 câu điền, +1 câu sắp xếp, 1 chỗ sửa lỗi tài liệu');
  });

  it('gộp lần hai cùng nội dung thì không thêm gì', () => {
    const once = mergeLesson(bai3, draft).lesson;
    const { lesson, stats } = mergeLesson(once, draft);
    expect(stats).toMatchObject({ vocab: 0, grammar: 0, examples: 0, fill: 0, order: 0, corrections: 0 });
    expect(lesson).toEqual(once);
  });

  it('bài chưa có thì tạo mới; phiên âm thiếu thì bổ sung', () => {
    const { lesson, stats } = mergeLesson(null, { lesson: 7, vocab: [{ group: 'A', items: [{ jp: 'ほん', romaji: 'hon', phienam: '', vi: 'Sách' }] }] });
    expect(stats.created).toBe(true);
    expect(lesson.title).toBe('だい７か');
    const { lesson: l2, stats: s2 } = mergeLesson(lesson, { lesson: 7, vocab: [{ group: 'A', items: [{ jp: 'ほん', romaji: 'hon', phienam: 'Hon', vi: 'Sách' }] }] });
    expect(s2.vocab).toBe(0);
    expect(s2.filled).toContain('phiên âm của ほん');
    expect(l2.vocab[0].items[0].phienam).toBe('Hon');
  });

  it('thêm đơn vị đếm mới vào so-dem.json, không đè đơn vị cũ', () => {
    const soDem = read<SoDem>('so-dem.json');
    const st = mergeLesson(bai3, { lesson: 3 }).stats;
    const out = mergeSoDem(
      soDem,
      {
        lesson: 4,
        counters: [
          { id: 'thu-nghiem', name: 'Thử nghiệm', lesson: 99, suffix: 'じ', label: '{n} giờ', digit: { '4': 'よじ', '7': 'しちじ', '9': 'くじ' }, range: [1, 24], table: [1, 4, 7, 9] },
          { ...soDem.counters[0], name: 'Đè lên tuổi' },
        ],
        pages: [{ id: 'thu-nghiem', title: 'Thử nghiệm', counters: ['thu-nghiem'] }],
      },
      st,
    );
    expect(out.counters.map((c) => c.id)).toEqual([...soDem.counters.map((c) => c.id), 'thu-nghiem']);
    expect(out.counters[0].name).toBe('Tuổi');
    expect(out.pages.at(-1)?.id).toBe('thu-nghiem');
    expect(st.counters).toEqual(['Thử nghiệm']);
  });
});

describe('đoán số bài từ tên file / nội dung', () => {
  it.each([
    ['NGU_PHAP_BAI_3.pdf', 3],
    ['文法第3課_NPbai3.mp4', 3],
    ['だい４か ことば', 4],
    ['第十二課', 12],
    ['Bài 5 - từ vựng.docx', 5],
    ['lesson-07.png', 7],
  ])('%s → Bài %i', (s, n) => expect(lessonHints(s, 'x').map((h) => h.lesson)).toContain(n));
  it('không bịa số bài', () => expect(lessonHints('anh-chup-man-hinh-2026.png', 'x')).toEqual([]));
});
