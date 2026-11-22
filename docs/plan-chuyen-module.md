# Kế hoạch chuyển `app.js` sang 9 section

Tài liệu chia việc. Không phải đặc tả tính năng — không có tính năng mới nào
trong kế hoạch này. Mục tiêu duy nhất: **cùng một hành vi, khác ranh giới**.

## Trạng thái xuất phát (đo ngày 2026-11-20)

| Hạng mục | Số |
|---|---|
| `app/app.js` | 3.585 dòng · 132 KB · 1 IIFE · 173 hàm top-level |
| Chỗ đọc `state.` trực tiếp | 570 |
| `addEventListener` | 125 |
| `render()` / `renderSoon()` gọi ngầm | 4 điểm điều phối |
| `index.html` | 718 dòng, 1 thẻ `<script>` |
| Section đã dựng | 9, có `index.js` + README hợp đồng |
| Cổng kiểm tra | `tools/check-boundaries.mjs`, đã test 4 ca |
| Git | `main`, baseline `93a21d3`, khung `03b3e72` |

## Trạng thái thực hiện

| Giai đoạn | Trạng thái | Commit |
|---|---|---|
| 0 — khung | ✅ xong | `03b3e72`, `d115640` |
| 1 — platform / shared / core | ✅ xong | `e25522a`, `9218942`, `8fd6eab`, `969a5b5` |
| 2 — model/store | ✅ xong (P2, gồm C4 mask) | `c76f855`, `9109c0b` |
| 3 — pixel / render | ✅ xong (P3, gồm C5–C7) | `300f04b`, `cfb8e8d` |
| 4 — tools + bus | ✅ xong (bus = `shared/emitter` + inject, không có `bus.js`) | — |
| 5 — ui / shell | ✅ xong (P5-1…P5-9) | `a1c9e47`, `c6a43f3` |
| 6 — khoá lại | ✅ xong (P6-1 xoá `app/app.js`, P6-2 cổng sạch, P6-3 baseline + A12 + soft/fill đã đối chứng) | `7af3250` |

### Tiến độ đổi biểu diễn mask (C0–C8, hợp đồng `docs/contracts/mask.md`)

| Bước | Trạng thái | Commit | Ghi chú |
|---|---|---|---|
| C0 — baseline | ✅ | `547d48f` | 6 số trên 1080×1350, dpr 1.25, zoom 31,5% |
| C1 — `core/mask.js`, `core/path.js` | ✅ | `7b0c2ff` | fixture 3 ca trùng từng số; Porter-Duff 192/64/64 |
| C2 — `platform/path2d.js` | ✅ | `588ea16` | stroke tam giác: hash trùng `Path2D` gốc |
| C3 — `pixel/mask.js` | ✅ | `300f04b`, `cfb8e8d` | 8 adapter kiểm bằng browser; `maskExtract` sửa để không đọc `sel.mask` |
| C4 — switch biểu diễn | ✅ | `c76f855`, `9109c0b` | `sel.mask` lazy; đo cùng phiên 68,5 ms vs 96,7 ms code cũ |
| C5 — bỏ `sel.mask` | ✅ | `d44a386` | copy/cut/move/floodFill dùng `sel.data`; 0 chỗ đọc `state.sel.mask` |
| C6 — bỏ `sel.path` | ✅ | `6f64b4a` | `render/selectionPath.js` cache 1-entry theo `rev`; cùng object qua 100 lần gọi + vài frame ants |
| C7a — `render/overlay.js` | ✅ | `d3df02f`, `0e9ed52` | 5 hàm ants/preview + `configure` tiêm state; `previewGeometry` dùng bản `core` |
| C7b — pixel ops | ✅ | `0a504bf` | `pixel/{wand,fill,stroke,ops}.js`; app.js chỉ còn orchestration |
| C8 — `tools/marquee.js`, `tools/wand.js` | chưa | — | cần `shared/emitter.js` + tiêm bus trước |

Nghiệm thu C1–C3 trên browser thật (2026-11-20, `http://127.0.0.1:7317/`):

- `pathFromCommands` stroke tam giác: hash pixel **trùng** `Path2D` dựng tay (558 px mực).
- Pipeline `mask → maskSegments → segmentsToCommands → Path2D fill`: 19.800 px, **xor = 0** so với mask gốc; 798 đoạn → 800 lệnh.
- `maskToCanvas` theo bbox: canvas 100×50, offset (10,20), **0 byte lệch** khi đọc lại.
- `maskTranslate` dx=10,4/dy=5,2: bbox dịch đúng (10,20)→(20,25), 300 px biên bán trong suốt (giữ fidelity thập phân).
- `maskFromWand` khối 5×5: bbox đúng, 0 px lọt ngoài. `maskFromLayerAlpha`: chỉ có giá trị 0/255.
- `compositeSample` 2 lớp: đỏ trên, xanh dưới, đúng RGBA. `maskExtract` không cần `sel.mask`.
- Console: **0 lỗi**.

### Ghi chú sau giai đoạn 1 (đọc trước khi làm giai đoạn 2–3)

Kế hoạch giả định 9 hàm mask/hình học là thuần. **Thực tế không phải.** Chúng đọc
`state.doc`, gọi `mask.getContext('2d')` / `getImageData`, hoặc trả `Path2D`:

| Hàm | Vướng | Nơi đúng |
|---|---|---|
| `selectionBounds`, `maskSegments`, `maskFromRect`, `maskFromPolygon` | canvas 2D + `state` | `core/mask.js` **sau khi** đổi chữ ký nhận `Uint8Array` + `w,h`; adapter đọc canvas nằm ở `pixel` |
| `pointInSelection`, `translateSelection` | đọc `state.doc` | như trên |
| `pathFromSegments` | trả `Path2D` | `render/` (Path2D là API canvas, không phải toán thuần) |
| `shapeGeometry` | đọc `state.tool` | `tools/shape.js`, hoặc `core` sau khi `tool` thành tham số |

