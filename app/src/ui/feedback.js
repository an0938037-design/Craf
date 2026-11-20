/**
 * Toast — phản hồi ngắn ở góc màn hình (P5).
 *
 * Chỉ chạm DOM của `#toasts`; nội dung do phía gọi truyền vào và luôn được
 * `esc()` trước khi nhét vào HTML.
 */
import { $ } from '../platform/index.js';
import { esc } from '../shared/index.js';

/**
 * Hiện một toast rồi tự xoá.
 * @param {string} msg
 * @param {'ok'|'warn'|'err'} [kind]
 * @param {number} [ms]
 */
export function toast(msg, kind = 'ok', ms = 3200) {
  const box = $('#toasts');
  if (!box) return;
  const el = document.createElement('div');
  el.className = 'toast' + (kind !== 'ok' ? ' ' + kind : '');
  el.innerHTML = '<i></i><span>' + esc(msg) + '</span>';
  box.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    setTimeout(() => el.remove(), 260);
  }, ms);
}
