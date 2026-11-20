/**
 * Cổng công khai của section `tools`.
 *
 * Chỉ export qua file này. Section khác không được import file nội bộ.
 * Hợp đồng Owns / May use / Must not: xem ./README.md
 *
 * Bus được **tiêm** (`configure({ bus })`) — `tools` không import `shell`.
 */
let bus = null;

/**
 * @param {{bus?: {emit(channel:string, payload?:unknown): void}}} deps
 */
export function configure(deps = {}) {
  if (deps.bus) bus = deps.bus;
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
