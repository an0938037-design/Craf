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
import { createEmitter } from '../app/src/shared/emitter.js';
import {
  state, clearHistory, dropTagged, pushDoc, pushLayer, canUndo, canRedo, HISTORY_LIMITS,
  sheetSize, uniqueProjectName, layerMeta, activeLayer, newDocData, activate,
} from '../app/src/model/index.js';
import { selection } from '../app/src/model/index.js';
import { get, set, subscribe, emit } from '../app/src/model/index.js';
import { adjustFilter } from '../app/src/pixel/index.js';
import { niceStep } from '../app/src/render/rulers.js';
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

/* ------------------------------------------------------------------ emitter */

test('emitter: on/emit/off/clear', () => {
  const bus = createEmitter();
  const got = [];
  const off = bus.on('paint', (p) => got.push(p));
  bus.emit('paint', 1);
  bus.emit('other', 9);
  assert.deepEqual(got, [1]);
  off();
  bus.emit('paint', 2);
  assert.deepEqual(got, [1]);

  const a = [];
  bus.on('x', () => a.push('a'));
  bus.on('x', () => a.push('b'));
  bus.emit('x');
  assert.deepEqual(a, ['a', 'b']);
  bus.clear('x');
  bus.emit('x');
  assert.deepEqual(a, ['a', 'b']);

  bus.on('y', () => a.push('y'));
  bus.clear();
  bus.emit('y');
  assert.deepEqual(a, ['a', 'b']);
});

test('emitter: off hàm lạ và emit channel rỗng không lỗi', () => {
  const bus = createEmitter();
  assert.doesNotThrow(() => bus.off('none', () => {}));
  assert.doesNotThrow(() => bus.emit('none'));
});

/* ------------------------------------------------------------------ history */

test('history: push/clear/canUndo/canRedo', () => {
  clearHistory();
  assert.equal(canUndo(), false);
  assert.equal(canRedo(), false);
  pushDoc({ kind: 'doc' });
  assert.equal(canUndo(), true);
  state.redo.push({ kind: 'doc' });
  assert.equal(canRedo(), true);
  clearHistory();
  assert.equal(canUndo(), false);
  assert.equal(canRedo(), false);
});

test('history: trần doc và layer, entry mới xoá redo', () => {
  clearHistory();
  for (let i = 0; i < HISTORY_LIMITS.doc + 5; i++) pushDoc({ kind: 'doc', n: i });
  assert.equal(state.undo.length, HISTORY_LIMITS.doc);
  assert.equal(state.undo[0].n, 5);
  assert.equal(state.undo[state.undo.length - 1].n, HISTORY_LIMITS.doc + 4);

  clearHistory();
  for (let i = 0; i < HISTORY_LIMITS.layer + 3; i++) pushLayer({ kind: 'layer', id: 'l', src: 's' + i });
  assert.equal(state.undo.length, HISTORY_LIMITS.layer);
  assert.equal(state.undo[0].src, 's3');

  clearHistory();
  pushDoc({ kind: 'doc', n: 0 });
  state.redo.push({ kind: 'doc', n: 'redo' });
  pushDoc({ kind: 'doc', n: 1 });
  assert.equal(state.redo.length, 0);
});

test('history: dropTagged bỏ đúng entry của phiên adjust', () => {
  clearHistory();
  pushLayer({ kind: 'layer', id: 'a', src: 'stroke' });
  pushLayer({ kind: 'layer', id: 'a', src: 'adj-base', tag: 't1' });
  pushLayer({ kind: 'layer', id: 'b', src: 'other', tag: 't1' });
  dropTagged('a', 't1');
  assert.deepEqual(state.undo.map((e) => e.src), ['stroke', 'other']);

  /* Entry đã đi vòng sang redo (Ctrl+Z) vẫn bị bỏ đúng tag + lớp. */
  clearHistory();
  state.redo.push({ kind: 'layer', id: 'a', src: 'preview', tag: 't1' });
  state.undo.push({ kind: 'layer', id: 'a', src: 'keep' });
  dropTagged('a', 't1');
  assert.equal(state.redo.length, 0);
  assert.equal(state.undo.length, 1);
  assert.equal(state.undo[0].src, 'keep');

  /* Không tag (phiên chưa đẩy entry) → không đụng stack. */
  clearHistory();
  pushLayer({ kind: 'layer', id: 'a', src: 'keep2' });
  dropTagged('a', null);
  assert.equal(state.undo.length, 1);
  clearHistory();
});

