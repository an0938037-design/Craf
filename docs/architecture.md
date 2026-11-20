# Kiến trúc Craf

> Trạng thái: **khung rỗng**. `app/app.js` (3.585 dòng, 173 hàm, 570 chỗ đọc `state.`) vẫn là monolith đang chạy. Việc chuyển code vào các section thuộc `dev-team/implementer`, không phải việc của scaffolder.

## Bản đồ section

| Section | Rank | Owns | Cổng |
|---|---|---|---|
| `platform` | 0 | API trình duyệt: DOM, dpr, loadImage, clipboard | `platform/index.js` |
| `shared` | 1 | Hàm thuần không ngữ nghĩa domain | `shared/index.js` |
| `core` | 2 | Toán: hình học, mask, màu, path | `core/index.js` |
| `model` | 3 | Doc/Layer, store, history, serialize | `model/index.js` |
| `pixel` | 4 | Levels, filter, resample, fill, wand, encode | `pixel/index.js` |
| `render` | 5 | Composite, viewport, thước, ants, preview | `render/index.js` |
| `tools` | 6 | Máy trạng thái con trỏ | `tools/index.js` |
| `ui` | 7 | Panel, menubar, modal, toast | `ui/index.js` |
| `shell` | 8 | Boot, keymap, command, bus, storage | `shell/index.js` |

## Luật phụ thuộc

```
platform, shared  →  core  →  model  →  {pixel, render}  →  tools  →  ui  →  shell
```

- Một section chỉ import section có **rank thấp hơn**.
- `pixel` và `render` là hai nhánh song song: **cấm** import nhau.
- `tools` ⇄ `ui`: **cấm** import nhau. Đi qua `shell/bus.js`.
- Không import xuyên vào file nội bộ của section khác; dùng `index.js`.

Nguồn sự thật máy đọc: `boundaries.json`. File này chỉ diễn giải — nếu lệch, `boundaries.json` thắng.

## Cổng kiểm tra

```powershell
node tools/check-boundaries.mjs
```

Exit 0 = sạch. Exit 1 = có cạnh cấm, import ngược tầng, hoặc vòng phụ thuộc. Chạy trước mỗi commit.

## Thêm section mới

1. Sửa `boundaries.json`: thêm vào `layers` đúng vị trí rank, thêm object trong `sections`.
2. Tạo `app/src/<ten>/index.js` + `README.md` theo mẫu `Owns / May use / Must not`.
3. Cập nhật bảng trong file này.
4. Chạy `node tools/check-boundaries.mjs` — phải sạch.

Không tạo section "để dành". Section rỗng không dùng là coupling vô giá trị.

## Sửa một section an toàn

1. Đo baseline: `powershell -File tools/baseline.ps1`.
2. Đổi **hợp đồng trước** (`index.js` / kiểu dữ liệu ở biên), rồi mới đổi bên trong.
3. Cập nhật consumer trong cùng commit.
4. Chạy cổng + mở app kiểm tra.
5. Đo lại baseline, so sánh.

## Ranh giới công việc

- Scaffolder: thư mục, README stub, hợp đồng rỗng, `boundaries.json`, script, baseline commit.
- Implementer: chuyển code thật, một section mỗi lần.
- Reviewer: xác nhận không có import xuyên biên và cổng vẫn fail khi cố tình thêm import cấm.
