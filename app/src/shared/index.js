/**
 * Cổng công khai của section `shared`.
 *
 * Chỉ export qua file này. Section khác không được import file nội bộ.
 * Hợp đồng Owns / May use / Must not: xem ./README.md
 *
 * Giai đoạn 1 (docs/plan-chuyen-module.md): P1-2.
 */

export { clamp, uid, esc, pad, fmt } from './util.js';
export { createEmitter } from './emitter.js';
