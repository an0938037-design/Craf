/**
 * Rasterize nét cọ (P4-2).
 *
 * Nhận đủ tham số từ ngoài (`color`, `opacity`, `hardness`, `erase`) — không
 * đọc `state`, không biết tool nào đang bật. Đây là phần "vẽ điểm ảnh" của
 * công cụ brush, phần chính sách nằm ở `app.js`/`tools`.
 */
import { clamp } from '../shared/index.js';
import { hexToRgb } from '../core/index.js';

/**
 * Một con dấu cọ tròn, mềm theo `hardness`.
 * @param {CanvasRenderingContext2D} ctx
 * @param {number} x
 * @param {number} y
 * @param {number} r Bán kính.
 * @param {string} color `#rrggbb`
 * @param {number} hardness 0..1 (tâm đặc tới đâu)
 */
export function stampBrush(ctx, x, y, r, color, hardness) {
  const rgb = hexToRgb(color);
  const solid = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
  const clear = `rgba(${rgb.r},${rgb.g},${rgb.b},0)`;
  const inner = clamp(hardness, 0, 0.97);
  const grad = ctx.createRadialGradient(x, y, Math.max(0.01, r * inner), x, y, Math.max(0.02, r));
  grad.addColorStop(0, solid);
  grad.addColorStop(inner, solid);
  grad.addColorStop(1, clear);
  ctx.fillStyle = grad;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/**
 * Vẽ một đoạn cọ giữa `a`→`b` (quadratic tới `c` nếu có).
 * @param {CanvasRenderingContext2D} ctx
 * @param {{x:number,y:number}} a
 * @param {{x:number,y:number}} b
 * @param {{x:number,y:number}|null} c
 * @param {{color:string,width:number,opacity:number,hardness:number,erase:boolean}} o
 */
export function paintSegment(ctx, a, b, c, o) {
  const r = Math.max(0.5, o.width / 2);
  ctx.save();
  ctx.globalCompositeOperation = o.erase ? 'destination-out' : 'source-over';
  ctx.globalAlpha = o.erase ? 1 : o.opacity;
  if (o.hardness >= 0.82) {
    ctx.strokeStyle = o.color;
    ctx.lineWidth = o.width;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    if (c) ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
    else ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.restore();
    return;
  }
  const at = (t) => c
    ? {
      x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
      y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
    }
    : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
  let len = 0;
  let prev = at(0);
  for (let i = 1; i <= 10; i++) {
    const p = at(i / 10);
    len += Math.hypot(p.x - prev.x, p.y - prev.y);
    prev = p;
  }
  const step = Math.max(0.7, r * 0.3);
  const n = Math.max(1, Math.ceil(len / step));
  for (let i = 0; i <= n; i++) {
    const p = at(i / n);
    stampBrush(ctx, p.x, p.y, r, o.color, o.hardness);
  }
  ctx.restore();
}