Hệ quả: `app.js` giảm **59 dòng** (3.585 → 3.526), không phải ~200 như dự đoán.
Đổi chữ ký là thay đổi hợp đồng — phải do người sở hữu `core` quyết định và làm ở
giai đoạn 2/3, không gộp ngược vào giai đoạn 1.

### Nghiệm thu giai đoạn 1 (số đo thật)

- Cổng: 9 section · 13 file · 1 cạnh (`core→shared`) · **SẠCH**, exit 0.
- `app.js` 3.585 → 3.526 dòng (−59); `index.html` đổi 1 dòng (`type="module"`).
- Browser thật: boot đủ — hero canvas 1080×1350 vẽ kín, 28 swatch, 5 preset khổ giấy, console **0 lỗi**.
- Brush: mực 1.400 → 2.760 px; undo về 1.400; redo về 2.760 — chính xác từng bước.
- Marquee: ants vẽ 1.800 px, tool chuyển đúng.
- Save → reload → mở lại: mực khôi phục 2.760 px, **khớp tuyệt đối** trước reload.
- Chưa làm: so byte ảnh export trước/sau (cần mẫu export cố định để so).

Không có build step, không bundler, không test runner. Vì vậy **cổng ranh giới là
thứ duy nhất chặn hồi quy kiến trúc** — không có gì khác thay thế được.

## Vai trò

| Vai | Ai | Được làm | Không được làm |
|---|---|---|---|
| **A — chủ monolith** | người hiểu `app.js` nhất | chuyển code, giữ hành vi | đổi tính năng trong lúc chuyển |
| **B — song song** | người thứ hai | chuyển các section độc lập | sửa file A đang mở |
| **Assist** | sysadmin | khung, cổng, baseline, docs, môi trường, review | viết logic tính năng, refactor source |

Ba người không cùng sửa một file. Một section chỉ có **một** người sở hữu tại
một thời điểm.

## Quy ước

- Nhánh: `phase-<N>-<ten>` (ví dụ `phase-2-store`), merge vào `main` khi cổng sạch.
- Commit: `refactor(<section>): <việc>` — ví dụ `refactor(core): tach color math`.
- Mỗi PR **một section**. PR chạm hai section = tách ra.
- Trước mỗi commit: `node tools/check-boundaries.mjs` phải exit 0.
- Đầu mỗi phase: `powershell -File tools/baseline.ps1`, lưu số. Cuối phase: chạy lại, so.
- Không import xuyên file nội bộ; chỉ qua `<section>/index.js`.
- Trong một phase: **đóng băng `app.js`** với tính năng mới. Hotfix đi nhánh riêng,
  merge trước khi phase bắt đầu.

## Định nghĩa hoàn thành (áp cho mọi task)

1. `node tools/check-boundaries.mjs` → `KẾT QUẢ: SẠCH`.
2. `http://127.0.0.1:7317/` → HTTP 200, console không lỗi.
3. Chạy checklist hồi quy bên dưới — phần liên quan đến section vừa đổi.
4. `baseline.ps1`: số dòng `app.js` giảm tương ứng, không tăng ở chỗ khác.
5. Không phát sinh `state.` mới ngoài `model/`.
6. Commit đúng quy ước, có ghi chú phần nào của `app.js` đã xoá.

---

## Giai đoạn 1 — Nền thuần (rủi ro thấp nhất, làm trước)

| ID | Việc | Owner | Ngày | Phụ thuộc | File đích |
|---|---|---|---|---|---|
| P1-1 | `$`, `$$`, `dpr`, `loadImage` → `platform/dom.js` | A | 0.5 | — | `platform/` |
| P1-2 | `clamp`, `fmt`, `pad`, `uid`, `esc` → `shared/` | B | 0.25 | — | `shared/` |
| P1-3 | 6 hàm màu (hex/rgb/hsl) → `core/color.js` | B | 0.5 | — | `core/` |
| P1-4 | `selectionBounds`, `maskSegments`, `pathFromSegments`, `pointInSelection`, `translateSelection`, `maskFromRect`, `maskFromPolygon`, `shapeGeometry`, `bezierPoints` → `core/` | A | 1.5 | — | `core/` |
| P1-5 | `app.js` import từ `platform`/`shared`/`core`, xoá bản trùng | A | 0.25 | P1-1..4 | `app.js` |

**Nghiệm thu:** `app.js` giảm ~200 dòng; cổng 0 vi phạm; không đổi pixel nào
(so ảnh export trước/sau phải giống).
**Song song:** A và B chạy độc lập hoàn toàn. Lịch: 2 ngày.

## Giai đoạn 2 — `model/store` (nút cổ chai, ~40% công)

| ID | Việc | Owner | Ngày | Phụ thuộc | Ghi chú |
|---|---|---|---|---|---|
| P2-1 | `store.js`: `get/set/subscribe` + facade `state` tạm thời | A | 2.0 | P1 | **Không đổi hành vi.** Facade giữ nguyên shape `state` để 570 chỗ đọc vẫn chạy, thay ruột dần |
| P2-2 | `doc.js`: `createProject`, `openDoc`, `activeLayer`, `sheetSize` | B | 0.75 | P2-1 | |
| P2-3 | `layers.js`: `newLayer`, `copyCanvas`, `replaceLayerImage`, `uniqueName`, `mergeDown`, `flattenLayers`, `mergeAll` | B | 1.5 | P2-1 | |
| P2-4 | `history.js`: snapshot/push/sync | B | 1.0 | P2-2, P2-3 | undo/redo phải qua checklist kỹ |
| P2-5 | `serialize.js`: đọc/ghi `.craf` + version | B | 0.5 | P2-2 | file lưu cũ phải load được |
| P2-6 | Thay `state.` theo vùng: start view → studio → tools | A | 1.5 | P2-1 | chia 3 commit nhỏ, mỗi commit cổng sạch |

