# `tools/` — máy trạng thái con trỏ

## Owns
`brush.js`, `marquee.js`, `wand.js`, `move.js`, `gradient.js`, `shape.js`, `text.js`, `fill.js`, `picker.js`, `pan.js`, `registry.js` (`setTool`, `updateToolUI`, `syncSizeUI`, `syncOpacityUI`, `toDoc`).

## May use
`model`, `core`, `pixel`, `platform`, `shared`, `bus` (hợp đồng của composition root)

## Must not
- **Import `ui` — cấm tuyệt đối.** Cần panel cập nhật thì `bus.emit('ui:refresh', ...)`.
- Vẽ chrome ngoài overlay sân khấu.
- Giữ state toàn cục ngoài phiên kéo hiện tại.

## Nhận từ `app/app.js`
`brushWidth` (1981), `stampBrush` (1987), `paintSegment` (2002), `beginDraw` (2042), `moveDraw` (2076), `endDraw` (2107), `beginMarquee` (2146), `finishMarquee` (2158), `wandSelect` (2178), `beginMove` (2188), `dragMove` (2208), `finishMove` (2237), `beginGradient` (2245), `finishGradient` (2288), `shapePath` (2323), `paintShape` (2336), `commitShape` (2368), `openTextEditor` (2429), `positionTextEditor` (2472), `setTool` (2552), `updateToolUI` (2558), `syncSizeUI` (2591), `syncOpacityUI` (2600), `toDoc` (1972).

## Cổng công khai
`tools/index.js` + `tools/registry.js`
