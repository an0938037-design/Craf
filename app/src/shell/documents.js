/**
 * `shell/documents.js` — lifecycle doc: tạo/mở project, mở bản vẽ đã lưu, đổi khổ
 * giấy (applySizeModal), seed mẫu, preview thẻ mẫu. Tách từ `shell/boot.js` (P5-9).
 *
 * Hàm boot-local của `boot.js` dùng ở đây được tiêm 1 lần qua
 * `configureDocuments({...})` trong `boot()` trước khi gọi: `syncSelView`,
 * `clearSelection`, `updateToolUI`, `syncHistoryButtons`, `finishAdjust`,
 * `closeTextEditor`.
 */
import { $, loadImage } from '../platform/index.js';
import { clamp } from '../shared/index.js';
import { activate, clearHistory, docFromJSON, layerFromJSON, newDocData, state, uniqueProjectName } from '../model/index.js';
import { createLayer as newLayer } from '../pixel/index.js';
import { applyView, clearOverlay, fit } from '../render/index.js';
import { closeDrawer, closeSizeModal, renderLayers, renderPalette, sizeState, syncAdjustUI, toast } from '../ui/index.js';
import { api, flushSave, markDirty, refresh, saveNow, setSaveState } from './storage.js';
import { resizeImage, resizeCanvas } from './geometry.js';

/* ------------------------------------------------------------------ deps */
let deps = { syncSelView: () => {}, clearSelection: () => {}, updateToolUI: () => {}, syncHistoryButtons: () => {}, finishAdjust: () => {}, closeTextEditor: () => {} };
export function configureDocuments(d) { Object.assign(deps, d); }

/* Mỗi lần đổi tài liệu tăng số này; `openProject` đang nạp dở thấy số đổi thì
   dừng, để bản mới tạo / bản mở sau không bị bản nạp chậm ghi đè. */
let openSeq = 0;

/* ------------------------------------------------------------------ start screen */
/* Màn hình bắt đầu đã sang `ui/start.js`; ở đây chỉ tiêm hành động. */

/** Dựng doc xem trước cho thẻ mẫu (không đụng doc thật). */
export function previewDoc(key) {
  const doc = { w: 1080, h: 1350, bg: '#FDFAF3', layers: [] };
  if (key === 'poster') { seedPoster(doc); }
  else if (key === 'monogram') { doc.w = 800; doc.h = 800; seedMonogram(doc); }
  else { doc.w = 1080; doc.h = 1920; seedBands(doc); }
  return doc;
}

/* ------------------------------------------------------------------ doc lifecycle */
export function createProject(name, w, h, seed) {
  const doc = {
    ...newDocData(uniqueProjectName(state.projects, name), w, h),
    layers: [newLayer(w, h, 'Lớp 1')],
  };
  if (seed) seed(doc);
  openDoc(doc);
  markDirty();
}

export function openDoc(doc) {
  /* Tài liệu mới thay thế mọi lần nạp project đang dở. */
  openSeq++;
  /* Ô nhập chữ đang mở thuộc tài liệu cũ: đóng trước khi thay doc để Enter
     sau đó không ghi chữ vào tài liệu mới. */
  deps.closeTextEditor();
  activate(doc); /* activate() đã xoá undo/redo và state.adjust của tài liệu cũ. */
  /* Đồng bộ nút vì stack vừa bị xoá nhưng DOM còn trạng thái của bản trước. */
  deps.syncHistoryButtons();
  deps.syncSelView(null);
  showStudio();
  $('#projectName').value = doc.name;
  $('#projectMeta').textContent = `${doc.w} × ${doc.h} PX`;
  renderLayers();
  renderPalette();
  applyView();
  requestAnimationFrame(() => fit());
  clearOverlay();
  deps.clearSelection();
  syncAdjustUI();
  deps.updateToolUI();
  /* Tài liệu vừa mở coi như đã lưu: xoá cờ bẩn và hẹn giờ autosave còn sót
     của bản trước, nếu không nhãn "Đã lưu" sẽ nói dối và lần thoát sau lưu
     thừa bản mới. */
  clearTimeout(state.saveTimer);
  state.saveTimer = 0;
  state.dirty = false;
  setSaveState('saved');
  $('#btnDrawerSend').disabled = false;
}

