import { describe, expect, it } from 'vitest';
import { changedRatio, frameFileName, grayFromRGBA, intervalFor, parseFrameFileName, SIG_H, SIG_W, stdDev } from '../../src/lib/frameDiff';
import { safeName } from '../../src/lib/github';

describe('tên file khung hình gửi từ web', () => {
  it('tạo và đọc lại được', () => {
    const n = frameFileName('Bai5_video', 7, 200);
    expect(n).toBe('Bai5_video-khung-007-3m20s.jpg');
    expect(parseFrameFileName(n)).toEqual({ prefix: 'Bai5_video', index: 7, t: 200 });
  });
  it('không nhầm với ảnh thường', () => {
    expect(parseFrameFileName('bang tu bai 5.png')).toBeNull();
    expect(parseFrameFileName('khung.jpg')).toBeNull();
  });
  it('khoảng cắt 8–15 giây theo độ dài video', () => {
    expect(intervalFor(120)).toBe(8);
    expect(intervalFor(1800)).toBe(10);
    expect(intervalFor(3600)).toBe(15);
  });
});

describe('so sánh khung (dùng chung trình duyệt + máy)', () => {
  const plain = (v: number) => new Float32Array(SIG_W * SIG_H).fill(v);
  it('ảnh giống nhau → 0, khác hẳn → 1', () => {
    expect(changedRatio(plain(200), plain(200))).toBe(0);
    expect(changedRatio(plain(0), plain(255))).toBe(1);
  });
  it('khung một màu có độ lệch chuẩn 0 (bị bỏ)', () => expect(stdDev(plain(30))).toBe(0));
  it('RGBA → xám', () => expect([...grayFromRGBA([255, 255, 255, 255, 0, 0, 0, 255])].map(Math.round)).toEqual([255, 0]));
});

describe('tên file an toàn trong repo', () => {
  it.each([
    ['NGU PHAP BAI 5.pdf', 'NGU_PHAP_BAI_5.pdf'],
    ['bài 5: từ vựng?.docx', 'bài_5-_từ_vựng-.docx'],
    ['../../etc/passwd', '-..-etc-passwd'],
    ['文法第5課.mp4', '文法第5課.mp4'],
    ['', 'tai-lieu'],
  ])('%s → %s', (a, b) => expect(safeName(a)).toBe(b));
});

describe('mã GitHub không nằm trong file xuất tiến độ', () => {
  it('lưu riêng, không bị export', async () => {
    const m = new Map<string, string>();
    (globalThis as unknown as { localStorage: Storage }).localStorage = {
      get length() {
        return m.size;
      },
      key: (i: number) => [...m.keys()][i] ?? null,
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => void m.set(k, String(v)),
      removeItem: (k: string) => void m.delete(k),
      clear: () => m.clear(),
    } as Storage;
    const s = await import('../../src/lib/storage');
    s.storeSecret('githubToken', 'github_pat_BI_MAT');
    s.store('script', 'kata');
    expect(s.loadSecret('githubToken')).toBe('github_pat_BI_MAT');
    expect(JSON.stringify(s.exportProgress())).not.toContain('github_pat_');
    s.storeSecret('githubToken', '');
    expect(s.loadSecret('githubToken')).toBe('');
  });
});
