/**
 * Panel màu: bảng swatch Craf, ô HSL, hex, màu trước/sau (P5-3).
 *
 * Chỉ ghi `state.color` / `state.bgColor` (trạng thái app, không phải doc) và
 * đồng bộ DOM. Không import `tools`, không đụng điểm ảnh.
 */
import { $, $$ } from '../platform/index.js';
import { clamp } from '../shared/index.js';
import { CRAF_SWATCHES, state } from '../model/index.js';
import { hexToHsl, hexToRgb, hslToHex, rgbToHsl } from '../core/index.js';
import { toast } from './feedback.js';

export function renderPalette() {
  const box = $('#swatches');
  if (!box) return;
  box.innerHTML = CRAF_SWATCHES.map((hex) => `<button class="swatch" type="button" data-hex="${hex}" title="${hex}" style="background:${hex}"></button>`).join('');
  $$('.swatch', box).forEach((el) => el.addEventListener('click', () => setColor(el.dataset.hex)));
  markSwatches();
}

export function markSwatches() {
  const cur = state.color.toUpperCase();
  $$('.swatch').forEach((el) => el.classList.toggle('active', (el.dataset.hex || '').toUpperCase() === cur));
}

export function setBgColor(hex) {
  const clean = '#' + String(hex).replace('#', '').slice(0, 6).toUpperCase();
  state.bgColor = clean;
  const el = $('#bgSwatch');
  if (el) el.style.background = clean;
}

export function swapColors() {
  const prev = state.bgColor;
  setBgColor(state.color);
  setColor(prev);
  toast('Đổi màu trước / sau', 'ok', 1200);
}

export function resetColors() {
  setColor('#16130E');
  setBgColor('#FDFAF3');
}

export function setColor(hex, fromPicker = false) {
  const clean = '#' + String(hex).replace('#', '').slice(0, 6).toUpperCase();
  state.color = clean;
  const { h, s, l } = hexToHsl(clean);
  if (!fromPicker) {
    $('#hue').value = String(Math.round(h));
    $('#sat').value = String(Math.round(s));
    $('#lig').value = String(Math.round(l));
    $('#hueVal').textContent = String(Math.round(h));
    $('#satVal').textContent = String(Math.round(s));
    $('#ligVal').textContent = String(Math.round(l));
    setFill($('#hue'), h / 3.6);
    setFill($('#sat'), s);
    setFill($('#lig'), l);
  }
  const rgb = hexToRgb(clean);
  const hsl = `hsl(${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%)`;
  $('#hexInput').value = clean.slice(1);
  $('#bigSwatch').style.background = clean;
  $('#inkwellDot').style.background = clean;
  $('#sizeDot').style.background = clean;
  $('#sizePreview').style.background = rgbToHsl(rgb.r, rgb.g, rgb.b).l > 70 ? 'rgba(10,10,11,.06)' : 'var(--desk-2)';
  $('#sat').style.setProperty('--c-hue', hsl);
  $('#lig').style.setProperty('--c-hue', hsl);
  document.documentElement.style.setProperty('--c-hue', hsl);
  markSwatches();
}

export function setFill(input, pct) {
  if (!input) return;
  input.style.setProperty('--fill', clamp(pct, 0, 100) + '%');
}

export function hslFromUI() {
  const h = parseInt($('#hue').value, 10);
  const s = parseInt($('#sat').value, 10);
  const l = parseInt($('#lig').value, 10);
  $('#hueVal').textContent = h;
  $('#satVal').textContent = s;
  $('#ligVal').textContent = l;
  setFill($('#hue'), h / 3.6);
  setFill($('#sat'), s);
  setFill($('#lig'), l);
  setColor(hslToHex(h, s, l), true);
}
