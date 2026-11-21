/**
 * Cổng công khai của section `model`.
 *
 * Chỉ export qua file này. Section khác không được import file nội bộ.
 * Hợp đồng Owns / May use / Must not: xem ./README.md
 *
 * `selection.js` — `Selection {rev,w,h,data,bbox}` + `apply/clear/get/isActive/contains/revision`.
 * `store.js` — `state` + `get/set/subscribe` (facade của giai đoạn 2).
 */
export * as selection from './selection.js';
export { state, get, set, subscribe, emit } from './store.js';
export { sheetSize, activeLayer, uniqueProjectName, newDocData, activate } from './doc.js';
export { layerMeta } from './layers.js';
export { LIMITS as HISTORY_LIMITS, pushDoc, pushLayer, canUndo, canRedo, clear as clearHistory, dropTagged } from './history.js';
export { DEFAULT_BG, EMPTY_LAYER_NAME, toPayload, docSnapshot, docFromJSON, layerFromJSON } from './serialize.js';
export { PRESETS, TEMPLATES, CRAF_SWATCHES } from './presets.js';
