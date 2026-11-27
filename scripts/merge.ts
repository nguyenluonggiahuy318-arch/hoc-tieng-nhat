// npm run merge -- <file-nháp.json> [--dry-run]
//
// Gộp nội dung MỚI (file nháp) vào content/lessons/bai-N.json mà không phá dữ liệu cũ:
//  - giữ nguyên mọi mục đã có, chỉ thêm mục mới; mục trùng thì bỏ qua;
//  - từ vựng trùng (cùng chữ kana) không thêm lại; nếu bản cũ thiếu phiên âm thì bổ sung;
//  - mẫu ngữ pháp trùng thì chỉ thêm ví dụ mới;
//  - đơn vị đếm mới (giờ, tháng…) trong "counters"/"pages" được thêm vào content/so-dem.json;
//  - kiểm tra lại toàn bộ (schema + nội dung) trước khi ghi; có lỗi thì KHÔNG ghi gì cả.
// File nháp có dạng giống bai-N.json nhưng chỉ cần các phần mới, ví dụ:
//   { "lesson": 4, "title": "だい４か", "sources": ["bai4.mp4"], "vocab": [...], "grammar": [...],
//     "fill": [...], "order": [...], "corrections": [...], "counters": [...], "pages": [...] }
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CounterPageSchema, CounterSchema, LessonSchema, SoDemSchema, type Counter, type CounterPage, type Lesson, type SoDem } from '../src/lib/schema';
import { checkLesson, checkSoDem } from '../src/lib/checks';
import { normalizeAnswer } from '../src/lib/romaji';
import { CONTENT, ROOT, lessonPath, readJson, writeJson } from './lib/content';

export interface MergeStats {
  lesson: number;
  created: boolean;
  vocab: number;
  grammar: number;
  examples: number;
  fill: number;
  order: number;
  corrections: number;
  counters: string[];
  skipped: string[];
  filled: string[];
}

type Draft = Partial<Lesson> & { lesson: number; counters?: Counter[]; pages?: CounterPage[] };

const key = (s: string) => normalizeAnswer(s).toLowerCase();

export function mergeLesson(base: Lesson | null, d: Draft): { lesson: Lesson; stats: MergeStats } {
  const L: Lesson = base
    ? structuredClone(base)
    : { lesson: d.lesson, title: d.title ?? `だい${String(d.lesson).replace(/\d/g, (c) => '０１２３４５６７８９'[+c])}か`, sources: [], vocab: [], grammar: [], fill: [], order: [], corrections: [] };
  const st: MergeStats = { lesson: d.lesson, created: !base, vocab: 0, grammar: 0, examples: 0, fill: 0, order: 0, corrections: 0, counters: [], skipped: [], filled: [] };

  if (!base && d.title) L.title = d.title;
  for (const s of d.sources ?? []) if (!L.sources.includes(s)) L.sources.push(s);
  if (d.notes) {
    L.notes = L.notes ?? {};
    for (const [k, v] of Object.entries(d.notes) as [keyof NonNullable<Lesson['notes']>, string | undefined][]) {
      if (!v) continue;
      if (!L.notes[k]) {
        L.notes[k] = v;
        st.filled.push(`notes.${k}`);
      } else if (L.notes[k] !== v) st.skipped.push(`notes.${k} (đã có, giữ bản cũ)`);
    }
  }

  // Từ vựng
  const existing = new Map<string, { jp: string; phienam: string; romaji: string; vi: string }>();
  for (const g of L.vocab) for (const w of g.items) existing.set(key(w.jp), w);
  for (const dg of d.vocab ?? []) {
    let g = L.vocab.find((x) => x.group === dg.group);
    for (const w of dg.items) {
      const old = existing.get(key(w.jp));
      if (old) {
        if (!old.phienam && w.phienam) {
          old.phienam = w.phienam;
          st.filled.push(`phiên âm của ${w.jp}`);
        } else st.skipped.push(`từ ${w.jp} (đã có)`);
        continue;
      }
      if (!g) {
        g = { group: dg.group, items: [] };
        L.vocab.push(g);
      }
      g.items.push(w);
      existing.set(key(w.jp), w);
      st.vocab++;
    }
  }

  // Ngữ pháp
  for (const dg of d.grammar ?? []) {
    const old = L.grammar.find((x) => key(x.pattern) === key(dg.pattern));
    if (!old) {
      L.grammar.push(dg);
      st.grammar++;
      st.examples += dg.examples.length;
      continue;
    }
    for (const ex of dg.examples) {
      if (old.examples.some((e) => key(e.jp) === key(ex.jp))) continue;
      old.examples.push(ex);
      st.examples++;
    }
    if (!old.note && dg.note) {
      old.note = dg.note;
      st.filled.push(`ghi chú của mẫu ${old.pattern}`);
    }
    st.skipped.push(`mẫu ${dg.pattern} (đã có${dg.examples.length ? ', chỉ thêm ví dụ mới' : ''})`);
  }

  // Bài tập
  for (const f of d.fill ?? []) {
    if (L.fill.some((x) => key(x.q) === key(f.q))) st.skipped.push(`câu điền "${f.q}" (đã có)`);
    else {
      L.fill.push(f);
      st.fill++;
    }
  }
  for (const o of d.order ?? []) {
    if (L.order.some((x) => x.words.join('|') === o.words.join('|'))) st.skipped.push(`câu sắp xếp "${o.vi}" (đã có)`);
    else {
      L.order.push(o);
      st.order++;
    }
  }
  for (const c of d.corrections ?? []) {
    if (!L.corrections.includes(c)) {
      L.corrections.push(c);
      st.corrections++;
    }
  }
  if (d.selfIntro && !L.selfIntro) L.selfIntro = d.selfIntro;
  return { lesson: L, stats: st };
}

