/* Craf — composition root. Nơi duy nhất nối các section lại và khởi động studio. */
import { $, $$, dpr, loadImage } from '../platform/index.js';
import { clamp, esc, fmt, pad, uid, createEmitter } from '../shared/index.js';
import { maskAll, maskBounds, maskInvert } from '../core/index.js';
import { maskExtract, maskFromLayerAlpha, maskTranslate, strokePath, fillPath, clearPath, gradientPaint as gradientPaintDoc, paintShape as paintShapeDoc, createLayer as newLayer, copyCanvas, mergeLayerInto, flattenLayers, adjustFilter, applyLevels, filterCanvas, paintClippedOver as paintClipped, pngDataURL } from '../pixel/index.js';
import { selection, state, activeLayer, pushDoc, pushLayer, canUndo, canRedo, docSnapshot } from '../model/index.js';
import { configure as configureOverlay, clearOverlay, requestAnts, drawAnts, startAnts, selectionPath, drawLayerThumb, configureViewport, renderDoc, applyView, fit, setZoom, startPan, dragPan, endPan, moveRing, hideRing, showRing } from '../render/index.js';
import { configure as configureTools, beginMarquee, dragMarquee, previewMarquee, commitMarquee, wandSelectAt, beginBrush, dragBrush, endBrush, beginMove as moveBegin, planMove, applyMove, beginShape as shapeBegin, dragShape, beginGradient as gradientBegin, dragGradient, gradientHasLength, writeText, FONTS, pickHex, fillAt, setTool as setToolState, panelsFor, cursorFor, hintFor, toDoc as docPoint, notify } from '../tools/index.js';
import {
  toast, configureStart, renderPresets, renderRecent, renderTemplates, paintTemplatePreviews, renderNott,
  configureLayers, renderLayers, setColor, setBgColor, swapColors, resetColors, renderPalette, setFill, hslFromUI,
  adjustDefaults, syncAdjustUI,
  closeMenus, bindMenubar, openPane,
  openDrawer, closeDrawer, openHelp, closeHelp, openIns, closeIns,
  configureModals, openSizeModal, closeSizeModal, openTransformModal, closeTransformModal,
  openStrokeModal, closeStrokeModal, openDocBgPicker, previewDocBg, commitDocBg, sizeState, paintHero,
} from '../ui/index.js';
import { createCommands } from './commands.js';
import { bindKeymap } from './keymap.js';
import { api, markDirty, saveNow, openExport, runExport, updateExportInfo, refresh, refreshNott, compositeCanvas } from './storage.js';
import { createProject, openProject, createTemplate, previewDoc, goStart, applySizeModal, configureDocuments } from './documents.js';
import { cropToSelection, flipDoc, rotateDoc, applyLayerTransform, configureGeometry } from './geometry.js';

