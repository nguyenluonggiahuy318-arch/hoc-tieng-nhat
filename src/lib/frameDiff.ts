// So sánh khung hình video để bỏ khung trùng — dùng chung cho script trên máy (scripts/inbox/scan.ts)
// và trang "Gửi bài" (cắt video ngay trên điện thoại).
//
// Mỗi khung được thu nhỏ thành ảnh xám 256×144 và chia lưới 16×9 ô (mỗi ô 16×16 px).
// Slide mới làm đổi nhiều ô; ô webcam nhỏ ở góc hay con trỏ chuột chỉ đổi vài ô → coi là trùng.

export const GW = 16;
export const GH = 9;
export const CELL = 16;
export const SIG_W = GW * CELL; // 256
export const SIG_H = GH * CELL; // 144
/** Tỉ lệ ô thay đổi tối thiểu để coi là slide mới. */
export const DEFAULT_THRESHOLD = 0.06;
/** Khung gần như một màu (màn hình đen / trắng) có độ lệch chuẩn nhỏ hơn mức này thì bỏ. */
export const BLANK_STD = 4;

/** Tỉ lệ ô (lưới 16×9) thay đổi rõ giữa hai khung (ảnh xám SIG_W×SIG_H). */
export function changedRatio(a: ArrayLike<number>, b: ArrayLike<number>): number {
  let changed = 0;
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      let d = 0;
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          const i = (gy * CELL + y) * SIG_W + gx * CELL + x;
          d += Math.abs(a[i] - b[i]);
        }
      if (d / (CELL * CELL) > 6) changed++;
    }
  return changed / (GW * GH);
}

export function stdDev(gray: ArrayLike<number>): number {
  let sum = 0;
  for (let i = 0; i < gray.length; i++) sum += gray[i];
  const mean = sum / gray.length;
  let sq = 0;
  for (let i = 0; i < gray.length; i++) sq += (gray[i] - mean) ** 2;
  return Math.sqrt(sq / gray.length);
}

/** Ảnh RGBA (canvas getImageData) → ảnh xám. */
export function grayFromRGBA(rgba: ArrayLike<number>): Float32Array {
  const out = new Float32Array(rgba.length / 4);
  for (let i = 0, j = 0; j < out.length; i += 4, j++) out[j] = 0.299 * rgba[i] + 0.587 * rgba[i + 1] + 0.114 * rgba[i + 2];
  return out;
}

/** Khoảng cách giữa hai khung cắt: video ngắn cắt dày hơn (8–15 giây). */
export const intervalFor = (durationSec: number) => (durationSec < 600 ? 8 : durationSec > 2400 ? 15 : 10);

export const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** Tên file ảnh của một khung: "<video>-khung-007-3m20s.jpg". */
export function frameFileName(prefix: string, index: number, t: number): string {
  return `${prefix}-khung-${String(index).padStart(3, '0')}-${Math.floor(t / 60)}m${String(Math.floor(t % 60)).padStart(2, '0')}s.jpg`;
}

export function parseFrameFileName(name: string): { prefix: string; index: number; t: number } | null {
  const m = name.match(/^(.*)-khung-(\d{3})-(\d+)m(\d{2})s\.jpe?g$/i);
  return m ? { prefix: m[1], index: parseInt(m[2], 10), t: parseInt(m[3], 10) * 60 + parseInt(m[4], 10) } : null;
}
