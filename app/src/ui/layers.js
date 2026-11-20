/**
 * Panel lớp: danh sách, thumbnail, ẩn/hiện, đổi tên, kéo sắp xếp (P5-3).
 *
 * Section `ui` chỉ **đọc** doc; mọi thay đổi đi qua `actions` do `shell` tiêm
 * (`toggleVisible`, `rename`, `reorder`, `select`, …). Nhờ vậy panel không tự
 * push history hay mutate layer.
 */
import { $, $$ } from '../platform/index.js';
import { esc } from '../shared/index.js';
import { activeLayer, state } from '../model/index.js';
import { setFill } from './inspector.js';

let actions = {
  select: () => {},
  selectContent: () => {},
  toggleVisible: () => {},
  rename: () => {},
  reorder: () => {},
  paintThumb: () => {},
};

/**
 * @param {{
 *   select?: (i:number) => void,
 *   selectContent?: () => void,
 *   toggleVisible?: (i:number) => void,
 *   rename?: (i:number, name:string) => void,
 *   reorder?: (from:number, to:number) => void,
 *   paintThumb?: (ctx:CanvasRenderingContext2D, layer:object, doc:object, size:number) => void
 * }} a
 */
export function configure(a = {}) {
  actions = { ...actions, ...a };
}

export function renderLayers() {
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
    actions.paintThumb(row.querySelector('canvas').getContext('2d'), l, doc, 80);
    row.addEventListener('click', (e) => {
      if (e.target.closest('.layer-eye') || e.target.closest('.layer-name-input')) return;
      actions.select(i);
      if (e.ctrlKey || e.metaKey) actions.selectContent();
    });
    row.querySelector('.layer-eye').addEventListener('click', (e) => {
      e.stopPropagation();
      actions.toggleVisible(i);
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
      actions.reorder(from, i);
    });
    list.appendChild(row);
  }
  $('#layerCount').textContent = String(doc.layers.length);
  $('#statusLayer').textContent = `LỚP ${state.active + 1}/${doc.layers.length}`;
  syncLayerProps();
}

export function startRename(row, i) {
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
    if (save) actions.rename(i, input.value.trim() || 'Lớp');
    renderLayers();
  };
  input.addEventListener('blur', () => done(true));
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
    if (e.key === 'Escape') { e.preventDefault(); done(false); }
  });
  input.addEventListener('click', (e) => e.stopPropagation());
}

export function syncLayerProps() {
  const l = activeLayer();
  if (!l) return;
  $('#layerBlend').value = l.blend;
  $('#layerOpacity').value = String(l.opacity);
  $('#layerOpacityVal').textContent = l.opacity + '%';
  setFill($('#layerOpacity'), l.opacity);
}
