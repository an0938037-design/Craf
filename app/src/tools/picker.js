/**
 * Công cụ hút màu (P4-6).
 *
 * Đổi toạ độ client → pixel của canvas rồi đọc màu. Chỉ nhận canvas được
 * truyền vào, nên không phụ thuộc `#paper` hay bất kỳ id DOM nào.
 */
import { sampleHex } from '../pixel/index.js';

/**
 * @param {HTMLCanvasElement} canvas
 * @param {number} clientX
 * @param {number} clientY
 * @returns {string} `#rrggbb`
 */
export function pickHex(canvas, clientX, clientY) {
  const r = canvas.getBoundingClientRect();
  const x = Math.floor((clientX - r.left) * canvas.width / r.width);
  const y = Math.floor((clientY - r.top) * canvas.height / r.height);
  return sampleHex(canvas, x, y);
}