**Nghiệm thu:** ngoài `model/` còn **0** chỗ đọc `state.`; save → reload → ảnh
giống hệt; undo/redo 20 bước liên tiếp không lệch.
**Rủi ro cao nhất toàn kế hoạch.** Nếu P2-1 trượt, dừng và báo — đừng đẩy tiếp.
Lịch: 3–4 ngày (B chờ A khoảng nửa ngày đầu, dùng thời gian đó viết checklist).

## Giai đoạn 3 — `pixel` + `render` (hai nhánh song song)

| ID | Việc | Owner | Ngày | File đích |
|---|---|---|---|---|
| P3-1 | `applyLevels`, `convolveCanvas`, `filterCanvas` | B | 1.0 | `pixel/adjust.js`, `pixel/filters.js` |
| P3-2 | `resizeImage`, `resizeCanvas`, `cropToSelection`, `flipDoc`, `rotateDoc`, `applyLayerTransform` | B | 1.0 | `pixel/ops.js` |
| P3-3 | `floodFill`, `maskFromWand`, `pickColor`, `runExport`, `thumbData`, `applyStrokeSelection`, `copySelection` | B | 1.5 | `pixel/` |
| P3-4 | `compositeCanvas`, `updateLayerThumb`, `applyView`, `fit`, `setZoom`, `startPan`, `moveRing`, `drawRulers`, `niceStep` | A | 1.5 | `render/` |
| P3-5 | `drawAnts`, `requestAnts`, `startAnts`, `previewGeometry`, `selPreviewPath`, `clearOverlay`, previews | A | 1.0 | `render/overlay.js` |

**Nghiệm thu:** export PNG trước/sau giống từng byte (cùng tham số); ants vẫn
nhấp nháy; zoom/pan không lệch tâm; cổng chứng minh `render` **không** import `pixel`.
**Song song:** A làm render, B làm pixel — không chạm file nhau. Lịch: 3 ngày.

### Trạng thái giai đoạn 3 (đã xong nhánh `render` + `adjust/sample/encode`)

| Việc | Kết quả |
|---|---|
| `render/compositor.js` | `paintDoc`, `compositeDoc`, `drawLayerThumb` — thay `compositeCanvas`/`updateLayerThumb`/thân `render()` |
| `render/viewport.js` | `configure`, `renderDoc`, `applyView`, `fit`, `setZoom`, `startPan`, `dragPan`, `endPan`, `moveRing`, `hideRing`, `showRing` |
| `render/rulers.js` | `drawRulers`, `niceStep` |
| `pixel/adjust.js` | `adjustFilter`, `applyLevels`, `convolveCanvas`, `filterCanvas`, `paintClippedOver` — gộp cả `filters.js` vào đây vì cùng một luật "nhận canvas → trả canvas" |
| `pixel/sample.js` | `sampleHex(canvas, x, y)` |
| `pixel/encode.js` | `pngDataURL`, `jpegDataURL` |

Kiểm trong trình duyệt (Poster 1080×1350, hash doc space `fffe201d` sau nét cọ):
brush giữ nguyên hash; `filterGray` → `2ec507f7`, undo về `fffe201d`; adjust
`bright=40` → `ea5c6538`, undo về `fffe201d`; zoom 100% ↔ vừa khung đổi
`#paper` 1350×1688 ↔ 425×531, thước vẽ lại; pan chuột giữa lệch đúng `+40/+25`;
vòng cọ 5.67px = 18×0.315; lấy màu trả `#F8F5EE` và tự chuyển về bút; save →
reload → mở lại `1d6daeaf` y hệt. 0 lỗi console.

`resizeImage`/`resizeCanvas`/`flipDoc`/`rotateDoc`/`applyLayerTransform` (P3-2)
vẫn ở `app.js` vì chúng đổi `doc.w/h`, `state.view` và history trong cùng một
hàm — tách raster thuần sẽ làm ở giai đoạn 3b nếu cần.

## Giai đoạn 4 — `tools` + bus (điểm ghép lỏng nhất)

| ID | Việc | Owner | Ngày | Phụ thuộc |
|---|---|---|---|---|
| P4-1 | `shell/bus.js` + bảng command rỗng + đăng ký trong `boot` | A | 1.0 | P3 |
| P4-2 | `tools/`: brush, marquee, fill, wand, picker | B | 1.5 | P4-1 |
| P4-3 | `tools/`: move, gradient, shape, text, pan + `registry.js` (`setTool`, `syncSizeUI`, `syncOpacityUI`) | A | 1.5 | P4-1 |

**Nghiệm thu:** `grep -r "from '.*ui" app/src/tools` = rỗng; `grep -r "from '.*tools" app/src/ui` = rỗng;
gỡ `ui/` khỏi app vẫn vẽ được bằng phím tắt (chứng minh tools không phụ thuộc panel).
**Lịch:** 2.5 ngày. B chờ bus ~1 ngày → dùng viết cổng tự test cho tools.

### Trạng thái giai đoạn 4

