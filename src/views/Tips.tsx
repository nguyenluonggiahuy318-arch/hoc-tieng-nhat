import { DE_NHAM } from '../lib/content';
import { BY, toKata } from '../lib/kana';
import { speak } from '../lib/speech';
import { script } from '../state';
import { Html, Rmj, Rules } from '../components/ui';

export function TipsView() {
  const d = DE_NHAM[script.value];
  return (
    <div data-testid="tips">
      <h2 style={{ marginTop: 0 }}>
        Các nhóm chữ dễ nhầm <small>bấm vào chữ để nghe</small>
      </h2>
      <div class="tips">
        {d.tips.map((t) => (
          <div class="tip" key={t.chars.join('')}>
            <div class="pair">
              {t.chars.map((k) => (
                <button type="button" key={k} onClick={() => speak(k)}>
                  <span class="k">{k}</span>
                  <span class="r">
                    <Rmj>{BY[toKata(k)]?.r ?? ''}</Rmj>
                  </span>
                </button>
              ))}
            </div>
            <Html as="p" html={t.html} />
          </div>
        ))}
      </div>
      <h2>Quy tắc cần biết</h2>
      <Rules rules={d.rules} />
    </div>
  );
}
