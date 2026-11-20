/**
 * Đường biên mask — mảng lệnh số nguyên (`PathCommands`, op 0/1/2).
 *
 * Thuật toán chuyển nguyên từ `app/app.js:451-496`, chỉ đổi đầu ra:
 * mask canvas → `Uint8Array` alpha; segments → `Int32Array`.
 * THỨ TỰ LÀ HỢP ĐỒNG (quyết định hình học của path): quét y ngoài →
 * trên, dưới, trái, phải — cạnh trên, cạnh dưới, cạnh trái, cạnh phải.
 */

/**
 * @typedef {Int32Array} PathCommands // [op,x,y, op,x,y, ...]; op: 0=M (đóng subpath trước), 1=L, 2=Z
 */

/**
 * Quét mask vùng chọn thành các cạnh biên (threshold > 127).
 * Thứ tự cạnh: cạnh trên `[x+1,y,x,y]`, cạnh dưới `[x,y+1,x+1,y+1]`,
 * cạnh trái `[x,y,x,y+1]`, cạnh phải `[x+1,y+1,x+1,y]`.
 * @param {Uint8Array} data `MaskAlpha` (1 byte/px, row-major, doc px).
 * @param {number} w Rộng doc px.
 * @param {number} h Cao doc px.
 * @param {number} [threshold=127]
 * @returns {Int32Array} Flat `[x0,y0,x1,y1, ...]`.
 */
export function maskSegments(data, w, h, threshold = 127) {
  const inside = (x, y) => x >= 0 && y >= 0 && x < w && y < h && data[y * w + x] > threshold;
  const segs = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!inside(x, y)) continue;
      if (!inside(x, y - 1)) segs.push(x + 1, y, x, y);
      if (!inside(x, y + 1)) segs.push(x, y + 1, x + 1, y + 1);
      if (!inside(x - 1, y)) segs.push(x, y, x, y + 1);
      if (!inside(x + 1, y)) segs.push(x + 1, y + 1, x + 1, y);
    }
  }
  return new Int32Array(segs);
}

/**
 * Chuyển các cạnh → luồng lệnh (`PathCommands`: op 0=M, 1=L, 2=Z).
 * Y hệt `pathFromSegments` app.js:468-496: điều hướng liên kết theo đầu cạnh,
 * `closePath` (op 2) sau mỗi subpath; không có Path2D ở đây.
 * @param {Int32Array} segs Kết quả `maskSegments` (flat [x0,y0,x1,y1,...]).
 * @returns {PathCommands}
 */
export function segmentsToCommands(segs) {
  const key = (x, y) => x + ',' + y;
  const starts = new Map();
  for (let i = 0; i < segs.length; i += 4) {
    const k = key(segs[i], segs[i + 1]);
    if (!starts.has(k)) starts.set(k, []);
    starts.get(k).push(i);
  }
  const used = new Uint8Array(segs.length / 4);
  const cmds = [];
  for (let i = 0; i < segs.length; i += 4) {
    if (used[i / 4]) continue;
    cmds.push(0, segs[i], segs[i + 1]);
    let cur = i;
    let guard = 0;
    while (cur != null && guard++ < segs.length + 8) {
      used[cur / 4] = 1;
      const x1 = segs[cur + 2], y1 = segs[cur + 3];
      cmds.push(1, x1, y1);
      if (x1 === segs[i] && y1 === segs[i + 1]) break;
      const list = starts.get(key(x1, y1));
      let next = null;
      if (list) for (const j of list) if (!used[j / 4]) { next = j; break; }
      cur = next;
    }
    cmds.push(2, segs[i], segs[i + 1]);
  }
  return new Int32Array(cmds);
}
