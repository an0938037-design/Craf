/**
 * Thước ngang/dọc của sân khấu (P3-3).
 *
 * Toàn bộ phép đổi toạ độ doc → thước nằm ở đây. `applyView` gọi lại mỗi khi
 * zoom/pan đổi; không mutate doc.
 */
import { $, dpr } from '../platform/index.js';
import { state } from '../model/index.js';

/**
 * Bước chia "đẹp" gần `target` nhất (1/2/5 × 10^n), tối thiểu 1.
 * @param {number} target
 */
export function niceStep(target) {
  const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, target))));
  const n = target / pow;
  const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
  return Math.max(1, mult * pow);
}

/** Vẽ lại cả hai thước theo `state.view`. */
export function drawRulers() {
  if (!state.doc) return;
  const left = 24, top = 24;
  const rx = $('#rulerX'), ry = $('#rulerY');
  if (!rx || !ry) return;
  if (!rx.firstChild) {
    const a = document.createElement('canvas'); a.className = 'ruler-canvas'; rx.appendChild(a);
    const b = document.createElement('canvas'); ry.appendChild(b);
  }
  const ratio = dpr();
  const areaRect = $('#boardArea').getBoundingClientRect();
  const rxRect = rx.getBoundingClientRect();
  const ryRect = ry.getBoundingClientRect();
  const cx = rx.firstChild, cyr = ry.firstChild;
  cx.width = Math.max(1, Math.round(rxRect.width * ratio));
  cx.height = Math.max(1, Math.round(rxRect.height * ratio));
  cyr.width = Math.max(1, Math.round(ryRect.width * ratio));
  cyr.height = Math.max(1, Math.round(ryRect.height * ratio));
  const gx = cx.getContext('2d');
  const gy = cyr.getContext('2d');
  gx.setTransform(ratio, 0, 0, ratio, 0, 0);
  gy.setTransform(ratio, 0, 0, ratio, 0, 0);
  gx.clearRect(0, 0, rxRect.width, rxRect.height);
  gy.clearRect(0, 0, ryRect.width, ryRect.height);
  gx.font = '8px "Geist Mono", monospace';
  gx.fillStyle = 'rgba(242,238,229,.42)';
  gx.strokeStyle = 'rgba(242,238,229,.22)';
  gy.font = '8px "Geist Mono", monospace';
  gy.fillStyle = 'rgba(242,238,229,.42)';
  gy.strokeStyle = 'rgba(242,238,229,.22)';

  const zoom = state.view.zoom;
  const step = niceStep(84 / zoom);
  const minor = step / 5;
  const x0 = state.view.x; // screen x của doc 0 trong board area
  const y0 = state.view.y;
  const xStart = Math.floor((left - x0) / zoom / step) * step;
  const xEnd = (areaRect.width - x0) / zoom;
  const yStart = Math.floor((top - y0) / zoom / step) * step;
  const yEnd = (areaRect.height - y0) / zoom;
  const xLocal = (docX) => x0 + docX * zoom - left;
  const yLocal = (docY) => y0 + docY * zoom - top;

  gx.lineWidth = 1;
  if (minor * zoom > 6) {
    gx.beginPath();
    for (let v = Math.floor(xStart / minor) * minor; v <= xEnd; v += minor) {
      const px = xLocal(v);
      if (px < 0 || px > rxRect.width) continue;
      gx.moveTo(px, rxRect.height - 4);
      gx.lineTo(px, rxRect.height);
    }
    gx.stroke();
  }
  gx.beginPath();
  for (let v = xStart; v <= xEnd; v += step) {
    const px = xLocal(v);
    if (px < -20 || px > rxRect.width + 20) continue;
    gx.moveTo(px, rxRect.height - 9);
    gx.lineTo(px, rxRect.height);
    if (v >= 0) gx.fillText(String(v), px + 3, 9);
  }
  gx.stroke();

  gy.lineWidth = 1;
  if (minor * zoom > 6) {
    gy.beginPath();
    for (let v = Math.floor(yStart / minor) * minor; v <= yEnd; v += minor) {
      const py = yLocal(v);
      if (py < 0 || py > ryRect.height) continue;
      gy.moveTo(ryRect.width - 4, py);
      gy.lineTo(ryRect.width, py);
    }
    gy.stroke();
  }
  gy.beginPath();
  for (let v = yStart; v <= yEnd; v += step) {
    const py = yLocal(v);
    if (py < -20 || py > ryRect.height + 20) continue;
    gy.moveTo(ryRect.width - 9, py);
    gy.lineTo(ryRect.width, py);
    if (v >= 0 && step * zoom > 26) {
      gy.save();
      gy.translate(10, py + 2);
      gy.rotate(-Math.PI / 2);
      gy.textAlign = 'right';
      gy.fillText(String(v), 0, 0);
      gy.restore();
    }
  }
  gy.stroke();
}
