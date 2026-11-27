// Đăng ký service worker (dùng offline) và báo khi có bản cập nhật.
import { signal } from '@preact/signals';
import { registerSW } from 'virtual:pwa-register';

export const needRefresh = signal(false);
export const offlineReady = signal(false);
export const updateChecking = signal<'idle' | 'checking' | 'latest' | 'error'>('idle');

let reg: ServiceWorkerRegistration | undefined;
let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

export function initPwa() {
  if (!('serviceWorker' in navigator)) return;
  try {
    updateSW = registerSW({
      immediate: true,
      onNeedRefresh() {
        needRefresh.value = true;
      },
      onOfflineReady() {
        offlineReady.value = true;
      },
      onRegisteredSW(_url, r) {
        reg = r;
        // kiểm tra bài mới mỗi giờ khi đang mở app
        if (r) setInterval(() => void r.update().catch(() => undefined), 60 * 60 * 1000);
      },
    });
  } catch {
    /* trình duyệt không cho đăng ký */
  }
}

export async function applyUpdate() {
  needRefresh.value = false;
  if (updateSW) await updateSW(true);
  else location.reload();
}

export async function checkForUpdate() {
  if (!reg) {
    updateChecking.value = 'error';
    return;
  }
  updateChecking.value = 'checking';
  try {
    await reg.update();
    updateChecking.value = needRefresh.value || reg.waiting || reg.installing ? 'idle' : 'latest';
  } catch {
    updateChecking.value = 'error';
  }
}

/** Sự kiện "cài app" của Chrome Android / máy tính. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
}
export const installEvent = signal<BeforeInstallPromptEvent | null>(null);
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    installEvent.value = e as BeforeInstallPromptEvent;
  });
}

export const isStandalone = () =>
  (typeof matchMedia !== 'undefined' && matchMedia('(display-mode: standalone)').matches) || (navigator as Navigator & { standalone?: boolean }).standalone === true;
