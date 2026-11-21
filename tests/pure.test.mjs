/**
 * Test cho các module thuần (không DOM): core + shared + serialize.
 *
 * Chạy: `npm test` hoặc `node --test "tests/*.test.mjs"`. Không cần cài gì, không build.
 * Không import `shell`, `ui`, `render`, `pixel`, `platform` vì chúng cần DOM.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import {
  hexToRgb, rgbToHex, rgbToHsl, hslToRgb, hslToHex, hexToHsl,
  bezierPoints, previewGeometry, shapeGeometry,
  maskCreate, maskAll, maskFromRect, maskBounds, maskPick, maskMerge, maskInvert, maskShiftInt,
  maskSegments, segmentsToCommands,
} from '../app/src/core/index.js';
import { clamp, pad, esc, fmt, uid } from '../app/src/shared/index.js';
import { toPayload, docSnapshot, docFromJSON, layerFromJSON, DEFAULT_BG } from '../app/src/model/serialize.js';

/* ------------------------------------------------------------------ color */

test('hexToRgb đọc hex 6 và 3 ký tự', () => {
  assert.deepEqual(hexToRgb('#FF4D24'), { r: 255, g: 77, b: 36 });
  assert.deepEqual(hexToRgb('abc'), { r: 170, g: 187, b: 204 });
  assert.deepEqual(hexToRgb(''), { r: 0, g: 0, b: 0 });
});

test('rgbToHex clamp và làm tròn', () => {
  assert.equal(rgbToHex(255, 77, 36), '#FF4D24');
  assert.equal(rgbToHex(300, -5, 12.6), '#FF000D');
});

test('rgbToHsl khớp màu nhận diện', () => {
  const c = rgbToHsl(255, 77, 36);
  assert.ok(Math.abs(c.h - 11.23) < 0.6, `h=${c.h}`);
  assert.ok(c.s > 99, `s=${c.s}`);
  assert.ok(Math.abs(c.l - 57.06) < 0.2, `l=${c.l}`);
});

test('rgb ↔ hsl round-trip sai số <= 1', () => {
  for (const rgb of [[255, 77, 36], [10, 10, 11], [253, 250, 243], [0, 128, 255]]) {
    const hsl = rgbToHsl(...rgb);
    const back = hslToRgb(hsl.h, hsl.s, hsl.l);
    for (let i = 0; i < 3; i++) assert.ok(Math.abs(back[['r', 'g', 'b'][i]] - rgb[i]) <= 1);
  }
});

test('hslToHex các mốc đen/trắng và hexToHsl đảo', () => {
  assert.equal(hslToHex(0, 0, 0), '#000000');
  assert.equal(hslToHex(0, 0, 100), '#FFFFFF');
  const hsl = hexToHsl('#FF4D24');
  assert.ok(Math.abs(hsl.h - 11.23) < 0.6);
});

/* ------------------------------------------------------------------ shared */

test('clamp và pad', () => {
  assert.equal(clamp(5, 0, 3), 3);
  assert.equal(clamp(-2, 0, 3), 0);
  assert.equal(clamp(2, 0, 3), 2);
  assert.equal(pad(3), '03');
  assert.equal(pad(12), '12');
});

test('esc thoát ký tự HTML', () => {
  assert.equal(esc('<a href="x">&</a>'), '&lt;a href=&quot;x&quot;&gt;&amp;&lt;/a&gt;');
  assert.equal(esc(null), '');
});

test('fmt nhóm nghìn kiểu Việt Nam', () => {
  assert.equal(fmt(1234567), '1.234.567');
  assert.equal(fmt(999.6), '1.000');
});

test('uid có tiền tố và không trùng', () => {
  const a = uid();
  const b = uid();
  assert.match(a, /^craf-/);
  assert.notEqual(a, b);
});

/* ------------------------------------------------------------------ geometry */

test('bezierPoints trả count+1 điểm, đúng hai đầu', () => {
  const p0 = { x: 0, y: 0 };
  const p3 = { x: 90, y: 30 };
  const pts = bezierPoints(p0, { x: 30, y: 0 }, { x: 60, y: 30 }, p3, 12);
  assert.equal(pts.length, 13);
  assert.deepEqual(pts[0], p0);
  assert.ok(Math.abs(pts[12].x - p3.x) < 1e-9);
  assert.ok(Math.abs(pts[12].y - p3.y) < 1e-9);
});

