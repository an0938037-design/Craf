/**
 * Adapter giữa mask và canvas — chuẩn `MaskAlpha` ở `core`, canvas ở tầng
 * `pixel` (hợp đồng docs/contracts/mask.md §4.5).
 *
 * Chuyển nguyên thuật toán từ `app/app.js`; chỉ đổi kiểu dữ liệu, không
 * "cải tiến", không đổi hành vi.
 */

import { clamp } from '../shared/index.js';
import { maskCreate } from '../core/index.js';

/** @typedef {Uint8Array} MaskAlpha 0..255, length = w*h, row-major, 1 byte/px, DOC PX */
/** @typedef {{x:number,y:number,w:number,h:number}} Rect DOC PX, số nguyên, w,h >= 1 */
/** @typedef {{rev:number,w:number,h:number,data:MaskAlpha,bbox:Rect}} Selection Tham chiếu `model.selection`. */

/**
 * Trích kênh alpha của canvas (doc px).
 * @param {HTMLCanvasElement} canvas Canvas phải đúng cỡ doc.
 * @returns {{data: MaskAlpha, w: number, h: number}}
 */
export function maskFromCanvas(canvas) {
  const { width: w, height: h } = canvas;
  const img = canvas.getContext('2d').getImageData(0, 0, w, h);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = img.data[i * 4 + 3];
  return { data, w, h };
}

/**
 * Dựng mask vùng polygon — fill như `maskFromPolygon` app.js:596-607
 * (nhất mực fill `#000`) rồi `maskFromCanvas`.
 * @param {{x:number,y:number}[]} points Đỉnh polygon (doc px).
 * @param {number} docW Rộng doc px.
 * @param {number} docH Cao doc px.
 * @returns {MaskAlpha}
 */
export function maskFromPolygon(points, docW, docH) {
  const canvas = document.createElement('canvas');
  canvas.width = docW;
  canvas.height = docH;
  const ctx = canvas.getContext('2d');
  if (points.length >= 3) {
    ctx.fillStyle = '#000';
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length; i++) ctx.lineTo(points[i].x, points[i].y);
    ctx.closePath();
    ctx.fill();
  }
  return maskFromCanvas(canvas).data;
}

/**
 * Vẽ `MaskAlpha` vào canvas. `rect` null → canvas cỡ doc, offset (0,0).
 * `rect` bbox → canvas b.w×b.h, offset (rect.x, rect.y); dùng `putImageData`
 * đúng vùng — KHÔNG ghi cả khung.
 * @param {MaskAlpha} data Mảng đầy doc px (row-major).
 * @param {number} w Rộng doc px.
 * @param {number} h Cao doc px.
 * @param {Rect|null} [rect=null] Bbox muốn lấy, đường gốc tại (rect.x, rect.y).
 * @returns {{canvas: HTMLCanvasElement, x: number, y: number}}
 */
export function maskToCanvas(data, w, h, rect = null) {
  const box = rect ?? { x: 0, y: 0, w, h };
  const canvas = document.createElement('canvas');
  canvas.width = box.w;
  canvas.height = box.h;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(box.w, box.h);
  const d = img.data;
  for (let py = 0; py < box.h; py++) {
    const sy = box.y + py;
    for (let px = 0; px < box.w; px++) {
      const sx = box.x + px;
      const src = (sy >= 0 && sy < h && sx >= 0 && sx < w) ? data[sy * w + sx] : 0;
      const di = (py * box.w + px) * 4;
      d[di] = 0; d[di + 1] = 0; d[di + 2] = 0; d[di + 3] = src;
    }
  }
  ctx.putImageData(img, 0, 0);
  return { canvas, x: box.x, y: box.y };
}

/**
 * Tạo mask vùng nội dung lớp (port `selectLayerContent` app.js:550-572):
 * alpha > 8 → 255, ngược lại 0.
 * @param {HTMLCanvasElement} layerCanvas Canvas lớp (doc cỡ doc).
 * @returns {MaskAlpha}
 */
export function maskFromLayerAlpha(layerCanvas) {
  const { width: w, height: h } = layerCanvas;
  const img = layerCanvas.getContext('2d').getImageData(0, 0, w, h);
  const data = new Uint8Array(w * h);
  for (let i = 0; i < w * h; i++) data[i] = img.data[i * 4 + 3] > 8 ? 255 : 0;
  return data;
}

