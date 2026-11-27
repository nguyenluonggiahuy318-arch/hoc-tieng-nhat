import { beforeEach, describe, expect, it } from 'vitest';

class MemStorage {
  m = new Map<string, string>();
  get length() {
    return this.m.size;
  }
  key(i: number) {
    return [...this.m.keys()][i] ?? null;
  }
  getItem(k: string) {
    return this.m.get(k) ?? null;
  }
  setItem(k: string, v: string) {
    this.m.set(k, String(v));
  }
  removeItem(k: string) {
    this.m.delete(k);
  }
  clear() {
    this.m.clear();
  }
}

describe('lưu & xuất / nhập tiến độ', () => {
  beforeEach(() => {
    (globalThis as unknown as { localStorage: MemStorage }).localStorage = new MemStorage();
  });

  it('xuất ra rồi nhập lại được đúng dữ liệu', async () => {
    const s = await import('../../src/lib/storage');
    s.store('script', 'kata');
    s.store('kana', { ア: { c: 3, w: 0, st: 3 } });
    localStorage.setItem('khac-app', 'x'); // khoá của app khác không bị đụng tới
    const file = JSON.stringify(s.exportProgress());
    localStorage.clear();
    s.store('script', 'hira');
    const r = s.importProgress(file);
    expect(r.ok).toBe(true);
    expect(s.load('script', '')).toBe('kata');
    expect(s.load('kana', {})).toEqual({ ア: { c: 3, w: 0, st: 3 } });
  });

  it('từ chối file lạ', async () => {
    const s = await import('../../src/lib/storage');
    expect(s.importProgress('không phải json').ok).toBe(false);
    expect(s.importProgress('{"app":"khac","version":1,"data":{}}').ok).toBe(false);
    expect(s.importProgress('{"app":"hoc-tieng-nhat","version":2,"data":{}}').ok).toBe(false);
  });

  it('không có localStorage (chế độ riêng tư) vẫn chạy', async () => {
    (globalThis as unknown as { localStorage: unknown }).localStorage = {
      getItem() {
        throw new Error('blocked');
      },
      setItem() {
        throw new Error('blocked');
      },
      removeItem() {
        throw new Error('blocked');
      },
      key() {
        throw new Error('blocked');
      },
      get length(): number {
        throw new Error('blocked');
      },
    };
    const s = await import('../../src/lib/storage');
    expect(() => s.store('x', 1)).not.toThrow();
    expect(s.load('x', 0)).toBe(1); // giữ trong bộ nhớ của phiên
    expect(s.load('khong-co', 'mac-dinh')).toBe('mac-dinh');
  });
});
