// npm run inbox:scan [-- --interval 10 --threshold 0.06 --no-whisper --force]
//
// Quét các file mới trong inbox/ và chuẩn bị tư liệu để Claude đọc:
//  - Video: ffmpeg cắt 1 khung mỗi 8–15 giây → bỏ khung gần giống nhau (so độ khác ảnh) →
//    ghép thành ảnh lưới (4 khung/ảnh) có ghi thời điểm. Nếu máy có whisper thì chép lời giảng.
//  - PDF: pdftotext -layout; nếu là ảnh scan (gần như không có chữ) thì xuất từng trang ra ảnh.
//  - Ảnh: chép sang thư mục làm việc (HEIC đổi sang JPG).
//  - DOCX: lấy chữ và ảnh nhúng.
// Kết quả nằm trong inbox/.work/<tên-file>/ và tóm tắt ở inbox/.work/manifest.json.
import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';
import { strFromU8, unzipSync } from 'fflate';
import { ROOT } from '../lib/content';

const INBOX = path.join(ROOT, 'inbox');
const WORK = path.join(INBOX, '.work');
const VIDEO = /\.(mp4|mov|m4v|webm|mkv|avi)$/i;
const IMAGE = /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i;
const PDF = /\.pdf$/i;
const DOCX = /\.docx$/i;

const argv = process.argv.slice(2);
const flag = (name: string) => argv.includes('--' + name);
const opt = (name: string) => {
  const i = argv.indexOf('--' + name);
  return i >= 0 ? argv[i + 1] : undefined;
};
const FORCE = flag('force');
const NO_WHISPER = flag('no-whisper');
/** Tỉ lệ ô thay đổi tối thiểu để coi là slide mới (0.06 = 6% số ô). */
const THRESHOLD = parseFloat(opt('threshold') ?? '0.06');

interface Tools {
  ffmpeg: boolean;
  ffprobe: boolean;
  pdftotext: boolean;
  pdftoppm: boolean;
  pdfinfo: boolean;
  whisper: string | null;
}

export interface Entry {
  file: string;
  kind: 'video' | 'pdf' | 'image' | 'docx' | 'other';
  sizeMB: number;
  workDir: string;
  /** Ảnh cần đọc (ảnh lưới của video, trang PDF scan, ảnh gốc, ảnh trong docx). */
  images: string[];
  /** File chữ đã trích (PDF, DOCX, lời giảng). */
  texts: string[];
  durationSec?: number;
  framesExtracted?: number;
  framesKept?: number;
  intervalSec?: number;
  slidesDir?: string;
  transcript?: string | null;
  scanned?: boolean;
  lessonHints: { lesson: number; from: string }[];
  notes: string[];
}

function has(cmd: string): boolean {
  const r = spawnSync(process.platform === 'win32' ? 'where' : 'which', [cmd], { encoding: 'utf8' });
  return r.status === 0 && !!r.stdout.trim();
}

function run(cmd: string, args: string[], opts: { cwd?: string } = {}) {
  const r = spawnSync(cmd, args, { encoding: 'utf8', maxBuffer: 1024 * 1024 * 64, ...opts });
  return { ok: r.status === 0, stdout: r.stdout ?? '', stderr: (r.stderr ?? '') + (r.error ? String(r.error) : '') };
}

const rel = (p: string) => path.relative(ROOT, p).split(path.sep).join('/');
const slug = (name: string) =>
  name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/gi, 'd')
    .replace(/\.[^.]+$/, '')
    .replace(/[^a-zA-Z0-9\u3040-\u30ff\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60) || 'file';

const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// ------------------------------------------------------------------ đoán số bài

const KANJI_NUM: Record<string, number> = { 一: 1, 二: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9, 十: 10 };
function toNumber(s: string): number | null {
  const t = s.replace(/[０-９]/g, (c) => String.fromCharCode(c.charCodeAt(0) - 0xfee0));
  if (/^\d+$/.test(t)) return parseInt(t, 10);
  // 十二 = 12, 二十 = 20, 二十五 = 25
  if (/^[一二三四五六七八九十]+$/.test(t)) {
    if (!t.includes('十')) return KANJI_NUM[t] ?? null;
    const [a, b] = t.split('十');
    return (a ? KANJI_NUM[a] : 1) * 10 + (b ? KANJI_NUM[b] : 0);
  }
  return null;
}

export function lessonHints(text: string, from: string): { lesson: number; from: string }[] {
  const out: { lesson: number; from: string }[] = [];
  const pats: RegExp[] = [
    /だい\s*([0-9０-９一二三四五六七八九十]+)\s*か/g,
    /第\s*([0-9０-９一二三四五六七八九十]+)\s*課/g,
    /b[àa]i[\s_\-.:]*0*([0-9]{1,2})(?![0-9])/gi,
    /lesson[\s_\-]*0*([0-9]{1,2})(?![0-9])/gi,
  ];
  for (const re of pats) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text))) {
      const n = toNumber(m[1]);
      if (n && n > 0 && n < 100) out.push({ lesson: n, from: `${from}: "${m[0].trim()}"` });
    }
  }
  return out;
}

