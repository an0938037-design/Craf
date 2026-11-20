/**
 * Mã hoá canvas thành data URL (P3-5).
 *
 * Một chỗ duy nhất quyết định định dạng/quality của ảnh lưu và thumbnail; đổi
 * định dạng sau này chỉ sửa file này.
 */

/**
 * PNG lossless cho layer trong `.craf`.
 * @param {HTMLCanvasElement} canvas
 */
export function pngDataURL(canvas) {
  return canvas.toDataURL('image/png');
}

/**
 * JPEG cho thumbnail thư viện.
 * @param {HTMLCanvasElement} canvas
 * @param {number} [quality=0.84]
 */
export function jpegDataURL(canvas, quality = 0.84) {
  return canvas.toDataURL('image/jpeg', quality);
}
