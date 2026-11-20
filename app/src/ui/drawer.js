/**
 * Ngăn kéo Nott, hộp trợ giúp, và ngăn inspector trên mobile (P5-4).
 *
 * Chỉ bật/tắt lớp phủ bằng `hidden` + class trên `body`; nội dung Nott do
 * `ui/start.js` render.
 */
import { $ } from '../platform/index.js';
import { state } from '../model/index.js';

export function openIns() {
  document.body.classList.add('ins-open');
  $('#insScrim').hidden = false;
}

export function closeIns() {
  document.body.classList.remove('ins-open');
  $('#insScrim').hidden = true;
}

export function openDrawer() {
  closeIns();
  $('#nottDrawer').hidden = false;
  $('#scrim').hidden = false;
  $('#btnDrawerSend').disabled = !state.doc;
}

export function closeDrawer() {
  $('#nottDrawer').hidden = true;
  $('#scrim').hidden = true;
}

export function openHelp() { $('#helpModal').hidden = false; }
export function closeHelp() { $('#helpModal').hidden = true; }
