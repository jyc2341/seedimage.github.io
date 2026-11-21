/* 把 .txt 代码渲染成 PNG（纯 Node，无依赖）：
 *   node tools/render-png.js examples/02-笑脸16x16.txt preview/02.png 16
 * 参数：<代码文件> <输出png> [放大倍数，默认 16] [背景 #RRGGBB 或 transparent]
 */
'use strict';

const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const core = require('../app.js');

/* ---------- 最小 PNG 编码器 ---------- */
const CRC_TABLE = (function () {
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

function encodePNG(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (stride + 1)] = 0; // filter: none
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

/* ---------- 解析代码 → RGBA ---------- */

const file = process.argv[2];
const outFile = process.argv[3];
if (!file || !outFile) {
  console.error('用法: node tools/render-png.js <代码.txt> <输出.png> [放大倍数] [背景色]');
  process.exit(1);
}
const scale = Math.max(1, Math.min(64, parseInt(process.argv[4] || '16', 10)));
const bgArg = process.argv[5] || 'transparent';

const base = {};
for (const e of core.PALETTE_PRESETS.default) base[e.key] = e.color;

const text = fs.readFileSync(file, 'utf8');
const parsed = core.parsePixelCode(text, { basePalette: base });
if (!parsed.ok) {
  for (const e of parsed.errors) console.error('第' + e.line + '行: ' + e.message);
  process.exit(1);
}

const colors = Object.assign({}, base);
for (const [k, c] of parsed.defs) colors[k] = c;
for (const k of parsed.missingKeys) colors[k] = '#FF00FF';

const W = parsed.width * scale;
const H = parsed.height * scale;
const rgba = Buffer.alloc(W * H * 4);
const bg = bgArg === 'transparent' ? null : (core.normalizeHex(bgArg) || '#000000');
const bgRgb = bg ? core.hexToRgb(bg) : null;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const key = parsed.grid[Math.floor(y / scale)][Math.floor(x / scale)];
    const p = (y * W + x) * 4;
    if (!key) {
      if (bgRgb) { rgba[p] = bgRgb.r; rgba[p + 1] = bgRgb.g; rgba[p + 2] = bgRgb.b; rgba[p + 3] = 255; }
      continue;
    }
    const c = core.hexToRgb(colors[key] || '#FF00FF');
    rgba[p] = c.r; rgba[p + 1] = c.g; rgba[p + 2] = c.b; rgba[p + 3] = 255;
  }
}

fs.mkdirSync(path.dirname(path.resolve(outFile)), { recursive: true });
fs.writeFileSync(outFile, encodePNG(W, H, rgba));
console.log(parsed.width + '×' + parsed.height + ' → ' + outFile + '（' + W + '×' + H + '，放大 ' + scale + '×）');
