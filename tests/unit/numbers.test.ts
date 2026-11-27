import fs from 'node:fs';
import { describe, expect, it } from 'vitest';
import { isIrregularCounter, isIrregularNumber, numberParts, plainNumber, readCounter, readNumber, readNumberSpaced, trapReading } from '../../src/lib/numbers';
import type { SoDem } from '../../src/lib/schema';

const soDem = JSON.parse(fs.readFileSync(new URL('../../content/so-dem.json', import.meta.url), 'utf8')) as SoDem;
const C = (id: string) => soDem.counters.find((c) => c.id === id)!;

describe('đọc số', () => {
  it.each([
    [0, 'ぜろ'],
    [4, 'よん'],
    [7, 'なな'],
    [9, 'きゅう'],
    [10, 'じゅう'],
    [11, 'じゅういち'],
    [25, 'にじゅうご'],
    [99, 'きゅうじゅうきゅう'],
    [100, 'ひゃく'],
    [300, 'さんびゃく'],
    [600, 'ろっぴゃく'],
    [800, 'はっぴゃく'],
    [368, 'さんびゃくろくじゅうはち'],
    [1000, 'せん'],
    [3000, 'さんぜん'],
    [8000, 'はっせん'],
    [6000, 'ろくせん'],
    [10000, 'いちまん'],
    [18000, 'いちまんはっせん'],
    [100000, 'じゅうまん'],
    [1000000, 'ひゃくまん'],
    [10000000, 'いっせんまん'],
    [38000000, 'さんぜんはっぴゃくまん'],
  ])('%i → %s', (n, r) => expect(readNumber(n)).toBe(r));

  it('đọc tách hàng', () => {
    expect(readNumberSpaced(368)).toBe('さんびゃく ろくじゅう はち');
    expect(numberParts(18000)).toEqual([
      [10000, 'いちまん'],
      [8000, 'はっせん'],
    ]);
  });
  it('số biến âm được đánh dấu', () => {
    for (const n of [300, 600, 800, 3000, 8000, 10000000]) expect(isIrregularNumber(n), String(n)).toBe(true);
    for (const n of [100, 200, 400, 500, 700, 900, 1000, 2000, 4000, 9000, 10000]) expect(isIrregularNumber(n), String(n)).toBe(false);
  });
  it('đáp án nhiễu là cách đọc sai hay gặp', () => {
    expect(trapReading(300)).toBe('さんひゃく');
    expect(trapReading(8000)).toBe('はちせん');
    expect(trapReading(100)).toBe('いちひゃく');
    expect(plainNumber(800)).toBe('はちひゃく');
  });
  it('số ngoài phạm vi báo lỗi', () => expect(() => readNumber(100000000)).toThrow());
});

describe('đơn vị đếm trong content/so-dem.json', () => {
  it.each([
    ['tuoi', 1, 'いっさい'],
    ['tuoi', 3, 'さんさい'],
    ['tuoi', 8, 'はっさい'],
    ['tuoi', 10, 'じゅっさい'],
    ['tuoi', 11, 'じゅういっさい'],
    ['tuoi', 18, 'じゅうはっさい'],
    ['tuoi', 20, 'はたち'],
    ['tuoi', 21, 'にじゅういっさい'],
    ['tuoi', 30, 'さんじゅっさい'],
    ['tuoi', 70, 'ななじゅっさい'],
    ['tuoi', 100, 'ひゃくさい'],
    ['tang', 1, 'いっかい'],
    ['tang', 2, 'にかい'],
    ['tang', 3, 'さんがい'],
    ['tang', 4, 'よんかい'],
    ['tang', 6, 'ろっかい'],
    ['tang', 8, 'はっかい'],
    ['tang', 10, 'じゅっかい'],
    ['tang', 13, 'じゅうさんがい'],
    ['quan', 1, 'いっく'],
    ['quan', 6, 'ろっく'],
    ['quan', 8, 'はっく'],
    ['quan', 10, 'じゅっく'],
    ['quan', 11, 'じゅういっく'],
    ['quan', 12, 'じゅうにく'],
    ['gia', 4, 'よえん'],
    ['gia', 100, 'ひゃくえん'],
    ['gia', 3800, 'さんぜんはっぴゃくえん'],
    ['gia', 18000, 'いちまんはっせんえん'],
  ] as const)('%s %i → %s', (id, n, r) => expect(readCounter(n, C(id))).toBe(r));

  it('giá tiền đọc tách hàng', () => {
    expect(readCounter(3800, C('gia'), { spaced: true })).toBe('さんぜん はっぴゃく えん');
    expect(readCounter(9500, C('gia'), { spaced: true })).toBe('きゅうせん ごひゃく えん');
  });
  it('biến âm của tuổi / tầng được đánh dấu đỏ', () => {
    expect([1, 8, 10, 11, 18, 20, 30].every((n) => isIrregularCounter(n, C('tuoi')))).toBe(true);
    expect([2, 3, 5, 15, 100].some((n) => isIrregularCounter(n, C('tuoi')))).toBe(false);
    expect([1, 3, 6, 8, 10].every((n) => isIrregularCounter(n, C('tang')))).toBe(true);
    expect([2, 4, 5, 7, 9].some((n) => isIrregularCounter(n, C('tang')))).toBe(false);
  });
  it('mọi số trong bảng của mỗi đơn vị đều đọc được', () => {
    for (const c of soDem.counters) for (const n of c.table) expect(readCounter(n, c).length).toBeGreaterThan(0);
  });
  it('đáp án nhiễu cho tầng 3 là さんかい', () => expect(trapReading(3, C('tang'))).toBe('さんかい'));
});