test('previewGeometry: thường, shift vuông, alt lấy tâm', () => {
  const base = { start: { x: 10, y: 10 }, current: { x: 30, y: 50 }, shift: false, alt: false };
  assert.deepEqual(previewGeometry(base), { x: 10, y: 10, w: 20, h: 40 });
  assert.deepEqual(previewGeometry({ ...base, shift: true }), { x: 10, y: 10, w: 40, h: 40 });
  assert.deepEqual(previewGeometry({ ...base, alt: true }), { x: -10, y: -30, w: 40, h: 80 });
});

test('shapeGeometry: shift vuông cho rect, snap 45° cho line', () => {
  const rect = shapeGeometry({ start: { x: 10, y: 10 }, current: { x: 30, y: 50 }, shift: true, alt: false }, 'rect');
  assert.deepEqual(rect, { x0: 10, y0: 10, x1: 50, y1: 50 });
  const line = shapeGeometry({ start: { x: 0, y: 0 }, current: { x: 100, y: 20 }, shift: true, alt: false }, 'line');
  assert.ok(Math.abs(line.y1) < 1e-9, `y1=${line.y1}`);
  assert.ok(Math.abs(line.x1 - Math.hypot(100, 20)) < 1e-9);
});

/* ------------------------------------------------------------------ mask */

test('maskCreate/maskAll', () => {
  assert.equal(maskCreate(4, 3).length, 12);
  assert.ok(maskCreate(4, 3).every((v) => v === 0));
  assert.ok(maskAll(4, 3).every((v) => v === 255));
  assert.ok(maskAll(2, 2, 7).every((v) => v === 7));
});

test('maskFromRect clip vào khung và bỏ qua w/h < 1', () => {
  const m = maskFromRect(2, 2, 3, 3, 10, 10);
  assert.deepEqual(maskBounds(m, 10, 10), { x: 2, y: 2, w: 3, h: 3 });
  assert.equal(m.reduce((s, v) => s + (v ? 1 : 0), 0), 9);

  const clipped = maskFromRect(-2, -2, 10, 10, 6, 6);
  assert.deepEqual(maskBounds(clipped, 6, 6), { x: 0, y: 0, w: 6, h: 6 });

  assert.equal(maskFromRect(1, 1, 0, 5, 6, 6).some((v) => v), false);
  assert.equal(maskFromRect(1, 1, 5, -1, 6, 6).some((v) => v), false);
});

test('maskBounds ngưỡng > 127, rỗng → null', () => {
  const m = maskCreate(4, 4);
  assert.equal(maskBounds(m, 4, 4), null);
  m[5] = 127;
  assert.equal(maskBounds(m, 4, 4), null);
  m[5] = 128;
  assert.deepEqual(maskBounds(m, 4, 4), { x: 1, y: 1, w: 1, h: 1 });
});

test('maskPick trong/ngoài khung', () => {
  const m = maskAll(4, 4);
  assert.equal(maskPick(m, 4, 4, 0, 0), true);
  assert.equal(maskPick(m, 4, 4, 3, 3), true);
  assert.equal(maskPick(m, 4, 4, 4, 0), false);
  assert.equal(maskPick(m, 4, 4, -1, 0), false);
});

test('maskMerge 4 chế độ theo công thức hợp đồng', () => {
  const a = Uint8Array.from([255, 128, 200, 0]);
  const b = Uint8Array.from([255, 128, 100, 255]);
  assert.deepEqual([...maskMerge(a, b, 4, 1, 'replace')], [255, 128, 100, 255]);
  assert.deepEqual([...maskMerge(a, b, 4, 1, 'add')], [255, 192, 222, 255]);
  assert.deepEqual([...maskMerge(a, b, 4, 1, 'subtract')], [0, 64, 122, 0]);
  assert.deepEqual([...maskMerge(a, b, 4, 1, 'intersect')], [255, 64, 78, 0]);
  assert.throws(() => maskMerge(a, b, 4, 1, 'xor'), /mode không hợp lệ/);
});

test('maskMerge không mutate input', () => {
  const a = Uint8Array.from([255, 0]);
  const b = Uint8Array.from([0, 255]);
  maskMerge(a, b, 2, 1, 'add');
  assert.deepEqual([...a], [255, 0]);
  assert.deepEqual([...b], [0, 255]);
});

test('maskInvert và maskShiftInt', () => {
  assert.deepEqual([...maskInvert(Uint8Array.from([0, 30, 255]), 3, 1)], [255, 225, 0]);
  const m = Uint8Array.from([255, 0, 0, 0]);
  assert.deepEqual([...maskShiftInt(m, 2, 2, 1, 0)], [0, 255, 0, 0]);
  assert.deepEqual([...maskShiftInt(m, 2, 2, -1, 0)], [0, 0, 0, 0]);
  assert.deepEqual([...maskShiftInt(m, 2, 2, 0, 1)], [0, 0, 255, 0]);
});

