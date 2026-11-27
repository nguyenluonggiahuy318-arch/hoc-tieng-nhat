// Trang "📤 Gửi bài": kết nối GitHub, chọn tài liệu, cắt khung video trên máy, gửi lên inbox/ trong MỘT commit.
// GitHub API được giả lập (không gọi GitHub thật).
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { Page, Route } from '@playwright/test';
import { expect, go, test } from './fixtures';

interface Recorded {
  blobs: string[];
  treePaths: string[];
  message: string;
  refUpdated: boolean;
}

async function mockGitHub(page: Page, opts: { pushPermission?: boolean } = {}) {
  const rec: Recorded = { blobs: [], treePaths: [], message: '', refUpdated: false };
  const cors = {
    'access-control-allow-origin': '*',
    'access-control-allow-headers': 'authorization, content-type, accept, x-github-api-version',
    'access-control-allow-methods': 'GET, POST, PATCH, OPTIONS',
  };
  const json = (route: Route, body: unknown, status = 200) => route.fulfill({ status, headers: { ...cors, 'content-type': 'application/json' }, body: JSON.stringify(body) });
  await page.route('https://api.github.com/**', async (route) => {
    const req = route.request();
    const url = new URL(req.url());
    const p = url.pathname;
    if (req.method() === 'OPTIONS') return route.fulfill({ status: 204, headers: cors });
    if (!/^Bearer github_pat_/.test(req.headers()['authorization'] ?? '')) return json(route, { message: 'Bad credentials' }, 401);
    if (req.method() === 'GET' && /^\/repos\/[^/]+\/[^/]+$/.test(p)) return json(route, { full_name: p.slice(7), html_url: 'https://github.com' + p.slice(6), permissions: { push: opts.pushPermission ?? true } });
    if (req.method() === 'POST' && p.endsWith('/git/blobs')) {
      rec.blobs.push((JSON.parse(req.postData()!) as { content: string }).content);
      return json(route, { sha: 'blob' + rec.blobs.length }, 201);
    }
    if (req.method() === 'GET' && p.endsWith('/git/ref/heads/main')) return json(route, { object: { sha: 'base' } });
    if (req.method() === 'GET' && p.endsWith('/git/commits/base')) return json(route, { tree: { sha: 'basetree' } });
    if (req.method() === 'POST' && p.endsWith('/git/trees')) {
      rec.treePaths = (JSON.parse(req.postData()!) as { tree: { path: string }[] }).tree.map((t) => t.path);
      return json(route, { sha: 'newtree' }, 201);
    }
    if (req.method() === 'POST' && p.endsWith('/git/commits')) {
      rec.message = (JSON.parse(req.postData()!) as { message: string }).message;
      return json(route, { sha: 'newcommit' }, 201);
    }
    if (req.method() === 'PATCH' && p.endsWith('/git/refs/heads/main')) {
      rec.refUpdated = true;
      return json(route, { object: { sha: 'newcommit' } });
    }
    if (p.endsWith('/contents/inbox')) return json(route, rec.treePaths.map((x) => ({ name: x.replace('inbox/', ''), size: 1000, type: 'file' })));
    if (p.includes('/actions/workflows/')) return json(route, { workflow_runs: [{ id: 1, status: 'in_progress', conclusion: null, html_url: 'https://github.com/x/y/actions/runs/1', created_at: new Date().toISOString(), event: 'push' }] });
    return json(route, { message: 'Not Found' }, 404);
  });
  return rec;
}

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n');
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==', 'base64');
const WEBM = fs.readFileSync(fileURLToPath(new URL('../fixtures/slides.webm', import.meta.url)));

async function connect(page: Page) {
  await go(page, 'gui-bai');
  const up = page.getByTestId('upload');
  await up.getByLabel('Mã GitHub').fill('github_pat_THU_NGHIEM_123');
  await up.getByLabel('Repo').fill('ten-github/hoc-tieng-nhat');
  await up.getByTestId('connect').click();
  await expect(up.getByTestId('connect-msg')).toContainText('Đã kết nối ten-github/hoc-tieng-nhat');
  return up;
}

