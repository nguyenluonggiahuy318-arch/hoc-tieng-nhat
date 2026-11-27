import { useState } from 'preact/hooks';
import type { Counter } from '../lib/schema';
import { SO_DEM } from '../lib/content';
import {
  ALT_DIGITS,
  DIGITS,
  MAX_NUMBER,
  fillLabel,
  formatVi,
  isIrregularCounter,
  isIrregularNumber,
  numberParts,
  readCounter,
  readNumber,
  readNumberSpaced,
  trapReading,
} from '../lib/numbers';
import { kanaToRomaji } from '../lib/romaji';
import { pickOne, pickWeighted, rnd, shuffle } from '../lib/random';
import { speak } from '../lib/speech';
import { useHotkeys } from '../lib/hotkeys';
import { persisted } from '../state';
import { ChoiceKeysHint, Choices, Feedback, Html, ModeBar, Rmj, Rules, Score } from '../components/ui';

const COUNTERS = SO_DEM.counters;
const counterById = (id: string) => COUNTERS.find((c) => c.id === id);
const romaji = (kana: string) => kanaToRomaji(kana);

function NCell({ top, kana, extra, irr }: { top: string | number; kana: string; extra?: string; irr: boolean }) {
  return (
    <button type="button" class={'ncell' + (irr ? ' irr' : '')} onClick={() => speak(kana.replace(/ /g, ''))} data-irregular={irr ? '1' : undefined}>
      <div class="d">{top}</div>
      <div class={'h' + (kana.length > 6 ? ' long' : '')}>{kana}</div>
      <div class="ro">
        <Rmj>{romaji(kana)}</Rmj>
      </div>
      {extra && <div class="alt">{extra}</div>}
    </button>
  );
}

function Section({ title, note, children }: { title: string; note?: string; children: preact.ComponentChildren }) {
  return (
    <>
      <h2>
        {title} {note && <small>{note}</small>}
      </h2>
      <div class="ngrid">{children}</div>
    </>
  );
}

function TableTab() {
  const cells = (ns: number[], irrOk = true) => ns.map((n) => <NCell key={n} top={n >= 10000 ? formatVi(n) : n} kana={readNumber(n)} irr={irrOk && isIrregularNumber(n)} />);
  return (
    <div data-testid="numbers-table">
      <p class="hint">
        Bấm vào ô để nghe. Ô màu đỏ là cách đọc <b>biến âm</b> — hay ra trong bài kiểm tra.
      </p>
      <Section title="Từ 0 đến 10">
        {Array.from({ length: 11 }, (_, n) => (
          <NCell key={n} top={n} kana={n === 10 ? 'じゅう' : DIGITS[n]} extra={ALT_DIGITS[n] ? 'còn đọc: ' + ALT_DIGITS[n] : ''} irr={false} />
        ))}
      </Section>
      <Section title="Hàng chục" note="số + じゅう">
        {cells([10, 20, 30, 40, 50, 60, 70, 80, 90])}
      </Section>
      <Section title="Hàng trăm" note="số + ひゃく">
        {cells([100, 200, 300, 400, 500, 600, 700, 800, 900])}
      </Section>
      <Section title="Hàng nghìn" note="số + せん">
        {cells([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000, 9000])}
      </Section>
      <Section title="Hàng vạn" note="まん = 10.000">
        {cells([10000, 20000, 100000, 1000000], false)}
      </Section>
      <Rules rules={SO_DEM.tableRules} />
    </div>
  );
}

function CounterCells({ c }: { c: Counter }) {
  return (
    <>
      {c.table.map((n) => (
        <NCell key={n} top={fillLabel(c.label, n)} kana={readCounter(n, c, { spaced: c.spaced })} extra={c.alt?.[String(n)] ? 'còn đọc: ' + c.alt[String(n)] : ''} irr={isIrregularCounter(n, c)} />
      ))}
      {c.extra?.map((x) => <NCell key={x.label} top={x.label} kana={x.jp} irr={!!x.irregular} />)}
    </>
  );
}

function PageTab({ id }: { id: string }) {
  const page = SO_DEM.pages.find((p) => p.id === id);
  if (!page) return null;
  const cs = page.counters.map(counterById).filter((c): c is Counter => !!c);
  return (
    <div data-testid={'numbers-page-' + id}>
      {page.intro && <Html as="p" class="hint" html={page.intro} />}
      {cs.length === 1 ? (
        <div class="ngrid">
          <CounterCells c={cs[0]} />
        </div>
      ) : (
        cs.map((c) => (
          <Section key={c.id} title={c.name} note={c.note}>
            <CounterCells c={c} />
          </Section>
        ))
      )}
      <Rules rules={page.rules ?? []} />
    </div>
  );
}

const convVal = persisted<string>('conv', '368', (v) => typeof v === 'string');
const convAs = persisted<string>('convAs', '', (v) => typeof v === 'string');