| Việc | Kết quả |
|---|---|
| C8 (`929024f`) | `tools/marquee.js`, `tools/wand.js`, `shared/emitter.js`; bus do `app.js` tạo và **tiêm** vào `configureTools({ bus })` (không section nào import `shell`) |
| P4-2…P4-4 | `pixel/brush.js`, `pixel/gradient.js`, `pixel/shape.js`, `pixel/move.js`: toàn bộ phép vẽ điểm ảnh của tool rời `app.js`, nhận tham số (không đọc `state`) |
| P4-5 | `tools/brush.js`: máy trạng thái nét cọ (dấu đầu + quadratic + khép thẳng) |
| P4-6 | `tools/{move,shape,gradient,text,fill,picker,registry}.js`: gesture + luật commit; `registry.setTool` phát `tool:changed`, `app.js` (tạm) nghe để vẽ panel |
| `pixel/text.js` | `drawText` — rasterize chữ nhiều dòng, có `clipPath` |

Đối chứng sau mỗi nhát cắt (Poster 1080×1350, hash doc space):
- Gradient + shape: render 32 tổ hợp (3 tool × shift × alt × fill, và linear/radial × reverse × clip) — **32/32 hash trùng** bản cũ.
- Move: chọn 141×122 rồi kéo `(+37.4, +31.2)` → `b692770c`, undo → `fffe201d` (trùng baseline P2).
- Brush: `fffe201d` (cứng), `cfe7bfbc` (mềm), tẩy 2.205 → 1.815 px, clip vùng chọn 0 px tràn.
- Fill/pick/toDoc: fill nền `#FF4D24` → `bf079686`, undo `7ab27801`; pick trả `#FDFAF3` rồi tự về bút; vẽ ở zoom 100% vẫn ra đúng toạ độ doc.

Một khác biệt **có sẵn từ trước**, không do refactor: sau khi undo (khôi phục layer bằng PNG), nét cọ kế tiếp cho alpha coverage lệch ~1% (4.076 → 4.116 px). Đã đối chứng trên worktree `87e4e58` (trước khi tách brush) — **cùng hiện tượng**, nên ghi nhận là artifact rasterize của Chrome. Đo lại 2026-11-21 trên HEAD: bản thân **undo → redo trùng khít 0 pixel** (240×240 gradient alpha và doc 1080×1080 thật), nên lệch chỉ xuất hiện ở lần composite nét vẽ **tiếp theo** sau khôi phục — canvas lưu alpha premultiplied đã bị làm tròn khi `drawImage` từ PNG; không sửa được nếu không giữ bản sao canvas thô trong history (vượt ngân sách bộ nhớ `HISTORY_LIMITS`).

## Giai đoạn 5 — `ui` + `shell` (đóng monolith)

| ID | Việc | Owner | Ngày | Phụ thuộc |
|---|---|---|---|---|
| P5-1 | `shell/boot.js`, `keymap.js`, `commands.js`, `storage.js` | A | 1.5 | P4 |
| P5-2 | `ui/layers.js` + `ui/inspector.js` + `ui/adjust-panel.js` | B | 1.5 | P4-1 |
| P5-3 | `ui/start.js`, `menus.js`, `modals.js`, `nott.js`, `feedback.js` | B | 1.5 | P5-2 |
| P5-4 | `index.html` → chỉ còn `<script type="module" src="/app/src/shell/index.js">` | A | 0.25 | P5-1 |

**Nghiệm thu:** `app.js` không còn được tham chiếu; 125 listener gắn đúng một
lần (mở/đóng panel 3 lần, kiểm tra không nhân đôi hành vi); toàn bộ checklist
hồi quy xanh trên desktop + 720px.
**Lịch:** 3 ngày.

### Trạng thái thực tế (2026-11-20)

| Mục | Trạng thái | Commit |
|---|---|---|
| P5 — `ui/feedback`, `ui/start` + `model/presets` | ✅ | `a49bf8a` |
| P5 — `ui/layers`, `ui/inspector`, `ui/adjust-panel` | ✅ | `refactor(ui): panel lop, mau va chinh mau sang ui/` |
| P5 — `ui/menus`, `ui/drawer` | ✅ | `refactor(ui): menubar, pane, drawer, tro giup sang ui/` |
| P5 — `shell/storage` | ✅ | `refactor(shell): cau luu tru HTTP + autosave + xuat anh` |
| P5 — `shell/commands` | ✅ | `refactor(shell): bang command menubar sang shell/commands.js` |
| P5 — `shell/keymap` | ✅ | `c684829` |
| P5 — `ui/modals` + `ui/hero` | ✅ | `refactor(ui): modal size/transform/stroke + hero poster` |
| P5/P6 — `shell/boot` + entry `shell/index.js`, xoá `app/app.js` | ✅ | `a1c9e47` |
| P5-9 — `shell/documents` + `shell/geometry` | ✅ | merge `c6a43f3` (nhánh `p5split`, commit `b3b6e6f`); audit: thân 19 hàm trùng bản gốc sau khi bỏ tiền tố `deps.`, named import OK |

Kiểm chứng browser sau mỗi mốc: hash doc-space `7ab27801` (trống), `fffe201d`
(sau nét cọ), undo/redo, save/autosave, export PNG↔JPEG, menu/pane/drawer/modal,
toàn bộ keymap, 0 console error.

Ngoại lệ kích thước file: `shell/boot.js` là composition root duy nhất và cố ý
giữ phần điều phối (drawing engine, pointer, doc lifecycle) — mọi nghiệp vụ
thuần đã nằm ở section rank thấp hơn.

### Trạng thái giai đoạn 6

