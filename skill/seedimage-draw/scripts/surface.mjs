/* Surface：给脚本用的画布 API
 *
 *   import { createSurface } from './surface.mjs';
 *   const s = createSurface(32, 32);
 *   s.ellipse(2, 2, 29, 29, '黄', { fill: true });
 *   s.text(16, 10, 'HI', '黑', { align: 'center' });
 *
 * 颜色参数 c 可以是：
 *   - 色号（数字）：必须在色卡里定义过，否则报错（避免画出洋红占位色）
 *   - 颜色写法（字符串）：'#FF0000' / '#f00' / 'red' / '红' / 'rgb(255,0,0)'
 *     没在色卡里的颜色会自动分配一个新色号
 */

import {
  PALETTE_PRESETS, normalizeHex, hexToRgb, parseColorSpec, toColorMap,
  serializePixelCode, linePoints, rectPoints, ellipsePoints, expandPoints, floodFill,
} from './core.mjs';
import { glyphOf, GLYPH_W, GLYPH_H, measureText } from './font5x7.mjs';

export class Surface {
  constructor(width, height, options = {}) {
    this.width = Math.floor(width);
    this.height = Math.floor(height);
    if (!(this.width > 0) || !(this.height > 0)) throw new Error('画布尺寸必须是正整数');
    if (this.width > 2048 || this.height > 2048) throw new Error('画布最大 2048 × 2048');
    this.palette = new Map();
    const preset = PALETTE_PRESETS[options.palette || 'default'] || PALETTE_PRESETS.default;
    for (const e of preset) this.palette.set(e.key, e.color);
    if (options.colors) this.defs(options.colors);
    this.data = new Uint16Array(this.width * this.height);
    this.title = options.title || '';
  }

  /* ---------------- 色卡 ---------------- */

  /** 定义 / 覆盖色号：def(1, '#E53935') 或 def({ 1: '#E53935', 2: 'gold' }) */
  defs(colors) {
    for (const [k, v] of Object.entries(toColorMap(colors))) {
      const hex = normalizeHex(v) || parseColorSpec(v);
      if (!hex) throw new Error('认不出的颜色：' + v);
      this.palette.set(Number(k), hex);
    }
    return this;
  }

  def(key, color) {
    const hex = normalizeHex(color) || parseColorSpec(color);
    if (!hex) throw new Error('认不出的颜色：' + color);
    this.palette.set(Number(key), hex);
    return this;
  }

  nextKey() {
    let max = 0;
    for (const k of this.palette.keys()) if (k > max) max = k;
    return max + 1;
  }

  /** 颜色写法 / 色号 → 色号 */
  colorOf(c) {
    if (typeof c === 'number') {
      const k = Math.floor(c);
      if (k === 0) return 0;
      if (!this.palette.has(k)) {
        throw new Error('色号 ' + k + ' 还没有颜色，请先用 s.def(' + k + ", '#RRGGBB') 定义，" +
          '或者直接传颜色字符串');
      }
      return k;
    }
    if (c == null) return 0;
    const hex = normalizeHex(c) || parseColorSpec(c);
    if (!hex) throw new Error('认不出的颜色：' + c);
    for (const [k, v] of this.palette) if (normalizeHex(v) === hex) return k;
    const k = this.nextKey();
    this.palette.set(k, hex);
    return k;
  }

  hexOf(key) {
    return this.palette.get(key) || null;
  }

  usedKeys() {
    const used = new Set();
    for (const k of this.data) if (k) used.add(k);
    return [...used].sort((a, b) => a - b);
  }

  /* ---------------- 基础像素 ---------------- */

  inside(x, y) {
    return x >= 0 && y >= 0 && x < this.width && y < this.height;
  }

  px(x, y, c) {
    const k = this.colorOf(c);
    if (this.inside(x, y)) this.data[y * this.width + x] = k;
    return this;
  }

  get(x, y) {
    return this.inside(x, y) ? this.data[y * this.width + x] : 0;
  }

  _apply(pts, c, size) {
    const k = this.colorOf(c);
    for (const [x, y] of expandPoints(pts, size || 1)) {
      if (this.inside(x, y)) this.data[y * this.width + x] = k;
    }
    return this;
  }

  line(x0, y0, x1, y1, c, options = {}) {
    return this._apply(linePoints(x0, y0, x1, y1), c, options.size);
  }

