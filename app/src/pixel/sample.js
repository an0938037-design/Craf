/**
 * Lấy màu tại một điểm ảnh (P3-5).
 *
 * Chỉ đọc pixel, không đổi state. Toạ độ được kẹp vào biên canvas để lấy mẫu
 * ở rìa không ném lỗi.
 */
import { clamp } from '../shared/index.js';
import { rgbToHex } from '../core/index.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} x
 * @param {number} y
 * @returns {string} `#rrggbb`
 */
export function sampleHex(canvas, x, y) {
  const cx = clamp(Math.floor(x), 0, Math.max(0, canvas.width - 1));
  const cy = clamp(Math.floor(y), 0, Math.max(0, canvas.height - 1));
  const d = canvas.getContext('2d').getImageData(cx, cy, 1, 1).data;
  return rgbToHex(d[0], d[1], d[2]);
}
