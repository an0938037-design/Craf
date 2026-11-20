/**
 * Store tạm thời của Craf (P2-1).
 *
 * Giai đoạn 2 giữ **nguyên shape** object `state` cũ để 570 chỗ đọc `state.`
 * trong `app.js` chạy không đổi hành vi. Việc thay dần từng vùng đọc sang
 * `get()/set()` là P2-6; ở đây chỉ chuyển nơi khai báo và mở sẵn đường
 * subscribe.
 *
 * Bất biến:
 * - `state` là object duy nhất, tồn tại suốt phiên.
 * - `set()` ghi đè nông rồi phát đúng danh sách key vừa đổi.
 * - Không DOM, không đọc/ghi ngoài object này.
 */

/** Trạng thái khởi tạo — giữ đúng thứ tự và giá trị như bản trong `app.js`. */
export const state = {
  projects: [], nott: null,
  doc: null, active: 0,
  tool: 'brush', color: '#16130E', bgColor: '#FDFAF3', opacity: 1, size: 18,
  hardness: 0.9, wandTol: 32, gradType: 'linear',
  textSize: 96, font: 'serif', shapeFill: false,
  view: { zoom: 1, x: 32, y: 32 }, fitMode: true,
  undo: [], redo: [],
  dirty: false, saving: false, saveTimer: 0,
  space: false, panning: null, draw: null, textAt: null,
  guides: false, guidesX: [], guidesY: [], guideDrag: null,
  selPreview: null, marquee: null,
  move: null, gradient: null,
  clipboard: null, adjust: null,
  antsPhase: 0,
};

const subs = new Set();

/**
 * Đọc một key, hoặc toàn bộ object khi không truyền key.
 * @param {string} [key]
 */
export function get(key) {
  return key === undefined ? state : state[key];
}

/**
 * Ghi đè nông nhiều key rồi phát sự kiện một lần.
 * @param {Record<string, unknown>} patch
 * @returns {typeof state}
 */
export function set(patch) {
  if (!patch) return state;
  const keys = Object.keys(patch);
  if (!keys.length) return state;
  for (const k of keys) state[k] = patch[k];
  emit(keys);
  return state;
}

/**
 * Đăng ký nhận thay đổi. Trả hàm huỷ đăng ký.
 * @param {(state: typeof state, keys: string[]) => void} fn
 */
export function subscribe(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}

/**
 * Phát thủ công cho các đường ghi trực tiếp vào object (giai đoạn chuyển tiếp).
 * @param {string[]} [keys]
 */
export function emit(keys = []) {
  for (const fn of subs) fn(state, keys);
}
