/**
 * Hộp thoại size / transform / stroke / màu nền canvas (P5-7).
 *
 * Chỉ mở-đóng và đọc/ghi form. Việc áp dụng (resize, xoay lớp, viền vùng chọn)
 * cần pixel + history nên nằm ở phía gọi, được **tiêm** qua `configure`.
 */
import { $ } from '../platform/index.js';

let deps = {
  getState: () => ({}),
  finishAdjust: () => {},
  toast: () => {},
  pushDocHistory: () => {},
  render: () => {},
  markDirty: () => {},
};

/**
 * @param {{
 *   getState?: () => object,
 *   finishAdjust?: () => void,
 *   toast?: (msg:string, kind?:string, ms?:number) => void,
 *   pushDocHistory?: () => void,
 *   render?: () => void,
 *   markDirty?: () => void,
 * }} d
 */
export function configure(d = {}) {
  deps = { ...deps, ...d };
}

/* ------------------------------------------------------------------ stroke */

export function openStrokeModal() {
  if (!deps.getState().doc) return;
  if (!deps.getState().sel.active) { deps.toast('Tạo một vùng chọn trước đã', 'warn'); return; }
  deps.finishAdjust();
  $('#strokeWidth').value = '4';
  $('#strokeAlign').value = 'center';
  $('#strokeColor').value = 'fg';
  $('#strokeModal').hidden = false;
  $('#strokeWidth').focus();
  $('#strokeWidth').select();
}

export function closeStrokeModal() { $('#strokeModal').hidden = true; }

/* ------------------------------------------------------------------ doc bg */

let docBgPushed = false;

export function openDocBgPicker() {
  if (!deps.getState().doc) return;
  deps.finishAdjust();
  docBgPushed = false;
  const p = $('#docBgPicker');
  p.value = deps.getState().doc.bg || '#FDFAF3';
  p.click();
}

export function previewDocBg(hex) {
  if (!deps.getState().doc) return;
  if (!docBgPushed) { deps.pushDocHistory(); docBgPushed = true; }
  deps.getState().doc.bg = hex;
  deps.render();
  deps.markDirty();
}

export function commitDocBg() {
  if (!docBgPushed) return false;
  docBgPushed = false;
  return true;
}

/* ------------------------------------------------------------------ size */

let sizeMode = 'image';
let sizeRatio = 0.8;

export function openSizeModal(mode) {
  sizeMode = mode;
  const doc = deps.getState().doc;
  const startW = mode === 'new' ? 1080 : doc.w;
  const startH = mode === 'new' ? 1350 : doc.h;
  sizeRatio = startW / startH;
  $('#sizeW').value = String(startW);
  $('#sizeH').value = String(startH);
  $('#sizeKeepRow').hidden = mode === 'canvas';
  $('#sizeAnchorRow').hidden = mode !== 'canvas';
  if (mode === 'new') {
    $('#sizeTitle').textContent = 'Bản vẽ mới';
    $('#sizeNote').textContent = 'Mở một tờ giấy trắng với kích thước bạn muốn. Bản vẽ đang mở sẽ được lưu trước.';
    $('#btnSizeApply').textContent = 'Mở bản vẽ';
  } else if (mode === 'image') {
    $('#sizeTitle').textContent = 'Kích thước ảnh';
    $('#sizeNote').textContent = 'Phóng to hoặc thu nhỏ toàn bộ nội dung. Các lớp được lấy mẫu lại theo kích thước mới.';
    $('#btnSizeApply').textContent = 'Đổi kích thước';
  } else {
    $('#sizeTitle').textContent = 'Kích thước canvas';
    $('#sizeNote').textContent = 'Mở rộng hoặc thu hẹp khung giấy, giữ nguyên độ lớn của nội dung. Chọn điểm neo để đặt nội dung.';
    $('#btnSizeApply').textContent = 'Đổi canvas';
  }
  $('#sizeModal').hidden = false;
  $('#sizeW').focus();
  $('#sizeW').select();
}

export function closeSizeModal() { $('#sizeModal').hidden = true; }

/** `{ mode, ratio }` cho logic giữ tỉ lệ ở `bind()`. */
export function sizeState() {
  return { mode: sizeMode, ratio: sizeRatio };
}

/* ------------------------------------------------------------------ transform */

export function openTransformModal() {
  if (!deps.getState().doc) return;
  deps.finishAdjust();
  $('#tfScaleX').value = '100';
  $('#tfScaleY').value = '100';
  $('#tfAngle').value = '0';
  $('#tfFlipH').checked = false;
  $('#tfFlipV').checked = false;
  $('#transformModal').hidden = false;
  $('#tfScaleX').focus();
  $('#tfScaleX').select();
}

export function closeTransformModal() { $('#transformModal').hidden = true; }