// ------------------------------------------------------------------ video

// Chữ ký khung hình: ảnh xám 256×144 chia lưới 16×9 ô (mỗi ô 16×16 px).
const GW = 16, GH = 9, CELL = 16;
export async function frameSignature(file: string): Promise<{ cells: Float32Array; std: number }> {
  const data = await sharp(file).resize(GW * CELL, GH * CELL, { fit: 'fill' }).grayscale().raw().toBuffer();
  const cells = new Float32Array(GW * GH * CELL * CELL);
  let sum = 0;
  for (let i = 0; i < data.length; i++) {
    cells[i] = data[i];
    sum += data[i];
  }
  const mean = sum / data.length;
  let sq = 0;
  for (const v of data) sq += (v - mean) ** 2;
  return { cells, std: Math.sqrt(sq / data.length) };
}
/**
 * Tỉ lệ ô (trong lưới 16×9) thay đổi rõ giữa hai khung. Slide mới làm đổi nhiều ô; khung webcam nhỏ
 * ở góc hay con trỏ chuột chỉ đổi vài ô → vẫn coi là cùng một slide.
 */
export function changedRatio(a: Float32Array, b: Float32Array): number {
  const W = GW * CELL;
  let changed = 0;
  for (let gy = 0; gy < GH; gy++)
    for (let gx = 0; gx < GW; gx++) {
      let d = 0;
      for (let y = 0; y < CELL; y++)
        for (let x = 0; x < CELL; x++) {
          const i = (gy * CELL + y) * W + gx * CELL + x;
          d += Math.abs(a[i] - b[i]);
        }
      if (d / (CELL * CELL) > 6) changed++;
    }
  return changed / (GW * GH);
}

async function contactSheets(frames: { file: string; t: number }[], outDir: string, prefix: string): Promise<string[]> {
  if (!frames.length) return [];
  const meta = await sharp(frames[0].file).metadata();
  const tileW = 800;
  const tileH = Math.round((tileW * (meta.height ?? 450)) / (meta.width ?? 800));
  const cols = 2,
    rows = 2,
    per = cols * rows,
    gap = 6;
  const sheets: string[] = [];
  const LABEL = 34; // dải ghi số thứ tự + thời điểm, nằm TRÊN khung để không che nội dung slide
  for (let s = 0; s * per < frames.length; s++) {
    const group = frames.slice(s * per, s * per + per);
    const nRows = Math.ceil(group.length / cols);
    const W = cols * tileW + (cols + 1) * gap;
    const H = nRows * (tileH + LABEL) + (nRows + 1) * gap;
    const comps: sharp.OverlayOptions[] = [];
    for (let i = 0; i < group.length; i++) {
      const x = gap + (i % cols) * (tileW + gap);
      const y = gap + Math.floor(i / cols) * (tileH + LABEL + gap);
      const label = `Khung ${s * per + i + 1} · ${fmtTime(group[i].t)}`;
      const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${tileW}" height="${LABEL}"><rect width="${tileW}" height="${LABEL}" fill="#c4412f"/><text x="12" y="24" font-family="sans-serif" font-size="20" font-weight="700" fill="#fff">${label}</text></svg>`;
      comps.push({ input: Buffer.from(svg), left: x, top: y });
      comps.push({ input: await sharp(group[i].file).resize(tileW, tileH, { fit: 'contain', background: '#000' }).toBuffer(), left: x, top: y + LABEL });
    }
    const out = path.join(outDir, `${prefix}-${String(s + 1).padStart(2, '0')}.jpg`);
    await sharp({ create: { width: W, height: H, channels: 3, background: '#ffffff' } })
      .composite(comps)
      .jpeg({ quality: 82 })
      .toFile(out);
    sheets.push(out);
  }
  return sheets;
}

