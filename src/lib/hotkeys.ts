// Phím tắt trên máy tính: 1–4 chọn đáp án, Enter câu tiếp, Space lật thẻ.
// Mỗi màn hình đăng ký bộ xử lý của mình khi đang hiển thị.
import { useEffect, useRef } from 'preact/hooks';

export interface Hotkeys {
  digit?: (n: number) => void;
  enter?: () => void;
  space?: () => void;
}

let current: { current: Hotkeys } | null = null;

if (typeof document !== 'undefined') {
  document.addEventListener('keydown', (e) => {
    if (!current || e.altKey || e.ctrlKey || e.metaKey) return;
    const t = e.target as HTMLElement | null;
    const tag = t?.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t?.isContentEditable) return;
    const h = current.current;
    if (e.key === ' ' && h.space) {
      e.preventDefault();
      h.space();
    } else if (e.key === 'Enter' && h.enter) {
      if (tag === 'BUTTON' || tag === 'A' || tag === 'SUMMARY') e.preventDefault();
      h.enter();
    } else if (/^[1-9]$/.test(e.key) && h.digit) {
      h.digit(parseInt(e.key, 10));
    }
  });
}

/** Đăng ký phím tắt khi `active` = true. Handler luôn là bản mới nhất (không cần deps). */
export function useHotkeys(active: boolean, handlers: Hotkeys) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!active) return;
    current = ref;
    return () => {
      if (current === ref) current = null;
    };
  }, [active]);
}
