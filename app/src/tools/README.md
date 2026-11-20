# `tools/` — máy trạng thái con trỏ

## Owns
- `brush.js` — `begin`, `drag`, `end`, `widthFor`: 3 pha của nét cọ (dấu đầu, nối quadratic, khép thẳng).
- `marquee.js` — `begin`, `drag`, `preview`, `commit`: gesture marquee/lasso, commit gọi `selection.apply`.
- `wand.js` — `selectAt(doc, x, y, tol, mode)`.
- `move.js` — `begin`, `plan`, `apply`: tách bước tính độ dời khỏi bước vẽ lại để phía gọi chen `pushDocHistory()` đúng chỗ.
- `shape.js` — `begin`, `drag`: gesture line/rect/ellipse.
- `gradient.js` — `begin`, `drag`, `hasLength`: gesture gradient + ngưỡng commit.
- `text.js` — `FONTS`, `write(layer, text, pt, o)`: rasterize chữ (ô nhập là DOM của `ui`).
- `fill.js` — `fillAt(layer, doc, pt, o)`, `FILL_TOLERANCE = 44`.
- `picker.js` — `pickHex(canvas, clientX, clientY)`.
- `registry.js` — `setTool` (ghi `state.tool` + phát `tool:changed`), `toDoc`, và các bảng thuần `panelsFor`, `cursorFor`, `hintFor`.
- `index.js` — `configure({ bus })`, `notify` và cổng export.

## May use
`model`, `core`, `pixel`, `platform`, `shared`

## Must not
- **Import `ui` — cấm tuyệt đối.** Cần panel cập nhật thì phát `tool:changed` (hoặc `notify`) lên bus đã tiêm.
- Import `shell` (bus được **tiêm** qua `configure({ bus })`).
- Tự vẽ chrome ngoài overlay sân khấu.
- Giữ state toàn cục ngoài phiên kéo hiện tại.

## Đã nhận từ `app/app.js`
C8: `beginMarquee`, `syncMarqueePreview` → `previewMarquee`, `finishMarquee` → `commitMarquee`, `wandSelect` → `wandSelectAt`.
P4-5: `stampBrush`/`paintSegment` (phần điểm ảnh ở `pixel/brush.js`) + `beginDraw`/`moveDraw`/`endDraw` của cọ → `tools/brush.js`.
P4-6: `gradientPaint`/`shapeGeometry`/`shapePath`/`paintShape` → `pixel/`; gesture move/shape/gradient, `FONTS` + rasterize chữ, `floodFill`, `pickColor`, `toDoc`, bảng `cursors`/`hints`/`showFill` → các file trên.

`app.js` còn giữ phần **điều phối**: chọn layer, `push*History`, `render()`, `updateLayerThumb()`, `markDirty()`, `toast()` — những thứ này chuyển sang `shell`/`ui` ở giai đoạn 5.

## Cổng công khai
`tools/index.js`
