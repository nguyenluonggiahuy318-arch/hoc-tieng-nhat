// Bảng chữ, thẻ nhớ, trắc nghiệm, chọn hàng chữ, ẩn romaji, phím tắt.
import { expect, go, spoken, test } from './fixtures';
import { BY, toKata } from '../../src/lib/kana';

const romajiOf = (ch: string) => BY[toKata(ch)].r;

test('bảng chữ: bấm để nghe, đổi Hiragana/Katakana, âm mở rộng chỉ có ở Katakana', async ({ page }) => {
  await go(page, 'bang-chu');
  const chart = page.getByTestId('chart');
  await chart.getByRole('button', { name: 'あ a' }).click();
  expect((await spoken(page)).at(-1)).toEqual({ text: 'あ', inEvent: true });
  await expect(page.locator('h2', { hasText: 'Âm mở rộng' })).toHaveCount(0);
  await page.getByRole('button', { name: /Katakana/ }).first().click();
  await expect(chart.getByRole('button', { name: 'ア a' })).toBeVisible();
  await expect(page.locator('h2', { hasText: 'Âm mở rộng' })).toHaveCount(1);
  await expect(page.locator('h1')).toContainText('カタカナ');
  // lựa chọn được nhớ sau khi tải lại
  await page.reload();
  await expect(chart.getByRole('button', { name: 'ア a' })).toBeVisible();
});

test('trắc nghiệm: phím 1–4 chọn, Enter câu tiếp, tiến độ tính riêng từng bảng chữ', async ({ page }) => {
  await go(page, 'luyen-tap');
  const quiz = page.getByTestId('kana-quiz');
  for (let i = 0; i < 6; i++) {
    const ch = (await quiz.getByTestId('question').textContent())!.trim();
    const texts = await quiz.getByTestId('choices').locator('button').allTextContents();
    const idx = texts.findIndex((t) => t.replace(/^\d/, '') === romajiOf(ch));
    expect(idx).toBeGreaterThanOrEqual(0);
    await page.keyboard.press(String(idx + 1));
    await expect(quiz.getByTestId('feedback')).toContainText('Đúng!');
    await page.keyboard.press('Enter');
    await expect(quiz.getByTestId('feedback')).not.toContainText('Đúng!');
  }
  await expect(quiz.getByTestId('score-q')).toHaveText('6');
  // chọn sai một câu → hiện đáp án và nút Tiếp
  const ch = (await quiz.getByTestId('question').textContent())!.trim();
  const texts = await quiz.getByTestId('choices').locator('button').allTextContents();
  const wrong = texts.findIndex((t) => t.replace(/^\d/, '') !== romajiOf(ch));
  await quiz.getByTestId('choices').locator('button').nth(wrong).click();
  await expect(quiz.getByTestId('feedback')).toContainText('Chưa đúng');
  await expect(quiz.getByTestId('choices').locator('button.right')).toHaveCount(1);
  // bảng chữ có chấm tiến độ
  await go(page, 'bang-chu');
  expect(await page.locator('.dot[data-level="1"], .dot[data-level="2"]').count()).toBeGreaterThan(0);
  // Katakana chưa học gì
  await page.getByRole('button', { name: /Katakana/ }).first().click();
  await expect(page.locator('.dot[data-level="1"], .dot[data-level="2"], .dot[data-level="3"]')).toHaveCount(0);
});

test('trắc nghiệm romaji → chữ và gõ romaji', async ({ page }) => {
  await go(page, 'luyen-tap');
  const quiz = page.getByTestId('kana-quiz');
  await quiz.getByRole('button', { name: 'Romaji → chữ' }).click();
  const r = (await quiz.getByTestId('question').textContent())!.trim();
  const texts = await quiz.getByTestId('choices').locator('button').allTextContents();
  const idx = texts.findIndex((t) => romajiOf(t.replace(/^\d/, '')) === r);
  await quiz.getByTestId('choices').locator('button').nth(idx).click();
  await expect(quiz.getByTestId('feedback')).toContainText('Đúng!');
  await quiz.getByRole('button', { name: 'Gõ romaji' }).click();
  const ch = (await quiz.getByTestId('question').textContent())!.trim();
  const box = quiz.getByRole('textbox', { name: 'Cách đọc' });
  await box.fill(romajiOf(ch).toUpperCase());
  await box.press('Enter');
  await expect(quiz.getByTestId('feedback')).toContainText('Đúng!');
});

test('thẻ nhớ: Space lật thẻ, thẻ "Chưa nhớ" quay lại sau 3 thẻ', async ({ page }) => {
  await go(page, 'the-nho');
  const cards = page.getByTestId('kana-cards');
  const front = async () => (await cards.locator('.face:not(.back) .k').textContent())!;
  const first = await front();
  await page.keyboard.press(' ');
  await expect(cards.getByTestId('flash')).toHaveClass(/flipped/);
  await page.keyboard.press('1'); // chưa nhớ
  for (let i = 0; i < 3; i++) {
    expect(await front()).not.toBe(first);
    await cards.getByRole('button', { name: 'Nhớ rồi' }).click();
  }
  expect(await front()).toBe(first);
});

test('chọn hàng chữ: nhanh, đếm số chữ, "Chỉ chữ hay sai"', async ({ page }) => {
  await go(page, 'luyen-tap');
  const picker = page.locator('section[data-view="luyen-tap"] [data-testid="row-picker"]');
  await picker.locator('summary').click();
  await picker.getByRole('button', { name: 'Tất cả' }).click();
  await expect(picker.locator('summary .count')).toHaveText('104 chữ ▾');
  await picker.getByRole('button', { name: 'Chỉ cơ bản' }).click();
  await expect(picker.locator('summary .count')).toHaveText('46 chữ ▾');
  await picker.getByRole('button', { name: 'Chỉ chữ hay sai' }).click();
  await expect(picker.getByRole('button', { name: 'Chưa có chữ hay sai' })).toBeVisible();
  // bỏ chọn hàng "a" → còn 41 chữ
  await picker.locator('.chip', { hasText: 'あ' }).click();
  await expect(picker.locator('summary .count')).toHaveText('41 chữ ▾');
});

test('ẩn romaji: làm mờ toàn app, chạm để xem riêng chỗ đó; romaji là đáp án thì không ẩn', async ({ page }) => {
  await go(page, 'bang-chu');
  await page.getByTestId('toggle-romaji').click();
  await expect(page.locator('body')).toHaveClass(/hide-romaji/);
  const r = page.getByTestId('chart').locator('.rmj').first();
  expect(await r.evaluate((e) => getComputedStyle(e).filter)).toContain('blur');
  await r.click();
  expect(await r.evaluate((e) => getComputedStyle(e).filter)).toBe('none');
  // trong trắc nghiệm chữ → romaji, các đáp án romaji vẫn rõ
  await go(page, 'luyen-tap');
  const choice = page.getByTestId('kana-quiz').getByTestId('choices').locator('button').first();
  expect(await choice.evaluate((e) => getComputedStyle(e).filter)).toBe('none');
  await page.reload();
  await expect(page.locator('body')).toHaveClass(/hide-romaji/);
});
