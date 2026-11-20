/**
 * Rasterize chữ nhiều dòng (P4-6).
 *
 * Không đọc `state`, không tự chọn layer: nhận đủ màu/cỡ/font/độ mờ và
 * `clipPath` (vùng chọn) từ phía gọi.
 */

/**
 * @param {CanvasRenderingContext2D} ctx
 * @param {string} text
 * @param {{x:number,y:number}} pt
 * @param {{color:string, size:number, font:string, opacity:number, clipPath?:Path2D|null}} o
 */
export function drawText(ctx, text, pt, o) {
  ctx.save();
  if (o.clipPath) ctx.clip(o.clipPath, 'evenodd');
  ctx.fillStyle = o.color;
  ctx.font = `500 ${o.size}px ${o.font}`;
  ctx.textBaseline = 'top';
  ctx.globalAlpha = o.opacity;
  text.split('\n').forEach((line, i) => ctx.fillText(line, pt.x, pt.y + i * o.size * 1.06));
  ctx.restore();
}
