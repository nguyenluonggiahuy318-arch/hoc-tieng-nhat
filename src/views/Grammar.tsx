import { useEffect, useMemo, useState } from 'preact/hooks';
import type { FillItem, Lesson, OrderItem, SelfIntro } from '../lib/schema';
import { Deck, shuffle } from '../lib/random';
import { joinWords, kanaToRomaji, speakable } from '../lib/romaji';
import { orderIsCorrect } from '../lib/practice';
import { speak } from '../lib/speech';
import { useHotkeys } from '../lib/hotkeys';
import { useLesson } from '../lib/useLesson';
import { persisted } from '../state';
import { ChoiceKeysHint, Choices, Feedback, Html, ModeBar, Rmj, Score } from '../components/ui';
import { LessonSwitch } from '../components/LessonSwitch';

type GMode = 'theory' | 'fill' | 'order' | 'intro';

export function GrammarView({ active }: { active: boolean }) {
  const L = useLesson();
  const [mode, setMode] = useState<GMode>('theory');
  const m: GMode = mode === 'intro' && !L?.selfIntro ? 'theory' : mode;
  return (
    <>
      <LessonSwitch />
      <ModeBar
        start
        value={m}
        onChange={setMode}
        testid="grammar-modes"
        options={[
          ['theory', 'Lý thuyết'],
          ['fill', 'Điền vào chỗ trống'],
          ['order', 'Sắp xếp câu'],
          ['intro', 'Tự giới thiệu', !L?.selfIntro],
        ]}
      />
      {!L ? (
        <p class="hint">Đang tải bài…</p>
      ) : m === 'theory' ? (
        <Theory L={L} />
      ) : m === 'fill' ? (
        L.fill.length ? <FillPractice key={L.lesson} L={L} active={active} /> : <p class="hint">Bài này chưa có câu điền chỗ trống.</p>
      ) : m === 'order' ? (
        L.order.length ? <OrderPractice key={L.lesson} L={L} active={active} /> : <p class="hint">Bài này chưa có câu sắp xếp.</p>
      ) : (
        <SelfIntroView cfg={L.selfIntro!} />
      )}
      {L?.notes?.grammarSource && <Html as="p" class="srcnote" html={L.notes.grammarSource} />}
    </>
  );
}

