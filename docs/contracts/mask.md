# Hợp đồng vùng chọn (mask) — `model` ↔ `pixel` ↔ `core`

> Trạng thái: **chốt**, dùng cho giai đoạn 2–4. Không phải đặc tả tính năng. Mọi chữ ký dưới đây là hợp đồng — implementer điền thân hàm, **không đổi tên/tham số/kiểu trả về**.
> Đo trên `app/app.js` @ 3.526 dòng, baseline `969a5b5`. Cổng: `node tools/check-boundaries.mjs` (đọc `boundaries.json`, chỉ kiểm **import**, không kiểm DOM — xem R3).

---

## 1. Quyết định chốt

| # | Quyết định | Lý do một dòng |
|---|---|---|
| D1 | Mask chuẩn = **`Uint8Array` dài `w*h`, 1 byte/px, alpha 0–255, row-major, toạ độ **doc px****. **Không** binarize (>127) khi lưu; chỉ threshold lúc dựng path. | 1,39 MiB thay vì 5,83 MiB; `core` sở hữu được; combine 2–5 ms; giữ nguyên alpha mịn cho copy/cut. |
| D2 | Canvas mask và `Path2D` là **cache dẫn xuất**, không nằm trong `doc`, chỉ sống trong module tiêu thụ, khoá theo `sel.rev`. | `core` cấm canvas/Path2D; `render` và `pixel` cấm import nhau ⇒ không thể có một cache dùng chung. |
| D3 | `doc.selection` do `model/selection.js` sở hữu, **bất biến**: mỗi thay đổi cấp object mới + `rev++`. Không ai ngoài `model` ghi. | 3 chỗ gán `state.sel` hôm nay đều là gán cả object ⇒ facade 1-1, không phải sửa 45 chỗ đọc. |
| D4 | Vùng chọn **không vào undo, không vào `.craf`** (giữ nguyên hành vi hôm nay). | `undo()/redo()` đã gọi `clearSelection()`; `saveNow` + `craf.py` đều whitelist field. |
| D5 | `pathFromSegments` → `core/path.js` trả **mảng lệnh số nguyên**; `Path2D` dựng ở `platform/path2d.js`. | Path2D là API canvas; `pixel` và `render` đều cần ⇒ nơi duy nhất cả hai được import là `platform`. |
| D6 | `shapeGeometry` → `core/geometry.js` với `tool` thành **tham số**. | `render.previewShape` cũng gọi nó; `render` không được import `tools`. |

**Điều kiện đổi ý (D1):** chỉ đổi sang canvas-chuẩn nếu Phase 3 chứng minh `core` không cần mask (không xảy ra: `maskBounds`, `maskSegments`, combine, `maskPick` đều thuần) **hoặc** nếu xuất hiện yêu cầu mask phi tuyến (blur/feather) mà canvas làm nhanh hơn ≥ 10×. Feather vẫn làm được trên `Uint8Array` (box blur 1 kênh) nên đây là điều kiện gần như không xảy ra.

---

## 2. Hiện trạng đo được (không phải giả định)

### 2.1. Những gì code đang làm (đọc từ `app/app.js`)

| Sự thật | Bằng chứng |
|---|---|
| Mask là **canvas RGBA cùng cỡ doc**, dựng bằng `fillRect`/`fill(polygon)`/`putImageData` | `newMask()` 428, `maskFromRect` 588, `maskFromPolygon` 596, `maskFromWand` 609 |
| **Mỗi lần** `setSelection` đọc lại **toàn khung 2 lần** (bounds + segments) | 513 `selectionBounds(out)`, 515 `maskSegments(out)` — mỗi hàm `getImageData(0,0,w,h)` |
| Combine chạy trên GPU: `add`=2×`drawImage`, `subtract`=`destination-out`; **không có `intersect`** | 503–512 |
| Clip khi vẽ dùng `Path2D` + `'evenodd'`, **12 chỗ** | 1173, 1778, 1811, 1826, 1860, 1865, 1873, 2011, 2181, 2225(?), 2312, 2400 |
| Mask bị đọc trực tiếp ở 4 chỗ | `copySelection` 1771, `beginMove` 2151, `floodFill` 2341, `pointInSelection` 578 |
| `translateSelection(dx,dy)` dùng `drawImage` với **dx/dy thập phân** (từ `dragMove`) ⇒ mask bị lấy mẫu lại, không phải dịch nguyên | 581–586 + 2192 |
| `.craf`: mask **không được lưu**; cả client lẫn server đều whitelist | `saveNow` 1630–1638; `craf.py::save_project` 294–315 (chỉ `name/visible/opacity/blend/src`) |
| `.craf` **không có** field `version` | cùng chỗ; `openProject` 323–348 không đọc version |
| Undo/redo xoá vùng chọn | 1553, 1566 |

### 2.2. Chi phí thật (Node 22 / V8, 1080×1350 = 1.458.000 px)

Chạy trên đúng khối lượng công việc của `selectionBounds`/`maskSegments`/combine, mỗi số là trung bình 10–20 lần, **đã gồm cấp phát mảng mới**:

