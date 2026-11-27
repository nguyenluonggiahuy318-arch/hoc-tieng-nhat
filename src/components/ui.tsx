import type { ComponentChildren, JSX } from 'preact';
import { useState } from 'preact/hooks';
import { hideRomaji } from '../state';
import { speak } from '../lib/speech';

/** Máy có chuột (máy tính): mới tự focus ô nhập khi chưa có thao tác bấm. */
export const finePointer = () => typeof matchMedia !== 'undefined' && matchMedia('(pointer: fine)').matches;

/** Romaji / phiên âm: bị làm mờ khi bật "Ẩn romaji", chạm vào để xem riêng chỗ đó. */
export function Rmj({ children, class: cls }: { children: ComponentChildren; class?: string }) {
  const [peek, setPeek] = useState(false);
  return (
    <span
      class={'rmj' + (peek ? ' peek' : '') + (cls ? ' ' + cls : '')}
      onClick={(e) => {
        if (!hideRomaji.value) return;
        e.stopPropagation();
        setPeek((p) => !p);
      }}
    >
      {children}
    </span>
  );
}

/** HTML ngắn trong nội dung (đã được npm run validate kiểm tra chỉ dùng thẻ an toàn). */
export function Html({ html, as = 'span', class: cls }: { html: string; as?: 'span' | 'div' | 'p'; class?: string }) {
  const Tag = as as unknown as (p: JSX.HTMLAttributes) => JSX.Element;
  return <Tag class={cls} dangerouslySetInnerHTML={{ __html: html }} />;
}

export interface SegOption<T extends string | number | boolean> {
  value: T;
  label: ComponentChildren;
  hidden?: boolean;
}

/** Nút chuyển kiểu "segmented". */
export function Seg<T extends string | number | boolean>(props: {
  value: T;
  options: SegOption<T>[];
  onChange: (v: T) => void;
  class?: string;
  label?: string;
}) {
  return (
    <div class={'seg' + (props.class ? ' ' + props.class : '')} role="group" aria-label={props.label}>
      {props.options
        .filter((o) => !o.hidden)
        .map((o) => (
          <button type="button" key={String(o.value)} class={o.value === props.value ? 'on' : ''} aria-pressed={o.value === props.value} onClick={() => props.onChange(o.value)}>
            {o.label}
          </button>
        ))}
    </div>
  );
}

/** Hàng nút chọn chế độ. */
export function ModeBar<T extends string>(props: {
  value: T;
  options: [T, string, boolean?][];
  onChange: (v: T) => void;
  start?: boolean;
  testid?: string;
}) {
  return (
    <div class={'modebar' + (props.start ? ' start' : '')} data-testid={props.testid}>
      {props.options
        .filter(([, , hidden]) => !hidden)
        .map(([v, t]) => (
          <button type="button" key={v} class={'btn' + (v === props.value ? ' on' : '')} aria-pressed={v === props.value} onClick={() => props.onChange(v)}>
            {t}
          </button>
        ))}
    </div>
  );
}

export interface Tally {
  q: number;
  c: number;
}
export function Score({ s, unit = 'câu', streak }: { s: Tally; unit?: string; streak?: number }) {
  return (
    <div class="score">
      <div>
        <b data-testid="score-q">{s.q}</b>
        {unit}
      </div>
      <div>
        <b data-testid="score-pct">{s.q ? Math.round((s.c / s.q) * 100) : 0}%</b>đúng
      </div>
      {streak !== undefined && (
        <div>
          <b>{streak}</b>chuỗi đúng
        </div>
      )}
    </div>
  );
}

export function Mistakes({ items, label }: { items: string[]; label: string }) {
  if (!items.length) return <div class="mistakes" />;
  return (
    <div class="mistakes">
      {label}:{' '}
      {items.map((k) => (
        <span class="k" key={k}>
          {k}
        </span>
      ))}
    </div>
  );
}

export function KbdHint({ children }: { children: ComponentChildren }) {
  return <div class="kbdhint">{children}</div>;
}
export const ChoiceKeysHint = () => (
  <KbdHint>
    Phím tắt: <kbd>1</kbd>–<kbd>4</kbd> chọn đáp án · <kbd>Enter</kbd> câu tiếp
  </KbdHint>
);

export interface ChoiceOpt {
  id: string;
  label: ComponentChildren;
  correct: boolean;
}

/** Lưới 4 đáp án. `picked` = vị trí đã chọn (null = chưa trả lời). */
export function Choices(props: { options: ChoiceOpt[]; picked: number | null; onPick: (i: number) => void; kind?: string }) {
  const answered = props.picked !== null;
  return (
    <div class="choices" data-testid="choices">
      {props.options.map((o, i) => {
        let cls = 'choice' + (props.kind ? ' ' + props.kind : '');
        if (answered && o.correct) cls += ' right';
        else if (answered && props.picked === i) cls += ' wrong';
        return (
          <button type="button" key={o.id + i} class={cls} disabled={answered} data-correct={o.correct ? '1' : undefined} onClick={() => !answered && props.onPick(i)}>
            <span class="n">{i + 1}</span>
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export function Feedback({ ok, children }: { ok: boolean | null; children?: ComponentChildren }) {
  return (
    <div class={'feedback' + (ok === true ? ' ok' : ok === false ? ' no' : '')} data-testid="feedback" aria-live="polite">
      {children}
    </div>
  );
}

/** Thẻ lật. */
export function Flash(props: { flipped: boolean; onFlip: () => void; front: ComponentChildren; back: ComponentChildren }) {
  return (
    <div class={'flash' + (props.flipped ? ' flipped' : '')} onClick={props.onFlip} data-testid="flash" role="button" aria-label="Lật thẻ">
      <div class="flash-inner">
        <div class="face">{props.front}</div>
        <div class="face back">{props.back}</div>
      </div>
    </div>
  );
}

export function Done({ total, what, onAgain }: { total: number; what: string; onAgain: () => void }) {
  return (
    <div class="done" data-testid="done">
      <div class="k">よくできた！</div>
      <p>
        Bạn đã ôn hết {total} {what}.
      </p>
      <button type="button" class="btn primary" onClick={onAgain}>
        Ôn lại
      </button>
    </div>
  );
}

export function SpeakBtn({ text, label = '🔊 Nghe', class: cls = 'speakbtn' }: { text: string; label?: string; class?: string }) {
  return (
    <button type="button" class={cls} onClick={() => speak(text)}>
      {label}
    </button>
  );
}

/** Nút cần bấm 2 lần để xác nhận (xoá tiến độ…). */
export function ConfirmButton({ label, onConfirm, class: cls = 'btn danger' }: { label: string; onConfirm: () => void; class?: string }) {
  const [stage, setStage] = useState<0 | 1 | 2>(0);
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const text = stage === 1 ? 'Bấm lần nữa để xoá' : stage === 2 ? 'Đã xoá' : label;
  return (
    <button
      type="button"
      class={cls}
      onClick={() => {
        if (timer) clearTimeout(timer);
        if (stage === 1) {
          onConfirm();
          setStage(2);
          setTimer(setTimeout(() => setStage(0), 1500));
        } else {
          setStage(1);
          setTimer(setTimeout(() => setStage(0), 3000));
        }
      }}
    >
      {text}
    </button>
  );
}

export function Rules({ rules }: { rules: { sym: string; html: string }[] }) {
  if (!rules.length) return null;
  return (
    <div class="rules">
      {rules.map((r) => (
        <div class="rule" key={r.sym + r.html.slice(0, 20)}>
          <div class="sym">{r.sym}</div>
          <Html as="p" html={r.html} />
        </div>
      ))}
    </div>
  );
}