export async function openProject(id) {
  const seq = ++openSeq;
  try {
    const data = await api('/library/' + encodeURIComponent(id) + '.json');
    if (seq !== openSeq) return;
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
          if (seq !== openSeq) return;
          layer.ctx.drawImage(img, 0, 0, doc.w, doc.h);
        } catch { /* keep empty */ }
      } else if (seq !== openSeq) return;
      doc.layers.push(layer);
    }
    if (seq !== openSeq) return;
    if (!doc.layers.length) doc.layers.push(newLayer(doc.w, doc.h, 'Lớp 1'));
    openDoc(doc);
  } catch (err) {
    if (seq !== openSeq) return; /* người dùng đã đổi tài liệu, đừng báo lỗi cũ */
    toast('Không mở được bản vẽ: ' + err.message, 'err');
  }
}

export async function goStart() {
  /* Rời studio: mọi lần nạp project đang dở phải bỏ, không được mở lại doc. */
  openSeq++;
  /* Bỏ ô nhập chữ đang mở (không ghi vào tài liệu), rồi chốt bản xem trước
     chỉnh màu trước khi lưu và rời studio. */
  deps.closeTextEditor();
  deps.finishAdjust();
  /* Nếu đang lưu dở, đợi xong rồi lưu nốt thay đổi mới rồi mới rời studio.
     Lưu thất bại thì ở lại studio — rời đi lúc này là mất thay đổi chưa lên đĩa. */
  const saved = await flushSave();
  if (!saved) {
    toast('Chưa lưu được bản vẽ — kiểm tra kết nối rồi thử lại', 'err', 3200);
    return;
  }
  state.doc = null;
  state.draw = null;
  state.adjust = null;
  clearHistory();
  deps.syncHistoryButtons();
  document.body.dataset.mode = 'start';
  $('#viewStudio').hidden = true;
  $('#viewStart').hidden = false;
  closeDrawer();
  await refresh();
  window.scrollTo(0, 0);
}

export function showStudio() {
  document.body.dataset.mode = 'studio';
  $('#viewStart').hidden = true;
  $('#viewStudio').hidden = false;
}

/* ------------------------------------------------------------------ size modal */
export async function applySizeModal() {
  const w = clamp(parseInt($('#sizeW').value, 10) || 1080, 16, 6000);
  const h = clamp(parseInt($('#sizeH').value, 10) || 1350, 16, 6000);
  closeSizeModal();
  const { mode } = sizeState();
  if (mode === 'new') {
    /* Tạo bản mới trong studio: phải lưu xong bản cũ trước khi thay doc,
       nếu không thay đổi đang chờ autosave sẽ mất. Lưu hỏng thì không mở bản
       mới để giữ nguyên bản đang vẽ. */
    if (!(await flushSave())) {
      toast('Chưa lưu được bản cũ — chưa mở bản mới', 'err', 3200);
      return;
    }
    createProject(`Bản vẽ ${w}×${h}`, w, h);
  } else if (mode === 'image') {
    resizeImage(w, h);
  } else if (mode === 'canvas') {
    resizeCanvas(w, h, $('#sizeAnchor').value);
  }
}

/* ------------------------------------------------------------------ templates */
export function createTemplate(key) {
  if (key === 'poster') {
    createProject('Poster mực', 1080, 1350, seedPoster);
  } else if (key === 'monogram') {
    createProject('Monogram', 800, 800, seedMonogram);
  } else {
    createProject('Dải màu', 1080, 1920, seedBands);
  }
}

export function seedPoster(doc) {
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

export function seedMonogram(doc) {
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

export function seedBands(doc) {
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
