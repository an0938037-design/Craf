/**
 * Cổng công khai của section `shell` — composition root.
 *
 * `shell` được dùng mọi section khác; không section nào được import ngược vào
 * `shell`. Hiện đã có cầu lưu trữ; boot/keymap/commands sẽ chuyển tiếp ở P5-5…P6.
 */
export {
  api,
  markDirty,
  setSaveState,
  saveNow,
  compositeCanvas,
  openExport,
  exportDims,
  updateExportInfo,
  runExport,
  refresh,
  refreshNott,
} from './storage.js';
export { createCommands } from './commands.js';
export { createKeyHandler, bindKeymap } from './keymap.js';
