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

## Đối chứng pixel C7 — tách overlay/pixel

C7a (`render/overlay.js`) và C7b (`pixel/{wand,fill,stroke,ops}.js`) là refactor thuần. Đo trên cùng doc Poster 1080×1350, cùng tab:

| Thao tác | Hash / số đo | Trước C7 | Sau C7 |
|---|---|---|---|
| Wand tại (540,675), tol 32 | `bbox` + FNV `sel.data` + số px > 127 | 1080×1350 · `cb6d49b5` · 1.458.000 | **trùng** |
| Fill tại (300,300) | hash khung vẽ | `f7f5f44c` | **trùng** |
| Undo fill | hash khung vẽ | `f2d75b57` | **trùng** |
| Viền 12px, center, màu fg | hash khung vẽ | `c743a826` | **trùng** |
| Undo viền | hash khung vẽ | `2215a7fc` | **trùng** |
| Crop theo vùng chọn 500×450 | kích thước `#paper` | 625×563 | **trùng** |
| Chuỗi brush/paste/undo/cut/undo/move | 6 hash ở mục trên | — | **trùng cả 6** |

Ants: rAF bị treo trong lúc `browser.evaluate` giữ main thread (đo được `rafPerSec = 0`), nên phải gọi `drawAnts()` thủ công để đếm. Rect 200×220 doc px: preview khi đang kéo = **2.100 px**, sau `pointerup` = **2.100 px**. Không có lỗi console.

## Đối chứng model P2 — hash theo **doc space**, không theo khung vẽ

Suite C5–C7 ở trên băm buffer `#paper`, mà buffer này có kích thước `doc × dpr × zoom`. Ở chế độ vừa khung (fit) doc Poster cho `#paper` = 425×531, còn ở 100% là 1350×1688 — **hai buffer khác nhau nên hash khác nhau dù pixel doc y hệt**. Đó là lý do các lần ép `1` (100%) cho `afterBrush = 6ec0bc9` thay vì `e2939a19`: artifact của harness, không phải regression.

Từ P2 trở đi, hash được tính trên **composite doc space** (canvas `doc.w × doc.h`, tô `bg`, vẽ từng layer theo `visible/opacity/blend`, FNV trên `getImageData`), nên độc lập hoàn toàn với zoom:

| Bước | Hash doc space | Ghi chú |
|---|---|---|
| `blank` (chưa vẽ) | `7ab27801` | |
| `afterBrush` | `fffe201d` | |
| `afterPaste` | `b59bbf4d` | |
| `afterUndoPaste` | `fffe201d` | **trùng `afterBrush`** |
| `afterCut` | `7c2dce9a` | |
| `afterUndoCut` | `fffe201d` | **trùng `afterBrush`** |
| `afterMoveFrac` | `b692770c` | |
| 20× undo | `fffe201d` | dừng đúng ở mốc sau brush (blank không vào history) |
| 20× redo | `b692770c` | **trùng `afterMoveFrac`** |

Kèm theo: A12 save → reload → mở lại cho hash `b7730475` y hệt trước khi lưu (4 layer, 0 lỗi console).

## P6 — chạy lại 2026-11-20

Môi trường: HEAD `a1c9e47`, doc Poster 1080×1350, fit zoom, hash doc-space FNV bước 7 (cùng phương pháp mục trên).

| Bước | Hash doc space |
|---|---|
| `blank` | `7ab27801` |
| `afterBrush` | `fffe201d` |
| `afterPaste` | `b59bbf4d` |
| `afterUndoPaste` | `fffe201d` |
| `afterCut` | `7c2dce9a` |
| `afterUndoCut` | `fffe201d` |
| `afterMoveFrac` | `b692770c` |
| `after20Undo` | `fffe201d` |
| `after20Redo` | `b692770c` |

9 hash **khớp 100%** bảng P2 ở trên.

A12 (save → reload → mở lại) đã chạy lại trên HEAD: doc Poster 1 lớp sau nét cọ `fffe201d` → chờ autosave (`Đã lưu`) → reload → mở lại từ recent → vẫn `fffe201d`; vùng chọn **không** khôi phục (`selection.isActive() = false`); 0 lỗi console. Hash `b7730475` ở mục P2 thuộc doc 4 lớp của lần đo gốc, không tái tạo cùng nội dung nên chỉ so tính chất round-trip.

Đối chứng soft brush/fill (P4) — chạy cùng một harness trên HEAD và worktree `403b27c` (pre-P5), doc Poster 1080×1350:

| Phép | HEAD `a1c9e47` | `403b27c` | Baseline P4 | Kết luận |
|---|---|---|---|---|
| Blank | `7ab27801` | `7ab27801` | — | harness khớp |
| Soft brush (h=0, poly 5 điểm) | `285884f7` | `285884f7` | `cfe7bfbc` | code cũ = mới ⇒ **không hồi quy**; baseline P4 không tái tạo được trên chính code cũ (sai/harness khác) |
| Fill `#FF4D24` tại (540,675) | `bf079686` | `bf079686` | `bf079686` | **khớp** |
| Undo fill | `7ab27801` | `7ab27801` | `7ab27801` | **khớp** |

Kết luận P6: không có hồi quy pixel do refactor; chỉ số `cfe7bfbc` của P4 là ghi nhận sai/khác harness, không dùng làm chuẩn.

### P6 — smoke sau merge P5-9 (`c6a43f3`)

Đo trên bản đã merge `documents.js`/`geometry.js` vào `shell` (browser, doc Poster 1080×1350, cùng hàm hash):

| Bước | Hash doc space |
|---|---|
| `blank` | `7ab27801` |
| `afterBrush` | `fffe201d` |
| undo brush | `7ab27801` |
| redo brush | `fffe201d` |
| `flipDoc(true)` | `6f416d93` |
| undo flip | `fffe201d` |
| `rotateDoc(1)` (doc thành 1350×1080) | `46039d57` |
| undo rotate (về 1080×1350) | `fffe201d` |
| lưu → reload → mở lại project | `fffe201d` |

0 lỗi console. Các hash khớp baseline ở trên; flip/rotate là phép mới dùng để kiểm đường `geometry` + deps tiêm.

## Cách chạy lại

1. Mở `http://127.0.0.1:7317/`, tạo doc Poster 1080×1350.
2. Bọc `getImageData` như mục Phương pháp.
3. Phát gesture trên `document.elementFromPoint(...)` với `pointerId` mới mỗi lần.
4. Đo `pointerup → rAF`, 3 lượt, lấy trung vị.
