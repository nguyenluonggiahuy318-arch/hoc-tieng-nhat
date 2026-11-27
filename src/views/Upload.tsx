import { useEffect, useRef, useState } from 'preact/hooks';
import { CAP_NHAT_WORKFLOW, GitHubError, checkAccess, commitFiles, defaultRepo, getRepo, getToken, latestRuns, listInbox, safeName, setRepo, setToken, type InboxFile, type Run, type UploadFile } from '../lib/github';
import { extractSlides, type Slide } from '../lib/videoFrames';
import { fmtTime, frameFileName } from '../lib/frameDiff';

const MAX_MB = 50;
type Kind = 'video' | 'pdf' | 'anh' | 'docx' | 'khac';

interface Item {
  id: number;
  file: File;
  kind: Kind;
  status: string;
  error?: string;
  slides?: Slide[];
  duration?: number;
}

function kindOf(f: File): Kind {
  const n = f.name.toLowerCase();
  if (f.type.startsWith('video/') || /\.(mp4|mov|m4v|webm|mkv)$/.test(n)) return 'video';
  if (f.type === 'application/pdf' || n.endsWith('.pdf')) return 'pdf';
  if (f.type.startsWith('image/') || /\.(png|jpe?g|webp|heic|heif|gif)$/.test(n)) return 'anh';
  if (n.endsWith('.docx')) return 'docx';
  return 'khac';
}
const KIND_LABEL: Record<Kind, string> = { video: 'video', pdf: 'PDF', anh: 'ảnh', docx: 'Word', khac: 'không hỗ trợ' };
const mb = (n: number) => (n / 1048576).toFixed(n < 1048576 ? 2 : 1) + ' MB';
const baseName = (n: string) => safeName(n.replace(/\.[^.]+$/, ''));

function stamp() {
  const d = new Date();
  const p = (x: number) => String(x).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`;
}

function TokenGuide() {
  return (
    <details class="picker">
      <summary>
        <span>Cách tạo mã GitHub (làm 1 lần, được trên điện thoại)</span>
        <span class="count">▾</span>
      </summary>
      <ol class="hint steps">
        <li>
          Mở{' '}
          <a href="https://github.com/settings/personal-access-tokens/new" target="_blank" rel="noopener noreferrer">
            github.com/settings/personal-access-tokens/new
          </a>{' '}
          (đăng nhập GitHub).
        </li>
        <li>
          <b>Token name</b>: <code>Gui bai hoc-tieng-nhat</code> · <b>Expiration</b>: chọn dài nhất có thể (ví dụ 1 năm).
        </li>
        <li>
          <b>Repository access</b> → <i>Only select repositories</i> → chọn repo <code>{(getRepo() || 'hoc-tieng-nhat').split('/').pop()}</code>.
        </li>
        <li>
          <b>Permissions</b> → <b>Contents</b>: <i>Read and write</i>; <b>Actions</b>: <i>Read-only</i> (để xem trạng thái xử lý).
        </li>
        <li>
          Bấm <b>Generate token</b>, sao chép chuỗi bắt đầu bằng <code>github_pat_</code> rồi dán vào ô bên dưới.
        </li>
      </ol>
      <p class="hint">Mã chỉ lưu trong trình duyệt của máy này (không nằm trong file xuất tiến độ). Mã chỉ có quyền với đúng repo này; muốn thu hồi thì xoá token trên GitHub.</p>
    </details>
  );
}

function Status({ repo, refreshKey }: { repo: string; refreshKey: number }) {
  const [inbox, setInbox] = useState<InboxFile[] | null>(null);
  const [runs, setRuns] = useState<Run[] | null | undefined>(undefined);
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const load = async () => {
    setLoading(true);
    setErr(null);
    try {
      const [a, b] = await Promise.all([listInbox(repo), latestRuns(repo)]);
      setInbox(a);
      setRuns(b);
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    void load();
  }, [repo, refreshKey]);
  const runLabel = (r: Run, i: number) =>
    r.status !== 'completed'
      ? '⏳ đang xử lý'
      : r.conclusion === 'success'
        ? i === 0 && inbox && inbox.length
          ? '✓ đã nhận file (chưa xử lý tự động — gõ /cap-nhat trong Claude)'
          : '✓ xong'
        : r.conclusion === 'skipped' || r.conclusion === 'cancelled'
          ? '– đã bỏ qua'
          : '✖ lỗi';
  return (
    <section class="card" data-testid="upload-status">
      <h2>Trạng thái</h2>
      {err && <p class="feedback no">{err}</p>}
      <p class="hint">
        <b>Đang chờ xử lý trong inbox/:</b>{' '}
        {inbox === null ? '…' : inbox.length ? '' : 'không có file nào.'}
      </p>
      {inbox && inbox.length > 0 && (
        <ul class="files" data-testid="inbox-list">
          {inbox.slice(0, 12).map((f) => (
            <li key={f.name}>
              {f.name} <small>{mb(f.size)}</small>
            </li>
          ))}
          {inbox.length > 12 && <li>… và {inbox.length - 12} file nữa</li>}
        </ul>
      )}
      {runs === null ? (
        <p class="hint">Không xem được lịch sử xử lý (mã chưa có quyền "Actions: Read-only").</p>
      ) : runs && runs.length ? (
        <>
          <p class="hint">
            <b>Những lần xử lý gần đây:</b>
          </p>
          <ul class="files">
            {runs.map((r, i) => (
              <li key={r.id}>
                {runLabel(r, i)} · {new Date(r.created_at).toLocaleString('vi-VN')} ·{' '}
                <a href={r.html_url} target="_blank" rel="noopener noreferrer">
                  xem chi tiết
                </a>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div class="toolbar">
        <button type="button" class="btn" onClick={() => void load()} disabled={loading}>
          {loading ? 'Đang tải…' : '↻ Làm mới'}
        </button>
        <a class="btn" href={`https://github.com/${repo}/actions/workflows/${CAP_NHAT_WORKFLOW}`} target="_blank" rel="noopener noreferrer">
          Mở GitHub Actions
        </a>
      </div>
      <p class="hint">
        Xử lý tự động cần cài secret <code>CLAUDE_CODE_OAUTH_TOKEN</code> cho repo (xem README). Chưa cài thì mở Claude Code (repo hoc-tieng-nhat) và gõ{' '}
        <code>/cap-nhat</code> — Claude sẽ lấy các file đã gửi từ GitHub để xử lý. Xong, web tự báo "Đã có bản cập nhật".
      </p>
    </section>
  );
}

