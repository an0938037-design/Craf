/**
 * Bridge Path2D từ luồng lệnh của `core.segmentsToCommands` (hợp đồng
 * docs/contracts/mask.md §4.4). Không biết gì về mask/selection — chỉ là
 * cầu nối API canvas.
 */

/**
 * Dựng `Path2D` từ `PathCommands` (flat [op,x,y,...]):
 * op 0 → moveTo (đóng subpath trước nếu đang mở); op 1 → lineTo; op 2 → closePath.
 * @param {Int32Array} cmds Kết quả `core.segmentsToCommands`.
 * @returns {Path2D}
 */
export function pathFromCommands(cmds) {
  const p = new Path2D();
  let open = false;
  for (let i = 0; i < cmds.length; i += 3) {
    const op = cmds[i];
    if (op === 0) {
      if (open) p.closePath();
      p.moveTo(cmds[i + 1], cmds[i + 2]);
      open = true;
    } else if (op === 1) {
      p.lineTo(cmds[i + 1], cmds[i + 2]);
      open = true;
    } else if (op === 2) {
      p.closePath();
      open = false;
    }
  }
  return p;
}
