/* Craf — bàn vẽ. Vanilla canvas studio with a Nott bridge. */
import { $, $$, dpr, loadImage } from './src/platform/index.js';
import { clamp, esc, fmt, pad, uid, createEmitter } from './src/shared/index.js';
import { bezierPoints, maskAll, maskBounds, maskInvert } from './src/core/index.js';
import { maskExtract, maskFromLayerAlpha, maskTranslate, strokePath, fillPath, clearPath, cropCanvas, gradientPaint as gradientPaintDoc, paintShape as paintShapeDoc, createLayer as newLayer, copyCanvas, replaceLayerImage, mergeLayerInto, flattenLayers, adjustFilter, applyLevels, filterCanvas, paintClippedOver as paintClipped, pngDataURL, jpegDataURL } from './src/pixel/index.js';
import { selection, state, activeLayer, uniqueProjectName, newDocData, activate, pushDoc, pushLayer, canUndo, canRedo, toPayload, docSnapshot, docFromJSON, layerFromJSON, CRAF_SWATCHES } from './src/model/index.js';
import { configure as configureOverlay, clearOverlay, requestAnts, drawAnts, startAnts, selectionPath, compositeDoc, drawLayerThumb, configureViewport, renderDoc, applyView, fit, setZoom, startPan, dragPan, endPan, moveRing, hideRing, showRing } from './src/render/index.js';
import { configure as configureTools, beginMarquee, dragMarquee, previewMarquee, commitMarquee, wandSelectAt, beginBrush, dragBrush, endBrush, beginMove as moveBegin, planMove, applyMove, beginShape as shapeBegin, dragShape, beginGradient as gradientBegin, dragGradient, gradientHasLength, writeText, FONTS, pickHex, fillAt, setTool as setToolState, panelsFor, cursorFor, hintFor, toDoc as docPoint, notify } from './src/tools/index.js';
import {
  toast, configureStart, renderPresets, renderRecent, renderTemplates, paintTemplatePreviews, renderNott,
  configureLayers, renderLayers, setColor, setBgColor, swapColors, resetColors, renderPalette, setFill, hslFromUI,
  adjustDefaults, syncAdjustUI,
} from './src/ui/index.js';

