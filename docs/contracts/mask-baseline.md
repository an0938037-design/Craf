# Baseline C0 — vùng chọn trước khi đổi biểu diễn

Đo theo yêu cầu **C0** trong `docs/contracts/mask.md`. Mục đích: có số "trước" để chứng minh C4/C5/C6 không làm chậm và không đổi hình học.

- Ngày đo: 2026-11-20
- Commit khi đo: `810778c` (app.js 3.526 dòng, sau giai đoạn 1)
- Doc: **1080×1350** (preset Poster)
- Môi trường: Chromium của OpenCode desktop, `devicePixelRatio = 1.25`, zoom hiển thị **31,5%** (`scale = 0.315` CSS px / doc px)

## Phương pháp

1. Bọc `CanvasRenderingContext2D.prototype.getImageData`, đếm riêng các lần gọi có `w*h >= 1080*1350` = **readback toàn khung**.
2. Mỗi thao tác đo `performance.now()` từ lúc phát `pointerup` đến callback `requestAnimationFrame` kế tiếp (thời điểm app vẽ xong frame đó).
3. Mỗi thao tác chạy **3 lượt**, ghi **trung vị**; lượt đầu thường cao do warm-up nên vẫn ghi lại trong `samplesMs`.
4. Thao tác phát bằng `PointerEvent` thật (`pointerdown/move/up`, `pointerId` riêng từng gesture), toạ độ tính từ `getBoundingClientRect()` của `#paper`.
5. Marquee 300×400 **doc px** ⇒ 94,5×126 CSS px ở scale 0.315.

## Kết quả

| Thao tác | Trung vị | 3 mẫu (ms) | Readback toàn khung | Ghi chú |
|---|---|---|---|---|
| Marquee 300×400 | **30,6 ms** | 73,6 · 30,5 · 30,6 | **2** | mẫu 73,6 là warm-up |
| Marquee + Shift (add) | **36,4 ms** | 36,4 · 26,9 · 43,7 | **2** | |
| Lasso 40 điểm | **30,0 ms** | 30,0 · 34,4 · 24,3 | **2** | |
| Wand, tol = 32 | **121,0 ms** | 108,6 · 122,0 · 121,0 | **3** | gồm 1 lần composite + 2 readback mask |
| Move 100 px | **15,7 ms** | 74,8 · 14,9 · 15,7 | **2** | mẫu 74,8 là warm-up |
| Pixel ants (rect 300×400 chuẩn) | **1.414 px** | — | — | đếm `alpha > 0` trên `#ants` |

Tổng số lần gọi `getImageData` cho cả phiên đo: 15.

Phù hợp với phân tích trong hợp đồng: hôm nay **mỗi** thao tác chọn đọc lại toàn khung **2 lần** (bounds + segments), wand **3 lần** (thêm composite).

## Ngưỡng cho C4/C6 (chép vào PR)

| Tiêu chí | Ngưỡng |
|---|---|
| Marquee 300×400 | ≤ **33,7 ms** (không quá C0 +10%) và readback toàn khung = **0** |
| Marquee + Shift | ≤ **40,0 ms** và readback = **0** |
| Lasso 40 điểm | ≤ **60 ms** và readback **≤ 1** |
| Wand tol 32 | ≤ **133 ms** và readback **≤ 1** |
| Move 100 px | ≤ **17,3 ms** và readback **≤ 1** |
| Pixel ants (cùng rect, cùng zoom) | **= 1.414**, sai lệch 0 |

Nếu C4 vượt ngưỡng: tối ưu **bên trong** `core.maskSegments` (duyệt theo dòng, bỏ closure `inside`), **không** đổi chữ ký và không đổi thứ tự cạnh.

## Cảnh báo về cách đọc số

- Đây là số **trên máy này, ở zoom 31,5%**. Đổi zoom ⇒ đổi số pixel canvas ⇒ đổi thời gian vẽ ants. Chỉ so khi giữ nguyên zoom và kích thước vùng chọn.
- `performance.now()` → rAF gồm cả thời gian chờ frame, nên là **cận trên** của công việc thật; dùng để so trước/sau, không dùng như benchmark tuyệt đối.
- `wand` phụ thuộc nội dung ảnh tại điểm click. Baseline này click đúng tâm poster mẫu; đổi nội dung ⇒ đổi số đo.
- Pixel ants phụ thuộc pha nhấp nháy (ants chạy 95 ms/frame). Đếm sau 250 ms nên có thể lệch ±1 frame viền; nếu C6 ra 1.410–1.418 thì kiểm lại bằng cách đếm 3 lần lấy trung vị, đừng kết luận ngay là hỏng.

## Đo C4 — so sánh cùng phiên (2026-11-20)

