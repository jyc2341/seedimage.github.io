#!/usr/bin/env node
/* SeedImage 画图命令行：把「脚本 / 像素代码 / 项目文件」渲染成 PNG
 *
 *   node draw.mjs <输入> <输出.png> [选项]
 *
 * 输入可以是：
 *   art.mjs    画图脚本：export const size = [宽,高]; export default function draw(s) {...}
 *   art.txt    SeedImage 像素代码：5*5 + <1><1>...
 *   art.json   SeedImage 软件保存的项目文件（合并可见图层）
 *
 * 选项：
 *   --scale N|auto   放大倍数，默认 auto（最长边约 512 像素）
 *   --bg 颜色        背景，默认 transparent；可写 #RRGGBB / white / 蓝
 *   --code 文件      顺便导出 SeedImage 像素代码 .txt
 *   --svg 文件       顺便导出 SVG
 *   --ascii          在终端打印字符预览（自检用）
 *   --json           打印机器可读的统计 JSON
 *   --allow-empty    允许画出全透明的空图
 *   --quiet          只输出结果文件路径
 */

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { Surface } from './surface.mjs';
import { surfaceToPNG, surfaceToSVG, surfaceFromCode, surfaceFromProject, autoScale } from './render.mjs';
import * as core from './core.mjs';

const USAGE = `用法: node draw.mjs <输入 (mjs|txt|json)> <输出.png> [--scale N|auto] [--bg 颜色]
             [--code 输出.txt] [--svg 输出.svg] [--ascii] [--json] [--allow-empty] [--quiet]`;

function parseArgs(argv) {
  const opts = { scale: 'auto', bg: 'transparent', ascii: false, json: false, quiet: false, allowEmpty: false };
  const positional = [];
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = () => {
      const v = argv[++i];
      if (v == null) throw new Error('选项 ' + a + ' 缺少参数');
      return v;
    };
    if (a === '--scale' || a === '-s') opts.scale = next();
    else if (a === '--bg') opts.bg = next();
    else if (a === '--code') opts.code = next();
    else if (a === '--svg') opts.svg = next();
    else if (a === '--ascii') opts.ascii = true;
    else if (a === '--json') opts.json = true;
    else if (a === '--quiet' || a === '-q') opts.quiet = true;
    else if (a === '--allow-empty') opts.allowEmpty = true;
    else if (a === '--help' || a === '-h') { console.log(USAGE); process.exit(0); }
    else if (a.startsWith('-')) throw new Error('不认识的选项 ' + a);
    else positional.push(a);
  }
  return { opts, positional };
}

async function loadSurface(file) {
  const ext = path.extname(file).toLowerCase();
  if (ext === '.txt' || ext === '.md') {
    return surfaceFromCode(fs.readFileSync(file, 'utf8'), { title: path.basename(file) });
  }
  if (ext === '.json') {
    return surfaceFromProject(JSON.parse(fs.readFileSync(file, 'utf8')), { title: path.basename(file) });
  }
  if (ext === '.mjs' || ext === '.js') {
    const mod = await import(pathToFileURL(path.resolve(file)).href);
    const draw = mod.default || mod.draw;
    if (typeof draw !== 'function') {
      throw new Error('画图脚本要写 `export default function draw(s) { ... }`');
    }
    const size = mod.size
      || (Array.isArray(mod.canvasSize) ? mod.canvasSize : null)
      || (mod.width && mod.height ? [mod.width, mod.height] : null);
    if (!size || !size.length) {
      throw new Error('画图脚本要写 `export const size = [宽, 高];`');
    }
    const s = new Surface(size[0], size[1], {
      palette: mod.palettePreset || 'default',
      colors: mod.palette,
      title: mod.title || path.basename(file, ext),
    });
    await draw(s, { core, Surface });
    return s;
  }
  throw new Error('不支持的输入类型 "' + ext + '"（支持 .mjs / .js / .txt / .json）');
}

function ensureDir(file) {
  const dir = path.dirname(path.resolve(file));
  fs.mkdirSync(dir, { recursive: true });
}

async function main() {
  const { opts, positional } = parseArgs(process.argv.slice(2));
  if (positional.length < 2) {
    console.error(USAGE);
    process.exit(2);
  }
  const [input, output] = positional;
  if (!fs.existsSync(input)) throw new Error('找不到输入文件：' + input);

  const surface = await loadSurface(input);
  const scale = String(opts.scale) === 'auto'
    ? autoScale(surface.width, surface.height)
    : Math.max(1, Math.floor(Number(opts.scale) || autoScale(surface.width, surface.height)));

  const stats = surface.stats();
  const png = surfaceToPNG(surface, { scale, bg: opts.bg });
  ensureDir(output);
  fs.writeFileSync(output, png.buffer);

  if (opts.code) {
    ensureDir(opts.code);
    fs.writeFileSync(opts.code, surface.toCode({ title: path.basename(opts.code, '.txt') }), 'utf8');
  }
  if (opts.svg) {
    ensureDir(opts.svg);
    fs.writeFileSync(opts.svg, surfaceToSVG(surface, { scale, bg: opts.bg }), 'utf8');
  }

  if (opts.json) {
    console.log(JSON.stringify({
      input, output, code: opts.code || null, svg: opts.svg || null,
      surface: { width: surface.width, height: surface.height },
      png: { width: png.width, height: png.height, scale },
      stats,
    }, null, 2));
  } else if (!opts.quiet) {
    console.log('✔ ' + output + '  ' + png.width + '×' + png.height +
      '  (' + surface.width + '×' + surface.height + ' 像素 ×' + scale + ')');
    console.log('  色号: ' + (stats.colors.map((c) => c.key + '=' + c.color).join('  ') || '（无）'));
    console.log('  覆盖: ' + (stats.coverage * 100).toFixed(1) + '%  (' + stats.painted + '/' + stats.cells + ' 像素，' +
      stats.colorCount + ' 个色号)');
    if (opts.code) console.log('  代码: ' + opts.code);
    if (opts.svg) console.log('  SVG : ' + opts.svg);
  }

  if (opts.ascii) console.log('\n' + surface.toAscii() + '\n');

  if (stats.painted === 0 && !opts.allowEmpty) {
    console.error('⚠ 画布是空的：所有像素都透明。检查脚本里的坐标/颜色，或用 --allow-empty 明确接受。');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('✘ ' + (err && err.message ? err.message : err));
  if (process.env.SEEDIMAGE_DEBUG && err && err.stack) console.error(err.stack);
  process.exit(1);
});
