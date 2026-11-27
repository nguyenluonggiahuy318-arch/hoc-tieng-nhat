---
description: Đọc video / ảnh / PDF / DOCX bài giảng trong inbox/, cập nhật bài học, kiểm tra rồi deploy
argument-hint: "[số bài — tuỳ chọn, ví dụ 4]"
---

# /cap-nhat — cập nhật bài học từ tài liệu trong `inbox/`

Bạn đang cập nhật web học tiếng Nhật của một sinh viên Việt Nam (giáo trình kiểu Minna no Nihongo, trung tâm Sakae).
Đọc `CLAUDE.md` trước: mọi quy ước về định dạng JSON, romaji, phiên âm, nguồn và an toàn dữ liệu nằm ở đó.
Toàn bộ nội dung và báo cáo viết bằng **tiếng Việt**.

Số bài người dùng chỉ định (có thể trống): `$ARGUMENTS`

**Chế độ CI**: nếu biến môi trường `CAP_NHAT_CI=1` (chạy trong GitHub Actions) thì: không hỏi lại người dùng,
**không commit / không push** (workflow tự làm), và ghi báo cáo cuối vào `inbox/.work/bao-cao.md`.
Kiểm tra bằng `echo "$CAP_NHAT_CI"`.

## 1. Tìm file mới và trích nội dung

**File gửi kèm trong tin nhắn** (dùng Claude Code trên web / điện thoại): nếu tin nhắn có file đính kèm
(đường dẫn dạng `/root/.claude/uploads/…`), chép **tất cả** vào `inbox/` trước, giữ nguyên tên file:
`cp "<đường dẫn file>" inbox/`. Không bao giờ commit file trong `inbox/`.

```bash
npm run inbox:scan
```

- Nếu báo "Không có file mới" → nói cho người dùng biết rồi dừng.
- Video dài (> 40 phút) có thể chạy `npm run inbox:scan -- --interval 15`; muốn nhanh thì thêm `--no-whisper`.
- Script tự: cắt 1 khung mỗi 8–15 giây bằng ffmpeg, bỏ khung gần giống nhau (so độ khác ảnh), ghép
  thành ảnh lưới `inbox/.work/<file>/luoi-XX.jpg` (4 khung/ảnh, có số thứ tự + thời điểm), lưu từng slide
  ở `slides/`; chép lời giảng nếu máy có `whisper`; PDF → `pdftotext -layout`, PDF scan → ảnh từng trang;
  DOCX → chữ + ảnh nhúng. Đọc phần "Kết quả quét" để biết cần mở file nào.
- Nếu thiếu công cụ (ffmpeg, pdftotext) script sẽ báo; hướng dẫn người dùng cài (xem README) hoặc đọc
  thẳng PDF bằng công cụ Read (tham số `pages`).

## 2. Đọc tài liệu

- Mở **mọi** ảnh lưới bằng Read. Chữ trên lưới nhỏ / mờ → mở ảnh slide riêng trong `slides/`.
- Đọc mọi file chữ (`van-ban.txt`, `loi-giang.txt`). PDF scan → đọc ảnh trang (hoặc Read thẳng file PDF).
- Ảnh gốc (.png/.jpg) → Read trực tiếp.
- Ghi lại: bảng từ vựng (kana, phiên âm kiểu Việt, nghĩa), mẫu ngữ pháp + ví dụ, số đếm / đơn vị đếm,
  lỗi chính tả rõ ràng trong tài liệu.
- Nếu **không có whisper**: nói rõ trong báo cáo là chỉ lấy được nội dung trên slide, không có lời giảng.

## 3. Xác định bài mấy

- Ưu tiên `$ARGUMENTS` nếu có. Sau đó dựa vào tiêu đề trong tài liệu: だい３か, 第3課, Bài 3, BAI_3…
  (script đã in "Đoán số bài").
- Không chắc (không có dấu hiệu, hoặc các file chỉ ra số bài khác nhau mà không rõ lý do) → **hỏi người dùng**
  (dùng công cụ hỏi lựa chọn). Ở chế độ CI: không đoán bừa — dừng lại, ghi lý do vào báo cáo.
- Tài liệu chứa nhiều bài → xử lý từng bài riêng.

## 4. Soạn nội dung MỚI vào file nháp

Đọc `content/lessons/bai-N.json` hiện có (nếu có) để biết đã có gì, dùng lại tên nhóm từ cũ khi phù hợp.
Viết **chỉ phần mới** vào `inbox/.work/nhap-bai-N.json` (cùng định dạng bai-N.json, xem CLAUDE.md):