| Việc | Kiểu dữ liệu | Thời gian |
|---|---|---|
| `maskBounds` (quét byte) | `Uint8Array` | **3,06 ms** |
| `maskSegments` (4 láng giềng) | `Uint8Array` | **21,54 ms** → 3.480 đoạn |
| `segments → commands` | mảng số | **3,70 ms** → 10.443 số nguyên |
| combine `add` (Porter-Duff `a+b−ab/255`) | `Uint8Array` | **3,79 ms** |
| combine `subtract` (`a(1−b/255)`) | `Uint8Array` | **4,76 ms** |
| `replace` (copy) | `Uint8Array` | 0,40 ms |
| `invert` (`255−a`) | `Uint8Array` | 2,79 ms |
| dịch nguyên (`maskShiftInt`) | `Uint8Array` | 3,66 ms |
| layer alpha → mask (`>8`) | RGBA → 1 kênh | 7,52 ms |

Ba thứ **không đo được ở Node** (phải đo ở C0 trên browser, `Path2D`/GPU): `getImageData` 5.832.000 byte, `putImageData`, `Path2D` build + 2 lần `stroke` của ants.

Kết luận định lượng: một lần chọn marquee hôm nay = **2 readback toàn khung (11,66 MB) + 21,5 ms quét segments** (quét trên RGBA stride 4, chậm hơn bản 1 kênh). Sau khi đổi = **0 readback + 3,06 + 21,54 + 3,70 ms**. Tức thiết kế mới **không chậm hơn** ở bất kỳ thao tác nào và bỏ được toàn bộ readback đồng bộ GPU→CPU — thứ gây giật khi canvas lớn.

Với doc lớn nhất (`craf.py` cho phép 8000×8000, UI cho 4000×4000): 16 M px ⇒ mask 16 MB, bounds ~34 ms, segments ~240 ms. Hôm nay cùng doc đó còn tệ hơn (segments trên RGBA). Không cần tối ưu thêm; nếu vượt ngưỡng nghiệm thu thì tối ưu **bên trong** `core` (không đổi chữ ký).

---

## 3. Q1 — Biểu diễn chuẩn

### 3.1. So sánh 3 phương án

| Phương án | Điểm mạnh | Điểm chết |
|---|---|---|
| **A. Canvas RGBA làm chuẩn** (hiện tại) | 0 dòng phải sửa; clip/copy dùng GPU | `core` bị chặn vĩnh viễn (cấm canvas) ⇒ mask ở lại `pixel`/`render`; mỗi op đọc lại 5,83 MB; không test được ngoài browser; không lưu `.craf` gọn được |
| **B. `Uint8Array` 1 kênh + cache canvas/Path2D dẫn xuất** ✅ | `core` thuần, test bằng Node; combine 2–5 ms; 1,39 MiB; alpha mịn giữ nguyên; đọc 1 điểm = 1 phép so sánh | Cần adapter 1 lần cho lasso/wand (`fill` + `getImageData`) và move-end (fidelity `drawImage`) |
| **C. Bit-packed 1 bit/px** | 0,18 MiB | **Đổi hành vi**: mất alpha mịn ở biên lasso ⇒ `copySelection`/`cut` ra viền răng cưa khác hôm nay. Combine phải bit-twiddle; bounds/segments vẫn phải giải nén từng dòng. Loại. |

**Chọn B.** Canvas **không** phải "phương án khác" mà là cache của B (`pixel/maskToCanvas`), dựng theo `bbox` nên thường chỉ vài trăm KB.

### 3.2. Hệ quả lên từng đường nóng

| Đường nóng | Hôm nay | Sau (B) | Số lần chuyển đổi |
|---|---|---|---|
| marquee mới (rect) | 2 readback + 1 drawImage | `maskFromRect` (thuần) → combine → bounds → segments | **0** |
| marquee add / subtract | 2 readback + 2 drawImage | `maskMerge` (3,8 / 4,8 ms) | **0** |
| lasso | fill canvas + 2 readback | `pixel.maskFromPolygon` = fill + **1** readback | 1 (không tránh được: cần khử răng cưa của `fill`) |
| wand | `compositeCanvas` + readback + 2 readback nữa | 1 readback composite (bắt buộc) + region grow trên mảng | 1 |
| ants | `stroke(state.sel.path)` mỗi ~95 ms | không đổi; path lấy từ cache `render` theo `rev` | 0 (không dựng lại path mỗi frame) |
| clip khi vẽ | `ctx.clip(path)` | không đổi | 0 |
| stroke/fill vùng chọn | `clip(path)` | không đổi | 0 |
| crop | `bbox` + `drawImage` | không đổi; `afterGeometryChange` xoá selection | 0 |
| copy/cut | `destination-in` với mask canvas | `pixel.maskToCanvas(data,w,h,bbox)` (**put theo bbox**, không theo khung) + `destination-in` | 1 put, cỡ bbox |
| move kết thúc | `drawImage` + `setSelection` (2 readback) | `pixel.maskTranslate` (drawImage fidelity) + 1 readback | **1** (giảm từ 3) |
| `pointInSelection` | `getImageData 1×1` | đọc 1 byte | 0 |
| `floodFill` giới hạn vùng chọn | `getImageData` toàn khung | dùng `sel.data` | 0 |

