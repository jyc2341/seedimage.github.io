/* 自检： node scripts/selftest.mjs
 * 校验字体、几何、颜色、代码往返、PNG/SVG 输出是否正常。全部通过退出码为 0。
 */
import assert from 'node:assert';
import { Surface, createSurface } from './surface.mjs';
import { surfaceToPNG, surfaceToSVG, surfaceFromCode, autoScale, encodePNG } from './render.mjs';
import { GLYPHS, GLYPH_W, GLYPH_H, measureText, glyphOf } from './font5x7.mjs';
import { parsePixelCode, serializePixelCode, parseColorSpec, normalizeHex } from './core.mjs';

let pass = 0;
const failed = [];
function test(name, fn) {
  try { fn(); pass++; console.log('  ✓ ' + name); }
  catch (e) { failed.push([name, e]); console.log('  ✗ ' + name + '\n      ' + e.message); }
}

console.log('\n[字体]');
test('所有字形都是 5×7', () => {
  for (const [ch, rows] of GLYPHS) {
    assert.strictEqual(rows.length, GLYPH_H, ch);
    for (const r of rows) assert.strictEqual(r.length, GLYPH_W, ch);
  }
  assert.ok(GLYPHS.size > 40, '字形太少：' + GLYPHS.size);
});
test('A–Z 与 0–9 都在字库里', () => {
  for (let c = 65; c <= 90; c++) assert.ok(GLYPHS.has(String.fromCharCode(c)), String.fromCharCode(c));
  for (let d = 0; d <= 9; d++) assert.ok(GLYPHS.has(String(d)), String(d));
});
test('未知字符回退成 ?', () => {
  assert.deepStrictEqual(glyphOf('汉'), GLYPHS.get('?'));
});
test('measureText 宽度 = 字数 × 6 − 1（scale 1）', () => {
  assert.strictEqual(measureText('AB').width, 11);
  assert.strictEqual(measureText('AB', { scale: 2 }).width, 22);
  assert.strictEqual(measureText('').width, 0);
});

console.log('\n[颜色]');
test('颜色写法 → 色号，并自动占号', () => {
  const s = createSurface(4, 4);
  assert.strictEqual(s.colorOf('红'), 1);
  assert.strictEqual(s.colorOf('#E53935'), 1);
  const k = s.colorOf('#123456');
  assert.strictEqual(k, 13);
  assert.strictEqual(s.hexOf(13), '#123456');
  assert.strictEqual(s.colorOf(0), 0);
});
test('用没定义的色号会报错（不会画出洋红）', () => {
  const s = createSurface(4, 4);
  assert.throws(() => s.px(0, 0, 99), /色号 99/);
});

console.log('\n[画布]');
test('px 画点、越界安全', () => {
  const s = createSurface(3, 3);
  s.px(1, 1, 'red');
  assert.strictEqual(s.get(1, 1), s.colorOf('red'));
  s.px(-5, 99, 'red');
  assert.strictEqual(s.stats().painted, 1);
});
test('line / rect / ellipse / circle', () => {
  const s = createSurface(8, 8);
  s.line(0, 0, 5, 0, '红');
  assert.strictEqual(s.get(5, 0), 1);
  assert.strictEqual(s.get(6, 0), 0);
  s.rect(1, 1, 3, 3, '蓝');
  assert.strictEqual(s.get(1, 2), 6);
  assert.strictEqual(s.get(2, 2), 0, '边框不该填内部');
  s.rect(4, 4, 6, 6, '绿', { fill: true });
  assert.strictEqual(s.get(5, 5), 4);
  const s2 = createSurface(9, 9);
  s2.circle(4, 4, 4, '黑', { fill: true });
  assert.strictEqual(s2.get(4, 4), 10);
  assert.strictEqual(s2.get(0, 0), 0, '圆不该占满角');
});
test('fill 油漆桶只填连通区域', () => {
  const s = createSurface(4, 1);
  s.px(0, 0, '红'); s.px(1, 0, '红'); s.px(3, 0, '红');
  s.fill(0, 0, '蓝');
  assert.deepStrictEqual([...s.data], [6, 6, 0, 1]);
});
test('outline 只在透明处描边、不盖掉原像素', () => {
  const s = createSurface(3, 3);
  s.px(1, 1, '红');
  s.outline('黑');
  assert.strictEqual(s.get(1, 1), 1);
  assert.strictEqual(s.get(0, 1), 10);
  assert.strictEqual(s.get(0, 0), 0);
});
test('map 可以按坐标改造像素，返回 null 保持原样', () => {
  const s = createSurface(4, 1);
  s.px(0, 0, '红'); s.px(1, 0, '红');
  s.map((x, y, key) => (x === 1 ? '蓝' : null));
  assert.deepStrictEqual([...s.data], [1, 6, 0, 0]);
});
test('replace 换色', () => {
  const s = createSurface(2, 1);
  s.px(0, 0, '红'); s.px(1, 0, '蓝');
  s.replace('红', '蓝');
  assert.deepStrictEqual([...s.data], [6, 6]);
});
test('text 写入像素且跟随 scale / align', () => {
  const s = createSurface(20, 8);
  s.text(0, 0, 'A', '#FFFFFF');
  assert.ok(s.stats().painted > 8, '字母 A 应该有不少像素');
  const s2 = createSurface(20, 8);
  s2.text(10, 0, 'A', '#FFFFFF', { align: 'center' });
  const xs = [];
  for (let x = 0; x < 20; x++) if (s2.get(x, 0) || s2.get(x, 1)) xs.push(x);
  assert.ok(Math.min(...xs) > 0, '居中后不该顶到左边缘');
});
test('text 小写按大写渲染', () => {
  const a = createSurface(10, 8); a.text(0, 0, 'a', '#FFFFFF');
  const b = createSurface(10, 8); b.text(0, 0, 'A', '#FFFFFF');
  assert.deepStrictEqual([...a.data], [...b.data]);
});
test('blit 贴字符画', () => {
  const s = createSurface(3, 2);
  s.blit(['#.#', '.#.'], 0, 0, { '#': '红' });
  assert.deepStrictEqual([...s.data], [1, 0, 1, 0, 1, 0]);
});

