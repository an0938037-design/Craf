/**
 * Chỉnh độ sáng/tương phản/levels và bộ lọc điểm ảnh (P3-4).
 *
 * Mọi hàm nhận canvas và trả canvas (hoặc ghi vào layer được truyền), không đọc
 * `state`, không biết tool nào đang bật. `clamp` lấy từ `shared`.
 */
import { clamp } from '../shared/index.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Chuỗi CSS filter cho các thanh adjust.
 * @param {object} v
 */
export function adjustFilter(v) {
  const parts = [];
  if (v.bright) parts.push(`brightness(${100 + v.bright}%)`);
  if (v.contrast) parts.push(`contrast(${100 + v.contrast}%)`);
  if (v.saturate !== 100) parts.push(`saturate(${v.saturate}%)`);
  if (v.hue) parts.push(`hue-rotate(${v.hue}deg)`);
  if (v.blur) parts.push(`blur(${v.blur}px)`);
  if (v.gray) parts.push('grayscale(1)');
  if (v.sepia) parts.push('sepia(1)');
  if (v.invert) parts.push('invert(1)');
  return parts.length ? parts.join(' ') : 'none';
}

/**
 * Áp levels (black/white/gamma) tại chỗ lên canvas.
 * @param {HTMLCanvasElement} canvas
 * @param {number} black
 * @param {number} white
 * @param {number} gamma Hệ số thật (1 = không đổi).
 */
export function applyLevels(canvas, black, white, gamma) {
  if (black === 0 && white === 255 && Math.abs(gamma - 1) < 0.001) return canvas;
  const g = canvas.getContext('2d');
  const img = g.getImageData(0, 0, canvas.width, canvas.height);
  const d = img.data;
  const range = Math.max(1, white - black);
  const lut = new Uint8ClampedArray(256);
  for (let i = 0; i < 256; i++) {
    const n = clamp((i - black) / range, 0, 1);
    lut[i] = Math.round(255 * Math.pow(n, 1 / gamma));
  }
  for (let i = 0; i < d.length; i += 4) {
    if (!d[i + 3]) continue;
    d[i] = lut[d[i]];
    d[i + 1] = lut[d[i + 1]];
    d[i + 2] = lut[d[i + 2]];
  }
  g.putImageData(img, 0, 0);
  return canvas;
}

/**
 * Tích chập 3×3 (sharpen/emboss).
 * @param {HTMLCanvasElement} src
 * @param {number[]} kernel 9 phần tử, hàng trước.
 * @param {number} [divisor=1]
 * @param {number} [offset=0]
 */
export function convolveCanvas(src, kernel, divisor = 1, offset = 0) {
  const w = src.width, h = src.height;
  const sctx = src.getContext('2d');
  const img = sctx.getImageData(0, 0, w, h);
  const out = sctx.createImageData(w, h);
  const sd = img.data, od = out.data;
  for (let y = 1; y < h - 1; y++) {
    for (let x = 1; x < w - 1; x++) {
      const i = (y * w + x) * 4;
      if (sd[i + 3] === 0) continue;
      let r = 0, g = 0, b = 0;
      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const j = ((y + ky) * w + (x + kx)) * 4;
          const k = kernel[(ky + 1) * 3 + (kx + 1)];
          r += sd[j] * k;
          g += sd[j + 1] * k;
          b += sd[j + 2] * k;
        }
      }
      od[i] = clamp(r / divisor + offset, 0, 255);
      od[i + 1] = clamp(g / divisor + offset, 0, 255);
      od[i + 2] = clamp(b / divisor + offset, 0, 255);
      od[i + 3] = sd[i + 3];
    }
  }
  const c = makeCanvas(w, h);
  c.getContext('2d').putImageData(out, 0, 0);
  return c;
}

/**
 * Bộ lọc một bước cho menu Filter.
 * @param {HTMLCanvasElement} original
 * @param {string} kind blur|gray|sepia|invert|sharpen|emboss|vignette|grain|pixel|noise
 * @param {number} w
 * @param {number} h
 * @returns {HTMLCanvasElement}
 */
export function filterCanvas(original, kind, w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  if (kind === 'blur') {
    g.filter = 'blur(4px)';
    g.drawImage(original, 0, 0);
    g.filter = 'none';
  } else if (kind === 'gray' || kind === 'sepia' || kind === 'invert') {
    g.filter = kind === 'gray' ? 'grayscale(1)' : kind === 'sepia' ? 'sepia(1)' : 'invert(1)';
    g.drawImage(original, 0, 0);
    g.filter = 'none';
  } else if (kind === 'sharpen') {
    g.drawImage(convolveCanvas(original, [0, -1, 0, -1, 5, -1, 0, -1, 0]), 0, 0);
  } else if (kind === 'emboss') {
    g.drawImage(convolveCanvas(original, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 1, 128), 0, 0);
  } else if (kind === 'vignette') {
    g.drawImage(original, 0, 0);
    const cx = w / 2, cy = h / 2;
    const radius = Math.hypot(w, h) / 2;
    const grad = g.createRadialGradient(cx, cy, radius * 0.34, cx, cy, radius);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(0.58, 'rgba(0,0,0,0.06)');
    grad.addColorStop(1, 'rgba(0,0,0,0.74)');
    g.globalCompositeOperation = 'source-atop';
    g.fillStyle = grad;
    g.fillRect(0, 0, w, h);
    g.globalCompositeOperation = 'source-over';
  } else if (kind === 'grain') {
    g.drawImage(original, 0, 0);
    const img = g.getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const luma = (d[i] + d[i + 1] + d[i + 2]) / 3;
      const amp = 0.65 + (1 - luma / 255) * 0.55;
      const n = (Math.random() - 0.5) * 58 * amp;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    g.putImageData(img, 0, 0);
  } else if (kind === 'pixel') {
    const sw = Math.max(1, Math.round(w / 16));
    const sh = Math.max(1, Math.round(h / 16));
    const small = makeCanvas(sw, sh);
    small.getContext('2d').drawImage(original, 0, 0, sw, sh);
    g.imageSmoothingEnabled = false;
    g.drawImage(small, 0, 0, w, h);
    g.imageSmoothingEnabled = true;
  } else if (kind === 'noise') {
    const img = original.getContext('2d').getImageData(0, 0, w, h);
    const d = img.data;
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      const n = (Math.random() - 0.5) * 54;
      d[i] = clamp(d[i] + n, 0, 255);
      d[i + 1] = clamp(d[i + 1] + n, 0, 255);
      d[i + 2] = clamp(d[i + 2] + n, 0, 255);
    }
    c.getContext('2d').putImageData(img, 0, 0);
  } else {
    g.drawImage(original, 0, 0);
  }
  return c;
}

/**
 * Ghi `filtered` lên layer, chỉ trong vùng chọn nếu có.
 * @param {object} layer
 * @param {HTMLCanvasElement} original
 * @param {HTMLCanvasElement} filtered
 * @param {Path2D|null} clipPath
 */
export function paintClippedOver(layer, original, filtered, clipPath) {
  const ctx = layer.ctx;
  const w = layer.canvas.width;
  const h = layer.canvas.height;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  ctx.drawImage(original, 0, 0);
  if (clipPath) {
    ctx.save();
    ctx.clip(clipPath, 'evenodd');
    ctx.drawImage(filtered, 0, 0);
    ctx.restore();
  } else {
    ctx.drawImage(filtered, 0, 0);
  }
}