function Theory({ L }: { L: Lesson }) {
  if (!L.grammar.length) return <p class="hint">Bài này chưa có phần ngữ pháp.</p>;
  return (
    <div data-testid="grammar-theory">
      {L.grammar.map((g, i) => {
        const src = Array.isArray(g.source) ? g.source : [g.source];
        return (
          <div class="gcard" key={g.pattern}>
            <div class="gh">
              <span class="gnum">{i + 1}</span>
              <span class="gpat">{g.pattern}</span>
              <span class="gmean">{g.meaning}</span>
              {src.includes('minna') && (
                <span class="gsrc" title="Phần này lấy theo giáo trình Minna no Nihongo (tài liệu của lớp không có).">
                  📘 theo Minna
                </span>
              )}
            </div>
            <Html as="div" class="d" html={g.explain} />
            {g.examples.map((ex) => (
              <div class="gex" key={ex.jp}>
                <button type="button" class="sp" title="Nghe" aria-label="Nghe" onClick={() => speak(speakable(ex.jp))}>
                  🔊
                </button>
                <div>
                  <div class="jp">{ex.jp}</div>
                  <div class="ro">
                    <Rmj>{ex.romaji}</Rmj>
                  </div>
                  <div class="vi">{ex.vi}</div>
                </div>
              </div>
            ))}
            {g.note && (
              <div class="gnote">
                💡 <Html html={g.note} />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function FillPractice({ L, active }: { L: Lesson; active: boolean }) {
  const deck = useMemo(() => new Deck<FillItem>(L.fill), [L]);
  const make = () => {
    const it = deck.next();
    return { it, opts: shuffle(it.options.slice()) };
  };
  const [cur, setCur] = useState(make);
  const [picked, setPicked] = useState<number | null>(null);
  const [tally, setTally] = useState({ q: 0, c: 0 });
  const next = () => {
    setCur(make());
    setPicked(null);
  };
  const pick = (i: number) => {
    if (picked !== null || i >= cur.opts.length) return;
    setPicked(i);
    const ok = cur.opts[i] === cur.it.answer;
    setTally((t) => ({ q: t.q + 1, c: t.c + (ok ? 1 : 0) }));
    speak(speakable(cur.it.q.replace('＿＿', cur.it.answer)));
  };
  useHotkeys(active, { digit: (n) => n <= 4 && pick(n - 1), enter: () => picked !== null && next() });
  const [before, after] = cur.it.q.split('＿＿');
  const ok = picked === null ? null : cur.opts[picked] === cur.it.answer;
  return (
    <div class="stage" data-testid="fill">
      <div class="sub">{cur.it.vi}</div>
      <div class="fill" data-testid="fill-q">
        {before}
        <span class="blank">{picked === null ? '？' : cur.it.answer}</span>
        {after}
      </div>
      <Choices kind="jpw" picked={picked} onPick={pick} options={cur.opts.map((o) => ({ id: o, label: o, correct: o === cur.it.answer }))} />
      <Feedback ok={ok}>
        {ok !== null && (
          <>
            {ok ? 'Đúng! ' : 'Chưa đúng. '}
            <Html class="why" html={cur.it.why} />
            <button type="button" class="btn next" onClick={next}>
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

function OrderPractice({ L, active }: { L: Lesson; active: boolean }) {
  const deck = useMemo(() => new Deck<OrderItem>(L.order), [L]);
  const make = () => {
    const it = deck.next();
    const bank = it.words.map((_, i) => i);
    // xáo đến khi không còn đúng thứ tự sẵn (nếu có thể)
    const allSame = new Set(it.words).size === 1;
    for (let k = 0; k < 20; k++) {
      shuffle(bank);
      if (allSame || !orderIsCorrect(bank.map((i) => it.words[i]), it.words)) break;
    }
    return { it, bank };
  };
  const [cur, setCur] = useState(make);
  const [built, setBuilt] = useState<number[]>([]);
  const [result, setResult] = useState<boolean | null>(null);
  const [warn, setWarn] = useState(false);
  const [tally, setTally] = useState({ q: 0, c: 0 });
  const words = cur.it.words;
  const sentence = joinWords(words);
  const next = () => {
    setCur(make());
    setBuilt([]);
    setResult(null);
    setWarn(false);
  };
  const check = () => {
    if (result !== null) return next();
    if (built.length < words.length) return setWarn(true);
    const ok = orderIsCorrect(built.map((i) => words[i]), words);
    setResult(ok);
    setTally((t) => ({ q: t.q + 1, c: t.c + (ok ? 1 : 0) }));
    speak(speakable(sentence));
  };
  useHotkeys(active, { enter: () => (result !== null || built.length === words.length) && check() });
  return (
    <div class="stage" data-testid="order">
      <p class="hint">Bấm các từ theo đúng thứ tự để dịch câu:</p>
      <div class="sub">
        <b class="order-vi" data-testid="order-vi">
          {cur.it.vi}
        </b>
      </div>
      <div class={'slots' + (result === true ? ' right' : result === false ? ' wrong' : '')} data-testid="order-slots">
        {!built.length && <span class="hint">Câu của bạn sẽ hiện ở đây</span>}
        {built.map((wi, pos) => (
          <button
            type="button"
            class="wchip"
            key={pos + ':' + wi}
            onClick={() => {
              if (result !== null) return;
              setBuilt(built.filter((_, p) => p !== pos));
            }}
          >
            {words[wi]}
          </button>
        ))}
      </div>
      <div class="bank" data-testid="order-bank">
        {cur.bank.map((wi) => (
          <button
            type="button"
            key={wi}
            class={'wchip' + (built.includes(wi) ? ' used' : '')}
            aria-hidden={built.includes(wi)}
            tabIndex={built.includes(wi) ? -1 : 0}
            onClick={() => {
              if (result !== null || built.includes(wi)) return;
              setBuilt([...built, wi]);
              setWarn(false);
            }}
          >
            {words[wi]}
          </button>
        ))}
      </div>
      <div class="flash-actions">
        {result === null && (
          <button type="button" class="btn" onClick={() => setBuilt([])}>
            Xoá hết
          </button>
        )}
        <button type="button" class="btn primary" onClick={check} data-testid="order-check">
          {result !== null ? 'Câu tiếp →' : 'Kiểm tra'}
        </button>
      </div>
      <Feedback ok={result ?? (warn ? false : null)}>
        {result === true && (
          <>
            Đúng! <span class="kana-ans">{sentence}</span>
          </>
        )}
        {result === false && (
          <>
            Chưa đúng. Câu đúng: <span class="kana-ans">{sentence}</span>
          </>
        )}
        {result === null && warn && 'Bạn chưa dùng hết các từ.'}
      </Feedback>
      <Score s={tally} />
    </div>
  );
}

const introName = persisted<string>('introName', '', (v) => typeof v === 'string');

function SelfIntroView({ cfg }: { cfg: SelfIntro }) {
  const [c, setC] = useState(0);
  const [j, setJ] = useState(0);
  useEffect(() => {
    if (c >= cfg.countries.length) setC(0);
    if (j >= cfg.jobs.length) setJ(0);
  }, [cfg]);
  const name = introName.value.trim() || 'リン';
  const nameRomaji = /[぀-ヿ]/.test(name) ? kanaToRomaji(name, { capitalize: true }) : name;
  const C = cfg.countries[c] ?? cfg.countries[0];
  const J = cfg.jobs[j] ?? cfg.jobs[0];
  const lines: [string, string, string][] = [
    ['はじめまして。', 'Hajimemashite.', 'Rất vui được gặp mọi người.'],
    [`わたしは ${name} です。`, `Watashi wa ${nameRomaji} desu.`, `Tôi là ${name}.`],
    [`${C.jp}から きました。`, `${C.romaji} kara kimashita.`, `Tôi đến từ ${C.vi}.`],
    [`${J.jp}です。`, `${J.romaji} desu.`, `Tôi là ${J.vi}.`],
    ['どうぞ よろしく おねがいします。', 'Dōzo yoroshiku onegaishimasu.', 'Rất mong được mọi người giúp đỡ.'],
  ];
  return (
    <div class="stage left" data-testid="self-intro">
      <p class="hint">Mẫu tự giới thiệu (hội thoại Bài 1). Điền thông tin của bạn để tạo bài giới thiệu:</p>
      <div class="form">
        <label>
          Tên của bạn
          <input value={introName.value} placeholder="vd: リン hoặc Linh" onInput={(e) => (introName.value = (e.target as HTMLInputElement).value)} />
        </label>
        <label>
          Đến từ
          <select value={c} onChange={(e) => setC(+(e.target as HTMLSelectElement).value)}>
            {cfg.countries.map((x, i) => (
              <option value={i} key={x.jp}>
                {x.vi} — {x.jp}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nghề nghiệp
          <select value={j} onChange={(e) => setJ(+(e.target as HTMLSelectElement).value)}>
            {cfg.jobs.map((x, i) => (
              <option value={i} key={x.jp}>
                {x.vi} — {x.jp}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div class="intro">
        {lines.map(([jp, ro, vi]) => (
          <div class="gex" key={ro}>
            <button type="button" class="sp" aria-label="Nghe" onClick={() => speak(speakable(jp))}>
              🔊
            </button>
            <div>
              <div class="jp">{jp}</div>
              <div class="ro">
                <Rmj>{ro}</Rmj>
              </div>
              <div class="vi">{vi}</div>
            </div>
          </div>
        ))}
      </div>
      <button type="button" class="btn primary" onClick={() => speak(lines.map((l) => speakable(l[0])).join(''))}>
        🔊 Nghe cả bài
      </button>
      <p class="srcnote">Tên người Việt thường được viết bằng Katakana theo cách đọc, ví dụ Linh → リン, Nam → ナム.</p>
    </div>
  );
}
