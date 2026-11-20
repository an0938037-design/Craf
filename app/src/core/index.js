/**
 * Cổng công khai của section `core`.
 *
 * Chỉ export qua file này. Section khác không được import file nội bộ.
 * Hợp đồng Owns / May use / Must not: xem ./README.md
 *
 * Giai đoạn 1 (docs/plan-chuyen-module.md): P1-3 (color), một phần P1-4
 * (chỉ `bezierPoints`; các hàm mask/hình học còn lại chưa thuần — xem
 * ghi chú trong ./geometry.js).
 */

export { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, hslToHex, hexToHsl } from './color.js';
export { bezierPoints } from './geometry.js';