console.log('\n[代码互转]');
test('画布 → 代码 → 画布 完全一致', () => {
  const s = createSurface(5, 5);
  s.px(0, 0, '红'); s.px(4, 4, '蓝'); s.rect(1, 1, 3, 3, '黄');
  const code = s.toCode();
  const back = surfaceFromCode(code);
  assert.strictEqual(back.width, 5);
  assert.deepStrictEqual([...back.data], [...s.data]);
  assert.ok(code.includes('<1>'), '代码里每个颜色都要带 <>');
});
test('手工代码能解析（含 1 = 红 与 <0>）', () => {
  const s = surfaceFromCode('2*2\n1 = 红\n<1><0>\n<0><1>');
  assert.deepStrictEqual([...s.data], [1, 0, 0, 1]);
  assert.strictEqual(s.hexOf(1), '#E53935');
});
test('代码有错时抛异常', () => {
  assert.throws(() => surfaceFromCode('<1><紫罗兰>'), /像素代码有错误/);
});
test('serializePixelCode 带色卡定义', () => {
  const code = serializePixelCode({ width: 1, height: 1, grid: [[2]], palette: { 2: '#FB8C00' } });
  assert.ok(code.includes('1*1'));
  assert.ok(code.includes('2 = #FB8C00'));
  assert.ok(code.includes('<2>'));
});
test('parsePixelCode 认识中文色名与行尾注释', () => {
  const r = parsePixelCode('1 = #FB8C00 # 橙\n1*1\n<1>');
  assert.strictEqual(r.ok, true);
  assert.strictEqual(r.defs.get(1), '#FB8C00');
  assert.strictEqual(parseColorSpec('红'), '#E53935');
  assert.strictEqual(normalizeHex('#f00'), '#FF0000');
});

console.log('\n[输出]');
test('PNG 头正确、尺寸随 scale 变化', () => {
  const s = createSurface(4, 3);
  s.bg('红');
  const { buffer, width, height, scale } = surfaceToPNG(s, { scale: 4 });
  assert.strictEqual(width, 16);
  assert.strictEqual(height, 12);
  assert.strictEqual(scale, 4);
  assert.deepStrictEqual([...buffer.slice(0, 8)], [137, 80, 78, 71, 13, 10, 26, 10]);
  assert.strictEqual(buffer.readUInt32BE(16), 16, 'IHDR 宽度');
  assert.strictEqual(buffer.readUInt32BE(20), 12, 'IHDR 高度');
  assert.strictEqual(buffer[buffer.length - 8], 73, 'IEND 结尾'); // 'I'
});
test('PNG 背景透明时 alpha=0', () => {
  const s = createSurface(2, 2);
  const rgba = s.toRGBA({ scale: 1 });
  assert.strictEqual(rgba.data[3], 0);
});
test('PNG 背景色填满', () => {
  const s = createSurface(2, 2);
  const rgba = s.toRGBA({ scale: 1, bg: '#FFFFFF' });
  assert.deepStrictEqual([...rgba.data.slice(0, 4)], [255, 255, 255, 255]);
});
test('autoScale 让最长边接近 512', () => {
  assert.strictEqual(autoScale(32, 32), 16);
  assert.strictEqual(autoScale(200, 100), 2);
  assert.strictEqual(autoScale(2000, 2000), 1);
});
test('encodePNG 直接可用', () => {
  const buf = encodePNG(1, 1, new Uint8ClampedArray([255, 0, 0, 255]));
  assert.ok(buf.length > 60);
  assert.deepStrictEqual([...buf.slice(0, 4)], [137, 80, 78, 71]);
});
test('SVG 导出按同色横向合并', () => {
  const s = createSurface(3, 1);
  s.px(0, 0, '红'); s.px(1, 0, '红'); s.px(2, 0, '蓝');
  const svg = surfaceToSVG(s);
  assert.ok(svg.includes('viewBox="0 0 3 1"'));
  assert.ok(svg.includes('width="2"'), svg);
  assert.strictEqual((svg.match(/<rect/g) || []).length, 2);
});

console.log('\n[统计]');
test('stats 报告覆盖率和用色', () => {
  const s = createSurface(4, 4);
  s.rect(0, 0, 1, 1, '红', { fill: true });
  const st = s.stats();
  assert.strictEqual(st.painted, 4);
  assert.strictEqual(st.cells, 16);
  assert.strictEqual(st.coverage, 0.25);
  assert.strictEqual(st.colorCount, 1);
  assert.strictEqual(st.colors[0].color, '#E53935');
});

console.log('\n' + '='.repeat(52));
console.log('通过 ' + pass + ' 项' + (failed.length ? '，失败 ' + failed.length + ' 项' : '，全部通过 ✅'));
if (failed.length) {
  for (const [name, e] of failed) console.log(' - ' + name + ': ' + e.message);
  process.exit(1);
}
