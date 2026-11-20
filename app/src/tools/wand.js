/**
 * Công cụ đũa thần (C8).
 *
 * Nhận doc + điểm + dung sai, gọi `pixel` để lấy mask rồi `selection.apply`.
 * Không đọc `state`, không toast — câu chữ thuộc UI.
 */
import { wandMask } from '../pixel/index.js';
import { selection } from '../model/index.js';

/**
 * @param {{w:number,h:number}} doc
 * @param {number} x
 * @param {number} y
 * @param {number} tol
 * @param {'replace'|'add'|'subtract'} [mode='replace']
 * @returns {object|null} Selection sau khi áp, hoặc `null` nếu rỗng.
 */
export function selectAt(doc, x, y, tol, mode = 'replace') {
  const mask = wandMask(doc, x, y, tol);
  return selection.apply(mask, selection.isActive() ? mode : 'replace');
}
