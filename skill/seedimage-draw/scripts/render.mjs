/* 输出：PNG 编码器（零依赖）、SVG 导出、把 SeedImage 代码 / 项目 JSON 变成画布 */

import zlib from 'node:zlib';
import { Surface } from './surface.mjs';
import { normalizeHex, parseColorSpec, parsePixelCode, PALETTE_PRESETS } from './core.mjs';

/* ------------------------------- PNG ------------------------------- */

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}

/** rgba: Uint8ClampedArray | Buffer，长度 width*height*4 */
export function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  const src = Buffer.from(rgba.buffer ? rgba.buffer : rgba, rgba.byteOffset || 0, stride * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    src.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/** 自动缩放：让最长边接近 target 像素（默认 512），范围 1–32 倍 */
export function autoScale(width, height, target = 512) {
  const s = Math.floor(target / Math.max(width, height));
  return Math.max(1, Math.min(32, s || 1));
}

export function surfaceToPNG(surface, options = {}) {
  const scale = options.scale || autoScale(surface.width, surface.height, options.target);
  const { width, height, data } = surface.toRGBA({ scale, bg: options.bg });
  return { buffer: encodePNG(width, height, data), width, height, scale };
}

/* ------------------------------- SVG ------------------------------- */

export function surfaceToSVG(surface, options = {}) {
  const scale = Math.max(1, Math.floor(options.scale || 1));
  const w = surface.width, h = surface.height;
  const rects = [];
  for (let y = 0; y < h; y++) {
    let x = 0;
    while (x < w) {
      const key = surface.data[y * w + x];
      let run = 1;
      while (x + run < w && surface.data[y * w + x + run] === key) run++;
      if (key) {
        rects.push('<rect x="' + x + '" y="' + y + '" width="' + run + '" height="1" fill="' +
          surface.hexOf(key) + '"/>');
      }
      x += run;
    }
  }
  const bg = options.bg && options.bg !== 'transparent'
    ? '<rect width="' + w + '" height="' + h + '" fill="' + (normalizeHex(options.bg) || '#000000') + '"/>'
    : '';
  return '<svg xmlns="http://www.w3.org/2000/svg" width="' + (w * scale) + '" height="' + (h * scale) +
    '" viewBox="0 0 ' + w + ' ' + h + '" shape-rendering="crispEdges">' + bg + rects.join('') + '</svg>\n';
}

/* --------------------- 代码 / 项目 JSON → 画布 --------------------- */

export function surfaceFromGrid(grid, palette, options = {}) {
  const height = grid.length;
  const width = height ? grid[0].length : 0;
  const s = new Surface(width, height, { title: options.title || '' });
  for (const [k, v] of Object.entries(palette || {})) {
    const hex = normalizeHex(v) || parseColorSpec(v);
    if (hex) s.palette.set(Number(k), hex);
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) s.data[y * width + x] = grid[y][x] | 0;
  }
  for (const k of s.usedKeys()) {
    if (!s.palette.has(k)) s.palette.set(k, '#FF00FF');
  }
  return s;
}

/** 解析 SeedImage 像素代码文本 → 画布；有错时抛异常 */
export function surfaceFromCode(text, options = {}) {
  const base = {};
  for (const e of PALETTE_PRESETS.default) base[e.key] = e.color;
  const parsed = parsePixelCode(text, { basePalette: Object.assign(base, options.basePalette || {}) });
  if (!parsed.ok) {
    const msg = parsed.errors.map((e) => '第' + e.line + '行: ' + e.message).join('; ');
    throw new Error('像素代码有错误 → ' + msg);
  }
  const palette = Object.assign({}, base);
  for (const [k, v] of parsed.defs) palette[k] = v;
  const s = surfaceFromGrid(parsed.grid, palette, { title: options.title });
  s.warnings = parsed.warnings;
  return s;
}

/** SeedImage 应用保存的 .json 项目 → 画布（合并可见图层） */
export function surfaceFromProject(json, options = {}) {
  if (!json || json.format !== 'seedimage') throw new Error('不是 SeedImage 项目文件（缺 format: seedimage）');
  const w = json.width | 0, h = json.height | 0;
  if (!(w > 0 && h > 0)) throw new Error('项目里的画布尺寸无效');
  const s = new Surface(w, h, { title: options.title || '' });
  for (const e of json.palette || []) {
    const hex = normalizeHex(e.color);
    if (hex) s.palette.set(e.key | 0, hex);
  }
  const data = new Uint16Array(w * h);
  for (const layer of json.layers || []) {
    if (layer.visible === false) continue;
    const src = layer.data || [];
    const n = Math.min(data.length, src.length);
    for (let i = 0; i < n; i++) {
      const k = src[i] | 0;
      if (k) data[i] = k;
    }
  }
  s.data = data;
  for (const k of s.usedKeys()) if (!s.palette.has(k)) s.palette.set(k, '#FF00FF');
  return s;
}

export default {
  encodePNG, autoScale, surfaceToPNG, surfaceToSVG,
  surfaceFromGrid, surfaceFromCode, surfaceFromProject,
};
