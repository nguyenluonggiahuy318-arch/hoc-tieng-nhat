import { describe, expect, it } from 'vitest';
import { ALL, toHira } from '../../src/lib/kana';
import { joinWords, kanaToRomaji, looseRomaji, normalizeAnswer, romajiMatches, romaToKana, speakable, typingHint } from '../../src/lib/romaji';
import { cycleMark } from '../../src/lib/kbd';

describe('kanaToRomaji (Hepburn)', () => {
  it.each([
    ['きょうしつ', 'kyōshitsu'],
    ['がっこう', 'gakkō'],
    ['ちゅうごく', 'chūgoku'],
    ['コーヒー', 'kōhī'],
    ['エレベーター', 'erebētā'],
    ['おおさか', 'ōsaka'],
    ['おかあさん', 'okāsan'],
    ['おねえさん', 'onēsan'],
    ['せんせい', 'sensei'],
    ['いいえ', 'iie'],
    ['しんぶん', 'shinbun'],
    ['ほんや', "hon'ya"],
    ['マッチ', 'matchi'],
    ['ふじ', 'fuji'],
    ['パーティー', 'pātī'],
    ['ぢ', 'ji'],
    ['を', 'o'],
  ])('%s → %s', (kana, r) => expect(kanaToRomaji(kana)).toBe(r));

  it('viết hoa chữ đầu, đổi dấu câu', () => {
    expect(kanaToRomaji('リン', { capitalize: true })).toBe('Rin');
    expect(kanaToRomaji('はい、そうです。')).toBe('hai, sōdesu.');
  });
  it('không dùng dấu gạch: kéo dài bằng nguyên âm', () => {
    expect(kanaToRomaji('コーヒー', { macrons: false })).toBe('koohii');
    expect(kanaToRomaji('きょう', { macrons: false })).toBe('kyou');
  });
});

describe('romaToKana (romaji tự đổi)', () => {
  it.each([
    ['konnichiha', 'こんにちは'],
    ['kon\'nichiha', 'こんにちは'],
    ['BETONAMU', 'ベトナム'],
    ['ko-hi-', 'こーひー'],
    ['KO-HI-', 'コーヒー'],
    ['gakkou', 'がっこう'],
    ['matchi', 'まっち'],
    ['hon', 'ほん'],
    // giống app gốc: "nn" + nguyên âm / y → ん + hàng な (konnichiha → こんにちは); muốn ほんや thì gõ hon'ya
    ['honnya', 'ほんにゃ'],
    ['hon\'ya', 'ほんや'],
    ['kya', 'きゃ'],
    ['xya', 'ゃ'],
    ['TAIjin', 'タイじん'],
    ['thi', 'てぃ'],
    ['di', 'ぢ'],
    ['wo', 'を'],
    ['shi chi tsu fu ji', 'し ち つ ふ じ'],
    ['si ti tu hu zi', 'し ち つ ふ じ'],
  ])('%s → %s', (r, k) => expect(romaToKana(r, true)).toBe(k));

  it('đang gõ dở thì giữ lại phần chưa đủ', () => {
    expect(romaToKana('ky', false)).toBe('ky');
    expect(romaToKana('kon', false)).toBe('こn');
    expect(romaToKana('konn', false)).toBe('こnn');
    expect(romaToKana('kon', true)).toBe('こん');
  });
  it('bật ア thì mọi chữ ra Katakana', () => expect(romaToKana('terebi', true, true)).toBe('テレビ'));
});

describe('typingHint: gõ theo gợi ý luôn ra đúng chữ', () => {
  it('mọi chữ trong bảng (Hiragana và Katakana)', () => {
    for (const it of ALL) {
      for (const ch of [it.k, toHira(it.k)]) expect(romaToKana(typingHint(ch), true), ch).toBe(ch);
    }
  });
  it.each(['きょうしつ', 'コンピューター', 'けしゴム', 'こんにちは', 'ほんや', 'れんあい', 'スペインご', 'パーティー', 'マッチ', 'きって', 'ぢゃ', 'ヴ', 'ファイル', 'ウィ', 'ディズニー', 'トゥ', 'っ', 'あっ', 'ペンネーム', 'かんい'])('%s', (w) => {
    expect(romaToKana(typingHint(w), true)).toBe(w);
  });
});

describe('so khớp romaji trong dữ liệu', () => {
  it('chấp nhận cách viết đúng', () => {
    expect(romajiMatches('こんにちは', 'konnichiwa')).toBe(true);
    expect(romajiMatches('ホーチミンし', 'Hōchimin-shi')).toBe(true);
    expect(romajiMatches('～を みせて ください', '~ o misete kudasai')).toBe(true);
    expect(romajiMatches('おおさか', 'Ōsaka')).toBe(true);
    expect(romajiMatches('しんぶん', 'shimbun')).toBe(true);
  });
  it('bắt lỗi chính tả', () => {
    expect(romajiMatches('きょうしつ', 'kyoshitsu')).toBe(false);
    expect(romajiMatches('がっこう', 'gakou')).toBe(false);
    expect(romajiMatches('せんせい', 'sensē')).toBe(false);
    expect(romajiMatches('ほん', 'hon desu')).toBe(false);
  });
  it('looseRomaji gộp trường âm', () => expect(looseRomaji('Kōhī')).toBe(looseRomaji('koohii')));
});

describe('tiện ích', () => {
  it('normalizeAnswer bỏ dấu cách, dấu câu, ～', () => expect(normalizeAnswer('～を みせて、ください。')).toBe('をみせてください'));
  it('speakable bỏ ghi chú và A:/B:', () => expect(speakable('A: これは ほんです。(sách) B: はい')).toBe('これはほんです。はい'));
  it('joinWords ghép câu tự nhiên', () => {
    expect(joinWords(['わたし', 'は', 'ベトナムじん', 'です'])).toBe('わたしは ベトナムじんです。');
    expect(joinWords(['いいえ、', 'わたし', 'の', 'じゃ ありません'])).toBe('いいえ、わたしのじゃ ありません。');
    expect(joinWords(['それ', 'は', 'ボールペン', 'です', 'か、', 'シャープペンシル', 'です', 'か'])).toBe('それは ボールペンですか、シャープペンシルですか。');
  });
});

describe('bàn phím kana: ゛ ゜ 小', () => {
  it.each([
    ['か', 'daku', 'が'],
    ['が', 'daku', 'か'],
    ['う', 'daku', 'ゔ'],
    ['は', 'handa', 'ぱ'],
    ['ぱ', 'handa', 'は'],
    ['ぱ', 'daku', 'ば'],
    ['ば', 'handa', 'ぱ'],
    ['ほ', 'daku', 'ぼ'],
    ['つ', 'small', 'っ'],
    ['っ', 'small', 'つ'],
    ['や', 'small', 'ゃ'],
    ['カ', 'daku', 'ガ'],
    ['ハ', 'handa', 'パ'],
    ['ん', 'daku', 'ん'],
  ] as const)('%s + %s → %s', (ch, m, out) => expect(cycleMark(ch, m)).toBe(out));
});
