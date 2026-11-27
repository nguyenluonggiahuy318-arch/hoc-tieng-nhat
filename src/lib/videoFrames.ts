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

type Mode = 'seek' | 'play';
type Opts = { onProgress?: (done: number, total: number) => void; signal?: AbortSignal; threshold?: number };
export interface Extracted {
  slides: Slide[];
  duration: number;
  checked: number;
  mode: Mode;
}

/** Chế độ ép buộc để thử nghiệm (localStorage "hn-debug.videoMode" = "seek" | "play"). */
function forcedMode(): Mode | null {
  try {
    const m = localStorage.getItem('hn-debug.videoMode');
    return m === 'seek' || m === 'play' ? m : null;
  } catch {
    return null;
  }
}

/**
 * Cắt slide từ video. Cách chính: tua tới từng mốc thời gian. Nếu trình duyệt không tua được (một số bản
 * Safari / WebKit) hoặc không lấy được khung nào, tự chuyển sang cách dự phòng: cho video chạy nhanh ×16
 * (tắt tiếng) và chụp khung khi chạy qua từng mốc.
 */
export async function extractSlides(file: Blob, opts: Opts = {}): Promise<Extracted> {
  const forced = forcedMode();
  if (forced) return extractWith(file, forced, opts);
  try {
    return await extractWith(file, 'seek', opts);
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e;
    try {
      return await extractWith(file, 'play', opts);
    } catch (e2) {
      if ((e2 as Error).name === 'AbortError') throw e2;
      throw e;
    }
  }
}

async function extractWith(file: Blob, mode: Mode, opts: Opts): Promise<Extracted> {
  const url = URL.createObjectURL(file);
  const video = document.createElement('video');
  video.muted = true;
  video.playsInline = true;
  video.preload = 'auto';
  video.setAttribute('playsinline', '');
  // Safari / WebKit chỉ vẽ được khung của video ĐANG GẮN trên trang (video tách rời cho ảnh trong suốt),
  // nên gắn tạm vào trang, rất nhỏ và gần như trong suốt, rồi gỡ khi xong.
  video.setAttribute('aria-hidden', 'true');
  video.style.cssText = 'position:fixed;left:0;bottom:0;width:4px;height:4px;opacity:0.01;pointer-events:none;z-index:-1';
  document.body.appendChild(video);
  video.src = url;
  try {
    await waitEvent(video, 'loadeddata', 20_000, 'Trình duyệt không mở được video này (định dạng không hỗ trợ?).');
    if (mode === 'seek') {
      // iOS: phát một chút (đang tắt tiếng) để được phép tua và vẽ khung
      try {
        await video.play();
        video.pause();
      } catch {
        /* không sao */
      }
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

    /** Xét khung đang hiện: bỏ khung trống / trùng, giữ khung mới thành ảnh JPG. */
    const take = async (t: number) => {
      sctx.drawImage(video, 0, 0, SIG_W, SIG_H);
      const gray = grayFromRGBA(sctx.getImageData(0, 0, SIG_W, SIG_H).data);
      if (stdDev(gray) < BLANK_STD) return;
      if (last && changedRatio(last, gray) < (opts.threshold ?? DEFAULT_THRESHOLD)) return;
      last = gray;
      bctx.drawImage(video, 0, 0, W, H);
      const blob = await new Promise<Blob>((res, rej) => big.toBlob((b) => (b ? res(b) : rej(new Error('Không lưu được khung hình.'))), 'image/jpeg', 0.82));
      slides.push({ blob, t: Math.floor(t) });
    };
    const checkAbort = () => {
      if (opts.signal?.aborted) throw new DOMException('Đã huỷ', 'AbortError');
    };

    if (mode === 'seek') {
      for (let i = 0; i < times.length; i++) {
        checkAbort();
        await seek(video, times[i]);
        await take(times[i]);
        opts.onProgress?.(i + 1, times.length);
      }
    } else {
      // chạy nhanh và chụp khi đi qua từng mốc (dừng lại trong lúc lưu ảnh)
      try {
        video.playbackRate = 16;
      } catch {
        video.playbackRate = 4;
      }
      let i = 0;
      let lastT = -1;
      let lastMove = Date.now();
      while (i < times.length) {
        checkAbort();
        if (video.paused && !video.ended) await video.play();
        await new Promise((r) => setTimeout(r, 25));
        const now = video.currentTime;
        if (now !== lastT) {
          lastT = now;
          lastMove = Date.now();
        } else if (Date.now() - lastMove > 10_000) throw new Error('Video không phát được trên trình duyệt này.');
        if (now >= times[i] || video.ended) {
          video.pause();
          await take(times[i]);
          while (i < times.length && times[i] <= now) i++;
          if (video.ended) break;
          opts.onProgress?.(Math.min(i, times.length), times.length);
        }
      }
      opts.onProgress?.(times.length, times.length);
    }
    if (!slides.length) throw new Error('Không lấy được khung hình nào từ video.');
    return { slides, duration: dur, checked: times.length, mode };
  } finally {
    URL.revokeObjectURL(url);
    video.pause();
    video.removeAttribute('src');
    video.load();
    video.remove();
  }
}
