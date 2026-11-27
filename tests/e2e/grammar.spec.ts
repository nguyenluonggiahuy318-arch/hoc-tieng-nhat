// Ngữ pháp: mọi câu điền chỗ trống và mọi câu sắp xếp của mọi bài đều giải được qua giao diện.
import type { Locator } from '@playwright/test';
import { expect, go, lessons, pickLesson, test } from './fixtures';
import { joinWords } from '../../src/lib/romaji';

async function choiceIndex(choices: Locator, label: string): Promise<number> {
  const texts = await choices.locator('button').allTextContents();
  // mỗi nút có số thứ tự 1–4 ở đầu
  return texts.findIndex((t) => t.replace(/^\d/, '').trim() === label);
}

for (const L of lessons()) {
  test(`Bài ${L.lesson}: mọi câu điền chỗ trống chấm đúng (phím 1–4, Enter)`, async ({ page }) => {
    await go(page, 'ngu-phap');
    await pickLesson(page, 'ngu-phap', L.lesson);
    const sec = page.locator('section[data-view="ngu-phap"]');
    await sec.locator('[data-testid="grammar-modes"] button', { hasText: 'Điền vào chỗ trống' }).click();
    const seen = new Set<string>();
    for (let i = 0; i < L.fill.length; i++) {
      const shown = (await sec.getByTestId('fill-q').textContent())!;
      const item = L.fill.find((f) => f.q.replace('＿＿', '？') === shown);
      expect(item, 'không tìm thấy câu đang hiện: ' + shown).toBeTruthy();
      seen.add(item!.q);
      const idx = await choiceIndex(sec.getByTestId('choices'), item!.answer);
      expect(idx, `đáp án "${item!.answer}" phải có trong các lựa chọn`).toBeGreaterThanOrEqual(0);
      await page.keyboard.press(String(idx + 1));
      await expect(sec.getByTestId('feedback')).toContainText('Đúng!');
      await expect(sec.getByTestId('fill-q')).toContainText(item!.answer);
      await page.keyboard.press('Enter');
    }
    expect(seen.size, 'phải đi qua hết các câu').toBe(L.fill.length);
  });

  test(`Bài ${L.lesson}: mọi câu sắp xếp đều giải được`, async ({ page }) => {
    await go(page, 'ngu-phap');
    await pickLesson(page, 'ngu-phap', L.lesson);
    const sec = page.locator('section[data-view="ngu-phap"]');
    await sec.locator('[data-testid="grammar-modes"] button', { hasText: 'Sắp xếp câu' }).click();
    const seen = new Set<string>();
    for (let i = 0; i < L.order.length; i++) {
      const vi = (await sec.getByTestId('order-vi').textContent())!;
      const bank = (await sec.getByTestId('order-bank').locator('button').allTextContents()).sort();
      const item = L.order.find((o) => o.vi === vi && JSON.stringify([...o.words].sort()) === JSON.stringify(bank));
      expect(item, 'không tìm thấy câu: ' + vi).toBeTruthy();
      seen.add(item!.words.join('|'));
      for (const w of item!.words) {
        await sec.getByTestId('order-bank').getByRole('button', { name: w, exact: true }).first().click();
      }
      await sec.getByTestId('order-check').click();
      await expect(sec.getByTestId('feedback')).toContainText('Đúng!');
      await expect(sec.getByTestId('feedback')).toContainText(joinWords(item!.words));
      await sec.getByTestId('order-check').click(); // Câu tiếp →
    }
    expect(seen.size).toBe(L.order.length);
  });
}

test('sắp xếp sai thì báo câu đúng; chưa dùng hết từ thì nhắc', async ({ page }) => {
  await go(page, 'ngu-phap');
  const sec = page.locator('section[data-view="ngu-phap"]');
  await sec.locator('[data-testid="grammar-modes"] button', { hasText: 'Sắp xếp câu' }).click();
  await sec.getByTestId('order-check').click();
  await expect(sec.getByTestId('feedback')).toContainText('chưa dùng hết');
  // bấm các từ theo thứ tự đang xáo (đã được đảm bảo khác thứ tự đúng)
  const n = await sec.getByTestId('order-bank').locator('button').count();
  for (let i = 0; i < n; i++) await sec.getByTestId('order-bank').locator('button:not(.used)').first().click();
  await sec.getByTestId('order-check').click();
  await expect(sec.getByTestId('feedback')).toContainText('Câu đúng');
});

test('lý thuyết: có ví dụ, bấm 🔊 để nghe, bảng hiển thị', async ({ page }) => {
  await go(page, 'ngu-phap');
  await pickLesson(page, 'ngu-phap', 3);
  const sec = page.locator('section[data-view="ngu-phap"]');
  await expect(sec.locator('.gcard').first()).toBeVisible();
  await expect(sec.locator('.ktable').first()).toBeVisible();
  await sec.locator('.gex .sp').first().click();
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: { text: string }[] }).__spoken);
  expect(spoken.at(-1)?.text).toBe('ここはきょうしつです。');
});

test('tự giới thiệu (Bài 1): tạo bài nói từ tên, nước, nghề', async ({ page }) => {
  await go(page, 'ngu-phap');
  await pickLesson(page, 'ngu-phap', 1);
  const sec = page.locator('section[data-view="ngu-phap"]');
  await sec.locator('[data-testid="grammar-modes"] button', { hasText: 'Tự giới thiệu' }).click();
  const intro = sec.getByTestId('self-intro');
  await intro.getByLabel('Tên của bạn').fill('ナム');
  await intro.getByLabel('Đến từ').selectOption({ label: 'Nhật Bản — にほん' });
  await intro.getByLabel('Nghề nghiệp').selectOption({ index: 2 });
  await expect(intro).toContainText('わたしは ナム です。');
  await expect(intro).toContainText('Watashi wa Namu desu.');
  await expect(intro).toContainText('にほんから きました。');
  await expect(intro).toContainText('せんせいです。');
  await intro.getByRole('button', { name: /Nghe cả bài/ }).click();
  // bài khác không có chế độ tự giới thiệu
  await pickLesson(page, 'ngu-phap', 2);
  await expect(sec.locator('[data-testid="grammar-modes"] button', { hasText: 'Tự giới thiệu' })).toHaveCount(0);
});
