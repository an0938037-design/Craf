export function strokePath(ctx, path, { docW, docH, color, width, align }) {
  ctx.save();
  let lineWidth = width;
  if (align === 'inside') {
    ctx.clip(path, 'evenodd');
    lineWidth = width * 2;
  } else if (align === 'outside') {
    const outside = new Path2D();
    outside.rect(0, 0, docW, docH);
    outside.addPath(path);
    ctx.clip(outside, 'evenodd');
    lineWidth = width * 2;
  }
  ctx.lineWidth = lineWidth;
  ctx.strokeStyle = color;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke(path);
  ctx.restore();
}

export function fillPath(ctx, path, { w, h, color, opacity }) {
  ctx.save();
  if (path) ctx.clip(path, 'evenodd');
  ctx.globalAlpha = opacity;
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

export function clearPath(ctx, path, w, h) {
  ctx.save();
  if (path) {
    ctx.globalCompositeOperation = 'destination-out';
    ctx.fillStyle = '#000';
    ctx.fill(path, 'evenodd');
  } else {
    ctx.clearRect(0, 0, w, h);
  }
  ctx.restore();
}
