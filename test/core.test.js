/* SeedImage 纯逻辑层测试： node test/core.test.js */
'use strict';

const assert = require('assert');
const core = require('../app.js');

let passed = 0;
const failures = [];

function test(name, fn) {
  try {
    fn();
    passed++;
    console.log('  ✓ ' + name);
  } catch (err) {
    failures.push({ name, err });
    console.log('  ✗ ' + name + '\n      ' + err.message);
  }
}

const DEFAULT = {};
for (const e of core.PALETTE_PRESETS.default) DEFAULT[e.key] = e.color;

console.log('\n[颜色解析]');

test('中文色名：红 → #E53935', () => {
  assert.strictEqual(core.parseColorSpec('红'), '#E53935');
});

test('英文色名：blue → #1E88E5', () => {
  assert.strictEqual(core.parseColorSpec('blue'), '#1E88E5');
});

test('#f00 → #FF0000（三位缩写展开）', () => {
  assert.strictEqual(core.parseColorSpec('#f00'), '#FF0000');
});

test('rgb() 与逗号写法', () => {
  assert.strictEqual(core.parseColorSpec('rgb(255, 140, 0)'), '#FF8C00');
  assert.strictEqual(core.parseColorSpec('255,140,0'), '#FF8C00');
});

test('#RRGGBBAA 去掉透明度', () => {
  assert.strictEqual(core.normalizeHex('#E5393580'), '#E53935');
});

test('乱写的颜色返回 null', () => {
  assert.strictEqual(core.parseColorSpec('紫罗兰色'), null);
  assert.strictEqual(core.parseColorSpec('#12345'), null);
});

console.log('\n[代码解析：用户给的 5×5 例子]');

const USER_CODE = [
  '5*5（5*5像素）',
  '<1><1><1><1><1>',
  '<2><2><2><2><2>',
  '<3><3><3><3><3>',
  '<1><1><1><1><1>',
  '<1><1><1><1><1>',
  '1=红',
  '2,3=按色卡来',
].join('\n');

test('尺寸头带括号说明也能认出来', () => {
  const r = core.parsePixelCode('5*5（5*5像素）', {});
  assert.strictEqual(r.header.w, 5);
});

test('示例里的 <1><2><3> 全部解析成功', () => {
  const r = core.parsePixelCode(USER_CODE, { basePalette: DEFAULT });
  assert.strictEqual(r.ok, true, JSON.stringify(r.errors));
  assert.strictEqual(r.width, 5);
  assert.strictEqual(r.height, 5);
  assert.deepStrictEqual(r.grid[0], [1, 1, 1, 1, 1]);
  assert.deepStrictEqual(r.grid[1], [2, 2, 2, 2, 2]);
  assert.deepStrictEqual(r.grid[2], [3, 3, 3, 3, 3]);
  assert.deepStrictEqual(r.grid[4], [1, 1, 1, 1, 1]);
});

test('1=红 生效：1 号色变成红色', () => {
  const r = core.parsePixelCode(USER_CODE, { basePalette: DEFAULT });
  assert.strictEqual(r.defs.get(1), '#E53935');
});

test('2、3 号色代码里没定义 → 走色卡（不报错）', () => {
  const r = core.parsePixelCode(USER_CODE, { basePalette: DEFAULT });
  assert.strictEqual(r.defs.has(2), false);
  assert.strictEqual(r.defs.has(3), false);
  assert.deepStrictEqual(r.missingKeys, []);
  assert.deepStrictEqual(r.usedKeys, [1, 2, 3]);
});

test('色卡里也没有的色号 → 变成 warning', () => {
  const r = core.parsePixelCode('2*1\n<99><99>', { basePalette: DEFAULT });
  assert.deepStrictEqual(r.missingKeys, [99]);
  assert.strictEqual(r.warnings.length, 1);
});

console.log('\n[代码解析：其他写法]');

