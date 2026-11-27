# CLAUDE.md — quy ước của dự án

Web học tiếng Nhật sơ cấp cho một sinh viên Việt Nam (giáo trình kiểu Minna no Nihongo, trung tâm Nhật ngữ Sakae).
Web tĩnh: Vite + TypeScript + Preact (+ @preact/signals), PWA, deploy lên GitHub Pages bằng GitHub Actions khi push lên `main`.

## Ngôn ngữ

- Toàn bộ giao diện, giải thích, thông báo lỗi, báo cáo cho người dùng, commit message: **tiếng Việt**.
- Chữ Nhật trong nội dung viết bằng **kana** (Hiragana / Katakana). Chưa dùng Kanji (người học chưa học).

## Cấu trúc

```
content/lessons/bai-N.json   nội dung từng bài (từ vựng, ngữ pháp, bài tập) — code KHÔNG hard-code từ vựng
content/so-dem.json          số đếm: quy tắc biến âm của từng đơn vị đếm (tuổi, tầng, quận, giá…) + các trang
content/tu-muon.json         từ mượn Katakana
content/de-nham.json         chữ dễ nhầm & quy tắc (riêng Hiragana / Katakana)
src/lib/                     logic thuần: kana, romaji, numbers, schema (zod), checks, practice, storage, speech
src/views/                   các màn hình;  src/components/ thành phần dùng chung;  src/state.ts trạng thái chung
scripts/                     validate, merge (gộp nội dung), stats, inbox/scan + inbox/done (xử lý tài liệu)
tests/unit/                  vitest;  tests/e2e/ Playwright (Chrome, Safari/WebKit, iPhone 13, Pixel 7)
inbox/                       tài liệu bài giảng mới (không commit);  .claude/commands/cap-nhat.md lệnh /cap-nhat
```

## Định dạng `content/lessons/bai-N.json`

Schema đầy đủ: `src/lib/schema.ts` (`LessonSchema`). Tên file phải khớp `"lesson"`.

```json
{
  "lesson": 3, "title": "だい３か",
  "sources": ["NGU_PHAP_BAI_3.pdf", "文法第3課_NPbai3.mp4"],
  "notes": { "vocab": "mẹo dưới bảng từ (HTML ngắn)", "vocabSource": "từ vựng lấy từ đâu", "grammarSource": "ngữ pháp lấy từ đâu" },
  "vocab": [ { "group": "Nơi chốn", "items": [ { "jp": "きょうしつ", "romaji": "kyōshitsu", "phienam": "Kyôôshitsư", "vi": "Phòng học" } ] } ],
  "grammar": [ { "pattern": "ここ / そこ / あそこ は ばしょ です", "meaning": "…", "explain": "HTML ngắn", "note": "lỗi hay gặp (tuỳ chọn)",
                 "source": "pdf", "examples": [ { "jp": "ここは きょうしつです。", "romaji": "Koko wa kyōshitsu desu.", "vi": "Chỗ này là phòng học." } ] } ],
  "fill":  [ { "q": "＿＿は きょうしつです。", "options": ["ここ","これ","この","あそこ"], "answer": "ここ", "vi": "…", "why": "…" } ],
  "order": [ { "vi": "Chỗ này là phòng học.", "words": ["ここ","は","きょうしつ","です"] } ],
  "corrections": [ "PDF ghi 'なしょ' → sửa thành 'ばしょ'" ],
  "selfIntro": { "countries": [...], "jobs": [...] }
}
```

- `selfIntro` (tuỳ chọn) bật chế độ "Tự giới thiệu" (hiện chỉ Bài 1 có).
- `fill.q` có đúng một `＿＿`; `options` 2–4 lựa chọn (phím tắt 1–4) và phải chứa `answer`.
- `order.words`: mỗi phần tử là một chip; trợ từ tách riêng; "じゃ ありません" là 1 chip; dấu phẩy dính chip trước
  ("いいえ、", "か、"); không ghi dấu 。 (app tự thêm). Các chip giống nhau được đổi chỗ cho nhau.
