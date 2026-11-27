import { useRef, useState } from 'preact/hooks';
import { BASIC, display } from '../lib/kana';
import { exportProgress, importProgress } from '../lib/storage';
import { hasJaVoice, setSpeechRate, speak, speechRate, speechSupported } from '../lib/speech';
import { LESSON_NUMBERS } from '../lib/content';
import { kanaStats, resetKanaStats, resetVocabStats, vocabStats } from '../state';
import { applyUpdate, checkForUpdate, installEvent, isStandalone, needRefresh, updateChecking } from '../pwa';
import { ConfirmButton } from '../components/ui';

declare const __BUILD_TIME__: string;
declare const __BUILD_SHA__: string;

function fileName() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `tien-do-hoc-tieng-nhat-${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}.json`;
}

function download(text: string) {
  const blob = new Blob([text], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName();
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

export function SettingsView() {
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [paste, setPaste] = useState('');
  const [copied, setCopied] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const learned = (sc: 'hira' | 'kata') => BASIC.filter((i) => (kanaStats.value[display(i, sc)]?.st ?? 0) >= 3).length;
  const words = Object.keys(vocabStats.value).length;
  const weakWords = Object.values(vocabStats.value).filter((s) => s.w > 0 && s.st < 2).length;

  const doImport = (text: string) => {
    const r = importProgress(text);
    if (!r.ok) return setMsg({ ok: false, text: r.error });
    setMsg({ ok: true, text: `Đã nhập tiến độ${r.exportedAt ? ' (xuất lúc ' + new Date(r.exportedAt).toLocaleString('vi-VN') + ')' : ''}. Đang tải lại…` });
    setTimeout(() => location.reload(), 900);
  };

  const exportNow = async () => {
    const text = JSON.stringify(exportProgress(), null, 2);
    const file = typeof File !== 'undefined' ? new File([text], fileName(), { type: 'application/json' }) : null;
    const mobile = matchMedia('(pointer: coarse)').matches;
    if (mobile && file && navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], title: 'Tiến độ học tiếng Nhật' });
        return setMsg({ ok: true, text: 'Đã mở bảng chia sẻ — chọn "Lưu vào Tệp" hoặc gửi sang máy khác.' });
      } catch (e) {
        if ((e as DOMException).name === 'AbortError') return;
      }
    }
    download(text);
    setMsg({ ok: true, text: 'Đã tải file tiến độ (.json). Mở web trên máy khác → Cài đặt → Nhập tiến độ.' });
  };

  return (
    <div class="settings" data-testid="settings">
      <section class="card">
        <h2>Sao lưu tiến độ</h2>
        <p class="hint">
          Tiến độ được lưu ngay trong trình duyệt của máy này. Để chuyển sang máy khác (hoặc giữ lại khi xoá dữ liệu trình duyệt), hãy <b>xuất</b> ra file rồi <b>nhập</b> ở máy kia.
        </p>
        <ul class="stats">
          <li>
            Hiragana cơ bản đã thuộc: <b>{learned('hira')}/46</b>
          </li>
          <li>
            Katakana cơ bản đã thuộc: <b>{learned('kata')}/46</b>
          </li>
          <li>
            Từ vựng đã luyện: <b>{words}</b> từ{weakWords ? ` (${weakWords} từ hay sai)` : ''}
          </li>
        </ul>
        <div class="toolbar">
          <button type="button" class="btn primary" onClick={exportNow} data-testid="export">
            ⬇️ Xuất tiến độ
          </button>
          <button type="button" class="btn" onClick={() => fileInput.current?.click()} data-testid="import">
            ⬆️ Nhập tiến độ
          </button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json,text/plain"
            hidden
            data-testid="import-file"
            onChange={async (e) => {
              const f = (e.target as HTMLInputElement).files?.[0];
              if (!f) return;
              doImport(await f.text());
              (e.target as HTMLInputElement).value = '';
            }}
          />
        </div>
        {msg && (
          <p class={'feedback ' + (msg.ok ? 'ok' : 'no')} data-testid="settings-msg">
            {msg.text}
          </p>
        )}
        <details class="picker">
          <summary>
            <span>Cách khác: sao chép / dán mã tiến độ</span>
            <span class="count">▾</span>
          </summary>
          <p class="hint">Nếu không tải hoặc chọn được file (ví dụ trên một số iPhone), hãy sao chép mã rồi gửi cho chính mình qua Zalo / email, sau đó dán vào ô bên dưới ở máy kia.</p>
          <div class="toolbar">
            <button
              type="button"
              class="btn"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(JSON.stringify(exportProgress()));
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1500);
                } catch {
                  setMsg({ ok: false, text: 'Trình duyệt không cho sao chép tự động.' });
                }
              }}
            >
              {copied ? 'Đã chép ✓' : '📋 Sao chép mã'}
            </button>
          </div>
          <textarea class="paste" rows={3} placeholder="Dán mã tiến độ vào đây" value={paste} onInput={(e) => setPaste((e.target as HTMLTextAreaElement).value)} />
          <div class="toolbar">
            <button type="button" class="btn" disabled={!paste.trim()} onClick={() => doImport(paste)}>
              Nhập từ mã đã dán
            </button>
          </div>
        </details>
      </section>

      <section class="card">
        <h2>Xoá tiến độ</h2>
        <div class="toolbar">
          <ConfirmButton label="Xoá tiến độ Hiragana" onConfirm={() => resetKanaStats('hira')} />
          <ConfirmButton label="Xoá tiến độ Katakana" onConfirm={() => resetKanaStats('kata')} />
          <ConfirmButton label="Xoá tiến độ từ vựng" onConfirm={resetVocabStats} />
        </div>
      </section>

      <section class="card">
        <h2>Phát âm</h2>
        {!speechSupported ? (
          <p class="hint">Trình duyệt này không hỗ trợ đọc phát âm.</p>
        ) : (
          <>
            {!hasJaVoice.value && <p class="hint">Chưa thấy giọng đọc tiếng Nhật trên máy. iPhone: Cài đặt → Trợ năng → Nội dung được đọc → Giọng nói → Tiếng Nhật. Android: cài “Dịch vụ lời nói của Google” và tải dữ liệu tiếng Nhật.</p>}
            <label class="rate">
              Tốc độ đọc: <b>{speechRate.value.toFixed(1)}×</b>
              <input type="range" min="0.5" max="1.3" step="0.1" value={speechRate.value} onInput={(e) => setSpeechRate(parseFloat((e.target as HTMLInputElement).value))} />
            </label>
            <button type="button" class="btn" onClick={() => speak('こんにちは。わたしは がくせいです。')}>
              🔊 Nghe thử
            </button>
          </>
        )}
      </section>

      <section class="card">
        <h2>Thêm vào màn hình chính</h2>
        {isStandalone() ? (
          <p class="hint">Bạn đang dùng web như một app. Không cần mạng vẫn học được các bài đã có.</p>
        ) : (
          <>
            {installEvent.value && (
              <div class="toolbar">
                <button type="button" class="btn primary" onClick={() => installEvent.value?.prompt().finally(() => (installEvent.value = null))}>
                  📲 Cài app
                </button>
              </div>
            )}
            <p class="hint">
              <b>iPhone (Safari)</b>: bấm nút Chia sẻ <span aria-hidden="true">⎙</span> → <i>Thêm vào MH chính</i>.
              <br />
              <b>Android (Chrome)</b>: bấm ⋮ → <i>Thêm vào màn hình chính</i> (hoặc <i>Cài đặt ứng dụng</i>).
              <br />
              Sau khi thêm, app mở toàn màn hình và dùng được cả khi không có mạng.
            </p>
          </>
        )}
      </section>

      <section class="card">
        <h2>Phiên bản</h2>
        <p class="hint">
          Có {LESSON_NUMBERS.length} bài: {LESSON_NUMBERS.map((n) => 'Bài ' + n).join(', ')}. Bản dựng {__BUILD_SHA__} lúc {new Date(__BUILD_TIME__).toLocaleString('vi-VN')}.
        </p>
        <div class="toolbar">
          {needRefresh.value ? (
            <button type="button" class="btn primary" onClick={() => void applyUpdate()}>
              Cập nhật ngay
            </button>
          ) : (
            <button type="button" class="btn" onClick={() => void checkForUpdate()}>
              {updateChecking.value === 'checking' ? 'Đang kiểm tra…' : updateChecking.value === 'latest' ? 'Đã là bản mới nhất ✓' : updateChecking.value === 'error' ? 'Không kiểm tra được (offline?)' : 'Kiểm tra bài mới'}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
