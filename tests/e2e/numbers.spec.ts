// Số đếm: cách đọc đúng ở các số biến âm (số, tuổi, tầng, quận, giá), đổi số, luyện tập.
import { expect, go, spoken, test } from './fixtures';

test('đổi số: đọc đúng các số biến âm', async ({ page }) => {
  await go(page, 'so-dem');
  await page.locator('[data-testid="numbers-tabs"] button', { hasText: 'Đổi số' }).click();
  const conv = page.getByTestId('numbers-conv');
  const input = conv.getByLabel('Số cần đọc');
  const asSel = conv.getByLabel('Đọc như');
  const cases: [string, string, string][] = [
    ['', '368', 'さんびゃく ろくじゅう はち'],
    ['', '300', 'さんびゃく'],
    ['', '600', 'ろっぴゃく'],
    ['', '800', 'はっぴゃく'],
    ['', '3000', 'さんぜん'],
    ['', '8000', 'はっせん'],
    ['', '100', 'ひゃく'],
    ['', '1000', 'せん'],
    ['', '10000', 'いちまん'],
    ['', '18000', 'いちまん はっせん'],
    ['', '10000000', 'いっせんまん'],
    ['tuoi', '1', 'いっさい'],
    ['tuoi', '8', 'はっさい'],
    ['tuoi', '10', 'じゅっさい'],
    ['tuoi', '11', 'じゅう いっさい'],
    ['tuoi', '20', 'はたち'],
    ['tuoi', '30', 'さんじゅっさい'],
    ['tang', '1', 'いっかい'],
    ['tang', '3', 'さんがい'],
    ['tang', '6', 'ろっかい'],
    ['tang', '8', 'はっかい'],
    ['tang', '10', 'じゅっかい'],
    ['quan', '6', 'ろっく'],
    ['quan', '10', 'じゅっく'],
    ['gia', '3800', 'さんぜん はっぴゃく えん'],
    ['gia', '4', 'よえん'],
  ];
  for (const [as, n, read] of cases) {
    await asSel.selectOption(as);
    await input.fill(n);
    await expect(conv.getByTestId('conv-result'), `${as || 'số'} ${n}`).toHaveText(read);
  }
  await input.fill('123456789');
  await asSel.selectOption('');
  await expect(conv).toContainText('Số lớn quá');
});

test('bảng số và trang tuổi / tầng tô đỏ các số biến âm', async ({ page }) => {
  await go(page, 'so-dem');
  const table = page.getByTestId('numbers-table');
  await expect(table.locator('.ncell', { hasText: 'さんびゃく' })).toHaveClass(/irr/);
  await expect(table.locator('.ncell', { hasText: 'はっせん' })).toHaveClass(/irr/);
  await expect(table.locator('.ncell', { hasText: 'よんひゃく' })).not.toHaveClass(/irr/);
  await page.locator('[data-testid="numbers-tabs"] button', { hasText: 'Tuổi' }).click();
  const age = page.getByTestId('numbers-page-tuoi');
  await expect(age.locator('.ncell', { hasText: '20 tuổi' })).toContainText('はたち');
  await expect(age.locator('.ncell', { hasText: '20 tuổi' })).toHaveClass(/irr/);
  await expect(age.locator('.ncell', { hasText: '2 tuổi' }).first()).not.toHaveClass(/irr/);
  await page.locator('[data-testid="numbers-tabs"] button', { hasText: 'Tầng & quận' }).click();
  const fl = page.getByTestId('numbers-page-tang-quan');
  await expect(fl.locator('.ncell', { hasText: 'Tầng 3' })).toContainText('さんがい');
  await expect(fl.locator('.ncell', { hasText: 'Tầng 3' })).toHaveClass(/irr/);
  await expect(fl.locator('.ncell', { hasText: 'Quận 6' })).toContainText('ろっく');
  await fl.locator('.ncell', { hasText: 'Tầng 3' }).click();
  expect((await spoken(page)).at(-1)?.text).toBe('さんがい');
});

test('luyện tập số: đủ phạm vi, trả lời đúng, nghe → số phát âm trong sự kiện bấm', async ({ page }) => {
  await go(page, 'so-dem');
  await page.locator('[data-testid="numbers-tabs"] button', { hasText: 'Luyện tập' }).click();
  const q = page.getByTestId('numbers-quiz');
  for (const label of ['0–10', '11–99', '100–999', '1000–9999', 'Tuổi', 'Giá (えん)', 'Tầng', 'Trộn']) {
    await expect(q.getByTestId('number-ranges').getByRole('button', { name: label })).toBeVisible();
  }
  for (const mode of ['Số → cách đọc', 'Cách đọc → số']) {
    await q.getByRole('button', { name: mode }).click();
    for (let i = 0; i < 5; i++) {
      await q.locator('[data-correct="1"]').click();
      await expect(q.getByTestId('feedback')).toContainText('Đúng!');
      await page.keyboard.press('Enter');
    }
  }
  const before = (await spoken(page)).length;
  await q.getByRole('button', { name: 'Nghe → số' }).click();
  const after = await spoken(page);
  expect(after.length).toBe(before + 1);
  expect(after.at(-1)?.inEvent).toBe(true);
  await q.getByRole('button', { name: '🔊 Nghe' }).click();
  await q.locator('[data-correct="1"]').click();
  await expect(q.getByTestId('feedback')).toContainText('Đúng!');
});
