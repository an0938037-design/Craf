# `pixel/` — phép toán điểm ảnh

## Owns
- `mask.js` — adapter canvas ↔ `Uint8Array`: `maskFromCanvas`, `maskToCanvas`, `maskFromPolygon`, `maskFromLayerAlpha`, `maskFromWand`, `maskTranslate`, `maskExtract`, `compositeSample`.
- `wand.js` — `wandMask(doc, x, y, tol)`: composite cả doc rồi region-grow (port `maskFromWand` từ `app/app.js`, nguồn gốc lịch sử).
- `fill.js` — `floodFillLayer(ctx, w, h, x, y, fillHex, tol, selData)`: flood fill có cổng vùng chọn.
- `stroke.js` — `strokePath`, `fillPath`, `clearPath`: viền/tô/xoá theo `Path2D` + tham số.
- `layers.js` — `createLayer`, `copyCanvas`, `replaceLayerImage`, `mergeLayerInto`, `flattenLayers` (canvas của layer).
- `ops.js` — `cropCanvas(canvas, rect)`; các phép resize/flip/rotate chưa tách hẳn (P3-2) và phần điều phối đụng `doc`/history nằm ở `shell/boot.js`.
- `adjust.js` — `adjustFilter`, `applyLevels`, `convolveCanvas`, `filterCanvas`, `paintClippedOver` (P3-4).
- `sample.js` — `sampleHex(canvas, x, y)` cho công cụ lấy màu (P3-5).
- `encode.js` — `pngDataURL`, `jpegDataURL`: một chỗ duy nhất quyết định định dạng ảnh lưu/thumbnail (P3-5).
- `brush.js` — `stampBrush`, `paintSegment` (P4-2): con dấu cọ mềm + nối đoạn.
- `gradient.js` — `gradientPaint(ctx, d, o)` (P4-3): tô tuyến tính/toả tròn, có `clipPath`.
- `shape.js` — `shapeGeometry(d, tool)`, `shapePath`, `paintShape(ctx, d, o)` (P4-3).
- `move.js` — `pickSelection(layer, sel, doc)`, `moveLayer(layer, d, o)` (P4-4).
- `text.js` — `drawText(ctx, text, pt, o)` (P4-6).

Chưa chuyển: phần rasterize clipboard (điều phối `pasteClipboard`, gồm bước `drawImage`) hiện nằm ở `shell/boot.js`.

## May use
`model`, `core`, `shared`

## Must not
- `ui`, `render`, `platform`, viewport, trạng thái tool.
- Đọc `state` — mọi thứ đi qua tham số.
- Tự đổi layer đang chọn (nhận canvas + tham số, trả canvas mới).

## Đã nhận từ `app/app.js` (nguồn gốc lịch sử)
`maskFromWand` → `wandMask` (C7b), `floodFill` → `floodFillLayer` (C7b), `applyStrokeSelection` → `strokePath`, `fillSelected` → `fillPath`, `clearSelectedContent` → `clearPath` (C7b), `cropToSelection` (phần raster) → `cropCanvas` (C7b), toàn bộ adapter mask (C3).

## Cổng công khai
`pixel/index.js`