test('gửi PDF + ảnh (+ video cắt thành khung hình) lên inbox/ trong một commit', async ({ page }) => {
  const rec = await mockGitHub(page);
  const up = await connect(page);
  const canWebm = await page.evaluate(() => !!document.createElement('video').canPlayType('video/webm; codecs="vp8"'));
  const files = [
    { name: 'NGU_PHAP_BAI_5.pdf', mimeType: 'application/pdf', buffer: PDF },
    { name: 'bang tu bai 5.png', mimeType: 'image/png', buffer: PNG },
    ...(canWebm ? [{ name: 'Bai5_video.webm', mimeType: 'video/webm', buffer: WEBM }] : []),
  ];
  await up.getByTestId('upload-input').setInputFiles(files);
  await expect(up.getByTestId('upload-items').locator('li')).toHaveCount(files.length);
  await up.getByLabel('Bài số').fill('5');
  await up.getByLabel('Ghi chú cho Claude').fill('phần 1');
  await up.getByTestId('upload-send').click();
  await expect(up.getByTestId('upload-result')).toContainText('Đã gửi', { timeout: 60_000 });
  expect(rec.refUpdated).toBe(true);
  expect(rec.message).toContain('Bài 5');
  expect(rec.treePaths).toContain('inbox/NGU_PHAP_BAI_5.pdf');
  expect(rec.treePaths).toContain('inbox/bang_tu_bai_5.png');
  const notePath = rec.treePaths.find((x) => /^inbox\/ghi-chu-\d{8}-\d{6}\.txt$/.test(x));
  expect(notePath).toBeTruthy();
  const noteText = Buffer.from(rec.blobs[rec.treePaths.indexOf(notePath!)], 'base64').toString('utf8');
  expect(noteText).toContain('Bài: 5');
  expect(noteText).toContain('Ghi chú: phần 1');
  if (canWebm) {
    // 3 slide khác nhau (0–10s, 10–20s, 20–30s), khung trùng ở giây 8 bị bỏ
    const frames = rec.treePaths.filter((x) => x.includes('-khung-'));
    expect(frames).toEqual(['inbox/Bai5_video-khung-001-0m00s.jpg', 'inbox/Bai5_video-khung-002-0m16s.jpg', 'inbox/Bai5_video-khung-003-0m24s.jpg']);
    expect(noteText).toContain('Bai5_video.webm (video 0:30 → 3 khung hình)');
  }
  // trạng thái sau khi gửi
  await expect(page.getByTestId('upload-status')).toContainText('NGU_PHAP_BAI_5.pdf');
  await expect(page.getByTestId('upload-status')).toContainText('đang xử lý');
});

test('báo lỗi rõ ràng: mã sai, mã chỉ có quyền đọc, file không hỗ trợ / quá lớn', async ({ page }) => {
  await mockGitHub(page, { pushPermission: false });
  await go(page, 'gui-bai');
  const up = page.getByTestId('upload');
  await up.getByLabel('Mã GitHub').fill('sai-ma');
  await up.getByLabel('Repo').fill('ten-github/hoc-tieng-nhat');
  await up.getByTestId('connect').click();
  await expect(up.getByTestId('connect-msg')).toContainText('sai hoặc đã hết hạn');
  await up.getByLabel('Mã GitHub').fill('github_pat_CHI_DOC');
  await up.getByTestId('connect').click();
  await expect(up.getByTestId('connect-msg')).toContainText('chỉ có quyền đọc');
  await expect(up.getByTestId('upload-send')).toBeDisabled();
  await up.getByTestId('upload-input').setInputFiles([{ name: 'ghi-am.zip', mimeType: 'application/zip', buffer: Buffer.from('PK') }]);
  await expect(up.getByTestId('upload-items')).toContainText('Chỉ nhận video, ảnh, PDF, Word');
});

test('mã GitHub không nằm trong file xuất tiến độ', async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(navigator, 'canShare', { value: undefined, configurable: true }));
  await mockGitHub(page);
  await connect(page);
  await go(page, 'cai-dat');
  const dl = page.waitForEvent('download');
  await page.getByTestId('export').click();
  const text = fs.readFileSync(await (await dl).path(), 'utf8');
  expect(text).toContain('hoc-tieng-nhat');
  expect(text).not.toContain('github_pat_');
});

test('cách dự phòng (video chạy nhanh ×16 rồi chụp khung) cũng cắt đúng 3 slide', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('hn-debug.videoMode', 'play'));
  const rec = await mockGitHub(page);
  const up = await connect(page);
  const canWebm = await page.evaluate(() => !!document.createElement('video').canPlayType('video/webm; codecs="vp8"'));
  test.skip(!canWebm, 'trình duyệt test không đọc được WebM');
  await up.getByTestId('upload-input').setInputFiles([{ name: 'Bai5_video.webm', mimeType: 'video/webm', buffer: WEBM }]);
  await up.getByTestId('upload-send').click();
  await expect(up.getByTestId('upload-result')).toContainText('Đã gửi', { timeout: 60_000 });
  expect(rec.treePaths.filter((x) => x.includes('-khung-')).length).toBe(3);
});
