# `core/` — toán thuần

## Owns
- `color.js` — `hexToRgb`, `rgbToHex`, `rgbToHsl`, `hslToRgb`, `hslToHex`, `hexToHsl`.
- `geometry.js` — `shapeGeometry`, `bezierPoints`, `pointInSelection`, `selectionBounds`, phép biến đổi ma trận 2D.
- `mask.js` — mask dưới dạng `Uint8Array`: rect, polygon, chuyển vị, union/intersect/diff, đảo.
- `path.js` — `maskSegments`, `pathFromSegments` trả về **mảng lệnh**, không `Path2D`.

## May use
`shared`

## Must not
- DOM, canvas, `Path2D`, `ImageData`.
- `model`, `pixel`, trạng thái tool.
- Đọc `state`.

## Nhận từ `app/app.js`
`hexToRgb` (15), `rgbToHex` (20), `rgbToHsl` (21), `hslToRgb` (36), `hslToHex` (50), `hexToHsl` (51), `selectionBounds` (479), `maskSegments` (498), `pathFromSegments` (515), `pointInSelection` (621), `translateSelection` (628), `maskFromRect` (635), `maskFromPolygon` (643), `shapeGeometry` (2299), `bezierPoints` (2965).

## Cổng công khai
`core/index.js`
