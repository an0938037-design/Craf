#!/usr/bin/env node
/**
 * Cổng kiểm tra ranh giới module Craf.
 * Đọc boundaries.json, quét import trong app/src, fail nếu có cạnh cấm,
 * import ngược tầng, hoặc vòng phụ thuộc.
 *
 * Chạy:  node tools/check-boundaries.mjs
 * Exit:  0 sạch · 1 vi phạm · 2 lỗi cấu hình
 * Không cần dependency ngoài.
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { join, relative, resolve, dirname, basename, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const CFG_PATH = join(REPO, 'boundaries.json');

if (!existsSync(CFG_PATH)) {
  console.error('✗ Thiếu boundaries.json ở gốc repo.');
  process.exit(2);
}

const cfg = JSON.parse(readFileSync(CFG_PATH, 'utf8'));
const ROOT = resolve(REPO, cfg.root ?? 'app/src');
const ENTRY = (cfg.entry ?? 'index').replace(/\.m?js$/, '');
const LAYERS = cfg.layers ?? [];
const RANK = new Map(LAYERS.map((s, i) => [s, i]));
const FORBIDDEN = new Set((cfg.forbidden ?? []).map(([a, b]) => `${a}>${b}`));

if (!existsSync(ROOT)) {
  console.error(`✗ Không thấy thư mục ${cfg.root} — tạo section trước khi chạy cổng.`);
  process.exit(2);
}

const walk = (dir) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    if (e.name.startsWith('.') || e.name === 'node_modules') return [];
    const p = join(dir, e.name);
    if (e.isDirectory()) return walk(p);
    return /\.m?js$/.test(e.name) ? [p] : [];
  });

const sectionOf = (abs) => {
  const rel = relative(ROOT, abs);
  if (!rel || rel.startsWith('..')) return null;
  const head = rel.split(sep)[0];
  return RANK.has(head) ? head : null;
};

const PATTERNS = [
  /\bfrom\s*['"]([^'"]+)['"]/g,
  /\bimport\s*['"]([^'"]+)['"]/g,
  /\b(?:import|require)\s*\(\s*['"]([^'"]+)['"]\s*\)/g,
];

const files = walk(ROOT);
const errors = [];
const warnings = [];
const edges = new Map();

for (const file of files) {
  const src = sectionOf(file);
  const rel = relative(REPO, file);
  if (!src) {
    warnings.push(`${rel}: không thuộc section nào trong boundaries.json`);
    continue;
  }
  const lines = readFileSync(file, 'utf8').split(/\r?\n/);
  lines.forEach((line, i) => {
    if (!/import|require/.test(line)) return;
    for (const re of PATTERNS) {
      re.lastIndex = 0;
      let m;
      while ((m = re.exec(line))) {
        const spec = m[1];
        if (!spec.startsWith('.')) continue;
        const target = resolve(dirname(file), spec.split('?')[0]);
        const dst = sectionOf(target);
        if (!dst || dst === src) continue;

        const at = `${rel}:${i + 1}`;
        const key = `${src}>${dst}`;
        if (!edges.has(key)) edges.set(key, at);

        if (FORBIDDEN.has(key)) {
          errors.push(`${at}  ${src} → ${dst}  bị cấm tường minh (boundaries.json → forbidden)`);
        } else if (RANK.get(dst) > RANK.get(src)) {
          errors.push(
            `${at}  ${src} (rank ${RANK.get(src)}) → ${dst} (rank ${RANK.get(dst)})  import ngược tầng`,
          );
        }

        const entryName = basename(target).replace(/\.m?js$/, '');
        if (entryName !== ENTRY) {
          warnings.push(`${at}  import sâu ${dst}/${entryName} — ưu tiên ${dst}/${ENTRY}.js`);
        }
      }
    }
  });
}

// Vòng phụ thuộc giữa các section
const graph = new Map(LAYERS.map((s) => [s, []]));
for (const key of edges.keys()) {
  const [a, b] = key.split('>');
  graph.get(a)?.push(b);
}
const mark = new Map();
const cycles = [];
const dfs = (node, path) => {
  const st = mark.get(node);
  if (st === 2) return;
  if (st === 1) {
    const i = path.indexOf(node);
    cycles.push([...path.slice(i), node].join(' → '));
    return;
  }
  mark.set(node, 1);
  for (const next of graph.get(node) ?? []) dfs(next, [...path, node]);
  mark.set(node, 2);
};
for (const s of LAYERS) dfs(s, []);

for (const c of new Set(cycles)) errors.push(`vòng phụ thuộc: ${c}`);

// Báo cáo
console.log('Craf · ranh giới module');
console.log(`  ${cfg.root}  ·  ${LAYERS.length} section  ·  ${files.length} file  ·  ${edges.size} cạnh`);

if (files.length === 0) {
  console.log('  khung rỗng: chưa có file nguồn nào để kiểm.');
}

if (warnings.length) {
  console.log(`\n  cảnh báo (${warnings.length}):`);
  for (const w of warnings) console.log(`   · ${w}`);
}

if (errors.length) {
  console.log(`\n  ✗ vi phạm (${errors.length}):`);
  for (const e of errors) console.log(`   · ${e}`);
  console.log('\n  KẾT QUẢ: FAIL');
  process.exit(1);
}

console.log('\n  KẾT QUẢ: SẠCH');
