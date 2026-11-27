import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { display, hasHiragana, hasKatakana } from '../lib/kana';
import { kanaToRomaji, normalizeAnswer, romaToKana, typingHint } from '../lib/romaji';
import { gradeTyping, typingSentences, typingWords, type TypingItem } from '../lib/practice';
import { Deck } from '../lib/random';
import { speak } from '../lib/speech';
import { useHotkeys } from '../lib/hotkeys';
import { useLesson } from '../lib/useLesson';
import { kanaPool, lessonNo, persisted, script } from '../state';
import { Feedback, Mistakes, ModeBar, Rmj, Score, Seg, finePointer } from '../components/ui';
import { KanaKeyboard } from '../components/KanaKeyboard';
import { LessonSwitch } from '../components/LessonSwitch';
import { RowPicker } from '../components/RowPicker';

type TMode = 'letter' | 'word' | 'sent' | 'free';
type Method = 'ime' | 'kb' | 'roma';
type Prompt = 'roma' | 'vi';

const methodSig = persisted<Method>('typeMethod', 'ime', (v) => v === 'ime' || v === 'kb' || v === 'roma');
const promptSig = persisted<Prompt>('typePrompt', 'roma', (v) => v === 'roma' || v === 'vi');
const kbKataSig = persisted<boolean>('kbKata', false, (v) => typeof v === 'boolean');

