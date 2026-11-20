# `pixel/` — phép toán điểm ảnh

## Owns
- `adjust.js` — `applyLevels` (black/white/gamma).
- `filters.js` — `convolveCanvas` + `filterCanvas` (blur, sharpen, noise...).
- `ops.js` — `resizeImage`, `resizeCanvas`, `cropToSelection`, `flipDoc`, `rotateDoc`, `applyLayerTransform`.
- `fill.js` — `floodFill`.
- `wand.js` — `maskFromWand` (region growing).
- `sample.js` — `pickColor` (đọc điểm ảnh).
- `encode.js` — `exportDims`, `runExport`, PNG/JPEG encode, `thumbData`.
- `stroke.js` — `applyStrokeSelection`, `fillSelected`, `clearSelectedContent`.
- `clipboard.js` — `copySelection`, `pasteClipboard` (phần rasterize).

## May use
`model`, `core`, `shared`

## Must not
- `ui`, `render`, viewport, trạng thái tool.
- Tự đổi layer đang chọn (nhận canvas + tham số, trả canvas mới).

## Nhận từ `app/app.js`
`applyLevels` (1228), `convolveCanvas` (1330), `filterCanvas` (1361), `applyFilter` (1428, phần thuật toán), `resizeImage` (2623), `resizeCanvas` (2638), `cropToSelection` (2658), `flipDoc` (2675), `rotateDoc` (2694), `applyLayerTransform` (2766), `floodFill` (2373), `maskFromWand` (656), `pickColor` (2412), `runExport` (1735), `thumbData` (1665), `applyStrokeSelection` (1895), `fillSelected` (1866), `copySelection`/`pasteClipboard` (1796/1832).

## Cổng công khai
`pixel/index.js`
