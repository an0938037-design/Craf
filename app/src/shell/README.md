# `shell/` — composition root

## Owns
- `boot.js` — `boot`, `showStudio`.
- `keymap.js` — `onKey` (Escape, Ctrl+Z/Y, Ctrl+T, phím tắt tool).
- `commands.js` — bảng `runCommand` + `bindGuides`, `bindDropImport`, `bind`.
- `bus.js` — bus command/event duy nhất nối `ui` ↔ `tools`.
- `storage.js` — `fetch('/api/...')` tới `craf.py`, danh sách `library/`, save/load.
- `index.js` — điểm vào duy nhất, được `index.html` import.

## May use
Tất cả.

## Must not
- Chứa quy tắc nghiệp vụ của một tool (brush dày bao nhiêu, filter chạy ra sao).
- Toán điểm ảnh.
- Trở thành nơi chứa helper dùng chung (đó là `shared`).

## Nhận từ `app/app.js`
`boot` (3556), `showStudio` (413), `onKey` (3502), `runCommand` (3130), `bind` (3297), `bindGuides` (3185), `bindDropImport` (3220), `importFile` (1963), `setSaveState` (1630), `markDirty` (1623), `syncHistoryButtons` (1618), `openIns`/`closeIns` (3287/3292).

## Quy ước bus
- `bus.dispatch('tool:size', 24)` — ui → tools (lệnh, có thể thay đổi trạng thái).
- `bus.emit('ui:refresh', 'layers')` — tools → ui (sự kiện, chỉ thông báo).
- Đăng ký một lần trong `boot.js`; không đăng ký rải rác.