(() => {
  'use strict';

  /* ------------------------------------------------------------------ utils */
  /* Đã tách sang section: $ $$ dpr loadImage → src/platform · clamp esc fmt pad uid
     → src/shared · hex/rgb/hsl → src/core/color.js · bezierPoints → src/core/geometry.js */

  async function api(path, body) {
    const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    const res = await fetch(path, opts);
    const text = await res.text();
    let data = null;
    try { data = JSON.parse(text); } catch { /* not json */ }
    if (!res.ok) throw new Error((data && data.error) || text || res.statusText);
    return data || {};
  }

  /* ------------------------------------------------------------------ state */
  const PRESETS = [
    { key: 'poster', name: 'Poster', w: 1080, h: 1350, note: 'dọc' },
    { key: 'square', name: 'Vuông', w: 1080, h: 1080, note: '1:1' },
    { key: 'story', name: 'Story', w: 1080, h: 1920, note: 'dọc dài' },
    { key: 'avatar', name: 'Avatar', w: 800, h: 800, note: 'tròn' },
  ];
  const CRAF_SWATCHES = [
    '#16130E', '#3A3428', '#6B6154', '#A69A85', '#D9CFB9', '#F1E9D8', '#FDFAF3', '#FF4D24',
    '#FF8A5B', '#FFC24B', '#9BD46A', '#3E9D8B', '#2F6FED', '#7B5CFA', '#D9478A', '#8C3B1E',
  ];

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

  /** Dựng doc xem trước cho thẻ mẫu (không đụng doc thật). */
  function previewDoc(key) {
    const doc = { w: 1080, h: 1350, bg: '#FDFAF3', layers: [] };
    if (key === 'poster') { seedPoster(doc); }
    else if (key === 'monogram') { doc.w = 800; doc.h = 800; seedMonogram(doc); }
    else { doc.w = 1080; doc.h = 1920; seedBands(doc); }
    return doc;
  }

  /* ------------------------------------------------------------------ document model */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function createProject(name, w, h, seed) {
    const doc = {
      ...newDocData(uniqueProjectName(state.projects, name), w, h),
      layers: [newLayer(w, h, 'Lớp 1')],
    };
    if (seed) seed(doc);
    openDoc(doc);
    markDirty();
  }

  function openDoc(doc) {
    activate(doc);
    syncSelView(null);
    showStudio();
    $('#projectName').value = doc.name;
    $('#projectMeta').textContent = `${doc.w} × ${doc.h} PX`;
    renderLayers();
    renderPalette();
    applyView();
    requestAnimationFrame(() => fit());
    clearOverlay();
    clearSelection();
    syncAdjustUI();
    updateToolUI();
    setSaveState('saved');
    $('#btnDrawerSend').disabled = false;
  }

  async function openProject(id) {
    try {
      const data = await api('/library/' + encodeURIComponent(id) + '.json');
      const doc = docFromJSON(data);
      for (const raw of data.layers || []) {
        const l = layerFromJSON(raw);
        const layer = newLayer(doc.w, doc.h, l.name);
        layer.visible = l.visible;
        layer.opacity = l.opacity;
        layer.blend = l.blend;
        if (l.src) {
          try {
            const img = await loadImage(l.src);
            layer.ctx.drawImage(img, 0, 0, doc.w, doc.h);
          } catch { /* keep empty */ }
        }
        doc.layers.push(layer);
      }
      if (!doc.layers.length) doc.layers.push(newLayer(doc.w, doc.h, 'Lớp 1'));
      openDoc(doc);
    } catch (err) {
      toast('Không mở được bản vẽ: ' + err.message, 'err');
    }
  }

  async function goStart() {
    await saveNow();
    state.doc = null;
    state.draw = null;
    document.body.dataset.mode = 'start';
    $('#viewStudio').hidden = true;
    $('#viewStart').hidden = false;
    closeDrawer();
    await refresh();
    window.scrollTo(0, 0);
  }

  function showStudio() {
    document.body.dataset.mode = 'studio';
    $('#viewStart').hidden = true;
    $('#viewStudio').hidden = false;
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

  function markDirty() {
    state.dirty = true;
    setSaveState('dirty');
    clearTimeout(state.saveTimer);
    state.saveTimer = setTimeout(saveNow, 1000);
  }

  function setSaveState(kind) {
    const el = $('#saveState');
    const span = el.querySelector('span');
    el.classList.remove('dirty', 'saving');
    if (kind === 'dirty') { el.classList.add('dirty'); span.textContent = 'Chưa lưu'; }
    else if (kind === 'saving') { el.classList.add('saving'); span.textContent = 'Đang lưu…'; }
    else {
      const t = new Date();
      span.textContent = 'Đã lưu · ' + pad(t.getHours()) + ':' + pad(t.getMinutes());
    }
    el.title = span.textContent;
  }

  /* ------------------------------------------------------------------ save / export / nott */
  function compositeCanvas(w, h, transparent = false) {
    return compositeDoc(state.doc, w, h, transparent);
  }

  function thumbData() {
    const w = Math.min(480, state.doc.w);
    const h = Math.round(w * state.doc.h / state.doc.w);
    return jpegDataURL(compositeCanvas(w, h), 0.84);
  }

  async function saveNow() {
    clearTimeout(state.saveTimer);
    if (!state.doc || state.saving) return;
    state.saving = true;
    setSaveState('saving');
    const doc = state.doc;
    const payload = toPayload(doc, (l) => pngDataURL(l.canvas), thumbData());
    try {
      const res = await api('/api/projects', payload);
      state.dirty = false;
      const entry = {
        id: doc.id, name: doc.name, w: doc.w, h: doc.h,
        updatedAt: res.updatedAt || Date.now(), thumb: `/library/${doc.id}.jpg`,
      };
      const ix = state.projects.findIndex((p) => p.id === doc.id);
      if (ix >= 0) state.projects[ix] = entry; else state.projects.unshift(entry);
      state.projects.sort((a, b) => b.updatedAt - a.updatedAt);
      setSaveState('saved');
      renderRecent();
    } catch (err) {
      setSaveState('dirty');
      toast('Không lưu được: ' + err.message, 'err');
    } finally {
      state.saving = false;
    }
  }

  function openExport() {
    if (!state.doc) { toast('Mở một bản vẽ trước đã', 'warn'); return; }
    $('#exportName').value = (state.doc.name || 'craf').replace(/[\\/:*?"<>|]+/g, '').trim() || 'craf';
    $('#exportModal').hidden = false;
    updateExportInfo();
    $('#exportName').focus();
    $('#exportName').select();
  }

  function exportDims() {
    const scale = parseFloat($('#exportScale').value) || 1;
    return { w: Math.max(1, Math.round(state.doc.w * scale)), h: Math.max(1, Math.round(state.doc.h * scale)), scale };
  }

  function updateExportInfo() {
    if (!state.doc) return;
    const fmt = $('#exportFormat').value;
    const { w, h, scale } = exportDims();
    const lossy = fmt !== 'png';
    $('#exportQualityRow').hidden = !lossy;
    const alpha = $('#exportAlpha');
    alpha.disabled = fmt === 'jpeg';
    if (fmt === 'jpeg') alpha.checked = false;
    else if (!alpha.disabled && !state.dirty && alpha.dataset.touched !== '1') alpha.checked = true;
    const size = fmt === 'png' ? 'PNG · nền trong suốt' : (fmt === 'jpeg' ? 'JPEG · nền giấy' : 'WebP');
    $('#exportInfo').textContent = `${w} × ${h} px · ${Math.round(scale * 100)}% · ${size}`;
    $('#exportAlphaRow').style.opacity = fmt === 'jpeg' ? '0.4' : '1';
  }

  function runExport() {
    if (!state.doc) return;
    try {
      const fmt = $('#exportFormat').value;
      const mime = fmt === 'jpeg' ? 'image/jpeg' : fmt === 'webp' ? 'image/webp' : 'image/png';
      const ext = fmt === 'jpeg' ? 'jpg' : fmt;
      const { w, h } = exportDims();
      const transparent = fmt !== 'jpeg' && $('#exportAlpha').checked;
      const c = compositeCanvas(w, h, transparent);
      const q = clamp(parseInt($('#exportQuality').value, 10) / 100, 0.4, 1);
      const name = ($('#exportName').value || state.doc.name || 'craf').replace(/[\\/:*?"<>|]+/g, '').trim() || 'craf';
      const a = document.createElement('a');
      a.download = name + '.' + ext;
      a.href = c.toDataURL(mime, q);
      a.click();
      $('#exportModal').hidden = true;
      toast('Đã xuất ' + fmt.toUpperCase() + ' · ' + w + ' × ' + h);
    } catch (err) {
      toast('Xuất thất bại: ' + err.message, 'err');
    }
  }

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

  function openStrokeModal() {
    if (!state.doc) return;
    if (!state.sel.active) { toast('Tạo một vùng chọn trước đã', 'warn'); return; }
    finishAdjust();
    $('#strokeWidth').value = '4';
    $('#strokeAlign').value = 'center';
    $('#strokeColor').value = 'fg';
    $('#strokeModal').hidden = false;
    $('#strokeWidth').focus();
    $('#strokeWidth').select();
  }

  function closeStrokeModal() { $('#strokeModal').hidden = true; }

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

  let docBgPushed = false;
  function openDocBgPicker() {
    if (!state.doc) return;
    finishAdjust();
    docBgPushed = false;
    const p = $('#docBgPicker');
    p.value = state.doc.bg || '#FDFAF3';
    p.click();
  }

  function previewDocBg(hex) {
    if (!state.doc) return;
    if (!docBgPushed) { pushDocHistory(); docBgPushed = true; }
    state.doc.bg = hex;
    render();
    markDirty();
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

  /* ------------------------------------------------------------------ document geometry */
  function updateDocMeta() {
    if (!state.doc) return;
    $('#projectMeta').textContent = `${state.doc.w} × ${state.doc.h} PX`;
  }

  function afterGeometryChange() {
    updateDocMeta();
    clearSelection();
    state.fitMode = true;
    applyView();
    requestAnimationFrame(() => fit());
    renderLayers();
    render();
    markDirty();
  }

  function resizeImage(w, h) {
    if (!state.doc) return;
    finishAdjust();
    pushDocHistory();
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

  function resizeCanvas(w, h, anchor) {
    if (!state.doc) return;
    finishAdjust();
    pushDocHistory();
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

  function cropToSelection() {
    if (!state.doc) return;
    if (!state.sel.active || !state.sel.bbox) { toast('Hãy tạo vùng chọn trước', 'warn'); return; }
    finishAdjust();
    pushDocHistory();
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

  function flipDoc(horizontal) {
    if (!state.doc) return;
    finishAdjust();
    pushDocHistory();
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

  function rotateDoc(dir) {
    if (!state.doc) return;
    finishAdjust();
    pushDocHistory();
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

  let sizeMode = 'image';
  let sizeRatio = 0.8;
  function openSizeModal(mode) {
    sizeMode = mode;
    const doc = state.doc;
    const startW = mode === 'new' ? 1080 : doc.w;
    const startH = mode === 'new' ? 1350 : doc.h;
    sizeRatio = startW / startH;
    $('#sizeW').value = String(startW);
    $('#sizeH').value = String(startH);
    $('#sizeKeepRow').hidden = mode === 'canvas';
    $('#sizeAnchorRow').hidden = mode !== 'canvas';
    if (mode === 'new') {
      $('#sizeTitle').textContent = 'Bản vẽ mới';
      $('#sizeNote').textContent = 'Mở một tờ giấy trắng với kích thước bạn muốn. Bản vẽ đang mở sẽ được lưu trước.';
      $('#btnSizeApply').textContent = 'Mở bản vẽ';
    } else if (mode === 'image') {
      $('#sizeTitle').textContent = 'Kích thước ảnh';
      $('#sizeNote').textContent = 'Phóng to hoặc thu nhỏ toàn bộ nội dung. Các lớp được lấy mẫu lại theo kích thước mới.';
      $('#btnSizeApply').textContent = 'Đổi kích thước';
    } else {
      $('#sizeTitle').textContent = 'Kích thước canvas';
      $('#sizeNote').textContent = 'Mở rộng hoặc thu hẹp khung giấy, giữ nguyên độ lớn của nội dung. Chọn điểm neo để đặt nội dung.';
      $('#btnSizeApply').textContent = 'Đổi canvas';
    }
    $('#sizeModal').hidden = false;
    $('#sizeW').focus();
    $('#sizeW').select();
  }

  function closeSizeModal() { $('#sizeModal').hidden = true; }

  function openTransformModal() {
    if (!state.doc) return;
    finishAdjust();
    $('#tfScaleX').value = '100';
    $('#tfScaleY').value = '100';
    $('#tfAngle').value = '0';
    $('#tfFlipH').checked = false;
    $('#tfFlipV').checked = false;
    $('#transformModal').hidden = false;
    $('#tfScaleX').focus();
    $('#tfScaleX').select();
  }

  function closeTransformModal() { $('#transformModal').hidden = true; }

  function applyLayerTransform() {
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
    pushLayerHistory();
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
    render();
    updateLayerThumb();
    markDirty();
    toast(`Đã biến đổi lớp · ${Math.round(sx * 100)}% × ${Math.round(sy * 100)}%${angle ? ' · ' + angle + '°' : ''}`, 'ok', 1800);
  }

  function applySizeModal() {
    const w = clamp(parseInt($('#sizeW').value, 10) || 1080, 16, 6000);
    const h = clamp(parseInt($('#sizeH').value, 10) || 1350, 16, 6000);
    closeSizeModal();
    if (sizeMode === 'new') {
      saveNow();
      createProject(`Bản vẽ ${w}×${h}`, w, h);
    } else if (sizeMode === 'image') {
      resizeImage(w, h);
    } else if (sizeMode === 'canvas') {
      resizeCanvas(w, h, $('#sizeAnchor').value);
    }
  }


  /* ------------------------------------------------------------------ templates */
  function createTemplate(key) {
    if (key === 'poster') {
      createProject('Poster mực', 1080, 1350, seedPoster);
    } else if (key === 'monogram') {
      createProject('Monogram', 800, 800, seedMonogram);
    } else {
      createProject('Dải màu', 1080, 1920, seedBands);
    }
  }

  function seedPoster(doc) {
    doc.bg = '#F6F1E5';
    const art = newLayer(doc.w, doc.h, 'Mực');
    const ctx = art.ctx;
    ctx.fillStyle = '#FF4D24';
    ctx.beginPath(); ctx.arc(790, 455, 250, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = 'rgba(22,19,14,.85)';
    ctx.lineWidth = 26; ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(110, 880);
    ctx.bezierCurveTo(360, 700, 700, 1010, 990, 760);
    ctx.stroke();
    ctx.strokeStyle = 'rgba(22,19,14,.25)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(96, 1180); ctx.lineTo(984, 1180); ctx.stroke();
    const type = newLayer(doc.w, doc.h, 'Chữ');
    const t = type.ctx;
    t.fillStyle = '#16130E';
    t.font = '500 150px "Fraunces", Georgia, serif';
    t.fillText('ý tưởng', 96, 640);
    t.fillStyle = '#FF4D24';
    t.font = 'italic 500 150px "Fraunces", Georgia, serif';
    t.fillText('thành hình.', 96, 790);
    t.fillStyle = 'rgba(22,19,14,.6)';
    t.font = '400 22px "Geist Mono", monospace';
    t.fillText('CRAF — POSTER 01', 96, 1248);
    t.fillText('1080 × 1350', 790, 1248);
    doc.layers = [art, type];
    doc.active = 1;
  }

  function seedMonogram(doc) {
    doc.bg = '#141210';
    const ring = newLayer(doc.w, doc.h, 'Vòng');
    ring.ctx.strokeStyle = '#F6F1E5';
    ring.ctx.lineWidth = 3;
    ring.ctx.beginPath(); ring.ctx.arc(400, 400, 300, 0, Math.PI * 2); ring.ctx.stroke();
    const type = newLayer(doc.w, doc.h, 'Chữ');
    const t = type.ctx;
    t.fillStyle = '#F6F1E5';
    t.font = '500 430px "Fraunces", Georgia, serif';
    t.textAlign = 'center';
    t.textBaseline = 'middle';
    t.fillText('C', 400, 386);
    t.fillStyle = '#FF4D24';
    t.beginPath(); t.arc(400, 642, 9, 0, Math.PI * 2); t.fill();
    t.fillStyle = 'rgba(246,241,229,.55)';
    t.font = '400 19px "Geist Mono", monospace';
    t.textAlign = 'left';
    t.textBaseline = 'alphabetic';
    t.fillText('CRAF / MONOGRAM', 96, 724);
    doc.layers = [ring, type];
    doc.active = 1;
  }

  function seedBands(doc) {
    doc.bg = '#F6F1E5';
    const bands = newLayer(doc.w, doc.h, 'Dải');
    const b = bands.ctx;
    b.fillStyle = '#FF4D24'; b.fillRect(0, 0, 360, 1920);
    b.fillStyle = '#16130E'; b.fillRect(360, 0, 360, 1920);
    b.fillStyle = '#F6F1E5';
    b.beginPath(); b.arc(540, 520, 148, 0, Math.PI * 2); b.fill();
    b.fillStyle = '#FF4D24';
    b.beginPath(); b.arc(720, 1420, 62, 0, Math.PI * 2); b.fill();
    const type = newLayer(doc.w, doc.h, 'Chữ');
    const t = type.ctx;
    t.save();
    t.translate(180, 1100);
    t.rotate(-Math.PI / 2);
    t.fillStyle = '#F6F1E5';
    t.font = '400 54px "Geist Mono", monospace';
    t.fillText('STORY — 01', 0, 0);
    t.restore();
    t.fillStyle = '#16130E';
    t.font = '500 118px "Fraunces", Georgia, serif';
    t.fillText('đổi', 420, 980);
    t.fillText('màu', 420, 1098);
    t.fillStyle = 'rgba(22,19,14,.55)';
    t.font = '400 20px "Geist Mono", monospace';
    t.fillText('CRAF / 1080 × 1920', 420, 1800);
    doc.layers = [bands, type];
    doc.active = 1;
  }

  /* ------------------------------------------------------------------ hero poster */
  function spacedText(ctx, text, x, y, spacing, align = 'left') {
    const chars = Array.from(text);
    let width = 0;
    for (const ch of chars) width += ctx.measureText(ch).width + spacing;
    width -= spacing;
    let cx = align === 'right' ? x - width : x;
    for (const ch of chars) {
      ctx.fillText(ch, cx, y);
      cx += ctx.measureText(ch).width + spacing;
    }
    return width;
  }

  function grain(ctx, w, h) {
    const n = makeCanvas(180, 180);
    const nc = n.getContext('2d');
    const img = nc.createImageData(180, 180);
    for (let i = 0; i < img.data.length; i += 4) {
      const v = 208 + Math.random() * 47;
      img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 52;
    }
    nc.putImageData(img, 0, 0);
    const pat = ctx.createPattern(n, 'repeat');
    ctx.save();
    ctx.globalCompositeOperation = 'multiply';
    ctx.globalAlpha = 0.62;
    ctx.fillStyle = pat;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
  }

  function inkRibbon(ctx, pts, widthAt, color, upto = 1) {
    const n = Math.max(2, Math.floor(pts.length * upto));
    const left = [], right = [];
    for (let i = 0; i < n; i++) {
      const p = pts[i];
      const q = pts[Math.min(i + 1, pts.length - 1)];
      const dx = q.x - p.x, dy = q.y - p.y;
      const len = Math.hypot(dx, dy) || 1;
      const nx = -dy / len, ny = dx / len;
      const w = widthAt(i / Math.max(1, pts.length - 1)) / 2;
      left.push({ x: p.x + nx * w, y: p.y + ny * w });
      right.push({ x: p.x - nx * w, y: p.y - ny * w });
    }
    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(left[0].x, left[0].y);
    for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
    for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  let heroRun = 0;
  async function paintHero() {
    const c = $('#heroPoster');
    if (!c) return;
    const run = ++heroRun;
    try {
      await document.fonts.load('500 140px "Fraunces"');
      await document.fonts.load('italic 500 140px "Fraunces"');
      await document.fonts.load('400 20px "Geist Mono"');
    } catch { /* fall back */ }
    const W = 1080, H = 1350;
    const ctx = c.getContext('2d');
    const drawBase = () => {
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.fillStyle = '#F6F1E5';
      ctx.fillRect(0, 0, W, H);
      grain(ctx, W, H);
      ctx.strokeStyle = 'rgba(22,19,14,.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(88, 150); ctx.lineTo(992, 150); ctx.stroke();
      ctx.fillStyle = 'rgba(22,19,14,.72)';
      ctx.font = '400 20px "Geist Mono", monospace';
      spacedText(ctx, 'CRAF — BÀN VẼ SỐ 01', 88, 112, 2.6);
      ctx.textAlign = 'right';
      ctx.fillText('19 · 11 · 2026', 992, 112);
      ctx.textAlign = 'left';
      ctx.strokeStyle = 'rgba(22,19,14,.26)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(846, 536, 352, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = '#FF4D24';
      ctx.beginPath(); ctx.arc(846, 536, 300, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#F6F1E5';
      ctx.beginPath(); ctx.arc(846, 536, 62, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#16130E';
      ctx.font = '400 34px "Geist Mono", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('01', 846, 548);
      ctx.textAlign = 'left';
      ctx.fillStyle = '#16130E';
      ctx.font = '500 140px "Fraunces", Georgia, serif';
      ctx.fillText('Vẽ ra thứ', 88, 1078);
      ctx.fillStyle = '#FF4D24';
      ctx.font = 'italic 500 140px "Fraunces", Georgia, serif';
      ctx.fillText('đáng để giữ.', 88, 1216);
      ctx.strokeStyle = 'rgba(22,19,14,.18)';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(88, 1268); ctx.lineTo(992, 1268); ctx.stroke();
      ctx.fillStyle = 'rgba(22,19,14,.62)';
      ctx.font = '400 18px "Geist Mono", monospace';
      ctx.fillText('POSTER · 1080 × 1350', 88, 1308);
      ctx.textAlign = 'right';
      ctx.fillText('NOTT READY', 992, 1308);
      ctx.textAlign = 'left';
      ctx.save();
      ctx.translate(54, 880);
      ctx.rotate(-Math.PI / 2);
      ctx.fillStyle = 'rgba(22,19,14,.42)';
      ctx.font = '400 15px "Geist Mono", monospace';
      spacedText(ctx, 'BÀN VẼ CỤC BỘ — CRAF 01', 0, 0, 1.8);
      ctx.restore();
      ctx.strokeStyle = 'rgba(22,19,14,.3)';
      ctx.lineWidth = 1.5;
      [[40, 40, 1, 1], [1040, 40, -1, 1], [40, 1310, 1, -1], [1040, 1310, -1, -1]].forEach(([x, y, sx, sy]) => {
        ctx.beginPath();
        ctx.moveTo(x + 20 * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + 20 * sy);
        ctx.stroke();
      });
    };
    drawBase();
    const path = bezierPoints({ x: 92, y: 826 }, { x: 330, y: 676 }, { x: 650, y: 930 }, { x: 1000, y: 744 });
    const widthAt = (t) => 6 + 26 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06)), 0.62);
    const t0 = performance.now();
    const dur = 1100;
    const step = () => {
      if (run !== heroRun) return;
      const k = Math.min(1, (performance.now() - t0) / dur);
      const eased = 1 - Math.pow(1 - k, 3);
      drawBase();
      inkRibbon(ctx, path, widthAt, '#16130E', Math.max(0.01, eased));
      if (k < 1) requestAnimationFrame(step);
      else inkRibbon(ctx, path, widthAt, '#16130E', 1);
    };
    step();
  }

  /* ------------------------------------------------------------------ drawer / help */
  function openDrawer() {
    closeIns();
    $('#nottDrawer').hidden = false;
    $('#scrim').hidden = false;
    $('#btnDrawerSend').disabled = !state.doc;
  }
  function closeDrawer() {
    $('#nottDrawer').hidden = true;
    $('#scrim').hidden = true;
  }
  function openHelp() { $('#helpModal').hidden = false; }
  function closeHelp() { $('#helpModal').hidden = true; }

  /* ------------------------------------------------------------------ commands / menubar */
  function closeMenus() {
    $$('.menu.open').forEach((m) => {
      m.classList.remove('open');
      const b = m.querySelector('.menu-btn');
      if (b) b.setAttribute('aria-expanded', 'false');
    });
  }

  function openMenu(m) {
    closeMenus();
    if (!m) return;
    m.classList.add('open');
    const b = m.querySelector('.menu-btn');
    if (b) b.setAttribute('aria-expanded', 'true');
  }

  function bindMenubar() {
    const bar = $('#menubar');
    bar.addEventListener('click', (e) => {
      const btn = e.target.closest('.menu-btn');
      if (btn) {
        const menu = btn.parentElement;
        if (menu.classList.contains('open')) closeMenus();
        else openMenu(menu);
        return;
      }
      const cmd = e.target.closest('[data-cmd]');
      if (!cmd) return;
      closeMenus();
      runCommand(cmd.dataset.cmd);
    });
    $$('.menu').forEach((m) => {
      m.addEventListener('pointerenter', () => {
        if ($('.menu.open') && !m.classList.contains('open')) openMenu(m);
      });
    });
    document.addEventListener('pointerdown', (e) => {
      if (!e.target.closest('#menubar')) closeMenus();
    });
  }

  function openPane(name) {
    $$('.ins-tab').forEach((t) => t.classList.toggle('active', t.dataset.pane === name));
    $('#paneColor').hidden = name !== 'color';
    $('#paneAdjust').hidden = name !== 'adjust';
    $('#paneLayers').hidden = name !== 'layers';
    if (name === 'adjust') {
      ensureAdjust();
      syncAdjustUI();
    }
    if (window.matchMedia('(max-width: 760px)').matches) openIns();
  }

  function runCommand(name) {
    const needDoc = !['new', 'open', 'help'].includes(name);
    if (needDoc && !state.doc) { toast('Mở một bản vẽ trước đã', 'warn'); return; }
    switch (name) {
      case 'new': openSizeModal('new'); break;
      case 'open': goStart(); break;
      case 'save': saveNow(); break;
      case 'export': openExport(); break;
      case 'import': $('#fileImage').value = ''; $('#fileImage').click(); break;
      case 'nott': openDrawer(); break;
      case 'undo': undo(); break;
      case 'redo': redo(); break;
      case 'cut': copySelection(true); break;
      case 'copy': copySelection(false); break;
      case 'paste': pasteClipboard(); break;
      case 'fill': fillSelected(); break;
      case 'strokeSel': openStrokeModal(); break;
      case 'clear': clearSelectedContent(); break;
      case 'imageSize': openSizeModal('image'); break;
      case 'canvasSize': openSizeModal('canvas'); break;
      case 'crop': cropToSelection(); break;
      case 'flipH': flipDoc(true); break;
      case 'flipV': flipDoc(false); break;
      case 'rotateL': rotateDoc(-1); break;
      case 'rotateR': rotateDoc(1); break;
      case 'invertColors': applyFilter('invert', 'Đã đảo màu lớp'); break;
      case 'docBg': openDocBgPicker(); break;
      case 'clearGuides': state.guidesX = []; state.guidesY = []; drawAnts(); toast('Đã xoá đường dóng', 'ok', 1400); break;
      case 'layerAdd': addLayer(); break;
      case 'layerDup': duplicateLayer(); break;
      case 'layerDel': deleteLayer(); break;
      case 'mergeDown': mergeDown(); break;
      case 'mergeAll': mergeAll(); break;
      case 'layerTransform': openTransformModal(); break;
      case 'selectAll': selectAll(); break;
      case 'deselect': clearSelection(); break;
      case 'invertSel': invertSelection(); break;
      case 'selectLayerContent': selectLayerContent(); break;
      case 'wand': setTool('wand'); break;
      case 'marquee': setTool('marquee'); break;
      case 'lasso': setTool('lasso'); break;
      case 'filterBlur': applyFilter('blur', 'Đã làm mờ lớp'); break;
      case 'filterSharpen': applyFilter('sharpen', 'Đã làm nét lớp'); break;
      case 'filterNoise': applyFilter('noise', 'Đã thêm nhiễu hạt'); break;
      case 'filterPixel': applyFilter('pixel', 'Đã pixel hoá lớp'); break;
      case 'filterEmboss': applyFilter('emboss', 'Đã dập nổi lớp'); break;
      case 'filterVignette': applyFilter('vignette', 'Đã làm tối bốn góc'); break;
      case 'filterGrain': applyFilter('grain', 'Đã phủ hạt phim'); break;
      case 'filterGray': applyFilter('gray', 'Đã chuyển trắng đen'); break;
      case 'filterSepia': applyFilter('sepia', 'Đã phủ nâu cổ'); break;
      case 'adjustPane': openPane('adjust'); break;
      default: break;
    }
  }

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
  async function refresh() {
    try {
      const data = await api('/api/bootstrap');
      state.projects = data.projects || [];
      state.nott = data.nott || { ok: false };
    } catch (err) {
      state.nott = { ok: false, root: '' };
      toast('Không đọc được thư viện: ' + err.message, 'err');
    }
    renderRecent();
    renderNott();
  }

  async function refreshNott() {
    try {
      state.nott = await api('/api/nott');
      renderNott();
    } catch { /* ignore */ }
  }

  function openIns() {
    document.body.classList.add('ins-open');
    $('#insScrim').hidden = false;
  }

  function closeIns() {
    document.body.classList.remove('ins-open');
    $('#insScrim').hidden = true;
  }

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
      openPane('color');
    });
    $('#btnInsClose').addEventListener('click', closeIns);
    $('#insScrim').addEventListener('click', closeIns);

    $$('.ins-tab').forEach((tab) => tab.addEventListener('click', () => {
      openPane(tab.dataset.pane);
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
      if (docBgPushed) toast('Đã đổi màu nền canvas', 'ok', 1400);
      docBgPushed = false;
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
    $('#sizeModal').addEventListener('click', (e) => { if (e.target.id === 'sizeModal') closeSizeModal(); });    $('#sizeW').addEventListener('input', () => {
      if (sizeMode !== 'image' || !$('#sizeKeep').checked) return;
      const w = parseInt($('#sizeW').value, 10);
      if (w > 0) $('#sizeH').value = String(Math.max(16, Math.round(w / sizeRatio)));
    });
    $('#sizeH').addEventListener('input', () => {
      if (sizeMode !== 'image' || !$('#sizeKeep').checked) return;
      const h = parseInt($('#sizeH').value, 10);
      if (h > 0) $('#sizeW').value = String(Math.max(16, Math.round(h * sizeRatio)));
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

    bindMenubar();
    bindGuides();
    bindDropImport();

    window.addEventListener('resize', () => { if (state.fitMode) fit(); else { applyView(); } });
    document.addEventListener('keydown', onKey);
    document.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        state.space = false;
        $('#stage').style.cursor = '';
        if (overlay.style.cursor === 'grab') overlay.style.cursor = state.tool === 'brush' ? 'none' : 'crosshair';
      }
    });
    document.addEventListener('beforeunload', () => { if (state.doc && state.dirty) saveNow(); });
  }

  function onKey(e) {
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if ($('.menu.open')) { closeMenus(); return; }
      if (!$('#helpModal').hidden) { closeHelp(); return; }
      if (!$('#sizeModal').hidden) { closeSizeModal(); return; }
      if (!$('#transformModal').hidden) { closeTransformModal(); return; }
      if (!$('#strokeModal').hidden) { closeStrokeModal(); return; }
      if (!$('#exportModal').hidden) { $('#exportModal').hidden = true; return; }
      if (!$('#nottDrawer').hidden) { closeDrawer(); return; }
      if (document.body.classList.contains('ins-open')) { closeIns(); return; }
      if (state.selPreview) { state.selPreview = null; state.draw = null; requestAnts(); return; }
      if (state.sel.active) { clearSelection(); return; }
    }
    if (!$('#helpModal').hidden || !$('#sizeModal').hidden || !$('#transformModal').hidden || !$('#strokeModal').hidden || !$('#exportModal').hidden) return;
    if (typing) return;
    if (mod && e.shiftKey && k === 'n') { e.preventDefault(); addLayer(); return; }
    if (mod && k === 'n') { e.preventDefault(); openSizeModal('new'); return; }
    if (mod && k === 'a') { e.preventDefault(); selectAll(); return; }
    if (mod && k === 'd') { e.preventDefault(); clearSelection(); return; }
    if (mod && k === 'c') { e.preventDefault(); copySelection(false); return; }
    if (mod && k === 'x') { e.preventDefault(); copySelection(true); return; }
    if (mod && k === 'v') { if (state.clipboard) { e.preventDefault(); pasteClipboard(); } return; }
    if (mod && k === 'j') { e.preventDefault(); duplicateLayer(); return; }
    if (mod && k === 't') { e.preventDefault(); openTransformModal(); return; }
    if (mod && e.shiftKey && k === 'm') { e.preventDefault(); mergeAll(); return; }
    if (mod && k === 'm') { e.preventDefault(); mergeDown(); return; }
    if (mod && e.shiftKey && k === 'i') { e.preventDefault(); invertSelection(); return; }
    if (mod && k === 'i') { e.preventDefault(); applyFilter('invert', 'Đã đảo màu lớp'); return; }
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); redo(); return; }
    if (mod && k === 's') { e.preventDefault(); saveNow(); return; }
    if (mod && k === 'e') { e.preventDefault(); openExport(); return; }
    if (mod && k === 'g') { e.preventDefault(); $('#btnGrid').click(); return; }
    if (e.altKey && e.key === 'Backspace') { e.preventDefault(); fillSelected(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); clearSelectedContent(); return; }
    if (e.code === 'Space') { e.preventDefault(); state.space = true; if (state.doc) overlay.style.cursor = 'grab'; return; }
    if (e.key === '[') { state.size = clamp(state.size - (state.size > 30 ? 6 : 2), 1, 180); syncSizeUI(); return; }
    if (e.key === ']') { state.size = clamp(state.size + (state.size > 30 ? 6 : 2), 1, 180); syncSizeUI(); return; }
    if (e.key === '0') { fit(); return; }
    if (e.key === '1') { setZoom(1); return; }
    if (e.key === '?') { openHelp(); return; }
    if (!state.doc) return;
    if (k === 'x') { swapColors(); return; }
    if (k === 'd') { resetColors(); return; }
    const map = {
      b: 'brush', e: 'eraser', l: 'line', r: 'rect', o: 'ellipse', g: 'fill',
      i: 'pick', t: 'text', h: 'hand', v: 'move', m: 'marquee', q: 'lasso', w: 'wand', u: 'gradient',
    };
    if (map[k]) setTool(map[k]);
  }

  function boot() {
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