test('省略尺寸头时按行列推断', () => {
  const r = core.parsePixelCode('<1><2><3>\n<4><5><6>', {});
  assert.strictEqual(r.width, 3);
  assert.strictEqual(r.height, 2);
});

test('5x5 / 5×5 两种乘号都行', () => {
  assert.strictEqual(core.parsePixelCode('5x5\n<1>', {}).width, 5);
  assert.strictEqual(core.parsePixelCode('5×5\n<1>', {}).width, 5);
});

test('<0> 和 <> 都是透明', () => {
  const r = core.parsePixelCode('<0><><1>', {});
  assert.deepStrictEqual(r.grid[0], [0, 0, 1]);
});

test('行尾 # 注释不会破坏十六进制颜色', () => {
  const r = core.parsePixelCode('1 = #FB8C00   # 橙\n1*1\n<1>', {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.defs.get(1), '#FB8C00');
});

test('行尾 // 注释也能用', () => {
  const r = core.parsePixelCode('# 注释\n2*1 // 尺寸\n<1><1> // 一行', {});
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.width, 2);
});

test('直接写颜色 <#FF0000> 自动分配色号', () => {
  const r = core.parsePixelCode('2*1\n<#FF0000><#ff0000>', {});
  assert.strictEqual(r.ok, true);
  assert.deepStrictEqual(r.grid[0], [1, 1]);
  assert.strictEqual(r.defs.get(1), '#FF0000');
});

test('已有色卡里的颜色不重复占号', () => {
  const r = core.parsePixelCode('<#E53935>', { basePalette: DEFAULT });
  assert.deepStrictEqual(r.grid[0], [1]);
});

test('行太短自动补透明，并给提示', () => {
  const r = core.parsePixelCode('3*2\n<1>\n<1><2><3>', { basePalette: DEFAULT });
  assert.deepStrictEqual(r.grid[0], [1, 0, 0]);
  assert.strictEqual(r.warnings.length, 1);
  assert.ok(r.warnings[0].message.includes('不足宽度'), r.warnings[0].message);
});

test('行太长按尺寸头截断', () => {
  const r = core.parsePixelCode('2*1\n<1><2><3>', {});
  assert.deepStrictEqual(r.grid[0], [1, 2]);
  assert.strictEqual(r.ok, true);
});

test('写错的颜色会报错，并带行号', () => {
  const r = core.parsePixelCode('<1><紫罗兰><1>', { basePalette: DEFAULT });
  assert.strictEqual(r.ok, false);
  assert.strictEqual(r.errors[0].line, 1);
});

test('没有像素行时报错', () => {
  const r = core.parsePixelCode('# 只有注释', {});
  assert.strictEqual(r.ok, false);
});

console.log('\n[代码生成]');

test('解析 → 生成 → 再解析，结果一致（往返）', () => {
  const src = core.parsePixelCode(USER_CODE, { basePalette: DEFAULT });
  const code = core.serializePixelCode({
    width: src.width, height: src.height, grid: src.grid,
    palette: DEFAULT, defs: true, pad: false,
  });
  const back = core.parsePixelCode(code, { basePalette: DEFAULT });
  assert.strictEqual(back.ok, true);
  assert.deepStrictEqual(back.grid, src.grid);
  assert.strictEqual(back.width, src.width);
  assert.strictEqual(back.height, src.height);
});

test('生成结果里每个颜色都带 <>', () => {
  const code = core.serializePixelCode({
    width: 2, height: 1, grid: [[1, 0]], palette: { 1: '#E53935' }, comments: false,
  });
  assert.strictEqual(code.trim().split('\n').pop(), '<1><0>');
});

test('空格分隔选项', () => {
  const code = core.serializePixelCode({
    width: 2, height: 1, grid: [[1, 2]], palette: {}, comments: false, defs: false, pad: true,
  });
  assert.strictEqual(code.trim().split('\n').pop(), '<1> <2>');
});

