/**
 * `shell/geometry.js` — hình học bản vẽ: resize/canvas/crop/flip/rotate lớp,
 * cập nhật meta hiển thị. Tách từ `shell/boot.js` (P5-9).
 *
 * Hàm boot-local của `boot.js` dùng ở đây được tiêm 1 lần qua
 * `configureGeometry({...})` trong `boot()` trước khi gọi: `clearSelection`,
 * `finishAdjust`, `pushDocHistory`, `pushLayerHistory`, `render`, `updateLayerThumb`.
 */
import { $ } from '../platform/index.js';
import { clamp } from '../shared/index.js';
import { activeLayer, state } from '../model/index.js';
import { copyCanvas, cropCanvas, replaceLayerImage } from '../pixel/index.js';
import { applyView, fit } from '../render/index.js';
import { closeTransformModal, renderLayers, toast } from '../ui/index.js';
import { markDirty } from './storage.js';

/* ------------------------------------------------------------------ deps */
let deps = {
  clearSelection: () => {},
  finishAdjust: () => {},
  pushDocHistory: () => {},
  pushLayerHistory: () => {},
  render: () => {},
  updateLayerThumb: () => {},
};
export function configureGeometry(d) { Object.assign(deps, d); }

/* ------------------------------------------------------------------ document geometry */
export function updateDocMeta() {
  if (!state.doc) return;
  $('#projectMeta').textContent = `${state.doc.w} × ${state.doc.h} PX`;
}

export function afterGeometryChange() {
  updateDocMeta();
  deps.clearSelection();
  state.fitMode = true;
  applyView();
  requestAnimationFrame(() => fit());
  renderLayers();
  deps.render();
  markDirty();
}

export function resizeImage(w, h) {
  if (!state.doc) return;
  deps.finishAdjust();
  deps.pushDocHistory();
  const doc = state.doc;
  for (const l of doc.layers) {
    const old = l.canvas;
    replaceLayerImage(l, w, h);
    l.ctx.drawImage(old, 0, 0, w, h);
  }
  doc.w = w; doc.h = h;
  afterGeometryChange();
  toast('Đã đổi kích thước ảnh · ' + w + ' × ' + h, 'ok', 2000);
}

export function resizeCanvas(w, h, anchor) {
  if (!state.doc) return;
  deps.finishAdjust();
  deps.pushDocHistory();
  const doc = state.doc;
  const oldW = doc.w, oldH = doc.h;
  const ax = anchor.includes('left') ? 0 : anchor.includes('right') ? 1 : 0.5;
  const ay = anchor.includes('top') ? 0 : anchor.includes('bottom') ? 1 : 0.5;
  const dx = Math.round((w - oldW) * ax);
  const dy = Math.round((h - oldH) * ay);
  for (const l of doc.layers) {
    const old = l.canvas;
    replaceLayerImage(l, w, h);
    l.ctx.drawImage(old, dx, dy);
  }
  doc.w = w; doc.h = h;
  afterGeometryChange();
  toast('Đã đổi canvas · ' + w + ' × ' + h, 'ok', 2000);
}

export function cropToSelection() {
  if (!state.doc) return;
  if (!state.sel.active || !state.sel.bbox) { toast('Hãy tạo vùng chọn trước', 'warn'); return; }
  deps.finishAdjust();
  deps.pushDocHistory();
  const b = state.sel.bbox;
  const doc = state.doc;
  for (const l of doc.layers) {
    const c = cropCanvas(l.canvas, b);
    l.canvas = c;
    l.ctx = c.getContext('2d');
  }
  doc.w = b.w; doc.h = b.h;
  afterGeometryChange();
  toast('Đã cắt theo vùng chọn · ' + b.w + ' × ' + b.h, 'ok', 2000);
}

export function flipDoc(horizontal) {
  if (!state.doc) return;
  deps.finishAdjust();
  deps.pushDocHistory();
  const doc = state.doc;
  const { w, h } = doc;
  for (const l of doc.layers) {
    const old = l.canvas;
    replaceLayerImage(l, w, h);
    l.ctx.save();
    if (horizontal) { l.ctx.translate(w, 0); l.ctx.scale(-1, 1); }
    else { l.ctx.translate(0, h); l.ctx.scale(1, -1); }
    l.ctx.drawImage(old, 0, 0);
    l.ctx.restore();
  }
  afterGeometryChange();
  toast(horizontal ? 'Đã lật ngang' : 'Đã lật dọc', 'ok', 1600);
}

export function rotateDoc(dir) {
  if (!state.doc) return;
  deps.finishAdjust();
  deps.pushDocHistory();
  const doc = state.doc;
  const oldW = doc.w, oldH = doc.h;
  for (const l of doc.layers) {
    const old = l.canvas;
    replaceLayerImage(l, oldH, oldW);
    l.ctx.save();
    if (dir > 0) {
      l.ctx.translate(oldH, 0);
      l.ctx.rotate(Math.PI / 2);
    } else {
      l.ctx.translate(0, oldW);
      l.ctx.rotate(-Math.PI / 2);
    }
    l.ctx.drawImage(old, 0, 0);
    l.ctx.restore();
  }
  doc.w = oldH; doc.h = oldW;
  afterGeometryChange();
  toast(dir > 0 ? 'Đã xoay 90° phải' : 'Đã xoay 90° trái', 'ok', 1600);
}

export function applyLayerTransform() {
  const layer = activeLayer();
  if (!layer) { closeTransformModal(); return; }
  const sx = clamp(Math.abs(parseFloat($('#tfScaleX').value) || 100), 1, 1000) / 100;
  const sy = clamp(Math.abs(parseFloat($('#tfScaleY').value) || 100), 1, 1000) / 100;
  const angle = clamp(parseFloat($('#tfAngle').value) || 0, -3600, 3600);
  const flipH = $('#tfFlipH').checked;
  const flipV = $('#tfFlipV').checked;
  closeTransformModal();
  if (Math.abs(sx - 1) < 0.0001 && Math.abs(sy - 1) < 0.0001 && !angle && !flipH && !flipV) {
    toast('Chưa có thay đổi nào', 'warn', 1400);
    return;
  }
  deps.pushLayerHistory();
  const { w, h } = state.doc;
  const old = copyCanvas(layer.canvas);
  const ctx = layer.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.clearRect(0, 0, w, h);
  ctx.save();
  ctx.translate(w / 2, h / 2);
  if (angle) ctx.rotate((angle * Math.PI) / 180);
  ctx.scale(sx * (flipH ? -1 : 1), sy * (flipV ? -1 : 1));
  ctx.drawImage(old, -w / 2, -h / 2);
  ctx.restore();
  deps.render();
  deps.updateLayerThumb();
  markDirty();
  toast(`Đã biến đổi lớp · ${Math.round(sx * 100)}% × ${Math.round(sy * 100)}%${angle ? ' · ' + angle + '°' : ''}`, 'ok', 1800);
}