  rect(x0, y0, x1, y1, c, options = {}) {
    return this._apply(rectPoints(x0, y0, x1, y1, !!options.fill), c, options.size);
  }

  ellipse(x0, y0, x1, y1, c, options = {}) {
    return this._apply(ellipsePoints(x0, y0, x1, y1, !!options.fill), c, options.size);
  }

  circle(cx, cy, r, c, options = {}) {
    const r2 = Math.max(0, Math.round(r));
    return this.ellipse(cx - r2, cy - r2, cx + r2, cy + r2, c, options);
  }

  /** 油漆桶：把 (x,y) 所在的同色连通区域填成 c */
  fill(x, y, c) {
    floodFill(this.data, this.width, this.height, x, y, this.colorOf(c));
    return this;
  }

  /** 整块铺底 */
  bg(c) {
    this.data.fill(this.colorOf(c));
    return this;
  }

  /** 用一块矩形区域覆盖 */
  clearRect(x0, y0, x1, y1) {
    const left = Math.max(0, Math.min(x0, x1)), right = Math.min(this.width - 1, Math.max(x0, x1));
    const top = Math.max(0, Math.min(y0, y1)), bottom = Math.min(this.height - 1, Math.max(y0, y1));
    for (let y = top; y <= bottom; y++) for (let x = left; x <= right; x++) this.data[y * this.width + x] = 0;
    return this;
  }

  /* ---------------- 贴图 / 文字 ---------------- */

  /**
   * 字符画贴图：
   *   s.blit(['..#..', '.#.#.'], 4, 4, { '.': 0, '#': 1 })
   * map 里没写的字符 → 透明
   */
  blit(rows, x, y, map) {
    const table = map || { '#': 1 };
    for (let r = 0; r < rows.length; r++) {
      const cols = [...String(rows[r])];
      for (let q = 0; q < cols.length; q++) {
        const ch = cols[q];
        if (!Object.prototype.hasOwnProperty.call(table, ch)) continue;
        const key = this.colorOf(table[ch]);
        if (!key) continue;
        const px = x + q, py = y + r;
        if (this.inside(px, py)) this.data[py * this.width + px] = key;
      }
    }
    return this;
  }

  /** 5×7 点阵文字；align: left | center | right，以 x 为锚点 */
  text(x, y, str, c, options = {}) {
    const scale = Math.max(1, options.scale || 1);
    const spacing = options.spacing == null ? 1 : options.spacing;
    const text = String(str);
    const size = measureText(text, { scale, spacing });
    let startX = Math.round(x);
    if (options.align === 'center') startX = Math.round(x - size.width / 2);
    else if (options.align === 'right') startX = Math.round(x - size.width);
    const key = this.colorOf(c);
    let cx = startX;
    for (const ch of text) {
      const rows = glyphOf(ch);
      for (let r = 0; r < GLYPH_H; r++) {
        for (let q = 0; q < GLYPH_W; q++) {
          if (rows[r][q] !== '#') continue;
          for (let sy = 0; sy < scale; sy++) {
            for (let sx = 0; sx < scale; sx++) {
              const px = cx + q * scale + sx;
              const py = Math.round(y) + r * scale + sy;
              if (this.inside(px, py)) this.data[py * this.width + px] = key;
            }
          }
        }
      }
      cx += (GLYPH_W + spacing) * scale;
    }
    return this;
  }

  /* ---------------- 处理 ---------------- */

