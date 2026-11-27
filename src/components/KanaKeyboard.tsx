import type { RefObject } from 'preact';
import { toKata } from '../lib/kana';
import { KB_COLS, cycleMark, type Mark } from '../lib/kbd';
import { speak } from '../lib/speech';

/** Bàn phím kana trên màn hình, có ゛ ゜ 小 ー ⌫. Ghi thẳng vào ô nhập `target`. */
export function KanaKeyboard(props: {
  target: RefObject<HTMLInputElement>;
  onChange: () => void;
  onEnter?: () => void;
  disabled: boolean;
  kata: boolean;
  onToggleKata?: () => void;
  showLong: boolean;
}) {
  const get = () => props.target.current?.value ?? '';
  const put = (v: string) => {
    if (!props.target.current) return;
    props.target.current.value = v;
    props.onChange();
  };
  const mark = (m: Mark) => {
    const v = get();
    if (v) put(v.slice(0, -1) + cycleMark(v.slice(-1), m));
  };
  const fn = (label: string, f: () => void, cls = '', aria?: string) => (
    <button type="button" class={'kbk fn' + (cls ? ' ' + cls : '')} aria-label={aria ?? label} onClick={() => (cls === 'enter' || !props.disabled) && f()}>
      {label}
    </button>
  );
  return (
    <div class={'kanakb' + (props.disabled ? ' off' : '')} data-testid="kana-keyboard">
      <div class="kbgrid">
        {KB_COLS.map((col) => (
          <div class="kbcol" key={col}>
            {[...col].map((c, i) => {
              if (c === ' ') return <span class="kbk blank" key={i} />;
              const x = props.kata ? toKata(c) : c;
              return (
                <button
                  type="button"
                  class="kbk"
                  key={i}
                  onClick={() => {
                    if (props.disabled) return;
                    put(get() + x);
                    speak(x);
                  }}
                >
                  {x}
                </button>
              );
            })}
          </div>
        ))}
      </div>
      <div class="kbfn">
        {props.onToggleKata && fn(props.kata ? 'ア→あ' : 'あ→ア', props.onToggleKata, '', 'Đổi Hiragana / Katakana')}
        {fn('゛', () => mark('daku'), '', 'Thêm dấu ゛')}
        {fn('゜', () => mark('handa'), '', 'Thêm dấu ゜')}
        {fn('小', () => mark('small'), '', 'Đổi chữ nhỏ')}
        {props.showLong && fn('ー', () => put(get() + 'ー'), '', 'Trường âm')}
        {fn('⌫', () => put([...get()].slice(0, -1).join('')), '', 'Xoá')}
        {props.onEnter && fn('↵', props.onEnter, 'enter', 'Kiểm tra')}
      </div>
      <p class="hint">゛ thêm dấu (か→が) · ゜ hàng は→ぱ · 小 đổi chữ nhỏ (や→ゃ, つ→っ). Bấm lại để bỏ.</p>
    </div>
  );
}
