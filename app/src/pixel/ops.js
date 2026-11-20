/** Cắt canvas theo rect (port replaceLayerImage + drawImage của cropToSelection). */
export function cropCanvas(canvas, rect) {
  const out = document.createElement('canvas');
  out.width = rect.w;
  out.height = rect.h;
  out.getContext('2d').drawImage(canvas, -rect.x, -rect.y);
  return out;
}
