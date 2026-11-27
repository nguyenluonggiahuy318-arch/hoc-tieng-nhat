# Học tiếng Nhật — Kana & từng bài

Web học tiếng Nhật sơ cấp (Hiragana, Katakana, từ vựng, ngữ pháp, số đếm theo từng bài, giáo trình kiểu Minna no Nihongo).
Chạy trên Safari iPhone, Chrome Android và máy tính; thêm được vào màn hình chính và dùng offline.

**Link web:** _(sẽ có sau lần deploy đầu tiên — chạy `npm run stats` để xem)_

## Dùng trên điện thoại

- **iPhone (Safari):** mở link → nút Chia sẻ → **Thêm vào MH chính**.
- **Android (Chrome):** mở link → ⋮ → **Thêm vào màn hình chính** (hoặc *Cài đặt ứng dụng*).

Sau đó app mở toàn màn hình, không có mạng vẫn học được các bài đã tải.

## Xuất / nhập tiến độ

Tiến độ (chữ đã thuộc, từ hay sai…) lưu ngay trong trình duyệt của từng máy. Để chuyển sang máy khác:

1. Máy cũ: **⚙️ Cài đặt → ⬇️ Xuất tiến độ** → được file `tien-do-hoc-tieng-nhat-….json`
   (trên điện thoại sẽ mở bảng chia sẻ: chọn *Lưu vào Tệp* hoặc gửi qua Zalo / email).
2. Máy mới: **⚙️ Cài đặt → ⬆️ Nhập tiến độ** → chọn file đó.

Không chọn được file? Dùng mục *Cách khác: sao chép / dán mã tiến độ* trong Cài đặt.
Lưu ý: nhập sẽ **thay** toàn bộ tiến độ đang có trên máy đó.

## Cài đặt trên máy tính (để thêm bài mới)

1. Cài [Node.js 22 LTS](https://nodejs.org), [Git](https://git-scm.com) và [Claude Code](https://code.claude.com).
2. Cài công cụ đọc video / PDF:
   - **Windows:** `winget install Gyan.FFmpeg` và `winget install oschwartz10612.Poppler` (mở lại terminal sau khi cài)
   - **Mac:** `brew install ffmpeg poppler`
   - **Ubuntu:** `sudo apt install ffmpeg poppler-utils`
   - Tuỳ chọn, để chép cả lời giảng trong video: `pip install -U openai-whisper` (chạy chậm nếu máy không có GPU).
3. Tải code và cài thư viện:

   ```bash
   git clone https://github.com/<tên-github>/<tên-repo>.git
   cd <tên-repo>
   npm ci
   npx playwright install chromium webkit
   ```

4. Chạy thử: `npm run dev` rồi mở http://localhost:5173

## Thêm bài mới

1. Bỏ video / ảnh / PDF / DOCX bài giảng vào thư mục `inbox/`.
2. Mở Claude Code trong thư mục dự án (`claude`) và gõ **`/cap-nhat`** (hoặc `/cap-nhat 4` nếu muốn nói rõ là Bài 4).
3. Claude sẽ: cắt khung hình video và đọc slide, đọc PDF/ảnh, xác định bài mấy (không chắc sẽ hỏi bạn), thêm từ vựng,
   ngữ pháp, bài tập vào `content/lessons/bai-N.json` (giữ nguyên nội dung cũ, không tạo trùng), chạy kiểm tra,
   chuyển file sang `inbox/done/`, commit và push. Web tự cập nhật sau vài phút.

File trong `inbox/` không được đưa lên GitHub (video rất nặng).
Lần đầu chạy, Claude Code sẽ hỏi quyền cho từng lệnh (`npm run …`, `git push`): chọn *Yes, and don't ask again* để các lần sau chạy liền mạch.

## Cập nhật bài từ điện thoại (tuỳ chọn)

Workflow `.github/workflows/cap-nhat.yml` cho phép tải file vào `inbox/` ngay trên trang GitHub, rồi Claude tự chạy quy trình
`/cap-nhat` trên máy chủ GitHub — không cần mở máy tính. Cài một lần:

1. **Claude GitHub App** phải được cài cho repo: vào https://github.com/apps/claude → *Configure* → chọn repo này
   (nếu bạn đã kết nối GitHub với claude.ai cho repo này thì đã có sẵn).
2. Tạo token dùng gói Claude của bạn (Pro / Max): trên máy tính đã cài Claude Code, chạy `claude setup-token`, đăng nhập,
   copy chuỗi token.
3. Trên GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**:
   tên `CLAUDE_CODE_OAUTH_TOKEN`, giá trị là token vừa copy. (Dùng API key thì đặt tên `ANTHROPIC_API_KEY`.)
4. Repo → **Settings → Actions → General → Workflow permissions**: chọn *Read and write permissions*.

Cách dùng: trên GitHub mở thư mục `inbox/` → **Add file → Upload files** → chọn file → *Commit changes*.
Xem tiến trình ở tab **Actions**; báo cáo nằm ở trang tóm tắt của lần chạy. Lưu ý:

- GitHub web chỉ cho tải file **tối đa 25 MB**. Video lớn hơn: dùng cách trên máy tính, hoặc nén trước
  (ví dụ `ffmpeg -i in.mp4 -vf scale=1280:-2 -crf 32 out.mp4`).
- Trên máy chủ GitHub không có whisper nên chỉ đọc được chữ trên slide, không chép lời giảng.
- File tải lên sẽ được gỡ khỏi repo sau khi xử lý (nhưng vẫn còn trong lịch sử git).

## Kiểm tra

```bash
npm run validate   # kiểm tra nội dung (schema, romaji, đáp án, câu gõ…)
npm test           # validate + unit test + Playwright trên Chrome, Safari (WebKit), iPhone, Android
```

Mỗi lần push lên `main`, GitHub Actions tự chạy kiểm tra rồi mới deploy lên GitHub Pages.
Lần đầu: repo → **Settings → Pages → Source: GitHub Actions**.

## Cấu trúc

- `content/lessons/bai-N.json` — nội dung từng bài · `content/so-dem.json` — số đếm và đơn vị đếm ·
  `content/tu-muon.json`, `content/de-nham.json`
- `src/` — code giao diện (Vite + TypeScript + Preact) · `scripts/` — kiểm tra, gộp nội dung, xử lý inbox
- `tests/` — unit test (vitest) và e2e (Playwright) · `CLAUDE.md` — quy ước cho Claude
