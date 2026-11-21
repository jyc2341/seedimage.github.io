/* 生成 examples/*.txt 示例代码文件：  node tools/make-examples.js
 * 顺便演示一下：用 ASCII 图 + 色卡，程序化地生成 SeedImage 代码。
 */
'use strict';

const fs = require('fs');
const path = require('path');
const core = require('../app.js');

const OUT = path.join(__dirname, '..', 'examples');
fs.mkdirSync(OUT, { recursive: true });

const PALETTE = {};
for (const e of core.PALETTE_PRESETS.default) PALETTE[e.key] = e.color;

/* ASCII 图 → 像素网格。symbols 把字符映射到色号，'.' 固定为透明。 */
function art(symbols, rows) {
  const grid = rows.map((line) => {
    const row = [];
    for (const ch of line) {
      if (ch === '.') { row.push(0); continue; }
      const key = symbols[ch];
      if (!key) throw new Error('没有为字符 "' + ch + '" 指定色号');
      row.push(key);
    }
    return row;
  });
  const width = Math.max(...rows.map((r) => r.length));
  for (const r of grid) while (r.length < width) r.push(0);
  return { width: width, height: rows.length, grid: grid };
}

function write(filename, code) {
  fs.writeFileSync(path.join(OUT, filename), code, 'utf8');
  console.log('  ✓ examples/' + filename + '  (' + code.split('\n').length + ' 行)');
}

console.log('生成示例文件：');

/* ---- 1. 用户给的 5×5 例子 ---- */
write('01-用户示例5x5.txt', [
  '# ① 最小例子：5 × 5',
  '# 每个颜色都要用 <> 包起来，<> 里是色号',
  '# 1 = 红：色卡里 1 号本来就是红，写出来更清楚',
  '# 2、3 号不在代码里定义，就按软件右边「色卡」里的颜色来',
  '',
  '1 = 红',
  '',
  '5*5（5*5像素）',
  '<1><1><1><1><1>',
  '<2><2><2><2><2>',
  '<3><3><3><3><3>',
  '<1><1><1><1><1>',
  '<1><1><1><1><1>',
  '',
].join('\n'));

/* ---- 2. 笑脸 16×16 ---- */
const smiley = art({ o: 3, '#': 10 }, [
  '................',
  '.....oooooo.....',
  '...oooooooooo...',
  '..oooooooooooo..',
  '..oooooooooooo..',
  '.oooo#oooo#oooo.',
  '.oooo#oooo#oooo.',
  '.oooooooooooooo.',
  '.oooooooooooooo.',
  '.ooo#oooooo#ooo.',
  '.oooo##oo##oooo.',
  '..ooooo##ooooo..',
  '..oooooooooooo..',
  '...oooooooooo...',
  '.....oooooo.....',
  '................',
]);
write('02-笑脸16x16.txt', core.serializePixelCode({
  width: smiley.width, height: smiley.height, grid: smiley.grid,
  palette: PALETTE, defs: true, pad: false, title: '笑脸 16×16',
}));

/* ---- 3. 爱心 16×16 ---- */
const heart = art({ '#': 1 }, [
  '................',
  '...##......##...',
  '..####....####..',
  '.######..######.',
  '.##############.',
  '.##############.',
  '.##############.',
  '..############..',
  '...##########...',
  '....########....',
  '.....######.....',
  '......####......',
  '.......##.......',
  '................',
  '................',
  '................',
]);
write('03-爱心16x16.txt', core.serializePixelCode({
  width: heart.width, height: heart.height, grid: heart.grid,
  palette: PALETTE, defs: true, pad: false, title: '爱心 16×16',
}));

/* ---- 4. 色卡总览 12×12 ---- */
const bars = { width: 12, height: 12, grid: [] };
for (let y = 0; y < 12; y++) {
  const row = [];
  for (let x = 0; x < 12; x++) row.push(y + 1);
  bars.grid.push(row);
}
write('04-色卡总览12x12.txt', core.serializePixelCode({
  width: bars.width, height: bars.height, grid: bars.grid,
  palette: PALETTE, defs: true, pad: false, title: '色卡总览：每一行一个色号',
}));

/* ---- 5. 直接写颜色 + 渐变 ---- */
const gradLines = [];
for (let y = 0; y < 8; y++) {
  const row = [];
  for (let x = 0; x < 8; x++) {
    const r = Math.round(255 * x / 7);
    const g = Math.round(255 * y / 7);
    const b = 255 - Math.round(255 * (x + y) / 14);
    row.push('<#' + [r, g, b].map((v) => v.toString(16).padStart(2, '0')).join('').toUpperCase() + '>');
  }
  gradLines.push(row.join(''));
}
write('05-直接写颜色渐变8x8.txt', [
  '# ⑤ 不用色号，直接在 <> 里写颜色也行',
  '#    每个新颜色会自动占一个色号，方便之后用 <号> 调用',
  '#    支持 #RGB / #RRGGBB / rgb(255,0,0) / 红 / red',
  '',
  '8*8',
  ...gradLines,
  '',
].join('\n'));

console.log('\n完成，共 5 个示例。在软件里点「代码」→「导入 .txt」即可载入。');
