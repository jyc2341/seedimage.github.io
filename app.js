'use strict';
/* ============================================================================
 * SeedImage · 像素绘图工作台
 * ----------------------------------------------------------------------------
 * 第一部分  纯逻辑层：颜色解析 / 代码解析 / 代码生成 / 几何算法 / 洪水填充
 *            （不依赖 DOM，可直接用 node 测试：require('./app.js')）
 * 第二部分  UI 层：画布、工具箱、色卡、图层、代码面板
 * ==========================================================================*/

/* ========================= 第一部分：纯逻辑层 ========================= */

/* 尺寸行：允许后面跟说明文字，例如 `5*5（5*5像素）` 或 `5*5 # 注释` */
const SIZELINE_RE = /^\s*(\d+)\s*[*x×X✕]\s*(\d+)\b/;
const DEFLINE_RE = /^(\d+)\s*=\s*(.+)$/;
const TOKEN_RE = /<([^<>]*)>/g;

/* 这些写法都表示“透明” */
const TRANSPARENT_TOKENS = new Set(['', '.', '0', '-', '_', 'x', '×', '透明', '空', 'none', 'null']);

/* 中文 / 英文色名 */
const NAMED_COLORS = {
  '红': '#E53935', '红色': '#E53935', 'red': '#e53935',
  '橙': '#FB8C00', '橙色': '#FB8C00', 'orange': '#fb8c00',
  '黄': '#FDD835', '黄色': '#FDD835', 'yellow': '#fdd835',
  '绿': '#43A047', '绿色': '#43A047', 'green': '#43a047',
  '青': '#00ACC1', '青色': '#00ACC1', 'cyan': '#00acc1',
  '蓝': '#1E88E5', '蓝色': '#1E88E5', 'blue': '#1e88e5',
  '紫': '#8E24AA', '紫色': '#8E24AA', 'purple': '#8e24aa',
  '粉': '#EC407A', '粉色': '#EC407A', 'pink': '#ec407a',
  '棕': '#6D4C41', '棕色': '#6D4C41', 'brown': '#6d4c41',
  '黑': '#000000', '黑色': '#000000', 'black': '#000000',
  '白': '#FFFFFF', '白色': '#FFFFFF', 'white': '#ffffff',
  '灰': '#9E9E9E', '灰色': '#9E9E9E', 'gray': '#9e9e9e', 'grey': '#9e9e9e',
  '金': '#FFC107', 'gold': '#ffc107',
  '银': '#B0BEC5', 'silver': '#b0bec5',
};

/* 内置色卡方案 */
const PALETTE_PRESETS = {
  default: [
    { key: 1, color: '#E53935', name: '红' }, { key: 2, color: '#FB8C00', name: '橙' },
    { key: 3, color: '#FDD835', name: '黄' }, { key: 4, color: '#43A047', name: '绿' },
    { key: 5, color: '#00ACC1', name: '青' }, { key: 6, color: '#1E88E5', name: '蓝' },
    { key: 7, color: '#8E24AA', name: '紫' }, { key: 8, color: '#EC407A', name: '粉' },
    { key: 9, color: '#6D4C41', name: '棕' }, { key: 10, color: '#000000', name: '黑' },
    { key: 11, color: '#FFFFFF', name: '白' }, { key: 12, color: '#9E9E9E', name: '灰' },
  ],
  pico8: [
    { key: 1, color: '#000000', name: 'black' }, { key: 2, color: '#1D2B53', name: 'dark-blue' },
    { key: 3, color: '#7E2553', name: 'dark-purple' }, { key: 4, color: '#008751', name: 'dark-green' },
    { key: 5, color: '#AB5236', name: 'brown' }, { key: 6, color: '#5F574F', name: 'dark-grey' },
    { key: 7, color: '#C2C3C7', name: 'light-grey' }, { key: 8, color: '#FFF1E8', name: 'white' },
    { key: 9, color: '#FF004D', name: 'red' }, { key: 10, color: '#FFA300', name: 'orange' },
    { key: 11, color: '#FFEC27', name: 'yellow' }, { key: 12, color: '#00E436', name: 'green' },
    { key: 13, color: '#29ADFF', name: 'blue' }, { key: 14, color: '#83769C', name: 'lavender' },
    { key: 15, color: '#FF77A8', name: 'pink' }, { key: 16, color: '#FFCCAA', name: 'peach' },
  ],
  gray: (function () {
    const out = [];
    for (let i = 0; i < 16; i++) {
      const v = i * 17;
      out.push({ key: i + 1, color: rgbToHex(v, v, v), name: '灰' + (i + 1) });
    }
    return out;
  })(),
  warm: [
    { key: 1, color: '#FFF3E0', name: '米白' }, { key: 2, color: '#FFE0B2', name: '浅杏' },
    { key: 3, color: '#FFCC80', name: '杏' }, { key: 4, color: '#FFB74D', name: '橘黄' },
    { key: 5, color: '#FF9800', name: '橙' }, { key: 6, color: '#F4511E', name: '朱红' },
    { key: 7, color: '#D84315', name: '砖红' }, { key: 8, color: '#BF360C', name: '深砖' },
    { key: 9, color: '#E53935', name: '红' }, { key: 10, color: '#AD1457', name: '玫红' },
    { key: 11, color: '#6D4C41', name: '棕' }, { key: 12, color: '#3E2723', name: '深棕' },
  ],
};

/* ------------------------------ 颜色工具 ------------------------------ */

function clamp255(v) {
  let n = Math.round(Number(v));
  if (!isFinite(n)) n = 0;
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

function normalizeHex(input) {
  let s = String(input == null ? '' : input).trim().replace(/^0x/i, '#');
  if (s.charAt(0) === '#') s = s.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(s)) return null;
  if (s.length === 3 || s.length === 4) {
    s = s.slice(0, 3).split('').map((c) => c + c).join('');
  } else if (s.length === 6 || s.length === 8) {
    s = s.slice(0, 6);
  } else {
    return null;
  }
  return ('#' + s).toUpperCase();
}

function hexToRgb(hex) {
  const h = normalizeHex(hex) || '#000000';
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** 解析一个颜色写法：#f00 / #FF0000 / rgb(255,0,0) / 255,0,0 / 红 / red */
function parseColorSpec(spec) {
  if (spec == null) return null;
  const s = String(spec).trim();
  if (!s) return null;
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, s)) return normalizeHex(NAMED_COLORS[s]);
  const low = s.toLowerCase();
  if (Object.prototype.hasOwnProperty.call(NAMED_COLORS, low)) return normalizeHex(NAMED_COLORS[low]);
  if (s.charAt(0) === '#' || /^0x/i.test(s)) return normalizeHex(s);
  let m = s.match(/^rgba?\(\s*([\d.]+)\s*[, ]\s*([\d.]+)\s*[, ]\s*([\d.]+)/i);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  m = s.match(/^(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})$/);
  if (m) return rgbToHex(+m[1], +m[2], +m[3]);
  return null;
}

/** 把各种形态的色卡统一成 { 色号: '#RRGGBB' } */
function toColorMap(palette) {
  const out = {};
  if (!palette) return out;
  if (typeof Map !== 'undefined' && palette instanceof Map) {
    for (const [k, v] of palette) out[k] = v && typeof v === 'object' ? (v.color || '#000000') : v;
  } else if (Array.isArray(palette)) {
    for (const item of palette) {
      if (Array.isArray(item)) out[item[0]] = item[1];
      else if (item && typeof item === 'object') out[item.key != null ? item.key : item.n] = item.color || item.hex;
    }
  } else if (typeof palette === 'object') {
    for (const k of Object.keys(palette)) {
      const v = palette[k];
      out[k] = v && typeof v === 'object' ? (v.color || '#000000') : v;
    }
  }
  return out;
}

/**
 * 色卡定义行右边的颜色：允许后面跟 `# 注释`，
 * 但不能把 `2 = #FB8C00` 里的十六进制当成注释。
 */
