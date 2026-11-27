// Đọc file nội dung từ đĩa (dùng cho các script Node và test).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const CONTENT = path.join(ROOT, 'content');
export const LESSONS_DIR = path.join(CONTENT, 'lessons');

export const lessonFiles = () =>
  fs
    .readdirSync(LESSONS_DIR)
    .filter((f) => /^bai-\d+\.json$/.test(f))
    .sort((a, b) => parseInt(a.slice(4), 10) - parseInt(b.slice(4), 10));

export function readJson<T = unknown>(file: string): T {
  const raw = fs.readFileSync(file, 'utf8');
  try {
    return JSON.parse(raw) as T;
  } catch (e) {
    throw new Error(`${path.relative(ROOT, file)}: JSON sai cú pháp — ${(e as Error).message}`);
  }
}

export function writeJson(file: string, data: unknown) {
  fs.writeFileSync(file, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

export const lessonPath = (n: number) => path.join(LESSONS_DIR, `bai-${n}.json`);
