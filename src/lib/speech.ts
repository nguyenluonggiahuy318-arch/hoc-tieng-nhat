// Phát âm bằng speechSynthesis, giọng ja-JP.
// QUAN TRỌNG: chỉ gọi speak() trực tiếp trong hàm xử lý sự kiện bấm/phím. iOS chặn âm thanh nếu
// gọi trong setTimeout, Promise.then, useEffect…
import { signal } from '@preact/signals';
import { load, store } from './storage';

export const speechSupported =
  typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance !== 'undefined';

let voice: SpeechSynthesisVoice | null = null;
export const hasJaVoice = signal(false);
export const speechRate = signal<number>(clampRate(load('speechRate', 0.8)));

function clampRate(r: unknown) {
  const n = typeof r === 'number' ? r : 0.8;
  return Math.min(1.3, Math.max(0.5, n));
}

export function setSpeechRate(r: number) {
  speechRate.value = clampRate(r);
  store('speechRate', speechRate.value);
}

function pickVoice() {
  try {
    const vs = window.speechSynthesis.getVoices().filter((v) => /^ja([-_]|$)/i.test(v.lang));
    voice = vs.find((v) => /google/i.test(v.name)) ?? vs.find((v) => /kyoko|o-ren|otoya|haruka|nanami/i.test(v.name)) ?? vs[0] ?? null;
    hasJaVoice.value = !!voice;
  } catch {
    voice = null;
  }
}

if (speechSupported) {
  pickVoice();
  try {
    window.speechSynthesis.addEventListener('voiceschanged', pickVoice);
  } catch {
    try {
      window.speechSynthesis.onvoiceschanged = pickVoice;
    } catch {
      /* không hỗ trợ */
    }
  }
}

export function speak(text: string) {
  if (!speechSupported || !text) return;
  try {
    const s = window.speechSynthesis;
    if (s.speaking || s.pending) s.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    if (voice) u.voice = voice;
    u.rate = speechRate.value;
    s.speak(u);
  } catch {
    /* trình duyệt lỗi phát âm: bỏ qua */
  }
}