Tổng: **không thao tác nào tăng số lần đọc lại toàn khung**; 6/12 thao tác giảm về 0; 2 thao tác còn đúng 1 lần vì lý do fidelity/hành vi, không phải vì thiết kế.

---

## 4. Q2 — Chữ ký chính xác theo tầng

Kiểu dùng chung (khai báo trong JSDoc của `core/mask.js`, các section khác import kiểu bằng comment, không import giá trị):

```js
/** @typedef {Uint8Array} MaskAlpha  0..255, length = w*h, row-major, 1 byte/px, DOC PX */
/** @typedef {{x:number,y:number,w:number,h:number}} Rect  DOC PX, số nguyên, w,h >= 1 */
/** @typedef {{rev:number,w:number,h:number,data:MaskAlpha,bbox:Rect}} Selection */
/** @typedef {Int32Array} PathCommands  // [op,x,y, op,x,y, ...]; op: 0=M (đóng subpath trước), 1=L, 2=Z */
```

Quy ước chung, áp cho **mọi** hàm dưới đây:
- Toạ độ/kích thước: **doc px**, gốc trên-trái, `x` sang phải, `y` xuống. Không có hàm mask nào nhận device px — ants tự nhân `dpr()*zoom` ở `render`.
- Input là `MaskAlpha` thì **không bị mutate**; mọi hàm trả `MaskAlpha` đều **cấp mảng mới** (trừ khi ghi rõ `in-place`).
- Không hàm `core` nào nhận/trả canvas, `ImageData`, `Path2D`, phần tử DOM.
- Không hàm nào đọc global/`state`; `doc.w/doc.h` phải là tham số.

### 4.1. `core/mask.js` (tạo mới)

```js
maskCreate(w, h) -> MaskAlpha                       // zero-filled
maskAll(w, h, value = 255) -> MaskAlpha
maskFromRect(x, y, w, h, docW, docH) -> MaskAlpha   // clip vào khung; w,h<1 -> mask rỗng
maskBounds(data, w, h) -> Rect|null                 // ngưỡng >127; null nếu rỗng
maskPick(data, w, h, x, y) -> boolean               // x,y số nguyên; ngoài khung -> false
maskMerge(a, b, w, h, mode) -> MaskAlpha            // mode: 'replace'|'add'|'subtract'|'intersect'
maskInvert(data, w, h) -> MaskAlpha                 // 255 - a
maskShiftInt(data, w, h, dx, dy) -> MaskAlpha       // dx,dy SỐ NGUYÊN; ra ngoài -> 0
```
Công thức `maskMerge` **phải** là Porter-Duff, khớp `drawImage` hôm nay (không dùng `|`/`&`):
```
replace:   b
add:       a + b - round(a*b/255)          // source-over
subtract:  round(a * (255-b) / 255)        // destination-out
intersect: round(a * b / 255)              // destination-in  (mới, chưa dùng ở UI)
```

### 4.2. `core/path.js` (tạo mới)

```js
maskSegments(data, w, h, threshold = 127) -> Int32Array
// [x0,y0,x1,y1, ...] theo đúng thứ tự 4 cạnh của app.js:459-462.
// Duyệt y ngoài, x trong; cạnh trên, dưới, trái, phải. THỨ TỰ LÀ HỢP ĐỒNG (quyết định hình học của path).

segmentsToCommands(segs) -> PathCommands
// Thuật toán y hệt pathFromSegments (app.js:468-496), chỉ đổi đầu ra: moveTo->0,lineTo->1,closePath->2.
// Không có Path2D ở đây.
```

### 4.3. `core/geometry.js` (bổ sung file đã có)

```js
previewGeometry({ start, current, shift, alt }) -> { x, y, w, h }   // chuyển nguyên văn app.js:669-681
shapeGeometry({ start, current, shift, alt }, tool) -> { x0, y0, x1, y1 }
// chuyển app.js:2252-2274, thay `state.tool` bằng tham số `tool`.
```

### 4.4. `platform/path2d.js` (tạo mới)

```js
pathFromCommands(cmds) -> Path2D
// op 0: moveTo (và closePath nếu đang mở subpath), 1: lineTo, 2: closePath.
// Không biết gì về mask/selection — chỉ là cầu nối API canvas.
```

### 4.5. `pixel/mask.js` (tạo mới) — mọi adapter canvas

```js
maskFromCanvas(canvas) -> { data: MaskAlpha, w, h }        // lấy KÊNH ALPHA; canvas phải đúng cỡ doc
maskToCanvas(data, w, h, rect = null) -> { canvas, x, y }
// rect = null -> canvas cỡ doc, offset 0,0 (dùng tạm ở C4).
// rect = bbox -> canvas b.w×b.h, offset = rect.x/rect.y. Dùng putImageData trên đúng vùng, KHÔNG ghi cả khung.
maskFromPolygon(points, docW, docH) -> MaskAlpha            // fill AA như app.js:596-607 rồi maskFromCanvas
maskFromLayerAlpha(layerCanvas) -> MaskAlpha               // alpha > 8 -> 255, như app.js:555-568
maskFromWand(pixels, w, h, x, y, tol) -> MaskAlpha         // pixels: ImageData hoặc Uint8ClampedArray RGBA
maskTranslate(data, w, h, dx, dy) -> MaskAlpha             // dx,dy THẬP PHÂN; drawImage + readback để giữ đúng độ mượt
maskExtract(layerCanvas, sel) -> { canvas, x, y }          // layer ∩ mask, canvas bbox-sized, offset = sel.bbox
// CẤM đọc sel.mask (field tạm ở C4). Phải tự dựng: maskToCanvas(sel.data, sel.w, sel.h, sel.bbox).
compositeSample(doc, w, h, withBg = true) -> ImageData     // mẫu để wand; xem R7 (trùng 12 dòng với render)
```

