/**
 * Dữ liệu tĩnh của sản phẩm: khổ giấy, mẫu, bảng màu Craf.
 *
 * Chỉ là dữ liệu — không DOM, không canvas. `ui/start.js` và panel màu đọc từ
 * đây để một chỗ duy nhất quyết định bộ preset/brand swatch.
 */

/** Khổ giấy dựng sẵn ở màn hình bắt đầu. */
export const PRESETS = [
  { key: 'poster', name: 'Poster', w: 1080, h: 1350, note: 'dọc' },
  { key: 'square', name: 'Vuông', w: 1080, h: 1080, note: '1:1' },
  { key: 'story', name: 'Story', w: 1080, h: 1920, note: 'dọc dài' },
  { key: 'avatar', name: 'Avatar', w: 800, h: 800, note: 'tròn' },
];

/** Mẫu dựng sẵn (nội dung do `seed*` bên `app.js` cấp). */
export const TEMPLATES = [
  { key: 'poster', name: 'Poster mực', note: 'mực + chữ', w: 1080, h: 1350 },
  { key: 'monogram', name: 'Monogram', note: 'dấu riêng', w: 800, h: 800 },
  { key: 'bands', name: 'Dải màu', note: 'story', w: 1080, h: 1920 },
];

/** Bảng màu thương hiệu Craf. */
export const CRAF_SWATCHES = [
  '#16130E', '#3A3428', '#6B6154', '#A69A85', '#D9CFB9', '#F1E9D8', '#FDFAF3', '#FF4D24',
  '#FF8A5B', '#FFC24B', '#9BD46A', '#3E9D8B', '#2F6FED', '#7B5CFA', '#D9478A', '#8C3B1E',
];
