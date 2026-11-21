/* SeedImage 核心：颜色解析、像素代码解析/生成、几何算法、洪水填充
 * 零依赖 ESM，可在 node 里直接 import。
 */

/* 尺寸行：允许后面跟说明文字，例如 `5*5（5*5像素）` */
const SIZELINE_RE = /^\s*(\d+)\s*[*x×X✕]\s*(\d+)\b/;
const DEFLINE_RE = /^(\d+)\s*=\s*(.+)$/;
const TOKEN_RE = /<([^<>]*)>/g;

const TRANSPARENT_TOKENS = new Set(['', '.', '0', '-', '_', 'x', '×', '透明', '空', 'none', 'null']);

export const NAMED_COLORS = {
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

export const PALETTE_PRESETS = {
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
  gray: Array.from({ length: 16 }, (_, i) => {
    const v = i * 17;
    return { key: i + 1, color: rgbToHex(v, v, v), name: '灰' + (i + 1) };
  }),
  warm: [
    { key: 1, color: '#FFF3E0', name: '米白' }, { key: 2, color: '#FFE0B2', name: '浅杏' },
    { key: 3, color: '#FFCC80', name: '杏' }, { key: 4, color: '#FFB74D', name: '橘黄' },
    { key: 5, color: '#FF9800', name: '橙' }, { key: 6, color: '#F4511E', name: '朱红' },
    { key: 7, color: '#D84315', name: '砖红' }, { key: 8, color: '#BF360C', name: '深砖' },
    { key: 9, color: '#E53935', name: '红' }, { key: 10, color: '#AD1457', name: '玫红' },
    { key: 11, color: '#6D4C41', name: '棕' }, { key: 12, color: '#3E2723', name: '深棕' },
  ],
};

/* ------------------------------ 颜色 ------------------------------ */

export function clamp255(v) {
  let n = Math.round(Number(v));
  if (!isFinite(n)) n = 0;
  return n < 0 ? 0 : n > 255 ? 255 : n;
}

export function rgbToHex(r, g, b) {
  return '#' + [r, g, b].map((v) => clamp255(v).toString(16).padStart(2, '0')).join('').toUpperCase();
}

export function normalizeHex(input) {
  let s = String(input == null ? '' : input).trim().replace(/^0x/i, '#');
  if (s.charAt(0) === '#') s = s.slice(1);
  if (!/^[0-9a-fA-F]+$/.test(s)) return null;
  if (s.length === 3 || s.length === 4) s = s.slice(0, 3).split('').map((c) => c + c).join('');
  else if (s.length === 6 || s.length === 8) s = s.slice(0, 6);
  else return null;
  return ('#' + s).toUpperCase();
}

export function hexToRgb(hex) {
  const h = normalizeHex(hex) || '#000000';
  const n = parseInt(h.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

/** #f00 / #FF0000 / rgb(255,0,0) / 255,0,0 / 红 / red */
export function parseColorSpec(spec) {
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

/** 色卡定义行右边的颜色：允许后面跟 `# 注释`，但不会把 `2 = #FB8C00` 的十六进制当注释 */
export function colorFromRhs(rhs) {
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

/** 各种形态的色卡 → { 色号: '#RRGGBB' } */
export function toColorMap(palette) {
  const out = {};
  if (!palette) return out;
  if (palette instanceof Map) {
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

/* --------------------------- 像素代码解析 --------------------------- */

/**
 * 解析 SeedImage 像素代码。
 *   # 注释 / // 注释
 *   1 = 红                色卡定义（可选，写了就覆盖色卡）
 *   5*5                   尺寸（可选；不写按行列推断）
 *   <1><1><1><1><1>        像素行，每个颜色都要用 <> 包起来
 *   <0> / <>              透明
 *   <#FF0000>             直接写颜色（自动占一个色号）
 */
export function parsePixelCode(text, options = {}) {
  const base = toColorMap(options.basePalette);
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
    if (/^\s*(#|\/\/)/.test(line)) continue;
    const cut = line.indexOf('//');
    if (cut >= 0) line = line.slice(0, cut);
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
        if (!color) errors.push({ line: lineNo, message: '认不出的颜色：' + defM[2].trim().slice(0, 30) });
        else defs.set(+defM[1], color);
        continue;
      }
      if (/^\s*\d+(\s*[,，、]\s*\d+)+\s*=/.test(line)) {
        warnings.push({ line: lineNo, message: '已忽略说明行：' + line.trim().slice(0, 30) });
        continue;
      }
      errors.push({ line: lineNo, message: '认不出的行：' + line.trim().slice(0, 40) });
      continue;
    }

    rowLines.push({ line: line.replace(/\s+#.*$/, ''), lineNo });
  }

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
    rawGrid.push({ tokens, lineNo: rl.lineNo });
    if (tokens.length > maxW) maxW = tokens.length;
  }

  if (!rawGrid.length && !errors.length) {
    errors.push({ line: 0, message: '没有找到任何像素数据行（每一行形如 <1><1><1>）' });
  }

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

  let width = header ? header.w : maxW;
  let height = header ? header.h : grid.length;
  if (!(width > 0) || !(height > 0)) {
    errors.push({ line: header ? header.line : 0, message: '画布尺寸必须是正整数' });
    width = Math.max(1, width || maxW || 1);
    height = Math.max(1, height || grid.length || 1);
  }
  if (width > 2048 || height > 2048) {
    errors.push({ line: header ? header.line : 0, message: '尺寸太大（上限 2048 × 2048）' });
  }
  if (header && grid.length !== header.h) {
    warnings.push({ line: header.line, message: '实际有 ' + grid.length + ' 行像素，尺寸头写的是 ' + header.h + ' 行' });
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
    width, height,
    grid: norm,
    defs,
    usedKeys: [...used].sort((a, b) => a - b),
    missingKeys: [...missing].sort((a, b) => a - b),
    errors, warnings, header,
  };
}

/* --------------------------- 像素代码生成 --------------------------- */

export function serializePixelCode(spec) {
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
    for (const k of keys) out.push(k + ' = ' + (normalizeHex(colors[k]) || '#FF00FF'));
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

/* ------------------------------ 几何 ------------------------------ */

export function linePoints(x0, y0, x1, y1) {
  const pts = [];
  let x = Math.round(x0), y = Math.round(y0);
  const ex = Math.round(x1), ey = Math.round(y1);
  const dx = Math.abs(ex - x), dy = Math.abs(ey - y);
  const sx = x < ex ? 1 : -1, sy = y < ey ? 1 : -1;
  let err = dx - dy;
  for (let guard = 0; guard < 200000; guard++) {
    pts.push([x, y]);
    if (x === ex && y === ey) break;
    const e2 = 2 * err;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx) { err += dx; y += sy; }
  }
  return pts;
}

export function rectPoints(x0, y0, x1, y1, fill) {
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

export function ellipsePoints(x0, y0, x1, y1, fill) {
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

export function expandPoints(pts, size) {
  const s = Math.max(1, size | 0);
  if (s === 1) return pts;
  const off = Math.floor((s - 1) / 2);
  const out = [];
  const seen = new Set();
  for (const [x, y] of pts) {
    for (let dy = 0; dy < s; dy++) {
      for (let dx = 0; dx < s; dx++) {
        const nx = x - off + dx, ny = y - off + dy;
        const k = ny * 8192 + nx;
        if (seen.has(k)) continue;
        seen.add(k);
        out.push([nx, ny]);
      }
    }
  }
  return out;
}

/** 四连通洪水填充，返回改写的像素数 */
export function floodFill(data, w, h, x, y, key) {
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

export default {
  NAMED_COLORS, PALETTE_PRESETS,
  normalizeHex, hexToRgb, rgbToHex, parseColorSpec, colorFromRhs, toColorMap,
  parsePixelCode, serializePixelCode,
  linePoints, rectPoints, ellipsePoints, expandPoints, floodFill,
};
