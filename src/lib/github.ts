// Gửi tài liệu bài giảng vào thư mục inbox/ của repo GitHub, ngay từ trình duyệt.
// Dùng mã truy cập (fine-grained token) chỉ có quyền với repo này; mã lưu riêng trên máy người dùng.
import { loadSecret, storeSecret } from './storage';

declare const __REPO__: string;

const API = 'https://api.github.com';
const BRANCH = 'main';
export const CAP_NHAT_WORKFLOW = 'cap-nhat.yml';

/** "owner/repo" — lấy lúc build (GITHUB_REPOSITORY / git remote), hoặc đoán từ địa chỉ GitHub Pages. */
export function defaultRepo(): string {
  if (typeof __REPO__ === 'string' && __REPO__) return __REPO__;
  const m = location.hostname.match(/^([^.]+)\.github\.io$/);
  if (!m) return '';
  const first = location.pathname.split('/').filter(Boolean)[0];
  return first ? `${m[1]}/${first}` : `${m[1]}/${m[1]}.github.io`;
}

export const getToken = () => loadSecret('githubToken');
export const setToken = (t: string) => storeSecret('githubToken', t.trim());
export const getRepo = () => loadSecret('githubRepo') || defaultRepo();
export const setRepo = (r: string) => storeSecret('githubRepo', r.trim() === defaultRepo() ? '' : r.trim());

export class GitHubError extends Error {
  constructor(
    message: string,
    public status: number,
  ) {
    super(message);
  }
}

function explain(status: number, body: string): string {
  if (status === 401) return 'Mã GitHub sai hoặc đã hết hạn — hãy tạo mã mới.';
  if (status === 403 && /rate limit/i.test(body)) return 'GitHub đang giới hạn số lần gọi — thử lại sau ít phút.';
  if (status === 403) return 'Mã GitHub thiếu quyền — cần quyền "Contents: Read and write" cho repo này.';
  if (status === 404) return 'Không thấy repo, hoặc mã chưa được cấp quyền cho repo này.';
  if (status === 409 || status === 422) return 'Repo vừa thay đổi trong lúc gửi — hãy bấm gửi lại.';
  if (status === 413) return 'File quá lớn để gửi qua GitHub.';
  return `GitHub báo lỗi ${status}.`;
}

async function gh<T>(path: string, init: RequestInit & { token?: string } = {}): Promise<T> {
  const token = init.token ?? getToken();
  let res: Response;
  try {
    res = await fetch(API + path, {
      ...init,
      headers: {
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(init.body ? { 'Content-Type': 'application/json' } : {}),
      },
    });
  } catch {
    throw new GitHubError('Không kết nối được GitHub — kiểm tra mạng rồi thử lại.', 0);
  }
  if (!res.ok) throw new GitHubError(explain(res.status, await res.text().catch(() => '')), res.status);
  return (res.status === 204 ? undefined : await res.json()) as T;
}

const repoPath = (repo: string) => `/repos/${repo.split('/').map(encodeURIComponent).join('/')}`;

export interface RepoInfo {
  full_name: string;
  html_url: string;
  permissions?: { push?: boolean };
}
/** Kiểm tra mã: thấy repo và có quyền ghi không. */
export async function checkAccess(token: string, repo: string): Promise<RepoInfo> {
  if (!/^[\w.-]+\/[\w.-]+$/.test(repo)) throw new GitHubError('Tên repo phải có dạng tên-github/tên-repo.', 0);
  const info = await gh<RepoInfo>(repoPath(repo), { token });
  if (info.permissions && info.permissions.push === false) throw new GitHubError('Mã này chỉ có quyền đọc — cần quyền "Contents: Read and write".', 403);
  return info;
}

/** Đọc file thành base64 (FileReader nhanh và ít tốn bộ nhớ hơn tự mã hoá). */
export function blobToBase64(b: Blob): Promise<string> {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(String(r.result).replace(/^data:[^,]*,/, ''));
    r.onerror = () => rej(r.error ?? new Error('Không đọc được file'));
    r.readAsDataURL(b);
  });
}

