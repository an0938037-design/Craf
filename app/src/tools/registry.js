/**
 * Sổ đăng ký tool (P4-6).
 *
 * Chỉ giữ **dữ liệu và luật của tool**, không chạm DOM: `setTool` ghi
 * `state.tool` rồi phát `tool:changed` lên bus đã tiêm; các bảng `panelsFor`,
 * `cursorFor`, `hintFor` là dữ liệu thuần để `ui` (hoặc `app.js` tạm thời) vẽ.
 *
 * Nhờ vậy `tools` không import `ui` mà panel vẫn cập nhật qua bus.
 */
import { state } from '../model/index.js';
import { clamp } from '../shared/index.js';

let bus = null;

/**
 * @param {{bus?: {emit(channel:string, payload?:unknown):void}}} deps
 */
export function configure(deps = {}) {
  if (deps.bus) bus = deps.bus;
}

/**
 * Chọn tool hiện tại. Không early-return: giữ đúng hành vi cũ (chọn lại cùng
 * tool vẫn phát lại sự kiện để panel đồng bộ).
 * @param {string} tool
 */
export function setTool(tool) {
  state.tool = tool;
  if (bus) bus.emit('tool:changed', { tool });
}

/** Tool có hiện khối "tô kín" không. */
export function panelsFor(tool) {
  return {
    shapeFill: tool === 'rect' || tool === 'ellipse',
    text: tool === 'text',
    wand: tool === 'wand',
    gradient: tool === 'gradient',
    hardness: tool === 'brush' || tool === 'eraser',
  };
}

/** Con trỏ CSS của overlay theo tool. */
export function cursorFor(tool) {
  const cursors = {
    hand: 'grab', move: 'move', brush: 'none', eraser: 'none',
    marquee: 'crosshair', lasso: 'crosshair', wand: 'crosshair', gradient: 'crosshair',
  };
  return cursors[tool] || 'crosshair';
}

/** Câu gợi ý dưới sân khấu. */export function hintFor(tool) {
  const hints = {
    brush: 'VẼ TỰ DO · [ ] ĐỔI CỠ CỌ · SPACE KÉO BÀN',
    eraser: 'TẨY · [ ] ĐỔI CỠ TẨY',
    line: 'KÉO ĐỂ VẼ ĐƯỜNG · SHIFT KHOÁ 45°',
    rect: 'KÉO ĐỂ VẼ CHỮ NHẬT · SHIFT = VUÔNG · ALT = TỪ TÂM',
    ellipse: 'KÉO ĐỂ VẼ ELLIPSE · SHIFT = TRÒN · ALT = TỪ TÂM',
    fill: 'BẤM VÀO MỘT VÙNG ĐỂ ĐỔ MÀU',
    gradient: 'KÉO ĐỂ CHUYỂN MÀU TRƯỚC → SAU · SHIFT ĐẢO CHIỀU',
    pick: 'BẤM ĐỂ HÚT MÀU TỪ BÀN VẼ',
    text: 'BẤM ĐỂ ĐẶT CHỮ · ENTER ĐỂ XONG',
    hand: 'KÉO ĐỂ DI CHUYỂN BÀN VẼ · LĂN CHUỘT ĐỂ ZOOM',
    move: 'KÉO ĐỂ DI CHUYỂN LỚP HOẶC VÙNG CHỌN · SHIFT KHOÁ TRỤC',
    marquee: 'KÉO VÙNG CHỌN · SHIFT THÊM · ALT BỚT · BẤM SUÔNG ĐỂ BỎ CHỌN',
    lasso: 'VẼ VÒNG TỰ DO · SHIFT THÊM · ALT BỚT',
    wand: 'BẤM ĐỂ CHỌN MẢNG MÀU TƯƠNG TỰ · SHIFT THÊM · ALT BỚT',
  };
  return hints[tool] || '';
}

/**
 * Đổi toạ độ con trỏ (client) → toạ độ doc, kèm áp lực bút.
 * @param {PointerEvent} e
 * @param {HTMLElement} board Phần tử có kích thước `doc × zoom`.
 * @param {{w:number,h:number}} doc
 */
export function toDoc(e, board, doc) {
  const r = board.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * doc.w / r.width,
    y: (e.clientY - r.top) * doc.h / r.height,
    pressure: e.pointerType === 'pen' ? clamp(e.pressure || 0.5, 0.08, 1) : 0.5,
  };
}

