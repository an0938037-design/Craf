/**
 * Truy vấn DOM + nạp ảnh: phần duy nhất của Craf chạm API trình duyệt.
 *
 * Chuyển nguyên văn từ app/app.js (`$`, `$$` dòng 6-7; `dpr` dòng 13;
 * `loadImage` dòng 63-68). Giữ nguyên tên và chữ ký.
 */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

export const loadImage = (src) => new Promise((resolve, reject) => {
  const img = new Image();
  img.onload = () => resolve(img);
  img.onerror = () => reject(new Error('Không đọc được ảnh'));
  img.src = src;
});
