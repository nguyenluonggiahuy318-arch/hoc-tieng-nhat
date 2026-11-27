// Cài đặt: xuất / nhập tiến độ (file JSON), xoá tiến độ, từ mượn, dễ nhầm.
import fs from 'node:fs';
import { expect, go, test } from './fixtures';

test('xuất tiến độ ra file rồi nhập lại ở "máy khác"', async ({ page, browser }, info) => {
  await page.addInitScript(() => {
    // luôn dùng tải file (không dùng bảng chia sẻ của điện thoại) để test được
    Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true });
  });
  // tạo chút tiến độ: đổi sang Katakana và trả lời 1 câu
  await go(page, 'luyen-tap');
  await page.getByRole('button', { name: /Katakana/ }).first().click();
  await page.getByTestId('kana-quiz').getByTestId('choices').locator('[data-correct="1"]').click();
  await go(page, 'cai-dat');
  await expect(page.getByTestId('settings')).toContainText('Katakana cơ bản đã thuộc');
  const dl = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const file = await dl;
  const p = info.outputPath('tien-do.json');
  await file.saveAs(p);
  const data = JSON.parse(fs.readFileSync(p, 'utf8'));
  expect(data.app).toBe('hoc-tieng-nhat');
  expect(data.data.script).toBe('kata');
  expect(Object.keys(data.data.kana).length).toBe(1);

  // "máy khác": context mới, trống trơn
  const ctx2 = await browser.newContext({ serviceWorkers: 'block' });
  const p2 = await ctx2.newPage();
  await p2.goto('./#cai-dat');
  // truyền nội dung (Playwright không gán được file nếu đường dẫn có dấu tiếng Việt)
  const asFile = (f: string) => ({ name: 'tien-do.json', mimeType: 'application/json', buffer: fs.readFileSync(f) });
  await p2.getByTestId('import-file').setInputFiles(asFile(p));
  await expect(p2.getByTestId('settings-msg')).toContainText('Đã nhập tiến độ');
  await p2.waitForLoadState('load');
  await p2.goto('./#bang-chu');
  await expect(p2.locator('h1')).toContainText('カタカナ');
  await expect(p2.locator('.dot[data-level="2"], .dot[data-level="1"]')).toHaveCount(1);
  // file sai định dạng
  fs.writeFileSync(info.outputPath('sai.json'), '{"hello": 1}');
  await p2.goto('./#cai-dat');
  await p2.getByTestId('import-file').setInputFiles(asFile(info.outputPath('sai.json')));
  await expect(p2.getByTestId('settings-msg')).toContainText('không phải file tiến độ');
  await ctx2.close();
});

test('xoá tiến độ cần bấm 2 lần', async ({ page }) => {
  await go(page, 'luyen-tap');
  await page.getByTestId('kana-quiz').getByTestId('choices').locator('[data-correct="1"]').click();
  await go(page, 'bang-chu');
  const btn = page.getByRole('button', { name: 'Xoá tiến độ Hiragana' });
  await btn.click();
  await expect(page.getByRole('button', { name: 'Bấm lần nữa để xoá' })).toBeVisible();
  await page.getByRole('button', { name: 'Bấm lần nữa để xoá' }).click();
  await expect(page.locator('.dot[data-level="1"], .dot[data-level="2"], .dot[data-level="3"]')).toHaveCount(0);
});

test('từ mượn và dễ nhầm hoạt động', async ({ page }) => {
  await go(page, 'tu-muon');
  const lw = page.getByTestId('loanwords');
  for (let i = 0; i < 3; i++) {
    await lw.locator('[data-correct="1"]').click();
    await expect(lw.getByTestId('feedback')).toContainText('Đúng!');
    await lw.getByRole('button', { name: 'Từ tiếp →' }).click();
  }
  await go(page, 'de-nham');
  await expect(page.getByTestId('tips').locator('.tip')).toHaveCount(11);
  await page.getByRole('button', { name: /Katakana/ }).first().click();
  await expect(page.getByTestId('tips').locator('.tip')).toHaveCount(9);
});