### 4.6. `model/selection.js` (tạo mới) — chỉ `core` + `shared`

```js
get() -> Selection|null            // object bất biến; null = chưa chọn
isActive() -> boolean
apply(mask, mode) -> Selection|null
// mask: MaskAlpha đúng cỡ doc. mode như maskMerge. Trả object MỚI với rev = cũ+1,
// data mới, bbox = core.maskBounds(...). Rỗng (bbox null) -> clear() và trả null.
replace(selOrNull) -> void         // dùng cho openDoc / undo / applySnapshot
clear() -> void                    // replace(null) + selPreview = null (preview do render giữ)
contains(x, y) -> boolean          // core.maskPick(get().data, ...)
revision() -> number
configure({ getDocSize }) -> void  // BẮT BUỘC: () => ({w,h}) | null. Model không đọc global/state.
```
**Nguồn kích thước doc:** `apply()` cần `w,h` để cấp mảng và tính bbox, nhưng `model` không được đọc `state`. Vì vậy `shell/boot.js` (trước đây `app/app.js`) gọi `configure({ getDocSize })` **một lần** ngay sau khi `state` được tạo; `getDocSize` trả `{w,h}` của doc hiện tại hoặc `null`. Nếu chưa configure hoặc doc null ⇒ `apply()` trả `null` và không đổi trạng thái.

`clear()` **không** đụng `selPreview`: preview thuộc `render`, `shell/boot.js` (trước đây `app/app.js`) tự đặt `state.selPreview = null`.
`model/selection.js` **không** được: dựng canvas, dựng Path2D, gọi `render`, gọi `pixel`, đọc DOM. Nó chỉ giữ bytes + bbox + rev.

### 4.7. `render/overlay.js` (tạo mới ở P3-5)

```js
selectionPath(sel) -> Path2D|null
// cache 1-entry { rev, path }. rev đổi -> core.maskSegments + segmentsToCommands + platform.pathFromCommands.
// CẤM gọi trong vòng rAF của ants khi rev không đổi.
previewPath(preview) -> Path2D|null        // = selPreviewPath hiện tại
drawAnts(ctx, view, sel, preview) -> void  // view = { zoom, phase, guidesX, guidesY, guideDrag }
requestAnts() -> void
startAnts() -> void
```
`pixel/` có bản cache riêng cùng quy tắc (`pixel/selectionPath(sel)`), **không** import `render`.

### 4.8. `tools/marquee.js`, `tools/wand.js` (P4-2)

Không nhận/trả `MaskAlpha` ở API công khai. Chúng gọi:
```js
// marquee, trong pointerup:
const mask = tool === 'lasso'
  ? pixel.maskFromPolygon(points, docW, docH)
  : core.maskFromRect(g.x, g.y, g.w, g.h, docW, docH);
const sel = model.selection.apply(mask, mode);   // 'replace'|'add'|'subtract'
render.requestAnts();                            // qua bus/overlay, không import ui

// wand:
const px = pixel.compositeSample(doc, doc.w, doc.h, true);
const mask = pixel.maskFromWand(px, doc.w, doc.h, x, y, tol);
model.selection.apply(mask, mode);
```

---

## 5. Q3 — Ai được mutate, bất biến, undo

### 5.1. Ma trận quyền

| Tầng | Đọc `sel.data` | Ghi `sel.data` | Cấp `Selection` mới | Ghi `doc.layers` | Gọi render/ui |
|---|---|---|---|---|---|
| `core` | ✅ (tham số) | ❌ (chỉ trên mảng nó tự tạo) | ❌ | ❌ | ❌ |
| `model` | ✅ | ✅ **duy nhất** (luôn cấp mảng mới, không sửa tại chỗ) | ✅ duy nhất | ✅ | ❌ |
| `pixel` | ✅ (tham số) | ❌ | ❌ | ✅ qua tham số canvas | ❌ |
| `render` | ✅ (đọc) | ❌ | ❌ | ❌ | vẽ |
| `tools` | ❌ (chỉ qua `model.contains`) | ❌ | ❌ | ❌ | ❌ (bus) |
| `ui` | ❌ | ❌ | ❌ | ❌ | đọc `bbox/active` |

### 5.2. Bất biến (đưa vào review checklist)

