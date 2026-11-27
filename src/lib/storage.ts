// Lưu tiến độ trong localStorage. Mọi truy cập đều bọc try/catch: ở chế độ riêng tư hoặc khi
// trình duyệt chặn lưu trữ, app vẫn chạy (dữ liệu chỉ giữ trong phiên hiện tại).

export const PREFIX = 'hn.';
const mem = new Map<string, string>();

export function load<T>(key: string, def: T): T {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(PREFIX + key);
  } catch {
    /* bị chặn */
  }
  if (raw == null) raw = mem.get(key) ?? null;
  if (raw == null) return def;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return def;
  }
}

export function store(key: string, value: unknown) {
  const raw = JSON.stringify(value);
  mem.set(key, raw);
  try {
    localStorage.setItem(PREFIX + key, raw);
  } catch {
    /* đầy bộ nhớ hoặc bị chặn */
  }
}

export function removeKey(key: string) {
  mem.delete(key);
  try {
    localStorage.removeItem(PREFIX + key);
  } catch {
    /* bị chặn */
  }
}

function allKeys(): string[] {
  const keys = new Set<string>(mem.keys());
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(PREFIX)) keys.add(k.slice(PREFIX.length));
    }
  } catch {
    /* bị chặn */
  }
  return [...keys];
}

export interface ProgressFile {
  app: 'hoc-tieng-nhat';
  version: 1;
  exportedAt: string;
  data: Record<string, unknown>;
}

export function exportProgress(): ProgressFile {
  const data: Record<string, unknown> = {};
  for (const k of allKeys().sort()) data[k] = load(k, null);
  return { app: 'hoc-tieng-nhat', version: 1, exportedAt: new Date().toISOString(), data };
}

export type ImportResult = { ok: true; keys: number; exportedAt: string } | { ok: false; error: string };

/** Ghi đè toàn bộ tiến độ bằng nội dung file đã xuất trước đó. */
export function importProgress(text: string): ImportResult {
  let f: unknown;
  try {
    f = JSON.parse(text);
  } catch {
    return { ok: false, error: 'File không phải JSON hợp lệ.' };
  }
  const p = f as Partial<ProgressFile>;
  if (!p || p.app !== 'hoc-tieng-nhat' || typeof p.data !== 'object' || p.data === null || Array.isArray(p.data)) {
    return { ok: false, error: 'Đây không phải file tiến độ của web này.' };
  }
  if (p.version !== 1) return { ok: false, error: 'File được tạo bởi phiên bản khác, chưa hỗ trợ.' };
  for (const k of allKeys()) removeKey(k);
  let n = 0;
  for (const [k, v] of Object.entries(p.data)) {
    if (!/^[a-zA-Z0-9._-]+$/.test(k)) continue;
    store(k, v);
    n++;
  }
  return { ok: true, keys: n, exportedAt: String(p.exportedAt ?? '') };
}
