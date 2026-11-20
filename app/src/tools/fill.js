/**
 * Công cụ đổ màu (P4-6).
 *
 * Bọc `pixel/floodFillLayer` + luật "bấm ra ngoài doc thì thôi". Dung sai giữ
 * đúng 44 như bản monolith; màu và mask vùng chọn do phía gọi truyền vào.
 */
import { floodFillLayer } from '../pixel/index.js';

/** Dung sai cố định của công cụ đổ màu. */
export const FILL_TOLERANCE = 44;

/**
 * @param {object} layer
 * @param {{w:number,h:number}} doc
 * @param {{x:number,y:number}} pt
 * @param {{color:string, selData?:Uint8Array|null, tol?:number}} o
 * @returns {boolean} Có tô hay không (bấm ngoài biên → `false`).
 */
export function fillAt(layer, doc, pt, o) {
  const x = Math.floor(pt.x);
  const y = Math.floor(pt.y);
  if (x < 0 || y < 0 || x >= doc.w || y >= doc.h) return false;
  floodFillLayer(layer.ctx, doc.w, doc.h, x, y, o.color, o.tol == null ? FILL_TOLERANCE : o.tol, o.selData || null);
  return true;
}
