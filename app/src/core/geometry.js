/**
 * Hình học thuần: `bezierPoints` (giai đoạn 1), `previewGeometry` (marquee dựng
 * tạm), `shapeGeometry` (hình học dịch chọn — tham số `tool` thay `state.tool`).
 *
 * Chuyển nguyên văn từ app/app.js: `bezierPoints` (dòng 2965-2975),
 * `previewGeometry` (dòng 669-681), `shapeGeometry` (dòng 2252-2274).
 */

export function bezierPoints(p0, p1, p2, p3, count = 180) {
  const out = [];
  for (let i = 0; i <= count; i++) {
    const t = i / count, mt = 1 - t;
    out.push({
      x: mt * mt * mt * p0.x + 3 * mt * mt * t * p1.x + 3 * mt * t * t * p2.x + t * t * t * p3.x,
      y: mt * mt * mt * p0.y + 3 * mt * mt * t * p1.y + 3 * mt * t * t * p2.y + t * t * t * p3.y,
    });
  }
  return out;
}

/**
 * Chuyển nguyên văn `previewGeometry` app.js:669-681 — diện tích marquee
 * dựng tạm khi kéo.
 * @param {{start: {x:number,y:number}, current: {x:number,y:number}, shift: boolean, alt: boolean}} m
 * @returns {{x:number,y:number,w:number,h:number}}
 */
export function previewGeometry({ start, current, shift, alt }) {
  let x0 = start.x, y0 = start.y, x1 = current.x, y1 = current.y;
  if (shift) {
    const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    x1 = x0 + Math.sign(x1 - x0 || 1) * side;
    y1 = y0 + Math.sign(y1 - y0 || 1) * side;
  }
  if (alt) {
    x0 = start.x - (x1 - start.x);
    y0 = start.y - (y1 - start.y);
  }
  return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
}

/**
 * Chuyển nguyên văn `shapeGeometry` app.js:2252-2274 — hình học chỉnh lưới,
 * chỉnh bằng bằng đường chéo (tool `line`) và chỉnh tâm (alt).
 * @param {{start: {x:number,y:number}, current: {x:number,y:number}, shift: boolean, alt: boolean}} d
 * @param {string} tool Giá trị `state.tool`: 'line' | 'rect' | 'circle' | 'ellipse'.
 * @returns {{x0:number,y0:number,x1:number,y1:number}}
 */
export function shapeGeometry({ start, current, shift, alt }, tool) {
  let { x: x0, y: y0 } = start;
  let { x: x1, y: y1 } = current;
  if (shift) {
    if (tool === 'line') {
      const dx = x1 - x0, dy = y1 - y0;
      const ang = Math.atan2(dy, dx);
      const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
      const len = Math.hypot(dx, dy);
      x1 = x0 + Math.cos(snap) * len;
      y1 = y0 + Math.sin(snap) * len;
    } else {
      const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + Math.sign(x1 - x0 || 1) * side;
      y1 = y0 + Math.sign(y1 - y0 || 1) * side;
    }
  }
  if (alt) {
    x0 = start.x - (x1 - start.x);
    y0 = start.y - (y1 - start.y);
  }
  return { x0, y0, x1, y1 };
}
