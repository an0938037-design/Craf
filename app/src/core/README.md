# `core/` — toán thuần

## Owns
- `color.js` — `hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `hslToHex`, `hexToHsl`.
- `geometry.js` — `shapeGeometry`, `previewGeometry`, `bezierPoints` (hình học con trỏ).
- `mask.js` — mask dưới dạng `Uint8Array`: tạo, rect, bounds, pick, merge (Porter-Duff), đảo, dịch nguyên.
- `path.js` — `maskSegments`, `segmentsToCommands` trả về **mảng lệnh**, không `Path2D`.

## May use
`shared`

## Must not
- DOM, canvas, `Path2D`, `ImageData`.
- `model`, `pixel`, trạng thái tool.
- Đọc `state`.

## Nhận từ `app/app.js` (nguồn gốc lịch sử)
`hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `hslToHex`, `hexToHsl`; `shapeGeometry`, `previewGeometry`, `bezierPoints`; `maskCreate`, `maskAll`, `maskFromRect`, `maskBounds`, `maskPick`, `maskMerge`, `maskInvert`, `maskShiftInt`; `maskSegments`, `segmentsToCommands`.

`pointInSelection`, `translateSelection`, `maskFromRect`/`maskFromPolygon` (adapter canvas) và phần nối dây còn lại nay ở `shell/boot.js` (app/app.js đã xoá; xem trạng thái giai đoạn để biết chi tiết lịch sử).

## Cổng công khai
`core/index.js`
