import { useEffect, useRef, useState } from 'preact/hooks';
import { ALL, display, groupOk, lookalikes, type KanaItem, type Script } from '../lib/kana';
import { pickWeighted, shuffle } from '../lib/random';
import { speak } from '../lib/speech';
import { useHotkeys } from '../lib/hotkeys';
import { kanaPool, kanaWeight, recordKana, script } from '../state';
import { ChoiceKeysHint, Choices, Feedback, Mistakes, ModeBar, Score, finePointer } from '../components/ui';
import { RowPicker } from '../components/RowPicker';

type Mode = 'k2r' | 'r2k' | 'type';

/** Đáp án nhiễu: ưu tiên chữ trông giống nhau, rồi chữ đang học, rồi cùng nhóm. */
function distractors(it: KanaItem, pool: KanaItem[], n: number, sc: Script): KanaItem[] {
  const out: KanaItem[] = [];
  const used = new Set([it.r]);
  const add = (x: KanaItem | undefined) => {
    if (x && groupOk(x.group, sc) && !used.has(x.r) && out.length < n) {
      used.add(x.r);
      out.push(x);
    }
  };
  shuffle(lookalikes(it, sc)).slice(0, 2).forEach(add);
  shuffle(pool.slice()).forEach(add);
  shuffle(ALL.filter((x) => x.group === it.group)).forEach(add);
  shuffle(ALL.slice()).forEach(add);
  return out;
}

interface Q {
  it: KanaItem;
  opts: KanaItem[];
}

export function QuizView({ active }: { active: boolean }) {
  const sc = script.value;
  const pool = kanaPool.value;
  const poolKey = sc + pool.map((i) => i.k).join('');
  const [mode, setMode] = useState<Mode>('k2r');
  const [q, setQ] = useState<Q | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [typed, setTyped] = useState('');
  const [typedOk, setTypedOk] = useState<boolean | null>(null);
  const [sess, setSess] = useState({ q: 0, c: 0, s: 0, miss: [] as string[] });
  const last = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const input = useRef<HTMLInputElement>(null);

  const newQuestion = (m: Mode = mode, fromTap = false) => {
    if (timer.current) clearTimeout(timer.current);
    const p = kanaPool.value;
    const cand = p.length > 1 ? p.filter((x) => x.k !== last.current) : p;
    const it = pickWeighted(cand, kanaWeight);
    last.current = it.k;
    setQ({ it, opts: m === 'type' ? [] : shuffle([it, ...distractors(it, p, 3, script.value)]) });
    setPicked(null);
    setTyped('');
    setTypedOk(null);
    if (m === 'type') {
      if (fromTap) input.current?.focus();
      else if (finePointer()) setTimeout(() => active && input.current?.focus(), 30);
    }
  };

  useEffect(() => {
    newQuestion();
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [poolKey]);
  useEffect(() => setSess({ q: 0, c: 0, s: 0, miss: [] }), [sc]);
  useEffect(() => {
    if (active && mode === 'type' && typedOk === null && finePointer()) input.current?.focus();
  }, [active]);

  const answered = picked !== null || typedOk !== null;
  const finish = (ok: boolean) => {
    if (!q) return;
    const ch = display(q.it, sc);
    recordKana(ch, ok);
    setSess((s) => ({ q: s.q + 1, c: s.c + (ok ? 1 : 0), s: ok ? s.s + 1 : 0, miss: ok || s.miss.includes(ch) ? s.miss : [...s.miss, ch] }));
    speak(ch);
    if (ok) timer.current = setTimeout(() => newQuestion(), mode === 'type' ? 700 : 850);
  };
  const pick = (i: number) => {
    if (!q || answered || i >= q.opts.length) return;
    setPicked(i);
    finish(q.opts[i].k === q.it.k);
  };
  const checkTyped = () => {
    if (!q) return;
    if (typedOk !== null) return newQuestion(mode, true);
    const v = typed.trim().toLowerCase();
    if (!v) return;
    const ok = q.it.a.includes(v);
    setTypedOk(ok);
    finish(ok);
  };
  const changeMode = (m: Mode) => {
    setMode(m);
    newQuestion(m, true);
  };

  useHotkeys(active, {
    digit: (n) => mode !== 'type' && n <= 4 && pick(n - 1),
    enter: () => answered && newQuestion(mode, true),
  });

  const ch = q ? display(q.it, sc) : '';
  const scName = sc === 'hira' ? 'Hiragana' : 'Katakana';
  return (
    <>
      <RowPicker />
      <div class="stage" data-testid="kana-quiz">
        <ModeBar
          value={mode}
          onChange={changeMode}
          options={[
            ['k2r', 'Chữ → romaji'],
            ['r2k', 'Romaji → chữ'],
            ['type', 'Gõ romaji'],
          ]}
        />
        {q && (
          <div>
            <div class={'big' + (mode === 'r2k' ? ' rom' : '')} data-testid="question">
              {mode === 'r2k' ? q.it.r : ch}
            </div>
            <div class="sub">{mode === 'r2k' ? `Chọn chữ ${scName} đúng` : mode === 'type' ? 'Gõ cách đọc bằng chữ Latin' : 'Chữ này đọc là gì?'}</div>
            {mode === 'type' ? (
              <div class="typebox">
                <input
                  ref={input}
                  class={typedOk === true ? 'right' : typedOk === false ? 'wrong' : ''}
                  value={typed}
                  readOnly={typedOk !== null}
                  autocomplete="off"
                  autocapitalize="off"
                  spellcheck={false}
                  placeholder="vd: ka"
                  aria-label="Cách đọc"
                  onInput={(e) => setTyped((e.target as HTMLInputElement).value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      e.stopPropagation();
                      checkTyped();
                    }
                  }}
                />
                <button type="button" class="btn primary" onClick={checkTyped}>
                  {typedOk !== null ? 'Tiếp →' : 'Kiểm tra'}
                </button>
              </div>
            ) : (
              <Choices
                kind={mode === 'r2k' ? 'kana' : undefined}
                picked={picked}
                onPick={pick}
                options={q.opts.map((o) => ({ id: o.k, label: mode === 'r2k' ? display(o, sc) : o.r, correct: o.k === q.it.k }))}
              />
            )}
            <Feedback ok={answered ? (picked !== null ? q.opts[picked].k === q.it.k : typedOk) : null}>
              {answered &&
                (picked !== null ? q.opts[picked].k === q.it.k : typedOk) && (
                  <>
                    Đúng! {ch} = {q.it.r}
                  </>
                )}
              {answered && !(picked !== null ? q.opts[picked].k === q.it.k : typedOk) && (
                <>
                  Chưa đúng — {ch} đọc là <b>{q.it.r}</b>
                  {mode !== 'type' && (
                    <button type="button" class="btn next" onClick={() => newQuestion()}>
                      Tiếp →
                    </button>
                  )}
                </>
              )}
            </Feedback>
          </div>
        )}
        <Score s={sess} streak={sess.s} />
        <Mistakes items={sess.miss} label="Chữ sai trong buổi này" />
        <ChoiceKeysHint />
      </div>
    </>
  );
}
