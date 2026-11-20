/**
 * Vẽ composite của doc (P3-1).
 *
 * `render` là section duy nhất được vẽ lên canvas hiển thị, nên cả ba đường
 * (sân khấu, file xuất, thumbnail) dùng chung một luật vẽ ở đây. Không mutate
 * doc, không đụng history.
 */

/**
 * Vẽ doc lên một canvas đã có kích thước, theo hệ số thiết bị.
 * @param {HTMLCanvasElement} canvas
 * @param {object} doc
 * @param {number} ratio doc px → canvas px (thường `dpr() * zoom`)
 */
export function paintDoc(canvas, doc, ratio) {
  const ctx = canvas.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
  ctx.fillStyle = doc.bg;
  ctx.fillRect(0, 0, doc.w, doc.h);
  for (const layer of doc.layers) {
    if (!layer.visible || layer.opacity <= 0) continue;
    ctx.globalAlpha = layer.opacity / 100;
    ctx.globalCompositeOperation = layer.blend || 'source-over';
    ctx.drawImage(layer.canvas, 0, 0);
  }
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
}

/**
 * Composite ra canvas mới ở kích thước `w × h` (dùng cho lưu/xuất/thumb).
 * @param {object} doc
 * @param {number} w
 * @param {number} h
 * @param {boolean} [transparent=false] Bỏ lớp nền `doc.bg`.
 * @returns {HTMLCanvasElement}
 */
export function compositeDoc(doc, w, h, transparent = false) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const ctx = c.getContext('2d');
  if (!transparent) {
    ctx.fillStyle = doc.bg;
    ctx.fillRect(0, 0, w, h);
  }
  const sx = w / doc.w;
  const sy = h / doc.h;
  for (const l of doc.layers) {
    if (!l.visible || l.opacity <= 0) continue;
    ctx.globalAlpha = l.opacity / 100;
    ctx.globalCompositeOperation = l.blend || 'source-over';
    ctx.setTransform(sx, 0, 0, sy, 0, 0);
    ctx.drawImage(l.canvas, 0, 0);
  }
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  return c;
}

/**
 * Vẽ một layer vừa khung vào ô thumbnail `size × size` của panel layer.
 * @param {CanvasRenderingContext2D} ctx
 * @param {object} layer
 * @param {object} doc
 * @param {number} [size=76]
 */
export function drawLayerThumb(ctx, layer, doc, size = 76) {
  ctx.clearRect(0, 0, size, size);
  const s = Math.min(size / doc.w, size / doc.h);
  ctx.drawImage(
    layer.canvas,
    (size - doc.w * s) / 2,
    (size - doc.h * s) / 2,
    doc.w * s,
    doc.h * s,
  );
}
