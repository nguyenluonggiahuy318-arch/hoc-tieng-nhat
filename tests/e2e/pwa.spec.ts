// PWA: có manifest + icon cho iPhone, service worker cài được và web mở được khi mất mạng.
import { expect, test } from './fixtures';

test('manifest và icon "Thêm vào Màn hình chính"', async ({ page, request }) => {
  await page.goto('./');
  const href = await page.locator('link[rel="manifest"]').getAttribute('href');
  expect(href).toBeTruthy();
  const m = await (await request.get(new URL(href!, page.url()).toString())).json();
  expect(m.display).toBe('standalone');
  expect(m.lang).toBe('vi');
  expect(m.icons.some((i: { sizes: string }) => i.sizes === '512x512')).toBe(true);
  const apple = await page.locator('link[rel="apple-touch-icon"]').getAttribute('href');
  expect((await request.get(new URL(apple!, page.url()).toString())).ok()).toBe(true);
  await expect(page.locator('meta[name="apple-mobile-web-app-capable"]')).toHaveAttribute('content', 'yes');
});

test.describe('offline', () => {
  test.use({ serviceWorkers: 'allow' });
  test('service worker lưu sẵn web, mất mạng vẫn học được', async ({ page, context, browserName }) => {
    test.skip(browserName !== 'chromium', 'Playwright chỉ giả lập offline + service worker ổn định trên Chromium');
    await page.goto('./#tu-vung');
    await page.evaluate(async () => {
      const reg = await navigator.serviceWorker.ready;
      return !!reg.active;
    });
    // đợi service worker điều khiển trang
    await page.reload();
    await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true);
    await context.setOffline(true);
    await page.reload();
    await expect(page.locator('section[data-view="tu-vung"] [data-testid="vocab-table"]')).toBeVisible();
    await page.goto('./#ngu-phap');
    await page.locator('section[data-view="ngu-phap"] [data-testid="lesson-switch"] button', { hasText: 'Bài 1' }).click();
    await expect(page.locator('section[data-view="ngu-phap"] .gcard').first()).toBeVisible();
    await context.setOffline(false);
  });
});