function colorFromRhs(rhs) {
  const s = String(rhs == null ? '' : rhs).trim();
  let c = parseColorSpec(s);
  if (c) return c;
  const m = s.match(/^(.*?)\s+#/);
  if (m && m[1].trim()) {
    c = parseColorSpec(m[1].trim());
    if (c) return c;
  }
  const cut = s.indexOf('#');
  if (cut > 0) {
    c = parseColorSpec(s.slice(0, cut).trim());
    if (c) return c;
  }
  return null;
}

/* ------------------------------ 代码解析 ------------------------------ */

/**
 * 解析 SeedImage 像素代码。
 *   # 注释
 *   1 = 红              色卡定义（可选，写了就覆盖色卡）
 *   5*5                 尺寸（可选；不写就按实际行列推断）
 *   <1><1><1><1><1>     像素行，每个颜色都要用 <> 包起来
 *   <0> / <>            透明
 *   <#FF0000>           直接写颜色（会自动占用一个色号）
 *
 * @param {string} text
 * @param {{basePalette?: any}} [options] basePalette：色卡，代码里没定义的色号从这里取色
 * @returns {{ok:boolean,width:number,height:number,grid:number[][],defs:Map<number,string>,
 *            usedKeys:number[],missingKeys:number[],errors:Array,warnings:Array,header:?number}}
 */
function parsePixelCode(text, options) {
  const opts = options || {};
  const base = toColorMap(opts.basePalette);
  const baseKeys = new Set(Object.keys(base).map(Number));
  const errors = [];
  const warnings = [];
  const defs = new Map();
  const rowLines = [];
  let header = null;

  const lines = String(text == null ? '' : text).replace(/\r\n?/g, '\n').split('\n');

  for (let i = 0; i < lines.length; i++) {
    const lineNo = i + 1;
    let line = lines[i];
    if (/^\s*(#|\/\/)/.test(line)) continue;          // 整行注释（# 开头的十六进制颜色不受影响）
    const cut = line.indexOf('//');
    if (cut >= 0) line = line.slice(0, cut);          // 行尾注释
    if (!line.trim()) continue;

    const sizeM = line.match(SIZELINE_RE) || line.replace(/\s*#.*$/, '').match(SIZELINE_RE);
    if (sizeM) {
      header = { w: +sizeM[1], h: +sizeM[2], line: lineNo };
      continue;
    }

    if (line.indexOf('<') < 0) {
      const defM = line.match(DEFLINE_RE);
      if (defM) {
        const color = colorFromRhs(defM[2]);
        if (!color) {
          errors.push({ line: lineNo, message: '认不出的颜色：' + defM[2].trim().slice(0, 30) });
        } else {
          defs.set(+defM[1], color);
        }
        continue;
      }
      // 形如 `2,3=按色卡来` 的说明行：忽略并提示，不当成错误
      if (/^\s*\d+(\s*[,，、]\s*\d+)+\s*=/.test(line)) {
        warnings.push({ line: lineNo, message: '已忽略说明行：' + line.trim().slice(0, 30) });
        continue;
      }
      errors.push({ line: lineNo, message: '认不出的行：' + line.trim().slice(0, 40) });
      continue;
    }

    rowLines.push({ line: line.replace(/\s+#.*$/, ''), lineNo: lineNo });
  }

  /* ---- 解析每一行的 <号> ---- */
  const rawGrid = [];
  let maxW = 0;
  for (const rl of rowLines) {
    const tokens = [];
    TOKEN_RE.lastIndex = 0;
    let m;
    while ((m = TOKEN_RE.exec(rl.line))) tokens.push(m[1].trim());
    if (!tokens.length) {
      errors.push({ line: rl.lineNo, message: '这一行没有找到 <颜色> 标记' });
      continue;
    }
    const leftover = rl.line.replace(TOKEN_RE, ' ').trim();
    if (leftover) warnings.push({ line: rl.lineNo, message: '<颜色> 之外的内容被忽略：' + leftover.slice(0, 30) });
    rawGrid.push({ tokens: tokens, lineNo: rl.lineNo });
    if (tokens.length > maxW) maxW = tokens.length;
  }

  if (!rawGrid.length && !errors.length) {
    errors.push({ line: 0, message: '没有找到任何像素数据行（每一行形如 <1><1><1>）' });
  }

  /* ---- 色号解析 ---- */
  let maxKey = 0;
  const bumpMax = (k) => { if (k > maxKey) maxKey = k; };
  for (const k of defs.keys()) bumpMax(k);
  for (const k of baseKeys) bumpMax(k);

  const colorToKey = new Map();
  for (const [k, c] of defs) if (!colorToKey.has(c)) colorToKey.set(c, k);
  for (const k of [...baseKeys].sort((a, b) => a - b)) {
    const c = normalizeHex(base[k]);
    if (c && !colorToKey.has(c)) colorToKey.set(c, k);
  }

  const used = new Set();
  const missing = new Set();
  const grid = rawGrid.map((rl) => rl.tokens.map((tok) => {
    const low = tok.toLowerCase();
    if (TRANSPARENT_TOKENS.has(low)) return 0;
    if (/^\d+$/.test(tok)) {
      const k = +tok;
      if (k === 0) return 0;
      used.add(k);
      if (!defs.has(k) && !baseKeys.has(k)) missing.add(k);
      return k;
    }
    const color = parseColorSpec(tok);
    if (!color) {
      errors.push({ line: rl.lineNo, message: '认不出的颜色：<' + tok + '>' });
      return 0;
    }
    if (colorToKey.has(color)) {
      const k = colorToKey.get(color);
      used.add(k);
      return k;
    }
    const k = ++maxKey;
    colorToKey.set(color, k);
    defs.set(k, color);
    used.add(k);
    return k;
  }));

  /* ---- 尺寸归整 ---- */
  let width = header ? header.w : maxW;
  let height = header ? header.h : grid.length;
  if (!(width > 0) || !(height > 0)) {
    errors.push({ line: header ? header.line : 0, message: '画布尺寸必须是正整数' });
    width = Math.max(1, width || maxW || 1);
    height = Math.max(1, height || grid.length || 1);
  }
  if (width > 1024 || height > 1024) {
    errors.push({ line: header ? header.line : 0, message: '尺寸太大（上限 1024 × 1024）' });
  }
  if (header && grid.length !== header.h) {
    warnings.push({
      line: header.line,
      message: '实际有 ' + grid.length + ' 行像素，尺寸头写的是 ' + header.h + ' 行',
    });
  }

  const norm = [];
  for (let y = 0; y < height; y++) {
    const src = grid[y] || [];
    const row = new Array(width).fill(0);
    for (let x = 0; x < width; x++) if (x < src.length) row[x] = src[x];
    if (src.length > width) {
      warnings.push({
        line: rawGrid[y] ? rawGrid[y].lineNo : 0,
        message: '第 ' + (y + 1) + ' 行有 ' + src.length + ' 个颜色，超过宽度 ' + width + '，多余的被截断',
      });
    } else if (src.length < width && rawGrid[y]) {
      warnings.push({
        line: rawGrid[y].lineNo,
        message: '第 ' + (y + 1) + ' 行只有 ' + src.length + ' 个颜色，不足宽度 ' + width + '，已用透明补齐',
      });
    }
    norm.push(row);
  }

  for (const k of [...missing].sort((a, b) => a - b)) {
    warnings.push({ line: 0, message: '色号 <' + k + '> 代码里没定义、色卡里也没有，已用占位颜色' });
  }

  return {
    ok: errors.length === 0,
    width: width,
    height: height,
    grid: norm,
    defs: defs,
    usedKeys: [...used].sort((a, b) => a - b),
    missingKeys: [...missing].sort((a, b) => a - b),
    errors: errors,
    warnings: warnings,
    header: header,
  };
}

/* ------------------------------ 代码生成 ------------------------------ */

/**
 * 把像素网格生成为 SeedImage 代码。
 * @param {{width:number,height:number,grid:number[][],palette:any,defs?:boolean,pad?:boolean,comments?:boolean,title?:string}} spec
 */
function serializePixelCode(spec) {
  const width = spec.width | 0;
  const height = spec.height | 0;
  const grid = spec.grid || [];
  const colors = toColorMap(spec.palette);
  const used = new Set();
  for (let y = 0; y < height; y++) {
    const row = grid[y] || [];
    for (let x = 0; x < width; x++) {
      const k = row[x] | 0;
      if (k) used.add(k);
    }
  }
  const keys = [...used].sort((a, b) => a - b);
  const withComments = spec.comments !== false;
  const out = [];

  if (withComments) {
    out.push('# SeedImage 像素代码' + (spec.title ? ' · ' + spec.title : ''));
    out.push('# 尺寸 宽*高；每个颜色用 <色号> 包起来；<0> 表示透明');
  }
  out.push(width + '*' + height);

  if (spec.defs !== false && keys.length) {
    if (withComments) out.push('# 色卡');
    for (const k of keys) {
      const c = normalizeHex(colors[k]) || '#FF00FF';
      out.push(k + ' = ' + c);
    }
  }
  if (withComments) out.push('# 像素');

  const sep = spec.pad ? ' ' : '';
  for (let y = 0; y < height; y++) {
    const row = grid[y] || [];
    const cells = [];
    for (let x = 0; x < width; x++) cells.push('<' + (row[x] | 0) + '>');
    out.push(cells.join(sep));
  }
  return out.join('\n') + '\n';
}

/* ------------------------------ 几何 / 填充 ------------------------------ */

/** 直线（Bresenham），返回 [[x,y], ...] */
function linePoints(x0, y0, x1, y1) {
  const pts = [];
  let x = Math.round(x0), y = Math.round(y0);
  const ex = Math.round(x1), ey = Math.round(y1);
  const dx = Math.abs(ex - x), dy = Math.abs(ey - y);
  const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
  let err = dx - dy;
  for (let guard = 0; guard < 100000; guard++) {
    pts.push([x, y]);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return pts;
}

/** 矩形：fill=true 实心，false 只画边框 */
function rectPoints(x0, y0, x1, y1, fill) {
  const left = Math.min(x0, x1) | 0, right = Math.max(x0, x1) | 0;
  const top = Math.min(y0, y1) | 0, bottom = Math.max(y0, y1) | 0;
  const pts = [];
  for (let y = top; y <= bottom; y++) {
    for (let x = left; x <= right; x++) {
      if (fill || x === left || x === right || y === top || y === bottom) pts.push([x, y]);
    }
  }
  return pts;
}

/** 椭圆：fill=true 实心，false 取边界像素 */
function ellipsePoints(x0, y0, x1, y1, fill) {
  const left = Math.min(x0, x1) | 0, right = Math.max(x0, x1) | 0;
  const top = Math.min(y0, y1) | 0, bottom = Math.max(y0, y1) | 0;
  const w = right - left + 1, h = bottom - top + 1;
  const cx = left + w / 2, cy = top + h / 2;
  const rx = w / 2, ry = h / 2;
  const mask = new Uint8Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const nx = (left + x + 0.5 - cx) / rx;
      const ny = (top + y + 0.5 - cy) / ry;
      if (nx * nx + ny * ny <= 1.0000001) mask[y * w + x] = 1;
    }
  }
  const pts = [];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (!mask[y * w + x]) continue;
      if (fill) { pts.push([left + x, top + y]); continue; }
      const up = y > 0 ? mask[(y - 1) * w + x] : 0;
      const dn = y < h - 1 ? mask[(y + 1) * w + x] : 0;
      const lf = x > 0 ? mask[y * w + x - 1] : 0;
      const rt = x < w - 1 ? mask[y * w + x + 1] : 0;
      if (!up || !dn || !lf || !rt) pts.push([left + x, top + y]);
    }
  }
  return pts;
}

/** 把点集用笔刷尺寸“盖章”成更大的点集 */
function expandPoints(pts, size) {
  const s = Math.max(1, size | 0);
  if (s === 1) return pts;
  const off = Math.floor((s - 1) / 2);
  const out = [];
  const seen = new Set();
  for (const [x, y] of pts) {
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) {
        const nx = x - off + dx, ny = y - off + dy;
        const k = ny * 4096 + nx;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push([nx, ny]);
      }
    }
  }
  return out;
}

/** 四连通洪水填充；返回被改写的像素个数 */
function floodFill(data, w, h, x, y, key) {
  x |= 0; y |= 0;
  if (x < 0 || y < 0 || x >= w || y >= h) return 0;
  const target = data[y * w + x];
  if (target === key) return 0;
  const stack = [y * w + x];
  let count = 0;
  while (stack.length) {
    const i = stack.pop();
    if (data[i] !== target) continue;
    data[i] = key;
    count++;
    const cx = i % w;
    const cy = (i - cx) / w;
    if (cx > 0) stack.push(i - 1);
    if (cx < w - 1) stack.push(i + 1);
    if (cy > 0) stack.push(i - w);
    if (cy < h - 1) stack.push(i + w);
  }
  return count;
}

/* 供 node 测试使用 */
const SeedImageCore = {
  NAMED_COLORS: NAMED_COLORS,
  PALETTE_PRESETS: PALETTE_PRESETS,
  normalizeHex: normalizeHex,
  hexToRgb: hexToRgb,
  rgbToHex: rgbToHex,
  parseColorSpec: parseColorSpec,
  colorFromRhs: colorFromRhs,
  toColorMap: toColorMap,
  parsePixelCode: parsePixelCode,
  serializePixelCode: serializePixelCode,
  linePoints: linePoints,
  rectPoints: rectPoints,
  ellipsePoints: ellipsePoints,
  expandPoints: expandPoints,
  floodFill: floodFill,
};
if (typeof module !== 'undefined' && module.exports) module.exports = SeedImageCore;

/* ============================ 第二部分：UI ============================ */

if (typeof document !== 'undefined') (function () {

  /* ------------------------------ 常量 ------------------------------ */

  const MAX_HISTORY = 80;
  const TOOLS = [
    { id: 'pencil', name: '铅笔', key: 'P', icon: '✏' },
    { id: 'eraser', name: '橡皮', key: 'E', icon: '⌫' },
    { id: 'fill', name: '油漆桶', key: 'G', icon: '▨' },
    { id: 'line', name: '直线', key: 'L', icon: '╱' },
    { id: 'rect', name: '矩形框', key: 'R', icon: '▢' },
    { id: 'rectFill', name: '实心矩形', key: 'Shift+R', icon: '▬' },
    { id: 'ellipse', name: '椭圆', key: 'O', icon: '◯' },
    { id: 'picker', name: '吸管', key: 'I', icon: '⌖' },
    { id: 'move', name: '移动图层', key: 'V', icon: '✥' },
  ];

  const EXAMPLE_CODE = [
    '# 示例：5 × 5（就是你给的那段）',
    '# 每个颜色都要用 <> 包起来',
    '1 = 红            # 色号 1 = 红',
    '# 2、3 号颜色按右侧「色卡」来',
    '',
    '5*5',
    '<1><1><1><1><1>',
    '<2><2><2><2><2>',
    '<3><3><3><3><3>',
    '<1><1><1><1><1>',
    '<1><1><1><1><1>',
    '',
  ].join('\n');

  const HELP_HTML = [
    '<p>每个颜色都要用 <code>&lt;号&gt;</code> 包起来，号就是色卡上的色号。</p>',
    '<pre>',
    '# ① 色卡定义（可以省略；写了就覆盖右边色卡）',
    '1 = 红              支持中文色名（红/橙/黄/绿/青/蓝/紫/粉/棕/黑/白/灰…）',
    '2 = #FB8C00         支持 #RGB / #RRGGBB / rgb(255,140,0) / 255,140,0',
    '3 = blue            也支持英文色名',
    '',
    '# ② 尺寸（可以省略，不写就按行列自动推断）',
    '5*5                 宽 5 × 高 5，也可以写 5x5 或 5×5',
    '',
    '# ③ 像素：每行从左到右',
    '<1><1><1><1><1>',
    '<2><2><2><2><2>',
    '<3><3><3><3><3>',
    '<1><1><1><1><1>',
    '<1><1><1><1><1>',
    '',
    '# ④ 透明：<0> 或 <> ；  直接写颜色也行：<#FF0000>',
    '# ⑤ 注释：以 # 或 // 开头',
    '</pre>',
    '<p class="muted small">没在代码里定义的色号（例如上面的 2、3），按右侧色卡里的颜色来画。</p>',
  ].join('\n');

  /* ------------------------------ DOM ------------------------------ */

  const $ = (id) => document.getElementById(id);
  const stage = $('stage');
  const ctx = stage.getContext('2d');
  const off = document.createElement('canvas');
  const offCtx = off.getContext('2d', { willReadFrequently: true });
  const checker = document.createElement('canvas');
  (function buildChecker() {
    checker.width = 16; checker.height = 16;
    const c = checker.getContext('2d');
    c.fillStyle = '#26282f'; c.fillRect(0, 0, 16, 16);
    c.fillStyle = '#1c1e24'; c.fillRect(0, 0, 8, 8); c.fillRect(8, 8, 8, 8);
  })();
  const checkerPattern = ctx.createPattern(checker, 'repeat');

  /* ------------------------------ 状态 ------------------------------ */

  let uid = 0;
  let doc = null;
  let offImg = null;
  let activeKey = 1;
  let tool = 'pencil';
  let brush = 1;
  let drag = null;
  let pending = null;              // 待提交的历史快照
  let undoStack = [];
  let redoStack = [];
  let spaceDown = false;
  let statusTimer = 0;
  let autosaveTimer = 0;
  let colorEditTimer = 0;
  let validateTimer = 0;
  let renderQueued = false;
  const view = { zoom: 16, panX: 0, panY: 0, grid: true, hover: null };

  const AUTOSAVE_KEY = 'seedimage:autosave:v1';

  /* ------------------------------ 文档模型 ------------------------------ */

  function makeLayer(name, w, h) {
    return { id: ++uid, name: name, visible: true, opacity: 1, data: new Uint16Array(w * h) };
  }

  function presetList(name) {
    return PALETTE_PRESETS[name] || PALETTE_PRESETS.default;
  }

  function createDoc(w, h, presetName) {
    const d = { width: w, height: h, palette: new Map(), layers: [], activeId: 0 };
    for (const e of presetList(presetName)) d.palette.set(e.key, { color: e.color, name: e.name });
    const layer = makeLayer('图层 1', w, h);
    d.layers.push(layer);
    d.activeId = layer.id;
    return d;
  }

  function activeLayer() {
    return doc.layers.find((l) => l.id === doc.activeId) || doc.layers[doc.layers.length - 1];
  }

  function paletteColorMap() {
    const o = {};
    for (const [k, v] of doc.palette) o[k] = v.color;
    return o;
  }

  function nextPaletteKey() {
    let m = 0;
    for (const k of doc.palette.keys()) if (k > m) m = k;
    return m + 1;
  }

  function ensurePaletteKey(color) {
    const hex = normalizeHex(color) || '#000000';
    for (const [k, v] of doc.palette) if (normalizeHex(v.color) === hex) return k;
    const k = nextPaletteKey();
    doc.palette.set(k, { color: hex, name: hex });
    return k;
  }

  /* ------------------------------ 历史 ------------------------------ */

  function snapshot() {
    return {
      width: doc.width,
      height: doc.height,
      palette: [...doc.palette].map(([k, v]) => [k, v.color, v.name]),
      layers: doc.layers.map((l) => ({
        id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, data: l.data.slice(),
      })),
      activeId: doc.activeId,
      activeKey: activeKey,
    };
  }

  function applySnapshot(s) {
    doc.width = s.width;
    doc.height = s.height;
    doc.palette = new Map(s.palette.map(([k, c, n]) => [k, { color: c, name: n }]));
    doc.layers = s.layers.map((l) => ({
      id: l.id, name: l.name, visible: l.visible, opacity: l.opacity, data: l.data.slice(),
    }));
    doc.activeId = s.activeId;
    activeKey = s.activeKey;
    syncOffscreen();
    refreshAll();
  }

  function beginChange() {
    if (!pending) pending = snapshot();
  }

  function commitChange() {
    if (!pending) return;
    undoStack.push(pending);
    if (undoStack.length > MAX_HISTORY) undoStack.shift();
    redoStack.length = 0;
    pending = null;
    updateUndoButtons();
  }

  function cancelChange() {
    pending = null;
  }

  function undo() {
    if (!undoStack.length) return;
    redoStack.push(snapshot());
    applySnapshot(undoStack.pop());
    updateUndoButtons();
    afterChange();
    setStatus('已撤销');
  }

  function redo() {
    if (!redoStack.length) return;
    undoStack.push(snapshot());
    applySnapshot(redoStack.pop());
    updateUndoButtons();
    afterChange();
    setStatus('已重做');
  }

  function updateUndoButtons() {
    $('btnUndo').disabled = !undoStack.length;
    $('btnRedo').disabled = !redoStack.length;
  }

  /* ------------------------------ 合成 / 渲染 ------------------------------ */

  function syncOffscreen() {
    if (off.width !== doc.width || off.height !== doc.height) {
      off.width = doc.width;
      off.height = doc.height;
      offImg = offCtx.createImageData(doc.width, doc.height);
    }
    if (!offImg || offImg.width !== doc.width || offImg.height !== doc.height) {
      offImg = offCtx.createImageData(doc.width, doc.height);
    }
  }

  function composite(preview) {
    syncOffscreen();
    const w = doc.width, h = doc.height;
    const px = offImg.data;
    px.fill(0);
    const cache = new Map();
    for (const layer of doc.layers) {
      if (!layer.visible || layer.opacity <= 0) continue;
      const data = preview && preview.layerId === layer.id && preview.data ? preview.data : layer.data;
      const a = Math.max(0, Math.min(1, layer.opacity));
      const n = w * h;
      for (let i = 0; i < n; i++) {
        const key = data[i];
        if (!key) continue;
        const entry = doc.palette.get(key);
        if (!entry) continue;
        let rgb = cache.get(key);
        if (!rgb) { rgb = hexToRgb(entry.color); cache.set(key, rgb); }
        const p = i * 4;
        if (a >= 1) {
          px[p] = rgb.r; px[p + 1] = rgb.g; px[p + 2] = rgb.b; px[p + 3] = 255;
        } else {
          const da = px[p + 3] / 255;
          const oa = a + da * (1 - a);
          if (oa <= 0) continue;
          px[p] = Math.round((rgb.r * a + px[p] * da * (1 - a)) / oa);
          px[p + 1] = Math.round((rgb.g * a + px[p + 1] * da * (1 - a)) / oa);
          px[p + 2] = Math.round((rgb.b * a + px[p + 2] * da * (1 - a)) / oa);
          px[p + 3] = Math.round(oa * 255);
        }
      }
    }
    offCtx.putImageData(offImg, 0, 0);
  }

  function requestRender() {
    if (renderQueued) return;
    renderQueued = true;
    requestAnimationFrame(() => { renderQueued = false; render(); });
  }

  function render(preview) {
    if (!doc) return;
    composite(preview || null);
    const dpr = window.devicePixelRatio || 1;
    const cw = stage.clientWidth || 1, ch = stage.clientHeight || 1;
    const pw = Math.max(1, Math.round(cw * dpr)), ph = Math.max(1, Math.round(ch * dpr));
    if (stage.width !== pw || stage.height !== ph) { stage.width = pw; stage.height = ph; }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#0b0c10';
    ctx.fillRect(0, 0, cw, ch);

    const z = view.zoom;
    const iw = doc.width * z, ih = doc.height * z;
    const x0 = view.panX, y0 = view.panY;

    ctx.save();
    ctx.beginPath();
    ctx.rect(x0, y0, iw, ih);
    ctx.clip();
    if (checkerPattern) {
      ctx.fillStyle = checkerPattern;
      ctx.fillRect(x0, y0, iw, ih);
    }
    ctx.drawImage(off, x0, y0, iw, ih);

    if (view.grid && z >= 4) {
      ctx.strokeStyle = 'rgba(255,255,255,0.10)';
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = 0; x <= doc.width; x++) {
        const sx = Math.round(x0 + x * z) + 0.5;
        ctx.moveTo(sx, y0); ctx.lineTo(sx, y0 + ih);
      }
      for (let y = 0; y <= doc.height; y++) {
        const sy = Math.round(y0 + y * z) + 0.5;
        ctx.moveTo(x0, sy); ctx.lineTo(x0 + iw, sy);
      }
      ctx.stroke();
    }
    ctx.restore();

    ctx.strokeStyle = 'rgba(255,255,255,0.25)';
    ctx.lineWidth = 1;
    ctx.strokeRect(x0 - 0.5, y0 - 0.5, iw + 1, ih + 1);

    if (view.hover && z >= 3) {
      ctx.strokeStyle = '#4c8dff';
      ctx.lineWidth = 2;
      const hx = x0 + view.hover.x * z, hy = y0 + view.hover.y * z;
      ctx.strokeRect(hx - 1, hy - 1, z + 2, z + 2);
    }
    updateZoomLabel();
  }

  function updateZoomLabel() {
    const z = view.zoom;
    $('zoomLabel').textContent = Math.round(z * 100) + '%';
  }

  function centerView() {
    view.panX = Math.round((stage.clientWidth - doc.width * view.zoom) / 2);
    view.panY = Math.round((stage.clientHeight - doc.height * view.zoom) / 2);
    requestRender();
  }

  function fitView() {
    const cw = Math.max(60, stage.clientWidth - 56);
    const ch = Math.max(60, stage.clientHeight - 56);
    const z = Math.min(cw / doc.width, ch / doc.height);
    view.zoom = z >= 1 ? Math.max(1, Math.floor(z)) : Math.max(0.05, z);
    centerView();
    updateZoomLabel();
  }

  function setZoom(z, anchorClientX, anchorClientY) {
    z = Math.min(128, Math.max(0.05, z));
    if (Math.abs(z - view.zoom) < 1e-6) return;
    const r = stage.getBoundingClientRect();
    const ax = anchorClientX == null ? stage.clientWidth / 2 : anchorClientX - r.left;
    const ay = anchorClientY == null ? stage.clientHeight / 2 : anchorClientY - r.top;
    const ix = (ax - view.panX) / view.zoom;
    const iy = (ay - view.panY) / view.zoom;
    view.zoom = z;
    view.panX = ax - ix * z;
    view.panY = ay - iy * z;
    requestRender();
    updateZoomLabel();
  }

  /* ------------------------------ 绘制操作 ------------------------------ */

  function applyPointsTo(data, pts, key, w, h) {
    let changed = false;
    for (const [x, y] of pts) {
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      const i = y * w + x;
      if (data[i] !== key) { data[i] = key; changed = true; }
    }
    return changed;
  }

  function paintPoints(pts, key) {
    return applyPointsTo(activeLayer().data, pts, key, doc.width, doc.height);
  }

  function pixelFromEvent(e) {
    const r = stage.getBoundingClientRect();
    return {
      x: Math.floor((e.clientX - r.left - view.panX) / view.zoom),
      y: Math.floor((e.clientY - r.top - view.panY) / view.zoom),
    };
  }

  function inBounds(p) {
    return p.x >= 0 && p.y >= 0 && p.x < doc.width && p.y < doc.height;
  }

  function shapePoints(kind, a, b) {
    if (kind === 'line') return linePoints(a.x, a.y, b.x, b.y);
    if (kind === 'rect') return rectPoints(a.x, a.y, b.x, b.y, false);
    if (kind === 'rectFill') return rectPoints(a.x, a.y, b.x, b.y, true);
    if (kind === 'ellipse') return ellipsePoints(a.x, a.y, b.x, b.y, false);
    return [];
  }

  function buildPreviewForShape(cursor) {
    const layer = activeLayer();
    const data = layer.data.slice();
    applyPointsTo(data, expandPoints(shapePoints(drag.eff, drag.start, cursor), brush), drag.key, doc.width, doc.height);
    return { layerId: layer.id, data: data };
  }

  function buildPreviewForMove(dx, dy) {
    const layer = activeLayer();
    const w = doc.width, h = doc.height;
    const data = new Uint16Array(w * h);
    const base = drag.base;
    for (let y = 0; y < h; y++) {
      const sy = y - dy;
      if (sy < 0 || sy >= h) continue;
      for (let x = 0; x < w; x++) {
        const sx = x - dx;
        if (sx < 0 || sx >= w) continue;
        data[y * w + x] = base[sy * w + sx];
      }
    }
    return { layerId: layer.id, data: data };
  }

  function pickColor(p) {
    if (!inBounds(p)) return;
    composite(null);
    const i = (p.y * doc.width + p.x) * 4;
    const d = offImg.data;
    if (d[i + 3] === 0) { setStatus('这个像素是透明的'); return; }
    const hex = rgbToHex(d[i], d[i + 1], d[i + 2]);
    let key = null;
    for (const [k, v] of doc.palette) if (normalizeHex(v.color) === hex) { key = k; break; }
    if (key == null) {
      beginChange();
      key = nextPaletteKey();
      doc.palette.set(key, { color: hex, name: hex });
      commitChange();
      setStatus('已把 ' + hex + ' 加为 ' + key + ' 号色');
    } else {
      setStatus('吸取到 ' + hex + '（' + key + ' 号）');
    }
    activeKey = key;
    refreshPalette();
    refreshColorControls();
    afterChange();
  }

  /* ------------------------------ 指针交互 ------------------------------ */

  stage.addEventListener('pointerdown', (e) => {
    if (!doc) return;
    try { stage.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const p = pixelFromEvent(e);

    if (e.button === 1 || spaceDown) {
      drag = { kind: 'pan', cx: e.clientX, cy: e.clientY, px: view.panX, py: view.panY };
      stage.style.cursor = 'grabbing';
      return;
    }
    if (e.button !== 0 && e.button !== 2) return;

    const right = e.button === 2;
    let eff = tool;
    if (e.altKey) eff = 'picker';
    else if (right) {
      if (tool === 'picker') eff = 'picker';
      else if (tool === 'pencil' || tool === 'eraser') eff = 'eraser';
      else return;
    }

    if (eff === 'picker') { pickColor(p); return; }

    const key = eff === 'eraser' ? 0 : activeKey;

    if (eff === 'fill') {
      beginChange();
      const n = floodFill(activeLayer().data, doc.width, doc.height, p.x, p.y, key);
      if (n > 0) { commitChange(); afterChange(); setStatus('填充了 ' + n + ' 个像素'); }
      else { cancelChange(); setStatus('这个区域已经是这个颜色了'); }
      return;
    }
    if (eff === 'move') {
      beginChange();
      drag = { kind: 'move', start: p, last: p, base: activeLayer().data.slice(), changed: false };
      return;
    }
    if (eff === 'pencil' || eff === 'eraser') {
      beginChange();
      drag = { kind: 'paint', eff: eff, key: key, last: p, changed: false };
      strokeTo(p);
      return;
    }
    /* 形状工具 */
    beginChange();
    drag = { kind: 'shape', eff: eff, key: key, start: p, cur: p };
    render(buildPreviewForShape(p));
  });

  function strokeTo(p) {
    const pts = expandPoints(linePoints(drag.last.x, drag.last.y, p.x, p.y), brush);
    if (paintPoints(pts, drag.key)) drag.changed = true;
    drag.last = p;
    render();
  }

  stage.addEventListener('pointermove', (e) => {
    if (!doc) return;
    const p = pixelFromEvent(e);
    const hoverChanged = !view.hover || view.hover.x !== p.x || view.hover.y !== p.y;
    view.hover = inBounds(p) ? p : null;
    $('statusCursor').textContent = inBounds(p) ? (p.x + ',' + p.y) : '';

    if (!drag) {
      if (hoverChanged) requestRender();
      return;
    }
    if (drag.kind === 'pan') {
      view.panX = drag.px + (e.clientX - drag.cx);
      view.panY = drag.py + (e.clientY - drag.cy);
      requestRender();
      return;
    }
    if (drag.kind === 'paint') {
      let cur = p;
      if (e.shiftKey) {
        cur = { x: p.x, y: drag.last.y };
        if (Math.abs(p.x - drag.last.x) < Math.abs(p.y - drag.last.y)) cur = { x: drag.last.x, y: p.y };
      }
      strokeTo(cur);
      return;
    }
    if (drag.kind === 'shape') {
      drag.cur = p;
      render(buildPreviewForShape(p));
      return;
    }
    if (drag.kind === 'move') {
      const dx = p.x - drag.start.x, dy = p.y - drag.start.y;
      drag.cur = p;
      render(buildPreviewForMove(dx, dy));
      return;
    }
  });

  function endDrag() {
    if (!drag) return;
    const d = drag;
    drag = null;
    stage.style.cursor = 'crosshair';

    if (d.kind === 'pan') { requestRender(); return; }

    if (d.kind === 'paint') {
      if (d.changed) { commitChange(); afterChange(); }
      else cancelChange();
      return;
    }
    if (d.kind === 'shape') {
      const pts = expandPoints(shapePoints(d.eff, d.start, d.cur), brush);
      const changed = paintPoints(pts, d.key);
      if (changed) { commitChange(); afterChange(); }
      else cancelChange();
      return;
    }
    if (d.kind === 'move') {
      const dx = d.cur ? d.cur.x - d.start.x : 0;
      const dy = d.cur ? d.cur.y - d.start.y : 0;
      if (dx || dy) {
        const layer = activeLayer();
        layer.data = buildPreviewForMove(dx, dy).data;
        commitChange();
        afterChange();
        setStatus('图层移动了 (' + dx + ', ' + dy + ')');
      } else {
        cancelChange();
      }
      render();
    }
  }

  stage.addEventListener('pointerup', endDrag);
  stage.addEventListener('pointercancel', endDrag);
  stage.addEventListener('pointerleave', () => {
    if (!drag) { view.hover = null; $('statusCursor').textContent = ''; requestRender(); }
  });
  stage.addEventListener('contextmenu', (e) => e.preventDefault());

  stage.addEventListener('wheel', (e) => {
    if (!doc) return;
    e.preventDefault();
    if (e.ctrlKey || e.metaKey || !e.shiftKey) {
      const factor = Math.pow(1.15, -e.deltaY / 100);
      setZoom(view.zoom * factor, e.clientX, e.clientY);
    } else {
      view.panX -= e.deltaY;
      requestRender();
    }
  }, { passive: false });

  window.addEventListener('resize', () => requestRender());

  /* ------------------------------ 工具箱 ------------------------------ */

  const toolbar = $('toolbar');
  const toolButtons = {};
  for (const t of TOOLS) {
    const b = document.createElement('button');
    b.className = 'tool';
    b.textContent = t.icon;
    b.title = t.name + '（' + t.key + '）';
    b.addEventListener('click', () => setTool(t.id));
    toolbar.appendChild(b);
    toolButtons[t.id] = b;
  }
  const spacer = document.createElement('div');
  spacer.className = 'spacer';
  toolbar.appendChild(spacer);
  const colorIndicator = document.createElement('div');
  colorIndicator.title = '当前颜色';
  colorIndicator.style.cssText = 'width:30px;height:30px;border-radius:7px;border:2px solid #0008;margin-top:2px';
  toolbar.appendChild(colorIndicator);

  function setTool(id) {
    tool = id;
    for (const t of TOOLS) toolButtons[t.id].classList.toggle('active', t.id === id);
    const info = TOOLS.find((t) => t.id === id);
    stage.style.cursor = id === 'move' ? 'move' : id === 'picker' ? 'copy' : 'crosshair';
    setStatus('工具：' + info.name);
  }

  /* ------------------------------ 色卡面板 ------------------------------ */

  function refreshPalette() {
    const wrap = $('swatches');
    wrap.innerHTML = '';
    const keys = [...doc.palette.keys()].sort((a, b) => a - b);
    for (const k of keys) {
      const entry = doc.palette.get(k);
      const b = document.createElement('button');
      b.className = 'swatch' + (k === activeKey ? ' active' : '');
      b.style.background = entry.color;
      b.title = k + ' = ' + entry.color + (entry.name ? '（' + entry.name + '）' : '') + '\n点击选中，双击改颜色';
      const span = document.createElement('span');
      span.className = 'k';
      span.textContent = String(k);
      b.appendChild(span);
      b.addEventListener('click', () => {
        activeKey = k;
        refreshPalette();
        refreshColorControls();
        setStatus('当前色号：' + k + ' = ' + entry.color);
      });
      b.addEventListener('dblclick', () => $('colorPicker').click());
      wrap.appendChild(b);
    }
    if (!doc.palette.has(activeKey)) {
      activeKey = keys.length ? keys[0] : 1;
    }
  }

  function refreshColorControls() {
    const entry = doc.palette.get(activeKey);
    $('activeKeyLabel').textContent = String(activeKey);
    $('colorPicker').value = entry ? normalizeHex(entry.color).toLowerCase() : '#000000';
    $('colorInfo').textContent = entry ? entry.color : '（无色号）';
    colorIndicator.style.background = entry ? entry.color : '#000';
  }

  $('colorPicker').addEventListener('input', () => {
    const entry = doc.palette.get(activeKey);
    if (!entry) return;
    if (!pending) beginChange();
    entry.color = normalizeHex($('colorPicker').value) || entry.color;
    entry.name = entry.color;
    $('colorInfo').textContent = entry.color;
    colorIndicator.style.background = entry.color;
    refreshPalette();
    afterChange();
    clearTimeout(colorEditTimer);
    colorEditTimer = setTimeout(() => { commitChange(); }, 500);
  });

  $('btnAddColor').addEventListener('click', () => {
    beginChange();
    const k = nextPaletteKey();
    doc.palette.set(k, { color: '#808080', name: '新色号' });
    activeKey = k;
    commitChange();
    refreshPalette();
    refreshColorControls();
    afterChange();
    setStatus('新增色号 ' + k);
  });

  $('btnDelColor').addEventListener('click', () => {
    if (doc.palette.size <= 1) { setStatus('至少要留一个色号', 'err'); return; }
    const k = activeKey;
    beginChange();
    doc.palette.delete(k);
    for (const l of doc.layers) {
      for (let i = 0; i < l.data.length; i++) if (l.data[i] === k) l.data[i] = 0;
    }
    activeKey = [...doc.palette.keys()].sort((a, b) => a - b)[0];
    commitChange();
    refreshPalette();
    refreshColorControls();
    afterChange();
    setStatus('删除色号 ' + k + '（使用它的像素已清空）');
  });

  $('btnCopyColor').addEventListener('click', () => {
    const entry = doc.palette.get(activeKey);
    if (!entry) return;
    copyText(entry.color);
    setStatus('已复制 ' + entry.color, 'ok');
  });

  $('palettePreset').addEventListener('change', (e) => {
    const name = e.target.value;
    beginChange();
    const keep = new Map();
    for (const item of presetList(name)) keep.set(item.key, { color: item.color, name: item.name });
    doc.palette = keep;
    if (!doc.palette.has(activeKey)) activeKey = 1;
    commitChange();
    refreshPalette();
    refreshColorControls();
    afterChange();
    setStatus('已套用色卡：' + e.target.selectedOptions[0].textContent);
  });

  /* ------------------------------ 图层面板 ------------------------------ */

  function drawThumb(canvas, layer) {
    const size = canvas.width;
    const c = canvas.getContext('2d');
    const img = c.createImageData(size, size);
    const cache = new Map();
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const sx = Math.min(doc.width - 1, Math.floor(x * doc.width / size));
        const sy = Math.min(doc.height - 1, Math.floor(y * doc.height / size));
        const key = layer.data[sy * doc.width + sx];
        const p = (y * size + x) * 4;
        if (!key) continue;
        const entry = doc.palette.get(key);
        if (!entry) continue;
        let rgb = cache.get(key);
        if (!rgb) { rgb = hexToRgb(entry.color); cache.set(key, rgb); }
        img.data[p] = rgb.r; img.data[p + 1] = rgb.g; img.data[p + 2] = rgb.b; img.data[p + 3] = 255;
      }
    }
    c.clearRect(0, 0, size, size);
    c.putImageData(img, 0, 0);
  }

  function refreshLayers() {
    const list = $('layerList');
    list.innerHTML = '';
    for (let i = doc.layers.length - 1; i >= 0; i--) {
      const layer = doc.layers[i];
      const row = document.createElement('div');
      row.className = 'layer-item' + (layer.id === doc.activeId ? ' active' : '');

      const eye = document.createElement('span');
      eye.className = 'eye';
      eye.textContent = layer.visible ? '👁' : '∅';
      eye.title = '显示 / 隐藏';
      eye.addEventListener('click', (ev) => {
        ev.stopPropagation();
        layer.visible = !layer.visible;
        refreshLayers();
        afterChange();
      });

      const thumb = document.createElement('canvas');
      thumb.className = 'thumb';
      thumb.width = 28; thumb.height = 28;
      thumb.style.width = '28px'; thumb.style.height = '28px';
      drawThumb(thumb, layer);

      const name = document.createElement('span');
      name.className = 'name';
      name.textContent = layer.name + (layer.opacity < 1 ? ' · ' + Math.round(layer.opacity * 100) + '%' : '');
      name.title = '双击重命名';
      name.addEventListener('dblclick', (ev) => {
        ev.stopPropagation();
        const v = window.prompt('图层名', layer.name);
        if (v != null && v.trim()) { layer.name = v.trim(); refreshLayers(); }
      });

      row.appendChild(eye);
      row.appendChild(thumb);
      row.appendChild(name);
      row.addEventListener('click', () => {
        doc.activeId = layer.id;
        refreshLayers();
      });
      list.appendChild(row);
    }
    const cur = activeLayer();
    if (cur) {
      $('layerOpacity').value = String(Math.round(cur.opacity * 100));
      $('opacityLabel').textContent = Math.round(cur.opacity * 100) + '%';
    }
  }

  $('btnLayerAdd').addEventListener('click', () => {
    beginChange();
    const layer = makeLayer('图层 ' + (doc.layers.length + 1), doc.width, doc.height);
    doc.layers.push(layer);
    doc.activeId = layer.id;
    commitChange();
    refreshLayers();
    afterChange();
    setStatus('新建图层');
  });

  $('btnLayerDup').addEventListener('click', () => {
    const cur = activeLayer();
    beginChange();
    const layer = makeLayer(cur.name + ' 副本', doc.width, doc.height);
    layer.data = cur.data.slice();
    layer.opacity = cur.opacity;
    doc.layers.push(layer);
    doc.activeId = layer.id;
    commitChange();
    refreshLayers();
    afterChange();
  });

  $('btnLayerDel').addEventListener('click', () => {
    if (doc.layers.length <= 1) { setStatus('至少要留一个图层', 'err'); return; }
    beginChange();
    const idx = doc.layers.findIndex((l) => l.id === doc.activeId);
    doc.layers.splice(idx, 1);
    doc.activeId = doc.layers[Math.min(idx, doc.layers.length - 1)].id;
    commitChange();
    refreshLayers();
    afterChange();
  });

  $('btnLayerUp').addEventListener('click', () => {
    const idx = doc.layers.findIndex((l) => l.id === doc.activeId);
    if (idx >= doc.layers.length - 1) return;
    beginChange();
    const tmp = doc.layers[idx];
    doc.layers[idx] = doc.layers[idx + 1];
    doc.layers[idx + 1] = tmp;
    commitChange();
    refreshLayers();
    afterChange();
  });

  $('btnLayerDown').addEventListener('click', () => {
    const idx = doc.layers.findIndex((l) => l.id === doc.activeId);
    if (idx <= 0) return;
    beginChange();
    const tmp = doc.layers[idx];
    doc.layers[idx] = doc.layers[idx - 1];
    doc.layers[idx - 1] = tmp;
    commitChange();
    refreshLayers();
    afterChange();
  });

  $('btnLayerMerge').addEventListener('click', () => {
    const idx = doc.layers.findIndex((l) => l.id === doc.activeId);
    if (idx <= 0) { setStatus('最下面的图层没有下一层可以合并', 'err'); return; }
    beginChange();
    const upper = doc.layers[idx], lower = doc.layers[idx - 1];
    for (let i = 0; i < lower.data.length; i++) if (upper.data[i]) lower.data[i] = upper.data[i];
    doc.layers.splice(idx, 1);
    doc.activeId = lower.id;
    commitChange();
    refreshLayers();
    afterChange();
    setStatus('已向下合并');
  });

  $('btnLayerClear').addEventListener('click', () => {
    beginChange();
    activeLayer().data.fill(0);
    commitChange();
    refreshLayers();
    afterChange();
    setStatus('已清空当前图层');
  });

  $('layerOpacity').addEventListener('input', () => {
    const cur = activeLayer();
    if (!cur) return;
    if (!pending) beginChange();
    cur.opacity = Number($('layerOpacity').value) / 100;
    $('opacityLabel').textContent = Math.round(cur.opacity * 100) + '%';
    afterChange();
    clearTimeout(colorEditTimer);
    colorEditTimer = setTimeout(() => { commitChange(); refreshLayers(); }, 500);
  });

  /* ------------------------------ 代码面板 ------------------------------ */

  function showCodeMsg(parsed, extra) {
    const box = $('codeMsg');
    const html = [];
    for (const e of parsed.errors) {
      html.push('<div class="line err"><span class="where">第 ' + (e.line || '?') + ' 行</span>' + escapeHtml(e.message) + '</div>');
    }
    for (const w of parsed.warnings) {
      html.push('<div class="line warn"><span class="where">' + (w.line ? '第 ' + w.line + ' 行' : '提示') + '</span>' + escapeHtml(w.message) + '</div>');
    }
    if (extra) html.push('<div class="line ' + (extra.type || 'ok') + '">' + escapeHtml(extra.message) + '</div>');
    box.innerHTML = html.join('');
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  }

  function writeGrid(data, grid, skipTransparent) {
    const w = doc.width, h = doc.height;
    for (let y = 0; y < h; y++) {
      const row = grid[y] || [];
      for (let x = 0; x < w; x++) {
        const k = row[x] | 0;
        if (skipTransparent && k === 0) continue;
        data[y * w + x] = k;
      }
    }
  }

  function applyCode() {
    const parsed = parsePixelCode($('codeArea').value, { basePalette: paletteColorMap() });
    if (!parsed.ok) {
      showCodeMsg(parsed, { type: 'err', message: '代码有错误，没有改动画布。' });
      setStatus('代码有 ' + parsed.errors.length + ' 处错误', 'err');
      return;
    }
    const target = $('codeTarget').value;
    const skipTransparent = $('chkSkipTransparent').checked;

    if (target !== 'doc' && (parsed.width !== doc.width || parsed.height !== doc.height)) {
      showCodeMsg(parsed, {
        type: 'err',
        message: '代码尺寸 ' + parsed.width + '×' + parsed.height + ' 和画布 ' + doc.width + '×' + doc.height +
          ' 不一致，所以没有动动画布。可以点下面的按钮改成「替换整个文档」，或先把画布调成同样大小。',
      });
      const fix = document.createElement('button');
      fix.textContent = '改成「替换整个文档」并应用';
      fix.dataset.fix = 'doc';
      $('codeMsg').appendChild(fix);
      setStatus('尺寸不一致', 'err');
      return;
    }

    beginChange();
    /* 色卡：代码里定义了的色号覆盖色卡 */
    for (const [k, color] of parsed.defs) {
      const entry = doc.palette.get(k);
      if (entry) { entry.color = color; entry.name = color; }
      else doc.palette.set(k, { color: color, name: color });
    }
    for (const k of parsed.missingKeys) {
      if (!doc.palette.has(k)) doc.palette.set(k, { color: '#FF00FF', name: '未定义' });
    }

    if (target === 'doc') {
      doc.width = parsed.width;
      doc.height = parsed.height;
      const layer = makeLayer('图层 1', doc.width, doc.height);
      writeGrid(layer.data, parsed.grid, false);
      doc.layers = [layer];
      doc.activeId = layer.id;
      syncOffscreen();
      fitView();
    } else if (target === 'newlayer') {
      const layer = makeLayer('代码图层', doc.width, doc.height);
      writeGrid(layer.data, parsed.grid, skipTransparent);
      doc.layers.push(layer);
      doc.activeId = layer.id;
    } else {
      writeGrid(activeLayer().data, parsed.grid, skipTransparent);
    }

    commitChange();
    refreshPalette();
    refreshColorControls();
    refreshLayers();
    afterChange();
    showCodeMsg(parsed, {
      type: 'ok',
      message: '已应用：' + parsed.width + '×' + parsed.height + '，用到色号 ' + (parsed.usedKeys.join('、') || '无'),
    });
    setStatus('代码已应用到画布', 'ok');
  }

  function layerToGrid(layer) {
    const grid = [];
    for (let y = 0; y < doc.height; y++) {
      const row = new Array(doc.width);
      for (let x = 0; x < doc.width; x++) row[x] = layer.data[y * doc.width + x];
      grid.push(row);
    }
    return grid;
  }

  function flatToGrid() {
    composite(null);
    const d = offImg.data;
    const grid = [];
    for (let y = 0; y < doc.height; y++) {
      const row = new Array(doc.width);
      for (let x = 0; x < doc.width; x++) {
        const p = (y * doc.width + x) * 4;
        if (d[p + 3] === 0) { row[x] = 0; continue; }
        row[x] = ensurePaletteKey(rgbToHex(d[p], d[p + 1], d[p + 2]));
      }
      grid.push(row);
    }
    return grid;
  }

  function generateCode() {
    const src = $('codeSource').value;
    let grid;
    if (src === 'flat') {
      beginChange();
      grid = flatToGrid();
      const changed = pending.palette.length !== doc.palette.size;
      if (changed) { commitChange(); refreshPalette(); refreshColorControls(); }
      else cancelChange();
    } else {
      grid = layerToGrid(activeLayer());
    }
    $('codeArea').value = serializePixelCode({
      width: doc.width,
      height: doc.height,
      grid: grid,
      palette: paletteColorMap(),
      defs: $('chkDefs').checked,
      pad: $('chkPad').checked,
      title: (src === 'flat' ? '合成' : activeLayer().name) + ' ' + doc.width + '×' + doc.height,
    });
    $('codeMsg').innerHTML = '<div class="line ok">已从画布生成代码（' + doc.width + '×' + doc.height + '）。</div>';
    setStatus('已生成代码', 'ok');
  }

  $('btnApplyCode').addEventListener('click', applyCode);
  $('btnGenCode').addEventListener('click', generateCode);

  /* 尺寸不一致时，提示里的「一键改成替换整个文档」按钮 */
  $('codeMsg').addEventListener('click', (e) => {
    const target = e.target && e.target.closest ? e.target.closest('[data-fix]') : null;
    if (!target) return;
    $('codeTarget').value = target.dataset.fix;
    applyCode();
  });

  $('codeArea').addEventListener('input', () => {
    clearTimeout(validateTimer);
    validateTimer = setTimeout(() => {
      const parsed = parsePixelCode($('codeArea').value, { basePalette: paletteColorMap() });
      const extra = parsed.ok
        ? { type: 'ok', message: '语法检查通过：' + parsed.width + '×' + parsed.height + '，' + parsed.usedKeys.length + ' 个色号。点「应用代码」画上去。' }
        : null;
      showCodeMsg(parsed, extra);
    }, 400);
  });

  $('btnExample').addEventListener('click', () => {
    $('codeArea').value = EXAMPLE_CODE;
    $('codeMsg').innerHTML = '<div class="line ok">已载入示例代码，点「▶ 应用代码」画到画布上。</div>';
  });

  $('btnCodeCopy').addEventListener('click', () => {
    copyText($('codeArea').value);
    setStatus('代码已复制', 'ok');
  });

  $('btnCodeDownload').addEventListener('click', () => {
    downloadBlob(new Blob([$('codeArea').value], { type: 'text/plain;charset=utf-8' }), 'seedimage-' + doc.width + 'x' + doc.height + '.txt');
  });

  $('btnCodeUpload').addEventListener('click', () => $('fileCode').click());
  $('fileCode').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      $('codeArea').value = String(reader.result);
      selectTab('code');
      const parsed = parsePixelCode($('codeArea').value, { basePalette: paletteColorMap() });
      showCodeMsg(parsed, parsed.ok ? { type: 'ok', message: '文件已导入，点「应用代码」画上去。' } : null);
    };
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  });

  /* ------------------------------ 文件 / 弹窗 ------------------------------ */

  function serializeProject() {
    return {
      format: 'seedimage',
      version: 1,
      width: doc.width,
      height: doc.height,
      activeKey: activeKey,
      activeIndex: Math.max(0, doc.layers.findIndex((l) => l.id === doc.activeId)),
      palette: [...doc.palette].map(([k, v]) => ({ key: k, color: v.color, name: v.name })),
      layers: doc.layers.map((l) => ({
        name: l.name, visible: l.visible, opacity: l.opacity, data: Array.from(l.data),
      })),
    };
  }

  function loadProject(o) {
    if (!o || o.format !== 'seedimage') throw new Error('这不是 SeedImage 项目文件');
    const w = o.width | 0, h = o.height | 0;
    if (!(w > 0 && h > 0)) throw new Error('画布尺寸无效');
    if (w > 1024 || h > 1024) throw new Error('画布太大（上限 1024×1024）');
    const d = { width: w, height: h, palette: new Map(), layers: [], activeId: 0 };
    for (const e of o.palette || []) {
      d.palette.set(e.key | 0, { color: normalizeHex(e.color) || '#000000', name: e.name || '' });
    }
    if (!d.palette.size) d.palette.set(1, { color: '#E53935', name: '红' });
    for (const l of o.layers || []) {
      const layer = {
        id: ++uid,
        name: l.name || ('图层 ' + (d.layers.length + 1)),
        visible: l.visible !== false,
        opacity: typeof l.opacity === 'number' ? l.opacity : 1,
        data: new Uint16Array(w * h),
      };
      const src = l.data || [];
      const n = Math.min(layer.data.length, src.length);
      for (let i = 0; i < n; i++) layer.data[i] = src[i] | 0;
      d.layers.push(layer);
    }
    if (!d.layers.length) d.layers.push(makeLayer('图层 1', w, h));
    const idx = Math.min(Math.max(0, o.activeIndex | 0), d.layers.length - 1);
    d.activeId = d.layers[idx].id;
    doc = d;
    activeKey = d.palette.has(o.activeKey) ? o.activeKey : [...d.palette.keys()].sort((a, b) => a - b)[0];
    syncOffscreen();
    fitView();
    refreshAll();
    afterChange();
  }

  $('btnSave').addEventListener('click', () => {
    downloadBlob(new Blob([JSON.stringify(serializeProject())], { type: 'application/json' }),
      'seedimage-' + doc.width + 'x' + doc.height + '.json');
    setStatus('项目已保存', 'ok');
  });

  $('btnOpen').addEventListener('click', () => $('fileProject').click());
  $('fileProject').addEventListener('change', (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        loadProject(JSON.parse(String(reader.result)));
        setStatus('项目已打开', 'ok');
      } catch (err) {
        setStatus('打开失败：' + err.message, 'err');
      }
    };
    reader.readAsText(f, 'utf-8');
    e.target.value = '';
  });

  function dialogNew() {
    const opts = Object.keys(PALETTE_PRESETS)
      .map((k) => '<option value="' + k + '">' + k + '</option>').join('');
    openModal({
      title: '新建画布',
      body:
        '<div class="frow"><span class="label">宽</span><input type="number" id="mW" value="32" min="1" max="1024">' +
        '<span class="label">高</span><input type="number" id="mH" value="32" min="1" max="1024"> 像素</div>' +
        '<div class="frow"><span class="label">常用</span>' +
        '<button data-size="8">8</button><button data-size="16">16</button>' +
        '<button data-size="32">32</button><button data-size="64">64</button><button data-size="128">128</button></div>' +
        '<div class="frow"><span class="label">色卡</span><select id="mPreset">' + opts +
        '<option value="keep">保持当前色卡</option></select></div>' +
        '<p class="muted small">新建会替换当前画布，可以用 Ctrl+Z 撤销。</p>',
      okText: '新建',
      onSubmit: function () {
        const w = Math.max(1, Math.min(1024, +$('mW').value | 0));
        const h = Math.max(1, Math.min(1024, +$('mH').value | 0));
        const preset = $('mPreset').value;
        const old = doc, oldKey = activeKey;
        beginChange();
        doc = createDoc(w, h, preset === 'keep' ? 'default' : preset);
        if (preset === 'keep') {
          doc.palette = new Map([...old.palette].map(([k, v]) => [k, { color: v.color, name: v.name }]));
        }
        activeKey = doc.palette.has(oldKey) ? oldKey : [...doc.palette.keys()].sort((a, b) => a - b)[0];
        syncOffscreen();
        undoStack.push(pending); pending = null;
        if (undoStack.length > MAX_HISTORY) undoStack.shift();
        redoStack.length = 0;
        updateUndoButtons();
        fitView();
        refreshAll();
        afterChange();
        setStatus('新建 ' + w + '×' + h + ' 画布', 'ok');
      },
    });
    const body = $('modalBody');
    body.querySelectorAll('[data-size]').forEach((b) => {
      b.addEventListener('click', () => { $('mW').value = b.dataset.size; $('mH').value = b.dataset.size; });
    });
  }

  function dialogResize() {
    openModal({
      title: '调整画布尺寸',
      body:
        '<div class="frow"><span class="label">宽</span><input type="number" id="mW" value="' + doc.width + '" min="1" max="1024">' +
        '<span class="label">高</span><input type="number" id="mH" value="' + doc.height + '" min="1" max="1024"> 像素</div>' +
        '<div class="frow"><span class="label">对齐</span><select id="mAnchor">' +
        '<option value="center">居中</option><option value="topleft">左上角</option></select></div>' +
        '<p class="muted small">超出新尺寸的像素会被裁掉，原内容可以 Ctrl+Z 找回。</p>',
      okText: '调整',
      onSubmit: function () {
        const w = Math.max(1, Math.min(1024, +$('mW').value | 0));
        const h = Math.max(1, Math.min(1024, +$('mH').value | 0));
        const anchor = $('mAnchor').value;
        const dx = anchor === 'center' ? Math.floor((w - doc.width) / 2) : 0;
        const dy = anchor === 'center' ? Math.floor((h - doc.height) / 2) : 0;
        beginChange();
        for (const layer of doc.layers) {
          const nd = new Uint16Array(w * h);
          for (let y = 0; y < doc.height; y++) {
            const ny = y + dy;
            if (ny < 0 || ny >= h) continue;
            for (let x = 0; x < doc.width; x++) {
              const nx = x + dx;
              if (nx < 0 || nx >= w) continue;
              nd[ny * w + nx] = layer.data[y * doc.width + x];
            }
          }
          layer.data = nd;
        }
        doc.width = w;
        doc.height = h;
        commitChange();
        syncOffscreen();
        fitView();
        refreshAll();
        afterChange();
        setStatus('画布已调整为 ' + w + '×' + h, 'ok');
      },
    });
  }

  function dialogExport() {
    openModal({
      title: '导出 PNG',
      body:
        '<div class="frow"><span class="label">放大</span><select id="mScale">' +
        [1, 2, 4, 8, 16].map((s) => '<option value="' + s + '"' + (s === 8 ? ' selected' : '') + '>' + s + '×</option>').join('') +
        '</select><span class="label">背景</span><select id="mBg">' +
        '<option value="transparent">透明</option><option value="#FFFFFF">白色</option>' +
        '<option value="#000000">黑色</option><option value="#9E9E9E">灰色</option></select></div>' +
        '<p class="muted small">导出的是所有可见图层合成后的图像。</p>',
      okText: '导出',
      onSubmit: function () {
        exportPNG(+$('mScale').value | 0, $('mBg').value);
      },
    });
  }

  function exportPNG(scale, bg) {
    scale = Math.max(1, Math.min(64, scale || 1));
    composite(null);
    const c = document.createElement('canvas');
    c.width = doc.width * scale;
    c.height = doc.height * scale;
    const cc = c.getContext('2d');
    cc.imageSmoothingEnabled = false;
    if (bg !== 'transparent') { cc.fillStyle = bg; cc.fillRect(0, 0, c.width, c.height); }
    cc.drawImage(off, 0, 0, c.width, c.height);
    c.toBlob((blob) => {
      downloadBlob(blob, 'seedimage-' + doc.width + 'x' + doc.height + (scale > 1 ? '@' + scale + 'x' : '') + '.png');
      setStatus('PNG 已导出', 'ok');
    });
  }

  $('btnExportPng').addEventListener('click', dialogExport);
  $('btnNew').addEventListener('click', dialogNew);
  $('btnResize').addEventListener('click', dialogResize);
  $('btnHelp').addEventListener('click', () => openModal({ title: '代码语法', body: HELP_HTML }));

  /* ------------------------------ 弹窗基础 ------------------------------ */

  let modalSubmit = null;
  function openModal(opts) {
    $('modalTitle').textContent = opts.title;
    $('modalBody').innerHTML = opts.body;
    $('modalOk').textContent = opts.okText || '确定';
    $('modalOk').style.display = opts.onSubmit ? '' : 'none';
    $('modalCancel').textContent = opts.onSubmit ? '取消' : '关闭';
    modalSubmit = opts.onSubmit || null;
    $('modal').hidden = false;
    const first = $('modalBody').querySelector('input, select, button');
    if (first) setTimeout(() => first.focus(), 30);
  }
  function closeModal() { $('modal').hidden = true; modalSubmit = null; }

  $('modalOk').addEventListener('click', () => {
    if (!modalSubmit) { closeModal(); return; }
    if (modalSubmit() !== false) closeModal();
  });
  $('modalCancel').addEventListener('click', closeModal);
  $('modal').addEventListener('click', (e) => { if (e.target === $('modal')) closeModal(); });

  /* ------------------------------ 辅助 ------------------------------ */

  function setStatus(msg, type) {
    const el = $('statusMsg');
    el.textContent = msg;
    el.className = type || 'muted';
    clearTimeout(statusTimer);
    if (type === 'ok' || type === 'err') statusTimer = setTimeout(() => { el.textContent = ''; el.className = 'muted'; }, 4000);
  }

  function updateStatus() {
    const cur = activeLayer();
    $('statusInfo').textContent =
      doc.width + '×' + doc.height + ' · 图层 ' + doc.layers.length + '（' + (cur ? cur.name : '-') + '）· 色号 ' + activeKey;
  }

  function copyText(text) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).catch(() => {});
    } else {
      const ta = document.createElement('textarea');
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand('copy'); } catch (err) { /* ignore */ }
      document.body.removeChild(ta);
    }
  }

  function downloadBlob(blob, filename) {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }

  function selectTab(name) {
    document.querySelectorAll('.tab').forEach((t) => t.classList.toggle('active', t.dataset.tab === name));
    document.querySelectorAll('.panel').forEach((p) => p.classList.toggle('active', p.id === 'panel-' + name));
  }

  document.querySelectorAll('.tab').forEach((t) => {
    t.addEventListener('click', () => selectTab(t.dataset.tab));
  });

  function afterChange() {
    requestRender();
    updateStatus();
    scheduleAutosave();
  }

  function refreshAll() {
    refreshPalette();
    refreshColorControls();
    refreshLayers();
    updateStatus();
    updateUndoButtons();
    requestRender();
  }

  function scheduleAutosave() {
    clearTimeout(autosaveTimer);
    autosaveTimer = setTimeout(() => {
      try {
        if (doc.width * doc.height * doc.layers.length > 2000000) return;
        localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(serializeProject()));
      } catch (err) { /* 空间不足就算了 */ }
    }, 800);
  }

  /* ------------------------------ 缩放按钮 / 网格 ------------------------------ */

  $('btnZoomIn').addEventListener('click', () => setZoom(view.zoom * 1.5));
  $('btnZoomOut').addEventListener('click', () => setZoom(view.zoom / 1.5));
  $('btnFit').addEventListener('click', fitView);
  $('btnZoomReset').addEventListener('click', () => { view.zoom = 1; centerView(); updateZoomLabel(); });
  $('chkGrid').addEventListener('change', () => { view.grid = $('chkGrid').checked; requestRender(); });

  $('brushSize').addEventListener('change', () => {
    brush = Math.max(1, Math.min(32, +$('brushSize').value | 0));
    $('brushSize').value = String(brush);
  });

  $('btnUndo').addEventListener('click', undo);
  $('btnRedo').addEventListener('click', redo);

  /* ------------------------------ 快捷键 ------------------------------ */

  window.addEventListener('keydown', (e) => {
    const tag = (e.target && e.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') {
      if (e.key === 'Escape') e.target.blur();
      return;
    }
    const mod = e.ctrlKey || e.metaKey;
    if (mod) {
      const k = e.key.toLowerCase();
      if (k === 'z' && !e.shiftKey) { e.preventDefault(); undo(); return; }
      if (k === 'y' || (k === 'z' && e.shiftKey)) { e.preventDefault(); redo(); return; }
      if (k === 's') { e.preventDefault(); $('btnSave').click(); return; }
      if (k === 'n') { e.preventDefault(); dialogNew(); return; }
      if (k === '0') { e.preventDefault(); fitView(); return; }
      return;
    }
    if (e.key === ' ') {
      spaceDown = true;
      stage.style.cursor = 'grab';
      e.preventDefault();
      return;
    }
    if (e.key === '+' || e.key === '=') { setZoom(view.zoom * 1.5); return; }
    if (e.key === '-' || e.key === '_') { setZoom(view.zoom / 1.5); return; }
    if (e.key === '[') { brush = Math.max(1, brush - 1); $('brushSize').value = String(brush); setStatus('笔刷 ' + brush); return; }
    if (e.key === ']') { brush = Math.min(32, brush + 1); $('brushSize').value = String(brush); setStatus('笔刷 ' + brush); return; }
    if (/^[0-9]$/.test(e.key)) {
      const k = e.key === '0' ? 10 : +e.key;
      if (doc.palette.has(k)) {
        activeKey = k;
        refreshPalette();
        refreshColorControls();
        setStatus('当前色号：' + k);
      }
      return;
    }
    const low = e.key.toLowerCase();
    if (low === 'p') setTool('pencil');
    else if (low === 'e') setTool('eraser');
    else if (low === 'g') setTool('fill');
    else if (low === 'l') setTool('line');
    else if (low === 'r') setTool(e.shiftKey ? 'rectFill' : 'rect');
    else if (low === 'o') setTool('ellipse');
    else if (low === 'i') setTool('picker');
    else if (low === 'v') setTool('move');
  });

  window.addEventListener('keyup', (e) => {
    if (e.key === ' ') {
      spaceDown = false;
      if (!drag) stage.style.cursor = tool === 'move' ? 'move' : 'crosshair';
    }
  });

  /* ------------------------------ 对外脚本 API ------------------------------ */
  /* 打开软件后，在浏览器控制台里可以直接这样用：
       SeedImage.setPixel(0, 0, 1)                  // 画一个 1 号色像素
       SeedImage.paint(0, 0, 10, 10, 3)             // 画线
       SeedImage.shape('ellipse', 2, 2, 20, 20, 5)  // 画椭圆
       SeedImage.toCode({ pad: true })              // 导出代码
  */
  function apiGrid(source) {
    if (source === 'flat') return flatToGrid();
    return layerToGrid(activeLayer());
  }

  window.SeedImage = {
    version: 1,
    core: SeedImageCore,
    getDoc: () => doc,
    getView: () => view,
    getActiveKey: () => activeKey,
    setActiveKey: (k) => {
      if (!doc.palette.has(k)) return false;
      activeKey = k;
      refreshPalette();
      refreshColorControls();
      return true;
    },
    setTool: setTool,
    setPixel: (x, y, key) => {
      beginChange();
      const changed = applyPointsTo(activeLayer().data, [[x | 0, y | 0]], key | 0, doc.width, doc.height);
      if (changed) commitChange(); else cancelChange();
      afterChange();
      return changed;
    },
    paint: (x0, y0, x1, y1, key, size) => {
      beginChange();
      const pts = expandPoints(linePoints(x0, y0, x1, y1), size || 1);
      const changed = applyPointsTo(activeLayer().data, pts, key | 0, doc.width, doc.height);
      if (changed) commitChange(); else cancelChange();
      afterChange();
      return changed;
    },
    shape: (kind, x0, y0, x1, y1, key, size) => {
      beginChange();
      const pts = expandPoints(shapePoints(kind, { x: x0, y: y0 }, { x: x1, y: y1 }), size || 1);
      const changed = applyPointsTo(activeLayer().data, pts, key | 0, doc.width, doc.height);
      if (changed) commitChange(); else cancelChange();
      afterChange();
      return changed;
    },
    fill: (x, y, key) => {
      beginChange();
      const n = floodFill(activeLayer().data, doc.width, doc.height, x | 0, y | 0, key | 0);
      if (n) commitChange(); else cancelChange();
      afterChange();
      return n;
    },
    clear: (key) => {
      beginChange();
      activeLayer().data.fill(key | 0);
      commitChange();
      afterChange();
    },
    setCode: (text) => { $('codeArea').value = String(text == null ? '' : text); return apiParse($('codeArea').value); },
    getCode: () => $('codeArea').value,
    parse: apiParse,
    toCode: (opts) => {
      const o = opts || {};
      return serializePixelCode({
        width: doc.width,
        height: doc.height,
        grid: apiGrid(o.source),
        palette: paletteColorMap(),
        defs: o.defs !== false,
        pad: !!o.pad,
        comments: o.comments !== false,
        title: o.title,
      });
    },
    applyCode: applyCode,
    generateCode: generateCode,
    undo: undo,
    redo: redo,
  };

  function apiParse(text) {
    return parsePixelCode(text, { basePalette: paletteColorMap() });
  }

  /* ------------------------------ 启动 ------------------------------ */

  function init() {
    doc = createDoc(32, 32, 'default');
    activeKey = 1;
    syncOffscreen();
    $('codeArea').value = EXAMPLE_CODE;
    setTool('pencil');
    try {
      const saved = localStorage.getItem(AUTOSAVE_KEY);
      if (saved) {
        loadProject(JSON.parse(saved));
        setStatus('已恢复上次编辑的内容', 'ok');
      }
    } catch (err) { /* 忽略损坏的自动保存 */ }
    if (!doc || !doc.layers.length) doc = createDoc(32, 32, 'default');
    fitView();
    refreshAll();
    showCodeMsg({ errors: [], warnings: [] }, { type: 'ok', message: '点「▶ 应用代码」把右边代码画到画布上（示例已填好）。' });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();

})();