- **P6-1** — Xoá `app/app.js`, cập nhật `docs/architecture.md` + README: ✅ (`a1c9e47`).
- **P6-2** — Cổng ranh giới: ✅ `node tools/check-boundaries.mjs` → `KẾT QUẢ: SẠCH` (9 section, 66 file, 26 cạnh).
- **P6-3** — Baseline/hồi quy: 9 hash doc-space khớp 100% bảng P2 trong `docs/contracts/mask-baseline.md` (chạy lại 2026-11-20). A12 (save → reload → mở lại) đã chạy lại: doc 1 lớp sau brush `fffe201d` → autosave → reload → mở lại vẫn `fffe201d`, vùng chọn không khôi phục, 0 lỗi console. Đối chứng soft/fill trên HEAD và `403b27c`: soft `285884f7` cả hai bên (baseline P4 `cfe7bfbc` không tái tạo được trên code cũ ⇒ ghi nhận sai, không hồi quy); fill `bf079686`, undo `7ab27801` khớp cả hai bên và baseline. Sau khi merge P5-9 (`c6a43f3`): smoke lại blank/brush/undo/redo/flip/rotate và mở project đều đúng (xem bảng P6 trong `mask-baseline.md`).
- **P7** — Sửa lỗi phát sinh sau P6 (2026-11-20): (1) panel adjust không cho kéo giá trị đầu tiên nữa (`ensureAdjust` không ghi đè `syncAdjustUI` trước khi `readAdjustUI` đọc slider); (2) autosave có thể bỏ mất thay đổi mới trong lúc POST đang chờ (`editRev` + retry qua `waitForSave`); (3) Ctrl+Z / Ctrl+Shift+Z ở màn hình bắt đầu ném lỗi — `undo`/`redo` giờ chặn khi `state.doc` rỗng, `goStart` xoá lịch sử và `openDoc` đồng bộ nút sau khi `activate()` reset stack (trước đó nút Hoàn tác còn bật dù stack rỗng); (4) rời studio khi đang xem trước chỉnh màu — `goStart` gọi `finishAdjust()` trước khi lưu để chốt bản xem trước và không còn `state.adjust` treo trỏ vào tài liệu cũ; (5) `Tệp → Mới` trong studio đợi lưu xong bản cũ (`flushSave()`) trước khi thay doc — trước đó thay đổi đang chờ autosave có thể mất; (6) Ctrl+Z / Ctrl+Y bấm liên tiếp chạy song song làm hỏng stack (snapshot nghịch tính từ canvas chưa cập nhật) — `undo`/`redo` giờ xếp hàng qua `historyChain`, mỗi snapshot áp xong mới sang lượt sau; (7) Huỷ chỉnh màu sau khi Ctrl+Z xoá nhầm entry lịch sử — trước đó `finishAdjust(true)` pop phần tử đầu undo nếu cùng lớp, tức entry nét vẽ hợp lệ; giờ entry của phiên adjust mang `tag` riêng và `dropTagged` bỏ đúng nó ở cả undo lẫn redo (kể cả khi đã đi vòng Ctrl+Z → Ctrl+Y); (8) Ctrl+Z hoàn tác preview chỉnh màu rồi kéo slider lại — entry của phiên không được đẩy lại nên Ctrl+Z sau đó nhảy qua cả nét vẽ. `rebaseAdjustAfterHistory` lấy canvas hiện tại làm mốc sau mỗi undo/redo, `renderAdjustPreview` đẩy lại entry khi phiên chưa có entry trên undo, còn Huỷ dọn entry theo tag ở cả hai stack; (9) vẽ/tô khi panel chỉnh màu đang xem trước — thao tác sửa ảnh giờ chốt phiên adjust trước (`beginDraw` gọi `finishAdjust` cho mọi tool trừ hút màu/wand/chọn vùng), trước đó bấm Huỷ sau khi vẽ sẽ khôi phục ảnh gốc và nuốt luôn nét vừa vẽ; (10) Ctrl+Z khi đang giữ nút vẽ — hoàn tác giữa nét làm canvas bị khôi phục dưới nét đang vẽ, nhả chuột ghi đè lại và nét không vào lịch sử (redo còn entry cũ); `undo`/`redo` giờ bỏ qua khi `state.draw` đang mở, nhả chuột xong mới hoàn tác; (11) `pointercancel` giữa lúc kéo hình khối để lại entry lịch sử rỗng (hình chỉ vẽ ở lớp phủ, chưa tô) — entry của phiên hình mang `tag` và bị `dropTagged` khi huỷ, nên Ctrl+Z sau đó không mất một lần bấm vô ích; nét cọ huỷ giữa chừng vẫn giữ phần đã tô như trước; (12) `loadImage` trả `ImageBitmap` đã giải mã xong — `Image.onload` chỉ báo tải xong, Chrome có thể chưa giải mã pixel nên `drawImage` ngay sau đó vẽ thiếu trên máy chậm (`img.decode()` treo trong môi trường chạy thử, nên dùng `createImageBitmap`, lỗi/CORS rơi về thẻ `Image`). Kèm kiểm chứng autosave: vẽ rồi về màn hình ngay, vẽ thêm đúng lúc POST đang chạy, `Tệp → Mới` khi đang bẩn, đổi tên rồi rời studio — mở lại đều đúng nội dung và tên; (13) khôi phục snapshot mức doc (thêm/xoá lớp, resize, lật, crop…) tạo lớp với id mới, làm entry mức lớp đẩy trước đó trỏ vào id cũ và Ctrl+Z kế tiếp không làm gì (chỉ mất một lượt). `docSnapshot` giờ giữ `id` của từng lớp và `applySnapshot` dùng lại id đó; `toPayload` vẫn không có `id` nên `.craf` không đổi; (14) kéo slider độ mờ lớp không vào lịch sử — Ctrl+Z nhảy qua và hoàn tác mất nét vẽ trước đó. Mỗi phiên kéo (focus/pointerdown → blur) chụp một snapshot doc lúc bắt đầu và đẩy đúng một entry ở tick đầu tiên, nên một lần kéo = một bước hoàn tác; đổi blend/ẩn-hiện/đổi tên/đổi thứ tự lớp và độ mờ đều chốt phiên chỉnh màu trước khi sửa; (15) ô nhập chữ còn treo khi đổi tài liệu — `Tệp → Mới`/mở project/về màn hình để lại editor của doc cũ, Enter sau đó ghi chữ vào doc mới. `closeTextEditor` đóng ô (không ghi), được gọi trong `openDoc`/`goStart`, và `commit` bỏ qua khi ô đã đóng; (16) autosave lỗi lặp lại chồng một chồng toast giống nhau (4 lần thử lại = 4 toast) - `toast()` giờ dùng lại toast cuối nếu cùng nội dung + cùng loại, đếm giờ lại thay vì thêm mới; toast vẫn hiện lại sau khi đã tự ẩn nếu lỗi tiếp diễn; (17) lưu hỏng mà vẫn rời studio / mở bản mới - `goStart` xoá doc dù `flushSave()` thất bại (mất thay đổi chưa lên đĩa), `applySizeModal('new')` vẫn mở bản mới. Giờ cả hai kiểm tra kết quả `flushSave()`: lỗi thì ở lại studio (giữ nguyên doc + nét vẽ) và báo toast; nối lại mạng rồi thao tác lại vẫn thành công; (18) nhập ảnh Nott khi đang xem trước chỉnh màu không chốt phiên adjust - snapshot lịch sử mang theo preview, nên Huỷ sau đó rồi Ctrl+Z lại hồi sinh đúng bản preview đã huỷ. `importNottImage` giờ gọi `finishAdjust()` trước `pushDocHistory()` như `importImageData`; kiểm chứng: nhập ảnh → Huỷ không còn tác dụng, Ctrl+Z lần 1 bỏ ảnh nhưng giữ màu đã chốt, lần 2 về nét gốc, Ctrl+Y quay lại đúng bước đã chốt; (19) xuất ảnh khi ô tên trống/toàn khoảng trắng rơi về `craf` thay vì tên bản vẽ, và tên sau khi lọc ký tự cấm có thể còn hai dấu cách (`Poster / mực` → `Poster  mực`) - giờ ô trống lấy tên bản vẽ và khoảng trắng được gộp lại; (20) giữ Space để pan rồi Alt+Tab / ẩn tab - keyup không bao giờ tới nên `state.space` kẹt `true`, mọi cú kéo sau đó thành pan thay vì vẽ. `bindKeymap` giờ nhả pan ở `window` `blur` và `visibilitychange` khi tab bị ẩn; kiểm chứng: sau blur/ẩn tab `space=false`, kéo vẽ ra nét và view không dịch; (21) kéo nét/hình/pan/thước dở rồi Alt+Tab hoặc ẩn tab - `pointerup` không tới nên `state.draw`/`state.panning`/`state.guideDrag` kẹt, Ctrl+Z bị chặn và lần kéo sau bị hiểu nhầm. `cancelPointerSession` (dùng chung với `pointercancel`) giờ chạy ở `window` `blur` và `visibilitychange`: trả `ctx.restore()` cho lớp bị clip, bỏ entry rỗng của hình khối, xoá overlay/preview, `endPan()`, bỏ thước đang kéo; nét cọ đã tô dở vẫn giữ và Ctrl+Z hoàn tác được; (22) Ctrl+Z đang chờ giải mã ảnh mà người dùng rời studio / mở bản mới - `applySnapshot` đọc `state.doc` lại sau mỗi `await`, nên snapshot cũ bị gán vào doc mới: bản 900×900 nhận lớp 600×400 của bản trước (vẽ bị cắt, lưu ra sai kích thước). Giờ giữ `doc` lúc bắt đầu và dừng ngay khi `state.doc` đổi; `enqueueHistory` vẫn nuốt lỗi để hàng đợi không kẹt nhưng ghi `console.warn` để không mất dấu vết. Kiểm chứng: race mở bản mới khi undo đang decode → lớp bản mới đúng 900×900, lịch sử sạch, vẽ/undo bình thường; undo/redo doc và layer bình thường vẫn đúng; (23) ẩn tab / thu nhỏ cửa sổ ngay sau khi vẽ - trình duyệt bóp timer nên autosave 1 giây có thể bị hoãn rất lâu. Thêm `visibilitychange` → `saveNow()` khi `document.hidden` và còn bẩn; kiểm chứng: ẩn tab lúc `dirty=true` thì 60 ms sau đã `dirty=false`, nhãn "Đã lưu", file `.json` trên server có nét mới, hiện lại tab không lưu lặp; (24) bấm mở một bản (nạp chậm vì giải mã ảnh) rồi tạo bản mới / về màn hình bắt đầu / mở bản khác - `openProject` cũ vẫn chạy tiếp và `openDoc` ghi đè lên bản mới (tạo bản 640×480 rồi bị bản 800×800 mở sau đè, mất bản vừa tạo). Thêm `openSeq` trong `shell/documents.js`: `openDoc`/`goStart`/`openProject` tăng số, mỗi `await` trong `openProject` kiểm tra lại và dừng nếu số đổi (kể cả nhánh lỗi, không báo lỗi của bản đã bị bỏ). Kiểm chứng: mở chậm rồi tạo bản mới → giữ bản mới đúng 640×480, không toast lỗi; mở chậm rồi về start → ở start, không tự mở lại studio; hai thẻ liên tiếp → dừng ở thẻ cuối (Poster 1080×1350); mở bình thường sau đó vẫn đủ 2 lớp và có pixel; (25) thả/dán ảnh rồi đổi bản vẽ khi ảnh còn đang giải mã - `importImageData` đọc `state.doc` sau `await loadImage`, nên ảnh rơi vào bản mới (hoặc ném lỗi khi đã về màn hình bắt đầu). Giữ `doc` lúc bắt đầu, `await` xong mà doc đổi thì bỏ ảnh: mở bản khác thì báo "Đã đổi bản vẽ — bỏ ảnh đang nhập", về start thì im lặng. Kiểm chứng: thả ảnh chậm rồi tạo bản mới → bản mới vẫn 1 lớp, có toast, không lỗi; thả ảnh chậm rồi thoát → ở start, không toast, không lỗi; thả ảnh bình thường → thêm lớp "do", undo/redo đúng; (26) lưu dở bản cũ rồi mở bản khác - `saveNow` ghi nhãn "Đã lưu"/"Chưa lưu" và `state.dirty` của toàn cục sau khi chờ server, nên kết quả của bản cũ (nhất là khi lỗi) dán lên bản mới; `openDoc` lại chỉ đặt nhãn "Đã lưu" mà không xoá cờ bẩn của bản trước, khiến lần thoát sau lưu thừa bản mới. Giờ `saveNow` chỉ đổi nhãn/cờ khi `state.doc` vẫn là doc lúc bắt đầu (danh sách project vẫn cập nhật cho đúng doc), còn `openDoc` xoá `saveTimer`, đặt `dirty=false` rồi mới báo "Đã lưu". Kiểm chứng: lưu A lỗi trong lúc mở Poster → Poster vẫn "Đã lưu", `dirty=false`, có toast lỗi của A, thoát không ghi lại file Poster; lưu A chậm rồi tạo B và sửa B → A xong tự lưu nốt B (2 lớp trên server), nhãn "Đã lưu"; (27) rời studio khi autosave đang chờ rồi tạo/mở bản khác - `goStart` chờ `flushSave()` xong mới xoá `state.doc`, nên nếu trong lúc chờ người dùng đã mở/tạo bản mới thì bản mới bị xoá và màn hình nhảy về start (mất bản vừa tạo); lỗi lưu của bản cũ cũng báo lên bản mới. Giờ giữ `doc` lúc bắt đầu và bỏ việc rời studio ngay khi `state.doc` đổi (trước cả khi xét kết quả lưu). Kiểm chứng: hoãn POST 1,5 s, gọi về start rồi 300 ms sau tạo bản 800×800 → vẫn ở studio với bản mới, `dirty=false`; (28) `Tệp → Mới` trong lúc lưu bản cũ rồi mở bản khác - `applySizeModal('new')` vẫn tạo "Bản vẽ W×H" đè lên bản vừa mở. Giữ `doc` lúc bắt đầu, `flushSave()` xong mà doc đổi thì không tạo. Kiểm chứng: hoãn POST 1,5 s, mở hộp khổ 640×480 rồi 300 ms sau tạo bản 700×700 → giữ bản 700×700; (29) gửi sang Nott trong lúc lưu bản cũ rồi đổi bản vẽ - `sendToNott` đọc `state.doc` sau `await saveNow()` nên gửi bản mới dù người dùng bấm gửi cho bản cũ. Giữ `doc` lúc bắt đầu, doc đổi thì bỏ gửi. Kiểm chứng: hoãn POST 1,5 s, bấm "Gửi bản vẽ đang mở" rồi 300 ms sau tạo bản mới → 0 request `/api/nott/send`, bản mới nguyên vẹn; (30) nhập ảnh Nott đang giải mã rồi đổi bản vẽ - `importNottImage` dán ảnh vào bản mới. Giữ `doc`, `await loadImage` xong mà doc đổi thì bỏ ảnh (có toast), doc mới vẫn 1 lớp. Kiểm chứng: hoãn tải ảnh 1 s, bấm ảnh Nott rồi 250 ms sau tạo bản mới → bản mới 1 lớp, 0 lỗi console; (31) lưu bản cũ lỗi trong lúc đã mở bản khác - `saveNow` vẫn báo "Không lưu được: ..." không kèm tên nên tưởng bản đang mở lưu hỏng; giờ toast nêu tên bản cũ (`Không lưu được "TEST-A": ...`), nhãn/dirty của bản mới không đổi. Kiểm chứng: POST lỗi sau 800 ms, 250 ms sau tạo bản mới → toast đúng tên bản cũ, 0 lỗi console; (32) gửi cùng một bản vẽ hai lần trong một phút - tên ảnh chỉ có tem tới phút nên lần gửi sau ghi đè ảnh của lần trước. Tem thêm giây và hậu tố `-2`, `-3` nếu vẫn trùng. Kiểm chứng: hai POST liền nhau → `...111320.png` và `...111320-2.png`, cả hai còn nguyên; (33) thumbnail ảnh Nott sinh thêm một tệp mỗi lần khởi động lại (khoá `hash()` đổi theo tiến trình) - dùng SHA-1 của tên + mtime. Kiểm chứng: gọi thumb, khởi động lại server, gọi lại → dùng đúng tệp cũ, mtime không đổi; (34) `Tệp → Mới` lưu bản cũ hỏng trong lúc đã mở bản khác - toast "Chưa lưu được bản cũ — chưa mở bản mới" hiện trên bản mới dù người dùng đã mở bản khác; đồng thời `flushSave()` vòng tiếp theo lưu chính bản mới dưới yêu cầu của bản cũ (thêm request + toast thừa). Giờ `applySizeModal` kiểm tra doc đổi trước khi báo lỗi, và `flushSave(expectDoc)` dừng ngay khi `state.doc` đổi. Kiểm chứng: POST lỗi sau 700 ms, 200 ms sau tạo bản mới → đúng 1 POST, 1 toast nêu tên bản cũ, bản mới giữ nguyên; lưu thành công bình thường vẫn về start với 1 POST; (35) bấm "Gửi bản vẽ đang mở" hai lần liên tiếp - mỗi lần một yêu cầu, tạo hai ảnh và hai ghi chú trùng (trước đây ảnh ghi đè nhau nên không thấy). Giờ nút bị khoá tới khi gửi xong. Kiểm chứng: hoãn POST 600 ms, bấm 3 lần → đúng 1 request, nút bật lại sau khi xong.
- **P8** — Test hồi quy module thuần (2026-11-21): `tests/pure.test.mjs` phủ `core/color`, `core/geometry`, `core/mask`, `core/path`, `shared/util`, `shared/emitter`, `model/history`, `model/doc`, `model/layers`, `model/selection`, `model/store`, `model/serialize`, `pixel/adjustFilter`, `render/niceStep` — 43 test (bổ sung `newDocData`/`activeLayer`/`activate`), chạy `npm test` hoặc `node --test "tests/*.test.mjs"`. Thêm `package.json` tối giản (`"type": "module"` + script test), không dependency, không bước build; cổng ranh giới vẫn `KẾT QUẢ: SẠCH`. Test bắt được lỗi `sheetSize` luôn trả 64×64 cho khổ dọc (trần sai 64 thay vì 88) — thẻ preset Poster/Story ở màn hình bắt đầu giờ đúng tỉ lệ 64×80 / 64×88.

