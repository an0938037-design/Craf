/**
 * Thao tác canvas của layer (P2-3).
 *
 * Model giữ metadata (`layerMeta`); file này là nơi duy nhất được tạo canvas
 * cho layer trong luồng dữ liệu. Không đọc `state`, không đổi layer đang chọn.
 */
import { layerMeta } from '../model/index.js';

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

/**
 * Layer mới đủ field, đúng thứ tự key cũ:
 * `id, name, visible, opacity, blend, canvas, ctx`.
 */
export function createLayer(w, h, name = 'Lớp') {
  const canvas = makeCanvas(w, h);
  return { ...layerMeta(name), canvas, ctx: canvas.getContext('2d') };
}

/** Sao chép canvas (port `copyCanvas` app.js). */
export function copyCanvas(src) {
  const c = makeCanvas(src.width, src.height);
  c.getContext('2d').drawImage(src, 0, 0);
  return c;
}

/** Thay canvas của layer, giữ nguyên metadata (port `replaceLayerImage` app.js). */
export function replaceLayerImage(layer, w, h) {
  const canvas = makeCanvas(w, h);
  layer.canvas = canvas;
  layer.ctx = canvas.getContext('2d');
}

/** Vẽ `up` đè lên `low` theo opacity/blend của `up` (port phần raster của `mergeDown`). */
export function mergeLayerInto(low, up) {
  low.ctx.save();
  low.ctx.globalAlpha = up.opacity / 100;
  low.ctx.globalCompositeOperation = up.blend || 'source-over';
  low.ctx.drawImage(up.canvas, 0, 0);
  low.ctx.restore();
}

/** Hợp nhất danh sách layer thành một canvas (port `flattenLayers` app.js). */
export function flattenLayers(layers, w, h) {
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  for (const l of layers) {
    if (!l.visible || l.opacity <= 0) continue;
    g.globalAlpha = l.opacity / 100;
    g.globalCompositeOperation = l.blend || 'source-over';
    g.drawImage(l.canvas, 0, 0);
  }
  g.globalAlpha = 1;
  g.globalCompositeOperation = 'source-over';
  return c;
}
