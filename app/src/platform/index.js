/**
 * Cổng công khai của section `platform`.
 *
 * Chỉ export qua file này. Section khác không được import file nội bộ.
 * Hợp đồng Owns / May use / Must not: xem ./README.md
 *
 * Giai đoạn 1 (docs/plan-chuyen-module.md): P1-1.
 */

export { $, $$, dpr, loadImage } from './dom.js';
export { pathFromCommands } from './path2d.js';
