/**
 * Rasterize thao tác di chuyển layer / vùng chọn (P4-4).
 *
 * Tách khỏi `app.js` phần "vẽ lại layer sau khi dịch": nhận canvas nguồn, mask
 * vùng chọn và độ dời, không đọc `state`. Chính sách (khi nào push history, khi
 * nào dịch vùng chọn) vẫn ở phía gọi.
 */
import { copyCanvas } from './layers.js';
import { maskToCanvas } from './mask.js';

/**
 * Cắt phần layer nằm trong vùng chọn thành canvas riêng (để dịch đi).
 * @param {object} layer
 * @param {{data: Uint8Array, bbox: {x:number,y:number,w:number,h:number}}} sel
 * @param {{w:number,h:number}} doc
 * @returns {HTMLCanvasElement}
 */
export function pickSelection(layer, sel, doc) {
  const picked = copyCanvas(layer.canvas);
  const pg = picked.getContext('2d');
  pg.globalCompositeOperation = 'destination-in';
  const mk = maskToCanvas(sel.data, doc.w, doc.h, sel.bbox).canvas;
  pg.drawImage(mk, sel.bbox.x, sel.bbox.y);
  pg.globalCompositeOperation = 'source-over';
  return picked;
}

/**
 * Vẽ lại layer sau khi dịch `dx/dy`.
 *
 * Có vùng chọn: giữ nguyên layer gốc rồi khoét đúng vùng chọn, sau đó dán phần
 * đã cắt sang vị trí mới. Không có vùng chọn: dán cả ảnh nguồn ở vị trí mới.
 *
 * @param {object} layer
 * @param {{src: HTMLCanvasElement, sel: HTMLCanvasElement|null, useSel: boolean, dx: number, dy: number}} d
 * @param {{w:number,h:number, clipPath: Path2D|null}} o
 */
export function moveLayer(layer, d, o) {
  const ctx = layer.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, o.w, o.h);
  if (d.useSel && d.sel && o.clipPath) {
    ctx.drawImage(d.src, 0, 0);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.fill(o.clipPath, 'evenodd');
    ctx.restore();
    ctx.drawImage(d.sel, d.dx, d.dy);
  } else {
    ctx.drawImage(d.src, d.dx, d.dy);
  }
}