## Giai đoạn 6 — Khoá lại

| ID | Việc | Owner | Ngày |
|---|---|---|---|
| P6-1 | Xoá `app/app.js`, cập nhật `docs/architecture.md` + README | A | 0.5 |
| P6-2 | Chạy cổng như bước bắt buộc trước commit (ghi vào README) | Assist | 0.25 |
| P6-3 | Quét hồi quy toàn bộ + so baseline đầu/cuối | A + B | 1.0 |

**Nghiệm thu:** `app.js` biến mất, cổng sạch, baseline cho thấy mã nguồn nằm
đúng section, không file nào > 400 dòng ngoại lệ có ghi chú.

---

## Tổng thời lượng

| Owner | Người-ngày |
|---|---|
| A | 11.75 |
| B | 13.0 |
| Assist | ~2.0 (rải) |
| **Tổng** | **~24.75** (+25% buffer ≈ 31) |

Hai người làm song song: **~4 tuần lịch** gồm review và sửa lỗi phát sinh.
Không tính tính năng mới nào. Nếu vẫn phải làm tính năng song song, cộng thêm
thời gian và chấp nhận conflict trên `app.js` — trừ khi phase đang chạy.

## Rủi ro và cách chặn

| # | Rủi ro | Mức | Chặn bằng |
|---|---|---|---|
| R1 | 570 chỗ đọc `state.` sinh lỗi ngầm khi tách store | **Cao** | Facade 2 bước (P2-1), thay theo vùng, 3 commit nhỏ, checklist undo/redo/save |
| R2 | 125 listener bị gắn trùng sau khi tách panel | **Cao** | Mở/đóng panel 3 lần trong checklist; mỗi panel một hàm `mount()` chạy một lần |
| R3 | Tính năng mới chèn vào `app.js` giữa phase → conflict | Trung bình | Đóng băng `app.js` trong phase; hotfix nhánh riêng |
| R4 | `render()` là hợp đồng ngầm, tách ra dễ mất nhịp vẽ | Trung bình | `store.subscribe` + gộp bằng rAF (đã có ý tưởng `renderSoon`) |
| R5 | Sai lệch pixel sau khi tách `pixel/` | Trung bình | So byte ảnh export trước/sau từng task P3 |
| R6 | Cổng bị "vá" bằng cách nới `boundaries.json` | Trung bình | Review bắt buộc: PR đổi `boundaries.json` cần Assist duyệt |