  /** 给所有非透明像素加描边（不会盖住原有像素） */
  outline(c, options = {}) {
    const key = this.colorOf(c);
    const diagonal = !!options.diagonal;
    const src = this.data.slice();
    const w = this.width, h = this.height;
    const nb = diagonal
      ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
      : [[1, 0], [-1, 0], [0, 1], [0, -1]];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (src[y * w + x]) continue;
        let touch = false;
        for (const [dx, dy] of nb) {
          const nx = x + dx, ny = y + dy;
          if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
          if (src[ny * w + nx]) { touch = true; break; }
        }
        if (touch) this.data[y * w + x] = key;
      }
    }
    return this;
  }

  /** 把所有 from 色号换成 to */
  replace(from, to) {
    const a = this.colorOf(from), b = this.colorOf(to);
    for (let i = 0; i < this.data.length; i++) if (this.data[i] === a) this.data[i] = b;
    return this;
  }

  /**
   * 逐像素改造：fn(x, y, key, hex) 返回新色号 / 颜色写法；返回 null 或 undefined 保持原样。
   * 例：s.map((x, y, key) => key ? ((x + y) % 2 ? key : '#000000') : key)
   */
  map(fn) {
    const w = this.width;
    for (let y = 0; y < this.height; y++) {
      for (let x = 0; x < w; x++) {
        const i = y * w + x;
        const key = this.data[i];
        const out = fn(x, y, key, key ? this.hexOf(key) : null);
        if (out == null) continue;
        if (out === key) continue;
        this.data[i] = this.colorOf(out);
      }
    }
    return this;
  }

  /* ---------------- 输出 ---------------- */

  toGrid() {
    const grid = [];
    for (let y = 0; y < this.height; y++) {
      const row = new Array(this.width);
      for (let x = 0; x < this.width; x++) row[x] = this.data[y * this.width + x];
      grid.push(row);
    }
    return grid;
  }

  toCode(options = {}) {
    return serializePixelCode({
      width: this.width,
      height: this.height,
      grid: this.toGrid(),
      palette: Object.fromEntries(this.palette),
      defs: options.defs !== false,
      pad: !!options.pad,
      comments: options.comments !== false,
      title: options.title || this.title,
    });
  }

  /** 展开成 RGBA（含 scale 与背景色）；背景 transparent 时 alpha 为 0 */
  toRGBA(options = {}) {
    const scale = Math.max(1, Math.floor(options.scale || 1));
    const bgArg = options.bg == null ? 'transparent' : options.bg;
    const bgHex = bgArg === 'transparent' ? null : (normalizeHex(bgArg) || parseColorSpec(bgArg));
    if (bgArg !== 'transparent' && !bgHex) throw new Error('认不出的背景色：' + bgArg);
    const bg = bgHex ? hexToRgb(bgHex) : null;
    const W = this.width * scale, H = this.height * scale;
    const data = new Uint8ClampedArray(W * H * 4);
    const cache = new Map();
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const key = this.data[Math.floor(y / scale) * this.width + Math.floor(x / scale)];
        const p = (y * W + x) * 4;
        if (!key) {
          if (bg) { data[p] = bg.r; data[p + 1] = bg.g; data[p + 2] = bg.b; data[p + 3] = 255; }
          continue;
        }
        let rgb = cache.get(key);
        if (!rgb) {
          const hex = this.hexOf(key);
          if (!hex) throw new Error('色号 ' + key + ' 没有颜色');
          rgb = hexToRgb(hex);
          cache.set(key, rgb);
        }
        data[p] = rgb.r; data[p + 1] = rgb.g; data[p + 2] = rgb.b; data[p + 3] = 255;
      }
    }
    return { width: W, height: H, data };
  }

  /** 每个色号一个字符的文本预览，方便在终端里核对画面 */
  toAscii() {
    const keys = this.usedKeys();
    const symbol = new Map();
    for (const k of keys) {
      symbol.set(k, k <= 9 ? String(k) : (k <= 35 ? String.fromCharCode(55 + k) : '*'));
    }
    const lines = [];
    for (let y = 0; y < this.height; y++) {
      let line = '';
      for (let x = 0; x < this.width; x++) {
        const k = this.data[y * this.width + x];
        line += k ? symbol.get(k) : '.';
      }
      lines.push(line);
    }
    const legend = keys.map((k) => symbol.get(k) + '=' + (symbol.get(k) === String(k) ? '' : k + ' ') + this.hexOf(k)).join('  ');
    return lines.join('\n') + (legend ? '\n' + legend : '');
  }

  print() {
    console.log(this.toAscii());
    return this;
  }

  stats() {
    const keys = this.usedKeys();
    let painted = 0;
    for (const k of this.data) if (k) painted++;
    return {
      width: this.width,
      height: this.height,
      cells: this.width * this.height,
      painted,
      coverage: this.width * this.height ? painted / (this.width * this.height) : 0,
      colorCount: keys.length,
      usedKeys: keys,
      colors: keys.map((k) => ({ key: k, color: this.hexOf(k) })),
    };
  }
}

export function createSurface(width, height, options) {
  return new Surface(width, height, options);
}

export default { Surface, createSurface };
