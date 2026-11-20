/**
 * Menubar + chuyển pane của panel phải (P5-4).
 *
 * Không biết command nào tồn tại: `bindMenubar` nhận `runCommand` do `shell`
 * tiêm, còn pane "adjust" gọi `onAdjust` để phía gọi tự `ensureAdjust`.
 */
import { $, $$ } from '../platform/index.js';

export function closeMenus() {
  $$('.menu.open').forEach((m) => {
    m.classList.remove('open');
    const b = m.querySelector('.menu-btn');
    if (b) b.setAttribute('aria-expanded', 'false');
  });
}

export function openMenu(m) {
  closeMenus();
  if (!m) return;
  m.classList.add('open');
  const b = m.querySelector('.menu-btn');
  if (b) b.setAttribute('aria-expanded', 'true');
}

/**
 * @param {(cmd:string) => void} runCommand
 */
export function bindMenubar(runCommand) {
  const bar = $('#menubar');
  bar.addEventListener('click', (e) => {
    const btn = e.target.closest('.menu-btn');
    if (btn) {
      const menu = btn.parentElement;
      if (menu.classList.contains('open')) closeMenus();
      else openMenu(menu);
      return;
    }
    const cmd = e.target.closest('[data-cmd]');
    if (!cmd) return;
    closeMenus();
    runCommand(cmd.dataset.cmd);
  });
  $$('.menu').forEach((m) => {
    m.addEventListener('pointerenter', () => {
      if ($('.menu.open') && !m.classList.contains('open')) openMenu(m);
    });
  });
  document.addEventListener('pointerdown', (e) => {
    if (!e.target || typeof e.target.closest !== 'function' || !e.target.closest('#menubar')) closeMenus();
  });
}

/**
 * @param {string} name color|adjust|layers
 * @param {{ onAdjust?: () => void, onMobile?: () => void }} [hooks]
 */
export function openPane(name, hooks = {}) {
  $$('.ins-tab').forEach((t) => t.classList.toggle('active', t.dataset.pane === name));
  $('#paneColor').hidden = name !== 'color';
  $('#paneAdjust').hidden = name !== 'adjust';
  $('#paneLayers').hidden = name !== 'layers';
  if (name === 'adjust' && hooks.onAdjust) hooks.onAdjust();
  if (window.matchMedia('(max-width: 760px)').matches && hooks.onMobile) hooks.onMobile();
}
