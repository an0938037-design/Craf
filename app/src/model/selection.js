/**
 * Vùng chọn — tầng `model` theo hợp đồng docs/contracts/mask.md §4.6/§5.2.
 *
 * Chỉ import `../core/index.js`. Giữ `MaskAlpha` (1 byte/px, doc px) + `bbox`
 * + `rev`; không dựng canvas, không tạo object đường biên, không gọi
 * `pixel`/`render`/DOM. `apply(mask, 'replace')` nhận quyền sở hữu `mask`
 * (bên gọi không dùng lại).
 */
import * as core from '../core/index.js';

/** @typedef {Uint8Array} MaskAlpha 0..255, length = w*h, row-major, 1 byte/px, DOC PX */
/** @typedef {{x:number,y:number,w:number,h:number}} Rect DOC PX, số nguyên, w,h >= 1 */
/** @typedef {{rev:number,w:number,h:number,data:MaskAlpha,bbox:Rect}} Selection Object bất biến của vùng chọn. */

let cur = null;
let rev = 0;
let sizeFn = null;

/** @returns {Selection|null} Object bất biến; null = chưa chọn. */
export function get() {
  return cur;
}

/** @returns {boolean} */
export function isActive() {
  return !!cur;
}

/**
 * Cập nhật vùng chọn từ `mask` (đúng cỡ doc).
 * @param {MaskAlpha} mask
 * @param {'replace'|'add'|'subtract'|'intersect'} mode Mode như `core.maskMerge`.
 * @returns {Selection|null} Rỗng (bbox null) → clear() và trả null.
 */
export function apply(mask, mode) {
  const size = sizeFn && sizeFn();
  if (!size || !mask) return cur;
  if (mask.length !== size.w * size.h) throw new Error('mask size mismatch');
  let data;
  if (!cur || mode === 'replace') data = mask;
  else data = core.maskMerge(cur.data, mask, size.w, size.h, mode);
  const bbox = core.maskBounds(data, size.w, size.h);
  if (!bbox) { cur = null; rev++; return null; }
  cur = { rev: ++rev, w: size.w, h: size.h, data, bbox };
  return cur;
}

/**
 * Gán `Selection` trực tiếp (dùng cho `openDoc`/undo/applySnapshot — D3/D4).
 * Không validate; `rev++` mỗi lần gọi.
 * @param {Selection|null} sel
 * @returns {void}
 */
export function replace(sel) {
  cur = sel || null;
  rev++;
}

/** @returns {void} Xoá vùng chọn (không đụng selPreview — preview thuộc render). */
export function clear() {
  replace(null);
}

/**
 * Đọc điểm ảnh (x, y số nguyên, bị floor). Ngoài khung → false.
 * @param {number} x
 * @param {number} y
 * @returns {boolean}
 */
export function contains(x, y) {
  if (!cur) return false;
  return core.maskPick(cur.data, cur.w, cur.h, Math.floor(x), Math.floor(y));
}

/** @returns {number} rev — đơn điệu, +1 mỗi apply/replace/clear. */
export function revision() {
  return rev;
}

/**
 * Cấp hàm trả kích thước doc — bắt buộc cho `apply()`. Nếu `getDocSize`
 * không phải function thì `sizeFn = null`.
 * @param {{getDocSize: Function|null}} opts
 * @returns {void}
 */
export function configure({ getDocSize }) {
  sizeFn = typeof getDocSize === 'function' ? getDocSize : null;
}