/**
 * Region growing của wand (port `maskFromWand` app.js:609-643).
 * @param {ImageData|Uint8ClampedArray} pixels RGBA (`pixels.data` hoặc chính mảng).
 * @param {number} w Rộng doc px.
 * @param {number} h Cao doc px.
 * @param {number} x Toađ x click (doc px).
 * @param {number} y Toađ y click (doc px).
 * @param {number} tol Tolerance cầm, 0–255.
 * @returns {MaskAlpha}
 */
export function maskFromWand(pixels, w, h, x, y, tol) {
  const sx = Math.floor(x), sy = Math.floor(y);
  if (sx < 0 || sy < 0 || sx >= w || sy >= h) return maskCreate(w, h);
  const d = pixels.data ?? pixels;
  const start = (sy * w + sx) * 4;
  const tr = d[start], tg = d[start + 1], tb = d[start + 2];
  const t = clamp(tol, 0, 255);
  const near = (i) => Math.abs(d[i] - tr) <= t && Math.abs(d[i + 1] - tg) <= t && Math.abs(d[i + 2] - tb) <= t;
  const out = maskCreate(w, h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const idx = sy * w + sx;
  stack[sp++] = idx;
  out[idx] = 255;
  while (sp) {
    const p = stack[--sp];
    const px = p % w;
    const check = (q) => {
      if (out[q]) return;
      if (!near(q * 4)) return;
      out[q] = 255;
      stack[sp++] = q;
    };
    if (px > 0) check(p - 1);
    if (px < w - 1) check(p + 1);
    if (p >= w) check(p - w);
    if (p < (h - 1) * w) check(p + w);
  }
  return out;
}

/**
 * Dịch mask bằng canvas để giữ fidelity thập phân (port `translateSelection`
 * app.js:581-586; `core.maskShiftInt` là phiên bản số nguyên cho move-end).
 * @param {MaskAlpha} data
 * @param {number} w
 * @param {number} h
 * @param {number} dx Thập phân (doc px).
 * @param {number} dy Thập phân (doc px).
 * @returns {MaskAlpha}
 */
export function maskTranslate(data, w, h, dx, dy) {
  const src = maskToCanvas(data, w, h).canvas;
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  out.getContext('2d').drawImage(src, dx, dy);
  return maskFromCanvas(out).data;
}

/**
 * Đọc canvas → canvas bbox-sized, offset = sel.bbox (port đầu của
 * `copySelection` app.js:1766-1772). `destination-in` lấy layer ∩ mask.
 *
 * Dựng mask canvas từ `sel.data` (KHÔNG đọc `sel.mask`): field đó chỉ tồn tại
 * tạm ở C4 và bị xoá ở C5, nếu phụ thuộc vào nó thì C5 không thể chạy.
 * @param {HTMLCanvasElement} layerCanvas Canvas lớp (doc cỡ doc).
 * @param {Selection} sel `Selection` đang chọn (có `bbox`, `data`).
 * @returns {{canvas: HTMLCanvasElement, x: number, y: number}}
 */
export function maskExtract(layerCanvas, sel) {
  const { x, y, w, h } = sel.bbox;
  const maskCanvas = maskToCanvas(sel.data, sel.w, sel.h, sel.bbox).canvas;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(layerCanvas, -x, -y);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(maskCanvas, 0, 0);
  return { canvas, x, y };
}

/**
 * Mẫu để wand — port `compositeCanvas` app.js:1597-1616, trả `ImageData`.
 * @param {{w:number,h:number,bg:string,layers:Array<{visible:boolean,opacity:number,blend?:string,canvas:HTMLCanvasElement}>}} doc
 * @param {number} w Chiều rộng canvas trả về.
 * @param {number} h Chiều cao canvas trả về.
 * @param {boolean} [withBg=true] true → tô `doc.bg` nền đầu (như `compositeCanvas`).
 * @returns {ImageData}
 */
export function compositeSample(doc, w, h, withBg = true) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  const ctx = c.getContext('2d');
  if (withBg) {
    ctx.fillStyle = doc.bg;
    ctx.fillRect(0, 0, w, h);
  }
  const sx = w / doc.w, sy = h / doc.h;
  for (const l of doc.layers) {
    if (!l.visible || l.opacity <= 0) continue;
    ctx.globalAlpha = l.opacity / 100;
    ctx.globalCompositeOperation = l.blend || 'source-over';
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.drawImage(l.canvas, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return ctx.getImageData(0, 0, w, h);
}