function ConvTab() {
  const c = convAs.value ? counterById(convAs.value) : undefined;
  const v = convVal.value.replace(/\D/g, '');
  let content;
  if (!v) content = <div class="sub">Hãy nhập một số.</div>;
  else {
    const n = parseInt(v, 10);
    if (n > MAX_NUMBER) content = <div class="sub">Số lớn quá — tối đa 99.999.999.</div>;
    else if (c && (n < c.range[0] || n > c.range[1]))
      content = (
        <div class="sub">
          {c.name} nên từ {formatVi(c.range[0])} đến {formatVi(c.range[1])}.
        </div>
      );
    else {
      const kana = c ? readCounter(n, c, { spaced: true }) : readNumberSpaced(n);
      const parts = numberParts(n);
      content = (
        <>
          <div class="conv-k" data-testid="conv-result">
            {kana}
          </div>
          <div class="sub">
            <Rmj>{romaji(kana)}</Rmj>
          </div>
          <button type="button" class="btn primary" onClick={() => speak(kana.replace(/ /g, ''))}>
            🔊 Nghe
          </button>
          {!c && parts.length > 1 && (
            <>
              <p class="hint">Tách theo từng hàng:</p>
              <div class="breakdown">
                {parts.map(([val, r]) => (
                  <span class="bpart" key={val}>
                    <b>{formatVi(val)}</b>
                    {r}
                  </span>
                ))}
              </div>
            </>
          )}
        </>
      );
    }
  }
  return (
    <div class="stage" data-testid="numbers-conv">
      <p class="hint">Gõ một số bất kỳ (tối đa 99.999.999) để xem cách đọc:</p>
      <div class="typebox">
        <input inputMode="numeric" class="numinput" aria-label="Số cần đọc" value={convVal.value} onInput={(e) => (convVal.value = (e.target as HTMLInputElement).value)} />
      </div>
      <label class="agechk">
        Đọc như:{' '}
        <select value={convAs.value} onChange={(e) => (convAs.value = (e.target as HTMLSelectElement).value)} aria-label="Đọc như">
          <option value="">Số thường</option>
          {COUNTERS.map((x) => (
            <option key={x.id} value={x.id}>
              {x.name} (+ {x.suffix})
            </option>
          ))}
        </select>
      </label>
      <div>{content}</div>
    </div>
  );
}

type QMode = 'n2r' | 'r2n' | 'listen';
const BASE_RANGES: [string, string][] = [
  ['s', '0–10'],
  ['t', '11–99'],
  ['h', '100–999'],
  ['k', '1000–9999'],
];
const QUIZ_COUNTERS = COUNTERS.filter((c) => c.quiz);

interface NQ {
  n: number;
  c?: Counter;
}
function pickQ(range: string): NQ {
  let r = range;
  if (r === 'mix') {
    const opts: [string, number][] = [['s', 1], ['t', 1], ['h', 2], ['k', 1], ...QUIZ_COUNTERS.map((c) => [c.id, c.quiz!.mixWeight ?? 1] as [string, number])];
    r = pickWeighted(opts, (o) => o[1])[0];
  }
  const c = counterById(r);
  if (c?.quiz) {
    const pool = c.quiz.pool ?? [];
    const random = c.quiz.random ?? [];
    if (pool.length && (!random.length || Math.random() < 0.6)) return { n: pickOne(pool), c };
    const [a, b, step] = random.length ? pickOne(random) : [c.range[0], Math.min(c.range[1], 99), 1];
    return { n: rnd(a, b) * step, c };
  }
  if (r === 'h') return { n: Math.random() < 0.45 ? pickOne([300, 600, 800, 100]) + rnd(0, 99) : rnd(100, 999) };
  if (r === 'k') return { n: Math.random() < 0.4 ? pickOne([1000, 3000, 8000]) + rnd(0, 999) : rnd(1000, 9999) };
  if (r === 't') return { n: rnd(11, 99) };
  return { n: rnd(0, 10) };
}

interface Question {
  q: NQ;
  ans: string;
  opts: { id: string; txt: string; ok: boolean; kana?: boolean }[];
}

function makeQuestion(range: string, mode: QMode): Question {
  const q = pickQ(range);
  const read = (n: number) => (q.c ? readCounter(n, q.c) : readNumber(n));
  const label = (n: number) => (q.c ? fillLabel(q.c.label, n) : formatVi(n));
  const ans = read(q.n);
  const lo = q.c ? q.c.range[0] : 0;
  const hi = q.c ? q.c.range[1] : 99999;
  const nums = new Set([q.n]);
  const cand = [q.n + 1, q.n - 1, q.n + 10, q.n - 10, q.n + 100, q.n - 100, parseInt(String(q.n).split('').reverse().join(''), 10), q.n + rnd(2, 9)];
  if (q.c?.id === 'gia') cand.push(q.n + 1000, q.n - 1000, q.n + 500);
  for (const x of shuffle(cand)) if (nums.size < 4 && x >= lo && x <= hi && x !== q.n) nums.add(x);
  for (let k = 0; nums.size < 4 && k < 50; k++) nums.add(Math.min(hi, Math.max(lo, q.n + rnd(-30, 30))));
  for (let k = lo; nums.size < 4 && k <= hi; k++) nums.add(k);
  let opts: Question['opts'];
  if (mode === 'n2r') {
    const rs = new Set([ans]);
    const t = trapReading(q.n, q.c);
    if (t) rs.add(t);
    for (const n of nums) if (rs.size < 4) rs.add(read(n));
    opts = shuffle([...rs]).map((r) => ({ id: r, txt: r, ok: r === ans, kana: true }));
  } else {
    opts = shuffle([...nums]).map((n) => ({ id: String(n), txt: label(n), ok: n === q.n }));
  }
  return { q, ans, opts };
}

