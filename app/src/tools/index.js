/**
 * Cổng công khai của section `tools`.
 *
 * Chỉ export qua file này. Section khác không được import file nội bộ.
 * Hợp đồng Owns / May use / Must not: xem ./README.md
 *
 * Bus được **tiêm** (`configure({ bus })`) — `tools` không import `shell`.
 */
import { configure as configureRegistry } from './registry.js';

let bus = null;

/**
 * @param {{bus?: {emit(channel:string, payload?:unknown):void}}} deps
 */
export function configure(deps = {}) {
  if (deps.bus) bus = deps.bus;
  configureRegistry(deps);
}

/**
 * Phát một sự kiện lên bus đã tiêm (không làm gì nếu chưa tiêm).
 * @param {string} channel
 * @param {unknown} [payload]
 */
export function notify(channel, payload) {
  if (bus) bus.emit(channel, payload);
}

export { begin as beginMarquee, drag as dragMarquee, preview as previewMarquee, commit as commitMarquee } from './marquee.js';
export { selectAt as wandSelectAt } from './wand.js';
export { begin as beginBrush, drag as dragBrush, end as endBrush, widthFor as brushWidthFor } from './brush.js';
export { begin as beginMove, plan as planMove, apply as applyMove } from './move.js';
export { begin as beginShape, drag as dragShape } from './shape.js';
export { begin as beginGradient, drag as dragGradient, hasLength as gradientHasLength } from './gradient.js';
export { write as writeText, FONTS } from './text.js';
export { pickHex } from './picker.js';
export { fillAt, FILL_TOLERANCE } from './fill.js';
export { setTool, panelsFor, cursorFor, hintFor, toDoc } from './registry.js';