1. `Selection.data` **không bao giờ** bị ghi sau khi `apply()` trả về. Không `Object.freeze` được TypedArray ⇒ bảo vệ bằng quy ước + review. `model.apply` luôn `new Uint8Array` (hoặc nhận mảng do `core`/`pixel` vừa cấp và chuyển quyền sở hữu: **bên gọi không dùng lại mảng đó nữa** — ghi rõ trong JSDoc).
2. `sel.w === doc.w && sel.h === doc.h`. Đổi cỡ giấy ⇒ `selection = null` (`afterGeometryChange` đã `clearSelection()`; giữ nguyên).
3. `sel.bbox` là **ảnh chụp tại thời điểm commit**, không tính lại, không sửa. Nó có thể không khớp nếu ai đó sửa `data` — bất biến #1 chặn việc đó.
4. `sel.rev` tăng đơn điệu, +1 mỗi `apply/replace/clear`. Cache dẫn xuất **chỉ** được dùng lại khi `rev` trùng.
5. Cache dẫn xuất giữ **tối đa 1 entry** mỗi module. Không Map theo rev (rò rỉ).
6. `state.sel` trong `shell/boot.js` (trước đây `app/app.js`; và facade `store` ở P2) là **view**: gán `state.sel = x` phải đi qua `model.selection.replace(x)`; đọc `state.sel` trả `model.selection.get()`. Giai đoạn chuyển tiếp được phép có thêm `state.sel.mask` (canvas, **getter lazy**) và `state.sel.path` (Path2D, eager) — hai field này **biến mất** ở C5/C6.

### 5.3. Undo — chính sách dứt khoát

- **Vùng chọn không nằm trong history.** Giữ nguyên hành vi: `undo()`/`redo()` gọi `clearSelection()` (app.js:1553, 1566). Không thêm `kind: 'selection'`.
- `snapshotDoc()` (1475) và `pushLayerSnapshot()` **cấm** đọc `doc.selection`. Nếu vô tình thêm: 24 bước doc-history × 1,39 MiB = **33 MiB**, cộng redo ⇒ **67 MiB**; với 50 bước như đề bài ⇒ **70 MiB** (chứ không phải 290 MB — 290 MB là con số của biểu diễn RGBA canvas, thêm một lý do loại A).
- Nếu sau này sản phẩm muốn undo vùng chọn: payload `{ rev, rects: RLE }`, RLE của một hình chữ nhật ~ vài chục byte; trần 20 entry; **không** lưu `data` trực tiếp. Ngoài phạm vi, ghi ở mục 11.

### 5.4. Bộ nhớ

| Vật thể | Cỡ @1080×1350 | Sống ở đâu |
|---|---|---|
| `sel.data` | 1,39 MiB | `doc.selection` |
| `pixel` canvas cache (chỉ khi copy/move) | 5,56 MiB (hoặc bbox-sized) | module `pixel` |
| `render` Path2D | ~10k lệnh | module `render` |
| `state.sel.path` tạm (C4→C6) | 1 Path2D | facade |

Đỉnh ~7 MiB khi copy — thấp hơn hôm nay (mask canvas 5,56 + canvas combine 5,56 + 2 `ImageData` 5,83×2 ≈ 23 MiB trong một lần `setSelection`).

---

## 6. Q4 — `.craf` có lưu mask không?

**Không, hôm nay không lưu. Giữ nguyên.**

Bằng chứng hai lớp, cả hai đều **whitelist** nên không thể lọt:
- Client: `saveNow()` dựng `payload` chỉ có `id, name, w, h, bg, createdAt, layers[{name,visible,opacity,blend,src}], thumb` (1630–1638).
- Server: `craf.py::save_project` (294–315) dựng lại `doc` từ đúng các field đó; field lạ bị bỏ.
- `openDoc` (300–321) reset `state.sel`; `openProject` (323–348) không đọc selection.

Hệ quả cho hợp đồng:
- Định dạng `.craf`: **không đổi**. Không thêm key `selection`, không thêm `version` (file hiện tại chưa có `version`; việc thêm `version` thuộc P2-5, độc lập với mask).
- `docs/contracts/mask.md` không cấp quyền cho bất kỳ ai thêm `doc.selection` vào `serialize.js`. Nếu sản phẩm muốn lưu vùng chọn sau này: key `selection: {src: data:image/png, w, h}` tái dùng đúng khuôn `layer.src`, kèm `version: 2` và đường đọc tương thích ngược (thiếu key ⇒ không có vùng chọn). **Không làm bây giờ.**

---

## 7. Sơ đồ luồng dữ liệu

```
                         (doc px, 1 kênh)
  pointer ──► tools/marquee|wand ──► pixel.maskFromRect|Polygon|Wand ──► MaskAlpha
                     │                                                     │
                     │ mode ('replace'|'add'|'subtract')                    │
                     ▼                                                     ▼
              model.selection.apply(mask, mode) ──► core.maskMerge ──► core.maskBounds
                     │                                          └─────► Selection {rev,w,h,data,bbox}
                     │                                                     │
        ┌────────────┴───────────────┬──────────────────────────┬──────────┴─────────┐
        ▼                            ▼                          ▼                    ▼
  render.requestAnts()        render.selectionPath(sel)   pixel.selectionPath(sel)  ui.updateSelectionUI()
  (rAF, ~95ms)                cache {rev,path}            cache {rev,path}          (đọc bbox/active)
        │                            │                          │
        ▼                            ▼                          ▼
  drawAnts(ctx) ◄── stroke(path)      clip() khi vẽ      clip()+maskToCanvas() khi
                                                          copy/cut/fill/stroke/levels
```

