// npm run inbox:done [-- --keep-work]
// Chuyển các file đã xử lý (theo inbox/.work/manifest.json) sang inbox/done/, dọn thư mục làm việc,
// và in nội dung commit gợi ý (lấy từ inbox/.work/merge-log.json).
// Nếu file đã từng được commit lên git (ví dụ tải lên qua web GitHub) thì gỡ khỏi git (git rm --cached)
// để video nặng không nằm lại trong repo.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { ROOT } from '../lib/content';

const INBOX = path.join(ROOT, 'inbox');
const WORK = path.join(INBOX, '.work');
const DONE = path.join(INBOX, 'done');
const keepWork = process.argv.includes('--keep-work');

const manifestPath = path.join(WORK, 'manifest.json');
if (!fs.existsSync(manifestPath)) {
  console.log('Chưa có inbox/.work/manifest.json — hãy chạy npm run inbox:scan trước.');
  process.exit(0);
}
const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8')) as { files: { file: string; files?: string[]; workDir: string }[] };
fs.mkdirSync(DONE, { recursive: true });
const stamp = new Date().toISOString().slice(0, 10);
let moved = 0;
const items = manifest.files.flatMap((e) => (e.files ?? [e.file]).map((file, i, all) => ({ file, workDir: i === all.length - 1 ? e.workDir : '' })));
for (const f of items) {
  const src = path.join(ROOT, f.file);
  if (!fs.existsSync(src)) continue;
  let dest = path.join(DONE, path.basename(src));
  if (fs.existsSync(dest)) dest = path.join(DONE, `${stamp}_${path.basename(src)}`);
  const tracked = spawnSync('git', ['ls-files', '--error-unmatch', f.file], { cwd: ROOT, encoding: 'utf8' }).status === 0;
  fs.renameSync(src, dest);
  if (tracked) spawnSync('git', ['rm', '--cached', '-q', '--', f.file], { cwd: ROOT });
  moved++;
  console.log(`✔ ${f.file} → ${path.relative(ROOT, dest)}${tracked ? ' (đã gỡ khỏi git)' : ''}`);
  if (!keepWork && f.workDir) fs.rmSync(path.join(ROOT, f.workDir), { recursive: true, force: true });
}

const logPath = path.join(WORK, 'merge-log.json');
if (fs.existsSync(logPath)) {
  const log = JSON.parse(fs.readFileSync(logPath, 'utf8')) as { summary: string }[];
  const lines = [...new Set(log.map((x) => x.summary))];
  if (lines.length) {
    console.log('\nNội dung commit gợi ý:\n' + lines.join('; '));
    fs.writeFileSync(path.join(WORK, 'commit-message.txt'), lines.join('; ') + '\n');
  }
  fs.rmSync(logPath);
}
if (!keepWork) fs.rmSync(manifestPath, { force: true });
console.log(`\nĐã chuyển ${moved} file sang inbox/done/.`);
