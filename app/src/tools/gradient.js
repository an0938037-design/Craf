/**
 * Máy trạng thái công cụ gradient (P4-6).
 *
 * Giữ gesture + luật "kéo quá ngắn thì bỏ"; việc tô nằm ở `pixel/gradient.js`.
 */

/**
 * @param {object} layer
 * @param {{x:number,y:number}} pt
 * @param {boolean} reverse Shift giữ lúc bắt đầu.
 */
export function begin(layer, pt, reverse) {
  return {
    kind: 'gradient', layer, start: { x: pt.x, y: pt.y }, current: { x: pt.x, y: pt.y },
    reverse: !!reverse,
  };
}

/**
 * @param {object} d
 * @param {{x:number,y:number}} pt
 * @param {boolean} reverse
 */
export function drag(d, pt, reverse) {
  d.current = { x: pt.x, y: pt.y };
  d.reverse = !!reverse;
}

/** Độ dài gesture có đủ để commit xuống layer không (ngưỡng 2 doc px). */
export function hasLength(d, min = 2) {
  return Math.hypot(d.current.x - d.start.x, d.current.y - d.start.y) >= min;
}
