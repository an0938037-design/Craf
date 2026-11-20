/**
 * Máy trạng thái nét cọ (P4-5).
 *
 * Giữ đúng 3 pha của `app.js` cũ: đặt một con dấu ngay khi nhấn, nối bằng
 * quadratic khi kéo, và khép nét bằng một đoạn thẳng ở `pointerup`. Mọi tham
 * số style do phía gọi bơm vào (`color`, `baseSize`, `hardness`, `opacity`,
 * `erase`) nên module không đọc `state`.
 */
import { paintSegment, stampBrush } from '../pixel/index.js';

/**
 * Bề rộng cọ theo lực nhấn (bút cảm áp); chuột luôn cho `pressure = 0.5`.
 * @param {number} base `state.size`
 * @param {number|null} pressure
 */
export function widthFor(base, pressure) {
  if (pressure == null) return base;
  return Math.max(0.6, base * (0.58 + 0.84 * pressure));
}

/**
 * Bắt đầu nét: một con dấu tại điểm nhấn.
 * @param {object} layer
 * @param {{x:number,y:number,pressure?:number}} pt
 * @param {{color:string, baseSize:number, hardness:number, opacity:number, erase:boolean}} o
 */
export function begin(layer, pt, o) {
  const ctx = layer.ctx;
  ctx.save();
  ctx.globalCompositeOperation = o.erase ? 'destination-out' : 'source-over';
  const w = widthFor(o.baseSize, pt.pressure);
  ctx.globalAlpha = o.erase ? 1 : o.opacity;
  stampBrush(ctx, pt.x, pt.y, Math.max(0.5, w / 2), o.color, o.hardness);
  ctx.restore();
  return { kind: 'paint', layer, last: pt, mid: pt, erase: o.erase };
}

/**
 * Nối thêm một đoạn khi con trỏ di chuyển.
 * @param {object} d gesture do `begin` trả
 * @param {{x:number,y:number,pressure?:number}} pt
 * @param {{color:string, baseSize:number, hardness:number, opacity:number}} o
 */
export function drag(d, pt, o) {
  const mid = { x: (d.last.x + pt.x) / 2, y: (d.last.y + pt.y) / 2 };
  const w = widthFor(o.baseSize, pt.pressure);
  paintSegment(d.layer.ctx, d.mid, d.last, mid, {
    color: o.color, width: w, erase: d.erase, opacity: o.opacity, hardness: o.hardness,
  });
  d.mid = mid;
  d.last = pt;
}

/**
 * Kết thúc nét bằng đoạn thẳng cuối (không cong).
 * @param {object} d
 * @param {{color:string, baseSize:number, hardness:number, opacity:number}} o
 */
export function end(d, o) {
  paintSegment(d.layer.ctx, d.mid, d.last, null, {
    color: o.color, width: widthFor(o.baseSize, 0.5), erase: d.erase, opacity: o.opacity, hardness: o.hardness,
  });
}
