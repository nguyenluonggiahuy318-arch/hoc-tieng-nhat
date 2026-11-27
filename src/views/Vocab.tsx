import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { flatVocab, type FlatWord } from '../lib/practice';
import { shuffle } from '../lib/random';
import { speak } from '../lib/speech';
import { useHotkeys } from '../lib/hotkeys';
import { useLesson } from '../lib/useLesson';
import { isWeakWord, lessonNo, recordVocab } from '../state';
import { ChoiceKeysHint, Choices, Done, Feedback, Flash, Html, KbdHint, Mistakes, ModeBar, Rmj, Score } from '../components/ui';
import { LessonSwitch } from '../components/LessonSwitch';

type VMode = 'list' | 'cards' | 'j2v' | 'v2j';
interface Filter {
  secs: string[];
  n: number;
  batch: number; // -1 = ngẫu nhiên
  /** Danh sách từ hay sai chụp lại lúc bật bộ lọc (để bộ từ không đổi giữa chừng). */
  weak: string[] | null;
}
const DEFAULT_FILTER: Filter = { secs: [], n: 10, batch: 0, weak: null };

export function VocabView({ active }: { active: boolean }) {
  const L = useLesson();
  const [mode, setMode] = useState<VMode>('list');
  const [f, setF] = useState<Filter>(DEFAULT_FILTER);
  const [open, setOpen] = useState(true);
  const [seed, setSeed] = useState(0);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => setF(DEFAULT_FILTER), [lessonNo.value]);

  const words = useMemo(() => (L ? flatVocab(L) : []), [L]);
  const groups = L ? L.vocab.map((g) => [g.group, g.items.length] as const) : [];
  const base = words.filter((w) => (!f.secs.length || f.secs.includes(w.group)) && (!f.weak || f.weak.includes(w.key)));
  const pool = useMemo(() => {
    if (!f.n || f.n >= base.length) return base.slice();
    if (f.batch < 0) return shuffle(base.slice()).slice(0, f.n);
    const nb = Math.ceil(base.length / f.n);
    const b = f.batch >= nb ? 0 : f.batch;
    return base.slice(b * f.n, b * f.n + f.n);
  }, [base.map((w) => w.key).join('|'), f.n, f.batch, seed]);
  const poolKey = pool.map((w) => w.key).join('|') + mode;

  useEffect(() => {
    if (!pool.length && f.weak) setF((x) => ({ ...x, weak: null, batch: 0 }));
  }, [pool.length, f.weak]);

  // ---------------- thẻ nhớ (bộ thẻ gắn với poolKey: đổi bộ lọc là có bộ thẻ mới ngay)
  const baseDeck = useMemo(() => shuffle(pool.slice()), [poolKey]);
  const [deckState, setDeckState] = useState<{ key: string; deck: FlatWord[]; total: number } | null>(null);
  const ds = deckState && deckState.key === poolKey ? deckState : { key: poolKey, deck: baseDeck, total: baseDeck.length };
  const deck = ds.deck;
  const deckTotal = ds.total;
  const [flippedFor, setFlippedFor] = useState<string | null>(null);
  const card = deck[0];
  const cardId = card ? card.key + '#' + deck.length + '#' + poolKey : '';
  const flipped = !!card && flippedFor === cardId;
  const resetDeck = () => setDeckState({ key: poolKey, deck: shuffle(pool.slice()), total: pool.length });

  // ---------------- trắc nghiệm
  const makeQ = (): { w: FlatWord; opts: FlatWord[] } | null => {
    if (!pool.length) return null;
    let w = pool[Math.floor(Math.random() * pool.length)];
    for (let i = 0; i < 6 && pool.length > 1 && last.current && w.key === last.current.key; i++) w = pool[Math.floor(Math.random() * pool.length)];
    last.current = w;
    // đáp án nhiễu cùng nhóm khó hơn nên ưu tiên
    const same = shuffle(words.filter((x) => x.key !== w.key && x.group === w.group && x.vi !== w.vi && x.jp !== w.jp));
    const rest = shuffle(words.filter((x) => x.key !== w.key && x.group !== w.group && x.vi !== w.vi && x.jp !== w.jp));
    const opts: FlatWord[] = [w];
    for (const x of [...same.slice(0, 2), ...rest, ...same.slice(2)]) {
      if (opts.length >= 4) break;
      if (!opts.some((o) => o.vi === x.vi || o.jp === x.jp)) opts.push(x);
    }
    return { w, opts: shuffle(opts) };
  };
  const last = useRef<FlatWord | null>(null);
  const firstQ = useMemo(() => (mode === 'j2v' || mode === 'v2j' ? makeQ() : null), [poolKey]);
  const [qState, setQState] = useState<{ key: string; cur: { w: FlatWord; opts: FlatWord[] } | null; picked: number | null } | null>(null);
  const qs = qState && qState.key === poolKey ? qState : { key: poolKey, cur: firstQ, picked: null };
  const cur = qs.cur;
  const picked = qs.picked;
  const [tally, setTally] = useState({ q: 0, c: 0 });
  const [miss, setMiss] = useState<string[]>([]);
  const nextQ = () => setQState({ key: poolKey, cur: makeQ(), picked: null });

  useEffect(() => {
    setTally({ q: 0, c: 0 });
    setMiss([]);
    last.current = null;
  }, [lessonNo.value]);

  const flip = () => {
    if (!card) return;
    setFlippedFor(flipped ? null : cardId);
    if (!flipped) speak(card.jp);
  };
  const answerCard = (ok: boolean) => {
    if (!card) return;
    recordVocab(card.key, ok);
    const rest = deck.slice(1);
    if (!ok) rest.splice(Math.min(3, rest.length), 0, card);
    setDeckState({ ...ds, deck: rest });
  };
  const pick = (i: number) => {
    if (!cur || picked !== null || i >= cur.opts.length) return;
    setQState({ ...qs, picked: i });
    const ok = cur.opts[i].key === cur.w.key;
    recordVocab(cur.w.key, ok);
    speak(cur.w.jp);
    setTally((t) => ({ q: t.q + 1, c: t.c + (ok ? 1 : 0) }));
    if (!ok) setMiss((m) => (m.includes(cur.w.jp) ? m : [...m, cur.w.jp]));
  };

  useHotkeys(active, {
    space: () => mode === 'cards' && flip(),
    digit: (n) => {
      if (mode === 'cards') {
        if (n === 1) answerCard(false);
        if (n === 2) answerCard(true);
      } else if (mode !== 'list' && n <= 4) pick(n - 1);
    },
    enter: () => mode !== 'list' && mode !== 'cards' && picked !== null && nextQ(),
  });

  if (!L)
    return (
      <>
        <LessonSwitch />
        <p class="hint">Đang tải bài…</p>
      </>
    );

  const set = (patch: Partial<Filter>) => setF((x) => ({ ...x, ...patch }));
  const filterPanel = (
    <details class="picker" open={open} onToggle={(e) => setOpen((e.currentTarget as HTMLDetailsElement).open)} data-testid="vocab-filter">
      <summary>
        <span>Chọn từ để học</span>
        <span class="count">{pool.length} từ ▾</span>
      </summary>
      <div class="chips-group">
        <div class="gl">Nhóm từ</div>
        <div class="chips">
          <button type="button" class={'chip vchip' + (f.secs.length ? '' : ' on')} onClick={() => set({ secs: [], batch: 0 })}>
            Tất cả
          </button>
          {groups.map(([g, n]) => (
            <button
              type="button"
              key={g}
              class={'chip vchip' + (f.secs.includes(g) ? ' on' : '')}
              onClick={() => {
                const secs = f.secs.includes(g) ? f.secs.filter((x) => x !== g) : [...f.secs, g];
                set({ secs: secs.length === groups.length ? [] : secs, batch: 0 });
              }}
            >
              {g} <small>{n}</small>
            </button>
          ))}
        </div>
      </div>
      <div class="chips-group">
        <div class="gl">Số từ mỗi lượt</div>
        <div class="chips">
          {(
            [
              [5, '5 từ'],
              [10, '10 từ'],
              [20, '20 từ'],
              [0, 'Tất cả'],
            ] as const
          ).map(([n, t]) => (
            <button type="button" key={n} class={'chip vchip' + (f.n === n ? ' on' : '')} onClick={() => set({ n, batch: 0 })}>
              {t}
            </button>
          ))}
        </div>
      </div>
      {f.n > 0 && base.length > f.n && (
        <div class="chips-group">
          <div class="gl">Học cụm nào</div>
          <div class="chips">
            {Array.from({ length: Math.ceil(base.length / f.n) }, (_, i) => (
              <button type="button" key={i} class={'chip vchip' + (f.batch === i ? ' on' : '')} onClick={() => set({ batch: i })}>
                Từ {i * f.n + 1}–{Math.min(base.length, (i + 1) * f.n)}
              </button>
            ))}
            <button
              type="button"
              class={'chip vchip' + (f.batch < 0 ? ' on' : '')}
              onClick={() => {
                set({ batch: -1 });
                setSeed((s) => s + 1);
              }}
            >
              🎲 Ngẫu nhiên
            </button>
          </div>
        </div>
      )}
      <div class="quick">
        <button
          type="button"
          class={'btn' + (f.weak ? ' on' : '')}
          onClick={() => {
            if (!f.weak && !words.some((w) => isWeakWord(w.key))) {
              setMsg('Chưa có từ hay sai');
              setTimeout(() => setMsg(null), 1500);
              return;
            }
            set({ weak: f.weak ? null : words.filter((w) => isWeakWord(w.key)).map((w) => w.key), batch: 0 });
          }}
        >
          {msg ?? (f.weak ? '✓ Chỉ từ hay sai' : 'Chỉ từ hay sai')}
        </button>
        {f.batch < 0 && (
          <button type="button" class="btn" onClick={() => setSeed((s) => s + 1)}>
            Đổi bộ từ khác
          </button>
        )}
      </div>
      <p class="hint">
        Đang học:{' '}
        {pool.map((w, i) => (
          <span key={w.key}>
            {i ? ' · ' : ''}
            <span class="vprev">{w.jp}</span>
          </span>
        ))}
      </p>
    </details>
  );

  let body;
  if (mode === 'list') {
    let n = 0;
    body = (
      <>
        <table class="vocab" data-testid="vocab-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Từ</th>
              <th class="rm">Romaji · phiên âm</th>
              <th>Nghĩa</th>
            </tr>
          </thead>
          <tbody>
            {L.vocab.map((g) => [
              <tr class="sec" key={'g' + g.group}>
                <td colSpan={4}>{g.group}</td>
              </tr>,
              ...g.items.map((w) => {
                n++;
                return (
                  <tr key={g.group + w.jp}>
                    <td class="n">{n}</td>
                    <td class="w">
                      <button type="button" onClick={() => speak(w.jp)}>
                        {w.jp}
                      </button>
                      <Rmj class="rm-inline">
                        {w.romaji}
                        {w.phienam && <small> · {w.phienam}</small>}
                      </Rmj>
                    </td>
                    <td class="rm">
                      <Rmj>
                        {w.romaji}
                        {w.phienam && <small>{w.phienam}</small>}
                      </Rmj>
                    </td>
                    <td>{w.vi}</td>
                  </tr>
                );
              }),
            ])}
          </tbody>
        </table>
        <p class="srcnote">
          Bấm vào từ để nghe. {L.notes?.vocab && <Html html={L.notes.vocab} />}
        </p>
      </>
    );
  } else if (mode === 'cards') {
    body = (
      <div class="stage" data-testid="vocab-cards">
        {!card ? (
          <Done total={deckTotal} what={`từ đã chọn của Bài ${L.lesson}`} onAgain={resetDeck} />
        ) : (
          <>
            <p class="hint">Còn {deck.length} từ · bấm vào thẻ để lật</p>
            <Flash
              flipped={flipped}
              onFlip={flip}
              front={
                <>
                  <div class="w">{card.jp}</div>
                  <div class="s">Nghĩa là gì?</div>
                </>
              }
              back={
                <>
                  <div class="m">{card.vi}</div>
                  <div class="rr">
                    <Rmj>
                      {card.romaji}
                      {card.phienam ? ' · ' + card.phienam : ''}
                    </Rmj>
                  </div>
                  <div class="kk">{card.jp}</div>
                </>
              }
            />
            <div class="flash-actions">
              <button type="button" class="btn no" onClick={() => answerCard(false)}>
                Chưa nhớ
              </button>
              <button type="button" class="btn yes" onClick={() => answerCard(true)}>
                Nhớ rồi
              </button>
            </div>
            <button type="button" class="speakbtn" onClick={() => speak(card.jp)}>
              🔊 Nghe
            </button>
            <KbdHint>
              <kbd>Space</kbd> lật thẻ · <kbd>1</kbd> chưa nhớ · <kbd>2</kbd> nhớ rồi
            </KbdHint>
          </>
        )}
      </div>
    );
  } else {
    const j2v = mode === 'j2v';
    const ok = cur && picked !== null ? cur.opts[picked].key === cur.w.key : null;
    body = (
      <div class="stage" data-testid="vocab-quiz">
        {cur ? (
          <>
            <div class={j2v ? 'big word' : 'big rom mean-q'} data-testid="question">
              {j2v ? cur.w.jp : cur.w.vi}
            </div>
            <div class="sub">
              {picked === null ? (
                j2v ? (
                  'Chọn nghĩa đúng'
                ) : (
                  'Chọn từ tiếng Nhật đúng'
                )
              ) : (
                <>
                  <b>{cur.w.jp}</b> · <Rmj>{cur.w.romaji}</Rmj> — {cur.w.vi}
                </>
              )}
            </div>
            <Choices
              kind={j2v ? 'mean' : 'jpw'}
              picked={picked}
              onPick={pick}
              options={cur.opts.map((o) => ({ id: o.key, label: j2v ? o.vi : o.jp, correct: o.key === cur.w.key }))}
            />
            <Feedback ok={ok}>
              {ok !== null && (
                <>
                  {ok ? 'Đúng!' : 'Chưa đúng'}
                  <button type="button" class="btn next" onClick={nextQ}>
                    Câu tiếp →
                  </button>
                </>
              )}
            </Feedback>
          </>
        ) : (
          <div class="sub">Không có từ nào phù hợp bộ lọc.</div>
        )}
        <Score s={tally} />
        <Mistakes items={miss} label="Từ sai trong buổi này" />
        <ChoiceKeysHint />
      </div>
    );
  }

  return (
    <>
      <LessonSwitch />
      <ModeBar
        start
        value={mode}
        onChange={setMode}
        testid="vocab-modes"
        options={[
          ['list', 'Danh sách'],
          ['cards', 'Thẻ nhớ'],
          ['j2v', 'Nhật → Việt'],
          ['v2j', 'Việt → Nhật'],
        ]}
      />
      {mode !== 'list' && filterPanel}
      {body}
      {L.notes?.vocabSource && <Html as="p" class="srcnote" html={L.notes.vocabSource} />}
    </>
  );
}