async function processVideo(src: string, e: Entry, tools: Tools) {
  if (!tools.ffmpeg || !tools.ffprobe) {
    e.notes.push('Chưa cài ffmpeg nên không cắt được khung hình video. Cài ffmpeg (xem README) rồi chạy lại.');
    return;
  }
  const probe = run('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', src]);
  const dur = parseFloat(probe.stdout.trim()) || 0;
  e.durationSec = Math.round(dur);
  const interval = Math.min(15, Math.max(8, parseFloat(opt('interval') ?? '') || (dur < 600 ? 8 : dur > 2400 ? 15 : 10)));
  e.intervalSec = interval;
  const framesDir = path.join(e.workDir, 'frames');
  fs.rmSync(framesDir, { recursive: true, force: true });
  fs.mkdirSync(framesDir, { recursive: true });
  const r = run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-i', src, '-vf', `fps=1/${interval},scale=1280:-2`, '-q:v', '3', path.join(framesDir, 'f_%05d.jpg')]);
  if (!r.ok) {
    e.notes.push('ffmpeg lỗi khi cắt khung hình: ' + r.stderr.slice(0, 300));
    return;
  }
  const all = fs
    .readdirSync(framesDir)
    .filter((f) => f.endsWith('.jpg'))
    .sort();
  e.framesExtracted = all.length;
  // bỏ khung gần giống khung đã giữ, và khung gần như trống (màn hình đen/trắng)
  const kept: { file: string; t: number }[] = [];
  let last: Float32Array | null = null;
  for (let i = 0; i < all.length; i++) {
    const file = path.join(framesDir, all[i]);
    const { cells, std } = await frameSignature(file);
    if (std < 4) continue;
    if (last && changedRatio(last, cells) < THRESHOLD) continue;
    last = cells;
    kept.push({ file, t: i * interval });
  }
  e.framesKept = kept.length;
  const slidesDir = path.join(e.workDir, 'slides');
  fs.rmSync(slidesDir, { recursive: true, force: true });
  fs.mkdirSync(slidesDir, { recursive: true });
  kept.forEach((k, i) => fs.copyFileSync(k.file, path.join(slidesDir, `slide-${String(i + 1).padStart(3, '0')}-${fmtTime(k.t).replace(':', 'm')}s.jpg`)));
  e.slidesDir = rel(slidesDir);
  e.images = (await contactSheets(kept, e.workDir, 'luoi')).map(rel);
  fs.rmSync(framesDir, { recursive: true, force: true });

  // lời giảng
  if (NO_WHISPER) {
    e.transcript = null;
    e.notes.push('Bỏ qua chép lời giảng (--no-whisper): chỉ lấy được nội dung trên slide.');
  } else if (tools.whisper === 'whisper') {
    const model = process.env.WHISPER_MODEL || 'small';
    const w = run('whisper', [src, '--model', model, '--output_format', 'txt', '--output_dir', e.workDir, '--verbose', 'False']);
    const txt = path.join(e.workDir, path.basename(src).replace(/\.[^.]+$/, '') + '.txt');
    if (w.ok && fs.existsSync(txt)) {
      const t = path.join(e.workDir, 'loi-giang.txt');
      fs.renameSync(txt, t);
      e.transcript = rel(t);
      e.texts.push(rel(t));
    } else e.notes.push('whisper lỗi: ' + w.stderr.slice(0, 300) + ' — chỉ lấy được nội dung trên slide.');
  } else if (tools.whisper === 'whisper-cli' && process.env.WHISPER_CPP_MODEL) {
    const wav = path.join(e.workDir, 'audio.wav');
    run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, '-ar', '16000', '-ac', '1', '-c:a', 'pcm_s16le', wav]);
    const base = path.join(e.workDir, 'loi-giang');
    const w = run('whisper-cli', ['-m', process.env.WHISPER_CPP_MODEL, '-f', wav, '-l', 'auto', '-otxt', '-of', base]);
    fs.rmSync(wav, { force: true });
    if (w.ok && fs.existsSync(base + '.txt')) {
      e.transcript = rel(base + '.txt');
      e.texts.push(rel(base + '.txt'));
    } else e.notes.push('whisper-cli lỗi — chỉ lấy được nội dung trên slide.');
  } else {
    e.transcript = null;
    e.notes.push('Máy chưa có whisper nên KHÔNG chép được lời giảng — chỉ lấy được nội dung trên slide.');
  }
}