Quy tắc luồng:
- Mask chỉ đi **xuống** (tools → model → render/pixel). Không có chiều ngược.
- `render` không bao giờ tạo mask; `pixel` không bao giờ gọi `requestAnts`.
- `ui` không biết `MaskAlpha` tồn tại; nó chỉ thấy `{active, bbox}`.
- `shell/boot.js` (trước đây `app/app.js`) là nơi duy nhất nối `model.apply → render.requestAnts → ui.updateSelectionUI`.

---

## 8. Q6 — Thứ tự di chuyển (commit-sized, mỗi bước app vẫn chạy)

| Bước | Nội dung | File chạm | Cổng/nghiệm thu bước | Phụ thuộc | Rollback |
|---|---|---|---|---|---|
| **C0** | Đo baseline trên browser (không sửa code) | `docs/contracts/mask-baseline.md` (mới, Assist) | Ghi 6 số: latency marquee 300×400, marquee+shift, lasso 40 điểm, wand tol 32, move 100 px, số pixel ants của rect chuẩn | — | — |
| **C1** | `core/mask.js` + `core/path.js`; bổ sung `previewGeometry`, `shapeGeometry(d,tool)` | `app/src/core/mask.js`, `path.js`, `geometry.js`, `index.js` | `node tools/check-boundaries.mjs` SẠCH (chưa ai import ⇒ 0 rủi ro). Script rời (không commit) so `maskSegments` với fixture 3 ca: rect, tam giác lasso, 2 khối rời | — | xoá 3 file + 3 dòng export |
| **C2** | `platform/path2d.js` | `app/src/platform/path2d.js`, `index.js` | Cổng SẠCH; test tay: `pathFromCommands([0,0,0,1,10,0,1,10,10,2])` stroke ra tam giác | — | xoá file + 1 export |
| **C3** | `pixel/mask.js` (toàn bộ adapter, chưa dùng) + `pixel/compositeSample` | `app/src/pixel/mask.js`, `index.js` | Cổng SẠCH; so `maskFromCanvas(maskCũ)` với `getImageData` trên doc thật: **cùng 1.458.000 byte alpha** | — | xoá file + export |
| **C4** | **Switch biểu diễn.** `model/selection.js`; `app.js`: `newMask/selectionBounds/maskSegments/pathFromSegments/setSelection/clearSelection/selectAll/invertSelection/selectLayerContent/pointInSelection/translateSelection/maskFromRect/maskFromPolygon` gọi `core`+`pixel`+`model`. `state.sel` thành getter chỉ đọc; **`sel.path` dựng eager** (ants cần ngay), **`sel.mask` dựng PARESSEUX** (getter, chỉ copy/cut/move/floodFill đọc — xem ghi chú dưới) | `app/src/model/selection.js` (mới), `model/index.js`, `app/app.js` | Cổng SẠCH. Chạy checklist mục 4–7. So 6 số C0: **không số nào xấu hơn 10%**. Ảnh export PNG: hash trùng | C1–C3 | **Điểm rollback chính**: `git revert C4` — C1–C3 ở lại vô hại |
| **C5** | Bỏ `sel.mask` canvas: `copySelection`/`beginMove` dùng `pixel.maskExtract(layer.canvas, sel)`; `floodFill` dùng `sel.data` | `app/app.js` (1766–1772, 2147–2153, 2183, 2341–2342) | Copy/cut/move: hash `toDataURL` của layer trước/sau **trùng từng byte** với C0 (cùng thao tác, cùng toạ độ). `state.sel.mask` xuất hiện 0 lần trong `app.js` | C4 | revert C5 |
| **C6** | Bỏ `sel.path`: `drawAnts` + 12 chỗ `clip` lấy path từ `render.selectionPath(sel)` / `pixel.selectionPath(sel)` | `app/app.js`, (C7 sẽ chuyển tiếp) | Số pixel ants **bằng đúng** C0. Thêm đếm: `maskSegments` gọi **0 lần** trong 20 frame ants (bọc hàm bằng console) | C4 | revert C6 |
| **C7** | Chuyển `drawAnts/requestAnts/startAnts/previewGeometry/selPreviewPath/clearOverlay` → `render/overlay.js`; `maskFromWand/applyStrokeSelection/fillSelected/clearSelectedContent/copySelection/cropToSelection` → `pixel/` (P3-3, P3-5) | `render/`, `pixel/`, `app/app.js` | Cổng SẠCH; cổng chứng minh `render` **không** import `pixel` (đã có). Checklist 4–7, 13–14 | C5, C6 | revert từng section |
| **C8** | `tools/marquee.js` + `tools/wand.js` dùng `model.selection.apply`; xoá `beginMarquee/finishMarquee/wandSelect/syncMarqueePreview` khỏi `app.js` | `tools/`, `app/app.js` | Cổng SẠCH; `grep -r "from '.*ui" app/src/tools` rỗng; số đo C0 trùng | C7 | revert |

