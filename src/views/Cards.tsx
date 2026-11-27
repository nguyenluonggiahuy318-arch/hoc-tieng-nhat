import { useMemo, useState } from 'preact/hooks';
import { display, toHira, type KanaItem } from '../lib/kana';
import { shuffle } from '../lib/random';
import { speak } from '../lib/speech';
import { useHotkeys } from '../lib/hotkeys';
import { kanaPool, recordKana, script } from '../state';
import { Done, Flash, KbdHint } from '../components/ui';
import { RowPicker } from '../components/RowPicker';

/** Thẻ nhớ chữ cái: thẻ "Chưa nhớ" quay lại sau 3 thẻ. */
export function CardsView({ active }: { active: boolean }) {
  const pool = kanaPool.value;
  const sc = script.value;
  const poolKey = sc + pool.map((i) => i.k).join('');
  const baseDeck = useMemo(() => shuffle(pool.slice()), [poolKey]);
  const [deckState, setDeckState] = useState<{ key: string; deck: KanaItem[]; total: number } | null>(null);
  const ds = deckState && deckState.key === poolKey ? deckState : { key: poolKey, deck: baseDeck, total: baseDeck.length };
  const deck = ds.deck;
  const total = ds.total;
  const [flippedFor, setFlippedFor] = useState<string | null>(null);
  const reset = () => setDeckState({ key: poolKey, deck: shuffle(kanaPool.value.slice()), total: kanaPool.value.length });

  const it = deck[0];
  const ch = it ? display(it, sc) : '';
  const cardId = it ? it.k + '#' + deck.length + '#' + poolKey : '';
  const flipped = !!it && flippedFor === cardId;
  const flip = () => {
    if (!it) return;
    setFlippedFor(flipped ? null : cardId);
    if (!flipped) speak(ch);
  };
  const answer = (ok: boolean) => {
    if (!it) return;
    recordKana(ch, ok);
    const rest = deck.slice(1);
    if (!ok) rest.splice(Math.min(3, rest.length), 0, it);
    setDeckState({ ...ds, deck: rest });
  };
  useHotkeys(active, {
    space: flip,
    digit: (n) => (n === 1 ? answer(false) : n === 2 ? answer(true) : undefined),
  });

  return (
    <>
      <RowPicker />
      <div class="stage" data-testid="kana-cards">
        {!it ? (
          <Done total={total} what="thẻ" onAgain={reset} />
        ) : (
          <>
            <p class="hint">Còn {deck.length} thẻ · bấm vào thẻ để lật</p>
            <Flash
              flipped={flipped}
              onFlip={flip}
              front={
                <>
                  <div class="k">{ch}</div>
                  <div class="s">Đọc là gì?</div>
                </>
              }
              back={
                <>
                  <div class="r">{it.r}</div>
                  <div class="kk">
                    {ch} · {sc === 'hira' ? it.k : toHira(it.k)}
                  </div>
                  <div class="s">{it.a.length > 1 ? 'cũng gõ: ' + it.a.slice(1).join(', ') : ' '}</div>
                </>
              }
            />
            <div class="flash-actions">
              <button type="button" class="btn no" onClick={() => answer(false)}>
                Chưa nhớ
              </button>
              <button type="button" class="btn yes" onClick={() => answer(true)}>
                Nhớ rồi
              </button>
            </div>
            <button type="button" class="speakbtn" onClick={() => speak(ch)}>
              🔊 Nghe
            </button>
            <KbdHint>
              <kbd>Space</kbd> lật thẻ · <kbd>1</kbd> chưa nhớ · <kbd>2</kbd> nhớ rồi
            </KbdHint>
          </>
        )}
      </div>
    </>
  );
}
