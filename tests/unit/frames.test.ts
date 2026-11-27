// Bộ lọc khung trùng khi cắt video: slide mới phải được giữ, ô webcam nhỏ đổi màu thì không.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { changedRatio, frameSignature } from '../../scripts/inbox/scan';

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'frames-'));
async function frame(name: string, lines: number[], cam: string) {
  // nền trắng, các "dòng chữ" xám ở vị trí khác nhau, ô "webcam" 176×99 ở góc dưới phải
  const rects = lines.map((y) => `<rect x="60" y="${y}" width="700" height="22" fill="#333"/>`).join('');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1280" height="720"><rect width="1280" height="720" fill="#fdfbf5"/><rect width="1280" height="70" fill="#2d5a8c"/>${rects}<rect x="1088" y="605" width="176" height="99" fill="${cam}"/></svg>`;
  const f = path.join(dir, name + '.png');
  await sharp(Buffer.from(svg)).png().toFile(f);
  return (await frameSignature(f)).cells;
}

describe('so sánh khung hình video', () => {
  it('cùng slide, chỉ ô webcam đổi → coi là trùng', async () => {
    const a = await frame('a', [120, 170, 220, 270], '#f00');
    const b = await frame('b', [120, 170, 220, 270], '#0f0');
    expect(changedRatio(a, b)).toBeLessThan(0.06);
  });
  it('slide khác (chữ ở chỗ khác) → giữ lại', async () => {
    const a = await frame('c', [120, 170, 220, 270], '#f00');
    const b = await frame('d', [140, 300, 380, 460, 540], '#f00');
    expect(changedRatio(a, b)).toBeGreaterThan(0.06);
  });
});
