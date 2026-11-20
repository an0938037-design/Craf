# `platform/` — cầu nối trình duyệt

## Owns
Mọi lời gọi API trình duyệt dùng chung: `$`, `$$`, `dpr()`, `loadImage()`, clipboard, File/Blob, `requestAnimationFrame` bọc lại.

## May use
Không import section nào.

## Must not
- Biết khái niệm domain Craf: `doc`, `layer`, `mask`, `selection`.
- Chứa logic hình ảnh.

## Nhận từ `app/app.js` (nguồn gốc lịch sử)
`$`, `$$`, `clamp` không thuộc đây; riêng `dpr` (13), `loadImage` (63-68).

## Cổng công khai
`platform/index.js`
