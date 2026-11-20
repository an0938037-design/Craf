/**
 * Metadata thuần của layer (P2-3).
 *
 * Canvas không thuộc model: `pixel/layers.js` gọi `layerMeta()` rồi gắn
 * `canvas`/`ctx`. Nhờ vậy model không cần `document.createElement`.
 */
import { uid } from '../shared/index.js';

/**
 * @param {string} [name='Lớp']
 * @returns {{id:string,name:string,visible:boolean,opacity:number,blend:string}}
 */
export function layerMeta(name = 'Lớp') {
  return { id: uid(), name, visible: true, opacity: 100, blend: 'source-over' };
}