/* ------------------------------------------------------------------ model helpers */

test('sheetSize giữ tỉ lệ trong ô 64/88', () => {
  assert.deepEqual(sheetSize({ w: 1080, h: 1350 }), { w: 64, h: 80 });
  assert.deepEqual(sheetSize({ w: 1080, h: 1920 }), { w: 64, h: 88 });
  assert.deepEqual(sheetSize({ w: 1350, h: 1080 }), { w: 80, h: 64 });
  assert.deepEqual(sheetSize({ w: 800, h: 800 }), { w: 64, h: 64 });
  const wide = sheetSize({ w: 3000, h: 1000 });
  assert.equal(wide.w, 88);
  assert.equal(wide.h, 64);
});

test('uniqueProjectName thêm số khi trùng', () => {
  const projects = [{ name: 'A' }, { name: 'A 2' }];
  assert.equal(uniqueProjectName(projects, 'B'), 'B');
  assert.equal(uniqueProjectName(projects, 'A'), 'A 3');
  assert.equal(uniqueProjectName([], 'A'), 'A');
});

test('layerMeta mặc định và id riêng', () => {
  const a = layerMeta();
  const b = layerMeta('Lớp 2');
  assert.deepEqual({ name: a.name, visible: a.visible, opacity: a.opacity, blend: a.blend }, {
    name: 'Lớp', visible: true, opacity: 100, blend: 'source-over',
  });
  assert.equal(b.name, 'Lớp 2');
  assert.notEqual(a.id, b.id);
});

test('doc: newDocData mặc định và id riêng', () => {
  const a = newDocData('A', 640, 480);
  const b = newDocData('B', 800, 800);
  assert.equal(a.name, 'A');
  assert.equal(a.w, 640);
  assert.equal(a.h, 480);
  assert.equal(a.bg, '#FDFAF3');
  assert.equal(a.active, 0);
  assert.ok(a.createdAt > 0);
  assert.notEqual(a.id, b.id);
});

test('doc: activeLayer + activate xoá phiên cũ và kẹp active', () => {
  const l1 = { id: 'l1' };
  const l2 = { id: 'l2' };
  const doc = { w: 10, h: 10, active: 1, layers: [l1, l2] };
  state.doc = null;
  assert.equal(activeLayer(), null);

  state.undo.push({ kind: 'layer' });
  state.adjust = { bright: 10 };
  state.guidesX = [4];
  selection.configure({ getDocSize: () => ({ w: 10, h: 10 }) });
  selection.apply(maskAll(10, 10), 'replace');

  activate(doc);
  assert.equal(state.doc, doc);
  assert.equal(state.active, 1);
  assert.equal(activeLayer(), l2);
  assert.equal(state.fitMode, true);
  assert.equal(state.undo.length, 0);
  assert.equal(state.redo.length, 0);
  assert.equal(state.adjust, null);
  assert.deepEqual(state.guidesX, []);
  assert.equal(selection.isActive(), false);

  activate({ ...doc, active: 99, layers: [l1] });
  assert.equal(state.active, 0);
  assert.equal(activeLayer(), l1);
});

/* ------------------------------------------------------------------ store + selection */

test('store: get/set/subscribe/emit', () => {
  const seen = [];
  const stop = subscribe((st, keys) => seen.push([keys.join(','), st.size]));
  set({ size: 44 });
  assert.equal(get('size'), 44);
  assert.deepEqual(seen.pop(), ['size', 44]);
  emit(['size']);
  assert.deepEqual(seen.pop(), ['size', 44]);
  stop();
  set({ size: 18 });
  assert.equal(seen.length, 0);
  assert.equal(get(), state);
  /* trả lại giá trị mặc định để không ảnh hưởng test khác */
  set({ size: 18 });
});

