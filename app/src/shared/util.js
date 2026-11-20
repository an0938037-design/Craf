/**
 * Helper thuần, không ngữ nghĩa Craf.
 *
 * Chuyển nguyên văn từ app/app.js (dòng 8-12), giữ nguyên tên và chữ ký.
 */

export const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
export const uid = () => 'craf-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
export const esc = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
export const pad = (n) => String(n).padStart(2, '0');
export const fmt = (n) => Math.round(n).toLocaleString('en-US').replace(/,/g, '.');
