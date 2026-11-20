/**
 * Màn hình bắt đầu: khổ giấy, bản vẽ gần đây, mẫu, và thẻ Nott (P5).
 *
 * Section `ui` chỉ được **đọc** model, nên mọi hành động (tạo/mở dự án, dựng
 * mẫu, hút màu, nhập ảnh Nott) đều được **tiêm** từ `app.js`/`shell`. Nhờ vậy
 * khối này không import `tools` và không mutate `doc`.
 */
import { $, $$ } from '../platform/index.js';
import { clamp, esc } from '../shared/index.js';
import { PRESETS, TEMPLATES, sheetSize } from '../model/index.js';

let deps = {
  getState: () => ({}),
  createProject: () => {},
  openProject: () => {},
  createTemplate: () => {},
  importNottImage: () => {},
  setColor: () => {},
  previewDoc: () => null,
};

/**
 * @param {{
 *   getState?: () => object,
 *   createProject?: (name:string, w:number, h:number) => void,
 *   openProject?: (id:string) => void,
 *   createTemplate?: (key:string) => void,
 *   importNottImage?: (name:string) => void,
 *   setColor?: (hex:string) => void,
 *   previewDoc?: (key:string) => object|null
 * }} d
 */
export function configure(d = {}) {
  deps = { ...deps, ...d };
}

/** Khổ giấy dựng sẵn ở màn hình bắt đầu. */
export { PRESETS, TEMPLATES };

export function renderPresets() {
  const box = $('#presets');
  if (!box) return;
  const cards = PRESETS.map((p) => {
    const s = sheetSize(p);
    return `<button class="preset" type="button" data-preset="${p.key}">
      <span class="preset-sheet" style="width:${s.w}px;height:${s.h}px"><i></i></span>
      <span class="preset-meta"><span class="preset-name">${p.name}</span><span class="preset-dim">${p.w} × ${p.h}</span></span>
    </button>`;
  }).join('');
  box.innerHTML = cards + `<button class="preset custom" type="button" id="presetCustom">
    <span class="preset-sheet" style="width:64px;height:64px"><svg class="ico"><use href="#i-plus"/></svg></span>
    <span class="preset-meta"><span class="preset-name">Khổ khác</span><span class="preset-dim">tuỳ chỉnh</span></span>
  </button>`;
  $$('.preset[data-preset]', box).forEach((el) => el.addEventListener('click', () => {
    const p = PRESETS.find((x) => x.key === el.dataset.preset);
    if (p) deps.createProject(p.name, p.w, p.h);
  }));
  $('#presetCustom').addEventListener('click', openCustomPreset);
}

export function openCustomPreset() {
  const card = $('#presetCustom');
  if (!card) return;
  card.outerHTML = `<div class="preset custom" id="presetCustomForm">
    <span class="preset-sheet" style="width:64px;height:64px"><svg class="ico"><use href="#i-crop"/></svg></span>
    <div class="preset-custom-form">
      <input id="customW" value="1080" inputmode="numeric" aria-label="Rộng" />
      <span>×</span>
      <input id="customH" value="1350" inputmode="numeric" aria-label="Cao" />
      <button class="btn primary sm" id="customGo" type="button">Mở</button>
    </div>
  </div>`;
  const go = () => {
    const w = clamp(parseInt($('#customW').value, 10) || 1080, 64, 4000);
    const h = clamp(parseInt($('#customH').value, 10) || 1350, 64, 4000);
    deps.createProject(`Bản vẽ ${w}×${h}`, w, h);
  };
  $('#customGo').addEventListener('click', go);
  $$('#presetCustomForm input').forEach((inp) => inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') go(); }));
  $('#customW').focus();
  $('#customW').select();
}

export function projectCard(p) {
  return `<div class="project-card" role="button" tabindex="0" data-id="${esc(p.id)}">
    <div class="project-thumb"${p.thumb ? ` style="background-image:url('${esc(p.thumb)}?v=${p.updatedAt}')"` : ''}>
      ${p.thumb ? '' : '<svg class="ico" style="width:22px;height:22px"><use href="#i-image"/></svg>'}
      <span class="badge">${p.w} × ${p.h}</span>
    </div>
    <div class="project-info">
      <span class="project-title">${esc(p.name)}</span>
      <span class="project-sub">SỬA ${timeAgo(p.updatedAt)}</span>
    </div>
  </div>`;
}

export function timeAgo(ts) {
  const s = Math.max(1, Math.round((Date.now() - ts) / 1000));
  if (s < 60) return 'vừa xong';
  const m = Math.round(s / 60);
  if (m < 60) return m + ' phút trước';
  const h = Math.round(m / 60);
  if (h < 24) return h + ' giờ trước';
  const d = Math.round(h / 24);
  if (d < 7) return d + ' ngày trước';
  return new Date(ts).toLocaleDateString('vi-VN');
}

export function renderRecent() {
  const box = $('#recent');
  const hint = $('#recentHint');
  if (!box || !hint) return;
  const projects = deps.getState().projects || [];
  if (!projects.length) {
    hint.textContent = 'Chưa có bản vẽ nào';
    box.innerHTML = `<div class="recent-empty">
      <div class="project-sub" style="max-width:52ch;line-height:1.7">Chưa có bản vẽ nào trên máy. Mở một khổ giấy ở trên, hoặc bắt đầu từ một mẫu của Craf — mọi thứ tự lưu lại khi bạn vẽ.</div>
    </div>`;
  } else {
    hint.textContent = projects.length + ' bản vẽ';
    box.innerHTML = projects.slice(0, 8).map(projectCard).join('');
  }
  $$('.project-card', box).forEach((el) => {
    const open = () => deps.openProject(el.dataset.id);
    el.addEventListener('click', open);
    el.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); open(); } });
  });
}

