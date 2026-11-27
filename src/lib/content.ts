// Nạp nội dung từ content/. Mỗi bài là một file JSON được tách thành chunk riêng và chỉ tải
// khi cần (service worker vẫn lưu sẵn tất cả để dùng offline).
import { signal } from '@preact/signals';
import type { Confusables, Lesson, Loanwords, SoDem } from './schema';
import soDemJson from '../../content/so-dem.json';
import tuMuonJson from '../../content/tu-muon.json';
import deNhamJson from '../../content/de-nham.json';

export const SO_DEM = soDemJson as unknown as SoDem;
export const TU_MUON = tuMuonJson as unknown as Loanwords;
export const DE_NHAM = deNhamJson as unknown as Confusables;

const loaders = import.meta.glob<Lesson>('../../content/lessons/bai-*.json', { import: 'default' });
const byNumber = new Map<number, () => Promise<Lesson>>();
for (const [p, fn] of Object.entries(loaders)) {
  const m = p.match(/bai-(\d+)\.json$/);
  if (m) byNumber.set(parseInt(m[1], 10), fn);
}

/** Các số bài hiện có, tăng dần. */
export const LESSON_NUMBERS = [...byNumber.keys()].sort((a, b) => a - b);

const cache = new Map<number, Lesson>();
/** Tăng mỗi khi có bài mới nạp xong — để component vẽ lại. */
export const lessonsLoaded = signal(0);

export function getLesson(n: number): Lesson | undefined {
  return cache.get(n);
}

export async function loadLesson(n: number): Promise<Lesson | undefined> {
  if (cache.has(n)) return cache.get(n);
  const fn = byNumber.get(n);
  if (!fn) return undefined;
  const L = await fn();
  cache.set(n, L);
  lessonsLoaded.value++;
  return L;
}

export function preloadAllLessons() {
  for (const n of LESSON_NUMBERS) void loadLesson(n).catch(() => undefined);
}
