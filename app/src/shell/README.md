# `shell/` — composition root

## Owns
- `boot.js` — composition root: `bind`, `boot`, configure mọi section, drawing engine + pointer/pan orchestration, doc lifecycle & geometry, template seed, `sendToNott`.
- `keymap.js` — `createKeyHandler`/`bindKeymap` (Escape, Ctrl+Z/Y/S/E/G/A/D/C/X/V/J/T/M, Delete, `[`/`]`, `0`, `1`, `?`, phím tắt tool, Space pan). Hành vi được **tiêm** qua deps.
- `commands.js` — `createCommands(deps)` → `runCommand`; menubar chỉ định tuyến tên command.
- `storage.js` — `fetch('/api/...')` tới `craf.py`, autosave, thumbnail, xuất ảnh.
- `index.js` — điểm vào duy nhất (`index.html` nạp file này), re-export cổng con và `import './boot.js'`.

Trạng thái HEAD: `shell/` gồm các file trên (chưa có `documents.js`/`geometry.js`). P5-9 (worktree): dự kiến tách `documents.js` + `geometry.js` khỏi `boot.js` — chưa merge, không khẳng định đã có.

## May use
Tất cả.

## Must not
- Chứa quy tắc nghiệp vụ của một tool (brush dày bao nhiêu, filter chạy ra sao).
- Toán điểm ảnh.
- Trở thành nơi chứa helper dùng chung (đó là `shared`).

## Nhận từ `app/app.js` (nguồn gốc lịch sử, nay ở `shell/boot.js`)
`boot` (3556), `showStudio` (413), `onKey` (3502), `runCommand` (3130), `bind` (3297), `bindGuides` (3185), `bindDropImport` (3220), `importFile` (1963), `setSaveState` (1630), `markDirty` (1623), `syncHistoryButtons` (1618), `openIns`/`closeIns` (3287/3292).

Đã chuyển:
- `storage.js` — `api`, `markDirty`, `setSaveState`, `saveNow`, `compositeCanvas`, `openExport`, `exportDims`, `updateExportInfo`, `runExport`, `refresh`, `refreshNott` (P5-5).
- `commands.js` — `runCommand` (P5-5). Nhận deps.
- `keymap.js` — `onKey` + keyup Space (P5-6). Nhận deps.
- `boot.js` — toàn bộ phần còn lại của `app/app.js` (P5-8): boot/bind/configure, drawing engine, pointer/pan, doc lifecycle & geometry, template seed, `sendToNott`. `app/app.js` đã xoá.

## Quy ước bus
- Không có section/file `bus.js`: `shared/emitter.js` cung cấp factory; `boot.js` tạo **một** instance rồi tiêm vào `tools.configure({ bus })`.
- `bus.dispatch('tool:size', 24)` — ui → tools (lệnh, có thể thay đổi trạng thái).
- `bus.emit('ui:refresh', 'layers')` — tools → ui (sự kiện, chỉ thông báo).