export function renderTemplates() {
  const box = $('#templates');
  if (!box) return;
  box.innerHTML = TEMPLATES.map((t) => `<button class="template-card" type="button" data-template="${t.key}">
    <span class="template-preview"><canvas width="660" height="440"></canvas></span>
    <span class="template-info"><span class="template-name">${t.name}</span><span class="template-sub mono">${t.note} · ${t.w} × ${t.h}</span></span>
  </button>`).join('');
  $$('.template-card', box).forEach((el) => el.addEventListener('click', () => deps.createTemplate(el.dataset.template)));
  paintTemplatePreviews();
}

export function paintTemplatePreviews() {
  $$('.template-card').forEach((card) => {
    const doc = deps.previewDoc(card.dataset.template);
    if (!doc) return;
    const canvas = card.querySelector('canvas');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;
    const s = Math.min(W / doc.w, H / doc.h) * 0.84;
    const dw = doc.w * s, dh = doc.h * s;
    const x = (W - dw) / 2, y = (H - dh) / 2;
    ctx.clearRect(0, 0, W, H);
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.6)';
    ctx.shadowBlur = 26;
    ctx.shadowOffsetY = 12;
    ctx.fillStyle = doc.bg;
    ctx.fillRect(x, y, dw, dh);
    ctx.restore();
    ctx.save();
    ctx.beginPath(); ctx.rect(x, y, dw, dh); ctx.clip();
    ctx.translate(x, y); ctx.scale(s, s);
    for (const l of doc.layers) {
      if (!l.visible) continue;
      ctx.globalAlpha = l.opacity / 100;
      ctx.drawImage(l.canvas, 0, 0);
    }
    ctx.restore();
  });
}

export function renderNott() {
  const n = deps.getState().nott || { ok: false };
  const chip = $('#nottChip');
  if (!chip) return;
  chip.classList.toggle('on', !!n.ok);
  $('#nottMeta').textContent = n.ok ? (n.name || 'đã kết nối') : 'chưa thấy';
  $('#factNott').textContent = n.ok ? 'đã kết nối' : 'chưa thấy';
  $('#statusNott').classList.toggle('on', !!n.ok);
  $('#statusNott').innerHTML = '<i></i>' + (n.ok ? 'Nott · sẵn sàng' : 'Nott · chưa thấy');
  $('#drawerTitle').textContent = n.ok ? 'Nott' : 'Nott — chưa thấy';
  $('#drawerTitle').title = n.root || '';
  $('#nottPerson').textContent = n.ok ? (n.name || 'Người dùng Nott') : 'Không tìm thấy Nott';
  $('#nottGroup').textContent = n.ok ? (n.group || n.root) : (n.root || '');
  const initial = (n.name || 'N').trim().charAt(0).toUpperCase();
  $('#nottAvatar').textContent = initial;
  $('#connState').classList.toggle('on', !!n.ok);
  $('#connState').innerHTML = '<i></i>' + (n.ok ? 'đã kết nối' : 'mất kết nối');

  const palette = n.palette || [];
  const sw = palette.map((c) => `<button class="swatch" type="button" data-hex="${esc(c.hex)}" title="${esc(c.name)} ${esc(c.hex)}" style="background:${esc(c.hex)}"></button>`).join('');
  $('#nottSwatches').innerHTML = sw || '<span class="swatch-empty mono">chưa có kết nối</span>';
  $('#drawerSwatches').innerHTML = sw || '<span class="swatch-empty mono">chưa đọc được</span>';
  $$('#nottSwatches .swatch, #drawerSwatches .swatch').forEach((el) => el.addEventListener('click', () => deps.setColor(el.dataset.hex)));

  const notes = n.notes || [];
  $('#noteCount').textContent = notes.length ? String(notes.length) : '0';
  $('#noteList').innerHTML = notes.length
    ? notes.map((x) => `<li><b>${esc(x.title)}</b><span>${esc(x.snippet || '—')}</span></li>`).join('')
    : '<li class="note-empty">Chưa có ghi chú nào trong Nott.</li>';

  const imgs = n.images || [];
  $('#nottImages').innerHTML = imgs.length
    ? imgs.slice(0, 12).map((x) => `<button class="nott-thumb" type="button" data-img="${esc(x.name)}" style="background-image:url('/api/nott/thumb?name=${encodeURIComponent(x.name)}')"><span>${esc(x.name)}</span></button>`).join('')
    : '<span class="swatch-empty mono">chưa có ảnh</span>';
  $$('#nottImages .nott-thumb').forEach((el) => el.addEventListener('click', () => deps.importNottImage(el.dataset.img)));
  $('#btnDrawerSend').disabled = !deps.getState().doc;
}
