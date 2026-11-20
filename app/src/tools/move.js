/**
 * Máy trạng thái công cụ di chuyển (P4-6).
 *
 * Chia làm hai bước rõ ràng để phía gọi chen được `pushDocHistory()` **trước**
 * khi layer bị ghi đè: `plan()` chỉ tính độ dời (thuần), `apply()` mới vẽ lại.
 */
import { copyCanvas, pickSelection, moveLayer } from '../pixel/index.js';

/**
 * Bắt đầu kéo: chụp lại layer và (nếu bấm trong vùng chọn) cắt phần được chọn.
 * @param {object} layer
 * @param {{x:number,y:number}} pt
 * @param {{useSel:boolean, sel?:object|null, doc:{w:number,h:number}}} o
 */
export function begin(layer, pt, o) {
  const picked = o.useSel && o.sel ? pickSelection(layer, o.sel, o.doc) : null;
  return {
    kind: 'move', layer, src: copyCanvas(layer.canvas), sel: picked, start: pt,
    dx: 0, dy: 0, moved: false, pushed: false, useSel: !!o.useSel,
  };
}

/**
 * Tính độ dời cho lần kéo này. Không đụng canvas.
 * @param {object} d
 * @param {{x:number,y:number}} pt
 * @param {boolean} shiftKey
 * @returns {{moved:boolean, firstPush:boolean, dx:number, dy:number}}
 */
export function plan(d, pt, shiftKey) {
  let dx = pt.x - d.start.x;
  let dy = pt.y - d.start.y;
  if (shiftKey) {
    if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
  }
  if (Math.hypot(dx, dy) < 0.5) return { moved: false, firstPush: false, dx: d.dx, dy: d.dy };
  const firstPush = !d.pushed;
  d.pushed = true;
  d.moved = true;
  d.dx = dx;
  d.dy = dy;
  return { moved: true, firstPush, dx, dy };
}

/**
 * Vẽ lại layer theo `d.dx/d.dy` vừa được `plan()` cập nhật.
 * @param {object} d
 * @param {{w:number,h:number, clipPath:Path2D|null}} o
 */
export function apply(d, o) {
  moveLayer(d.layer, d, o);
}
