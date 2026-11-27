# Học tiếng Nhật — Kana & từng bài

Web học tiếng Nhật sơ cấp (Hiragana, Katakana, từ vựng, ngữ pháp, số đếm theo từng bài, giáo trình kiểu Minna no Nihongo).
Chạy trên Safari iPhone, Chrome Android và máy tính; thêm được vào màn hình chính và dùng offline.

**Link web:** https://nguyenluonggiahuy318-arch.github.io/hoc-tieng-nhat/

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

Có 3 cách đưa tài liệu (video / ảnh / PDF / DOCX) lên:

- **Cách 1 — gửi ngay trên web (trang 📤 Gửi bài):** mở web → **📤 Gửi bài** → lần đầu dán *mã GitHub* (trang có hướng dẫn
  tạo mã, làm được trên điện thoại) → chọn video / ảnh / PDF → **Gửi lên**. Video được **cắt thành ảnh slide ngay trên máy**
  nên video dài cũng gửi nhanh. Tài liệu vào thư mục `inbox/` trên GitHub; sau đó:
  - đã cài xử lý tự động (mục "Xử lý tự động" bên dưới) → Claude tự cập nhật bài, web tự đổi sau khoảng 15–30 phút;
  - chưa cài → mở Claude Code (repo `hoc-tieng-nhat`) và gõ **`/cap-nhat`** — Claude lấy file từ GitHub để xử lý.
- **Cách 2 — gửi trong Claude:** mở Claude Code trên web / app điện thoại (claude.ai/code), chọn repo `hoc-tieng-nhat`
  và môi trường `hoc-tieng-nhat`, bấm 📎 đính kèm file rồi gõ **`/cap-nhat`**.
- **Cách 3 — trên máy tính:** làm theo các bước dưới đây (hợp với video rất dài, có thể chép cả lời giảng bằng whisper).

Mã GitHub của trang Gửi bài chỉ lưu trong trình duyệt của máy đó (không nằm trong file xuất tiến độ) và chỉ có quyền
với repo này. Không dùng nữa thì bấm "Xoá mã" trên trang, hoặc xoá token trên GitHub.

Cách 3, trên máy tính:

1. Bỏ video / ảnh / PDF / DOCX bài giảng vào thư mục `inbox/`.
2. Mở Claude Code trong thư mục dự án (`claude`) và gõ **`/cap-nhat`** (hoặc `/cap-nhat 4` nếu muốn nói rõ là Bài 4).
3. Claude sẽ: cắt khung hình video và đọc slide, đọc PDF/ảnh, xác định bài mấy (không chắc sẽ hỏi bạn), thêm từ vựng,
   ngữ pháp, bài tập vào `content/lessons/bai-N.json` (giữ nguyên nội dung cũ, không tạo trùng), chạy kiểm tra,
   chuyển file sang `inbox/done/`, commit và push. Web tự cập nhật sau vài phút.

File trong `inbox/` không được đưa lên GitHub (video rất nặng).
Lần đầu chạy, Claude Code sẽ hỏi quyền cho từng lệnh (`npm run …`, `git push`): chọn *Yes, and don't ask again* để các lần sau chạy liền mạch.

## Xử lý tự động (tuỳ chọn)

Workflow `.github/workflows/cap-nhat.yml`: mỗi khi có file mới trong `inbox/` (gửi từ trang 📤 Gửi bài, hoặc tải thẳng lên
GitHub), Claude tự chạy quy trình `/cap-nhat` trên máy chủ GitHub — không cần mở máy tính hay Claude. Chưa cài thì workflow chỉ
ghi nhận "đã nhận file" và bạn gõ `/cap-nhat` trong Claude để xử lý. Cài một lần:

1. **Claude GitHub App** phải được cài cho repo: vào https://github.com/apps/claude → *Configure* → chọn repo này
   (nếu bạn đã kết nối GitHub với claude.ai cho repo này thì đã có sẵn).
2. Tạo token dùng gói Claude của bạn (Pro / Max): trên máy tính đã cài Claude Code, chạy `claude setup-token`, đăng nhập,
   copy chuỗi token.
3. Trên GitHub: repo → **Settings → Secrets and variables → Actions → New repository secret**:
   tên `CLAUDE_CODE_OAUTH_TOKEN`, giá trị là token vừa copy. (Dùng API key thì đặt tên `ANTHROPIC_API_KEY`.)
4. Repo → **Settings → Actions → General → Workflow permissions**: chọn *Read and write permissions*.

Gửi file: dùng trang **📤 Gửi bài** của web (khuyên dùng), hoặc trên GitHub mở thư mục `inbox/` → **Add file → Upload files**.
Xem tiến trình ở trang Gửi bài (mục Trạng thái) hoặc tab **Actions** của repo. Lưu ý:

- Tải thẳng lên GitHub web chỉ được file **tối đa 25 MB**; trang Gửi bài thì cắt video thành ảnh trước nên không bị giới hạn
  này (PDF / ảnh tối đa 50 MB).
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
