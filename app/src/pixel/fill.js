import { hexToRgb } from '../core/index.js';

/**
 * Flood fill trên ctx lớp. Trả false nếu không tô (trùng màu / ngoài vùng chọn),
 * true nếu đã putImageData.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} w @param {number} h
 * @param {number} x Toạ độ nguyên, đã kiểm biên ở caller.
 * @param {number} y
 * @param {string} fillHex Màu tô (màu hiện tại).
 * @param {number} tol
 * @param {Uint8Array|null} selData Mask alpha toàn khung, hoặc null.
 */
export function floodFillLayer(ctx, w, h, x, y, fillHex, tol, selData = null) {
  const img = ctx.getImageData(0, 0, w, h);
  const data = new Uint32Array(img.data.buffer);
  const idx = y * w + x;
  const target = data[idx];
  const c = hexToRgb(fillHex);
  const fill = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
  if (target === fill) return false;
  const tr = target & 255, tg = (target >>> 8) & 255, tb = (target >>> 16) & 255, ta = (target >>> 24) & 255;
  const allowed = (p) => !selData || selData[p] > 127;
  if (!allowed(idx)) return false;
  const near = (v) => {
    const a = (v >>> 24) & 255;
    if (Math.abs(a - ta) > tol) return false;
    if (ta === 0) return true;
    return Math.abs((v & 255) - tr) <= tol && Math.abs(((v >>> 8) & 255) - tg) <= tol && Math.abs(((v >>> 16) & 255) - tb) <= tol;
  };
  const stack = new Int32Array(w * h);
  let sp = 0;
  stack[sp++] = idx;
  data[idx] = fill;
  while (sp) {
    const p = stack[--sp];
    const px = p % w;
    if (px > 0 && allowed(p - 1) && near(data[p - 1])) { data[p - 1] = fill; stack[sp++] = p - 1; }
    if (px < w - 1 && allowed(p + 1) && near(data[p + 1])) { data[p + 1] = fill; stack[sp++] = p + 1; }
    if (p >= w && allowed(p - w) && near(data[p - w])) { data[p - w] = fill; stack[sp++] = p - w; }
    if (p < (h - 1) * w && allowed(p + w) && near(data[p + w])) { data[p + w] = fill; stack[sp++] = p + w; }
  }
  ctx.putImageData(img, 0, 0);
  return true;
}
