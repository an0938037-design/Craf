/**
 * Cổng công khai của section `shell` — composition root.
 *
 * `shell` được dùng mọi section khác; không section nào được import ngược vào
 * `shell`. `index.js` là điểm vào duy nhất của app: re-export các cổng con và
 * nạp `boot.js`, nơi nối mọi section lại rồi khởi động studio.
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

/* Composition root: chạy một lần khi index.html nạp module này. */
import './boot.js';