export function UploadView() {
  const [token, setTok] = useState(getToken());
  const [repo, setRep] = useState(getRepo());
  const [tokenInput, setTokenInput] = useState('');
  const [repoInput, setRepoInput] = useState(getRepo());
  const [conn, setConn] = useState<{ ok: boolean; msg: string } | null>(null);
  const [items, setItems] = useState<Item[]>([]);
  const [lesson, setLesson] = useState('');
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const abort = useRef<AbortController | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const nextId = useRef(1);

  const update = (id: number, patch: Partial<Item>) => setItems((xs) => xs.map((x) => (x.id === id ? { ...x, ...patch } : x)));

  const connect = async () => {
    const t = tokenInput.trim() || token;
    const r = repoInput.trim();
    setConn({ ok: true, msg: 'Đang kiểm tra…' });
    try {
      const info = await checkAccess(t, r);
      setToken(t);
      setRepo(r);
      setTok(t);
      setRep(r);
      setTokenInput('');
      setConn({ ok: true, msg: `Đã kết nối ${info.full_name} ✓` });
    } catch (e) {
      setConn({ ok: false, msg: (e as Error).message });
    }
  };

  const addFiles = (list: FileList | null) => {
    if (!list) return;
    const add: Item[] = [...list].map((file) => {
      const kind = kindOf(file);
      let error: string | undefined;
      if (kind === 'khac') error = 'Chỉ nhận video, ảnh, PDF, Word (.docx).';
      else if (kind !== 'video' && file.size > MAX_MB * 1048576) error = `File quá lớn (${mb(file.size)}), tối đa ${MAX_MB} MB.`;
      return { id: nextId.current++, file, kind, status: error ? '' : kind === 'video' ? 'sẽ cắt khung hình trên máy' : 'sẵn sàng', error };
    });
    setItems((xs) => [...xs, ...add]);
    setResult(null);
  };

  const send = async () => {
    const ready = items.filter((x) => !x.error);
    if (!ready.length || busy) return;
    const ctrl = new AbortController();
    abort.current = ctrl;
    setResult(null);
    try {
      // 1. video → khung hình
      const done: Item[] = [];
      for (const it of ready) {
        if (it.kind !== 'video') {
          done.push(it);
          continue;
        }
        setBusy(`Đang cắt khung hình: ${it.file.name}`);
        update(it.id, { status: 'đang cắt khung hình…' });
        try {
          const r = await extractSlides(it.file, {
            signal: ctrl.signal,
            onProgress: (d, t) => update(it.id, { status: `đang cắt khung hình ${d}/${t}` }),
          });
          if (!r.slides.length) throw new Error('Không lấy được khung hình nào.');
          update(it.id, { status: `${fmtTime(r.duration)} → giữ ${r.slides.length} slide khác nhau`, slides: r.slides, duration: r.duration });
          done.push({ ...it, slides: r.slides, duration: r.duration });
        } catch (e) {
          if ((e as Error).name === 'AbortError') throw e;
          update(it.id, { error: (e as Error).message, status: '' });
        }
      }
      // 2. danh sách file đưa lên inbox/
      const files: UploadFile[] = [];
      const desc: string[] = [];
      for (const it of done) {
        if (it.slides) {
          const base = baseName(it.file.name);
          it.slides.forEach((s, i) => files.push({ path: `inbox/${frameFileName(base, i + 1, s.t)}`, blob: s.blob }));
          desc.push(`${it.file.name} (video ${fmtTime(it.duration ?? 0)} → ${it.slides.length} khung hình)`);
        } else {
          files.push({ path: `inbox/${safeName(it.file.name)}`, blob: it.file });
          desc.push(`${it.file.name} (${KIND_LABEL[it.kind]}, ${mb(it.file.size)})`);
        }
      }
      if (!files.length) throw new Error('Không có file nào gửi được.');
      const noteText = [
        `Ghi chú gửi từ trang "Gửi bài" lúc ${new Date().toLocaleString('vi-VN')}`,
        lesson ? `Bài: ${lesson}` : 'Bài: (không ghi — hãy đoán từ tài liệu)',
        note.trim() ? `Ghi chú: ${note.trim()}` : '',
        'Tài liệu:',
        ...desc.map((d) => '- ' + d),
      ]
        .filter(Boolean)
        .join('\n');
      files.push({ path: `inbox/ghi-chu-${stamp()}.txt`, blob: new Blob([noteText + '\n'], { type: 'text/plain' }) });
      // 3. một commit lên GitHub
      await commitFiles(repo, files, `Gửi tài liệu bài giảng từ web${lesson ? ` (Bài ${lesson})` : ''}: ${done.length} tài liệu, ${files.length} file`, (d, t) =>
        setBusy(`Đang tải lên GitHub ${d}/${t}…`),
      );
      setResult({ ok: true, msg: `Đã gửi ${files.length} file vào inbox/ trên GitHub. Claude sẽ đọc và cập nhật bài.` });
      setItems((xs) => xs.filter((x) => x.error));
      setNote('');
      setRefreshKey((k) => k + 1);
    } catch (e) {
      setResult({ ok: false, msg: (e as Error).name === 'AbortError' ? 'Đã huỷ.' : (e as Error).message });
    } finally {
      setBusy(null);
      abort.current = null;
    }
  };

  const connected = !!token && !!repo;
  return (
    <div class="settings upload" data-testid="upload">
      <section class="card">
        <h2>📤 Gửi tài liệu bài giảng</h2>
        <p class="hint">
          Chọn video / ảnh / PDF / Word của bài mới. <b>Video được cắt thành ảnh slide ngay trên máy</b> nên video dài cũng gửi được nhanh. Tài liệu được
          đưa vào thư mục <code>inbox/</code> của repo GitHub, rồi Claude đọc và cập nhật bài trên web.
        </p>
      </section>

      <section class="card" data-testid="upload-connect">
        <h2>1. Kết nối GitHub</h2>
        {connected && <p class="feedback ok">Đang dùng repo {repo} ✓</p>}
        <TokenGuide />
        <div class="form">
          <label>
            Mã GitHub (token)
            <input type="password" autocomplete="off" placeholder={token ? '•••••• (đã lưu — dán mã mới để đổi)' : 'github_pat_…'} value={tokenInput} onInput={(e) => setTokenInput((e.target as HTMLInputElement).value)} aria-label="Mã GitHub" />
          </label>
          <label>
            Repo (tên-github/tên-repo)
            <input value={repoInput} placeholder={defaultRepo() || 'ten-github/hoc-tieng-nhat'} onInput={(e) => setRepoInput((e.target as HTMLInputElement).value)} aria-label="Repo" />
          </label>
        </div>
        <div class="toolbar">
          <button type="button" class="btn primary" disabled={!(tokenInput.trim() || token) || !repoInput.trim()} onClick={() => void connect()} data-testid="connect">
            Lưu & kiểm tra
          </button>
          {token && (
            <button
              type="button"
              class="btn danger"
              onClick={() => {
                setToken('');
                setTok('');
                setConn({ ok: true, msg: 'Đã xoá mã khỏi máy này.' });
              }}
            >
              Xoá mã
            </button>
          )}
        </div>
        {conn && (
          <p class={'feedback ' + (conn.ok ? 'ok' : 'no')} data-testid="connect-msg">
            {conn.msg}
          </p>
        )}
      </section>

      <section class="card" data-testid="upload-files">
        <h2>2. Chọn tài liệu</h2>
        <input
          ref={fileInput}
          type="file"
          multiple
          accept="video/*,image/*,application/pdf,.pdf,.docx,.mov,.mp4"
          hidden
          data-testid="upload-input"
          onChange={(e) => {
            addFiles((e.target as HTMLInputElement).files);
            (e.target as HTMLInputElement).value = '';
          }}
        />
        <div class="toolbar">
          <button type="button" class="btn" onClick={() => fileInput.current?.click()} disabled={!!busy}>
            ➕ Chọn file
          </button>
          {items.length > 0 && !busy && (
            <button type="button" class="btn" onClick={() => setItems([])}>
              Bỏ chọn hết
            </button>
          )}
        </div>
        {items.length > 0 && (
          <ul class="files" data-testid="upload-items">
            {items.map((it) => (
              <li key={it.id} class={it.error ? 'bad' : ''}>
                <b>{it.file.name}</b> <small>· {KIND_LABEL[it.kind]} · {mb(it.file.size)}</small>
                <br />
                <small data-testid="item-status">{it.error ? '✖ ' + it.error : it.status}</small>
                {!busy && (
                  <button type="button" class="linklike" onClick={() => setItems((xs) => xs.filter((x) => x.id !== it.id))} aria-label={'Bỏ ' + it.file.name}>
                    bỏ
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
        <div class="form">
          <label>
            Bài số (tuỳ chọn)
            <input type="number" inputMode="numeric" min="1" max="99" value={lesson} placeholder="vd: 5" onInput={(e) => setLesson((e.target as HTMLInputElement).value.replace(/\D/g, '').slice(0, 2))} aria-label="Bài số" />
          </label>
          <label>
            Ghi chú cho Claude (tuỳ chọn)
            <input value={note} placeholder="vd: video phần 2, chỉ có ngữ pháp" onInput={(e) => setNote((e.target as HTMLInputElement).value)} aria-label="Ghi chú cho Claude" />
          </label>
        </div>
        <div class="toolbar">
          <button type="button" class="btn primary" disabled={!connected || !items.some((x) => !x.error) || !!busy} onClick={() => void send()} data-testid="upload-send">
            📤 Gửi lên
          </button>
          {busy && (
            <button type="button" class="btn" onClick={() => abort.current?.abort()}>
              Huỷ
            </button>
          )}
        </div>
        {!connected && <p class="hint">Cần kết nối GitHub ở bước 1 trước.</p>}
        {busy && (
          <p class="hint" data-testid="upload-busy" aria-live="polite">
            {busy}
          </p>
        )}
        {result && (
          <p class={'feedback ' + (result.ok ? 'ok' : 'no')} data-testid="upload-result">
            {result.msg}
          </p>
        )}
      </section>

      {connected && <Status repo={repo} refreshKey={refreshKey} />}
    </div>
  );
}

export { GitHubError };