**Ghi chú C4 (đo 2026-11-20, 1080×1350):** dựng `sel.mask` **eager** tốn **58,7 ms/lần chọn** (full-frame `ImageData` 1.458.000 px) trong khi đường chọn không đọc nó — chỉ `copySelection`, `beginMove`, `floodFill` đọc. Vì vậy `sel.mask` là getter lazy. Đo cùng phiên: pipeline chọn mới **68,5 ms** vs code cũ **96,7 ms** (nhanh hơn 29%). Nếu ai đó "đơn giản hoá" thành eager, C4 sẽ **chậm hơn** code cũ ~20% và trượt A3 — đừng làm.

**Thứ tự an toàn:** C1, C2, C3 **độc lập hoàn toàn** — chia cho 2 người, không chạm file nhau (C1 `core/`, C2 `platform/`, C3 `pixel/`). C4 là nút thắt, phải một người, phải review. C5 và C6 **có thể đảo thứ tự** nhưng đừng gộp một commit: mỗi cái có một phép so riêng. C7 và C8 tách theo section, không gộp.

**Việc phải chốt trước C8 (không chặn C1–C7):** `tools` không thể import `bus` nếu bus nằm trong `shell` — `check-boundaries.mjs:87` chặn `tools(rank 6) → shell(rank 8)`, và `boundaries.json` liệt kê `bus` nhưng **không có section `bus`** trong `layers`, nên đường dẫn `../../shell/bus.js` sẽ fail cổng. Hai lối, chọn một ở P4-1: (a) `shared/emitter.js` = factory pub/sub thuần (không từ vựng domain, rank 1 → `tools`/`ui` import được), instance do `shell` tạo và **tiêm** vào `tools.configure({ bus })` lúc boot; (b) thêm `"bus"` vào `layers` (cần Assist duyệt `boundaries.json`). Khuyến nghị (a) — không phải sửa nguồn sự thật ranh giới.

---

## 9. Q7 — Tiêu chí nghiệm thu (đo trên browser thật, 1080×1350)

Mở `http://127.0.0.1:7317/`, tạo doc 1080×1350, dán vào console các phép đo. Mỗi mục ghi **trước / sau**, sai lệch phải bằng 0 trừ khi ghi rõ.

| # | Tiêu chí | Cách đo | Ngưỡng |
|---|---|---|---|
| A1 | Cổng ranh giới | `node tools/check-boundaries.mjs` | `KẾT QUẢ: SẠCH`, exit 0, **sau mỗi commit** |
| A2 | Không đọc lại toàn khung khi chọn | Bọc `CanvasRenderingContext2D.prototype.getImageData`, đếm số lần gọi có `w*h >= doc.w*doc.h` trong 1 thao tác | marquee add/subtract: **0**; lasso: **1**; wand: **1**; move-end: **1** |
| A3 | Thời gian một thao tác chọn | `t0 = performance.now()` trước `finishMarquee`, `t1` trong callback `requestAnimationFrame` đầu tiên sau `requestAnts` | marquee 300×400: **< 45 ms** và **không cao hơn C0 quá 10%**; lasso 40 điểm: **< 60 ms** |
| A4 | Ants không dựng lại path | Đếm số lần `core.maskSegments` được gọi trong 2 giây khi vùng chọn đứng yên | **0** (chỉ gọi lại khi `rev` đổi) |
| A5 | Hình học ants không đổi | Vùng chọn rect chuẩn, đếm pixel không trong suốt trên `#ants` (`getImageData` của chính canvas đó, đếm `a>0`) | **bằng đúng C0** (baseline ghi ở C0, ví dụ 1.800 px) |
| A6 | Wand tất định | Seed poster, click (540, 675), `tol = state.wandTol` | `bbox` trùng C0 **và** `sha256(sel.data)` trùng C0 |
| A7 | Copy/cut/move không lệch điểm ảnh | `sha256(layer.canvas.toDataURL())` trước/sau cùng một thao tác ở cùng toạ độ (dùng toạ độ nguyên cho copy/cut; 37,4 px cho move) | **trùng** |
| A8 | Export không đổi | Export PNG + JPEG mặc định, so hash file | **trùng** C0 |
| A9 | Bộ nhớ mask đúng | `model.selection.get().data.byteLength` | `=== doc.w * doc.h` |
| A10 | Combine đúng công thức | Lasso chồng lên rect, `subtract`, rồi `add`; đếm pixel `a===0`, `a===255`, `0<a<255` | 3 nhóm khác rỗng, `a>127` tạo ra đúng 1 path kín; không có pixel lạc ngoài hiệu 2 đa giác |
| A11 | Undo vẫn xoá vùng chọn | Chọn → cắt → undo | `sel.active === false` (hành vi hôm nay, không cải thiện) |
| A12 | Save → reload → mở lại | Như checklist mục 14 | ảnh khôi phục khớp; **vùng chọn không được khôi phục** (đúng thiết kế) |
| A13 | Doc lớn | 4000×4000, marquee 1000×1000 | < 150 ms; console 0 lỗi; RAM không tăng sau 10 lần chọn (kiểm bằng heap snapshot: không có 10 mảng `Uint8Array(16M)` sống) |