// ------------------------------------------------------------------ PDF, ảnh, DOCX

function processPdf(src: string, e: Entry, tools: Tools) {
  if (!tools.pdftotext) {
    e.notes.push('Chưa cài pdftotext (poppler). Hãy đọc thẳng file PDF bằng công cụ Read (tham số pages).');
    e.images.push(rel(src));
    return;
  }
  const txt = path.join(e.workDir, 'van-ban.txt');
  const r = run('pdftotext', ['-layout', src, txt]);
  if (!r.ok) e.notes.push('pdftotext lỗi: ' + r.stderr.slice(0, 200));
  let pages = 1;
  if (tools.pdfinfo) {
    const m = run('pdfinfo', [src]).stdout.match(/Pages:\s+(\d+)/);
    if (m) pages = parseInt(m[1], 10);
  }
  const text = fs.existsSync(txt) ? fs.readFileSync(txt, 'utf8') : '';
  const chars = text.replace(/\s/g, '').length;
  e.texts.push(rel(txt));
  e.scanned = chars / Math.max(1, pages) < 40;
  if (e.scanned) {
    e.notes.push(`PDF có vẻ là ảnh scan (${chars} ký tự / ${pages} trang) → đọc dạng ảnh.`);
    if (tools.pdftoppm) {
      run('pdftoppm', ['-r', '110', '-png', src, path.join(e.workDir, 'trang')]);
      e.images.push(
        ...fs
          .readdirSync(e.workDir)
          .filter((f) => /^trang-\d+\.png$/.test(f))
          .sort()
          .map((f) => rel(path.join(e.workDir, f))),
      );
    } else e.images.push(rel(src));
  }
}

