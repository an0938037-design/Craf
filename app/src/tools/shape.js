/**
 * Máy trạng thái công cụ shape (P4-6).
 *
 * Chỉ giữ gesture; hình học và rasterize nằm ở `pixel/shape.js`. Phía gọi tự
 * quyết định preview lên overlay hay commit xuống layer.
 */

/**
 * @param {object} layer
 * @param {{x:number,y:number}} pt
 * @param {{shift?:boolean, alt?:boolean}} mods
 */
export function begin(layer, pt, mods = {}) {
  return {
    kind: 'shape', layer, start: { x: pt.x, y: pt.y }, current: { x: pt.x, y: pt.y },
    shift: !!mods.shift, alt: !!mods.alt,
  };
}

/**
 * Cập nhật điểm cuối + phím bổ trợ.
 * @param {object} d
 * @param {{x:number,y:number}} pt
 * @param {{shift?:boolean, alt?:boolean}} mods
 */
export function drag(d, pt, mods = {}) {
  d.current = { x: pt.x, y: pt.y };
  d.shift = !!mods.shift;
  d.alt = !!mods.alt;
}