Nếu A3 hoặc A13 trượt: tối ưu **bên trong** `core.maskSegments` (duyệt theo dòng, tránh closure `inside`) — không đổi chữ ký, không đổi thứ tự cạnh.

---

## 10. Q8 — Rủi ro và cái gì sẽ chặn giai đoạn 2/3

| # | Rủi ro | Xác suất / Ảnh hưởng | Chặn bằng |
|---|---|---|---|
| R1 | Làm tròn Porter-Duff lệch ±1 so với GPU ⇒ pixel ở đúng ngưỡng 127/128 đổi phía, ants nhích 1 px | Trung bình / Thấp (chỉ ở biên lasso) | A10 + A5. Dùng đúng công thức `Math.round`; **không** thay bằng `\|`/`&` |
| R2 | Ai đó "tối ưu" `maskTranslate` thành dịch nguyên ⇒ biên mask lệch ≤ 1 px sau mỗi lần kéo | Trung bình / Trung bình (im lặng) | A7 với dx thập phân (37,4). Ghi cảnh báo trong JSDoc `maskShiftInt`: "KHÔNG dùng cho move-drag" |
| R3 | **Cổng không bắt được** vi phạm phi-import: `model` gọi `document.createElement`, `render` mutate `doc.selection` | Cao / Cao (kiến trúc mục ruỗng dần) | Review bắt buộc trên C4–C7: `grep -n "createElement\|getContext\|Path2D" app/src/model` phải rỗng; `grep -n "selection\." app/src/render` chỉ đọc |
| R4 | `doc.selection` lọt vào `snapshotDoc` ⇒ +33–67 MiB history, undo chậm | Trung bình / Cao | Mục 5.3 + A11. Thêm 1 dòng vào checklist review: "history không đọc `doc.selection`" |
| R5 | `rev` không tăng (ai đó sửa `data` tại chỗ) ⇒ ants hiển thị vùng chọn cũ | Thấp / Cao (sai im lặng) | Bất biến #1 + `maskMerge` luôn cấp mảng mới; A4 phát hiện nếu path cũ bị dùng lại |
| R6 | `pixel.compositeSample` trôi khỏi `render.compositeCanvas` ⇒ wand chọn khác | Trung bình / Trung bình | A6; thêm 1 phép so trong C7: `compositeSample` vs `compositeCanvas` trên doc 3 lớp + blend khác `source-over`, 1.458.000 px phải trùng **từng byte** |
| R7 | Cache 1-entry bị "nâng cấp" thành Map ⇒ rò rỉ 1,39 MiB/lần chọn | Thấp / Trung bình | A13 (heap), review |
| R8 | `state.sel.mask/path` tạm ở C4 bị coi là API vĩnh viễn ⇒ mask canvas quay lại thành chuẩn ngầm | Trung bình / Cao | C5/C6 là **bắt buộc**, không phải "nice to have"; A2 (0 readback) không đạt nếu còn |

### Nếu chọn sai (canvas làm chuẩn), cái gì chặn?

- **Chặn giai đoạn 2:** `model` không thể sở hữu mask (canvas = DOM). `selection.js` phải nằm ở `pixel`, tức `model/store` không có mask ⇒ P2-6 ("0 chỗ đọc `state.` ngoài `model/`") không thể đạt, vì mask buộc phải đọc `state.doc`.
- **Chặn giai đoạn 3:** `cropToSelection`/`flipDoc`/`rotateDoc` (`pixel/ops.js`) sẽ phải biến đổi mask qua canvas mỗi lần: +5,83 MB readback + 5,83 MB write mỗi phép, và `render` không được import `pixel` nên ants phải nhận canvas qua tham số — `render/overlay.js` mất tính "chỉ đọc `model`".
- **Chặn giai đoạn 4:** `tools/marquee` buộc phải import `pixel` cho *mọi* thao tác mask (kể cả `invert`, `bounds`), `tools` không còn là máy trạng thái thuần mà thành nơi chứa thuật toán mask; và không có cách nào test vùng chọn ngoài browser (không có test runner).
- **Không chặn nhưng mất cửa:** lưu vùng chọn vào `.craf` sau này sẽ phải PNG-encode cả khung cho mỗi lần lưu.

---

## 11. Ngoài phạm vi hợp đồng này (ghi để khỏi tranh cãi giữa đường)

1. **`intersect` cho UI.** `maskMerge` có `'intersect'` nhưng chưa tool nào dùng; không thêm cờ UI trong giai đoạn 2–4.
2. **Undo cho vùng chọn.** Không làm (mục 5.3). Nếu làm: RLE + trần 20 + không lưu `data`.
3. **Lưu vùng chọn vào `.craf`.** Không làm (mục 6).
4. **Feather / blur mask.** Không làm; nếu làm, thêm `core.maskBlur(data,w,h,radius)` — đổi `Uint8Array`, không đổi hợp đồng Selection.
5. **`maskFromWand` "contiguous = false"** (chọn mọi pixel gần màu). Không làm.
6. **Đa vùng chọn rời + phép đại số.** `maskMerge` đã hỗ trợ; UI chưa.
