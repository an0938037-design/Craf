/**
 * Công cụ chữ (P4-6).
 *
 * Ô nhập chữ là DOM của UI nên nằm ngoài section này; ở đây chỉ giữ bảng font và
 * luật rasterize (mỗi dòng cách nhau 1.06 × cỡ chữ, baseline `top`).
 */
import { drawText } from '../pixel/index.js';

/** Font stack theo khoá `state.font`. */
export const FONTS = {
  serif: '"Fraunces", Georgia, serif',
  sans: '"Segoe UI Variable Text", "Segoe UI", sans-serif',
  mono: '"Geist Mono", Consolas, monospace',
};

/**
 * Ghi chữ lên layer tại `pt` (góc trên-trái của dòng đầu).
 * @param {object} layer
 * @param {string} text
 * @param {{x:number,y:number}} pt
 * @param {{color:string, size:number, font:string, opacity:number, clipPath?:Path2D|null}} o
 */
export function write(layer, text, pt, o) {
  drawText(layer.ctx, text, pt, {
    color: o.color,
    size: o.size,
    font: FONTS[o.font] || FONTS.serif,
    opacity: o.opacity,
    clipPath: o.clipPath || null,
  });
}
