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

## Cách chạy lại

Script đo nằm trong phiên làm việc (không commit vì là script tạm theo đúng C0). Tóm tắt để dựng lại:

1. Mở `http://127.0.0.1:7317/`, tạo doc Poster 1080×1350.
2. Bọc `getImageData` như mục Phương pháp.
3. Phát gesture trên `document.elementFromPoint(...)` với `pointerId` mới mỗi lần.
4. Đo `pointerup → rAF`, 3 lượt, lấy trung vị.
