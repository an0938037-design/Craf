/**
 * Cache 1-entry Path2D của vùng chọn, khoá theo `sel.rev` (hợp đồng §4.7).
 * rev đổi -> dựng lại; rev không đổi -> trả đúng object cũ (ants 95ms/frame
 * không được dựng lại path).
 */
import { maskSegments, segmentsToCommands } from '../core/index.js';
import { pathFromCommands } from '../platform/index.js';

let cacheRev = -1;
let cacheSel = null;
let cachePath = null;

export function selectionPath(sel) {
  if (!sel || !sel.data) return null;
  if (sel === cacheSel && sel.rev === cacheRev) return cachePath;
  cachePath = pathFromCommands(segmentsToCommands(maskSegments(sel.data, sel.w, sel.h)));
  cacheSel = sel;
  cacheRev = sel.rev;
  return cachePath;
}
