/* SeedImage UI 冒烟测试： node test/ui.smoke.js
 * 用一个最小 DOM 假装浏览器，检查：
 *   1. index.html 里的 id 和 app.js 里用到的 id 是否一致
 *   2. UI 能初始化（不报错）
 *   3. 代码 → 画布、画布 → 代码 双向通路正确
 *   4. 铅笔 / 橡皮 / 油漆桶 / 撤销 等交互正确
 */
'use strict';

const fs = require('fs');
const path = require('path');
const assert = require('assert');

let passed = 0;
const failures = [];
function test(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (err) { failures.push({ name, err }); console.log('  ✗ ' + name + '\n      ' + err.message); }
}

/* ---------------- 极简 DOM ---------------- */

function makeCtx() {
  const noop = () => {};
  return {
    fillStyle: '', strokeStyle: '', lineWidth: 1, imageSmoothingEnabled: false,
    setTransform: noop, save: noop, restore: noop, beginPath: noop, closePath: noop,
    rect: noop, clip: noop, fillRect: noop, clearRect: noop, strokeRect: noop,
    moveTo: noop, lineTo: noop, stroke: noop, fill: noop, drawImage: noop,
    fillText: noop, putImageData: noop,
    createPattern: () => ({ pattern: true }),
    createImageData: (w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
    getImageData: (x, y, w, h) => ({ width: w, height: h, data: new Uint8ClampedArray(w * h * 4) }),
  };
}

function makeEl(id, tag) {
  return {
    id: id || '',
    tagName: String(tag || 'div').toUpperCase(),
    style: {}, dataset: {}, children: [],
    value: '', textContent: '', innerHTML: '', title: '', type: '',
    checked: false, disabled: false, hidden: false, files: null,
    width: 0, height: 0, clientWidth: 900, clientHeight: 620,
    selectedOptions: [{ textContent: 'option' }],
    classList: {
      _s: new Set(),
      add(c) { this._s.add(c); },
      remove(c) { this._s.delete(c); },
      contains(c) { return this._s.has(c); },
      toggle(c, force) {
        if (force === undefined) { this._s.has(c) ? this._s.delete(c) : this._s.add(c); }
        else if (force) this._s.add(c);
        else this._s.delete(c);
        return this._s.has(c);
      },
    },
    _ctx: null, _handlers: {},
    getContext() { if (!this._ctx) this._ctx = makeCtx(); return this._ctx; },
    appendChild(c) { this.children.push(c); return c; },
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) this.children.splice(i, 1); return c; },
    addEventListener(type, fn) { (this._handlers[type] = this._handlers[type] || []).push(fn); },
    removeEventListener() {},
    fire(type, ev) { for (const fn of (this._handlers[type] || [])) fn(ev || {}); },
    querySelector() { return null; },
    querySelectorAll() { return []; },
    getBoundingClientRect() {
      return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight, right: this.clientWidth, bottom: this.clientHeight };
    },
    setPointerCapture() {}, releasePointerCapture() {},
    focus() {}, blur() {}, select() {}, click() {},
    toBlob(cb) { cb(null); }, toDataURL() { return 'data:,'; },
    closest() { return null; },
  };
}

/* ---------------- 装配全局环境 ---------------- */