test('生成的色卡定义用的是十六进制', () => {
  const code = core.serializePixelCode({
    width: 1, height: 1, grid: [[1]], palette: { 1: '#e53935' }, defs: true,
  });
  assert.ok(code.includes('1 = #E53935'), code);
});

console.log('\n[绘图算法]');

test('直线：水平、竖直、对角', () => {
  assert.deepStrictEqual(core.linePoints(0, 0, 3, 0), [[0, 0], [1, 0], [2, 0], [3, 0]]);
  assert.deepStrictEqual(core.linePoints(0, 0, 0, 2), [[0, 0], [0, 1], [0, 2]]);
  assert.deepStrictEqual(core.linePoints(0, 0, 2, 2), [[0, 0], [1, 1], [2, 2]]);
});

test('矩形：边框 8 像素、实心 9 像素（3×3）', () => {
  assert.strictEqual(core.rectPoints(0, 0, 2, 2, false).length, 8);
  assert.strictEqual(core.rectPoints(0, 0, 2, 2, true).length, 9);
});

test('椭圆：实心比边框点多，且都在包围盒内', () => {
  const fill = core.ellipsePoints(0, 0, 8, 8, true);
  const line = core.ellipsePoints(0, 0, 8, 8, false);
  assert.ok(fill.length > line.length);
  assert.ok(line.length > 0);
  for (const [x, y] of fill) {
    assert.ok(x >= 0 && x <= 8 && y >= 0 && y <= 8);
    assert.ok(x !== 0 || y !== 0, '椭圆不应占满四个角');
  }
});

test('笔刷放大：1 像素笔刷画 3×3 方块 = 9 像素', () => {
  const pts = core.expandPoints([[1, 1]], 3);
  assert.strictEqual(pts.length, 9);
});

test('洪水填充：填满相连的同色区域', () => {
  const data = new Uint16Array([1, 1, 0, 1, 0, 0, 0, 0, 0]);
  const n = core.floodFill(data, 3, 3, 0, 0, 5);
  assert.strictEqual(n, 3);
  assert.deepStrictEqual(Array.from(data), [5, 5, 0, 5, 0, 0, 0, 0, 0]);
});

test('洪水填充：同色直接返回 0', () => {
  const data = new Uint16Array([1, 1, 1, 1]);
  assert.strictEqual(core.floodFill(data, 2, 2, 0, 0, 1), 0);
});

test('洪水填充：只填 4 连通的区域（对角不相连）', () => {
  const data = new Uint16Array([1, 0, 0, 0, 1, 0, 0, 0, 1]);
  assert.strictEqual(core.floodFill(data, 3, 3, 0, 0, 2), 1);
});

test('洪水填充：竖直相连会一起填', () => {
  const data = new Uint16Array([1, 0, 1, 0]);
  assert.strictEqual(core.floodFill(data, 2, 2, 0, 0, 2), 2);
});

console.log('\n[色卡方案]');

test('4 套内置色卡都存在且色号从 1 开始', () => {
  for (const name of ['default', 'pico8', 'gray', 'warm']) {
    const list = core.PALETTE_PRESETS[name];
    assert.ok(Array.isArray(list) && list.length > 0, name);
    assert.strictEqual(list[0].key, 1, name);
    for (const e of list) assert.ok(core.normalizeHex(e.color), name + ' ' + e.color);
  }
});

test('默认色卡的 1 号是红色', () => {
  assert.strictEqual(core.PALETTE_PRESETS.default[0].color, '#E53935');
});

console.log('\n' + '='.repeat(52));
console.log('通过 ' + passed + ' 项' + (failures.length ? '，失败 ' + failures.length + ' 项' : '，全部通过 ✅'));
if (failures.length) {
  console.log('\n失败明细：');
  for (const f of failures) console.log(' - ' + f.name + ': ' + f.err.message);
  process.exit(1);
}
