/**
 * Hình học thuần. Giai đoạn 1 chỉ chuyển `bezierPoints`.
 *
 * `shapeGeometry` ở lại app/app.js: nó đọc `state.tool` nên không thuần
 * (core không được đọc `state`, và đổi chữ ký để truyền `tool` là ngoài phạm vi).
 *
 * Chuyển nguyên văn từ app/app.js (dòng 2965-2975).
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
