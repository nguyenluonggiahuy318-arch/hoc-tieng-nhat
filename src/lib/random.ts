export function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const rnd = (a: number, b: number) => a + Math.floor(Math.random() * (b - a + 1));
export const pickOne = <T>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)];

/** Chọn ngẫu nhiên theo trọng số. */
export function pickWeighted<T>(items: T[], weight: (t: T) => number): T {
  let total = 0;
  const ws = items.map((it) => {
    const w = Math.max(0, weight(it));
    total += w;
    return w;
  });
  if (total <= 0) return pickOne(items);
  let r = Math.random() * total;
  for (let i = 0; i < items.length; i++) {
    r -= ws[i];
    if (r <= 0) return items[i];
  }
  return items[items.length - 1];
}

/**
 * Bộ bài xoay vòng: lần lượt đi hết mọi phần tử theo thứ tự ngẫu nhiên rồi mới lặp lại,
 * và không lặp ngay phần tử vừa ra. Giúp ôn đều mọi câu.
 */
export class Deck<T> {
  private queue: T[] = [];
  private last: T | undefined;
  constructor(private items: T[]) {}
  get size() {
    return this.items.length;
  }
  next(): T {
    if (!this.items.length) throw new Error('Deck rỗng');
    if (!this.queue.length) {
      this.queue = shuffle(this.items.slice());
      if (this.queue.length > 1 && this.queue[0] === this.last) this.queue.push(this.queue.shift()!);
    }
    this.last = this.queue.shift()!;
    return this.last;
  }
}
