/**
 * Máy trạng thái của marquee/lasso (C8).
 *
 * Chỉ giữ dữ liệu gesture + luật "khi nào commit": không đọc `state`, không
 * chạm DOM. `commit()` gọi thẳng `selection.apply()` của model, nên app chỉ
 * còn việc đồng bộ UI sau khi nghe kết quả.
 */
import { previewGeometry, maskFromRect } from '../core/index.js';
import { maskFromPolygon } from '../pixel/index.js';
import { selection } from '../model/index.js';

/**
 * @param {'marquee'|'lasso'} tool
 * @param {{x:number,y:number}} pt Điểm doc.
 * @param {{add?:boolean,subtract?:boolean}} [mods]
 */
export function begin(tool, pt, mods = {}) {
  return {
    kind: 'marquee',
    tool,
    start: { x: pt.x, y: pt.y },
    current: { x: pt.x, y: pt.y },
    points: tool === 'lasso' ? [{ x: pt.x, y: pt.y }] : null,
    add: !!mods.add,
    subtract: !!mods.subtract,
    shift: false,
    moved: false,
  };
}

/**
 * Cập nhật gesture theo con trỏ.
 * @param {object} d
 * @param {{x:number,y:number}} pt
 * @param {boolean} [shiftKey]
 */
export function drag(d, pt, shiftKey = false) {
  d.current = { x: pt.x, y: pt.y };
  d.shift = shiftKey && !d.add;
  if (d.points) d.points.push({ x: pt.x, y: pt.y });
  if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) > 3) d.moved = true;
}

/** Preview cho `render/overlay` (shape của `state.selPreview`). */
export function preview(d) {
  if (d.tool === 'lasso') return { type: 'poly', points: d.points };
  return { type: 'rect', start: d.start, current: d.current, shift: d.shift, alt: false };
}

/**
 * Kết thúc gesture và áp vùng chọn.
 * @param {object} d
 * @param {{w:number,h:number}} doc
 * @returns {{kind:'applied'|'cleared'|'none', sel?:object|null}}
 */
export function commit(d, doc) {
  if (!d.moved) {
    if (!d.add && !d.subtract) {
      selection.clear();
      return { kind: 'cleared', sel: null };
    }
    return { kind: 'none' };
  }
  let mask;
  if (d.tool === 'lasso') {
    if (d.points.length < 3) return { kind: 'none' };
    mask = maskFromPolygon(d.points, doc.w, doc.h);
  } else {
    const g = previewGeometry(d);
    if (g.w < 1 || g.h < 1) return { kind: 'none' };
    mask = maskFromRect(g.x, g.y, g.w, g.h, doc.w, doc.h);
  }
  const mode = d.subtract ? 'subtract' : d.add ? 'add' : 'replace';
  const sel = selection.apply(mask, selection.isActive() ? mode : 'replace');
  return { kind: 'applied', sel };
}
