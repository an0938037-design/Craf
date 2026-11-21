/**
 * Truy vấn DOM + nạp ảnh: phần duy nhất của Craf chạm API trình duyệt.
 *
 * Chuyển nguyên văn từ app/app.js (`$`, `$$` dòng 6-7; `dpr` dòng 13;
 * `loadImage` dòng 63-68). Giữ nguyên tên và chữ ký.
 */

export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));

export const dpr = () => Math.min(window.devicePixelRatio || 1, 2);

/**
 * Nạp ảnh đã giải mã xong rồi mới trả về (ImageBitmap). `Image.onload` chỉ báo
 * tải xong, Chrome có thể chưa giải mã pixel — `drawImage` ngay sau đó có thể
 * vẽ thiếu trên máy chậm. `createImageBitmap` chỉ resolve khi bitmap sẵn sàng
 * vẽ. (Không dùng `img.decode()`: trong môi trường chạy thử của Craf nó treo.)
 * Ảnh lỗi/CORS rơi về thẻ Image để giữ nguyên thông báo cũ.
 */
export const loadImage = async (src) => {
  if (typeof createImageBitmap === 'function') {
    try {
      const res = await fetch(src);
      if (res.ok) return await createImageBitmap(await res.blob());
    } catch { /* ảnh lỗi/CORS: rơi về thẻ Image để giữ thông báo cũ */ }
  }
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Không đọc được ảnh'));
    img.src = src;
  });
};
