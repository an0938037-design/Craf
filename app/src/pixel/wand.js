import { compositeSample, maskFromWand } from './mask.js';

/** Mask wand từ composite của doc (port app.js maskFromWand). */
export function wandMask(doc, x, y, tol) {
  const { w, h } = doc;
  return maskFromWand(compositeSample(doc, w, h, true), w, h, x, y, tol);
}
