// Gõ chữ: mọi từ vựng và câu gõ theo gợi ý romaji đều được chấm đúng; 3 cách nhập; chấm thông minh.
import { expect, go, lessons, pickLesson, test } from './fixtures';
import { typingSentences, typingWords } from '../../src/lib/practice';
import { BY, toHira, toKata } from '../../src/lib/kana';
import { normalizeAnswer, romaToKana } from '../../src/lib/romaji';

const sec = (page: import('@playwright/test').Page) => page.locator('section[data-view="go-chu"]');

async function setup(page: import('@playwright/test').Page, mode: string, method: RegExp) {
  await go(page, 'go-chu');
  const s = sec(page);
  await s.locator('[data-testid="typing-modes"] button', { hasText: mode }).click();
  await s.getByRole('button', { name: method }).click();
  return s;
}

for (const L of lessons()) {
  for (const [mode, count] of [
    ['Từ vựng', typingWords(L).length],
    ['Câu', typingSentences(L).length],
  ] as const) {
    test(`Bài ${L.lesson} · ${mode}: gõ theo gợi ý romaji luôn được chấm đúng (${count} mục)`, async ({ page }) => {
      const s = await setup(page, mode, /Romaji tự đổi/);
      await pickLesson(page, 'go-chu', L.lesson);
      const seen = new Set<string>();
      const input = s.getByTestId('typing-input');
      for (let i = 0; i < count; i++) {
        await s.getByTestId('typing-hint').click();
        const hint = (await s.getByTestId('hint-text').locator('code').textContent())!;
        await input.click();
        await input.pressSequentially(hint);
        await input.press('Enter');
        const fb = s.getByTestId('feedback');
        await expect(fb, `gõ "${hint}"`).toContainText('Đúng!');
        seen.add((await fb.locator('.kana-ans').textContent())!);
        await input.press('Enter');
      }
      expect(seen.size).toBe(count);
    });
  }
}

test('bàn phím của máy (IME): nhập kana → đúng; Enter khi đang chọn chữ (composition) không chấm', async ({ page }) => {
  const s = await setup(page, 'Từ vựng', /Bàn phím của máy/);
  await pickLesson(page, 'go-chu', 1);
  const input = s.getByTestId('typing-input');
  // lấy đáp án bằng nút gợi ý của chế độ romaji rồi quay lại chế độ IME (câu hỏi giữ nguyên)
  await s.getByRole('button', { name: /Romaji tự đổi/ }).click();
  await s.getByTestId('typing-hint').click();
  const answer = romaToKana((await s.getByTestId('hint-text').locator('code').textContent())!, true);
  await s.getByRole('button', { name: /Bàn phím của máy/ }).click();
  await input.fill(answer);
  // giả lập đang gõ IME: compositionstart → Enter không được chấm
  await input.dispatchEvent('compositionstart');
  await input.press('Enter');
  await expect(s.getByTestId('feedback')).not.toContainText('Đúng');
  await input.dispatchEvent('compositionend');
  await input.press('Enter');
  await expect(s.getByTestId('feedback')).toContainText('Đúng!');
});

test('chấm thông minh: Kanji, sai bảng chữ, わ thay cho trợ từ は', async ({ page }) => {
  const s = await setup(page, 'Câu', /Romaji tự đổi/);
  await pickLesson(page, 'go-chu', 1);
  const input = s.getByTestId('typing-input');
  const L1 = lessons()[0];
  const viL1 = new Set(L1.order.map((o) => o.vi));
  await expect.poll(async () => viL1.has(((await s.getByTestId('typing-stage').locator('.sub').first().textContent()) ?? '').trim())).toBe(true);
  let sawParticle = false;
  let sawScript = false;
  for (let i = 0; i < typingSentences(L1).length && !(sawParticle && sawScript); i++) {
    await s.getByTestId('typing-hint').click();
    const answer = normalizeAnswer(romaToKana((await s.getByTestId('hint-text').locator('code').textContent())!, true));
    const item = L1.order.find((o) => normalizeAnswer(o.words.join('')) === answer)!;
    expect(item, 'không tìm thấy câu: ' + answer).toBeTruthy();
    if (!sawParticle && item.words.includes('は')) {
      await input.fill(item.words.map((w) => (w === 'は' ? 'わ' : w)).join(''));
      await input.press('Enter');
      await expect(s.getByTestId('feedback')).toContainText('Trợ từ');
      sawParticle = true;
    } else if (!sawScript && /[ァ-ヺ]/.test(answer)) {
      await input.fill(toHira(answer));
      await input.press('Enter');
      await expect(s.getByTestId('feedback')).toContainText('sai bảng chữ');
      sawScript = true;
    } else {
      await input.fill('漢字');
      await input.press('Enter');
      await expect(s.getByTestId('feedback')).toContainText('Kanji');
    }
    await input.press('Enter');
  }
  expect(sawParticle && sawScript).toBe(true);
});

test('bàn phím kana trên màn hình: gõ chữ cái, ゛ ゜ 小 ー ⌫', async ({ page }) => {
  const s = await setup(page, 'Chữ cái', /Bàn phím kana/);
  const kb = s.getByTestId('kana-keyboard');
  for (let i = 0; i < 5; i++) {
    const romaji = (await s.getByTestId('typing-q').textContent())!.trim();
    const it = Object.values(BY).find((x) => x.group === 'basic' && x.r === romaji)!;
    await kb.getByRole('button', { name: toHira(it.k), exact: true }).click();
    await kb.getByRole('button', { name: 'Kiểm tra' }).click();
    await expect(s.getByTestId('feedback')).toContainText('Đúng!');
    await kb.getByRole('button', { name: 'Kiểm tra' }).click(); // câu tiếp
  }
  // gõ tự do: kiểm tra các phím chức năng
  await s.locator('[data-testid="typing-modes"] button', { hasText: 'Gõ tự do' }).click();
  const input = s.getByRole('textbox', { name: 'Gõ tự do' });
  const key = (k: string) => kb.getByRole('button', { name: k, exact: true }).click();
  await key('か');
  await key('Thêm dấu ゛');
  await expect(input).toHaveValue('が');
  await key('は');
  await key('Thêm dấu ゜');
  await key('Thêm dấu ゛');
  await expect(input).toHaveValue('がば'); // ぱ + ゛ → ば
  await key('つ');
  await key('Đổi chữ nhỏ');
  await key('Trường âm');
  await expect(input).toHaveValue('がばっー');
  await key('Xoá');
  await key('Xoá');
  await expect(input).toHaveValue('がば');
  await key('Đổi Hiragana / Katakana');
  await key(toKata('こ'));
  await expect(input).toHaveValue('がばコ');
});

test('romaji tự đổi: chữ thường → Hiragana, CHỮ HOA → Katakana, nn, -, phụ âm đôi', async ({ page }) => {
  const s = await setup(page, 'Gõ tự do', /Romaji tự đổi/);
  const input = s.getByRole('textbox', { name: 'Gõ tự do' });
  await input.pressSequentially('konnichiha BETONAMU ko-hi- gakkou ho');
  await expect(input).toHaveValue('こんにちは ベトナム こーひー がっこう ほ');
  await input.pressSequentially('n');
  await expect(input).toHaveValue('こんにちは ベトナム こーひー がっこう ほn');
  await s.getByRole('button', { name: '🔊 Nghe' }).click();
  await expect(s.locator('.sub .rmj')).toContainText('Romaji:');
});
