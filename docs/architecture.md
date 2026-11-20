# Kiến trúc Craf

> Trạng thái: **đã tách xong**. Mọi nghiệp vụ nằm trong 9 section; `app/app.js` đã xoá ở P5-8.

- **Entry point:** `index.html` chỉ nạp `app/src/shell/index.js`.
- **Composition root:** `shell/boot.js` (boot/bind/configure, điều phối drawing/pointer/doc lifecycle), được `shell/index.js` nạp.

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
| `ui` | 7 | Panel, menubar, modal, toast, poster hero | `ui/index.js` |
| `shell` | 8 | Boot/composition root, keymap, command, storage | `shell/index.js` |

## Luật phụ thuộc

```
platform, shared  →  core  →  model  →  {pixel, render}  →  tools  →  ui  →  shell
```

- Một section chỉ import section có **rank thấp hơn**.
- `pixel` và `render` là hai nhánh song song: **cấm** import nhau.
- `tools` ⇄ `ui`: **cấm** import nhau. Giao tiếp qua `shared/emitter` (instance do `shell` tạo và tiêm).
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
