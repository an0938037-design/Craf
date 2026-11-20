/* Craf — bàn vẽ. Vanilla canvas studio with a Nott bridge. */
import { $, $$, dpr, loadImage } from './src/platform/index.js';
import { clamp, esc, fmt, pad, uid } from './src/shared/index.js';
import { bezierPoints, maskAll, maskBounds, maskFromRect as coreMaskFromRect, maskInvert, hexToHsl, hexToRgb, hslToHex, rgbToHsl, rgbToHex } from './src/core/index.js';
import { maskToCanvas, maskExtract, maskFromLayerAlpha, maskFromWand as maskFromWandFn, maskFromPolygon as pixelMaskFromPolygon, maskTranslate, compositeSample } from './src/pixel/index.js';
import { selection } from './src/model/index.js';
import { selectionPath } from './src/render/index.js';

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

  function toast(msg, kind = 'ok', ms = 3200) {
    const box = $('#toasts');
    const el = document.createElement('div');
    el.className = 'toast' + (kind !== 'ok' ? ' ' + kind : '');
    el.innerHTML = '<i></i><span>' + esc(msg) + '</span>';
    box.appendChild(el);
    setTimeout(() => {
      el.style.transition = 'opacity .25s, transform .25s';
      el.style.opacity = '0';
      el.style.transform = 'translateY(6px)';
      setTimeout(() => el.remove(), 260);
    }, ms);
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

  const state = {
    projects: [], nott: null,
    doc: null, active: 0,
    tool: 'brush', color: '#16130E', bgColor: '#FDFAF3', opacity: 1, size: 18,
    hardness: 0.9, wandTol: 32, gradType: 'linear',
    textSize: 96, font: 'serif', shapeFill: false,
    view: { zoom: 1, x: 32, y: 32 }, fitMode: true,
    undo: [], redo: [],
    dirty: false, saving: false, saveTimer: 0,
    space: false, panning: null, draw: null, textAt: null,
    guides: false, guidesX: [], guidesY: [], guideDrag: null,
    selPreview: null, marquee: null,
    move: null, gradient: null,
    clipboard: null, adjust: null,
    antsPhase: 0,
  };
  let selView = { active: false, bbox: null, data: null, rev: 0 };
  Object.defineProperty(state, 'sel', { get: () => selView, enumerable: true });
  selection.configure({ getDocSize: () => (state.doc ? { w: state.doc.w, h: state.doc.h } : null) });

  const paper = $('#paper');
  const overlay = $('#overlay');
  const ants = $('#ants');
  const board = $('#board');
  const holder = $('#boardHolder');
  const area = $('#boardArea');

  /* ------------------------------------------------------------------ start screen */
  function sheetSize(p) {
    const ratio = p.w / p.h;
    if (ratio >= 1) return { w: Math.min(88, 64 * ratio), h: 64 };
    return { w: 64, h: Math.min(64, 64 / ratio) };
  }

  function renderPresets() {
    const box = $('#presets');
    const cards = PRESETS.map((p) => {
      const s = sheetSize(p);
      return `<button class="preset" type="button" data-preset="${p.key}">
        <span class="preset-sheet" style="width:${s.w}px;height:${s.h}px"><i></i></span>
        <span class="preset-meta"><span class="preset-name">${p.name}</span><span class="preset-dim">${p.w} × ${p.h}</span></span>
      </button>`;
    }).join('');
    box.innerHTML = cards + `<button class="preset custom" type="button" id="presetCustom">
      <span class="preset-sheet" style="width:64px;height:64px"><svg class="ico"><use href="#i-plus"/></svg></span>
      <span class="preset-meta"><span class="preset-name">Khổ khác</span><span class="preset-dim">tuỳ chỉnh</span></span>
    </button>`;
    $$('.preset[data-preset]', box).forEach((el) => el.addEventListener('click', () => {
      const p = PRESETS.find((x) => x.key === el.dataset.preset);
      if (p) createProject(p.name, p.w, p.h);
    }));
    $('#presetCustom').addEventListener('click', openCustomPreset);
  }

  function openCustomPreset() {
    const card = $('#presetCustom');
    if (!card) return;
    card.outerHTML = `<div class="preset custom" id="presetCustomForm">
      <span class="preset-sheet" style="width:64px;height:64px"><svg class="ico"><use href="#i-crop"/></svg></span>
      <div class="preset-custom-form">
        <input id="customW" value="1080" inputmode="numeric" aria-label="Rộng" />
        <span>×</span>
        <input id="customH" value="1350" inputmode="numeric" aria-label="Cao" />
        <button class="btn primary sm" id="customGo" type="button">Mở</button>
      </div>
    </div>`;
    const go = () => {
      const w = clamp(parseInt($('#customW').value, 10) || 1080, 64, 4000);
      const h = clamp(parseInt($('#customH').value, 10) || 1350, 64, 4000);
      createProject(`Bản vẽ ${w}×${h}`, w, h);
    };
    $('#customGo').addEventListener('click', go);
    $$('#presetCustomForm input').forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
    $('#customW').focus();
    $('#customW').select();
  }

  function projectCard(p) {
    return `<div class="project-card" role="button" tabindex="0" data-id="${esc(p.id)}">
      <div class="project-thumb"${p.thumb ? ` style="background-image:url('${esc(p.thumb)}?v=${p.updatedAt}')"` : ''}>
        ${p.thumb ? '' : '<svg class="ico" style="width:22px;height:22px"><use href="#i-image"/></svg>'}
        <span class="badge">${p.w} × ${p.h}</span>
      </div>
      <div class="project-info">
        <span class="project-title">${esc(p.name)}</span>
        <span class="project-sub">SỬA ${timeAgo(p.updatedAt)}</span>
      </div>
    </div>`;
  }

  function timeAgo(ts) {
    const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
    if (s < 60) return 'vừa xong';
    const m = Math.round(s / 60);
    if (m < 60) return m + ' phút trước';
    const h = Math.round(m / 60);
    if (h < 24) return h + ' giờ trước';
    const d = Math.round(h / 24);
    if (d < 7) return d + ' ngày trước';
    return new Date(ts).toLocaleDateString('vi-VN');
  }

  function renderRecent() {
    const box = $('#recent');
    const hint = $('#recentHint');
    if (!state.projects.length) {
      hint.textContent = 'Chưa có bản vẽ nào';
      box.innerHTML = `<div class="recent-empty">
        <div class="project-sub" style="max-width:52ch;line-height:1.7">Chưa có bản vẽ nào trên máy. Mở một khổ giấy ở trên, hoặc bắt đầu từ một mẫu của Craf — mọi thứ tự lưu lại khi bạn vẽ.</div>
      </div>`;
    } else {
      hint.textContent = state.projects.length + ' bản vẽ';
      box.innerHTML = state.projects.slice(0, 8).map(projectCard).join('');
    }
    $$('.project-card', box).forEach((el) => {
      const open = () => openProject(el.dataset.id);
      el.addEventListener('click', open);
      el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
    });
  }

  const TEMPLATES = [
    { key: 'poster', name: 'Poster mực', note: 'mực + chữ', w: 1080, h: 1350 },
    { key: 'monogram', name: 'Monogram', note: 'dấu riêng', w: 800, h: 800 },
    { key: 'bands', name: 'Dải màu', note: 'story', w: 1080, h: 1920 },
  ];

  function renderTemplates() {
    const box = $('#templates');
    box.innerHTML = TEMPLATES.map((t) => `<button class="template-card" type="button" data-template="${t.key}">
      <span class="template-preview"><canvas width="660" height="440"></canvas></span>
      <span class="template-info"><span class="template-name">${t.name}</span><span class="template-sub mono">${t.note} · ${t.w} × ${t.h}</span></span>
    </button>`).join('');
    $$('.template-card', box).forEach((el) => el.addEventListener('click', () => createTemplate(el.dataset.template)));
    paintTemplatePreviews();
  }

  function paintTemplatePreviews() {
    $$('.template-card').forEach((card) => {
      const key = card.dataset.template;
      const canvas = card.querySelector('canvas');
      const ctx = canvas.getContext('2d');
      const W = canvas.width, H = canvas.height;
      const doc = { w: 1080, h: 1350, bg: '#FDFAF3', layers: [] };
      if (key === 'poster') { doc.w = 1080; doc.h = 1350; seedPoster(doc); }
      else if (key === 'monogram') { doc.w = 800; doc.h = 800; seedMonogram(doc); }
      else { doc.w = 1080; doc.h = 1920; seedBands(doc); }
      const s = Math.min(W / doc.w, H / doc.h) * 0.84;
      const dw = doc.w * s, dh = doc.h * s;
      const x = (W - dw) / 2, y = (H - dh) / 2;
      ctx.clearRect(0, 0, W, H);
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,.6)';
      ctx.shadowBlur = 26;
      ctx.shadowOffsetY = 12;
      ctx.fillStyle = doc.bg;
      ctx.fillRect(x, y, dw, dh);
      ctx.restore();
      ctx.save();
      ctx.beginPath(); ctx.rect(x, y, dw, dh); ctx.clip();
      ctx.translate(x, y); ctx.scale(s, s);
      for (const l of doc.layers) {
        if (!l.visible) continue;
        ctx.globalAlpha = l.opacity / 100;
        ctx.drawImage(l.canvas, 0, 0);
      }
      ctx.restore();
    });
  }

  function renderNott() {
    const n = state.nott || { ok: false };
    const chip = $('#nottChip');
    chip.classList.toggle('on', !!n.ok);
    $('#nottMeta').textContent = n.ok ? (n.name || 'đã kết nối') : 'chưa thấy';
    $('#factNott').textContent = n.ok ? 'đã kết nối' : 'chưa thấy';
    $('#statusNott').classList.toggle('on', !!n.ok);
    $('#statusNott').innerHTML = '<i></i>' + (n.ok ? 'Nott · sẵn sàng' : 'Nott · chưa thấy');
    $('#drawerTitle').textContent = n.ok ? 'Nott' : 'Nott — chưa thấy';
    $('#drawerTitle').title = n.root || '';
    $('#nottPerson').textContent = n.ok ? (n.name || 'Người dùng Nott') : 'Không tìm thấy Nott';
    $('#nottGroup').textContent = n.ok ? (n.group || n.root) : (n.root || '');
    const initial = (n.name || 'N').trim().charAt(0).toUpperCase();
    $('#nottAvatar').textContent = initial;
    $('#connState').classList.toggle('on', !!n.ok);
    $('#connState').innerHTML = '<i></i>' + (n.ok ? 'đã kết nối' : 'mất kết nối');

    const palette = (n.palette || []);
    const sw = palette.map((c) => `<button class="swatch" type="button" data-hex="${esc(c.hex)}" title="${esc(c.name)} ${esc(c.hex)}" style="background:${esc(c.hex)}"></button>`).join('');
    $('#nottSwatches').innerHTML = sw || '<span class="swatch-empty mono">chưa có kết nối</span>';
    $('#drawerSwatches').innerHTML = sw || '<span class="swatch-empty mono">chưa đọc được</span>';
    $$('#nottSwatches .swatch, #drawerSwatches .swatch').forEach((el) => el.addEventListener('click', () => setColor(el.dataset.hex)));

    const notes = n.notes || [];
    $('#noteCount').textContent = notes.length ? String(notes.length) : '0';
    $('#noteList').innerHTML = notes.length
      ? notes.map((x) => `<li><b>${esc(x.title)}</b><span>${esc(x.snippet || '—')}</span></li>`).join('')
      : '<li class="note-empty">Chưa có ghi chú nào trong Nott.</li>';

    const imgs = n.images || [];
    $('#nottImages').innerHTML = imgs.length
      ? imgs.slice(0, 12).map((x) => `<button class="nott-thumb" type="button" data-img="${esc(x.name)}" style="background-image:url('/api/nott/thumb?name=${encodeURIComponent(x.name)}')"><span>${esc(x.name)}</span></button>`).join('')
      : '<span class="swatch-empty mono">chưa có ảnh</span>';
    $$('#nottImages .nott-thumb').forEach((el) => el.addEventListener('click', () => importNottImage(el.dataset.img)));
    $('#btnDrawerSend').disabled = !state.doc;
  }

  /* ------------------------------------------------------------------ document model */
  function makeCanvas(w, h) {
    const c = document.createElement('canvas');
    c.width = w; c.height = h;
    return c;
  }

  function newLayer(w, h, name = 'Lớp') {
    const canvas = makeCanvas(w, h);
    return { id: uid(), name, visible: true, opacity: 100, blend: 'source-over', canvas, ctx: canvas.getContext('2d') };
  }

  function copyCanvas(src) {
    const c = makeCanvas(src.width, src.height);
    c.getContext('2d').drawImage(src, 0, 0);
    return c;
  }

  function replaceLayerImage(layer, w, h) {
    const canvas = makeCanvas(w, h);
    layer.canvas = canvas;
    layer.ctx = canvas.getContext('2d');
  }

  function uniqueName(name) {
    if (!state.projects.some((p) => p.name === name)) return name;
    let i = 2;
    while (state.projects.some((p) => p.name === name + ' ' + i)) i++;
    return name + ' ' + i;
  }

  function createProject(name, w, h, seed) {
    const doc = {
      id: uid(),
      name: uniqueName(name),
      w, h,
      bg: '#FDFAF3',
      layers: [newLayer(w, h, 'Lớp 1')],
      active: 0,
      createdAt: Date.now(),
    };
    if (seed) seed(doc);
    openDoc(doc);
    markDirty();
  }

  function openDoc(doc) {
    state.doc = doc;
    state.active = clamp(doc.active ?? doc.layers.length - 1, 0, doc.layers.length - 1);
    state.undo = []; state.redo = [];
    selection.clear(); syncSelView(null); state.selPreview = null;
    state.adjust = null; state.guidesX = []; state.guidesY = [];
    state.fitMode = true;
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
      const doc = {
        id: data.id, name: data.name, w: data.w, h: data.h, bg: data.bg || '#FDFAF3',
        createdAt: data.createdAt || Date.now(), layers: [], active: (data.layers || []).length - 1,
      };
      for (const l of data.layers || []) {
        const layer = newLayer(doc.w, doc.h, l.name);
        layer.visible = l.visible !== false;
        layer.opacity = clamp(l.opacity ?? 100, 0, 100);
        layer.blend = l.blend || 'source-over';
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

  function activeLayer() {
    return state.doc ? state.doc.layers[state.active] : null;
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
  function applyView() {
    if (!state.doc) return;
    const { zoom, x, y } = state.view;
    const cssW = Math.max(1, state.doc.w * zoom);
    const cssH = Math.max(1, state.doc.h * zoom);
    board.style.width = cssW + 'px';
    board.style.height = cssH + 'px';
    holder.style.transform = `translate(${x}px, ${y}px)`;
    const ratio = dpr();
    const bw = Math.max(1, Math.round(cssW * ratio));
    const bh = Math.max(1, Math.round(cssH * ratio));
    if (paper.width !== bw || paper.height !== bh) {
      paper.width = bw; paper.height = bh;
      overlay.width = bw; overlay.height = bh;
      ants.width = bw; ants.height = bh;
    }
    render();
    drawRulers();
    requestAnts();
    $('#zoomVal').textContent = Math.round(zoom * 100) + '%';
  }

  function render() {
    if (!state.doc) return;
    const ctx = paper.getContext('2d');
    const ratio = dpr() * state.view.zoom;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, paper.width, paper.height);
    ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    ctx.fillStyle = state.doc.bg;
    ctx.fillRect(0, 0, state.doc.w, state.doc.h);
    for (const layer of state.doc.layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      ctx.globalAlpha = layer.opacity / 100;
      ctx.globalCompositeOperation = layer.blend || 'source-over';
      ctx.drawImage(layer.canvas, 0, 0);
    }
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
  }

  let renderQueued = false;
  function renderSoon() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }

  function clearOverlay() {
    const ctx = overlay.getContext('2d');
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, overlay.width, overlay.height);
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

  function setSelection(mask, mode = 'replace') {
    if (!state.doc) return null;
    const sel = selection.apply(mask, selection.isActive() ? mode : 'replace');
    syncSelView(sel);
    if (!sel) state.selPreview = null;
    updateSelectionUI();
    requestAnts();
    return sel;
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

  function maskFromRect(x, y, w, h) {
    return coreMaskFromRect(x, y, w, h, state.doc.w, state.doc.h);
  }

  function maskFromPolygon(points) {
    return pixelMaskFromPolygon(points, state.doc.w, state.doc.h);
  }

  function maskFromWand(x, y, tol) {
    const { w, h } = state.doc;
    return maskFromWandFn(compositeSample(state.doc, w, h, true), w, h, x, y, tol);
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

  /* marching ants */
  let antsFrame = 0;
  let antsLast = 0;
  function requestAnts() {
    if (antsFrame) return;
    antsFrame = requestAnimationFrame(() => { antsFrame = 0; drawAnts(); });
  }

  function previewGeometry(m) {
    let x0 = m.start.x, y0 = m.start.y, x1 = m.current.x, y1 = m.current.y;
    if (m.shift) {
      const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
      x1 = x0 + Math.sign(x1 - x0 || 1) * side;
      y1 = y0 + Math.sign(y1 - y0 || 1) * side;
    }
    if (m.alt) {
      x0 = m.start.x - (x1 - m.start.x);
      y0 = m.start.y - (y1 - m.start.y);
    }
    return { x: Math.min(x0, x1), y: Math.min(y0, y1), w: Math.abs(x1 - x0), h: Math.abs(y1 - y0) };
  }

  function selPreviewPath() {
    const p = new Path2D();
    const m = state.selPreview;
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

  function drawAnts() {
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

    if (state.sel.active && selPath()) {
      g.save();
      g.lineWidth = 1 / zoom;
      g.strokeStyle = 'rgba(253, 250, 243, 0.92)';
      g.setLineDash([]);
      g.stroke(selPath());
      g.strokeStyle = 'rgba(10, 10, 11, 0.92)';
      g.setLineDash([5 / zoom, 5 / zoom]);
      g.lineDashOffset = -state.antsPhase / zoom;
      g.stroke(selPath());
      g.restore();
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  function startAnts() {
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

  function fit() {
    if (!state.doc) return;
    const r = area.getBoundingClientRect();
    const padX = 58, padY = 54, ruler = 24;
    const z = Math.min((r.width - ruler - padX * 2) / state.doc.w, (r.height - ruler - padY * 2) / state.doc.h);
    const zoom = clamp(z, 0.04, 3);
    state.view.zoom = zoom;
    state.view.x = ruler + (r.width - ruler - state.doc.w * zoom) / 2;
    state.view.y = ruler + (r.height - ruler - state.doc.h * zoom) / 2;
    state.fitMode = true;
    applyView();
    positionTextEditor();
  }

  function setZoom(z, cx, cy) {
    if (!state.doc) return;
    const r = area.getBoundingClientRect();
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
    positionTextEditor();
  }

  function drawRulers() {
    if (!state.doc) return;
    const left = 24, top = 24;
    const rx = $('#rulerX'), ry = $('#rulerY');
    if (!rx.firstChild) {
      const a = makeCanvas(10, 10); a.className = 'ruler-canvas'; rx.appendChild(a);
      const b = makeCanvas(10, 10); ry.appendChild(b);
    }
    const ratio = dpr();
    const areaRect = area.getBoundingClientRect();
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
    const x0 = state.view.x; // screen x of doc 0 inside the board area
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

  function niceStep(target) {
    const pow = Math.pow(10, Math.floor(Math.log10(Math.max(1, target))));
    const n = target / pow;
    const mult = n <= 1 ? 1 : n <= 2 ? 2 : n <= 5 ? 5 : 10;
    return Math.max(1, mult * pow);
  }

  /* ------------------------------------------------------------------ layers UI */
  function renderLayers() {
    const doc = state.doc;
    if (!doc) return;
    const list = $('#layersList');
    list.innerHTML = '';
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const l = doc.layers[i];
      const row = document.createElement('div');
      row.className = 'layer-row' + (i === state.active ? ' active' : '') + (l.visible ? '' : ' hidden-layer');
      row.draggable = true;
      row.dataset.index = String(i);
      row.innerHTML = `<button class="layer-eye" type="button" title="${l.visible ? 'Ẩn lớp' : 'Hiện lớp'}"><svg class="ico"><use href="#${l.visible ? 'i-eye' : 'i-eye-off'}"/></svg></button>
        <span class="layer-thumb"><canvas width="80" height="80"></canvas></span>
        <span class="layer-name" title="${esc(l.note ? l.name + ' — ' + l.note : l.name)}">${esc(l.name)}</span>
        <span class="layer-op mono">${l.opacity}</span>`;
      const thumb = row.querySelector('canvas');
      const tctx = thumb.getContext('2d');
      const s = Math.min(80 / doc.w, 80 / doc.h);
      tctx.drawImage(l.canvas, (80 - doc.w * s) / 2, (80 - doc.h * s) / 2, doc.w * s, doc.h * s);
      row.addEventListener('click', (e) => {
        if (e.target.closest('.layer-eye') || e.target.closest('.layer-name-input')) return;
        selectLayer(i);
        if (e.ctrlKey || e.metaKey) selectLayerContent();
      });
      row.querySelector('.layer-eye').addEventListener('click', (e) => {
        e.stopPropagation();
        pushDocHistory();
        l.visible = !l.visible;
        renderLayers(); render(); markDirty();
      });
      row.querySelector('.layer-name').addEventListener('dblclick', (e) => {
        e.stopPropagation();
        startRename(row, i);
      });
      row.addEventListener('dragstart', (e) => {
        if (e.target.closest('.layer-name-input')) { e.preventDefault(); return; }
        state.dragIndex = i;
        row.classList.add('dragging');
        e.dataTransfer.effectAllowed = 'move';
        try { e.dataTransfer.setData('text/plain', String(i)); } catch { /* noop */ }
      });
      row.addEventListener('dragend', () => { row.classList.remove('dragging'); $$('.layer-row').forEach((r) => r.classList.remove('drop-target')); });
      row.addEventListener('dragover', (e) => { e.preventDefault(); row.classList.add('drop-target'); });
      row.addEventListener('dragleave', () => row.classList.remove('drop-target'));
      row.addEventListener('drop', (e) => {
        e.preventDefault();
        row.classList.remove('drop-target');
        const from = state.dragIndex;
        if (from == null || from === i) return;
        pushDocHistory();
        const moved = doc.layers.splice(from, 1)[0];
        doc.layers.splice(i, 0, moved);
        state.active = i;
        renderLayers(); render(); markDirty();
      });
      list.appendChild(row);
    }
    $('#layerCount').textContent = String(doc.layers.length);
    $('#statusLayer').textContent = `LỚP ${state.active + 1}/${doc.layers.length}`;
    syncLayerProps();
  }

  function selectLayer(i) {
    finishAdjust();
    state.active = clamp(i, 0, state.doc.layers.length - 1);
    renderLayers();
    syncAdjustUI();
  }

  function startRename(row, i) {
    const nameEl = row.querySelector('.layer-name');
    const input = document.createElement('input');
    input.className = 'layer-name-input';
    input.value = state.doc.layers[i].name;
    nameEl.replaceWith(input);
    input.focus();
    input.select();
    let settled = false;
    const done = (save) => {
      if (settled) return;
      settled = true;
      if (save) {
        pushDocHistory();
        state.doc.layers[i].name = input.value.trim() || 'Lớp';
        markDirty();
      }
      renderLayers();
    };
    input.addEventListener('blur', () => done(true));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      if (e.key === 'Escape') { e.preventDefault(); done(false); }
    });
    input.addEventListener('click', (e) => e.stopPropagation());
  }

  function syncLayerProps() {
    const l = activeLayer();
    if (!l) return;
    $('#layerBlend').value = l.blend;
    $('#layerOpacity').value = String(l.opacity);
    $('#layerOpacityVal').textContent = l.opacity + '%';
    setFill($('#layerOpacity'), l.opacity);
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
    low.ctx.save();
    low.ctx.globalAlpha = up.opacity / 100;
    low.ctx.globalCompositeOperation = up.blend || 'source-over';
    low.ctx.drawImage(up.canvas, 0, 0);
    low.ctx.restore();
    state.doc.layers.splice(state.active, 1);
    state.active -= 1;
    renderLayers(); render(); markDirty();
    toast('Đã gộp xuống “' + low.name + '”', 'ok', 2000);
  }

  function flattenLayers() {
    const { w, h } = state.doc;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    for (const l of state.doc.layers) {
      if (!l.visible || l.opacity <= 0) continue;
      g.globalAlpha = l.opacity / 100;
      g.globalCompositeOperation = l.blend || 'source-over';
      g.drawImage(l.canvas, 0, 0);
    }
    g.globalAlpha = 1;
    g.globalCompositeOperation = 'source-over';
    return c;
  }

  function mergeAll() {
    if (!state.doc) return;
    finishAdjust();
    pushDocHistory();
    const flat = flattenLayers();
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
    const ctx = c.getContext('2d');
    ctx.clearRect(0, 0, 76, 76);
    const s = Math.min(76 / state.doc.w, 76 / state.doc.h);
    ctx.drawImage(activeLayer().canvas, (76 - state.doc.w * s) / 2, (76 - state.doc.h * s) / 2, state.doc.w * s, state.doc.h * s);
  }

  /* ------------------------------------------------------------------ adjustments / filters */
  function adjustDefaults() {
    return { bright: 0, contrast: 0, saturate: 100, hue: 0, blur: 0, black: 0, white: 255, gamma: 100, gray: false, sepia: false, invert: false };
  }

  function syncAdjustUI() {
    const v = state.adjust ? state.adjust.vals : adjustDefaults();
    $('#adjBright').value = String(v.bright);
    $('#adjContrast').value = String(v.contrast);
    $('#adjSaturate').value = String(v.saturate);
    $('#adjHue').value = String(v.hue);
    $('#adjBlur').value = String(v.blur);
    $('#adjBlack').value = String(v.black);
    $('#adjWhite').value = String(v.white);
    $('#adjGamma').value = String(v.gamma);
    $('#adjBrightVal').textContent = String(v.bright);
    $('#adjContrastVal').textContent = String(v.contrast);
    $('#adjSaturateVal').textContent = String(v.saturate);
    $('#adjHueVal').textContent = String(v.hue);
    $('#adjBlurVal').textContent = String(v.blur);
    $('#adjBlackVal').textContent = String(v.black);
    $('#adjWhiteVal').textContent = String(v.white);
    $('#adjGammaVal').textContent = (v.gamma / 100).toFixed(2);
    setFill($('#adjBright'), (v.bright + 100) / 2);
    setFill($('#adjContrast'), (v.contrast + 100) / 2);
    setFill($('#adjSaturate'), v.saturate / 2);
    setFill($('#adjHue'), v.hue / 3.6);
    setFill($('#adjBlur'), (v.blur / 24) * 100);
    setFill($('#adjBlack'), (v.black / 254) * 100);
    setFill($('#adjWhite'), ((v.white - 1) / 254) * 100);
    setFill($('#adjGamma'), ((v.gamma - 10) / 290) * 100);
    const hint = $('#adjLevelsHint');
    if (hint) hint.textContent = `${v.black} · ${v.white} · ${(v.gamma / 100).toFixed(2)}`;
    $('#adjGray').checked = !!v.gray;
    $('#adjSepia').checked = !!v.sepia;
    $('#adjInvert').checked = !!v.invert;
    const scope = $('#adjustScope');
    if (scope) scope.textContent = state.sel.active ? 'trong vùng chọn' : 'toàn lớp';
  }

  function ensureAdjust() {
    const layer = activeLayer();
    if (!layer) { toast('Chọn một lớp trước đã', 'warn'); return null; }
    if (!state.adjust || state.adjust.id !== layer.id) {
      state.adjust = {
        id: layer.id,
        original: copyCanvas(layer.canvas),
        origSrc: layer.canvas.toDataURL('image/png'),
        vals: adjustDefaults(),
        pushed: false,
      };
      syncAdjustUI();
    }
    return state.adjust;
  }

  function adjustFilter(v) {
    const parts = [];
    if (v.bright) parts.push(`brightness(${100 + v.bright}%)`);
    if (v.contrast) parts.push(`contrast(${100 + v.contrast}%)`);
    if (v.saturate !== 100) parts.push(`saturate(${v.saturate}%)`);
    if (v.hue) parts.push(`hue-rotate(${v.hue}deg)`);
    if (v.blur) parts.push(`blur(${v.blur}px)`);
    if (v.gray) parts.push('grayscale(1)');
    if (v.sepia) parts.push('sepia(1)');
    if (v.invert) parts.push('invert(1)');
    return parts.length ? parts.join(' ') : 'none';
  }

  function paintClippedOver(layer, original, filtered) {
    const ctx = layer.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, state.doc.w, state.doc.h);
    ctx.drawImage(original, 0, 0);
    if (state.sel.active) {
      ctx.save();
      ctx.clip(selPath(), 'evenodd');
      ctx.drawImage(filtered, 0, 0);
      ctx.restore();
    } else {
      ctx.drawImage(filtered, 0, 0);
    }
  }

  function applyLevels(canvas, black, white, gamma) {
    if (black === 0 && white === 255 && Math.abs(gamma - 1) < 0.001) return canvas;
    const g = canvas.getContext('2d');
    const img = g.getImageData(0, 0, canvas.width, canvas.height);
    const d = img.data;
    const range = Math.max(1, white - black);
    const lut = new Uint8ClampedArray(256);
    for (let i = 0; i < 256; i++) {
      const n = clamp((i - black) / range, 0, 1);
      lut[i] = Math.round(255 * Math.pow(n, 1 / gamma));
    }
    for (let i = 0; i < d.length; i += 4) {
      if (!d[i + 3]) continue;
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
    g.putImageData(img, 0, 0);
    return canvas;
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

  function convolveCanvas(src, kernel, divisor = 1, offset = 0) {
    const w = src.width, h = src.height;
    const sctx = src.getContext('2d');
    const img = sctx.getImageData(0, 0, w, h);
    const out = sctx.createImageData(w, h);
    const sd = img.data, od = out.data;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        const i = (y * w + x) * 4;
        if (sd[i + 3] === 0) continue;
        let r = 0, g = 0, b = 0;
        for (let ky = -1; ky <= 1; ky++) {
          for (let kx = -1; kx <= 1; kx++) {
            const j = ((y + ky) * w + (x + kx)) * 4;
            const k = kernel[(ky + 1) * 3 + (kx + 1)];
            r += sd[j] * k;
            g += sd[j + 1] * k;
            b += sd[j + 2] * k;
          }
        }
        od[i] = clamp(r / divisor + offset, 0, 255);
        od[i + 1] = clamp(g / divisor + offset, 0, 255);
        od[i + 2] = clamp(b / divisor + offset, 0, 255);
        od[i + 3] = sd[i + 3];
      }
    }
    const c = makeCanvas(w, h);
    c.getContext('2d').putImageData(out, 0, 0);
    return c;
  }

  function filterCanvas(original, kind) {
    const { w, h } = state.doc;
    const c = makeCanvas(w, h);
    const g = c.getContext('2d');
    if (kind === 'blur') {
      g.filter = 'blur(4px)';
      g.drawImage(original, 0, 0);
      g.filter = 'none';
    } else if (kind === 'gray' || kind === 'sepia' || kind === 'invert') {
      g.filter = kind === 'gray' ? 'grayscale(1)' : kind === 'sepia' ? 'sepia(1)' : 'invert(1)';
      g.drawImage(original, 0, 0);
      g.filter = 'none';
    } else if (kind === 'sharpen') {
      g.drawImage(convolveCanvas(original, [0, -1, 0, -1, 5, -1, 0, -1, 0]), 0, 0);
    } else if (kind === 'emboss') {
      g.drawImage(convolveCanvas(original, [-2, -1, 0, -1, 1, 1, 0, 1, 2], 1, 128), 0, 0);
    } else if (kind === 'vignette') {
      g.drawImage(original, 0, 0);
      const cx = w / 2, cy = h / 2;
      const radius = Math.hypot(w, h) / 2;
      const grad = g.createRadialGradient(cx, cy, radius * 0.34, cx, cy, radius);
      grad.addColorStop(0, 'rgba(0,0,0,0)');
      grad.addColorStop(0.58, 'rgba(0,0,0,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0.74)');
      g.globalCompositeOperation = 'source-atop';
      g.fillStyle = grad;
      g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'source-over';
    } else if (kind === 'grain') {
      g.drawImage(original, 0, 0);
      const img = g.getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const luma = (d[i] + d[i + 1] + d[i + 2]) / 3;
        const amp = 0.65 + (1 - luma / 255) * 0.55;
        const n = (Math.random() - 0.5) * 58 * amp;
        d[i] = clamp(d[i] + n, 0, 255);
        d[i + 1] = clamp(d[i + 1] + n, 0, 255);
        d[i + 2] = clamp(d[i + 2] + n, 0, 255);
      }
      g.putImageData(img, 0, 0);
    } else if (kind === 'pixel') {
      const sw = Math.max(1, Math.round(w / 16));
      const sh = Math.max(1, Math.round(h / 16));
      const small = makeCanvas(sw, sh);
      small.getContext('2d').drawImage(original, 0, 0, sw, sh);
      g.imageSmoothingEnabled = false;
      g.drawImage(small, 0, 0, w, h);
      g.imageSmoothingEnabled = true;
    } else if (kind === 'noise') {
      const img = original.getContext('2d').getImageData(0, 0, w, h);
      const d = img.data;
      for (let i = 0; i < d.length; i += 4) {
        if (!d[i + 3]) continue;
        const n = (Math.random() - 0.5) * 54;
        d[i] = clamp(d[i] + n, 0, 255);
        d[i + 1] = clamp(d[i + 1] + n, 0, 255);
        d[i + 2] = clamp(d[i + 2] + n, 0, 255);
      }
      c.getContext('2d').putImageData(img, 0, 0);
    } else {
      g.drawImage(original, 0, 0);
    }
    return c;
  }

  function applyFilter(kind, done) {
    if (!state.doc) return;
    finishAdjust();
    const layer = activeLayer();
    if (!layer) return;
    pushLayerHistory();
    const original = copyCanvas(layer.canvas);
    const filtered = filterCanvas(original, kind);
    paintClippedOver(layer, original, filtered);
    render();
    updateLayerThumb();
    markDirty();
    toast(done || 'Đã áp dụng bộ lọc', 'ok', 1800);
  }

  /* ------------------------------------------------------------------ palette / color */
  function renderPalette() {
    const box = $('#swatches');
    box.innerHTML = CRAF_SWATCHES.map((hex) => `<button class="swatch" type="button" data-hex="${hex}" title="${hex}" style="background:${hex}"></button>`).join('');
    $$('.swatch', box).forEach((el) => el.addEventListener('click', () => setColor(el.dataset.hex)));
    markSwatches();
  }

  function markSwatches() {
    const cur = state.color.toUpperCase();
    $$('.swatch').forEach((el) => el.classList.toggle('active', (el.dataset.hex || '').toUpperCase() === cur));
  }

  function setBgColor(hex) {
    const clean = '#' + String(hex).replace('#', '').slice(0, 6).toUpperCase();
    state.bgColor = clean;
    const el = $('#bgSwatch');
    if (el) el.style.background = clean;
  }

  function swapColors() {
    const prev = state.bgColor;
    setBgColor(state.color);
    setColor(prev);
    toast('Đổi màu trước / sau', 'ok', 1200);
  }

  function resetColors() {
    setColor('#16130E');
    setBgColor('#FDFAF3');
  }

  function setColor(hex, fromPicker = false) {
    const clean = '#' + String(hex).replace('#', '').slice(0, 6).toUpperCase();
    state.color = clean;
    const { h, s, l } = hexToHsl(clean);
    if (!fromPicker) {
      $('#hue').value = String(Math.round(h));
      $('#sat').value = String(Math.round(s));
      $('#lig').value = String(Math.round(l));
      $('#hueVal').textContent = String(Math.round(h));
      $('#satVal').textContent = String(Math.round(s));
      $('#ligVal').textContent = String(Math.round(l));
      setFill($('#hue'), h / 3.6);
      setFill($('#sat'), s);
      setFill($('#lig'), l);
    }
    const rgb = hexToRgb(clean);
    const hsl = `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
    $('#hexInput').value = clean.slice(1);
    $('#bigSwatch').style.background = clean;
    $('#inkwellDot').style.background = clean;
    $('#sizeDot').style.background = clean;
    $('#sizePreview').style.background = rgbToHsl(rgb.r, rgb.g, rgb.b).l > 70 ? 'rgba(10,10,11,.06)' : 'var(--desk-2)';
    $('#sat').style.setProperty('--c-hue', hsl);
    $('#lig').style.setProperty('--c-hue', hsl);
    document.documentElement.style.setProperty('--c-hue', hsl);
    markSwatches();
  }

  function setFill(input, pct) {
    if (!input) return;
    input.style.setProperty('--fill', clamp(pct, 0, 100) + '%');
  }

  function hslFromUI() {
    const h = parseInt($('#hue').value, 10);
    const s = parseInt($('#sat').value, 10);
    const l = parseInt($('#lig').value, 10);
    $('#hueVal').textContent = h;
    $('#satVal').textContent = s;
    $('#ligVal').textContent = l;
    setFill($('#hue'), h / 3.6);
    setFill($('#sat'), s);
    setFill($('#lig'), l);
    setColor(hslToHex(h, s, l), true);
  }

  /* ------------------------------------------------------------------ history */
  function snapshotDoc() {
    return {
      kind: 'doc',
      w: state.doc.w, h: state.doc.h, bg: state.doc.bg,
      layers: state.doc.layers.map((l) => ({
        name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend,
        src: l.canvas.toDataURL('image/png'),
      })),
      active: state.active,
    };
  }

  function pushDocHistory() {
    if (!state.doc) return;
    state.undo.push(snapshotDoc());
    if (state.undo.length > 24) state.undo.shift();
    state.redo = [];
    syncHistoryButtons();
  }

  function pushLayerHistory() {
    const l = activeLayer();
    if (!l) return;
    state.undo.push({ kind: 'layer', id: l.id, src: l.canvas.toDataURL('image/png') });
    if (state.undo.length > 30) state.undo.shift();
    state.redo = [];
    syncHistoryButtons();
  }

  function pushLayerSnapshot(layer, src) {
    state.undo.push({ kind: 'layer', id: layer.id, src });
    if (state.undo.length > 30) state.undo.shift();
    state.redo = [];
    syncHistoryButtons();
  }

  function currentLayerSrc(id) {
    const l = state.doc.layers.find((x) => x.id === id);
    return l ? l.canvas.toDataURL('image/png') : null;
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
    $('#btnUndo').disabled = !state.undo.length;
    $('#btnRedo').disabled = !state.redo.length;
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
    const c = makeCanvas(w, h);
    const ctx = c.getContext('2d');
    if (!transparent) {
      ctx.fillStyle = state.doc.bg;
      ctx.fillRect(0, 0, w, h);
    }
    const sx = w / state.doc.w, sy = h / state.doc.h;
    for (const l of state.doc.layers) {
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

  function thumbData() {
    const w = Math.min(480, state.doc.w);
    const h = Math.round(w * state.doc.h / state.doc.w);
    return compositeCanvas(w, h).toDataURL('image/jpeg', 0.84);
  }

  async function saveNow() {
    clearTimeout(state.saveTimer);
    if (!state.doc || state.saving) return;
    state.saving = true;
    setSaveState('saving');
    const doc = state.doc;
    const payload = {
      id: doc.id, name: doc.name, w: doc.w, h: doc.h, bg: doc.bg,
      createdAt: doc.createdAt,
      layers: doc.layers.map((l) => ({
        name: l.name, visible: l.visible, opacity: l.opacity, blend: l.blend,
        src: l.canvas.toDataURL('image/png'),
      })),
      thumb: thumbData(),
    };
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
      const png = compositeCanvas(state.doc.w, state.doc.h).toDataURL('image/png');
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
    layer.ctx.save();
    if (state.sel.active) {
      layer.ctx.globalCompositeOperation = 'destination-out';
      layer.ctx.fillStyle = '#000';
      layer.ctx.fill(selPath(), 'evenodd');
    } else {
      layer.ctx.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
    }
    layer.ctx.restore();
    render(); updateLayerThumb(); markDirty();
  }

  function fillSelected() {
    if (!state.doc) return;
    finishAdjust();
    const layer = activeLayer();
    if (!layer) return;
    pushLayerHistory();
    layer.ctx.save();
    if (state.sel.active) layer.ctx.clip(selPath(), 'evenodd');
    layer.ctx.globalAlpha = state.opacity;
    layer.ctx.fillStyle = state.color;
    layer.ctx.fillRect(0, 0, state.doc.w, state.doc.h);
    layer.ctx.restore();
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
    const ctx = layer.ctx;
    ctx.save();
    let lineWidth = width;
    if (align === 'inside') {
      ctx.clip(selPath(), 'evenodd');
      lineWidth = width * 2;
    } else if (align === 'outside') {
      const outside = new Path2D();
      outside.rect(0, 0, state.doc.w, state.doc.h);
      outside.addPath(selPath());
      ctx.clip(outside, 'evenodd');
      lineWidth = width * 2;
    }
    ctx.lineWidth = lineWidth;
    ctx.strokeStyle = color;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.stroke(selPath());
    ctx.restore();
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
    const r = board.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * state.doc.w / r.width,
      y: (e.clientY - r.top) * state.doc.h / r.height,
      pressure: e.pointerType === 'pen' ? clamp(e.pressure || 0.5, 0.08, 1) : 0.5,
    };
  }

  function brushWidth(p) {
    const base = state.size;
    if (p == null) return base;
    return Math.max(0.6, base * (0.58 + 0.84 * p));
  }

  function stampBrush(ctx, x, y, r, color, hardness, erase) {
    const rgb = hexToRgb(color);
    const solid = `rgba(${rgb.r},${rgb.g},${rgb.b},1)`;
    const clear = `rgba(${rgb.r},${rgb.g},${rgb.b},0)`;
    const inner = clamp(hardness, 0, 0.97);
    const grad = ctx.createRadialGradient(x, y, Math.max(0.01, r * inner), x, y, Math.max(0.02, r));
    grad.addColorStop(0, solid);
    grad.addColorStop(inner, solid);
    grad.addColorStop(1, clear);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  function paintSegment(ctx, a, b, c, color, width, erase) {
    const r = Math.max(0.5, width / 2);
    ctx.save();
    ctx.globalCompositeOperation = erase ? 'destination-out' : 'source-over';
    ctx.globalAlpha = erase ? 1 : state.opacity;
    if (state.hardness >= 0.82) {
      ctx.strokeStyle = color;
      ctx.lineWidth = width;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      if (c) ctx.quadraticCurveTo(b.x, b.y, c.x, c.y);
      else ctx.lineTo(b.x, b.y);
      ctx.stroke();
      ctx.restore();
      return;
    }
    const at = (t) => c
      ? {
        x: (1 - t) * (1 - t) * a.x + 2 * (1 - t) * t * b.x + t * t * c.x,
        y: (1 - t) * (1 - t) * a.y + 2 * (1 - t) * t * b.y + t * t * c.y,
      }
      : { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
    let len = 0;
    let prev = at(0);
    for (let i = 1; i <= 10; i++) {
      const p = at(i / 10);
      len += Math.hypot(p.x - prev.x, p.y - prev.y);
      prev = p;
    }
    const step = Math.max(0.7, r * 0.3);
    const n = Math.max(1, Math.ceil(len / step));
    for (let i = 0; i <= n; i++) {
      const p = at(i / n);
      stampBrush(ctx, p.x, p.y, r, color, state.hardness, erase);
    }
    ctx.restore();
  }

  function beginDraw(e) {
    const pt = toDoc(e);
    const tool = state.tool;
    if (tool === 'pick') { pickColor(e); return; }
    if (tool === 'wand') { wandSelect(e); return; }
    if (tool === 'move') { beginMove(e); return; }
    if (tool === 'gradient') { beginGradient(e); return; }
    if (tool === 'marquee' || tool === 'lasso') { beginMarquee(e, tool); return; }
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
      const ctx = layer.ctx;
      ctx.save();
      ctx.globalCompositeOperation = tool === 'eraser' ? 'destination-out' : 'source-over';
      const w = brushWidth(pt.pressure);
      ctx.globalAlpha = tool === 'eraser' ? 1 : state.opacity;
      stampBrush(ctx, pt.x, pt.y, Math.max(0.5, w / 2), state.color, state.hardness, tool === 'eraser');
      ctx.restore();
      state.draw = { kind: 'paint', layer, last: pt, mid: pt, erase: tool === 'eraser', clipped };
    } else {
      state.draw = { kind: 'shape', layer, start: pt, current: pt, shift: e.shiftKey, alt: e.altKey, clipped };
    }
    try { overlay.setPointerCapture(e.pointerId); } catch { /* synthetic or touch cancel */ }
    renderSoon();
  }

  function moveDraw(e) {
    const d = state.draw;
    if (!d) return;
    const pt = toDoc(e);
    if (d.kind === 'paint') {
      const mid = { x: (d.last.x + pt.x) / 2, y: (d.last.y + pt.y) / 2 };
      const w = brushWidth(pt.pressure);
      paintSegment(d.layer.ctx, d.mid, d.last, mid, state.color, w, d.erase);
      d.mid = mid;
      d.last = pt;
      renderSoon();
    } else if (d.kind === 'shape') {
      d.current = pt;
      d.shift = e.shiftKey;
      d.alt = e.altKey;
      previewShape(d);
    } else if (d.kind === 'marquee') {
      d.current = pt;
      d.shift = e.shiftKey && !d.add;
      if (d.points) d.points.push(pt);
      if (Math.hypot(pt.x - d.start.x, pt.y - d.start.y) > 3) d.moved = true;
      syncMarqueePreview(d);
    } else if (d.kind === 'move') {
      dragMove(d, e, pt);
    } else if (d.kind === 'gradient') {
      d.current = pt;
      d.reverse = e.shiftKey;
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
      paintSegment(d.layer.ctx, d.mid, d.last, null, state.color, brushWidth(0.5), d.erase);
    } else if (d.kind === 'shape') {
      commitShape(d);
      clearOverlay();
    } else if (d.kind === 'marquee') {
      finishMarquee(d);
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

  function syncMarqueePreview(d) {
    if (d.tool === 'lasso') {
      state.selPreview = { type: 'poly', points: d.points };
    } else {
      state.selPreview = { type: 'rect', start: d.start, current: d.current, shift: d.shift, alt: false };
    }
    requestAnts();
  }

  function beginMarquee(e, tool) {
    const pt = toDoc(e);
    const d = {
      kind: 'marquee', tool, start: pt, current: pt,
      points: tool === 'lasso' ? [pt] : null,
      add: e.shiftKey, subtract: e.altKey, shift: false, moved: false,
    };
    state.draw = d;
    try { overlay.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    syncMarqueePreview(d);
  }

  function finishMarquee(d) {
    state.selPreview = null;
    if (!d.moved) {
      if (!d.add && !d.subtract) clearSelection();
      requestAnts();
      return;
    }
    let mask;
    if (d.tool === 'lasso') {
      if (d.points.length < 3) { requestAnts(); return; }
      mask = maskFromPolygon(d.points);
    } else {
      const g = previewGeometry(d);
      if (g.w < 1 || g.h < 1) { requestAnts(); return; }
      mask = maskFromRect(g.x, g.y, g.w, g.h);
    }
    const mode = d.subtract ? 'subtract' : d.add ? 'add' : 'replace';
    setSelection(mask, mode);
  }

  function wandSelect(e) {
    if (!state.doc) return;
    const pt = toDoc(e);
    const mode = e.altKey ? 'subtract' : e.shiftKey ? 'add' : 'replace';
    const mask = maskFromWand(pt.x, pt.y, state.wandTol);
    setSelection(mask, mode);
    if (state.sel.active) toast('Đã chọn vùng màu · ' + fmt(state.sel.bbox.w) + ' × ' + fmt(state.sel.bbox.h), 'ok', 1600);
    else toast('Không tìm thấy vùng màu', 'warn', 1800);
  }

  function beginMove(e) {
    const layer = activeLayer();
    if (!layer) return;
    const pt = toDoc(e);
    const useSel = state.sel.active && pointInSelection(pt.x, pt.y);
    let picked = null;
    if (useSel) {
      picked = copyCanvas(layer.canvas);
      const pg = picked.getContext('2d');
      pg.globalCompositeOperation = 'destination-in';
      const mk = maskToCanvas(state.sel.data, state.doc.w, state.doc.h, state.sel.bbox).canvas;
      pg.drawImage(mk, state.sel.bbox.x, state.sel.bbox.y);
      pg.globalCompositeOperation = 'source-over';
    }
    state.draw = {
      kind: 'move', layer, src: copyCanvas(layer.canvas), sel: picked, start: pt,
      dx: 0, dy: 0, moved: false, pushed: false, useSel,
    };
    try { overlay.setPointerCapture(e.pointerId); } catch { /* ignore */ }
  }

  function dragMove(d, e, pt) {
    let dx = pt.x - d.start.x;
    let dy = pt.y - d.start.y;
    if (e.shiftKey) {
      if (Math.abs(dx) > Math.abs(dy)) dy = 0; else dx = 0;
    }
    if (Math.hypot(dx, dy) < 0.5) return;
    if (!d.pushed) { pushDocHistory(); d.pushed = true; }
    d.moved = true;
    d.dx = dx; d.dy = dy;
    const ctx = d.layer.ctx;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, state.doc.w, state.doc.h);
    if (d.useSel && d.sel) {
      ctx.drawImage(d.src, 0, 0);
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.fillStyle = '#000';
      ctx.fill(selPath(), 'evenodd');
      ctx.restore();
      ctx.drawImage(d.sel, dx, dy);
    } else {
      ctx.drawImage(d.src, dx, dy);
    }
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
    state.draw = { kind: 'gradient', layer, start: pt, current: pt, reverse: e.shiftKey };
    try { overlay.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    previewGradient(state.draw);
  }

  function gradientPaint(ctx, d) {
    const { w, h } = state.doc;
    const dx = d.current.x - d.start.x;
    const dy = d.current.y - d.start.y;
    const dist = Math.hypot(dx, dy);
    if (dist < 0.5) return;
    const c1 = d.reverse ? state.bgColor : state.color;
    const c2 = d.reverse ? state.color : state.bgColor;
    let grad;
    if (state.gradType === 'radial') {
      grad = ctx.createRadialGradient(d.start.x, d.start.y, 0, d.start.x, d.start.y, dist);
    } else {
      grad = ctx.createLinearGradient(d.start.x, d.start.y, d.current.x, d.current.y);
    }
    grad.addColorStop(0, c1);
    grad.addColorStop(1, c2);
    ctx.save();
    ctx.globalAlpha = state.opacity;
    if (state.sel.active) ctx.clip(selPath(), 'evenodd');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
    ctx.restore();
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
    const dist = Math.hypot(d.current.x - d.start.x, d.current.y - d.start.y);
    clearOverlay();
    if (dist < 2) return;
    pushLayerHistory();
    gradientPaint(d.layer.ctx, d);
    render();
    updateLayerThumb();
    markDirty();
  }

  function shapeGeometry(d) {
    let { x: x0, y: y0 } = d.start;
    let { x: x1, y: y1 } = d.current;
    if (d.shift) {
      if (state.tool === 'line') {
        const dx = x1 - x0, dy = y1 - y0;
        const ang = Math.atan2(dy, dx);
        const snap = Math.round(ang / (Math.PI / 4)) * (Math.PI / 4);
        const len = Math.hypot(dx, dy);
        x1 = x0 + Math.cos(snap) * len;
        y1 = y0 + Math.sin(snap) * len;
      } else {
        const side = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
        x1 = x0 + Math.sign(x1 - x0 || 1) * side;
        y1 = y0 + Math.sign(y1 - y0 || 1) * side;
      }
    }
    if (d.alt) {
      x0 = d.start.x - (x1 - d.start.x);
      y0 = d.start.y - (y1 - d.start.y);
    }
    return { x0, y0, x1, y1 };
  }

  function shapePath(ctx, tool, g) {
    ctx.beginPath();
    if (tool === 'line') {
      ctx.moveTo(g.x0, g.y0);
      ctx.lineTo(g.x1, g.y1);
    } else if (tool === 'rect') {
      ctx.rect(Math.min(g.x0, g.x1), Math.min(g.y0, g.y1), Math.abs(g.x1 - g.x0), Math.abs(g.y1 - g.y0));
    } else {
      const cx = (g.x0 + g.x1) / 2, cy = (g.y0 + g.y1) / 2;
      ctx.ellipse(cx, cy, Math.abs(g.x1 - g.x0) / 2, Math.abs(g.y1 - g.y0) / 2, 0, 0, Math.PI * 2);
    }
  }

  function paintShape(ctx, d) {
    const g = shapeGeometry(d);
    ctx.save();
    ctx.strokeStyle = state.color;
    ctx.fillStyle = state.color;
    ctx.lineWidth = state.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.globalAlpha = state.opacity;
    shapePath(ctx, state.tool, g);
    if (state.shapeFill && state.tool !== 'line') ctx.fill();
    else ctx.stroke();
    ctx.restore();
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
    const { w, h } = state.doc;
    const x = Math.floor(pt.x), y = Math.floor(pt.y);
    if (x < 0 || y < 0 || x >= w || y >= h) return;
    const img = layer.ctx.getImageData(0, 0, w, h);
    const data = new Uint32Array(img.data.buffer);
    const idx = y * w + x;
    const target = data[idx];
    const c = hexToRgb(state.color);
    const fill = (255 << 24) | (c.b << 16) | (c.g << 8) | c.r;
    if (target === fill) return;
    const tol = 44;
    const tr = target & 255, tg = (target >>> 8) & 255, tb = (target >>> 16) & 255, ta = (target >>> 24) & 255;
    let selData = null;
    if (state.sel.active) selData = state.sel.data;
    const allowed = (p) => !selData || selData[p] > 127;
    if (!allowed(idx)) return;
    const near = (v) => {
      const a = (v >>> 24) & 255;
      if (Math.abs(a - ta) > tol) return false;
      if (ta === 0) return true;
      return Math.abs((v & 255) - tr) <= tol && Math.abs(((v >>> 8) & 255) - tg) <= tol && Math.abs(((v >>> 16) & 255) - tb) <= tol;
    };
    const stack = new Int32Array(w * h);
    let sp = 0;
    stack[sp++] = idx;
    data[idx] = fill;
    while (sp) {
      const p = stack[--sp];
      const px = p % w;
      if (px > 0 && allowed(p - 1) && near(data[p - 1])) { data[p - 1] = fill; stack[sp++] = p - 1; }
      if (px < w - 1 && allowed(p + 1) && near(data[p + 1])) { data[p + 1] = fill; stack[sp++] = p + 1; }
      if (p >= w && allowed(p - w) && near(data[p - w])) { data[p - w] = fill; stack[sp++] = p - w; }
      if (p < (h - 1) * w && allowed(p + w) && near(data[p + w])) { data[p + w] = fill; stack[sp++] = p + w; }
    }
    layer.ctx.putImageData(img, 0, 0);
  }

  function pickColor(e) {
    const r = paper.getBoundingClientRect();
    const x = Math.floor((e.clientX - r.left) * paper.width / r.width);
    const y = Math.floor((e.clientY - r.top) * paper.height / r.height);
    const data = paper.getContext('2d').getImageData(clamp(x, 0, paper.width - 1), clamp(y, 0, paper.height - 1), 1, 1).data;
    setColor(rgbToHex(data[0], data[1], data[2]));
    setTool('brush');
    toast('Đã lấy màu ' + state.color, 'ok', 1600);
  }

  /* text */
  const FONTS = {
    serif: '"Fraunces", Georgia, serif',
    sans: '"Segoe UI Variable Text", "Segoe UI", sans-serif',
    mono: '"Geist Mono", Consolas, monospace',
  };

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
        const size = state.textSize;
        layer.ctx.save();
        if (state.sel.active) layer.ctx.clip(selPath(), 'evenodd');
        layer.ctx.fillStyle = state.color;
        layer.ctx.font = `500 ${size}px ${FONTS[state.font]}`;
        layer.ctx.textBaseline = 'top';
        layer.ctx.globalAlpha = state.opacity;
        text.split('\n').forEach((line, i) => layer.ctx.fillText(line, state.textAt.x, state.textAt.y + i * size * 1.06));
        layer.ctx.restore();
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
  function startPan(e) {
    state.panning = { x: e.clientX, y: e.clientY, vx: state.view.x, vy: state.view.y };
    state.fitMode = false;
    try { overlay.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    $('#stage').style.cursor = 'grabbing';
  }

  overlay.addEventListener('pointerdown', (e) => {
    if (!state.doc) return;
    if (e.button === 1 || state.space || state.tool === 'hand') { e.preventDefault(); startPan(e); return; }
    if (e.button !== 0) return;
    e.preventDefault();
    beginDraw(e);
  });

  overlay.addEventListener('pointermove', (e) => {
    if (!state.doc) return;
    if (state.panning) {
      state.view.x = state.panning.vx + (e.clientX - state.panning.x);
      state.view.y = state.panning.vy + (e.clientY - state.panning.y);
      applyView();
      return;
    }
    const pt = toDoc(e);
    $('#cursorPos').textContent = 'X ' + fmt(pt.x) + '  Y ' + fmt(pt.y);
    moveRing(e);
    if (state.draw) moveDraw(e);
  });

  overlay.addEventListener('pointerup', (e) => {
    if (state.panning) {
      state.panning = null;
      $('#stage').style.cursor = '';
      return;
    }
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

  overlay.addEventListener('pointerleave', () => { $('#brushRing').hidden = true; $('#cursorPos').textContent = 'X —  Y —'; });
  overlay.addEventListener('pointerenter', () => { if (state.tool === 'brush' || state.tool === 'eraser') $('#brushRing').hidden = false; });

  function moveRing(e) {
    const ring = $('#brushRing');
    if (state.tool !== 'brush' && state.tool !== 'eraser') { ring.hidden = true; return; }
    const r = area.getBoundingClientRect();
    const sizePx = Math.max(4, state.size * state.view.zoom);
    ring.hidden = false;
    ring.style.width = sizePx + 'px';
    ring.style.height = sizePx + 'px';
    ring.style.left = (e.clientX - r.left) + 'px';
    ring.style.top = (e.clientY - r.top) + 'px';
  }

  area.addEventListener('wheel', (e) => {
    if (!state.doc) return;
    e.preventDefault();
    const factor = Math.exp(-e.deltaY * 0.0016);
    setZoom(state.view.zoom * factor, e.clientX, e.clientY);
  }, { passive: false });

  /* ------------------------------------------------------------------ tools / UI sync */
  function setTool(tool) {
    state.tool = tool;
    updateToolUI();
    if (tool !== 'brush' && tool !== 'eraser') $('#brushRing').hidden = true;
  }

  function updateToolUI() {
    $$('.tool[data-tool]').forEach((el) => el.classList.toggle('active', el.dataset.tool === state.tool));
    const showFill = ['rect', 'ellipse'].includes(state.tool);
    $('#shapeFillBlock').hidden = !showFill;
    $('#textBlock').hidden = state.tool !== 'text';
    $('#wandBlock').hidden = state.tool !== 'wand';
    $('#gradBlock').hidden = state.tool !== 'gradient';
    $('#hardnessBlock').hidden = !['brush', 'eraser'].includes(state.tool);
    const cursors = {
      hand: 'grab', move: 'move', brush: 'none', eraser: 'none',
      marquee: 'crosshair', lasso: 'crosshair', wand: 'crosshair', gradient: 'crosshair',
    };
    overlay.style.cursor = cursors[state.tool] || 'crosshair';
    const hints = {
      brush: 'VẼ TỰ DO · [ ] ĐỔI CỠ CỌ · SPACE KÉO BÀN',
      eraser: 'TẨY · [ ] ĐỔI CỠ TẨY',
      line: 'KÉO ĐỂ VẼ ĐƯỜNG · SHIFT KHOÁ 45°',
      rect: 'KÉO ĐỂ VẼ CHỮ NHẬT · SHIFT = VUÔNG · ALT = TỪ TÂM',
      ellipse: 'KÉO ĐỂ VẼ ELLIPSE · SHIFT = TRÒN · ALT = TỪ TÂM',
      fill: 'BẤM VÀO MỘT VÙNG ĐỂ ĐỔ MÀU',
      gradient: 'KÉO ĐỂ CHUYỂN MÀU TRƯỚC → SAU · SHIFT ĐẢO CHIỀU',
      pick: 'BẤM ĐỂ HÚT MÀU TỪ BÀN VẼ',
      text: 'BẤM ĐỂ ĐẶT CHỮ · ENTER ĐỂ XONG',
      hand: 'KÉO ĐỂ DI CHUYỂN BÀN VẼ · LĂN CHUỘT ĐỂ ZOOM',
      move: 'KÉO ĐỂ DI CHUYỂN LỚP HOẶC VÙNG CHỌN · SHIFT KHOÁ TRỤC',
      marquee: 'KÉO VÙNG CHỌN · SHIFT THÊM · ALT BỚT · BẤM SUÔNG ĐỂ BỎ CHỌN',
      lasso: 'VẼ VÒNG TỰ DO · SHIFT THÊM · ALT BỚT',
      wand: 'BẤM ĐỂ CHỌN MẢNG MÀU TƯƠNG TỰ · SHIFT THÊM · ALT BỚT',
    };
    $('#stageHint').textContent = hints[state.tool] || '';
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
      const old = l.canvas;
      replaceLayerImage(l, b.w, b.h);
      l.ctx.drawImage(old, -b.x, -b.y);
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