const IME_GUIDE = (
  <div class="hint">
    Gõ bằng bàn phím tiếng Nhật của chính máy bạn, app chỉ chấm kết quả.
    <br />• <b>iPhone</b>: Cài đặt → Cài đặt chung → Bàn phím → Bàn phím → Thêm bàn phím mới → Tiếng Nhật → <i>Romaji</i> hoặc <i>Kana</i>. Bấm 🌐 để đổi.
    <br />• <b>Android (Gboard)</b>: Cài đặt Gboard → Ngôn ngữ → Thêm bàn phím → 日本語 → chọn <i>QWERTY (romaji)</i> hoặc <i>12 phím (kana)</i>. Giữ phím 🌐 để đổi.
    <br />• <b>Windows</b>: Cài đặt → Thời gian &amp; ngôn ngữ → Thêm 日本語. Đổi bàn phím: <code>Win</code>+<code>Space</code>, bật/tắt kana: <code>Alt</code>+<code>`</code>.
    <br />• <b>Mac</b>: Cài đặt hệ thống → Bàn phím → Nguồn nhập → thêm Japanese – Romaji.
    <br />
    Gõ xong một từ, nếu máy gợi ý Kanji thì chọn lại dạng <b>kana</b> (hoặc bấm F6 = Hiragana, F7 = Katakana trên máy tính). Trợ từ は gõ <code>ha</code>.
  </div>
);

export function TypingView({ active }: { active: boolean }) {
  const sc = script.value;
  const L = useLesson();
  const [mode, setMode] = useState<TMode>('word');
  const [forceKata, setForceKata] = useState(false);
  const method: Method = mode === 'letter' && methodSig.value === 'roma' ? 'ime' : methodSig.value;
  const useKb = method === 'kb';
  const useConv = method === 'roma';
  const prompt = promptSig.value;

  const pool = useMemo<TypingItem[]>(() => {
    if (mode === 'letter') {
      const name = sc === 'hira' ? 'Hiragana' : 'Katakana';
      return kanaPool.value.map((it) => ({ q: it.r, vi: `Gõ chữ ${name} có cách đọc này`, a: display(it, sc) }));
    }
    if (!L || mode === 'free') return [];
    return mode === 'word' ? typingWords(L) : typingSentences(L);
  }, [mode, sc, L, kanaPool.value]);
  const poolKey = mode + sc + lessonNo.value + pool.map((p) => p.a).join('|');
  const deck = useMemo(() => new Deck(pool), [poolKey]);

  const [cur, setCur] = useState<TypingItem | null>(null);
  const [done, setDone] = useState(false);
  const [verdict, setVerdict] = useState<{ ok: boolean; msg: string } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [tally, setTally] = useState({ q: 0, c: 0 });
  const [miss, setMiss] = useState<string[]>([]);
  const [freeVal, setFreeVal] = useState('');
  const [copied, setCopied] = useState<string | null>(null);
  const inp = useRef<HTMLInputElement>(null);
  const composing = useRef(false);

  /** fromTap = true khi gọi trong sự kiện bấm/phím: focus ngay để bàn phím điện thoại không bị đóng. */
  const next = (fromTap = true) => {
    setCur(deck.size ? deck.next() : null);
    setDone(false);
    setVerdict(null);
    setHint(null);
    if (inp.current) inp.current.value = '';
    if (useKb) return;
    if (fromTap) inp.current?.focus();
    else if (finePointer()) setTimeout(() => active && inp.current?.focus(), 30);
  };
  useEffect(() => next(false), [deck]);

  const conv = () => {
    const el = inp.current;
    if (!useConv || composing.current || !el) return;
    const v = romaToKana(el.value, false, forceKata);
    if (v !== el.value) {
      el.value = v;
      try {
        el.setSelectionRange(v.length, v.length);
      } catch {
        /* một số trình duyệt không hỗ trợ */
      }
    }
  };
  const fin = (v: string) => (useConv ? romaToKana(v, true, forceKata) : v);

  const check = () => {
    if (done) return next(true);
    const el = inp.current;
    if (!el || !cur) return;
    el.value = fin(el.value);
    if (!normalizeAnswer(el.value)) return;
    const g = gradeTyping(el.value, cur.a);
    let msg = '';
    if (!g.ok) {
      if (g.reason === 'kanji') msg = 'Câu trả lời có <b>Kanji</b> — hãy gõ bằng kana (khi máy gợi ý Kanji, chọn lại dạng ひらがな/カタカナ).';
      else if (g.reason === 'script')
        msg = 'Đúng âm nhưng sai bảng chữ — ' + (useConv ? 'phần Katakana phải gõ <b>CHỮ HOA</b> (hoặc bật ア).' : 'kiểm tra chỗ nào phải viết Hiragana, chỗ nào Katakana.');
      else if (g.reason === 'particle') msg = 'Gần đúng! Trợ từ <b>は</b> phải gõ <code>ha</code> (đọc là wa), <b>を</b> gõ <code>wo</code>, <b>へ</b> gõ <code>he</code>.';
    }
    setDone(true);
    setVerdict({ ok: g.ok, msg });
    setTally((t) => ({ q: t.q + 1, c: t.c + (g.ok ? 1 : 0) }));
    if (!g.ok) setMiss((m) => (m.includes(cur.a) ? m : [...m, cur.a]));
    speak(normalizeAnswer(cur.a));
  };

  const showHint = () => {
    if (!cur) return;
    const a = normalizeAnswer(cur.a);
    if (mode === 'letter') return setHint(`Bắt đầu bằng hàng chữ của <b>${cur.q}</b>`);
    if (useConv) return setHint(`Gõ: <code>${typingHint(a)}</code>` + (hasKatakana(a) ? ' · phần CHỮ HOA là Katakana' : ''));
    const k = hasKatakana(a), h = hasHiragana(a);
    setHint(
      `Bắt đầu bằng: <span class="kana-ans">${[...a].slice(0, mode === 'sent' ? 3 : 1).join('')}…</span> · viết bằng ${k && h ? 'Hiragana + Katakana' : k ? 'Katakana' : 'Hiragana'} · ${[...a].length} chữ`,
    );
  };

  useHotkeys(active, { enter: () => done && next(true) });

  // Preact không gắn được onCompositionStart/End (trình duyệt không có thuộc tính oncompositionstart),
  // nên gắn trực tiếp. Chạy lại mỗi lần vẽ để dùng hàm conv() mới nhất.
  useEffect(() => {
    const el = inp.current;
    if (!el) return;
    const start = () => (composing.current = true);
    const end = () => {
      composing.current = false;
      conv();
      if (mode === 'free') setFreeVal(el.value);
    };
    el.addEventListener('compositionstart', start);
    el.addEventListener('compositionend', end);
    return () => {
      el.removeEventListener('compositionstart', start);
      el.removeEventListener('compositionend', end);
    };
  });

  const onKeyDown = (e: KeyboardEvent) => {
    if (e.key === 'Enter' && !e.isComposing && e.keyCode !== 229 && !composing.current) {
      e.preventDefault();
      e.stopPropagation();
      if (mode !== 'free') check();
    }
  };
  const inputProps = {
    ref: inp,
    lang: 'ja',
    autocomplete: 'off',
    autocapitalize: 'off' as const,
    autocorrect: 'off',
    spellcheck: false,
    readOnly: useKb || done,
    inputMode: useKb ? ('none' as const) : undefined,
    onInput: () => {
      conv();
      if (mode === 'free') setFreeVal(inp.current?.value ?? '');
    },
    onKeyDown,
  };

  const kb = useKb && (
    <KanaKeyboard
      target={inp}
      onChange={() => setFreeVal(inp.current?.value ?? '')}
      onEnter={mode === 'free' ? undefined : check}
      disabled={done && mode !== 'free'}
      kata={mode === 'letter' ? sc === 'kata' : kbKataSig.value}
      onToggleKata={mode === 'letter' ? undefined : () => (kbKataSig.value = !kbKataSig.value)}
      showLong={mode !== 'letter'}
    />
  );

  const freeFinal = fin(freeVal);
  return (
    <>
      <ModeBar
        start
        value={mode}
        onChange={(m) => setMode(m)}
        options={[
          ['letter', 'Chữ cái'],
          ['word', 'Từ vựng'],
          ['sent', 'Câu'],
          ['free', 'Gõ tự do'],
        ]}
        testid="typing-modes"
      />
      {mode === 'letter' && <RowPicker />}
      {(mode === 'word' || mode === 'sent') && <LessonSwitch />}
      <div class="modebar start">
        <Seg
          class="segwrap"
          label="Cách nhập"
          value={method}
          onChange={(m) => (methodSig.value = m)}
          options={[
            { value: 'ime', label: '🇯🇵 Bàn phím của máy' },
            { value: 'kb', label: 'あ Bàn phím kana' },
            { value: 'roma', label: '⌨️ Romaji tự đổi', hidden: mode === 'letter' },
          ]}
        />
        {useConv && (
          <Seg
            label="Bảng chữ khi đổi"
            value={forceKata}
            onChange={setForceKata}
            options={[
              { value: false, label: <span class="jp">あ</span> },
              { value: true, label: <span class="jp">ア</span> },
            ]}
          />
        )}
      </div>
      {(mode === 'word' || mode === 'sent') && (
        <div class="modebar start">
          <Seg
            label="Kiểu đề"
            value={prompt}
            onChange={(p) => (promptSig.value = p)}
            options={[
              { value: 'roma', label: 'Đề: Romaji' },
              { value: 'vi', label: 'Đề: Nghĩa tiếng Việt' },
            ]}
          />
        </div>
      )}
      {method === 'ime' && (
        <details class="picker tguide">
          <summary>
            <span>Cách bật bàn phím tiếng Nhật trên máy</span>
            <span class="count">▾</span>
          </summary>
          {IME_GUIDE}
        </details>
      )}
      {useConv && (
        <p class="hint tguide">
          Gõ romaji, app tự đổi sang chữ Nhật. <b>chữ thường → Hiragana</b>, <b>CHỮ HOA → Katakana</b> (vd: <code>BETONAMU</code> → ベトナム). <code>nn</code> → ん · <code>-</code> → ー · phụ âm đôi{' '}
          <code>kk, tt, pp</code> → っ · <code>xya</code> → ゃ nhỏ · trợ từ は gõ <code>ha</code>.
        </p>
      )}

      {mode === 'free' ? (
        <div class="stage left" data-testid="typing-free">
          <p class="hint">Gõ thoải mái để tập. Bấm 🔊 để nghe máy đọc, hoặc Sao chép để dán sang nơi khác.</p>
          <input class="tinput free" placeholder={useKb ? 'Bấm phím bên dưới' : useConv ? 'vd: watashi ha BETONAMUjin desu' : 'Gõ tiếng Nhật ở đây'} {...inputProps} readOnly={useKb} aria-label="Gõ tự do" />
          <div class="flash-actions">
            <button type="button" class="btn" onClick={() => speak(fin(inp.current?.value ?? ''))}>
              🔊 Nghe
            </button>
            <button
              type="button"
              class="btn"
              onClick={async () => {
                const v = fin(inp.current?.value ?? '');
                if (inp.current) inp.current.value = v;
                try {
                  await navigator.clipboard.writeText(v);
                  setCopied('Đã chép ✓');
                } catch {
                  inp.current?.select();
                  setCopied('Hãy tự chép');
                }
                setTimeout(() => setCopied(null), 1500);
              }}
            >
              {copied ?? 'Sao chép'}
            </button>
            <button
              type="button"
              class="btn"
              onClick={() => {
                if (inp.current) inp.current.value = '';
                setFreeVal('');
                if (!useKb) inp.current?.focus();
              }}
            >
              Xoá
            </button>
          </div>
          <div class="sub">{freeFinal && /[぀-ヿ]/.test(freeFinal) && <Rmj>Romaji: {kanaToRomaji(freeFinal)}</Rmj>}</div>
          {kb}
        </div>
      ) : (
        <div class="stage" data-testid="typing-stage">
          {!cur ? (
            <div class="sub">{mode !== 'letter' && !L ? 'Đang tải bài…' : 'Chưa có nội dung cho phần này.'}</div>
          ) : (
            <>
              {mode === 'letter' || prompt === 'roma' ? (
                <>
                  <p class="hint">{mode === 'letter' ? 'Gõ chữ tiếng Nhật tương ứng:' : 'Gõ bằng chữ Nhật (kana) cho romaji này:'}</p>
                  <div class={mode === 'letter' ? 'big rom' : 'tq troma'} data-testid="typing-q">
                    {cur.q}
                  </div>
                  <div class="sub">{cur.vi}</div>
                </>
              ) : (
                <>
                  <div class="tq" data-testid="typing-q">
                    {cur.vi}
                  </div>
                  <div class="sub">{cur.sec ?? ''}</div>
                </>
              )}
              <div class="typebox">
                <input
                  class={'tinput' + (verdict ? (verdict.ok ? ' right' : ' wrong') : '')}
                  placeholder={useKb ? 'Bấm phím bên dưới' : useConv ? (mode === 'word' ? 'vd: hon, NO-TO' : 'vd: kore ha hon desu') : 'Gõ tiếng Nhật…'}
                  aria-label="Câu trả lời"
                  data-testid="typing-input"
                  {...inputProps}
                />
                <button type="button" class="btn primary" onClick={check} data-testid="typing-check">
                  {done ? 'Tiếp →' : 'Kiểm tra'}
                </button>
              </div>
              {mode !== 'letter' && (
                <div class="flash-actions tools">
                  <button type="button" class="btn" onClick={showHint} data-testid="typing-hint">
                    💡 Gợi ý
                  </button>
                  <button type="button" class="btn" onClick={() => speak(normalizeAnswer(cur.a))}>
                    🔊 Nghe đáp án
                  </button>
                </div>
              )}
              <Feedback ok={verdict ? verdict.ok : null}>
                {verdict ? (
                  <>
                    {verdict.ok ? 'Đúng! ' : 'Chưa đúng. '}
                    {verdict.msg && <span dangerouslySetInnerHTML={{ __html: verdict.msg + ' ' }} />}
                    {verdict.ok ? '' : 'Đáp án: '}
                    <span class="kana-ans">{cur.a}</span>
                  </>
                ) : (
                  hint && <span class="hinttext" data-testid="hint-text" dangerouslySetInnerHTML={{ __html: hint }} />
                )}
              </Feedback>
              {kb}
              <Score s={tally} />
              <Mistakes items={miss} label="Gõ sai trong buổi này" />
            </>
          )}
        </div>
      )}
    </>
  );
}