export function mergeSoDem(base: SoDem, d: Draft, st: MergeStats): SoDem {
  const out = structuredClone(base);
  for (const c of d.counters ?? []) {
    const parsed = CounterSchema.parse(c);
    if (out.counters.some((x) => x.id === parsed.id)) st.skipped.push(`đơn vị đếm ${parsed.id} (đã có)`);
    else {
      out.counters.push(parsed);
      st.counters.push(parsed.name);
    }
  }
  for (const p of d.pages ?? []) {
    const parsed = CounterPageSchema.parse(p);
    const old = out.pages.find((x) => x.id === parsed.id);
    if (!old) out.pages.push(parsed);
    else {
      for (const id of parsed.counters) if (!old.counters.includes(id)) old.counters.push(id);
      for (const r of parsed.rules ?? []) if (!(old.rules ?? []).some((x) => x.sym === r.sym && x.html === r.html)) (old.rules ??= []).push(r);
    }
  }
  return out;
}

export function summary(st: MergeStats): string {
  const parts = [`+${st.vocab} từ`, `+${st.grammar} mẫu ngữ pháp`];
  if (st.examples) parts.push(`+${st.examples} ví dụ`);
  parts.push(`+${st.fill} câu điền`, `+${st.order} câu sắp xếp`);
  if (st.counters.length) parts.push(`+đơn vị đếm: ${st.counters.join(', ')}`);
  if (st.corrections) parts.push(`${st.corrections} chỗ sửa lỗi tài liệu`);
  return `Bài ${st.lesson}: ${parts.join(', ')}`;
}

function main() {
  const args = process.argv.slice(2);
  const file = args.find((a) => !a.startsWith('--'));
  const dry = args.includes('--dry-run');
  if (!file) {
    console.error('Cách dùng: npm run merge -- <file-nháp.json> [--dry-run]');
    process.exit(2);
  }
  const draft = readJson<Draft>(path.resolve(file));
  if (!Number.isInteger(draft.lesson) || draft.lesson < 1) {
    console.error('File nháp phải có "lesson" là số bài (ví dụ 4).');
    process.exit(2);
  }
  const p = lessonPath(draft.lesson);
  const base = fs.existsSync(p) ? LessonSchema.parse(readJson(p)) : null;
  const { lesson, stats } = mergeLesson(base, draft);
  const soDemPath = path.join(CONTENT, 'so-dem.json');
  const soDem = mergeSoDem(SoDemSchema.parse(readJson(soDemPath)), draft, stats);

  // kiểm tra trước khi ghi
  const problems: string[] = [];
  const r = LessonSchema.safeParse(lesson);
  if (!r.success) for (const i of r.error.issues) problems.push(`schema › ${i.path.join('.')}: ${i.message}`);
  else for (const i of checkLesson(lesson, path.basename(p))) if (i.level === 'error') problems.push(`${i.where}: ${i.msg}`);
  for (const i of checkSoDem(soDem)) if (i.level === 'error') problems.push(`so-dem › ${i.where}: ${i.msg}`);
  if (base) {
    // bảo đảm không mất dữ liệu cũ
    const count = (L: Lesson) => [L.vocab.reduce((a, g) => a + g.items.length, 0), L.grammar.length, L.fill.length, L.order.length];
    const [a, b] = [count(base), count(lesson)];
    if (b.some((x, i) => x < a[i])) problems.push('kết quả gộp có ít mục hơn bản cũ — dừng lại để không mất dữ liệu');
  }
  if (problems.length) {
    console.error('✖ Không ghi gì cả vì nội dung sau khi gộp có lỗi:\n' + problems.map((x) => '  - ' + x).join('\n'));
    process.exit(1);
  }
  const line = summary(stats);
  console.log((dry ? '[thử] ' : '') + line + (stats.created ? ' (bài mới)' : ''));
  if (stats.filled.length) console.log('  bổ sung: ' + stats.filled.join('; '));
  if (stats.skipped.length) console.log(`  bỏ qua ${stats.skipped.length} mục trùng: ` + stats.skipped.slice(0, 12).join('; ') + (stats.skipped.length > 12 ? ' …' : ''));
  if (dry) return;
  writeJson(p, lesson);
  writeJson(soDemPath, soDem);
  const work = path.join(ROOT, 'inbox', '.work');
  fs.mkdirSync(work, { recursive: true });
  const logPath = path.join(work, 'merge-log.json');
  const log = fs.existsSync(logPath) ? (JSON.parse(fs.readFileSync(logPath, 'utf8')) as { summary: string; stats: MergeStats }[]) : [];
  log.push({ summary: line, stats });
  fs.writeFileSync(logPath, JSON.stringify(log, null, 2));
  console.log(`✔ Đã ghi ${path.relative(ROOT, p)}${stats.counters.length ? ' và content/so-dem.json' : ''}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
