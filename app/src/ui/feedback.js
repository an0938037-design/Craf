/**
 * Toast — phản hồi ngắn ở góc màn hình (P5).
 *
 * Chỉ chạm DOM của `#toasts`; nội dung do phía gọi truyền vào và luôn được
 * `esc()` trước khi nhét vào HTML.
 */
import { $ } from '../platform/index.js';
import { esc } from '../shared/index.js';

/** Hẹn giờ ẩn rồi xoá toast; gọi lại thì đếm lại từ đầu. */
function schedule(el, ms) {
  clearTimeout(el._toastHide);
  clearTimeout(el._toastRemove);
  el.style.transition = '';
  el.style.opacity = '';
  el.style.transform = '';
  el._toastHide = setTimeout(() => {
    el.style.transition = 'opacity .25s, transform .25s';
    el.style.opacity = '0';
    el.style.transform = 'translateY(6px)';
    el._toastRemove = setTimeout(() => el.remove(), 260);
  }, ms);
}

/**
 * Hiện một toast rồi tự xoá.
 *
 * Cùng nội dung lặp liên tiếp (autosave lỗi thử lại nhiều lần) thì dùng lại
 * toast đang hiện và đếm giờ lại, thay vì chồng một chồng toast giống nhau.
 * @param {string} msg
 * @param {'ok'|'warn'|'err'} [kind]
 * @param {number} [ms]
 */
export function toast(msg, kind = 'ok', ms = 3200) {
  const box = $('#toasts');
  if (!box) return;
  const last = box.lastElementChild;
  if (last && last.isConnected && last.dataset.kind === kind) {
    const span = last.querySelector('span');
    if (span && span.textContent === msg) {
      schedule(last, ms);
      return;
    }
  }
  const el = document.createElement('div');
  el.className = 'toast' + (kind !== 'ok' ? ' ' + kind : '');
  el.dataset.kind = kind;
  el.innerHTML = '<i></i><span>' + esc(msg) + '</span>';
  box.appendChild(el);
  schedule(el, ms);
}
