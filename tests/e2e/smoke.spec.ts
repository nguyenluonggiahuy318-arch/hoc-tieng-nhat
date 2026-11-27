// Mở mọi trang, mọi chế độ, mọi bài: không được có lỗi JavaScript và không tràn ngang trên điện thoại.
import { ROUTES, expect, expectNoHorizontalScroll, go, lessons, pickLesson, test } from './fixtures';

test('mọi trang mở được, không lỗi JS', async ({ page }) => {
  for (const r of ROUTES) {
    await go(page, r);
    await expectNoHorizontalScroll(page);
  }
  // đổi sang Katakana rồi mở lại các trang dùng bảng chữ
  await page.getByRole('button', { name: /Katakana/ }).first().click();
  for (const r of ['bang-chu', 'the-nho', 'luyen-tap', 'de-nham']) {
    await go(page, r);
    await expectNoHorizontalScroll(page);
  }
  await expect(page.locator('section[data-view="de-nham"] .tip').first()).toBeVisible();
});

test('mọi chế độ của Từ vựng, Ngữ pháp ở mọi bài', async ({ page }) => {
  for (const L of lessons()) {
    await go(page, 'tu-vung');
    await pickLesson(page, 'tu-vung', L.lesson);
    for (const m of ['Danh sách', 'Thẻ nhớ', 'Nhật → Việt', 'Việt → Nhật']) {
      await page.locator('[data-testid="vocab-modes"] button', { hasText: m }).click();
      await expectNoHorizontalScroll(page);
    }
    await go(page, 'ngu-phap');
    await pickLesson(page, 'ngu-phap', L.lesson);
    const modes = ['Lý thuyết', 'Điền vào chỗ trống', 'Sắp xếp câu'];
    if (L.selfIntro) modes.push('Tự giới thiệu');
    for (const m of modes) {
      await page.locator('[data-testid="grammar-modes"] button', { hasText: m }).click();
      await expectNoHorizontalScroll(page);
    }
    await expect(page.locator('[data-testid="grammar-modes"] button', { hasText: 'Tự giới thiệu' })).toHaveCount(L.selfIntro ? 1 : 0);
  }
});

test('mọi chế độ Gõ chữ và Số đếm', async ({ page }) => {
  await go(page, 'go-chu');
  const sec = page.locator('section[data-view="go-chu"]');
  for (const mode of ['Chữ cái', 'Từ vựng', 'Câu', 'Gõ tự do']) {
    await sec.locator('[data-testid="typing-modes"] button', { hasText: mode }).click();
    for (const method of ['Bàn phím của máy', 'Bàn phím kana', 'Romaji tự đổi']) {
      const b = sec.getByRole('button', { name: new RegExp(method) });
      if (await b.count()) await b.click();
      await expectNoHorizontalScroll(page);
    }
  }
  await go(page, 'so-dem');
  const tabs = page.locator('[data-testid="numbers-tabs"] button');
  const n = await tabs.count();
  expect(n).toBeGreaterThanOrEqual(5);
  for (let i = 0; i < n; i++) {
    await tabs.nth(i).click();
    await expectNoHorizontalScroll(page);
  }
  for (const m of ['Số → cách đọc', 'Cách đọc → số', 'Nghe → số']) {
    await page.getByRole('button', { name: m }).click();
    const ranges = page.locator('[data-testid="number-ranges"] button');
    const rn = await ranges.count();
    for (let i = 0; i < rn; i++) await ranges.nth(i).click();
  }
});

test('đường dẫn cũ (#chart, #bai1, #so…) vẫn mở đúng trang', async ({ page }) => {
  await page.goto('./#bai1');
  await expect(page.locator('section[data-view="tu-vung"]')).toBeVisible();
  await page.goto('./#so');
  await expect(page.locator('section[data-view="so-dem"]')).toBeVisible();
  await page.goto('./#khong-co');
  await expect(page.locator('section[data-view="bang-chu"]')).toBeVisible();
});