export interface UploadFile {
  /** Đường dẫn trong repo, ví dụ "inbox/bai5.pdf". */
  path: string;
  blob: Blob;
}

/**
 * Đưa nhiều file lên nhánh main trong MỘT commit (Git Data API): tạo blob → tree → commit → cập nhật ref.
 * Nhờ một commit duy nhất nên workflow xử lý chỉ chạy một lần.
 */
export async function commitFiles(repo: string, files: UploadFile[], message: string, onProgress?: (done: number, total: number) => void): Promise<string> {
  const rp = repoPath(repo);
  const blobs: { path: string; sha: string }[] = new Array(files.length);
  let done = 0;
  onProgress?.(0, files.length);
  // tải tối đa 3 file cùng lúc
  let next = 0;
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      const f = files[i];
      const content = await blobToBase64(f.blob);
      const r = await gh<{ sha: string }>(`${rp}/git/blobs`, { method: 'POST', body: JSON.stringify({ content, encoding: 'base64' }) });
      blobs[i] = { path: f.path, sha: r.sha };
      onProgress?.(++done, files.length);
    }
  };
  await Promise.all([worker(), worker(), worker()]);
  for (let attempt = 0; ; attempt++) {
    const ref = await gh<{ object: { sha: string } }>(`${rp}/git/ref/heads/${BRANCH}`);
    const parent = await gh<{ tree: { sha: string } }>(`${rp}/git/commits/${ref.object.sha}`);
    const tree = await gh<{ sha: string }>(`${rp}/git/trees`, {
      method: 'POST',
      body: JSON.stringify({ base_tree: parent.tree.sha, tree: blobs.map((b) => ({ path: b.path, mode: '100644', type: 'blob', sha: b.sha })) }),
    });
    const commit = await gh<{ sha: string }>(`${rp}/git/commits`, { method: 'POST', body: JSON.stringify({ message, tree: tree.sha, parents: [ref.object.sha] }) });
    try {
      await gh(`${rp}/git/refs/heads/${BRANCH}`, { method: 'PATCH', body: JSON.stringify({ sha: commit.sha, force: false }) });
      return commit.sha;
    } catch (e) {
      // nhánh vừa có commit khác chen vào → làm lại trên commit mới nhất (tối đa 2 lần)
      if (attempt < 2 && e instanceof GitHubError && (e.status === 409 || e.status === 422)) continue;
      throw e;
    }
  }
}

export interface InboxFile {
  name: string;
  size: number;
}
/** Các file đang chờ xử lý trong inbox/. */
export async function listInbox(repo: string): Promise<InboxFile[]> {
  try {
    const items = await gh<{ name: string; size: number; type: string }[]>(`${repoPath(repo)}/contents/inbox?ref=${BRANCH}`);
    return items.filter((x) => x.type === 'file' && x.name !== 'README.md' && x.name !== '.gitkeep').map((x) => ({ name: x.name, size: x.size }));
  } catch (e) {
    if (e instanceof GitHubError && e.status === 404) return [];
    throw e;
  }
}

export interface Run {
  id: number;
  status: string;
  conclusion: string | null;
  html_url: string;
  created_at: string;
  event: string;
}
/** Những lần chạy gần đây của workflow xử lý bài (cần quyền "Actions: Read"; không có quyền thì trả về null). */
export async function latestRuns(repo: string): Promise<Run[] | null> {
  try {
    const r = await gh<{ workflow_runs: Run[] }>(`${repoPath(repo)}/actions/workflows/${CAP_NHAT_WORKFLOW}/runs?per_page=5`);
    return r.workflow_runs;
  } catch (e) {
    if (e instanceof GitHubError && (e.status === 403 || e.status === 404)) return null;
    throw e;
  }
}

/** Tên file an toàn trong repo (giữ chữ Việt / Nhật để còn đoán được số bài). */
export function safeName(name: string): string {
  const n = name
    .normalize('NFC')
    .replace(/[\\/:*?"<>|#%\u0000-\u001f]+/g, '-')
    .replace(/\s+/g, '_')
    .replace(/^\.+/, '')
    .slice(0, 120);
  return n || 'tai-lieu';
}