Số C0 ở trên đo lúc tab đang hiển thị bình thường. Về sau, khi cửa sổ bị thu nhỏ/che khuất, Chromium hạ ưu tiên tab: một vòng lặp 50 triệu phép tính từ ~120 ms tăng lên **672 ms** (~5,6×). Vì vậy **không so số tuyệt đối với bảng C0** khi môi trường đổi — phải so **code cũ và code mới trong cùng một phiên**, cùng tab, cùng doc.

Cách đo đối chứng: dựng lại nguyên văn pipeline cũ (canvas RGBA → `getImageData` ×2 → quét alpha ×2 → `Path2D`) trong trang, chạy cạnh pipeline mới trên cùng mask lasso 40 điểm, mỗi bên 5 lượt lấy trung vị.

| Phép | Code cũ | Code mới (C4, lazy `sel.mask`) | Kết luận |
|---|---|---|---|
| Lasso 40 điểm, toàn pipeline chọn | **96,7 ms** | **68,5 ms** | mới nhanh hơn **29%** |
| `maskFromWand` (cùng `ImageData`) | 29,0 ms | 26,7 ms | mới nhanh hơn |
| Gesture marquee 300×400 (sync trong `pointerup`) | — | 59 ms | — |
| Gesture lasso 40 điểm | — | 97 ms | — |
| Gesture move 100 px | — | 27,7 ms | — |
| Readback toàn khung / thao tác | 2 (marquee), 3 (wand) | **0** (marquee), **1** (lasso/wand/move) | đúng hợp đồng A2 |

**Phát hiện quan trọng:** dựng `sel.mask` eager tốn **58,7 ms** mỗi lần chọn (full-frame `ImageData` 1.458.000 px) trong khi đường chọn không đọc nó. Đổi thành getter lazy ⇒ toàn bộ chi phí đó biến mất khỏi thao tác chọn. Nếu để eager, C4 chậm hơn code cũ ~20%.

Kiểm đúng đắn cùng phiên:

| # | Kết quả |
|---|---|
| A5 (hình học) | `Path2D` fill vùng rect 300×400 = **120.000 px** đúng; ants trên màn hình ở zoom 31,5% = **1.414 px**, bằng C0 |
| A9 (bộ nhớ) | `sel.data.byteLength` = **1.458.000** = 1080×1350 |
| A10 (combine) | rect → lasso `subtract`: tâm **255 → 0**, bbox giữ 300×400; `add` lại: tâm **→ 255** |
| A11 (undo) | có history rồi undo ⇒ `selection.isActive()` **true → false** |
| Copy/paste | `Ctrl+C` → `Ctrl+V` tạo lớp mới (1 → 2), console **0 lỗi** |

## Đối chứng pixel C5/C6 — hash khung vẽ

C5 (`copySelection`/`beginMove`/`floodFill` bỏ `sel.mask`) và C6 (`selectionPath` cache theo `rev`) **không được đổi một byte pixel nào**. Cách kiểm: chạy một chuỗi thao tác cố định rồi băm `getImageData` của `#paper` (FNV-1a, bước 7 byte).

Chuỗi: brush 5 điểm → marquee 220,200→360,320 → `Ctrl+C` → `Ctrl+V` → `Ctrl+Z` → marquee lại → `Ctrl+X` → `Ctrl+Z` → marquee lại → move thập phân (→ 327,4 / 291,2).

| Mốc | Hash | Ghi chú |
|---|---|---|
| `afterBrush` | `e2939a19` | |
| `afterPaste` | `54da7c8f` | |
| `afterUndoPaste` | `2bbdc29e` | |
| `afterCut` | `a54f3dd5` | |
| `afterUndoCut` | `2bbdc29e` | |
| `afterMoveFrac` | `dbb7001` | |

Đối chứng chéo: chuỗi này chạy trên `HEAD` (sau C6) và trên worktree `0c0b95f` (trước C5) cho **cùng 6 hash**, ba lượt reload liên tiếp trên `HEAD` cũng cho cùng kết quả. Một bản ghi `afterPaste = e5120ec4` chụp trước C5 là **artifact của lần chụp đầu** (trạng thái clipboard còn sót), không phải khác biệt do refactor; đã loại bỏ.

Cache C6 kiểm trong trình duyệt: `selectionPath(sel)` gọi 100 lần trả **cùng một object** (`===`), vẫn cùng object sau khi ants chạy vài frame (`rev` không đổi), trả object mới khi `rev` tăng, và trả `null` với đầu vào `null`.

## Cách chạy lại

1. Mở `http://127.0.0.1:7317/`, tạo doc Poster 1080×1350.
2. Bọc `getImageData` như mục Phương pháp.
3. Phát gesture trên `document.elementFromPoint(...)` với `pointerId` mới mỗi lần.
4. Đo `pointerup → rAF`, 3 lượt, lấy trung vị.