const qModeSig = persisted<QMode>('numMode', 'n2r', (v) => v === 'n2r' || v === 'r2n' || v === 'listen');
const qRangeSig = persisted<string>('numRange', 'mix', (v) => typeof v === 'string' && (v === 'mix' || BASE_RANGES.some((r) => r[0] === v) || QUIZ_COUNTERS.some((c) => c.id === v)));

function QuizTab({ active }: { active: boolean }) {
  const mode = qModeSig.value;
  const range = qRangeSig.value;
  const [cur, setCur] = useState<Question>(() => makeQuestion(range, mode));
  const [picked, setPicked] = useState<number | null>(null);
  const [tally, setTally] = useState({ q: 0, c: 0 });
  /** Gọi trong sự kiện bấm: ở chế độ nghe sẽ đọc luôn số mới (iOS chỉ cho phát âm trong sự kiện bấm). */
  const next = (r = range, m = mode) => {
    const q = makeQuestion(r, m);
    setCur(q);
    setPicked(null);
    if (m === 'listen') speak(q.ans);
  };
  const pick = (i: number) => {
    if (picked !== null || i >= cur.opts.length) return;
    setPicked(i);
    const ok = cur.opts[i].ok;
    setTally((t) => ({ q: t.q + 1, c: t.c + (ok ? 1 : 0) }));
    speak(cur.ans);
  };
  useHotkeys(active, { digit: (n) => n <= 4 && pick(n - 1), enter: () => picked !== null && next() });
  const label = (n: number) => (cur.q.c ? fillLabel(cur.q.c.label, n) : formatVi(n));
  const ok = picked === null ? null : cur.opts[picked].ok;
  return (
    <div class="stage" data-testid="numbers-quiz">
      <ModeBar
        value={mode}
        onChange={(m) => {
          qModeSig.value = m;
          next(range, m);
        }}
        options={[
          ['n2r', 'Số → cách đọc'],
          ['r2n', 'Cách đọc → số'],
          ['listen', 'Nghe → số'],
        ]}
      />
      <ModeBar
        value={range}
        testid="number-ranges"
        onChange={(r) => {
          qRangeSig.value = r;
          next(r, mode);
        }}
        options={[...BASE_RANGES, ...QUIZ_COUNTERS.map((c) => [c.id, c.quiz!.label] as [string, string]), ['mix', 'Trộn']]}
      />
      {mode === 'n2r' ? (
        <>
          <div class="big rom" data-testid="question">
            {label(cur.q.n)}
          </div>
          <div class="sub">{cur.q.c?.id === 'tuoi' ? 'Tuổi này đọc thế nào?' : 'Số này đọc thế nào?'}</div>
        </>
      ) : mode === 'r2n' ? (
        <>
          <div class="big word" data-testid="question">
            {cur.ans}
          </div>
          <div class="sub">Đây là số nào?</div>
        </>
      ) : (
        <>
          <div class="big">👂</div>
          <button type="button" class="btn primary listenbtn" onClick={() => speak(cur.ans)}>
            🔊 Nghe
          </button>
          <div class="sub">Bấm 🔊 để nghe rồi chọn số đúng</div>
        </>
      )}
      <Choices kind={mode === 'n2r' ? 'jpw' : undefined} picked={picked} onPick={pick} options={cur.opts.map((o) => ({ id: o.id, label: o.txt, correct: o.ok }))} />
      <Feedback ok={ok}>
        {ok !== null && (
          <>
            {ok ? 'Đúng! ' : 'Chưa đúng. '}
            <span class="kana-ans">
              {label(cur.q.n)} = {cur.ans}
            </span>{' '}
            <Rmj class="muted">({romaji(cur.ans)})</Rmj>
            <button type="button" class="btn next" onClick={() => next()}>
              Câu tiếp →
            </button>
          </>
        )}
      </Feedback>
      <Score s={tally} />
      <ChoiceKeysHint />
    </div>
  );
}

export function NumbersView({ active }: { active: boolean }) {
  const [tab, setTab] = useState<string>('table');
  const tabs: [string, string][] = [['table', 'Bảng số'], ...SO_DEM.pages.map((p) => ['page:' + p.id, p.title] as [string, string]), ['conv', 'Đổi số'], ['quiz', 'Luyện tập']];
  return (
    <>
      <ModeBar start value={tab} onChange={setTab} options={tabs} testid="numbers-tabs" />
      {tab === 'table' ? <TableTab /> : tab === 'conv' ? <ConvTab /> : tab === 'quiz' ? <QuizTab active={active} /> : <PageTab id={tab.slice(5)} />}
    </>
  );
}