- **Từ vựng**: chép đúng kana trong tài liệu. `phienam` giữ **nguyên văn** như tài liệu (kiểu Việt:
  "Kyôôshitsư"); tài liệu không có thì để `""`, không tự bịa. `romaji` viết Hepburn chuẩn (ō ū ā ē ī; ei, ii
  giữ nguyên; ん trước nguyên âm/y viết n'). `vi` là nghĩa tiếng Việt ngắn gọn.
- **Ngữ pháp**: lấy đúng mẫu câu và ví dụ trong tài liệu. `explain` là HTML ngắn (chỉ các thẻ trong
  CLAUDE.md, có thể kèm `<table class="ktable">`), `note` là lỗi hay gặp. Ghi `source` theo nơi lấy:
  `"video"`, `"pdf"`, `"anh"`, `"docx"` (có thể là mảng). Romaji của ví dụ viết theo cách đọc (trợ từ は → wa,
  を → o, へ → e), tên riêng viết hoa ("Yamada-san").
- **Bổ sung theo Minna**: so với các mẫu ngữ pháp chính của Minna no Nihongo bài N; phần quan trọng mà tài
  liệu thiếu thì thêm và đánh dấu `"source": "minna"`. Không thêm những gì không chắc chắn.
- **Bài tập tự soạn**: thêm 10–20 câu `fill` và 8–15 câu `order` (tính cả số đã có, đừng vượt quá nhiều),
  ưu tiên lỗi hay gặp (nhầm trợ từ, こ/そ/あ, biến âm số đếm…). Mỗi câu `fill` có đúng một `＿＿`, 4 lựa chọn
  có chứa đáp án, `vi` là nghĩa câu, `why` giải thích. Câu `order`: mỗi chip là một từ / trợ từ, giữ
  "じゃ ありません" thành 1 chip, dấu phẩy dính vào chip trước ("いいえ、"), không có dấu 。.
  Chỉ dùng từ đã học (bài N và các bài trước).
- **Sửa lỗi tài liệu**: lỗi chính tả rõ ràng thì sửa trong dữ liệu và ghi vào `corrections`, dạng
  `"PDF ghi 'なしょ' → sửa thành 'ばしょ'"`.
- **Số đếm**: đơn vị đếm mới (giờ じ, phút ふん, tháng がつ, ngày…) → thêm vào `counters` (+ `pages`) trong file
  nháp theo định dạng `content/so-dem.json` (`digit`, `ten`, `special` cho các số biến âm; `quiz` nếu muốn
  có trong Luyện tập). Kiểm tra kỹ cách đọc từng số biến âm.
- `notes.vocabSource` / `notes.grammarSource`: một câu nói nội dung lấy từ đâu (bài mới chưa có thì ghi).
- `sources`: tên các file đã xử lý.

## 5. Gộp vào dữ liệu (không phá dữ liệu cũ)

```bash
npm run merge -- inbox/.work/nhap-bai-N.json --dry-run
npm run merge -- inbox/.work/nhap-bai-N.json
```

Công cụ chỉ thêm mục mới, bỏ mục trùng, và **từ chối ghi** nếu kết quả có lỗi (romaji không khớp kana,
đáp án không có trong lựa chọn, câu gõ không chấm đúng…). Đọc lỗi, sửa file nháp, chạy lại.
Không xoá mục cũ. Nếu mục cũ sai thì sửa tại chỗ trong bai-N.json và ghi vào `corrections`.

## 6. Kiểm tra

```bash
npm run validate
npm test
```

`npm test` = validate + unit test + Playwright (Chrome, Safari/WebKit, iPhone, Android). Phải qua hết:
mọi câu sắp xếp giải được, đáp án điền chỗ trống nằm trong lựa chọn, mọi từ / câu gõ theo gợi ý romaji được
chấm đúng, cách đọc số / tuổi / tầng đúng, không có lỗi JavaScript. Nếu Playwright báo thiếu trình duyệt:
`npx playwright install chromium webkit` (Linux thêm `--with-deps`). Lỗi do nội dung → sửa nội dung.
Lỗi do code → sửa code (giữ đúng quy ước trong CLAUDE.md), rồi chạy lại đến khi qua.

## 7. Dọn inbox

```bash
npm run inbox:done
```

Chuyển file đã xử lý sang `inbox/done/` (không commit — video nặng) và in "Nội dung commit gợi ý".

## 8. Commit & deploy (bỏ qua ở chế độ CI)

```bash
git add content
git status
git commit -m "Bài N: +x từ, +y mẫu ngữ pháp"   # dùng nội dung gợi ý ở bước 7
git push origin main
```

Push lên `main` → GitHub Actions tự kiểm tra và deploy lên GitHub Pages (vài phút). Push lỗi mạng thì thử lại.
Nếu có sửa code thì `git add` cả file code đó.

## 9. Báo cáo (tiếng Việt)

Cho người dùng biết (ở CI: ghi vào `inbox/.work/bao-cao.md`):
- Bài mấy; thêm được bao nhiêu từ, mẫu ngữ pháp, ví dụ, câu điền, câu sắp xếp, đơn vị đếm (`npm run stats`);
- Những lỗi tài liệu đã sửa (`corrections`);
- Phần nào bổ sung theo giáo trình Minna (`source: "minna"`);
- Video: có chép được lời giảng không (không có whisper → chỉ lấy nội dung slide);
- Những chỗ chưa chắc chắn cần người dùng xem lại;
- Link web (dòng "Link web" của `npm run stats`), nhắc là cần vài phút để GitHub Pages cập nhật.
