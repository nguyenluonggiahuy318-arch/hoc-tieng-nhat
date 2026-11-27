// Fixture chung cho test e2e:
// - ghi lại mọi lỗi JavaScript (pageerror, console.error) → test nào có lỗi sẽ fail;
// - thay speechSynthesis bằng bản ghi lại, kèm cờ "có đang ở trong sự kiện bấm/phím không"
//   (iOS chỉ cho phát âm khi gọi trực tiếp trong sự kiện) → test kiểm tra điều này;
// - chặn phông Google để test chạy nhanh và không phụ thuộc mạng.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test as base, expect, type Page } from '@playwright/test';
import type { Lesson } from '../../src/lib/schema';

export interface Spoken {
  text: string;
  inEvent: boolean;
}

export const test = base.extend<{ errors: string[] }>({
  errors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
      page.on('console', (m) => {
        if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) errors.push('console.error: ' + m.text());
      });
      await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await page.addInitScript(() => {
        const w = window as unknown as { __spoken: { text: string; inEvent: boolean }[]; event?: Event };
        w.__spoken = [];
        try {
          const s = window.speechSynthesis;
          if (s) {
            s.speak = (u: SpeechSynthesisUtterance) => {
              w.__spoken.push({ text: u.text, inEvent: !!w.event && /click|key|pointer|touch|mouse/.test(w.event.type) });
            };
            s.cancel = () => undefined;
          }
        } catch {
          /* không có speechSynthesis */
        }
      });
      await use(errors);
      expect(errors, 'Không được có lỗi JavaScript').toEqual([]);
      const spoken = await page.evaluate(() => (window as unknown as { __spoken?: Spoken[] }).__spoken ?? []).catch(() => [] as Spoken[]);
      const outside = spoken.filter((s) => !s.inEvent);
      expect(outside, 'Phát âm phải được gọi trực tiếp trong sự kiện bấm/phím (iOS)').toEqual([]);
    },
    { auto: true },
  ],
});
export { expect };

export const ROUTES = ['bang-chu', 'the-nho', 'luyen-tap', 'go-chu', 'tu-vung', 'ngu-phap', 'so-dem', 'tu-muon', 'de-nham', 'cai-dat'] as const;

export async function go(page: Page, route: string) {
  await page.goto('./#' + route);
  await expect(page.locator(`section[data-view="${route}"]`)).toBeVisible();
}

const LESSON_DIR = fileURLToPath(new URL('../../content/lessons', import.meta.url));
export function lessons(): Lesson[] {
  return fs
    .readdirSync(LESSON_DIR)
    .filter((f) => /^bai-\d+\.json$/.test(f))
    .map((f) => JSON.parse(fs.readFileSync(path.join(LESSON_DIR, f), 'utf8')) as Lesson)
    .sort((a, b) => a.lesson - b.lesson);
}

export async function spoken(page: Page): Promise<Spoken[]> {
  return page.evaluate(() => (window as unknown as { __spoken: Spoken[] }).__spoken);
}

/** Chọn bài trong thanh "Bài 1 / Bài 2 …" của màn hình đang mở. */
export async function pickLesson(page: Page, route: string, n: number) {
  await page.locator(`section[data-view="${route}"] [data-testid="lesson-switch"] button`, { hasText: `Bài ${n}` }).click();
}

/** Không có thanh cuộn ngang (giao diện vừa màn hình điện thoại). */
export async function expectNoHorizontalScroll(page: Page) {
  const { sw, iw } = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: window.innerWidth }));
  expect(sw, 'trang bị tràn ngang').toBeLessThanOrEqual(iw + 1);
}
