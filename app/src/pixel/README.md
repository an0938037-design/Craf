# `pixel/` — phép toán điểm ảnh

## Owns
- `mask.js` — adapter canvas ↔ `Uint8Array`: `maskFromCanvas`, `maskToCanvas`, `maskFromPolygon`, `maskFromLayerAlpha`, `maskFromWand`, `maskTranslate`, `maskExtract`, `compositeSample`.
- `wand.js` — `wandMask(doc, x, y, tol)`: composite cả doc rồi region-grow (port `maskFromWand` của `app.js`).
- `fill.js` — `floodFillLayer(ctx, w, h, x, y, fillHex, tol, selData)`: flood fill có cổng vùng chọn.
- `stroke.js` — `strokePath`, `fillPath`, `clearPath`: viền/tô/xoá theo `Path2D` + tham số.
- `ops.js` — `cropCanvas(canvas, rect)`; các phép resize/flip/rotate sẽ chuyển tiếp ở P3-2.

Chưa chuyển (P3-1/P3-3/P3-5): `adjust.js` (`applyLevels`), `filters.js`, `sample.js` (`pickColor`), `encode.js` (`runExport`, `thumbData`), phần rasterize clipboard (`copySelection` đã dùng `maskExtract`; `pasteClipboard` còn 1 `drawImage` trong `app.js`).

## May use
`model`, `core`, `shared`

## Must not
- `ui`, `render`, `platform`, viewport, trạng thái tool.
- Đọc `state` — mọi thứ đi qua tham số.
- Tự đổi layer đang chọn (nhận canvas + tham số, trả canvas mới).

## Đã nhận từ `app/app.js`
`maskFromWand` → `wandMask` (C7b), `floodFill` → `floodFillLayer` (C7b), `applyStrokeSelection` → `strokePath`, `fillSelected` → `fillPath`, `clearSelectedContent` → `clearPath` (C7b), `cropToSelection` (phần raster) → `cropCanvas` (C7b), toàn bộ adapter mask (C3).

## Cổng công khai
`pixel/index.js`
