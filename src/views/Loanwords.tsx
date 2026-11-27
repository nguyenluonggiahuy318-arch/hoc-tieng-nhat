import { useMemo, useState } from 'preact/hooks';
import { TU_MUON } from '../lib/content';
import { Deck, shuffle } from '../lib/random';
import { speak } from '../lib/speech';
import { useHotkeys } from '../lib/hotkeys';
import { ChoiceKeysHint, Choices, Feedback, Rmj, Score } from '../components/ui';

type Word = (typeof TU_MUON.words)[number];

export function LoanwordsView({ active }: { active: boolean }) {
  const deck = useMemo(() => new Deck<Word>(TU_MUON.words), []);
  const make = () => {
    const w = deck.next();
    return { w, opts: shuffle([w, ...shuffle(TU_MUON.words.filter((x) => x !== w && x.vi !== w.vi)).slice(0, 3)]) };
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
    const ok = cur.opts[i] === cur.w;
    setTally((t) => ({ q: t.q + 1, c: t.c + (ok ? 1 : 0) }));
    speak(cur.w.jp);
  };
  useHotkeys(active, { digit: (n) => n <= 4 && pick(n - 1), enter: () => picked !== null && next() });
  const ok = picked === null ? null : cur.opts[picked] === cur.w;
  return (
    <div class="stage" data-testid="loanwords">
      <p class="hint" style={{ margin: '0 0 6px' }}>
        Đọc từ mượn viết bằng Katakana rồi chọn nghĩa đúng.
      </p>
      <div class="big word" data-testid="question">
        {cur.w.jp}
      </div>
      <div class="sub">
        {picked === null ? (
          ' '
        ) : (
          <>
            <b>
              <Rmj>{cur.w.romaji}</Rmj>
            </b>{' '}
            — {cur.w.vi}
          </>
        )}
      </div>
      <Choices kind="mean" picked={picked} onPick={pick} options={cur.opts.map((o) => ({ id: o.jp, label: o.vi, correct: o === cur.w }))} />
      <Feedback ok={ok}>
        {ok !== null && (
          <>
            {ok ? 'Đúng!' : 'Chưa đúng'}
            <button type="button" class="btn next" onClick={next}>
              Từ tiếp →
            </button>
          </>
        )}
      </Feedback>
      <Score s={tally} unit="từ" />
      <ChoiceKeysHint />
    </div>
  );
}