const root = path.join(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const htmlIds = new Set();
for (const m of html.matchAll(/id="([^"]+)"/g)) htmlIds.add(m[1]);

const elements = new Map();
const unknownIds = [];

const documentStub = {
  readyState: 'complete',
  body: makeEl('body', 'body'),
  documentElement: makeEl('html', 'html'),
  createElement: (tag) => makeEl('', tag),
  getElementById(id) {
    if (!htmlIds.has(id)) { unknownIds.push(id); throw new Error('index.html 里没有 id="' + id + '"'); }
    if (!elements.has(id)) elements.set(id, makeEl(id));
    return elements.get(id);
  },
  querySelector: () => null,
  querySelectorAll: () => [],
  addEventListener: () => {},
};

const windowStub = {
  devicePixelRatio: 1,
  addEventListener: () => {},
  prompt: () => null,
};

global.window = windowStub;
global.document = documentStub;
global.requestAnimationFrame = (cb) => { cb(); return 1; };
global.cancelAnimationFrame = () => {};
try { global.localStorage = { getItem: () => null, setItem() {}, removeItem() {} }; } catch (e) { /* ignore */ }

/* ---------------- 加载应用 ---------------- */

console.log('\n[启动]');

let loadError = null;
try { require('../app.js'); } catch (err) { loadError = err; }

test('app.js 能在浏览器环境里初始化（无异常）', () => {
  assert.strictEqual(loadError, null, loadError ? loadError.stack : '');
});

test('index.html 的 id 与 app.js 完全对得上', () => {
  assert.deepStrictEqual(unknownIds, []);
  assert.ok(htmlIds.size > 30, 'index.html 里只找到 ' + htmlIds.size + ' 个 id');
});

const api = windowStub.SeedImage;

test('对外 API 已挂到 window.SeedImage', () => {
  assert.ok(api && typeof api.setPixel === 'function');
});

if (!api) { console.log('\n初始化失败，跳过后续测试'); process.exit(1); }

const el = (id) => documentStub.getElementById(id);
const layerData = () => api.getDoc().layers[api.getDoc().layers.length - 1].data;

/* ---------------- 画布基础 ---------------- */

console.log('\n[画布 / 色卡]');

test('默认画布 32×32，1 号色是红色', () => {
  assert.strictEqual(api.getDoc().width, 32);
  assert.strictEqual(api.getDoc().height, 32);
  assert.strictEqual(api.getDoc().palette.get(1).color, '#E53935');
});

test('已铺好 12 个色号', () => {
  assert.strictEqual(api.getDoc().palette.size, 12);
});

test('setPixel 能画上像素', () => {
  api.setPixel(3, 4, 1);
  assert.strictEqual(layerData()[4 * 32 + 3], 1);
});

test('画到画布外面的像素会被忽略（不报错）', () => {
  api.setPixel(-5, 999, 2);
  assert.strictEqual(api.getDoc().width, 32);
});

test('paint 画一条线', () => {
  api.paint(0, 0, 5, 0, 3);
  const d = layerData();
  for (let x = 0; x <= 5; x++) assert.strictEqual(d[x], 3, 'x=' + x);
});

test('shape 画实心矩形', () => {
  api.clear(0);
  api.shape('rectFill', 1, 1, 3, 3, 4);
  const d = layerData();
  let n = 0;
  for (let i = 0; i < d.length; i++) if (d[i] === 4) n++;
  assert.strictEqual(n, 9);
});

test('fill 填满整个图层', () => {
  api.clear(0);
  const n = api.fill(0, 0, 5);
  assert.strictEqual(n, 32 * 32);
});

/* ---------------- 代码 → 画布 ---------------- */

console.log('\n[代码 → 画布]');

test('把 <1><2> 代码应用到整个文档', () => {
  api.clear(0);
  const parsed = api.setCode('2*2\n<1><2>\n<2><1>');
  assert.strictEqual(parsed.ok, true);
  el('codeTarget').value = 'doc';
  el('btnApplyCode').fire('click');
  const d = api.getDoc();
  assert.strictEqual(d.width, 2);
  assert.strictEqual(d.height, 2);
  const data = layerData();
  assert.deepStrictEqual(Array.from(data), [1, 2, 2, 1]);
});

test('应用代码后色卡没被改坏（2 号还是橙）', () => {
  assert.strictEqual(api.getDoc().palette.get(2).color, '#FB8C00');
});

test('1 = 红 这种定义会写进色卡', () => {
  api.setCode('1 = 红\n2*1\n<1><1>');
  el('codeTarget').value = 'doc';
  el('btnApplyCode').fire('click');
  assert.strictEqual(api.getDoc().palette.get(1).color, '#E53935');
});

test('尺寸不一致时报错、不动画布', () => {
  const before = api.getDoc().width;
  api.setCode('9*9\n<1>');
  el('codeTarget').value = 'layer';
  el('btnApplyCode').fire('click');
  assert.strictEqual(api.getDoc().width, before);
});

test('代码有语法错误时不动画布', () => {
  const before = JSON.stringify(Array.from(layerData()));
  api.setCode('2*2\n<1><紫罗兰>');
  el('btnApplyCode').fire('click');
  assert.strictEqual(JSON.stringify(Array.from(layerData())), before);
});

/* ---------------- 画布 → 代码 ---------------- */

console.log('\n[画布 → 代码]');

test('从画布生成代码，内容对得上', () => {
  api.setCode('3*2\n<1><0><0>\n<2><2><3>');
  el('codeTarget').value = 'doc';
  el('btnApplyCode').fire('click');
  el('codeSource').value = 'layer';
  el('chkDefs').checked = true;
  el('chkPad').checked = false;
  el('btnGenCode').fire('click');
  const code = api.getCode();
  assert.ok(code.includes('3*2'), code);
  assert.ok(code.includes('<1><0><0>'), code);
  assert.ok(code.includes('<2><2><3>'), code);
  assert.ok(code.includes('1 = #E53935'), code);
});

test('生成的代码能被自己重新解析（闭环）', () => {
  const again = api.parse(api.getCode());
  assert.strictEqual(again.ok, true, JSON.stringify(again.errors));
  assert.strictEqual(again.width, 3);
  assert.deepStrictEqual(again.grid, [[1, 0, 0], [2, 2, 3]]);
});

test('toCode 可以不要注释和色卡', () => {
  const code = api.toCode({ comments: false, defs: false });
  assert.strictEqual(code.split('\n')[0], '3*2');
});

/* ---------------- 鼠标交互 ---------------- */

console.log('\n[鼠标交互]');

function pixelCenter(x, y) {
  const v = api.getView();
  return { x: v.panX + (x + 0.5) * v.zoom, y: v.panY + (y + 0.5) * v.zoom };
}
function pointer(kind, x, y, extra) {
  const c = pixelCenter(x, y);
  const ev = Object.assign({ clientX: c.x, clientY: c.y, button: 0, buttons: 1, pointerId: 1, altKey: false, shiftKey: false }, extra || {});
  if (kind === 'down') el('stage').fire('pointerdown', ev);
  else if (kind === 'move') el('stage').fire('pointermove', ev);
  else el('stage').fire('pointerup', ev);
}

test('铅笔：按下并拖动画出一串像素', () => {
  api.setCode('8*8\n<1>');
  el('codeTarget').value = 'doc';
  el('btnApplyCode').fire('click');
  api.clear(0);
  api.setTool('pencil');
  api.setActiveKey(1);
  pointer('down', 0, 0);
  pointer('move', 3, 0);
  pointer('up', 3, 0);
  const d = layerData();
  for (let x = 0; x <= 3; x++) assert.strictEqual(d[x], 1, 'x=' + x);
});

test('右键拖动 = 橡皮', () => {
  pointer('down', 0, 0, { button: 2, buttons: 2 });
  pointer('move', 3, 0, { button: 2, buttons: 2 });
  pointer('up', 3, 0, { button: 2 });
  const d = layerData();
  for (let x = 0; x <= 3; x++) assert.strictEqual(d[x], 0, 'x=' + x);
});

test('橡皮工具同样能擦', () => {
  api.setPixel(5, 5, 1);
  api.setTool('eraser');
  pointer('down', 5, 5);
  pointer('up', 5, 5);
  assert.strictEqual(layerData()[5 * 8 + 5], 0);
});

test('油漆桶：点一下就填满', () => {
  api.clear(0);
  api.setTool('fill');
  api.setActiveKey(2);
  pointer('down', 4, 4);
  pointer('up', 4, 4);
  assert.strictEqual(layerData()[0], 2);
  assert.strictEqual(layerData()[63], 2);
});

test('吸管：点击后当前色号跟着变', () => {
  api.setActiveKey(1);
  api.setTool('picker');
  pointer('down', 4, 4);
  pointer('up', 4, 4);
  assert.strictEqual(api.getActiveKey(), 2);
});

test('矩形工具：拖动时只预览，松手才落笔', () => {
  api.clear(0);
  api.setTool('rectFill');
  api.setActiveKey(3);
  pointer('down', 1, 1);
  pointer('move', 3, 3);
  assert.strictEqual(layerData()[1 * 8 + 1], 0, '拖动过程中不应该已经落笔');
  pointer('up', 3, 3);
  assert.strictEqual(layerData()[1 * 8 + 1], 3);
  assert.strictEqual(layerData()[3 * 8 + 3], 3);
});

test('撤销 / 重做', () => {
  const before = Array.from(layerData());
  api.setPixel(7, 7, 9);
  assert.notStrictEqual(layerData()[7 * 8 + 7], before[7 * 8 + 7]);
  api.undo();
  assert.deepStrictEqual(Array.from(layerData()), before);
  api.redo();
  assert.strictEqual(layerData()[7 * 8 + 7], 9);
});

test('撤销可以一路退回上一个文档尺寸', () => {
  for (let i = 0; i < 25 && api.getDoc().width !== 32; i++) api.undo();
  assert.ok([8, 32].includes(api.getDoc().width), '当前宽度 ' + api.getDoc().width);
});

console.log('\n' + '='.repeat(52));
console.log('通过 ' + passed + ' 项' + (failures.length ? '，失败 ' + failures.length + ' 项' : '，全部通过 ✅'));
if (failures.length) {
  console.log('\n失败明细：');
  for (const f of failures) console.log(' - ' + f.name + ': ' + f.err.message);
  process.exit(1);
}
