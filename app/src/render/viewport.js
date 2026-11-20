/**
 * Viewport sân khấu: zoom, pan, kích thước buffer (P3-2).
 *
 * Module này sở hữu `state.view` + `state.fitMode`. Nó không giữ doc/history;
 * sau mỗi lần đổi khung nó vẽ lại composite (`paintDoc`), thước và ants.
 *
 * Phần tử DOM và các callback UI được **tiêm** qua `configure()` vì `render`
 * không được import `ui`/`shell`.
 */
import { clamp } from '../shared/index.js';
import { dpr } from '../platform/index.js';
import { state } from '../model/index.js';
import { paintDoc } from './compositor.js';
import { drawRulers } from './rulers.js';
import { requestAnts } from './overlay.js';

let el = null;
let afterView = () => {};

/**
 * @param {{
 *   area: HTMLElement, board: HTMLElement, holder: HTMLElement,
 *   paper: HTMLCanvasElement, overlay: HTMLCanvasElement, ants: HTMLCanvasElement,
 *   stage: HTMLElement, brushRing: HTMLElement, zoomLabel: HTMLElement,
 *   afterView?: () => void
 * }} deps
 */
export function configure(deps) {
  el = deps;
  if (deps.afterView) afterView = deps.afterView;
}

/** Vẽ composite hiện tại lên `#paper` theo đúng tỉ lệ màn hình. */
export function renderDoc() {
  if (!state.doc) return;
  paintDoc(el.paper, state.doc, dpr() * state.view.zoom);
}

/** Áp `state.view` lên DOM, rồi vẽ lại composite + thước + ants. */
export function applyView() {
  if (!state.doc) return;
  const { zoom, x, y } = state.view;
  const cssW = Math.max(1, state.doc.w * zoom);
  const cssH = Math.max(1, state.doc.h * zoom);
  el.board.style.width = cssW + 'px';
  el.board.style.height = cssH + 'px';
  el.holder.style.transform = `translate(${x}px, ${y}px)`;
  const ratio = dpr();
  const bw = Math.max(1, Math.round(cssW * ratio));
  const bh = Math.max(1, Math.round(cssH * ratio));
  if (el.paper.width !== bw || el.paper.height !== bh) {
    el.paper.width = bw;
    el.paper.height = bh;
    el.overlay.width = bw;
    el.overlay.height = bh;
    el.ants.width = bw;
    el.ants.height = bh;
  }
  renderDoc();
  drawRulers();
  requestAnts();
  el.zoomLabel.textContent = Math.round(zoom * 100) + '%';
}

/** Vừa khung: tính zoom + tâm theo kích thước `#boardArea`. */
export function fit() {
  if (!state.doc) return;
  const r = el.area.getBoundingClientRect();
  const padX = 58, padY = 54, ruler = 24;
  const z = Math.min((r.width - ruler - padX * 2) / state.doc.w, (r.height - ruler - padY * 2) / state.doc.h);
  const zoom = clamp(z, 0.04, 3);
  state.view.zoom = zoom;
  state.view.x = ruler + (r.width - ruler - state.doc.w * zoom) / 2;
  state.view.y = ruler + (r.height - ruler - state.doc.h * zoom) / 2;
  state.fitMode = true;
  applyView();
  afterView();
}

/**
 * Đặt zoom quanh một điểm màn hình (mặc định tâm board area).
 * @param {number} z
 * @param {number} [cx] Toạ độ clientX.
 * @param {number} [cy] Toạ độ clientY.
 */
export function setZoom(z, cx, cy) {
  if (!state.doc) return;
  const r = el.area.getBoundingClientRect();
  const ax = cx == null ? r.width / 2 : cx - r.left;
  const ay = cy == null ? r.height / 2 : cy - r.top;
  const docX = (ax - state.view.x) / state.view.zoom;
  const docY = (ay - state.view.y) / state.view.zoom;
  const zoom = clamp(z, 0.04, 8);
  state.view.zoom = zoom;
  state.view.x = ax - docX * zoom;
  state.view.y = ay - docY * zoom;
  state.fitMode = false;
  applyView();
  afterView();
}

/** Bắt đầu pan bằng phím giữa / Space / tool hand. */
export function startPan(e) {
  state.panning = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y };
  state.fitMode = false;
  try { el.overlay.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  el.stage.style.cursor = 'grabbing';
}

/** Cập nhật vị trí pan theo con trỏ. */
export function dragPan(e) {
  if (!state.panning) return;
  state.view.x = state.panning.vx + (e.clientX - state.panning.x);
  state.view.y = state.panning.vy + (e.clientY - state.panning.y);
  applyView();
}

/** Kết thúc pan. */
export function endPan() {
  state.panning = null;
  el.stage.style.cursor = '';
}

/** Vòng tròn cỡ cọ bám con trỏ. */
export function moveRing(e) {
  const ring = el.brushRing;
  if (state.tool !== 'brush' && state.tool !== 'eraser') { ring.hidden = true; return; }
  const r = el.area.getBoundingClientRect();
  const sizePx = Math.max(4, state.size * state.view.zoom);
  ring.hidden = false;
  ring.style.width = sizePx + 'px';
  ring.style.height = sizePx + 'px';
  ring.style.left = (e.clientX - r.left) + 'px';
  ring.style.top = (e.clientY - r.top) + 'px';
}

/** Ẩn vòng cọ (khi rời overlay). */
export function hideRing() {
  if (el) el.brushRing.hidden = true;
}

/** Hiện vòng cọ nếu đang là bút/tẩy (khi vào overlay). */
export function showRing() {
  if (!el) return;
  if (state.tool === 'brush' || state.tool === 'eraser') el.brushRing.hidden = false;
}