async function processImage(src: string, e: Entry, tools: Tools) {
  const ext = path.extname(src).toLowerCase();
  if (ext === '.heic' || ext === '.heif') {
    const out = path.join(e.workDir, 'anh.jpg');
    try {
      await sharp(src).jpeg({ quality: 90 }).toFile(out);
      e.images.push(rel(out));
    } catch {
      if (tools.ffmpeg && run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-i', src, out]).ok) e.images.push(rel(out));
      else e.notes.push('Không đọc được ảnh HEIC. Hãy xuất ảnh sang JPG/PNG rồi bỏ lại vào inbox/.');
    }
    return;
  }
  e.images.push(rel(src));
}

function processDocx(src: string, e: Entry) {
  const files = unzipSync(new Uint8Array(fs.readFileSync(src)));
  const xml = files['word/document.xml'] ? strFromU8(files['word/document.xml']) : '';
  const text = xml
    .replace(/<w:tab\/>/g, '\t')
    .replace(/<\/w:p>/g, '\n')
    .replace(/<w:br[^>]*\/>/g, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
  const txt = path.join(e.workDir, 'van-ban.txt');
  fs.writeFileSync(txt, text);
  e.texts.push(rel(txt));
  const media = Object.keys(files).filter((k) => k.startsWith('word/media/') && /\.(png|jpe?g|gif|bmp|webp)$/i.test(k));
  if (media.length) {
    const md = path.join(e.workDir, 'anh');
    fs.mkdirSync(md, { recursive: true });
    for (const k of media) {
      const out = path.join(md, path.basename(k));
      fs.writeFileSync(out, files[k]);
      e.images.push(rel(out));
    }
  }
}

// ------------------------------------------------------------------ chạy

async function main() {
  fs.mkdirSync(WORK, { recursive: true });
  const tools: Tools = {
    ffmpeg: has('ffmpeg'),
    ffprobe: has('ffprobe'),
    pdftotext: has('pdftotext'),
    pdftoppm: has('pdftoppm'),
    pdfinfo: has('pdfinfo'),
    whisper: has('whisper') ? 'whisper' : has('whisper-cli') ? 'whisper-cli' : null,
  };
  const inputs = fs
    .readdirSync(INBOX, { withFileTypes: true })
    .filter((d) => d.isFile() && !d.name.startsWith('.') && d.name !== 'README.md')
    .map((d) => d.name)
    .sort();
  const manifestPath = path.join(WORK, 'manifest.json');
  if (!inputs.length) {
    console.log('Không có file mới trong inbox/. Hãy bỏ video / ảnh / PDF / DOCX bài giảng vào inbox/ rồi chạy lại.');
    fs.writeFileSync(manifestPath, JSON.stringify({ createdAt: new Date().toISOString(), tools, files: [] }, null, 2));
    return;
  }
  const entries: Entry[] = [];
  for (const name of inputs) {
    const src = path.join(INBOX, name);
    const kind: Entry['kind'] = VIDEO.test(name) ? 'video' : PDF.test(name) ? 'pdf' : IMAGE.test(name) ? 'image' : DOCX.test(name) ? 'docx' : 'other';
    const workDir = path.join(WORK, slug(name));
    const cached = path.join(workDir, 'entry.json');
    if (!FORCE && fs.existsSync(cached)) {
      const prev = JSON.parse(fs.readFileSync(cached, 'utf8')) as Entry;
      if (prev.file === rel(src)) {
        entries.push(prev);
        console.log(`• ${name}: đã xử lý trước đó (dùng --force để làm lại)`);
        continue;
      }
    }
    fs.rmSync(workDir, { recursive: true, force: true });
    fs.mkdirSync(workDir, { recursive: true });
    const e: Entry = { file: rel(src), kind, sizeMB: +(fs.statSync(src).size / 1048576).toFixed(1), workDir: rel(workDir), images: [], texts: [], lessonHints: [], notes: [] };
    console.log(`• ${name} (${kind}, ${e.sizeMB} MB) …`);
    try {
      if (kind === 'video') await processVideo(src, e, tools);
      else if (kind === 'pdf') processPdf(src, e, tools);
      else if (kind === 'image') await processImage(src, e, tools);
      else if (kind === 'docx') processDocx(src, e);
      else e.notes.push('Không hỗ trợ loại file này (chỉ nhận mp4, mov, png, jpg, pdf, docx…). Bỏ qua.');
    } catch (err) {
      e.notes.push('Lỗi khi xử lý: ' + (err as Error).message);
    }
    e.lessonHints.push(...lessonHints(name, 'tên file'));
    for (const t of e.texts) e.lessonHints.push(...lessonHints(fs.readFileSync(path.join(ROOT, t), 'utf8').slice(0, 4000), path.basename(t)));
    fs.writeFileSync(cached, JSON.stringify(e, null, 2));
    entries.push(e);
  }
  fs.writeFileSync(manifestPath, JSON.stringify({ createdAt: new Date().toISOString(), tools, files: entries }, null, 2));

  // tóm tắt cho Claude đọc
  console.log('\n=== Kết quả quét inbox/ ===');
  console.log(`Công cụ: ffmpeg ${tools.ffmpeg ? '✔' : '✖'} · pdftotext ${tools.pdftotext ? '✔' : '✖'} · pdftoppm ${tools.pdftoppm ? '✔' : '✖'} · whisper ${tools.whisper ?? '✖ (không có)'}`);
  const votes = new Map<number, number>();
  for (const e of entries) {
    console.log(`\n## ${e.file} — ${e.kind}${e.durationSec ? `, ${fmtTime(e.durationSec)}` : ''}`);
    if (e.kind === 'video') console.log(`   khung hình: cắt ${e.framesExtracted ?? 0} (mỗi ${e.intervalSec}s), giữ ${e.framesKept ?? 0} khung khác nhau → ${e.images.length} ảnh lưới; từng slide: ${e.slidesDir}`);
    if (e.images.length) console.log('   ẢNH CẦN ĐỌC:\n' + e.images.map((x) => '     - ' + x).join('\n'));
    if (e.texts.length) console.log('   CHỮ ĐÃ TRÍCH:\n' + e.texts.map((x) => '     - ' + x).join('\n'));
    for (const n of e.notes) console.log('   ⚠ ' + n);
    for (const h of e.lessonHints) votes.set(h.lesson, (votes.get(h.lesson) ?? 0) + 1);
    if (e.lessonHints.length) console.log('   gợi ý số bài: ' + e.lessonHints.map((h) => `Bài ${h.lesson} (${h.from})`).join('; '));
  }
  const ranked = [...votes.entries()].sort((a, b) => b[1] - a[1]);
  console.log('\nĐoán số bài: ' + (ranked.length ? ranked.map(([n, c]) => `Bài ${n} (${c} dấu hiệu)`).join(', ') : 'không tìm thấy — hãy đọc nội dung hoặc hỏi người dùng'));
  console.log(`Chi tiết: ${rel(manifestPath)}`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
