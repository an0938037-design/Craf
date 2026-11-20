# `render/` — vẽ lên canvas

## Owns
- `compositor.js` — `compositeCanvas` (ghép layer stack), `updateLayerThumb`.
- `viewport.js` — `applyView`, `fit`, `setZoom`, `startPan`, `moveRing`.
- `rulers.js` — `drawRulers`, `niceStep`.
- `overlay.js` — `drawAnts`, `requestAnts`, `startAnts`, `previewGeometry`, `selPreviewPath`, `clearOverlay`, `syncMarqueePreview`, `previewGradient`, `previewShape`.

## May use
`model`, `core`, `shared`, `platform`

## Must not
- Mutate doc/history.
- Pixel filter (đó là `pixel`).
- Chạm panel DOM (`ui`).
- Import `pixel`.

## Nhận từ `app/app.js`
`compositeCanvas` (1644), `updateLayerThumb` (1131), `applyView` (420), `fit` (816), `setZoom` (830), `startPan` (2480), `moveRing` (2532), `drawRulers` (846), `niceStep` (938), `drawAnts` (747), `requestAnts` (711), `startAnts` (802), `previewGeometry` (716), `selPreviewPath` (730), `clearOverlay` (468), `syncMarqueePreview` (2137), `previewGradient` (2278), `previewShape` (2351).

## Cổng công khai
`render/index.js`
