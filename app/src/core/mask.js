/**
 * Mặt nạ vùng chọn — chuẩn `MaskAlpha` (Uint8Array, 1 byte/px, doc px).
 *
 * Thuật toán chuyển nguyên từ `app/app.js` (rect, polygon, translate) theo
 * hợp đồng docs/contracts/mask.md §4.1. Chỉ đổi kiểu dữ liệu: `|`/`&` → so
 * sánh `>`; không "cải tiến", không đổi hành vi.
 */

/** @typedef {Uint8Array} MaskAlpha 0..255, length = w*h, row-major, 1 byte/px, DOC PX */
/** @typedef {{x:number,y:number,w:number,h:number}} Rect DOC PX, số nguyên, w,h >= 1 */

/**
 * Tạo mask rỗng (alpha 0).
 * @param {number} w Rộng doc px (>= 0).
 * @param {number} h Cao doc px (>= 0).
 * @returns {MaskAlpha}
 */
export function maskCreate(w, h) {
  return new Uint8Array(w * h);
}

/**
 * Tạo mask đầy alpha `value` (mặc định 255).
 * @param {number} w
 * @param {number} h
 * @param {number} [value=255]
 * @returns {MaskAlpha} Mảng mới.
 */
export function maskAll(w, h, value = 255) {
  return new Uint8Array(w * h).fill(value);
}

/**
 * Tô mask bằng `fillRect(x, y, w, h)` (alpha 255), clip vào khung doc.
 * `w,h < 1` hoặc âm → mask rỗng (canvas `fillRect` bỏ qua nếu w,h < 1).
 * @param {number} x Điểm đầu vào (doc px, số nguyên).
 * @param {number} y Điểm đầu vào (doc px, số nguyên).
 * @param {number} w Chiều rộng.
 * @param {number} h Chiều cao.
 * @param {number} docW Rộng doc px.
 * @param {number} docH Cao doc px.
 * @returns {MaskAlpha} Mảng mới; input không bị mutate.
 */
export function maskFromRect(x, y, w, h, docW, docH) {
  const out = maskCreate(docW, docH);
  if (w < 1 || h < 1) return out;
  const x0 = Math.max(0, Math.floor(x));
  const y0 = Math.max(0, Math.floor(y));
  const x1 = Math.min(docW, Math.ceil(x + w));
  const y1 = Math.min(docH, Math.ceil(y + h));
  for (let py = y0; py < y1; py++) {
    const row = py * docW;
    for (let px = x0; px < x1; px++) out[row + px] = 255;
  }
  return out;
}

/**
 * Bounding box của pixels có alpha > 127.
 * @param {MaskAlpha} data
 * @param {number} w
 * @param {number} h
 * @returns {Rect|null}
 */
export function maskBounds(data, w, h) {
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    const row = y * w;
    for (let x = 0; x < w; x++) {
      if (data[row + x] > 127) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, w: maxX - minX + 1, h: maxY - minY + 1 };
}

/**
 * Đọc điểm ảnh (x, y số nguyên). Ngoài khung → false.
 * @param {MaskAlpha} data
 * @param {number} w
 * @param {number} h
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function maskPick(data, w, h, x, y) {
  if (x < 0 || y < 0 || x >= w || y >= h) return false;
  return data[y * w + x] > 127;
}

/**
 * Kết hợp 2 mask theo Porter-Duff — khớp `drawImage` hôm nay, không dùng
 * `|`/`&`; mọi phép tính dùng `Math.round` theo hợp đồng §4.1:
 *   replace:    b
 *   add:        a + b - round(a*b/255)          // source-over
 *   subtract:   round(a * (255-b) / 255)        // destination-out
 *   intersect:  round(a * b / 255)              // destination-in (mới)
 * @param {MaskAlpha} a
 * @param {MaskAlpha} b
 * @param {number} w
 * @param {number} h
 * @param {'replace'|'add'|'subtract'|'intersect'} mode
 * @returns {MaskAlpha} Mảng mới; input không bị mutate.
 */
export function maskMerge(a, b, w, h, mode) {
  const out = new Uint8Array(w * h);
  const n = w * h;
  if (mode === 'replace') {
    out.set(b);
  } else if (mode === 'add') {
    for (let i = 0; i < n; i++) out[i] = a[i] + b[i] - Math.round((a[i] * b[i]) / 255);
  } else if (mode === 'subtract') {
    for (let i = 0; i < n; i++) out[i] = Math.round((a[i] * (255 - b[i])) / 255);
  } else if (mode === 'intersect') {
    for (let i = 0; i < n; i++) out[i] = Math.round((a[i] * b[i]) / 255);
  } else {
    throw new Error(`maskMerge: mode không hợp lệ '${mode}'`);
  }
  return out;
}

/**
 * Đảo mask: `255 - a` (dùng cho `invertSelection`).
 * @param {MaskAlpha} data
 * @param {number} w
 * @param {number} h
 * @returns {MaskAlpha} Mảng mới.
 */
export function maskInvert(data, w, h) {
  const out = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) out[i] = 255 - data[i];
  return out;
}

/**
 * Dịch mask bởi (dx, dy) SỐ NGUYÊN; pixel nằm ngoài khung → 0.
 * KHÔNG dùng cho move-drag (cần fidelity thập phân — `pixel.maskTranslate`).
 * @param {MaskAlpha} data
 * @param {number} w
 * @param {number} h
 * @param {number} dx Số nguyên.
 * @param {number} dy Số nguyên.
 * @returns {MaskAlpha} Mảng mới.
 */
export function maskShiftInt(data, w, h, dx, dy) {
  const out = maskCreate(w, h);
  for (let y = 0; y < h; y++) {
    const sy = y - dy;
    if (sy < 0 || sy >= h) continue;
    const srcRow = sy * w, dstRow = y * w;
    for (let x = 0; x < w; x++) {
      const sx = x - dx;
      if (sx >= 0 && sx < w) out[dstRow + x] = data[srcRow + sx];
    }
  }
  return out;
}