- HTML trong `explain`, `note`, `why`, `notes.*`, `so-dem.json`, `de-nham.json` chỉ dùng: b i u em strong br small span code a
  table thead tbody tr th td sup sub ruby rt ul ol li p; thuộc tính class, href (`#trang` hoặc https://), colspan, rowspan.
  Liên kết trong app dùng hash: `#so-dem`, `#tu-vung`, `#ngu-phap`…

## Romaji và phiên âm

- `romaji` = Hepburn chuẩn, có dấu trường âm: ō ū ā ē ī (きょうしつ → kyōshitsu, コーヒー → kōhī); "ei", "ii" giữ nguyên
  (せんせい → sensei); ん trước nguyên âm / y viết `n'`; っ gấp đôi phụ âm (がっこう → gakkō, まっちゃ → matcha).
- Romaji của **từ vựng** là cách đọc của chính từ đó. Romaji của **câu ví dụ** viết theo cách đọc: trợ từ は → wa,
  を → o, へ → e; chữ đầu câu và tên riêng viết hoa (Yamada-san, Mirā-san).
- `npm run validate` so romaji với kana (bỏ qua mục có chữ Latin như CD, FPT): sai chữ là **lỗi**.
- `phienam` = phiên âm kiểu Việt, **chép nguyên văn từ tài liệu của lớp** (ví dụ "Kyôôshitsư"). Tài liệu không có thì để `""`;
  không tự bịa phiên âm.

## Nguồn (`grammar[].source`)

- `"video"`, `"pdf"`, `"anh"` (ảnh), `"docx"` — lấy từ tài liệu người dùng gửi; có thể là mảng `["pdf", "video"]`.
- `"minna"` — **bổ sung theo giáo trình Minna no Nihongo** vì tài liệu thiếu. App hiện nhãn "📘 theo Minna".
- Lỗi chính tả rõ ràng trong tài liệu: sửa trong dữ liệu và ghi vào `corrections`.

## Số đếm (`content/so-dem.json`)

Mỗi đơn vị đếm: `suffix` (さい, かい…), `digit` (cách đọc đặc biệt khi chữ số hàng đơn vị là 1–9, đã gồm đơn vị:
`{"1": "いっかい"}`), `ten` (số tròn chục: "じゅっかい"), `special` (cả số: `{"20": "はたち"}`), `table` (các số hiện trong bảng),
`quiz` (có trong Luyện tập). `pages` gom các đơn vị thành tab. Quy tắc đọc nằm trong `src/lib/numbers.ts` — thêm đơn vị mới
chỉ cần sửa JSON (và thêm test cách đọc trong `tests/unit/numbers.test.ts`).

## Không phá dữ liệu bài cũ

- Thêm nội dung mới bằng `npm run merge -- <nháp.json>`: chỉ thêm mục mới, bỏ mục trùng, kiểm tra trước khi ghi.
- Không xoá từ / mẫu / bài tập đã có. Sửa mục sai thì sửa tại chỗ và ghi `corrections`.
- Không đổi tên khoá localStorage (tiền tố `hn.`) — sẽ mất tiến độ của người học. Mọi truy cập localStorage đi qua
  `src/lib/storage.ts` (có try/catch).

## Quy tắc code

- `speak()` (src/lib/speech.ts) chỉ được gọi **trực tiếp trong hàm xử lý sự kiện bấm / phím** — iOS chặn phát âm trong
  setTimeout, Promise, useEffect. Test e2e kiểm tra điều này.
- App chỉ dùng `import type` từ `src/lib/schema.ts` (không đưa zod vào bundle).
- Sự kiện composition (IME) phải gắn bằng `addEventListener` (Preact không map `onCompositionStart`).
- Phím tắt: `useHotkeys` (1–4 chọn đáp án, Enter câu tiếp, Space lật thẻ).
- Giao diện mobile-first; ô nhập chữ cỡ ≥ 16px (Safari iPhone không tự phóng to).

## Lệnh

```bash
npm run dev            # chạy thử ở http://localhost:5173
npm run validate       # kiểm tra content/
npm test               # validate + unit + e2e (Playwright: chromium, webkit, iphone, android)
npm run test:unit      # vitest
npm run test:e2e:fast  # e2e chỉ trên Chromium
npm run build          # build ra dist/ (BASE_PATH=/ten-repo/ khi deploy)
npm run stats          # thống kê từng bài + link web
npm run inbox:scan     # xử lý file trong inbox/ (xem /cap-nhat)
npm run merge -- f.json [--dry-run]
npm run inbox:done     # chuyển file đã xử lý sang inbox/done/
```

Trình duyệt cho Playwright: `npx playwright install chromium webkit` (Linux thêm `--with-deps`).

## Deploy

Push lên `main` → `.github/workflows/deploy.yml`: validate + unit + e2e rồi build và deploy GitHub Pages.
Workflow tuỳ chọn `.github/workflows/cap-nhat.yml`: tải file vào `inbox/` trên GitHub → Claude Code (claude-code-action)
chạy quy trình /cap-nhat ở chế độ CI (`CAP_NHAT_CI=1`: không hỏi, không tự commit) → workflow commit, push, deploy.
