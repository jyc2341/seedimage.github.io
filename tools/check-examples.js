/* 检查 examples/ 下所有示例能否被解析： node tools/check-examples.js */
'use strict';
const fs = require('fs');
const path = require('path');
const core = require('../app.js');

const dir = path.join(__dirname, '..', 'examples');
const base = {};
for (const e of core.PALETTE_PRESETS.default) base[e.key] = e.color;

let bad = 0;
for (const f of fs.readdirSync(dir).filter((n) => n.endsWith('.txt'))) {
  const text = fs.readFileSync(path.join(dir, f), 'utf8');
  const r = core.parsePixelCode(text, { basePalette: base });
  const head = (r.ok ? 'OK   ' : 'FAIL ') + f;
  console.log(head + '  ' + r.width + 'x' + r.height +
    '  色号[' + r.usedKeys.join(',') + ']  错误' + r.errors.length + ' 提示' + r.warnings.length);
  for (const e of r.errors) console.log('       错误 第' + e.line + '行: ' + e.message);
  for (const w of r.warnings) console.log('       提示 ' + (w.line ? '第' + w.line + '行: ' : '') + w.message);
  if (!r.ok) bad++;
}
console.log(bad ? '\n有 ' + bad + ' 个示例解析失败' : '\n全部示例解析通过');
process.exit(bad ? 1 : 0);
