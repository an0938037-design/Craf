/**
 * Cầu lưu trữ HTTP tới `craf.py` + trạng thái autosave + xuất ảnh (P5-5).
 *
 * Đây là chỗ duy nhất biết endpoint `/api/*` và biết cách dựng thumbnail. Mọi
 * thứ khác gọi `markDirty()` / `saveNow()`.
 */
import { $ } from '../platform/index.js';
import { clamp, pad } from '../shared/index.js';
import { state, toPayload } from '../model/index.js';
import { compositeDoc } from '../render/index.js';
import { jpegDataURL, pngDataURL } from '../pixel/index.js';
import { toast, renderRecent, renderNott } from '../ui/index.js';

/**
 * Gọi API JSON. Ném lỗi kèm message từ server.
 * @param {string} path
 * @param {unknown} [body]
 */
export async function api(path, body) {
  const opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
  const res = await fetch(path, opts);
  const text = await res.text();
  let data = null;
  try { data = JSON.parse(text); } catch { /* not json */ }
  if (!res.ok) throw new Error((data && data.error) || text || res.statusText);
  return data || {};
}

export function compositeCanvas(w, h, transparent = false) {
  return compositeDoc(state.doc, w, h, transparent);
}

function thumbData() {
  const w = Math.min(480, state.doc.w);
  const h = Math.round(w * state.doc.h / state.doc.w);
  return jpegDataURL(compositeCanvas(w, h), 0.84);
}

export function setSaveState(kind) {
  const el = $('#saveState');
  if (!el) return;
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

/** Đánh dấu bẩn và hẹn autosave sau 1 giây. */
export function markDirty() {
  state.dirty = true;
  setSaveState('dirty');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(saveNow, 1000);
}

export async function saveNow() {
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

export function openExport() {
  if (!state.doc) { toast('Mở một bản vẽ trước đã', 'warn'); return; }
  $('#exportName').value = (state.doc.name || 'craf').replace(/[\\/:*?"<>|]+/g, '').trim() || 'craf';
  $('#exportModal').hidden = false;
  updateExportInfo();
  $('#exportName').focus();
  $('#exportName').select();
}

export function exportDims() {
  const scale = parseFloat($('#exportScale').value) || 1;
  return { w: Math.max(1, Math.round(state.doc.w * scale)), h: Math.max(1, Math.round(state.doc.h * scale)), scale };
}

export function updateExportInfo() {
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

export function runExport() {
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

export async function refresh() {
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

export async function refreshNott() {
  try {
    state.nott = await api('/api/nott');
    renderNott();
  } catch { /* ignore */ }
}
