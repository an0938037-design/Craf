/**
 * Poster hero của màn hình bắt đầu (P5-7).
 *
 * Vẽ một poster Craf bằng canvas 2D: nền giấy, hạt phim, chữ Fraunces/Geist
 * Mono, và một dải mực chạy vào. Không đụng doc — chỉ trang trí `#heroPoster`.
 */
import { $ } from '../platform/index.js';
import { bezierPoints } from '../core/index.js';

function spacedText(ctx, text, x, y, spacing, align = 'left') {
  const chars = Array.from(text);
  let width = 0;
  for (const ch of chars) width += ctx.measureText(ch).width + spacing;
  width -= spacing;
  let cx = align === 'right' ? x - width : x;
  for (const ch of chars) {
    ctx.fillText(ch, cx, y);
    cx += ctx.measureText(ch).width + spacing;
  }
  return width;
}

function grain(ctx, w, h) {
  const n = document.createElement('canvas');
  n.width = 180;
  n.height = 180;
  const nc = n.getContext('2d');
  const img = nc.createImageData(180, 180);
  for (let i = 0; i < img.data.length; i += 4) {
    const v = 208 + Math.random() * 47;
    img.data[i] = v; img.data[i + 1] = v; img.data[i + 2] = v; img.data[i + 3] = 52;
  }
  nc.putImageData(img, 0, 0);
  const pat = ctx.createPattern(n, 'repeat');
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  ctx.globalAlpha = 0.62;
  ctx.fillStyle = pat;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function inkRibbon(ctx, pts, widthAt, color, upto = 1) {
  const n = Math.max(2, Math.floor(pts.length * upto));
  const left = [], right = [];
  for (let i = 0; i < n; i++) {
    const p = pts[i];
    const q = pts[Math.min(i + 1, pts.length - 1)];
    const dx = q.x - p.x, dy = q.y - p.y;
    const len = Math.hypot(dx, dy) || 1;
    const nx = -dy / len, ny = dx / len;
    const w = widthAt(i / Math.max(1, pts.length - 1)) / 2;
    left.push({ x: p.x + nx * w, y: p.y + ny * w });
    right.push({ x: p.x - nx * w, y: p.y - ny * w });
  }
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(left[0].x, left[0].y);
  for (let i = 1; i < left.length; i++) ctx.lineTo(left[i].x, left[i].y);
  for (let i = right.length - 1; i >= 0; i--) ctx.lineTo(right[i].x, right[i].y);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

let heroRun = 0;

/** Vẽ lại poster hero; gọi lại nhiều lần an toàn (mỗi lần một `run`). */
export async function paintHero() {
  const c = $('#heroPoster');
  if (!c) return;
  const run = ++heroRun;
  try {
    await document.fonts.load('500 140px "Fraunces"');
    await document.fonts.load('italic 500 140px "Fraunces"');
    await document.fonts.load('400 20px "Geist Mono"');
  } catch { /* fall back */ }
  const W = 1080, H = 1350;
  const ctx = c.getContext('2d');
  const drawBase = () => {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#F6F1E5';
    ctx.fillRect(0, 0, W, H);
    grain(ctx, W, H);
    ctx.strokeStyle = 'rgba(22,19,14,.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(88, 150); ctx.lineTo(992, 150); ctx.stroke();
    ctx.fillStyle = 'rgba(22,19,14,.72)';
    ctx.font = '400 20px "Geist Mono", monospace';
    spacedText(ctx, 'CRAF — BÀN VẼ SỐ 01', 88, 112, 2.6);
    ctx.textAlign = 'right';
    ctx.fillText('19 · 11 · 2026', 992, 112);
    ctx.textAlign = 'left';
    ctx.strokeStyle = 'rgba(22,19,14,.26)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.arc(846, 536, 352, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle = '#FF4D24';
    ctx.beginPath(); ctx.arc(846, 536, 300, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#F6F1E5';
    ctx.beginPath(); ctx.arc(846, 536, 62, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#16130E';
    ctx.font = '400 34px "Geist Mono", monospace';
    ctx.textAlign = 'center';
    ctx.fillText('01', 846, 548);
    ctx.textAlign = 'left';
    ctx.fillStyle = '#16130E';
    ctx.font = '500 140px "Fraunces", Georgia, serif';
    ctx.fillText('Vẽ ra thứ', 88, 1078);
    ctx.fillStyle = '#FF4D24';
    ctx.font = 'italic 500 140px "Fraunces", Georgia, serif';
    ctx.fillText('đáng để giữ.', 88, 1216);
    ctx.strokeStyle = 'rgba(22,19,14,.18)';
    ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(88, 1268); ctx.lineTo(992, 1268); ctx.stroke();
    ctx.fillStyle = 'rgba(22,19,14,.62)';
    ctx.font = '400 18px "Geist Mono", monospace';
    ctx.fillText('POSTER · 1080 × 1350', 88, 1308);
    ctx.textAlign = 'right';
    ctx.fillText('NOTT READY', 992, 1308);
    ctx.textAlign = 'left';
    ctx.save();
    ctx.translate(54, 880);
    ctx.rotate(-Math.PI / 2);
    ctx.fillStyle = 'rgba(22,19,14,.42)';
    ctx.font = '400 15px "Geist Mono", monospace';
    spacedText(ctx, 'BÀN VẼ CỤC BỘ — CRAF 01', 0, 0, 1.8);
    ctx.restore();
    ctx.strokeStyle = 'rgba(22,19,14,.3)';
    ctx.lineWidth = 1.5;
    [[40, 40, 1, 1], [1040, 40, -1, 1], [40, 1310, 1, -1], [1040, 1310, -1, -1]].forEach(([x, y, sx, sy]) => {
      ctx.beginPath();
      ctx.moveTo(x + 20 * sx, y); ctx.lineTo(x, y); ctx.lineTo(x, y + 20 * sy);
      ctx.stroke();
    });
  };
  drawBase();
  const path = bezierPoints({ x: 92, y: 826 }, { x: 330, y: 676 }, { x: 650, y: 930 }, { x: 1000, y: 744 });
  const widthAt = (t) => 6 + 26 * Math.pow(Math.sin(Math.PI * Math.min(1, t * 1.06)), 0.62);
  const t0 = performance.now();
  const dur = 1100;
  const step = () => {
    if (run !== heroRun) return;
    const k = Math.min(1, (performance.now() - t0) / dur);
    const eased = 1 - Math.pow(1 - k, 3);
    drawBase();
    inkRibbon(ctx, path, widthAt, '#16130E', Math.max(0.01, eased));
    if (k < 1) requestAnimationFrame(step);
    else inkRibbon(ctx, path, widthAt, '#16130E', 1);
  };
  step();
}