## Checklist hồi quy (dùng chung, chạy tay)

1. Mở app → 3 project mẫu hiện đúng thumbnail.
2. Tạo doc preset 1080×1350, tạo doc tuỳ chỉnh.
3. Brush: vẽ, đổi size, đổi opacity, tẩy.
4. Marquee: chọn mới, cộng, trừ, bỏ chọn, Ctrl+A, đảo.
5. Wand + chọn nội dung lớp + Ctrl+click layer.
6. Move vùng chọn, cắt/dán, xoá vùng chọn.
7. Gradient, shape, text, flood fill, eyedropper.
8. Zoom, pan, fit, thước.
9. Layer: thêm, nhân bản, xoá, đổi tên, opacity, blend, gộp xuống, flatten.
10. Levels: kéo 3 thanh, áp dụng, huỷ, undo.
11. Filter: vignette, grain, blur/sharpen.
12. Ctrl+T transform lớp (scale, rotate, flip).
13. Viền vùng chọn (3 chế độ), màu nền canvas.
14. Undo/redo 20 bước; save → reload → so ảnh.
15. Export PNG + JPEG; import ảnh; layout 720px không tràn.

## Bảng chia việc theo tuần

| Tuần | A | B | Assist |
|---|---|---|---|
| 1 | P1-1, P1-4, P1-5 | P1-2, P1-3 | đo baseline, review cổng |
| 2 | P2-1 (store), P2-6 | P2-2, P2-3, P2-4, P2-5 | review P2-1 |
| 3 | P3-4, P3-5, P4-1 | P3-1, P3-2, P3-3 | so ảnh export |
| 4 | P4-3, P5-1, P5-4 | P4-2, P5-2, P5-3 | review cuối, P6-2 |
| 5 (đệm) | P6-1, P6-3 | P6-3 | quét hồi quy, đo lại baseline |

## Việc của Assist cần đặt trước

- [x] Khung 9 section + `index.js` rỗng
- [x] `boundaries.json` + cổng đã kiểm chứng 4 ca
- [x] `tools/baseline.ps1`
- [x] Git baseline + khung
- [ ] Thêm cổng vào bước bắt buộc trước commit (P6-2)
- [ ] Duyệt mọi PR đổi `boundaries.json`
