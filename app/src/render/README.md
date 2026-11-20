# `render/` — vẽ lên canvas

## Owns
- `compositor.js` — `paintDoc` (composite lên canvas sân khấu), `compositeDoc` (ra canvas mới ở `w×h`), `drawLayerThumb` (ô thumbnail 76px).
- `viewport.js` — `configure`, `renderDoc`, `applyView`, `fit`, `setZoom`, `startPan`, `dragPan`, `endPan`, `moveRing`, `hideRing`, `showRing`.
- `rulers.js` — `drawRulers`, `niceStep`.
- `overlay.js` — `drawAnts`, `requestAnts`, `startAnts`, `selPreviewPath`, `clearOverlay`.
- `selectionPath.js` — cache `Path2D` của vùng chọn, khoá theo `sel.rev`.

## May use
`model`, `core`, `shared`, `platform`

## Must not
- Mutate doc/history.
- Pixel filter (đó là `pixel`).
- Chạm panel DOM (`ui`).
- Import `pixel`.

## Nhận từ `app/app.js` (nguồn gốc lịch sử, P3-1…P3-3)
`compositeCanvas`/`updateLayerThumb` → `compositor.js`; `applyView`/`fit`/`setZoom`/`startPan`/`dragPan`/`endPan`/`moveRing` → `viewport.js`; `drawRulers`/`niceStep` → `rulers.js`.

`viewport.configure({...})` được `shell/boot.js` gọi một lần lúc khởi tạo, truyền các element sân khấu (`area`, `board`, `holder`, `paper`, `overlay`, `ants`, `stage`, `brushRing`, `zoomLabel`) và `afterView` (đặt lại vị trí ô text). `render` không tự query panel.

## Cổng công khai
`render/index.js`
