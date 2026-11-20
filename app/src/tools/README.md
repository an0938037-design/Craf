# `tools/` — máy trạng thái con trỏ

## Owns
- `marquee.js` — `begin`, `drag`, `preview`, `commit`: gesture marquee/lasso, commit gọi `selection.apply`.
- `wand.js` — `selectAt(doc, x, y, tol, mode)`: mask từ `pixel` rồi `selection.apply`.
- `index.js` — `configure({ bus })`, `notify(channel, payload)` và cổng export.
- Còn ở `app/app.js` (P4-2/P4-3): brush, move, gradient, shape, text, fill, picker, pan + registry UI.

## May use
`model`, `core`, `pixel`, `platform`, `shared`

## Must not
- **Import `ui` — cấm tuyệt đối.** Cần panel cập nhật thì `bus.emit('ui:refresh', ...)` qua `notify`.
- Import `shell` (bus được **tiêm** qua `configure({ bus })`).
- Vẽ chrome ngoài overlay sân khấu.
- Giữ state toàn cục ngoài phiên kéo hiện tại.

## Đã nhận từ `app/app.js` (C8)
`beginMarquee` → `beginMarquee`, `syncMarqueePreview` → `previewMarquee`, `finishMarquee` → `commitMarquee`, `wandSelect` → `wandSelectAt`. App chỉ còn 3 mối nối: tạo gesture trong `beginDraw`, cập nhật trong `moveDraw`, commit trong `endDraw` — kèm `adoptSelection()` đồng bộ UI/ants.

## Cổng công khai
`tools/index.js`
