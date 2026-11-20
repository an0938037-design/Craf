/**
 * Ngăn xếp lịch sử (P2-4).
 *
 * Model chỉ giữ **luật** của stack (trần, xoá redo khi có entry mới). Việc mã
 * hoá ảnh (`toDataURL`) và vẽ lại (`loadImage`) nằm ở `app.js`/`pixel`, nên
 * entry được truyền vào như dữ liệu thuần.
 */
import { state } from './store.js';

export const LIMITS = { doc: 24, layer: 30 };

function push(entry, limit) {
  state.undo.push(entry);
  if (state.undo.length > limit) state.undo.shift();
  state.redo = [];
}

/** @param {object} entry Snapshot `{kind:'doc',...}`. */
export function pushDoc(entry) {
  push(entry, LIMITS.doc);
}

/** @param {object} entry Snapshot `{kind:'layer', id, src}`. */
export function pushLayer(entry) {
  push(entry, LIMITS.layer);
}

export function canUndo() {
  return state.undo.length > 0;
}

export function canRedo() {
  return state.redo.length > 0;
}

export function clear() {
  state.undo = [];
  state.redo = [];
}
