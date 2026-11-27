// npm run validate — kiểm tra toàn bộ content/ (schema + ý nghĩa). Thoát với mã 1 nếu có lỗi.
import path from 'node:path';
import type { z } from 'zod';
import { ConfusablesSchema, LessonSchema, LoanwordsSchema, SoDemSchema, type Lesson } from '../src/lib/schema';
import { checkConfusables, checkLesson, checkLoanwords, checkSoDem, crossLessonDuplicates, type Issue } from '../src/lib/checks';
import { CONTENT, LESSONS_DIR, lessonFiles, readJson } from './lib/content';

let errors = 0;
let warnings = 0;
const quiet = process.argv.includes('--quiet');

function report(file: string, issues: Issue[]) {
  for (const i of issues) {
    if (i.level === 'error') errors++;
    else warnings++;
    if (i.level === 'warning' && quiet) continue;
    console.log(`  ${i.level === 'error' ? '✖ LỖI' : '⚠ cảnh báo'} ${file} › ${i.where}: ${i.msg}`);
  }
}

function parse<T>(schema: z.ZodType<T>, file: string): T | null {
  let data: unknown;
  try {
    data = readJson(file);
  } catch (e) {
    errors++;
    console.log('  ✖ LỖI ' + (e as Error).message);
    return null;
  }
  const r = schema.safeParse(data);
  if (!r.success) {
    for (const iss of r.error.issues) {
      errors++;
      console.log(`  ✖ LỖI ${path.basename(file)} › ${iss.path.join('.') || '(gốc)'}: ${iss.message}`);
    }
    return null;
  }
  return r.data;
}

console.log('Kiểm tra nội dung trong content/ …');
const lessons: Lesson[] = [];
const files = lessonFiles();
if (!files.length) {
  errors++;
  console.log('  ✖ LỖI không có file bài nào trong content/lessons/');
}
for (const f of files) {
  const L = parse(LessonSchema, path.join(LESSONS_DIR, f));
  if (!L) continue;
  lessons.push(L);
  const issues = checkLesson(L, f);
  report(f, issues);
  const nWords = L.vocab.reduce((a, g) => a + g.items.length, 0);
  const bad = issues.filter((i) => i.level === 'error').length;
  console.log(`${bad ? '✖' : '✔'} ${f}: ${nWords} từ · ${L.grammar.length} mẫu ngữ pháp · ${L.fill.length} câu điền · ${L.order.length} câu sắp xếp`);
}
const nums = lessons.map((l) => l.lesson);
if (new Set(nums).size !== nums.length) {
  errors++;
  console.log('  ✖ LỖI có hai file cùng số bài');
}
report('lessons', crossLessonDuplicates(lessons));

const soDem = parse(SoDemSchema, path.join(CONTENT, 'so-dem.json'));
if (soDem) {
  const iss = checkSoDem(soDem);
  report('so-dem.json', iss);
  console.log(`${iss.some((i) => i.level === 'error') ? '✖' : '✔'} so-dem.json: ${soDem.counters.length} đơn vị đếm · ${soDem.pages.length} trang`);
}
const loan = parse(LoanwordsSchema, path.join(CONTENT, 'tu-muon.json'));
if (loan) {
  const iss = checkLoanwords(loan);
  report('tu-muon.json', iss);
  console.log(`${iss.some((i) => i.level === 'error') ? '✖' : '✔'} tu-muon.json: ${loan.words.length} từ mượn`);
}
const conf = parse(ConfusablesSchema, path.join(CONTENT, 'de-nham.json'));
if (conf) {
  const iss = checkConfusables(conf);
  report('de-nham.json', iss);
  console.log(`${iss.some((i) => i.level === 'error') ? '✖' : '✔'} de-nham.json`);
}

console.log(errors ? `\n✖ Có ${errors} lỗi, ${warnings} cảnh báo. Hãy sửa lỗi trước khi commit.` : `\n✔ Nội dung hợp lệ (${warnings} cảnh báo).`);
process.exit(errors ? 1 : 0);
