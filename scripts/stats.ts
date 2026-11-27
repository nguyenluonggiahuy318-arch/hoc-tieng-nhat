// npm run stats — số từ / mẫu ngữ pháp / bài tập của từng bài và link web (GitHub Pages).
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import type { Lesson, SoDem } from '../src/lib/schema';
import { CONTENT, LESSONS_DIR, ROOT, lessonFiles, readJson } from './lib/content';

export function siteUrl(): string | null {
  const r = spawnSync('git', ['remote', 'get-url', 'origin'], { cwd: ROOT, encoding: 'utf8' });
  const m = (r.stdout ?? '').trim().match(/github\.com[/:]([^/]+)\/([^/.]+?)(\.git)?$/);
  if (!m) return null;
  const [, owner, repo] = m;
  return repo.toLowerCase() === `${owner.toLowerCase()}.github.io` ? `https://${owner.toLowerCase()}.github.io/` : `https://${owner.toLowerCase()}.github.io/${repo}/`;
}

const rows = lessonFiles().map((f) => {
  const L = readJson<Lesson>(path.join(LESSONS_DIR, f));
  const minna = L.grammar.filter((g) => (Array.isArray(g.source) ? g.source : [g.source]).includes('minna')).length;
  return {
    bai: L.lesson,
    title: L.title,
    tu: L.vocab.reduce((a, g) => a + g.items.length, 0),
    nguPhap: L.grammar.length,
    theoMinna: minna,
    dien: L.fill.length,
    sapXep: L.order.length,
    suaLoi: L.corrections.length,
  };
});
const soDem = readJson<SoDem>(path.join(CONTENT, 'so-dem.json'));
if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ lessons: rows, counters: soDem.counters.map((c) => c.name), url: siteUrl() }, null, 2));
} else {
  for (const r of rows)
    console.log(`Bài ${r.bai} (${r.title}): ${r.tu} từ · ${r.nguPhap} mẫu ngữ pháp${r.theoMinna ? ` (${r.theoMinna} theo Minna)` : ''} · ${r.dien} câu điền · ${r.sapXep} câu sắp xếp${r.suaLoi ? ` · ${r.suaLoi} chỗ sửa lỗi` : ''}`);
  console.log('Đơn vị đếm: ' + soDem.counters.map((c) => c.name).join(', '));
  console.log('Link web: ' + (siteUrl() ?? '(chưa có remote GitHub)'));
}
