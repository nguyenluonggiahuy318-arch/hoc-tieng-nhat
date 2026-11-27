// Kiểm tra ý nghĩa nội dung (ngoài schema): đáp án nằm trong lựa chọn, câu sắp xếp giải được,
// romaji khớp kana, gợi ý gõ được chấm đúng, không trùng lặp… Dùng chung cho validate và test.
import type { Confusables, Lesson, Loanwords, SoDem } from './schema';
import { hasKanji, hasLatin } from './kana';
import { joinWords, normalizeAnswer, romajiMatches, romaToKana, typingHint } from './romaji';
import { readCounter } from './numbers';
import { sentenceAnswer, typingWords } from './practice';

export interface Issue {
  level: 'error' | 'warning';
  where: string;
  msg: string;
}

const ALLOWED_TAGS = new Set(['b', 'i', 'u', 'em', 'strong', 'br', 'small', 'span', 'code', 'a', 'table', 'thead', 'tbody', 'tr', 'th', 'td', 'sup', 'sub', 'ruby', 'rt', 'ul', 'ol', 'li', 'p']);
const ALLOWED_ATTRS = new Set(['class', 'href', 'colspan', 'rowspan']);

/** HTML trong nội dung chỉ được dùng vài thẻ đơn giản (không script, không sự kiện). */
export function htmlProblems(html: string): string[] {
  const out: string[] = [];
  const tagRe = /<\/?([a-zA-Z0-9]+)([^>]*)>/g;
  let m: RegExpExecArray | null;
  while ((m = tagRe.exec(html))) {
    const tag = m[1].toLowerCase();
    if (!ALLOWED_TAGS.has(tag)) out.push(`thẻ <${tag}> không được phép`);
    const attrRe = /([a-zA-Z_:-]+)\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/g;
    let a: RegExpExecArray | null;
    while ((a = attrRe.exec(m[2]))) {
      const name = a[1].toLowerCase();
      const val = a[2].replace(/^["']|["']$/g, '');
      if (!ALLOWED_ATTRS.has(name)) out.push(`thuộc tính ${name}= không được phép`);
      if (name === 'href' && !/^(#[a-z0-9-]+|https:\/\/)/.test(val)) out.push(`liên kết "${val}" không hợp lệ`);
    }
  }
  if (/javascript:/i.test(html)) out.push('không được dùng javascript:');
  const opens = (html.match(/<(table|tr|td|th|b|i|u|span|code|a|small)\b/gi) || []).length;
  const closes = (html.match(/<\/(table|tr|td|th|b|i|u|span|code|a|small)>/gi) || []).length;
  if (opens !== closes) out.push('thẻ HTML mở/đóng không khớp');
  return out;
}

const romajiCheckable = (jp: string) => !hasLatin(jp) && !hasKanji(jp);

/** Gõ gợi ý romaji vào bộ đổi romaji → kana có ra đúng đáp án không. */
export function hintRoundTrips(answer: string): boolean {
  const a = normalizeAnswer(answer);
  return normalizeAnswer(romaToKana(typingHint(a), true)) === a;
}

export function checkLesson(L: Lesson, fileName?: string): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: 'error', where, msg });
  const warn = (where: string, msg: string) => issues.push({ level: 'warning', where, msg });

  if (fileName && fileName !== `bai-${L.lesson}.json`) err('lesson', `số bài ${L.lesson} không khớp tên file ${fileName}`);

  // Từ vựng
  const seen = new Map<string, string>();
  L.vocab.forEach((g, gi) => {
    g.items.forEach((w) => {
      const where = `vocab[${gi}] "${g.group}" › ${w.jp}`;
      const key = normalizeAnswer(w.jp);
      if (seen.has(key)) err(where, `từ bị trùng (đã có ở ${seen.get(key)})`);
      else seen.set(key, `nhóm "${g.group}"`);
      if (romajiCheckable(w.jp) && !romajiMatches(w.jp, w.romaji)) err(where, `romaji "${w.romaji}" không khớp với kana (gợi ý: kiểm tra lại chính tả)`);
      if (/[A-Z]/.test(w.romaji.slice(1)) && !/[- ]/.test(w.romaji)) warn(where, `romaji "${w.romaji}" có chữ hoa giữa từ`);
    });
  });
  const groupNames = L.vocab.map((g) => g.group);
  groupNames.forEach((n, i) => {
    if (groupNames.indexOf(n) !== i) err(`vocab[${i}]`, `tên nhóm "${n}" bị trùng — hãy gộp vào nhóm cũ`);
  });

  // Ngữ pháp
  const patterns = new Set<string>();
  L.grammar.forEach((g, gi) => {
    const where = `grammar[${gi}] ${g.pattern}`;
    if (patterns.has(g.pattern)) err(where, 'mẫu ngữ pháp bị trùng');
    patterns.add(g.pattern);
    for (const p of htmlProblems(g.explain)) err(where + ' › explain', p);
    if (g.note) for (const p of htmlProblems(g.note)) err(where + ' › note', p);
    g.examples.forEach((ex, ei) => {
      if (romajiCheckable(ex.jp) && !romajiMatches(ex.jp, ex.romaji)) err(`${where} › ví dụ ${ei + 1}`, `romaji "${ex.romaji}" không khớp với "${ex.jp}"`);
    });
  });

  // Điền chỗ trống
  const fillQs = new Set<string>();
  L.fill.forEach((f, i) => {
    const where = `fill[${i}] ${f.q}`;
    const blanks = f.q.split('＿＿').length - 1;
    if (blanks !== 1) err(where, `câu phải có đúng 1 chỗ trống "＿＿" (đang có ${blanks})`);
    if (!f.options.includes(f.answer)) err(where, `đáp án "${f.answer}" không có trong danh sách lựa chọn`);
    if (new Set(f.options).size !== f.options.length) err(where, 'các lựa chọn bị trùng nhau');
    if (fillQs.has(f.q)) err(where, 'câu bị trùng');
    fillQs.add(f.q);
    for (const p of htmlProblems(f.why)) err(where + ' › why', p);
  });

  // Sắp xếp câu
  const orders = new Set<string>();
  L.order.forEach((o, i) => {
    const where = `order[${i}] ${o.vi}`;
    const key = o.words.join('|');
    if (orders.has(key)) warn(where, 'câu sắp xếp bị trùng với một câu khác');
    orders.add(key);
    if (o.words.some((w) => w.includes('＿＿'))) err(where, 'từ không được chứa "＿＿"');
    if (new Set(o.words).size === 1) err(where, 'mọi từ giống nhau — không thể sắp xếp');
    if (!/[。？！?!]$/.test(joinWords(o.words))) err(where, 'không ghép được thành câu');
  });

  // Gõ chữ: mọi từ / câu dùng để luyện gõ phải gõ được theo gợi ý romaji
  for (const w of typingWords(L)) {
    if (!hintRoundTrips(w.a)) err(`gõ chữ › ${w.a}`, `gõ theo gợi ý "${typingHint(normalizeAnswer(w.a))}" không ra đúng chữ`);
  }
  for (const o of L.order) {
    const a = sentenceAnswer(o);
    if (a && !hintRoundTrips(a)) err(`gõ câu › ${a}`, `gõ theo gợi ý "${typingHint(normalizeAnswer(a))}" không ra đúng câu`);
  }

  if (L.selfIntro) {
    for (const c of [...L.selfIntro.countries, ...L.selfIntro.jobs]) {
      if (romajiCheckable(c.jp) && !romajiMatches(c.jp, c.romaji)) err(`selfIntro › ${c.jp}`, `romaji "${c.romaji}" không khớp`);
    }
  }
  for (const k of ['vocab', 'vocabSource', 'grammarSource'] as const) {
    const h = L.notes?.[k];
    if (h) for (const p of htmlProblems(h)) err(`notes.${k}`, p);
  }
  if (L.vocab.length === 0) warn('vocab', 'bài chưa có từ vựng');
  if (L.grammar.length === 0) warn('grammar', 'bài chưa có ngữ pháp');
  return issues;
}

/** Từ trùng giữa các bài (chỉ cảnh báo: ôn lại từ cũ là bình thường). */
export function crossLessonDuplicates(lessons: Lesson[]): Issue[] {
  const where = new Map<string, number>();
  const out: Issue[] = [];
  for (const L of lessons) {
    for (const g of L.vocab) for (const w of g.items) {
      const k = normalizeAnswer(w.jp);
      const prev = where.get(k);
      if (prev !== undefined && prev !== L.lesson) out.push({ level: 'warning', where: `bai-${L.lesson} › ${w.jp}`, msg: `từ đã có ở Bài ${prev}` });
      else where.set(k, L.lesson);
    }
  }
  return out;
}

export function checkSoDem(d: SoDem): Issue[] {
  const issues: Issue[] = [];
  const err = (where: string, msg: string) => issues.push({ level: 'error', where, msg });
  const ids = new Set<string>();
  for (const c of d.counters) {
    const where = `counters › ${c.id}`;
    if (ids.has(c.id)) err(where, 'id bị trùng');
    ids.add(c.id);
    const [lo, hi] = c.range;
    if (lo > hi) err(where, 'range không hợp lệ');
    for (const n of c.table) if (n < lo || n > hi) err(where, `số ${n} trong table nằm ngoài range`);
    for (const n of c.quiz?.pool ?? []) if (n < lo || n > hi) err(where, `số ${n} trong quiz.pool nằm ngoài range`);
    for (const [a, b, step] of c.quiz?.random ?? []) if (a > b || a * step < lo || b * step > hi) err(where, `quiz.random [${a}, ${b}, ${step}] nằm ngoài range`);
    try {
      for (const n of c.table) readCounter(n, c);
    } catch (e) {
      err(where, 'không đọc được số: ' + (e as Error).message);
    }
  }
  const pageIds = new Set<string>();
  for (const p of d.pages) {
    if (pageIds.has(p.id)) err(`pages › ${p.id}`, 'id trang bị trùng');
    pageIds.add(p.id);
    for (const id of p.counters) if (!ids.has(id)) err(`pages › ${p.id}`, `không có đơn vị đếm "${id}"`);
    for (const r of p.rules ?? []) for (const pr of htmlProblems(r.html)) err(`pages › ${p.id} › ${r.sym}`, pr);
  }
  for (const r of d.tableRules) for (const pr of htmlProblems(r.html)) err(`tableRules › ${r.sym}`, pr);
  return issues;
}

export function checkLoanwords(d: Loanwords): Issue[] {
  const out: Issue[] = [];
  const seen = new Set<string>();
  for (const w of d.words) {
    if (seen.has(w.jp)) out.push({ level: 'error', where: `tu-muon › ${w.jp}`, msg: 'từ bị trùng' });
    seen.add(w.jp);
    if (!/^[ァ-ヺー]+$/.test(w.jp)) out.push({ level: 'error', where: `tu-muon › ${w.jp}`, msg: 'từ mượn phải viết bằng Katakana' });
    else if (!romajiMatches(w.jp, w.romaji)) out.push({ level: 'error', where: `tu-muon › ${w.jp}`, msg: `romaji "${w.romaji}" không khớp` });
  }
  return out;
}

export function checkConfusables(d: Confusables): Issue[] {
  const out: Issue[] = [];
  for (const s of ['hira', 'kata'] as const) {
    for (const t of d[s].tips) for (const p of htmlProblems(t.html)) out.push({ level: 'error', where: `de-nham › ${s} › ${t.chars.join('')}`, msg: p });
    for (const r of d[s].rules) for (const p of htmlProblems(r.html)) out.push({ level: 'error', where: `de-nham › ${s} › ${r.sym}`, msg: p });
  }
  return out;
}
