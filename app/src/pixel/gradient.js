/**
 * Tô gradient tuyến tính / toả tròn (P4-3).
 *
 * Nhận đủ tham số từ ngoài (`w`, `h`, `color`, `bgColor`, `opacity`, `gradType`,
 * `clipPath`) — không đọc `state`, không tự chọn layer. Nhờ vậy cùng một hàm
 * dùng cho cả preview trên overlay lẫn commit vào layer.
 */

/**
 * Vẽ gradient phủ kín `w × h`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {{start:{x:number,y:number}, current:{x:number,y:number}, reverse?:boolean}} d
 * @param {{
 *   w: number,
 *   h: number,
 *   color: string,
 *   bgColor: string,
 *   opacity: number,
 *   gradType: 'linear'|'radial',
 *   clipPath?: Path2D|null
 * }} o
 */
export function gradientPaint(ctx, d, o) {
  const dx = d.current.x - d.start.x;
  const dy = d.current.y - d.start.y;
  const dist = Math.hypot(dx, dy);
  if (dist < 0.5) return;
  const c1 = d.reverse ? o.bgColor : o.color;
  const c2 = d.reverse ? o.color : o.bgColor;
  let grad;
  if (o.gradType === 'radial') {
    grad = ctx.createRadialGradient(d.start.x, d.start.y, 0, d.start.x, d.start.y, dist);
  } else {
    grad = ctx.createLinearGradient(d.start.x, d.start.y, d.current.x, d.current.y);
  }
  grad.addColorStop(0, c1);
  grad.addColorStop(1, c2);
  ctx.save();
  ctx.globalAlpha = o.opacity;
  if (o.clipPath) ctx.clip(o.clipPath, 'evenodd');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, o.w, o.h);
  ctx.restore();
}
