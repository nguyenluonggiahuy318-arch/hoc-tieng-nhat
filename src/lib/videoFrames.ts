// Cắt khung hình video ngay trên trình duyệt (điện thoại / máy tính) — giống scripts/inbox/scan.ts:
// 1 khung mỗi 8–15 giây, bỏ khung gần giống nhau, chỉ giữ các slide khác nhau dưới dạng ảnh JPG.
// Nhờ vậy không cần tải cả video (có thể rất nặng) lên GitHub.
import { BLANK_STD, DEFAULT_THRESHOLD, SIG_H, SIG_W, changedRatio, grayFromRGBA, intervalFor, stdDev } from './frameDiff';

export interface Slide {
  blob: Blob;
  t: number;
}

function waitEvent(el: HTMLMediaElement, ev: string, ms: number, err: string): Promise<void> {
  return new Promise((res, rej) => {
    const timer = setTimeout(() => {
      cleanup();
      rej(new Error(err));
    }, ms);
    const ok = () => {
      cleanup();
      res();
    };
    const bad = () => {
      cleanup();
      rej(new Error(err));
    };
    const cleanup = () => {
      clearTimeout(timer);
      el.removeEventListener(ev, ok);
      el.removeEventListener('error', bad);
    };
    el.addEventListener(ev, ok, { once: true });
    el.addEventListener('error', bad, { once: true });
  });
}

async function seek(v: HTMLVideoElement, t: number) {
  const p = waitEvent(v, 'seeked', 10_000, 'Video không tua được — trình duyệt có thể không đọc được định dạng này.');
  v.currentTime = t;
  await p;
  // chờ khung mới thật sự được vẽ (Safari đôi khi trả khung cũ ngay sau seeked)
  const rvfc = (v as HTMLVideoElement & { requestVideoFrameCallback?: (cb: () => void) => number }).requestVideoFrameCallback;
  if (rvfc) await Promise.race([new Promise<void>((r) => rvfc.call(v, () => r())), new Promise((r) => setTimeout(r, 120))]);
  else await new Promise((r) => setTimeout(r, 40));
}

export async function extractSlides(
  file: Blob,
  opts: { onProgress?: (done: number, total: number) => void; signal?: AbortSignal; threshold?: number } = {},
): Promise<{ slides: Slide[]; duration: number; checked: number }> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  video.src = url;
  try {
    await waitEvent(video, 'loadeddata', 20_000, 'Trình duyệt không mở được video này (định dạng không hỗ trợ?).');
    // iOS: phát một chút (đang tắt tiếng) để được phép tua và vẽ khung
    try {
      await video.play();
      video.pause();
    } catch {
      /* không sao */
    }
    const dur = video.duration;
    if (!isFinite(dur) || dur <= 0) throw new Error('Không đọc được độ dài video.');
    const interval = intervalFor(dur);
    const vw = video.videoWidth || 1280;
    const vh = video.videoHeight || 720;
    const W = Math.min(1280, vw);
    const H = Math.round((W * vh) / vw);
    const big = document.createElement('canvas');
    big.width = W;
    big.height = H;
    const bctx = big.getContext('2d')!;
    const small = document.createElement('canvas');
    small.width = SIG_W;
    small.height = SIG_H;
    const sctx = small.getContext('2d', { willReadFrequently: true })!;
    const times: number[] = [];
    for (let t = 0; t < dur; t += interval) times.push(Math.min(t + 0.5, Math.max(0, dur - 0.1)));
    const slides: Slide[] = [];
    let last: Float32Array | null = null;
    for (let i = 0; i < times.length; i++) {
      if (opts.signal?.aborted) throw new DOMException('Đã huỷ', 'AbortError');
      await seek(video, times[i]);
      sctx.drawImage(video, 0, 0, SIG_W, SIG_H);
      const gray = grayFromRGBA(sctx.getImageData(0, 0, SIG_W, SIG_H).data);
      opts.onProgress?.(i + 1, times.length);
      if (stdDev(gray) < BLANK_STD) continue;
      if (last && changedRatio(last, gray) < (opts.threshold ?? DEFAULT_THRESHOLD)) continue;
      last = gray;
      bctx.drawImage(video, 0, 0, W, H);
      const blob = await new Promise<Blob>((res, rej) => big.toBlob((b) => (b ? res(b) : rej(new Error('Không lưu được khung hình.'))), 'image/jpeg', 0.82));
      slides.push({ blob, t: Math.floor(times[i]) });
    }
    return { slides, duration: dur, checked: times.length };
  } finally {
    URL.revokeObjectURL(url);
    video.removeAttribute('src');
    video.load();
  }
}
