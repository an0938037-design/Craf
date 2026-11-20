/**
 * Vẽ overlay: marching ants vùng chọn (`clearOverlay`, `requestAnts`, `drawAnts`,
 * `startAnts`) + preview hình marquee đang kéo (`selPreviewPath`). Shell tiếp nhận
 * `ants`/`overlay`/`state`/`selection` qua `configure` — giống mẫu `model/selection.js`,
 * section `render` không đọc `state` toàn cục.
 */
import { dpr } from '../platform/index.js';
import { previewGeometry } from '../core/index.js';
import { selectionPath } from './selectionPath.js';

let env = null;
/** { ants, overlay, getState, getSelection } — shell tiên giờ lúc boot. */
export function configure(e) { env = e; }

function clearOverlay() {
  const ctx = env.overlay.getContext('2d');
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, env.overlay.width, env.overlay.height);
}

function selPreviewPath() {
  const p = new Path2D();
  const m = env.getState().selPreview;
  if (!m) return null;
  if (m.type === 'rect') {
    const g = previewGeometry(m);
    p.rect(g.x, g.y, g.w, g.h);
  } else if (m.type === 'poly') {
    const pts = m.points;
    if (pts.length < 2) return null;
    p.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) p.lineTo(pts[i].x, pts[i].y);
    p.closePath();
  }
  return p;
}

let antsFrame = 0;
function requestAnts() {
  if (antsFrame) return;
  antsFrame = requestAnimationFrame(() => { antsFrame = 0; drawAnts(); });
}

function drawAnts() {
  const state = env.getState();
  const ants = env.ants;
  const sel = env.getSelection();
  const path = sel ? selectionPath(sel) : null;
  if (!state.doc || !ants.width) return;
  const g = ants.getContext('2d');
  const ratio = dpr() * state.view.zoom;
  const zoom = state.view.zoom;
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, ants.width, ants.height);
  g.setTransform(ratio, 0, 0, ratio, 0, 0);

  if (state.guidesX.length || state.guidesY.length || state.guideDrag) {
    g.save();
    g.strokeStyle = 'rgba(255, 77, 36, 0.62)';
    g.lineWidth = 1 / zoom;
    g.setLineDash([]);
    g.beginPath();
    for (const x of state.guidesX) { g.moveTo(x, 0); g.lineTo(x, state.doc.h); }
    for (const y of state.guidesY) { g.moveTo(0, y); g.lineTo(state.doc.w, y); }
    const gd = state.guideDrag;
    if (gd && gd.pos != null) {
      if (gd.axis === 'x') { g.moveTo(gd.pos, 0); g.lineTo(gd.pos, state.doc.h); }
      else { g.moveTo(0, gd.pos); g.lineTo(state.doc.w, gd.pos); }
    }
    g.stroke();
    g.restore();
  }

  const preview = selPreviewPath();
  if (preview) {
    g.save();
    g.lineWidth = 1 / zoom;
    g.strokeStyle = 'rgba(253, 250, 243, 0.95)';
    g.setLineDash([]);
    g.stroke(preview);
    g.strokeStyle = 'rgba(10, 10, 11, 0.95)';
    g.setLineDash([5 / zoom, 5 / zoom]);
    g.lineDashOffset = -state.antsPhase / zoom;
    g.stroke(preview);
    g.restore();
  }

  if (state.sel.active && path) {
    g.save();
    g.lineWidth = 1 / zoom;
    g.strokeStyle = 'rgba(253, 250, 243, 0.92)';
    g.setLineDash([]);
    g.stroke(path);
    g.strokeStyle = 'rgba(10, 10, 11, 0.92)';
    g.setLineDash([5 / zoom, 5 / zoom]);
    g.lineDashOffset = -state.antsPhase / zoom;
    g.stroke(path);
    g.restore();
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
}

let antsLast = 0;
function startAnts() {
  const state = env.getState();
  const tick = (t) => {
    if (t - antsLast > 95) {
      antsLast = t;
      if (state.doc && (state.sel.active || state.selPreview)) {
        state.antsPhase = (state.antsPhase + 1) % 10;
        drawAnts();
      }
    }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
}
