import { useState } from 'preact/hooks';
import { GROUPS, ROWS, display, groupOk } from '../lib/kana';
import { isWeakKana, kanaPool, script, selectedRows, setRows } from '../state';

/** Chọn hàng chữ để học (dùng chung cho Thẻ nhớ, Luyện tập, Gõ chữ). */
export function RowPicker() {
  const sc = script.value;
  const sel = new Set(selectedRows.value);
  const [msg, setMsg] = useState<string | null>(null);
  const toggle = (key: string) => {
    const next = new Set(sel);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setRows([...next]);
  };
  const quick: [string, ((r: (typeof ROWS)[number]) => boolean) | null][] = [
    ['Chỉ cơ bản', (r) => r.group === 'basic'],
    ['Cơ bản + biến âm', (r) => r.group === 'basic' || r.group === 'daku'],
    ['Tất cả', () => true],
    ['Chỉ chữ hay sai', null],
  ];
  return (
    <details class="picker" data-testid="row-picker">
      <summary>
        <span>Chọn hàng chữ để học</span>
        <span class="count">{kanaPool.value.length} chữ ▾</span>
      </summary>
      {GROUPS.filter((g) => groupOk(g.id, sc)).map((g) => (
        <div class="chips-group" key={g.id}>
          <div class="gl">{g.name}</div>
          <div class="chips">
            {ROWS.filter((r) => r.group === g.id).map((r) => (
              <button type="button" key={r.key} class={'chip' + (sel.has(r.key) ? ' on' : '')} aria-pressed={sel.has(r.key)} onClick={() => toggle(r.key)}>
                {display(r.items[0], sc)}
              </button>
            ))}
          </div>
        </div>
      ))}
      <div class="quick">
        {quick.map(([t, f]) => (
          <button
            type="button"
            class="btn"
            key={t}
            onClick={() => {
              if (f) {
                setRows(ROWS.filter(f).map((r) => r.key));
                return;
              }
              const weak = ROWS.filter((r) => groupOk(r.group, sc) && r.items.some((i) => isWeakKana(display(i, sc))));
              if (!weak.length) {
                setMsg('Chưa có chữ hay sai');
                setTimeout(() => setMsg(null), 1500);
                return;
              }
              setRows(weak.map((r) => r.key));
            }}
          >
            {t === 'Chỉ chữ hay sai' && msg ? msg : t}
          </button>
        ))}
      </div>
    </details>
  );
}