(() => {
  'use strict';

  /* ------------------------------------------------------------------ utils */
  /* Đã tách sang section: $ $$ dpr loadImage → src/platform · clamp esc fmt pad uid
     → src/shared · hex/rgb/hsl → src/core/color.js · bezierPoints → src/core/geometry.js */

  /* ------------------------------------------------------------------ state */

  /* state đã chuyển sang `model/store.js` (P2-1); giữ facade `state.` để
     giai đoạn 2 thay dần từng vùng đọc. */
  let selView = { active: false, bbox: null, data: null, rev: 0 };
  Object.defineProperty(state, 'sel', { get: () => selView, enumerable: true });
  selection.configure({ getDocSize: () => (state.doc ? { w: state.doc.w, h: state.doc.h } : null) });

  const paper = $('#paper');
  const overlay = $('#overlay');
  const ants = $('#ants');
  const board = $('#board');
  const holder = $('#boardHolder');
  configureOverlay({
    ants, overlay,
    getState: () => state,
    getSelection: () => selection.get(),
  });
  const area = $('#boardArea');
  configureViewport({
    area, board, holder, paper, overlay, ants,
    stage: $('#stage'),
    brushRing: $('#brushRing'),
    zoomLabel: $('#zoomVal'),
    afterView: () => positionTextEditor(),
  });
  const bus = createEmitter();
  configureTools({ bus });

  /* ------------------------------------------------------------------ start screen */
  /* Màn hình bắt đầu đã sang `ui/start.js`; ở đây chỉ tiêm hành động. */
  configureStart({
    getState: () => state,
    createProject,
    openProject,
    createTemplate,
    importNottImage,
    setColor,
    previewDoc,
  });

  /* ------------------------------------------------------------------ document model */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  /* ------------------------------------------------------------------ view / render */
  function render() {
    renderDoc();
  }

  let renderQueued = false;
  function renderSoon() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }

  /* ------------------------------------------------------------------ selection */
  function selPath() {
    const s = selection.get();
    return s ? selectionPath(s) : null;
  }

  function syncSelView(sel) {
    if (!sel) {
      selView = { active: false, bbox: null, data: null, rev: selection.revision() };
      return;
    }
    selView = { active: true, bbox: sel.bbox, data: sel.data, rev: sel.rev };
  }

  function adoptSelection(sel) {
    syncSelView(sel);
    if (!sel) state.selPreview = null;
    updateSelectionUI();
    requestAnts();
    notify('selection', sel ? { bbox: sel.bbox, rev: sel.rev } : null);
    return sel;
  }

  function setSelection(mask, mode = 'replace') {
    if (!state.doc) return null;
    return adoptSelection(selection.apply(mask, selection.isActive() ? mode : 'replace'));
  }

  function clearSelection() {
    selection.clear();
    syncSelView(null);
    state.selPreview = null;
    updateSelectionUI();
    requestAnts();
  }

  function selectAll() {
    if (!state.doc) return;
    setSelection(maskAll(state.doc.w, state.doc.h));
  }

  function invertSelection() {
    if (!state.doc) return;
    if (!selection.isActive()) { selectAll(); return; }
    const { w, h } = state.doc;
    setSelection(maskInvert(state.sel.data, w, h));
  }

  function selectLayerContent() {
    if (!state.doc) return;
    const layer = activeLayer();
    if (!layer) return;
    const { w, h } = state.doc;
    const mask = maskFromLayerAlpha(layer.canvas);
    if (!maskBounds(mask, w, h)) { toast('Lớp này đang trống', 'warn'); return; }
    setSelection(mask);
    const b = state.sel.bbox;
    toast(`Đã chọn nội dung lớp · ${b.w} × ${b.h}`, 'ok', 1800);
  }

  function pointInSelection(x, y) {
    if (!selection.isActive()) return false;
    return selection.contains(clamp(Math.floor(x), 0, state.doc.w - 1), clamp(Math.floor(y), 0, state.doc.h - 1));
  }

  function translateSelection(dx, dy) {
    if (!selection.isActive()) return;
    const { w, h } = state.doc;
    setSelection(maskTranslate(state.sel.data, w, h, dx, dy));
  }

  function updateSelectionUI() {
    const on = !!state.sel.active;
    const note = $('#menuSelNote');
    const st = $('#statusSel');
    const scope = $('#adjustScope');
    if (note) {
      note.classList.toggle('on', on);
      note.textContent = on && state.sel.bbox ? `CHỌN ${fmt(state.sel.bbox.w)} × ${fmt(state.sel.bbox.h)}` : 'KHÔNG CÓ VÙNG CHỌN';
    }
    if (st) {
      st.hidden = !on;
      if (on && state.sel.bbox) st.textContent = `CHỌN ${fmt(state.sel.bbox.w)}×${fmt(state.sel.bbox.h)}`;
    }
    if (scope) scope.textContent = on ? 'trong vùng chọn' : 'toàn lớp';
  }

  /* ------------------------------------------------------------------ layers UI */
  /* Panel lớp đã sang ui/layers.js; ở đây tiêm command. */
  configureLayers({
    select: (i) => selectLayer(i),
    selectContent: () => selectLayerContent(),
    toggleVisible: (i) => {
      pushDocHistory();
      state.doc.layers[i].visible = !state.doc.layers[i].visible;
      renderLayers(); render(); markDirty();
    },
    rename: (i, name) => {
      pushDocHistory();
      state.doc.layers[i].name = name;
      markDirty();
    },
    reorder: (from, to) => {
      pushDocHistory();
      const moved = state.doc.layers.splice(from, 1)[0];
      state.doc.layers.splice(to, 0, moved);
      state.active = to;
      renderLayers(); render(); markDirty();
    },
    paintThumb: (ctx, layer, doc, size) => drawLayerThumb(ctx, layer, doc, size),
  });

  /* Hộp thoại size/transform/stroke/màu nền → ui/modals.js. */
  configureModals({
    getState: () => state,
    finishAdjust,
    toast,
    pushDocHistory,
    render,
    markDirty,
  });

  function selectLayer(i) {
    finishAdjust();
    state.active = clamp(i, 0, state.doc.layers.length - 1);
    renderLayers();
    syncAdjustUI();
  }

  function addLayer() {
    if (!state.doc) return;
    finishAdjust();
    pushDocHistory();
    const l = newLayer(state.doc.w, state.doc.h, 'Lớp ' + (state.doc.layers.length + 1));
    state.doc.layers.splice(state.active + 1, 0, l);
    state.active++;
    renderLayers(); render(); markDirty();
  }

  function duplicateLayer() {
    const l = activeLayer();
    if (!l) return;
    finishAdjust();
    pushDocHistory();
    const copy = newLayer(state.doc.w, state.doc.h, l.name + ' copy');
    copy.visible = l.visible;
    copy.opacity = l.opacity;
    copy.blend = l.blend;
    copy.ctx.drawImage(l.canvas, 0, 0);
    state.doc.layers.splice(state.active + 1, 0, copy);
    state.active++;
    renderLayers(); render(); markDirty();
  }

  function deleteLayer() {
    if (!state.doc || state.doc.layers.length <= 1) { toast('Cần giữ lại ít nhất một lớp', 'warn'); return; }
    finishAdjust();
    pushDocHistory();
    state.doc.layers.splice(state.active, 1);
    state.active = clamp(state.active, 0, state.doc.layers.length - 1);
    renderLayers(); render(); markDirty();
  }

  function mergeDown() {
    if (!state.doc || state.active <= 0) { toast('Cần một lớp bên dưới để gộp', 'warn'); return; }
    finishAdjust();
    pushDocHistory();
    const up = state.doc.layers[state.active];
    const low = state.doc.layers[state.active - 1];
    mergeLayerInto(low, up);
    state.doc.layers.splice(state.active, 1);
    state.active -= 1;
    renderLayers(); render(); markDirty();
    toast('Đã gộp xuống “' + low.name + '”', 'ok', 2000);
  }

  function mergeAll() {
    if (!state.doc) return;
    finishAdjust();
    pushDocHistory();
    const flat = flattenLayers(state.doc.layers, state.doc.w, state.doc.h);
    const l = newLayer(state.doc.w, state.doc.h, 'Hợp nhất');
    l.ctx.drawImage(flat, 0, 0);
    state.doc.layers = [l];
    state.active = 0;
    clearSelection();
    renderLayers(); render(); markDirty();
    toast('Đã gộp tất cả thành một lớp', 'ok', 2000);
  }

  function updateLayerThumb() {
    const row = $(`.layer-row[data-index="${state.active}"]`);
    if (!row) return;
    const c = row.querySelector('canvas');
    if (!c) return;
    drawLayerThumb(c.getContext('2d'), activeLayer(), state.doc);
  }

  /* ------------------------------------------------------------------ adjustments / filters */
  /* adjustDefaults + syncAdjustUI → ui/adjust-panel.js. */

  function ensureAdjust() {
    const layer = activeLayer();
    if (!layer) { toast('Chọn một lớp trước đã', 'warn'); return null; }
    if (!state.adjust || state.adjust.id !== layer.id) {
      state.adjust = {
        id: layer.id,
        original: copyCanvas(layer.canvas),
        origSrc: pngDataURL(layer.canvas),
        vals: adjustDefaults(),
        pushed: false,
      };
      syncAdjustUI();
    }
    return state.adjust;
  }

  function paintClippedOver(layer, original, filtered) {
    paintClipped(layer, original, filtered, state.sel.active ? selPath() : null);
  }

  function renderAdjustPreview() {
    const a = state.adjust;
    if (!a) return;
    const layer = state.doc && state.doc.layers.find((l) => l.id === a.id);
    if (!layer) return;
    if (!a.pushed) {
      pushLayerSnapshot(layer, a.origSrc);
      a.pushed = true;
    }
    const temp = makeCanvas(state.doc.w, state.doc.h);
    const tg = temp.getContext('2d');
    tg.filter = adjustFilter(a.vals);
    tg.drawImage(a.original, 0, 0);
    tg.filter = 'none';
    applyLevels(temp, a.vals.black, a.vals.white, a.vals.gamma / 100);
    paintClippedOver(layer, a.original, temp);
    render();
    updateLayerThumb();
    markDirty();
  }

  function readAdjustUI() {
    const a = ensureAdjust();
    if (!a) return;
    let black = parseInt($('#adjBlack').value, 10);
    let white = parseInt($('#adjWhite').value, 10);
    if (black >= white) {
      white = Math.min(255, black + 1);
      if (white <= black) black = white - 1;
    }
    a.vals = {
      bright: parseInt($('#adjBright').value, 10),
      contrast: parseInt($('#adjContrast').value, 10),
      saturate: parseInt($('#adjSaturate').value, 10),
      hue: parseInt($('#adjHue').value, 10),
      blur: parseFloat($('#adjBlur').value),
      black,
      white,
      gamma: parseInt($('#adjGamma').value, 10),
      gray: $('#adjGray').checked,
      sepia: $('#adjSepia').checked,
      invert: $('#adjInvert').checked,
    };
    syncAdjustUI();
    renderAdjustPreview();
  }

  function finishAdjust(cancel = false) {
    const a = state.adjust;
    if (!a) return;
    const layer = state.doc && state.doc.layers.find((l) => l.id === a.id);
    if (cancel && layer) {
      layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
      layer.ctx.globalAlpha = 1;
      layer.ctx.globalCompositeOperation = 'source-over';
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
      layer.ctx.drawImage(a.original, 0, 0);
      if (a.pushed) {
        const last = state.undo[state.undo.length - 1];
        if (last && last.kind === 'layer' && last.id === a.id) state.undo.pop();
      }
      syncHistoryButtons();
    }
    state.adjust = null;
    syncAdjustUI();
    render();
    updateLayerThumb();
    if (!cancel) markDirty();
  }

  function resetAdjustUI() {
    if (state.adjust) {
      state.adjust.vals = adjustDefaults();
      syncAdjustUI();
      renderAdjustPreview();
    } else {
      ensureAdjust();
      syncAdjustUI();
    }
  }

  function applyFilter(kind, done) {
    if (!state.doc) return;
    finishAdjust();
    const layer = activeLayer();
    if (!layer) return;
    pushLayerHistory();
    const original = copyCanvas(layer.canvas);
    const filtered = filterCanvas(original, kind, state.doc.w, state.doc.h);
    paintClippedOver(layer, original, filtered);
    render();
    updateLayerThumb();
    markDirty();
    toast(done || 'Đã áp dụng bộ lọc', 'ok', 1800);
  }

  /* Panel màu đã sang ui/inspector.js. */

  /* ------------------------------------------------------------------ history */
  function snapshotDoc() {
    return docSnapshot(state.doc, state.active, (l) => pngDataURL(l.canvas));
  }

  function pushDocHistory() {
    if (!state.doc) return;
    pushDoc(snapshotDoc());
    syncHistoryButtons();
  }

  function pushLayerHistory() {
    const l = activeLayer();
    if (!l) return;
    pushLayer({ kind: 'layer', id: l.id, src: pngDataURL(l.canvas) });
    syncHistoryButtons();
  }

  function pushLayerSnapshot(layer, src) {
    pushLayer({ kind: 'layer', id: layer.id, src });
    syncHistoryButtons();
  }

  function currentLayerSrc(id) {
    const l = state.doc.layers.find((x) => x.id === id);
    return l ? pngDataURL(l.canvas) : null;
  }

  async function applySnapshot(snap) {
    if (snap.kind === 'layer') {
      const l = state.doc.layers.find((x) => x.id === snap.id);
      if (!l) return;
      const img = await loadImage(snap.src);
      l.ctx.setTransform(1, 0, 0, 1, 0, 0);
      l.ctx.clearRect(0, 0, l.canvas.width, l.canvas.height);
      l.ctx.drawImage(img, 0, 0);
    } else {
      if (snap.w && snap.h) { state.doc.w = snap.w; state.doc.h = snap.h; }
      if (snap.bg) state.doc.bg = snap.bg;
      const layers = [];
      for (const item of snap.layers) {
        const l = newLayer(state.doc.w, state.doc.h, item.name);
        l.visible = item.visible;
        l.opacity = item.opacity;
        l.blend = item.blend;
        const img = await loadImage(item.src);
        l.ctx.drawImage(img, 0, 0);
        layers.push(l);
      }
      state.doc.layers = layers;
      state.active = clamp(snap.active, 0, layers.length - 1);
      $('#projectMeta').textContent = `${state.doc.w} × ${state.doc.h} PX`;
      state.fitMode = true;
      requestAnimationFrame(() => fit());
    }
  }

  async function undo() {
    const snap = state.undo.pop();
    if (!snap) return;
    const inverse = snap.kind === 'layer'
      ? { kind: 'layer', id: snap.id, src: currentLayerSrc(snap.id) }
      : snapshotDoc();
    state.redo.push(inverse);
    await applySnapshot(snap);
    clearSelection();
    renderLayers(); render(); markDirty();
    syncHistoryButtons();
  }

  async function redo() {
    const snap = state.redo.pop();
    if (!snap) return;
    const inverse = snap.kind === 'layer'
      ? { kind: 'layer', id: snap.id, src: currentLayerSrc(snap.id) }
      : snapshotDoc();
    state.undo.push(inverse);
    await applySnapshot(snap);
    clearSelection();
    renderLayers(); render(); markDirty();
    syncHistoryButtons();
  }

  function syncHistoryButtons() {
    $('#btnUndo').disabled = !canUndo();
    $('#btnRedo').disabled = !canRedo();
  }

  /* Lưu + xuất ảnh → shell/storage.js. */

  async function sendToNott() {
    if (!state.doc) { toast('Mở một bản vẽ trước đã', 'warn'); return; }
    const n = state.nott || {};
    if (!n.ok) { toast('Không thấy thư mục Nott trên máy', 'err'); openDrawer(); return; }
    try {
      await saveNow();
      const png = pngDataURL(compositeCanvas(state.doc.w, state.doc.h));
      const res = await api('/api/nott/send', {
        name: state.doc.name, w: state.doc.w, h: state.doc.h, png,
        note: 'Vẽ trên Craf — mở ảnh trong notes/files để xem bản đầy đủ.',
      });
      toast('Đã gửi sang Nott · ' + res.note, 'ok', 4200);
      await refreshNott();
    } catch (err) {
      toast('Gửi thất bại: ' + err.message, 'err');
    }
  }

  async function importNottImage(name) {
    if (!state.doc) { toast('Mở một bản vẽ trước đã', 'warn'); return; }
    try {
      const img = await loadImage('/api/nott/file?name=' + encodeURIComponent(name));
      pushDocHistory();
      let n = 1;
      while (state.doc.layers.some((l) => l.name === 'Ảnh Nott ' + n)) n++;
      const layer = newLayer(state.doc.w, state.doc.h, 'Ảnh Nott ' + n);
      layer.note = name;
      const s = Math.min(state.doc.w / img.width, state.doc.h / img.height);
      const w = img.width * s, h = img.height * s;
      layer.ctx.drawImage(img, (state.doc.w - w) / 2, (state.doc.h - h) / 2, w, h);
      state.doc.layers.splice(state.active + 1, 0, layer);
      state.active++;
      renderLayers(); render(); markDirty();
      toast('Đã đưa ảnh vào lớp “' + layer.name + '”');
    } catch (err) {
      toast('Không nhập được ảnh: ' + err.message, 'err');
    }
  }

  function copySelection(cut = false) {
    if (!state.doc) return;
    finishAdjust();
    const layer = activeLayer();
    if (!layer) return;
    if (!state.sel.active) {
      const c = copyCanvas(layer.canvas);
      state.clipboard = { canvas: c, x: 0, y: 0 };
      if (cut) {
        pushLayerHistory();
        layer.ctx.setTransform(1, 0, 0, 1, 0, 0);
        layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
        render(); updateLayerThumb(); markDirty();
      }
      toast(cut ? 'Đã cắt toàn lớp' : 'Đã sao chép toàn lớp', 'ok', 1600);
      return;
    }
    const ex = maskExtract(layer.canvas, selection.get());
    state.clipboard = { canvas: ex.canvas, x: ex.x, y: ex.y };
    if (cut) {
      pushLayerHistory();
      layer.ctx.save();
      layer.ctx.globalCompositeOperation = 'destination-out';
      layer.ctx.fillStyle = '#000';
      layer.ctx.fill(selPath(), 'evenodd');
      layer.ctx.restore();
      render(); updateLayerThumb(); markDirty();
    }
    toast(cut ? 'Đã cắt vùng chọn' : 'Đã sao chép vùng chọn', 'ok', 1600);
  }

  function pasteClipboard() {
    if (!state.doc) return;
    if (!state.clipboard) { toast('Chưa có gì trong bộ nhớ tạm', 'warn'); return; }
    finishAdjust();
    pushDocHistory();
    const cb = state.clipboard;
    let n = 1;
    while (state.doc.layers.some((l) => l.name === 'Dán ' + n)) n++;
    const layer = newLayer(state.doc.w, state.doc.h, 'Dán ' + n);
    layer.ctx.drawImage(cb.canvas, cb.x, cb.y);
    state.doc.layers.splice(state.active + 1, 0, layer);
    state.active++;
    renderLayers(); render(); markDirty();
    toast('Đã dán thành lớp mới', 'ok', 1800);
  }

  function clearSelectedContent() {
    if (!state.doc) return;
    finishAdjust();
    const layer = activeLayer();
    if (!layer) return;
    pushLayerHistory();
    clearPath(layer.ctx, state.sel.active ? selPath() : null, state.doc.w, state.doc.h);
    render(); updateLayerThumb(); markDirty();
  }

  function fillSelected() {
    if (!state.doc) return;
    finishAdjust();
    const layer = activeLayer();
    if (!layer) return;
    pushLayerHistory();
    fillPath(layer.ctx, state.sel.active ? selPath() : null, { w: state.doc.w, h: state.doc.h, color: state.color, opacity: state.opacity });
    render(); updateLayerThumb(); markDirty();
  }

  function applyStrokeSelection() {
    const layer = activeLayer();
    if (!layer || !state.sel.active) { closeStrokeModal(); return; }
    const width = clamp(parseFloat($('#strokeWidth').value) || 4, 1, 200);
    const align = $('#strokeAlign').value;
    const color = $('#strokeColor').value === 'bg' ? state.bgColor : state.color;
    closeStrokeModal();
    pushLayerHistory();
    strokePath(layer.ctx, selPath(), { docW: state.doc.w, docH: state.doc.h, color, width, align });
    render(); updateLayerThumb(); markDirty();
    toast(`Đã viền vùng chọn · ${width}px`, 'ok', 1600);
  }

  async function importImageData(url, name) {
    if (!state.doc) { toast('Mở một bản vẽ trước đã', 'warn'); return; }
    const img = await loadImage(url);
    finishAdjust();
    pushDocHistory();
    let base = (name || 'Ảnh').replace(/\.[a-z0-9]+$/i, '').trim() || 'Ảnh';
    let n = 1;
    const raw = base;
    while (state.doc.layers.some((l) => l.name === base)) base = raw + ' ' + (++n);
    const layer = newLayer(state.doc.w, state.doc.h, base);
    const s = Math.min((state.doc.w * 0.92) / img.width, (state.doc.h * 0.92) / img.height, 1);
    const w = img.width * s, h = img.height * s;
    layer.ctx.drawImage(img, (state.doc.w - w) / 2, (state.doc.h - h) / 2, w, h);
    state.doc.layers.splice(state.active + 1, 0, layer);
    state.active++;
    renderLayers(); render(); markDirty();
    toast('Đã thêm ảnh vào lớp “' + layer.name + '”', 'ok', 2400);
  }

  function importFile(file) {
    if (!file || !/^image\//.test(file.type)) { toast('Tệp này không phải ảnh', 'warn'); return; }
    const reader = new FileReader();
    reader.onload = () => importImageData(reader.result, file.name).catch((err) => toast(err.message, 'err'));
    reader.onerror = () => toast('Không đọc được tệp', 'err');
    reader.readAsDataURL(file);
  }

  /* ------------------------------------------------------------------ drawing engine */
  function toDoc(e) {
    return docPoint(e, board, state.doc);
  }

  /* Nét cọ: máy trạng thái ở tools/brush.js, rasterize ở pixel/brush.js.
     Ở đây chỉ gom style hiện tại của tool. */
  function brushStyle(erase) {
    return {
      color: state.color, baseSize: state.size, hardness: state.hardness,
      opacity: state.opacity, erase,
    };
  }

  function beginDraw(e) {
    const pt = toDoc(e);
    const tool = state.tool;
    if (tool === 'pick') { pickColor(e); return; }
    if (tool === 'wand') {
      const mode = e.altKey ? 'subtract' : e.shiftKey ? 'add' : 'replace';
      const sel = wandSelectAt(state.doc, pt.x, pt.y, state.wandTol, mode);
      adoptSelection(sel);
      if (sel && sel.bbox) toast('Đã chọn vùng màu · ' + fmt(sel.bbox.w) + ' × ' + fmt(sel.bbox.h), 'ok', 1600);
      else toast('Không tìm thấy vùng màu', 'warn', 1800);
      return;
    }
    if (tool === 'move') { beginMove(e); return; }
    if (tool === 'gradient') { beginGradient(e); return; }    if (tool === 'marquee' || tool === 'lasso') {
      const d = beginMarquee(tool, pt, { add: e.shiftKey, subtract: e.altKey });
      state.draw = d;
      try { overlay.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      state.selPreview = previewMarquee(d);
      requestAnts();
      return;
    }
    if (tool === 'fill') { pushLayerHistory(); floodFill(pt); render(); updateLayerThumb(); markDirty(); return; }
    if (tool === 'text') { openTextEditor(e, pt); return; }
    const layer = activeLayer();
    if (!layer) return;
    pushLayerHistory();
    const clipped = state.sel.active;
    if (clipped) {
      layer.ctx.save();
      layer.ctx.clip(selPath(), 'evenodd');
    }
    if (tool === 'brush' || tool === 'eraser') {
      state.draw = { ...beginBrush(layer, pt, brushStyle(tool === 'eraser')), clipped };
    } else {
      state.draw = { ...shapeBegin(layer, pt, { shift: e.shiftKey, alt: e.altKey }), clipped };
    }
    try { overlay.setPointerCapture(e.pointerId); } catch { /* synthetic or touch cancel */ }
    renderSoon();
  }

  function moveDraw(e) {
    const d = state.draw;
    if (!d) return;
    const pt = toDoc(e);
    if (d.kind === 'paint') {
      dragBrush(d, pt, brushStyle(d.erase));
      renderSoon();
    } else if (d.kind === 'shape') {
      dragShape(d, pt, { shift: e.shiftKey, alt: e.altKey });
      previewShape(d);
    } else if (d.kind === 'marquee') {
      dragMarquee(d, pt, e.shiftKey);
      state.selPreview = previewMarquee(d);
      requestAnts();
    } else if (d.kind === 'move') {
      dragMove(d, e, pt);
    } else if (d.kind === 'gradient') {
      dragGradient(d, pt, e.shiftKey);
      previewGradient(d);
    }
  }

  function endDraw(e) {
    const d = state.draw;
    if (!d) return;
    const pt = e ? toDoc(e) : null;
    if (pt && pt.x != null) {
      if (d.kind === 'marquee') d.current = pt;
      else if (d.kind === 'gradient') d.current = pt;
      else if (d.kind === 'move') dragMove(d, e, pt);
    }
    if (d.kind === 'paint') {
      endBrush(d, brushStyle(d.erase));
    } else if (d.kind === 'shape') {
      commitShape(d);
      clearOverlay();
    } else if (d.kind === 'marquee') {
      state.selPreview = null;
      const res = commitMarquee(d, state.doc);
      if (res.kind === 'applied') adoptSelection(res.sel);
      else if (res.kind === 'cleared') { syncSelView(null); updateSelectionUI(); requestAnts(); }
      else requestAnts();
    } else if (d.kind === 'move') {
      finishMove(d);
    } else if (d.kind === 'gradient') {
      finishGradient(d);
    }
    if (d.clipped) d.layer.ctx.restore();
    state.draw = null;
    if (d.kind !== 'marquee') {
      render();
      updateLayerThumb();
      markDirty();
    }
  }

  function beginMove(e) {
    const layer = activeLayer();
    if (!layer) return;
    const pt = toDoc(e);
    const useSel = state.sel.active && pointInSelection(pt.x, pt.y);
    state.draw = moveBegin(layer, pt, { useSel, sel: state.sel, doc: state.doc });
    try { overlay.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function dragMove(d, e, pt) {
    const step = planMove(d, pt, e.shiftKey);
    if (!step.moved) return;
    if (step.firstPush) pushDocHistory();
    applyMove(d, { w: state.doc.w, h: state.doc.h, clipPath: d.useSel ? selPath() : null });
    renderSoon();
  }

  function finishMove(d) {
    if (!d.moved) return;
    if (d.useSel) translateSelection(d.dx, d.dy);
    render();
    updateLayerThumb();
    markDirty();
  }

  function beginGradient(e) {
    const layer = activeLayer();
    if (!layer) return;
    const pt = toDoc(e);
    state.draw = gradientBegin(layer, pt, e.shiftKey);
    try { overlay.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    previewGradient(state.draw);
  }

  /* Gradient: phần điểm ảnh nằm ở pixel/gradient.js; ở đây bơm tham số tool. */
  function gradientPaint(ctx, d) {
    gradientPaintDoc(ctx, d, {
      w: state.doc.w, h: state.doc.h,
      color: state.color, bgColor: state.bgColor,
      opacity: state.opacity, gradType: state.gradType,
      clipPath: state.sel.active ? selPath() : null,
    });
  }

  function previewGradient(d) {
    const ctx = overlay.getContext('2d');
    const ratio = dpr() * state.view.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    gradientPaint(ctx, d);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function finishGradient(d) {
    clearOverlay();
    if (!gradientHasLength(d)) return;
    pushLayerHistory();
    gradientPaint(d.layer.ctx, d);
    render();
    updateLayerThumb();
    markDirty();
  }

  /* Shape: hình học + rasterize ở pixel/shape.js; ở đây bơm tham số tool. */
  function paintShape(ctx, d) {
    paintShapeDoc(ctx, d, {
      tool: state.tool, color: state.color, size: state.size,
      opacity: state.opacity, shapeFill: state.shapeFill,
    });
  }

  function previewShape(d) {
    const ctx = overlay.getContext('2d');
    const ratio = dpr() * state.view.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    if (state.sel.active) {
      ctx.save();
      ctx.clip(selPath(), 'evenodd');
      paintShape(ctx, d);
      ctx.restore();
    } else {
      paintShape(ctx, d);
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
  }

  function commitShape(d) {
    const ctx = d.layer.ctx;
    paintShape(ctx, d);
  }

  function floodFill(pt) {
    const layer = activeLayer();
    fillAt(layer, state.doc, pt, { color: state.color, selData: state.sel.active ? state.sel.data : null });
  }

  function pickColor(e) {
    setColor(pickHex(paper, e.clientX, e.clientY));
    setTool('brush');
    toast('Đã lấy màu ' + state.color, 'ok', 1600);
  }

  /* text */
  function openTextEditor(e, pt) {
    const wrap = $('#textWrap');
    const input = $('#textInput');
    state.textAt = pt;
    input.value = '';
    input.style.fontFamily = FONTS[state.font];
    input.style.fontSize = (state.textSize * state.view.zoom) + 'px';
    wrap.hidden = false;
    positionTextEditor();
    input.focus();
    const close = () => { wrap.hidden = true; state.textAt = null; };
    const commit = () => {
      const text = input.value.replace(/\s+$/, '');
      if (text.trim()) {
        pushLayerHistory();
        const layer = activeLayer();
        writeText(layer, text, state.textAt, {
          color: state.color, size: state.textSize, font: state.font,
          opacity: state.opacity, clipPath: state.sel.active ? selPath() : null,
        });
        state.draw = null;
        render(); updateLayerThumb(); markDirty();
      }
      close();
    };
    input.onkeydown = (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); commit(); }
      if (ev.key === 'Escape') { ev.preventDefault(); close(); }
      ev.stopPropagation();
    };
    input.oninput = () => {
      input.style.height = 'auto';
      input.style.height = Math.min(260, input.scrollHeight) + 'px';
      positionTextEditor();
    };
    input.onblur = () => { if (!wrap.hidden) commit(); };
  }

  function positionTextEditor() {
    const wrap = $('#textWrap');
    if (wrap.hidden || !state.textAt) return;
    wrap.style.left = (state.textAt.x * state.view.zoom + state.view.x - 6) + 'px';
    wrap.style.top = (state.textAt.y * state.view.zoom + state.view.y - 8) + 'px';
  }

  /* ------------------------------------------------------------------ pointer / pan */
  overlay.addEventListener('pointerdown', (e) => {
    if (!state.doc) return;
    if (e.button === 1 || state.space || state.tool === 'hand') { e.preventDefault(); startPan(e); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    beginDraw(e);
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!state.doc) return;
    if (state.panning) { dragPan(e); return; }
    const pt = toDoc(e);
    $('#cursorPos').textContent = 'X ' + fmt(pt.x) + '  Y ' + fmt(pt.y);
    moveRing(e);
    if (state.draw) moveDraw(e);
  });

  overlay.addEventListener('pointerup', (e) => {
    if (state.panning) { endPan(); return; }
    if (state.draw) endDraw(e);
  });

  overlay.addEventListener('pointercancel', () => {
    if (state.draw) {
      if (state.draw.clipped) { try { state.draw.layer.ctx.restore(); } catch { /* ignore */ } }
      state.draw = null;
      state.selPreview = null;
      clearOverlay();
      render();
    }
    state.panning = null;
  });

  overlay.addEventListener('pointerleave', () => { hideRing(); $('#cursorPos').textContent = 'X —  Y —'; });
  overlay.addEventListener('pointerenter', () => { showRing(); });

  area.addEventListener('wheel', (e) => {
    if (!state.doc) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0016);
    setZoom(state.view.zoom * factor, e.clientX, e.clientY);
  }, { passive: false });

  /* ------------------------------------------------------------------ tools / UI sync */
  function setTool(tool) {
    setToolState(tool);
    updateToolUI();
    if (tool !== 'brush' && tool !== 'eraser') $('#brushRing').hidden = true;
  }

  function updateToolUI() {
    $$('.tool[data-tool]').forEach((el) => el.classList.toggle('active', el.dataset.tool === state.tool));
    const panels = panelsFor(state.tool);
    $('#shapeFillBlock').hidden = !panels.shapeFill;
    $('#textBlock').hidden = !panels.text;
    $('#wandBlock').hidden = !panels.wand;
    $('#gradBlock').hidden = !panels.gradient;
    $('#hardnessBlock').hidden = !panels.hardness;
    overlay.style.cursor = cursorFor(state.tool);
    $('#stageHint').textContent = hintFor(state.tool);
    if (state.doc) positionTextEditor();
  }

  function syncSizeUI() {
    $('#brushSize').value = String(state.size);
    $('#sizeVal').textContent = Math.round(state.size) + ' px';
    setFill($('#brushSize'), (state.size / 180) * 100);
    const dot = Math.min(26, Math.max(3, Math.sqrt(state.size) * 2.7));
    $('#sizeDot').style.width = dot + 'px';
    $('#sizeDot').style.height = dot + 'px';
  }

  function syncOpacityUI() {
    $('#brushOpacity').value = String(Math.round(state.opacity * 100));
    $('#opacityVal').textContent = Math.round(state.opacity * 100) + '%';
    setFill($('#brushOpacity'), state.opacity * 100);
  }

  /* open/close size + transform → ui/modals.js; apply* đã chuyển sang geometry/documents. */

  /* Hero poster → ui/hero.js. */

  /* Ngăn kéo Nott + trợ giúp → ui/drawer.js. */

  /* ------------------------------------------------------------------ commands / menubar */
  /* Menubar + chuyển pane → ui/menus.js; ở đây gom hook cho pane. */
  function openPaneUI(name) {
    openPane(name, {
      onAdjust: () => { ensureAdjust(); syncAdjustUI(); },
      onMobile: openIns,
    });
  }

  /* Bảng command → shell/commands.js; ở đây chỉ tiêm hành vi. */
  function clearGuides() {
    state.guidesX = []; state.guidesY = [];
    drawAnts();
    toast('Đã xoá đường dóng', 'ok', 1400);
  }

  function pickImageFile() {
    $('#fileImage').value = '';
    $('#fileImage').click();
  }

  const runCommand = createCommands({
    getState: () => state,
    toast,
    openSizeModal,
    openTransformModal,
    openStrokeModal,
    openDocBgPicker,
    openExport,
    openDrawer,
    openPaneUI,
    goStart,
    saveNow,
    undo,
    redo,
    copySelection,
    pasteClipboard,
    fillSelected,
    clearSelectedContent,
    cropToSelection,
    flipDoc,
    rotateDoc,
    applyFilter,
    addLayer,
    duplicateLayer,
    deleteLayer,
    mergeDown,
    mergeAll,
    selectAll,
    clearSelection,
    invertSelection,
    selectLayerContent,
    setTool,
    clearGuides,
    importImage: pickImageFile,
  });

  function bindGuides() {
    const rx = $('#rulerX'), ry = $('#rulerY');
    const begin = (axis) => (e) => {
      if (!state.doc || e.button !== 0) return;
      e.preventDefault();
      state.guideDrag = { axis, pos: null };
      rx.style.touchAction = 'none';
      ry.style.touchAction = 'none';
    };
    rx.addEventListener('pointerdown', begin('x'));
    ry.addEventListener('pointerdown', begin('y'));
    document.addEventListener('pointermove', (e) => {
      const g = state.guideDrag;
      if (!g || !state.doc) return;
      const r = board.getBoundingClientRect();
      g.pos = g.axis === 'x'
        ? (e.clientX - r.left) * state.doc.w / r.width
        : (e.clientY - r.top) * state.doc.h / r.height;
      drawAnts();
    });
    document.addEventListener('pointerup', () => {
      const g = state.guideDrag;
      if (!g) return;
      state.guideDrag = null;
      if (g.pos != null) {
        const max = g.axis === 'x' ? state.doc.w : state.doc.h;
        if (g.pos >= 0 && g.pos <= max) {
          const list = g.axis === 'x' ? state.guidesX : state.guidesY;
          if (!list.some((v) => Math.abs(v - g.pos) < 1.5)) list.push(Math.round(g.pos));
        }
      }
      drawAnts();
    });
  }

  function bindDropImport() {
    const stage = $('#stage');
    const hint = $('#dropHint');
    let depth = 0;
    stage.addEventListener('dragenter', (e) => {
      if (!state.doc) return;
      e.preventDefault();
      depth++;
      hint.hidden = false;
      area.classList.add('drop-on');
    });
    stage.addEventListener('dragover', (e) => {
      if (!state.doc) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    });
    stage.addEventListener('dragleave', (e) => {
      if (!state.doc) return;
      depth = Math.max(0, depth - 1);
      if (!depth) { hint.hidden = true; area.classList.remove('drop-on'); }
    });
    stage.addEventListener('drop', (e) => {
      if (!state.doc) return;
      e.preventDefault();
      depth = 0;
      hint.hidden = true;
      area.classList.remove('drop-on');
      const f = e.dataTransfer.files && e.dataTransfer.files[0];
      if (f) importFile(f);
    });
    document.addEventListener('paste', (e) => {
      if (!state.doc) return;
      const tag = e.target && e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;
      const items = e.clipboardData && e.clipboardData.items;
      if (!items) return;
      for (const it of items) {
        if (it.type && it.type.startsWith('image/')) {
          const f = it.getAsFile();
          if (f) { e.preventDefault(); importFile(f); return; }
        }
      }
    });
  }

  /* ------------------------------------------------------------------ bootstrap / bind */
  function bind() {
    $('#btnStart').addEventListener('click', () => createProject('Poster ' + new Date().toLocaleDateString('vi-VN', { day: '2-digit', month: '2-digit' }), 1080, 1350));
    $('#btnBrowse').addEventListener('click', () => $('#shelfPresets').scrollIntoView({ behavior: 'smooth', block: 'start' }));
    $('#brandHome').addEventListener('click', () => { if (state.doc) goStart(); });
    $('#btnExit').addEventListener('click', goStart);
    $('#nottChip').addEventListener('click', openDrawer);
    $('#scrim').addEventListener('click', closeDrawer);
    $('#btnDrawerClose').addEventListener('click', closeDrawer);
    $('#btnHelp').addEventListener('click', openHelp);
    $('#btnHelpClose').addEventListener('click', closeHelp);
    $('#helpModal').addEventListener('click', (e) => { if (e.target.id === 'helpModal') closeHelp(); });
    $('#btnDrawerSend').addEventListener('click', sendToNott);
    $('#btnSend').addEventListener('click', sendToNott);
    $('#btnExport').addEventListener('click', openExport);
    $('#btnOpenNott').addEventListener('click', async () => {
      try { await api('/api/nott/open', { target: 'nott' }); toast('Đang mở Nott…'); }
      catch (err) { toast(err.message, 'err'); }
    });
    $('#btnOpenFolder').addEventListener('click', async () => {
      try { await api('/api/nott/open', { target: 'nott-folder' }); }
      catch (err) { toast(err.message, 'err'); }
    });

    $$('.tool[data-tool]').forEach((el) => el.addEventListener('click', () => setTool(el.dataset.tool)));
    $('#btnUndo').addEventListener('click', undo);
    $('#btnRedo').addEventListener('click', redo);
    $('#inkwell').addEventListener('click', () => {
      if (window.matchMedia('(max-width: 760px)').matches) {
        document.body.classList.contains('ins-open') ? closeIns() : openIns();
        return;
      }
      openPaneUI('color');
    });
    $('#btnInsClose').addEventListener('click', closeIns);
    $('#insScrim').addEventListener('click', closeIns);

    $$('.ins-tab').forEach((tab) => tab.addEventListener('click', () => {
      openPaneUI(tab.dataset.pane);
    }));

    $('#btnLayerAdd').addEventListener('click', addLayer);
    $('#btnLayerDup').addEventListener('click', duplicateLayer);
    $('#btnLayerMerge').addEventListener('click', mergeDown);
    $('#btnLayerDel').addEventListener('click', deleteLayer);
    $('#layerBlend').addEventListener('change', () => {
      pushDocHistory();
      activeLayer().blend = $('#layerBlend').value;
      render(); markDirty();
    });
    $('#layerOpacity').addEventListener('input', () => {
      const v = parseInt($('#layerOpacity').value, 10);
      $('#layerOpacityVal').textContent = v + '%';
      setFill($('#layerOpacity'), v);
      activeLayer().opacity = v;
      const row = $(`.layer-row[data-index="${state.active}"] .layer-op`);
      if (row) row.textContent = v;
      render(); markDirty();
    });

    $('#hexInput').addEventListener('change', () => {
      const v = $('#hexInput').value.replace(/[^0-9a-f]/gi, '');
      if (v.length === 3 || v.length === 6) setColor('#' + v);
    });
    $('#hexInput').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#hexInput').blur(); });
    ['hue', 'sat', 'lig'].forEach((id) => $('#' + id).addEventListener('input', hslFromUI));
    $('#btnPick').addEventListener('click', () => setTool('pick'));
    $('#brushSize').addEventListener('input', () => {
      state.size = parseInt($('#brushSize').value, 10);
      syncSizeUI();
    });
    $('#brushOpacity').addEventListener('input', () => {
      state.opacity = parseInt($('#brushOpacity').value, 10) / 100;
      syncOpacityUI();
    });
    $('#brushHard').addEventListener('input', () => {
      state.hardness = parseInt($('#brushHard').value, 10) / 100;
      $('#hardVal').textContent = Math.round(state.hardness * 100) + '%';
      setFill($('#brushHard'), state.hardness * 100);
    });
    $('#wandTol').addEventListener('input', () => {
      state.wandTol = parseInt($('#wandTol').value, 10);
      $('#wandVal').textContent = String(state.wandTol);
      setFill($('#wandTol'), (state.wandTol / 140) * 100);
    });
    $$('#gradRow .font-chip').forEach((el) => el.addEventListener('click', () => {
      state.gradType = el.dataset.grad;
      $$('#gradRow .font-chip').forEach((x) => x.classList.toggle('active', x === el));
    }));
    $('#btnSwapColor').addEventListener('click', swapColors);
    $('#bgSwatch').addEventListener('click', () => {
      const p = $('#bgPicker');
      p.value = state.bgColor;
      p.click();
    });
    $('#bgPicker').addEventListener('input', () => setBgColor($('#bgPicker').value));
    $('#docBgPicker').addEventListener('input', () => previewDocBg($('#docBgPicker').value));
    $('#docBgPicker').addEventListener('change', () => {
      if (commitDocBg()) toast('Đã đổi màu nền canvas', 'ok', 1400);
    });

    ['adjBright', 'adjContrast', 'adjSaturate', 'adjHue', 'adjBlur', 'adjBlack', 'adjWhite', 'adjGamma', 'adjGray', 'adjSepia', 'adjInvert'].forEach((id) => {
      $('#' + id).addEventListener('input', readAdjustUI);
      $('#' + id).addEventListener('change', readAdjustUI);
    });
    $('#adjustReset').addEventListener('click', resetAdjustUI);
    $('#adjustApply').addEventListener('click', () => { finishAdjust(false); toast('Đã áp dụng chỉnh màu', 'ok', 1600); });
    $('#adjustCancel').addEventListener('click', () => { finishAdjust(true); toast('Đã huỷ chỉnh màu', 'ok', 1600); });

    $('#btnSizeClose').addEventListener('click', closeSizeModal);
    $('#btnSizeCancel').addEventListener('click', closeSizeModal);
    $('#btnSizeApply').addEventListener('click', applySizeModal);
    $('#sizeModal').addEventListener('click', (e) => { if (e.target.id === 'sizeModal') closeSizeModal(); });
    $('#sizeW').addEventListener('input', () => {
      const { mode, ratio } = sizeState();
      if (mode !== 'image' || !$('#sizeKeep').checked) return;
      const w = parseInt($('#sizeW').value, 10);
      if (w > 0) $('#sizeH').value = String(Math.max(16, Math.round(w / ratio)));
    });
    $('#sizeH').addEventListener('input', () => {
      const { mode, ratio } = sizeState();
      if (mode !== 'image' || !$('#sizeKeep').checked) return;
      const h = parseInt($('#sizeH').value, 10);
      if (h > 0) $('#sizeW').value = String(Math.max(16, Math.round(h * ratio)));
    });

    $('#btnTfClose').addEventListener('click', closeTransformModal);
    $('#btnTfCancel').addEventListener('click', closeTransformModal);
    $('#btnTfApply').addEventListener('click', applyLayerTransform);
    $('#transformModal').addEventListener('click', (e) => { if (e.target.id === 'transformModal') closeTransformModal(); });
    ['tfScaleX', 'tfScaleY', 'tfAngle'].forEach((id) => {
      $('#' + id).addEventListener('keydown', (e) => {
        if (e.key === 'Enter') { e.preventDefault(); applyLayerTransform(); }
      });
    });

    $('#btnStrokeClose').addEventListener('click', closeStrokeModal);
    $('#btnStrokeCancel').addEventListener('click', closeStrokeModal);
    $('#btnStrokeApply').addEventListener('click', applyStrokeSelection);
    $('#strokeModal').addEventListener('click', (e) => { if (e.target.id === 'strokeModal') closeStrokeModal(); });
    $('#strokeWidth').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); applyStrokeSelection(); }
    });

    $('#btnExportClose').addEventListener('click', () => { $('#exportModal').hidden = true; });
    $('#btnExportCancel').addEventListener('click', () => { $('#exportModal').hidden = true; });
    $('#btnExportGo').addEventListener('click', runExport);
    $('#exportModal').addEventListener('click', (e) => { if (e.target.id === 'exportModal') $('#exportModal').hidden = true; });
    $('#exportFormat').addEventListener('change', updateExportInfo);
    $('#exportScale').addEventListener('change', updateExportInfo);
    $('#exportQuality').addEventListener('input', () => {
      $('#exportQualityVal').textContent = $('#exportQuality').value + '%';
      setFill($('#exportQuality'), $('#exportQuality').value);
      updateExportInfo();
    });
    $('#exportAlpha').addEventListener('change', () => { $('#exportAlpha').dataset.touched = '1'; });

    $('#fileImage').addEventListener('change', () => {
      const f = $('#fileImage').files && $('#fileImage').files[0];
      if (f) importFile(f);
      $('#fileImage').value = '';
    });
    $('#shapeFill').addEventListener('change', () => { state.shapeFill = $('#shapeFill').checked; });
    $('#textSize').addEventListener('input', () => {
      state.textSize = parseInt($('#textSize').value, 10);
      $('#textSizeVal').textContent = state.textSize + ' px';
      const input = $('#textInput');
      input.style.fontSize = (state.textSize * (state.doc ? state.view.zoom : 1)) + 'px';
    });
    $$('.font-chip').forEach((el) => el.addEventListener('click', () => {
      state.font = el.dataset.font;
      $$('.font-chip').forEach((x) => x.classList.toggle('active', x === el));
      const input = $('#textInput');
      input.style.fontFamily = FONTS[state.font];
    }));

    $('#projectName').addEventListener('input', () => {
      if (!state.doc) return;
      state.doc.name = $('#projectName').value.trim() || 'Không tên';
      markDirty();
    });
    $('#projectName').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#projectName').blur(); });

    $('#zoomIn').addEventListener('click', () => setZoom(state.view.zoom * 1.25));
    $('#zoomOut').addEventListener('click', () => setZoom(state.view.zoom / 1.25));
    $('#zoomVal').addEventListener('click', () => fit());
    $('#btnGrid').addEventListener('click', () => {
      state.guides = !state.guides;
      board.classList.toggle('guides', state.guides);
      $('#btnGrid').style.color = state.guides ? 'var(--signal)' : '';
    });

    bindMenubar(runCommand);
    bindGuides();
    bindDropImport();

    window.addEventListener('resize', () => { if (state.fitMode) fit(); else { applyView(); } });
    bindKeymap({
      getState: () => state,
      closeMenus,
      closeHelp,
      closeDrawer,
      closeIns,
      closeSizeModal,
      closeTransformModal,
      closeStrokeModal,
      clearSelection,
      requestAnts,
      addLayer,
      openSizeModal,
      selectAll,
      copySelection,
      pasteClipboard,
      duplicateLayer,
      openTransformModal,
      mergeAll,
      mergeDown,
      invertSelection,
      applyFilter,
      undo,
      redo,
      saveNow,
      openExport,
      fillSelected,
      clearSelectedContent,
      syncSizeUI,
      fit,
      setZoom,
      openHelp,
      swapColors,
      resetColors,
      setTool,
    });
    document.addEventListener('beforeunload', () => { if (state.doc && state.dirty) saveNow(); });
  }

  function boot() {
    /* Tiêm hàm boot-local cho documents/geometry — 1 lần, trước khi dùng. */
    configureDocuments({ syncSelView, clearSelection, updateToolUI });
    configureGeometry({ clearSelection, finishAdjust, pushDocHistory, pushLayerHistory, render, updateLayerThumb });

    document.body.dataset.mode = 'start';
    bind();
    renderPresets();
    renderTemplates();
    renderPalette();
    setColor('#16130E');
    setBgColor('#FDFAF3');
    syncSizeUI();
    syncOpacityUI();
    syncHistoryButtons();
    syncAdjustUI();
    $('#hardVal').textContent = Math.round(state.hardness * 100) + '%';
    setFill($('#brushHard'), state.hardness * 100);
    setFill($('#wandTol'), (state.wandTol / 140) * 100);
    setFill($('#exportQuality'), 92);
    $('#textSizeVal').textContent = state.textSize + ' px';
    renderRecent();
    refresh();
    paintHero();
    startAnts();
    if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { paintHero(); paintTemplatePreviews(); });
    new ResizeObserver(() => {
      if (!state.doc) return;
      if (state.fitMode) fit(); else { applyView(); }
    }).observe($('#boardArea'));
  }

  boot();
})();
