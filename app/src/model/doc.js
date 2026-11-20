/**
 * Quy tắc dữ liệu của document (P2-2).
 *
 * Không tạo canvas ở đây: layer canvas thuộc phần raster (`app.js`/`pixel`).
 * Model chỉ quyết định **dữ liệu** nào được đổi và theo thứ tự nào.
 */
import { clamp, uid } from '../shared/index.js';
import * as selection from './selection.js';
import { state } from './store.js';

/**
 * Kích thước ô xem trước cho preset (port `sheetSize` app.js).
 * @param {{w:number,h:number}} p
 */
export function sheetSize(p) {
  const ratio = p.w / p.h;
  if (ratio >= 1) return { w: Math.min(88, 64 * ratio), h: 64 };
  return { w: 64, h: Math.min(64, 64 / ratio) };
}

/** Lớp đang chọn của doc hiện tại, hoặc null. */
export function activeLayer() {
  return state.doc ? state.doc.layers[state.active] : null;
}

/**
 * Tên project không trùng (port `uniqueName` app.js).
 * @param {Array<{name:string}>} projects
 * @param {string} name
 */
export function uniqueProjectName(projects, name) {
  if (!projects.some((p) => p.name === name)) return name;
  let i = 2;
  while (projects.some((p) => p.name === name + ' ' + i)) i++;
  return name + ' ' + i;
}

/**
 * Dữ liệu khung doc mới, chưa có layer (layer do caller tạo vì cần canvas).
 * @param {string} name
 * @param {number} w @param {number} h
 */
export function newDocData(name, w, h) {
  return {
    id: uid(),
    name,
    w, h,
    bg: '#FDFAF3',
    active: 0,
    createdAt: Date.now(),
  };
}

/**
 * Đưa doc vào store và reset trạng thái phiên (port phần đầu `openDoc` app.js).
 * Không đụng DOM; caller tự đồng bộ view/UI sau khi gọi.
 * @param {object} doc
 */
export function activate(doc) {
  state.doc = doc;
  state.active = clamp(doc.active ?? doc.layers.length - 1, 0, doc.layers.length - 1);
  state.undo = [];
  state.redo = [];
  selection.clear();
  state.selPreview = null;
  state.adjust = null;
  state.guidesX = [];
  state.guidesY = [];
  state.fitMode = true;
}
