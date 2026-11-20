# `model/` — dữ liệu và bất biến

## Owns
- `store.js` — `state` + `get/set/subscribe` (facade P2-1, thay dần 570 chỗ đọc `state.` trực tiếp).
- `doc.js` — `sheetSize`, `activeLayer`, `uniqueProjectName`, `newDocData`, `activate` (P2-2).
- `layers.js` — `layerMeta` (metadata thuần; canvas nằm ở `pixel/layers.js`) (P2-3).
- `history.js` — `snapshotDoc`, `pushDocHistory`, `pushLayerHistory`, `pushLayerSnapshot`, `syncHistoryButtons`.
- `serialize.js` — đọc/ghi `.craf` JSON, version field.
- `presets.js` — `PRESETS`, `CRAF_SWATCHES`, `TEMPLATES` (dữ liệu, không render).

## May use
`core`, `shared`

## Must not
- DOM, `document`, `$`.
- Phép toán điểm ảnh (đó là `pixel`).
- `render`, `tools`, `ui`.
- Tự gọi `render()` sau khi đổi dữ liệu — phát sự kiện, để `shell`/`render` quyết định.

## Nhận từ `app/app.js` (nguồn gốc lịch sử)
`state` (96-121), `sheetSize` (122), `makeCanvas` (302), `newLayer` (308), `copyCanvas` (313), `replaceLayerImage` (319), `uniqueName` (325), `createProject` (332), `openDoc` (347), `activeLayer` (397), `snapshotDoc` (1522), `pushDocHistory` (1534), `pushLayerHistory` (1542), `pushLayerSnapshot` (1551), `mergeDown`→`mergeAll` (1085-1130), `PRESETS` (85), `CRAF_SWATCHES` (91), `TEMPLATES` (215).

## Cổng công khai
`model/index.js`
