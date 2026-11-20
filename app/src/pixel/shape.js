/**
 * Hình học + rasterize shape (line/rect/ellipse) (P4-3).
 *
 * `shapeGeometry` chỉ tính toạ độ (snap Shift, đối xứng Alt), `shapePath` dựng
 * path, `paintShape` tô/viền. Không đọc `state`: tool và style được truyền vào,
 * nên overlay và layer dùng chung đúng một luật vẽ.
 */

/**
 * Tính 4 góc sau khi áp snap 45° (line) / vuông (rect, ellipse) và đối xứng.
 * @param {{start:{x:number,y:number}, current:{x:number,y:number}, shift?:boolean, alt?:boolean}} d
 * @param {string} tool
 * @returns {{x0:number,y0:number,x1:number,y1:number}}
 */
export function shapeGeometry(d, tool) {
  let { x: x0, y: y0 } = d.start;
  let { x: x1, y: y1 } = d.current;
  if (d.shift) {
    if (tool === 'line') {
      const dx = x1 - x0;
      const dy = y1 - y0;
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
  if (d.alt) {
    x0 = d.start.x - (x1 - d.start.x);
    y0 = d.start.y - (y1 - d.start.y);
  }
  return { x0, y0, x1, y1 };
}

/**
 * Dựng path của shape trên `ctx` (không stroke/fill).
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} tool line|rect|ellipse
 * @param {{x0:number,y0:number,x1:number,y1:number}} g
 */
export function shapePath(ctx, tool, g) {
  ctx.beginPath();
  if (tool === 'line') {
    ctx.moveTo(g.x0, g.y0);
    ctx.lineTo(g.x1, g.y1);
  } else if (tool === 'rect') {
    ctx.rect(Math.min(g.x0, g.x1), Math.min(g.y0, g.y1), Math.abs(g.x1 - g.x0), Math.abs(g.y1 - g.y0));
  } else {
    const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2;
    ctx.ellipse(cx, cy, Math.abs(g.x1 - g.x0) / 2, Math.abs(g.y1 - g.y0) / 2, 0, 0, Math.PI * 2);
  }
}

/**
 * Vẽ shape lên `ctx`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} d gesture (`start`, `current`, `shift`, `alt`)
 * @param {{tool:string, color:string, size:number, opacity:number, shapeFill:boolean}} o
 */
export function paintShape(ctx, d, o) {
  const g = shapeGeometry(d, o.tool);
  ctx.save();
  ctx.strokeStyle = o.color;
  ctx.fillStyle = o.color;
  ctx.lineWidth = o.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.globalAlpha = o.opacity;
  shapePath(ctx, o.tool, g);
  if (o.shapeFill && o.tool !== 'line') ctx.fill();
  else ctx.stroke();
  ctx.restore();
}
