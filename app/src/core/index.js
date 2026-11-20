/**
 * Cổng công khai của section `core`.
 *
 * Chỉ export qua file này. Section khác không được import file nội bộ.
 * Hợp đồng Owns / May use / Must not: xem ./README.md
 */

export { hexToRgb, rgbToHex, rgbToHsl, hslToRgb, hslToHex, hexToHsl } from './color.js';
export { bezierPoints, previewGeometry, shapeGeometry } from './geometry.js';
export { maskCreate, maskAll, maskFromRect, maskBounds, maskPick, maskMerge, maskInvert, maskShiftInt } from './mask.js';
export { maskSegments, segmentsToCommands } from './path.js';