test('selection: configure + apply replace/add/subtract/intersect', () => {
  selection.configure({ getDocSize: () => ({ w: 4, h: 4 }) });
  selection.clear();
  const r1 = selection.apply(maskFromRect(1, 1, 2, 2, 4, 4), 'replace');
  assert.deepEqual(r1.bbox, { x: 1, y: 1, w: 2, h: 2 });
  assert.equal(selection.isActive(), true);
  assert.equal(selection.contains(1, 1), true);
  assert.equal(selection.contains(1.9, 2.9), true);
  assert.equal(selection.contains(0, 0), false);
  assert.equal(selection.contains(3, 3), false);

  const add = selection.apply(maskFromRect(0, 0, 1, 1, 4, 4), 'add');
  assert.deepEqual(add.bbox, { x: 0, y: 0, w: 3, h: 3 });
  assert.equal(selection.contains(0, 0), true);

  const sub = selection.apply(maskFromRect(1, 1, 1, 1, 4, 4), 'subtract');
  assert.equal(selection.contains(1, 1), false);
  assert.equal(selection.contains(1, 2), true);

  const both = selection.apply(maskAll(4, 4), 'intersect');
  assert.deepEqual(both.bbox, { x: 0, y: 0, w: 3, h: 3 });
});

test('selection: apply rỗng → null, sai cỡ → throw', () => {
  selection.configure({ getDocSize: () => ({ w: 4, h: 4 }) });
  selection.clear();
  assert.equal(selection.apply(maskCreate(4, 4), 'replace'), null);
  assert.equal(selection.isActive(), false);
  assert.throws(() => selection.apply(maskCreate(3, 3), 'replace'), /mask size mismatch/);
});

test('selection: replace/clear/contains/revision đơn điệu', () => {
  selection.configure({ getDocSize: () => ({ w: 2, h: 2 }) });
  selection.clear();
  const r0 = selection.revision();
  selection.replace({ rev: 999, w: 2, h: 2, data: maskAll(2, 2), bbox: { x: 0, y: 0, w: 2, h: 2 } });
  assert.ok(selection.revision() > r0);
  assert.equal(selection.contains(1, 1), true);
  selection.clear();
  assert.equal(selection.contains(1, 1), false);
  assert.ok(selection.revision() > r0 + 1);
  assert.equal(selection.get(), null);
});

test('presets: 4 khổ dọc/ngang hợp lệ và swatch hex', async () => {
  const { PRESETS, TEMPLATES, CRAF_SWATCHES } = await import('../app/src/model/presets.js');
  assert.equal(PRESETS.length, 4);
  assert.equal(new Set(PRESETS.map((p) => p.key)).size, 4);
  for (const p of [...PRESETS, ...TEMPLATES]) {
    assert.ok(p.w > 0 && p.h > 0 && p.name);
  }
  assert.equal(CRAF_SWATCHES.length, 16);
  for (const c of CRAF_SWATCHES) assert.match(c, /^#[0-9A-F]{6}$/);
});

/* ------------------------------------------------------------------ render/pixel helpers */

test('adjustFilter dựng chuỗi CSS đúng thứ tự', () => {
  const base = { bright: 0, contrast: 0, saturate: 100, hue: 0, blur: 0, gray: false, sepia: false, invert: false };
  assert.equal(adjustFilter(base), 'none');
  assert.equal(adjustFilter({ ...base, bright: 20, saturate: 80 }), 'brightness(120%) saturate(80%)');
  assert.equal(
    adjustFilter({ bright: 10, contrast: -5, saturate: 120, hue: -90, blur: 0.5, gray: true, sepia: true, invert: true }),
    'brightness(110%) contrast(95%) saturate(120%) hue-rotate(-90deg) blur(0.5px) grayscale(1) sepia(1) invert(1)',
  );
});

test('niceStep chọn 1/2/5 × 10^n', () => {
  assert.equal(niceStep(1), 1);
  assert.equal(niceStep(0), 1);
  assert.equal(niceStep(0.5), 1);
  assert.equal(niceStep(2), 2);
  assert.equal(niceStep(3), 5);
  assert.equal(niceStep(7), 10);
  assert.equal(niceStep(12), 20);
  assert.equal(niceStep(45), 50);
  assert.equal(niceStep(99), 100);
  assert.equal(niceStep(100), 100);
});

/* ------------------------------------------------------------------ serialize */

function demoDoc() {
  return {
    id: 'craf-test', name: 'Bản thử', w: 100, h: 80, bg: '#FFFFFF', createdAt: 123,
    layers: [
      { id: 'l1', name: 'Lớp 1', visible: true, opacity: 100, blend: 'source-over' },
      { id: 'l2', name: 'Lớp 2', visible: false, opacity: 40, blend: 'multiply' },
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
  /* Snapshot lịch sử giữ id lớp để entry mức lớp còn trỏ đúng sau khi khôi phục doc. */
  assert.deepEqual(snap.layers.map((l) => l.id), ['l1', 'l2']);
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