/* ------------------------------------------------------------------ path */

test('maskSegments 1 px → 4 cạnh, mỗi cạnh 4 số', () => {
  const segs = maskSegments(Uint8Array.from([255]), 1, 1);
  assert.equal(segs.length, 16);
  assert.ok(segs instanceof Int32Array);
});

test('segmentsToCommands tạo M/L/Z khép kín', () => {
  const segs = maskSegments(Uint8Array.from([255]), 1, 1);
  const cmds = segmentsToCommands(segs);
  assert.ok(cmds instanceof Int32Array);
  assert.equal(cmds[0], 0); // M
  assert.equal(cmds[cmds.length - 3], 2); // Z
  const ops = [];
  for (let i = 0; i < cmds.length; i += 3) ops.push(cmds[i]);
  assert.equal(ops.filter((op) => op === 0).length, 1);
  assert.equal(ops[ops.length - 1], 2);
  for (let i = 0; i < cmds.length; i += 3) {
    assert.ok(cmds[i + 1] >= 0 && cmds[i + 1] <= 1);
    assert.ok(cmds[i + 2] >= 0 && cmds[i + 2] <= 1);
  }
});

test('mask rỗng → 0 cạnh, 0 lệnh', () => {
  const segs = maskSegments(maskCreate(4, 4), 4, 4);
  assert.equal(segs.length, 0);
  assert.equal(segmentsToCommands(segs).length, 0);
});

/* ------------------------------------------------------------------ serialize */

function demoDoc() {
  return {
    id: 'craf-test', name: 'Bản thử', w: 100, h: 80, bg: '#FFFFFF', createdAt: 123,
    layers: [
      { name: 'Lớp 1', visible: true, opacity: 100, blend: 'source-over' },
      { name: 'Lớp 2', visible: false, opacity: 40, blend: 'multiply' },
    ],
  };
}

test('toPayload giữ đủ field và gọi layerSrc', () => {
  const doc = demoDoc();
  const srcs = [];
  const p = toPayload(doc, (l) => { srcs.push(l.name); return 'data:png;' + l.name; }, 'data:jpg;thumb');
  assert.equal(p.id, 'craf-test');
  assert.equal(p.name, 'Bản thử');
  assert.equal(p.w, 100);
  assert.equal(p.h, 80);
  assert.equal(p.bg, '#FFFFFF');
  assert.equal(p.createdAt, 123);
  assert.equal(p.thumb, 'data:jpg;thumb');
  assert.deepEqual(srcs, ['Lớp 1', 'Lớp 2']);
  assert.deepEqual(Object.keys(p.layers[0]).sort(), ['blend', 'name', 'opacity', 'src', 'visible']);
  assert.equal(p.layers[1].src, 'data:png;Lớp 2');
});

test('docSnapshot gói kind=doc + active', () => {
  const snap = docSnapshot(demoDoc(), 1, (l) => 'src:' + l.name);
  assert.equal(snap.kind, 'doc');
  assert.equal(snap.active, 1);
  assert.equal(snap.w, 100);
  assert.equal(snap.layers.length, 2);
  assert.equal(snap.layers[0].src, 'src:Lớp 1');
  assert.equal(snap.layers[1].opacity, 40);
});

test('docFromJSON mặc định bg/createdAt/layers', () => {
  const d = docFromJSON({ id: 'x', name: 'n', w: 10, h: 20, layers: [{}, {}] });
  assert.equal(d.bg, DEFAULT_BG);
  assert.equal(typeof d.createdAt, 'number');
  assert.deepEqual(d.layers, []);
  assert.equal(d.active, 1);
  const empty = docFromJSON({ id: 'y', name: 'm', w: 1, h: 1 });
  assert.equal(empty.active, -1);
});

test('layerFromJSON chuẩn hoá giá trị thiếu/sai', () => {
  assert.deepEqual(layerFromJSON({ name: 'A' }), {
    name: 'A', visible: true, opacity: 100, blend: 'source-over', src: null,
  });
  const l = layerFromJSON({ name: 'B', visible: false, opacity: 150, blend: 'screen', src: 'x' });
  assert.equal(l.visible, false);
  assert.equal(l.opacity, 100);
  assert.equal(l.blend, 'screen');
  assert.equal(l.src, 'x');
  assert.equal(layerFromJSON({ name: 'C', opacity: -5 }).opacity, 0);
});
