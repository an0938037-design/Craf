/**
 * Bàn phím toàn cục (P5-6).
 *
 * `shell` là composition root nên được quyền gọi mọi section, nhưng ở giai đoạn
 * chuyển tiếp `app.js` vẫn giữ các hàm điều phối. Vì vậy keymap nhận **deps**
 * đã tiêm và chỉ lo việc ánh xạ phím → hành vi, không tự quyết định nghiệp vụ.
 *
 * Thứ tự uỷ quyền giữ nguyên bản cũ:
 * Escape đóng lớp phủ trên cùng → chặn khi modal mở → chặn khi đang gõ →
 * shortcut có modifier → phím đơn → phím công cụ.
 */
import { $ } from '../platform/index.js';
import { clamp } from '../shared/index.js';

/**
 * @param {{
 *   getState: () => object,
 *   closeMenus: () => void,
 *   closeHelp: () => void,
 *   closeDrawer: () => void,
 *   closeIns: () => void,
 *   closeSizeModal: () => void,
 *   closeTransformModal: () => void,
 *   closeStrokeModal: () => void,
 *   clearSelection: () => void,
 *   requestAnts: () => void,
 *   addLayer: () => void,
 *   openSizeModal: (mode:string) => void,
 *   selectAll: () => void,
 *   copySelection: (cut:boolean) => void,
 *   pasteClipboard: () => void,
 *   duplicateLayer: () => void,
 *   openTransformModal: () => void,
 *   mergeAll: () => void,
 *   mergeDown: () => void,
 *   invertSelection: () => void,
 *   applyFilter: (kind:string, done?:string) => void,
 *   undo: () => void,
 *   redo: () => void,
 *   saveNow: () => void,
 *   openExport: () => void,
 *   fillSelected: () => void,
 *   clearSelectedContent: () => void,
 *   syncSizeUI: () => void,
 *   fit: () => void,
 *   setZoom: (z:number) => void,
 *   openHelp: () => void,
 *   swapColors: () => void,
 *   resetColors: () => void,
 *   setTool: (tool:string) => void,
 * }} d
 * @returns {(e:KeyboardEvent) => void}
 */
export function createKeyHandler(d) {
  const state = () => d.getState();

  return function onKey(e) {
    const typing = e.target && /^(INPUT|TEXTAREA|SELECT)$/.test(e.target.tagName);
    const mod = e.ctrlKey || e.metaKey;
    const k = e.key.toLowerCase();
    if (e.key === 'Escape') {
      if ($('.menu.open')) { d.closeMenus(); return; }
      if (!$('#helpModal').hidden) { d.closeHelp(); return; }
      if (!$('#sizeModal').hidden) { d.closeSizeModal(); return; }
      if (!$('#transformModal').hidden) { d.closeTransformModal(); return; }
      if (!$('#strokeModal').hidden) { d.closeStrokeModal(); return; }
      if (!$('#exportModal').hidden) { $('#exportModal').hidden = true; return; }
      if (!$('#nottDrawer').hidden) { d.closeDrawer(); return; }
      if (document.body.classList.contains('ins-open')) { d.closeIns(); return; }
      if (state().selPreview) { state().selPreview = null; state().draw = null; d.requestAnts(); return; }
      if (state().sel.active) { d.clearSelection(); return; }
    }
    if (!$('#helpModal').hidden || !$('#sizeModal').hidden || !$('#transformModal').hidden || !$('#strokeModal').hidden || !$('#exportModal').hidden) return;
    if (typing) return;
    if (mod && e.shiftKey && k === 'n') { e.preventDefault(); d.addLayer(); return; }
    if (mod && k === 'n') { e.preventDefault(); d.openSizeModal('new'); return; }
    if (mod && k === 'a') { e.preventDefault(); d.selectAll(); return; }
    if (mod && k === 'd') { e.preventDefault(); d.clearSelection(); return; }
    if (mod && k === 'c') { e.preventDefault(); d.copySelection(false); return; }
    if (mod && k === 'x') { e.preventDefault(); d.copySelection(true); return; }
    if (mod && k === 'v') { if (state().clipboard) { e.preventDefault(); d.pasteClipboard(); } return; }
    if (mod && k === 'j') { e.preventDefault(); d.duplicateLayer(); return; }
    if (mod && k === 't') { e.preventDefault(); d.openTransformModal(); return; }
    if (mod && e.shiftKey && k === 'm') { e.preventDefault(); d.mergeAll(); return; }
    if (mod && k === 'm') { e.preventDefault(); d.mergeDown(); return; }
    if (mod && e.shiftKey && k === 'i') { e.preventDefault(); d.invertSelection(); return; }
    if (mod && k === 'i') { e.preventDefault(); d.applyFilter('invert', 'Đã đảo màu lớp'); return; }
    if (mod && k === 'z') { e.preventDefault(); if (e.shiftKey) d.redo(); else d.undo(); return; }
    if (mod && k === 'y') { e.preventDefault(); d.redo(); return; }
    if (mod && k === 's') { e.preventDefault(); d.saveNow(); return; }
    if (mod && k === 'e') { e.preventDefault(); d.openExport(); return; }
    if (mod && k === 'g') { e.preventDefault(); $('#btnGrid').click(); return; }
    if (e.altKey && e.key === 'Backspace') { e.preventDefault(); d.fillSelected(); return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); d.clearSelectedContent(); return; }
    if (e.code === 'Space') {
      e.preventDefault();
      state().space = true;
      if (state().doc) $('#overlay').style.cursor = 'grab';
      return;
    }
    if (e.key === '[') { state().size = clamp(state().size - (state().size > 30 ? 6 : 2), 1, 180); d.syncSizeUI(); return; }
    if (e.key === ']') { state().size = clamp(state().size + (state().size > 30 ? 6 : 2), 1, 180); d.syncSizeUI(); return; }
    if (e.key === '0') { d.fit(); return; }
    if (e.key === '1') { d.setZoom(1); return; }
    if (e.key === '?') { d.openHelp(); return; }
    if (!state().doc) return;
    if (k === 'x') { d.swapColors(); return; }
    if (k === 'd') { d.resetColors(); return; }
    const map = {
      b: 'brush', e: 'eraser', l: 'line', r: 'rect', o: 'ellipse', g: 'fill',
      i: 'pick', t: 'text', h: 'hand', v: 'move', m: 'marquee', q: 'lasso', w: 'wand', u: 'gradient',
    };
    if (map[k]) d.setTool(map[k]);
  };
}

/**
 * Gắn keydown + keyup (Space nhả tay) vào `document`.
 * @param {Parameters<typeof createKeyHandler>[0]} d
 * @returns {(e:KeyboardEvent) => void} handler đã gắn (tiện cho test)
 */
export function bindKeymap(d) {
  const onKey = createKeyHandler(d);
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', (e) => {
    if (e.code === 'Space') {
      const s = d.getState();
      s.space = false;
      $('#stage').style.cursor = '';
      const overlay = $('#overlay');
      if (overlay.style.cursor === 'grab') overlay.style.cursor = s.tool === 'brush' ? 'none' : 'crosshair';
    }
  });
  return onKey;
}
