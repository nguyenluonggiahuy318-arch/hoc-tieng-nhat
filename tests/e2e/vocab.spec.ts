// Từ vựng: danh sách đủ từ, bộ lọc (nhóm, số từ, cụm, ngẫu nhiên, hay sai), thẻ nhớ, trắc nghiệm.
import { expect, go, lessons, pickLesson, test } from './fixtures';

const sec = (page: import('@playwright/test').Page) => page.locator('section[data-view="tu-vung"]');

test('danh sách có đủ từ của từng bài, bấm để nghe', async ({ page }) => {
  await go(page, 'tu-vung');
  for (const L of lessons()) {
    await pickLesson(page, 'tu-vung', L.lesson);
    const n = L.vocab.reduce((a, g) => a + g.items.length, 0);
    await expect(sec(page).locator('[data-testid="vocab-table"] tbody tr:not(.sec)')).toHaveCount(n);
    await expect(sec(page).locator('[data-testid="vocab-table"] tr.sec')).toHaveCount(L.vocab.length);
  }
  await sec(page).locator('td.w button').first().click();
});

test('bộ lọc: nhóm từ, 5/10/20/tất cả, cụm từ, ngẫu nhiên, chỉ từ hay sai', async ({ page }) => {
  await go(page, 'tu-vung');
  await pickLesson(page, 'tu-vung', 3);
  const s = sec(page);
  await s.locator('[data-testid="vocab-modes"] button', { hasText: 'Thẻ nhớ' }).click();
  const filter = s.getByTestId('vocab-filter');
  await expect(filter.locator('summary .count')).toHaveText('10 từ ▾');
  await filter.getByRole('button', { name: '5 từ' }).click();
  await expect(filter.locator('summary .count')).toHaveText('5 từ ▾');
  await filter.getByRole('button', { name: 'Từ 6–10' }).click();
  await expect(filter.locator('.hint')).toContainText('ロビー');
  await filter.getByRole('button', { name: '🎲 Ngẫu nhiên' }).click();
  await expect(filter.getByRole('button', { name: 'Đổi bộ từ khác' })).toBeVisible();
  await filter.getByRole('button', { name: 'Tất cả' }).last().click();
  await expect(filter.locator('summary .count')).toHaveText('64 từ ▾');
  await filter.getByRole('button', { name: /^Tầng/ }).click();
  await expect(filter.locator('summary .count')).toHaveText('11 từ ▾');
  await filter.getByRole('button', { name: 'Chỉ từ hay sai' }).click();
  await expect(filter.getByRole('button', { name: 'Chưa có từ hay sai' })).toBeVisible();
});

test('trắc nghiệm Nhật → Việt, Việt → Nhật; từ sai được lọc lại', async ({ page }) => {
  await go(page, 'tu-vung');
  await pickLesson(page, 'tu-vung', 2);
  const s = sec(page);
  for (const mode of ['Nhật → Việt', 'Việt → Nhật']) {
    await s.locator('[data-testid="vocab-modes"] button', { hasText: mode }).click();
    const quiz = s.getByTestId('vocab-quiz');
    for (let i = 0; i < 4; i++) {
      await quiz.locator('[data-correct="1"]').click();
      await expect(quiz.getByTestId('feedback')).toContainText('Đúng!');
      await page.keyboard.press('Enter');
    }
  }
  // trả lời sai 1 câu → bật "Chỉ từ hay sai"
  const quiz = s.getByTestId('vocab-quiz');
  const word = (await quiz.getByTestId('question').textContent())!;
  await quiz.locator('.choice:not([data-correct])').first().click();
  await expect(quiz.getByTestId('feedback')).toContainText('Chưa đúng');
  await s.getByTestId('vocab-filter').getByRole('button', { name: 'Chỉ từ hay sai' }).click();
  await expect(s.getByTestId('vocab-filter').locator('summary .count')).toHaveText('1 từ ▾');
  await expect(s.getByTestId('vocab-filter').locator('.vprev')).toHaveCount(1);
  expect(word.length).toBeGreaterThan(0);
});

test('thẻ nhớ từ vựng: lật, Chưa nhớ quay lại sau 3 thẻ, hết thẻ thì Ôn lại', async ({ page }) => {
  await go(page, 'tu-vung');
  await pickLesson(page, 'tu-vung', 1);
  const s = sec(page);
  await s.locator('[data-testid="vocab-modes"] button', { hasText: 'Thẻ nhớ' }).click();
  await s.getByTestId('vocab-filter').getByRole('button', { name: '5 từ' }).click();
  const cards = s.getByTestId('vocab-cards');
  const front = async () => (await cards.locator('.face:not(.back) .w').textContent())!;
  const first = await front();
  await cards.getByTestId('flash').click();
  await expect(cards.getByTestId('flash')).toHaveClass(/flipped/);
  await cards.getByRole('button', { name: 'Chưa nhớ' }).click();
  for (let i = 0; i < 3; i++) await cards.getByRole('button', { name: 'Nhớ rồi' }).click();
  expect(await front()).toBe(first);
  for (let i = 0; i < 2; i++) await cards.getByRole('button', { name: 'Nhớ rồi' }).click();
  await expect(cards.getByTestId('done')).toContainText('よくできた');
  await cards.getByRole('button', { name: 'Ôn lại' }).click();
  await expect(cards.getByTestId('flash')).toBeVisible();
});
