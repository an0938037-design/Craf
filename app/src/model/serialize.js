/**
 * Hình dạng dữ liệu `.craf` (P2-5).
 *
 * Mọi field của file lưu và của snapshot history được khai báo **một lần** ở
 * đây để đường ghi và đường đọc không trôi khỏi nhau. Data URL của layer do
 * caller cấp (canvas không thuộc model).
 */
import { clamp } from '../shared/index.js';

export const DEFAULT_BG = '#FDFAF3';
export const EMPTY_LAYER_NAME = 'Lớp 1';

/**
 * Payload gửi `POST /api/projects`.
 * @param {object} doc
 * @param {(layer: object) => string} layerSrc Data URL PNG.
 * @param {string} thumb Data URL JPEG của thumbnail.
 */
export function toPayload(doc, layerSrc, thumb) {
  return {
    id: doc.id,
    name: doc.name,
    w: doc.w,
    h: doc.h,
    bg: doc.bg,
    createdAt: doc.createdAt,
    layers: doc.layers.map((l) => ({
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blend: l.blend,
      src: layerSrc(l),
    })),
    thumb,
  };
}

/**
 * Snapshot `kind:'doc'` cho history.
 * @param {object} doc
 * @param {number} active
 * @param {(layer: object) => string} layerSrc
 */
export function docSnapshot(doc, active, layerSrc) {
  return {
    kind: 'doc',
    w: doc.w,
    h: doc.h,
    bg: doc.bg,
    layers: doc.layers.map((l) => ({
      /* Giữ id: entry mức lớp đẩy trước một thao tác mức doc (thêm/xoá lớp,
         resize, lật…) phải tìm lại đúng lớp sau khi khôi phục doc. */
      id: l.id,
      name: l.name,
      visible: l.visible,
      opacity: l.opacity,
      blend: l.blend,
      src: layerSrc(l),
    })),
    active,
  };
}

/**
 * Khung doc đọc từ JSON; layer do caller dựng vì cần canvas.
 * @param {object} data
 */
export function docFromJSON(data) {
  return {
    id: data.id,
    name: data.name,
    w: data.w,
    h: data.h,
    bg: data.bg || DEFAULT_BG,
    createdAt: data.createdAt || Date.now(),
    layers: [],
    active: (data.layers || []).length - 1,
  };
}

/**
 * Chuẩn hoá một layer đọc từ file (giá trị thiếu/sai kiểu).
 * @param {{name:string,visible?:boolean,opacity?:number,blend?:string,src?:string}} l
 */
export function layerFromJSON(l) {
  return {
    name: l.name,
    visible: l.visible !== false,
    opacity: clamp(l.opacity ?? 100, 0, 100),
    blend: l.blend || 'source-over',
    src: l.src || null,
  };
}
