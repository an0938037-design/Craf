/**
 * Panel chỉnh màu: đồng bộ giá trị từ `state.adjust` xuống các ô nhập (P5-3).
 *
 * Chỉ đọc state và ghi DOM. Việc dựng preview/áp dụng nằm ở phía gọi vì cần
 * pixel + history.
 */
import { $ } from '../platform/index.js';
import { state } from '../model/index.js';
import { setFill } from './inspector.js';

/** Giá trị mặc định của bộ điều chỉnh. */
export function adjustDefaults() {
  return { bright: 0, contrast: 0, saturate: 100, hue: 0, blur: 0, black: 0, white: 255, gamma: 100, gray: false, sepia: false, invert: false };
}

export function syncAdjustUI() {
  const v = state.adjust ? state.adjust.vals : adjustDefaults();
  $('#adjBright').value = String(v.bright);
  $('#adjContrast').value = String(v.contrast);
  $('#adjSaturate').value = String(v.saturate);
  $('#adjHue').value = String(v.hue);
  $('#adjBlur').value = String(v.blur);
  $('#adjBlack').value = String(v.black);
  $('#adjWhite').value = String(v.white);
  $('#adjGamma').value = String(v.gamma);
  $('#adjBrightVal').textContent = String(v.bright);
  $('#adjContrastVal').textContent = String(v.contrast);
  $('#adjSaturateVal').textContent = String(v.saturate);
  $('#adjHueVal').textContent = String(v.hue);
  $('#adjBlurVal').textContent = String(v.blur);
  $('#adjBlackVal').textContent = String(v.black);
  $('#adjWhiteVal').textContent = String(v.white);
  $('#adjGammaVal').textContent = (v.gamma / 100).toFixed(2);
  setFill($('#adjBright'), (v.bright + 100) / 2);
  setFill($('#adjContrast'), (v.contrast + 100) / 2);
  setFill($('#adjSaturate'), v.saturate / 2);
  setFill($('#adjHue'), v.hue / 3.6);
  setFill($('#adjBlur'), (v.blur / 24) * 100);
  setFill($('#adjBlack'), (v.black / 254) * 100);
  setFill($('#adjWhite'), ((v.white - 1) / 254) * 100);
  setFill($('#adjGamma'), ((v.gamma - 10) / 290) * 100);
  const hint = $('#adjLevelsHint');
  if (hint) hint.textContent = `${v.black} · ${v.white} · ${(v.gamma / 100).toFixed(2)}`;
  $('#adjGray').checked = !!v.gray;
  $('#adjSepia').checked = !!v.sepia;
  $('#adjInvert').checked = !!v.invert;
  const scope = $('#adjustScope');
  if (scope) scope.textContent = state.sel.active ? 'trong vùng chọn' : 'toàn lớp';
}
