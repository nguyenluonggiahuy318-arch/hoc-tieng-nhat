import { GROUPS, display, groupOk } from '../lib/kana';
import { speak, speechSupported } from '../lib/speech';
import { kanaLevel, resetKanaStats, script } from '../state';
import { ConfirmButton, Rmj } from '../components/ui';

export function ChartView() {
  const sc = script.value;
  const scName = sc === 'hira' ? 'Hiragana' : 'Katakana';
  return (
    <>
      <div class="toolbar">
        <ConfirmButton label={'Xoá tiến độ ' + scName} onConfirm={() => resetKanaStats(sc)} />
        <span class="hint">{speechSupported ? 'Bấm vào chữ để nghe phát âm.' : 'Trình duyệt này không hỗ trợ đọc phát âm.'}</span>
      </div>
      <div class="legend">
        <span>
          <i class="lv3" />
          Đã thuộc (đúng 3 lần liền)
        </span>
        <span>
          <i class="lv2" />
          Đang học
        </span>
        <span>
          <i class="lv1" />
          Hay sai
        </span>
      </div>
      <div data-testid="chart">
        {GROUPS.filter((g) => groupOk(g.id, sc)).map((g) => {
          const note = g.id === 'yoon' ? (sc === 'hira' ? 'chữ cột i + ゃゅょ nhỏ' : 'chữ cột i + ャュョ nhỏ') : g.note;
          return (
            <div key={g.id}>
              <h2>
                {g.name} <small>{note}</small>
              </h2>
              <div class={'grid' + (g.small ? ' small' : '')} style={{ gridTemplateColumns: `repeat(${g.cols},minmax(0,1fr))` }}>
                {g.head?.map((h) => (
                  <div class="colhead" key={'h' + h}>
                    {h}
                  </div>
                ))}
                {g.rows.flatMap(([rid, cells]) =>
                  cells.map((it, i) => {
                    if (!it) return <div class="cell empty" key={rid + i} />;
                    const ch = display(it, sc);
                    const lv = kanaLevel(ch);
                    return (
                      <button type="button" class="cell" key={rid + i} onClick={() => speak(ch)} aria-label={ch + ' ' + it.r}>
                        <span class={'dot' + (lv ? ' lv' + lv : '')} data-level={lv} />
                        <div class="k">{ch}</div>
                        <div class="r">
                          <Rmj>{it.r}</Rmj>
                        </div>
                      </button>
                    );
                  }),
                )}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
