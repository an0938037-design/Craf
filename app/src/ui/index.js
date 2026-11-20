/**
 * Cổng công khai của section `ui`.
 *
 * Chỉ export qua file này. Section khác không được import file nội bộ.
 * Hợp đồng Owns / May use / Must not: xem ./README.md
 *
 * `ui` không import `tools`: mọi hành động đi qua callback được **tiêm** từ
 * `shell` (xem `start.configure`).
 */
export { toast } from './feedback.js';
export {
  renderPalette,
  markSwatches,
  setBgColor,
  swapColors,
  resetColors,
  setColor,
  setFill,
  hslFromUI,
} from './inspector.js';
export { adjustDefaults, syncAdjustUI } from './adjust-panel.js';
export { configure as configureLayers, renderLayers, syncLayerProps } from './layers.js';
export { closeMenus, openMenu, bindMenubar, openPane } from './menus.js';
export { openDrawer, closeDrawer, openHelp, closeHelp, openIns, closeIns } from './drawer.js';
export {
  configure as configureStart,
  renderPresets,
  openCustomPreset,
  projectCard,
  timeAgo,
  renderRecent,
  renderTemplates,
  paintTemplatePreviews,
  renderNott,
} from './start.js';
