# Surface API（画布脚本接口）

`import { createSurface } from '<skill-directory>/scripts/surface.mjs'`

```js
const s = createSurface(宽, 高, { palette: 'default', colors: { 1: '#E53935' }, title: '标题' });
```

- `palette`：内置色卡方案 `'default'`(12 色) / `'pico8'`(16 色) / `'gray'`(16 级灰) / `'warm'`(12 暖色)，默认 `default`。
- `colors`：额外的色卡定义，等价于逐个调用 `s.def()`。

## 颜色参数（所有绘图方法的 `c`）

| 写法 | 说明 |
| --- | --- |
| `1` … `N` | 色号，**必须已在色卡里**；否则抛错（防止误画成洋红占位色） |
| `0` | 透明（擦除） |
| `'#E53935'` `'#f00'` | 十六进制，没在色卡里会自动分配新色号 |
| `'red'` `'红'` `'蓝'` | 中英文色名 |
| `'rgb(229,57,53)'` `'229,57,53'` | RGB 写法 |

## 方法

| 方法 | 说明 |
| --- | --- |
| `px(x, y, c)` | 画一个像素（越界安全） |
| `get(x, y)` | 读色号（越界返回 0） |
| `line(x0, y0, x1, y1, c, {size})` | 直线 |
| `rect(x0, y0, x1, y1, c, {fill, size})` | 矩形；`fill:true` 实心 |
| `ellipse(x0, y0, x1, y1, c, {fill, size})` | 椭圆（按包围盒） |
| `circle(cx, cy, r, c, {fill, size})` | 圆 |
| `fill(x, y, c)` | 油漆桶（四连通） |
| `bg(c)` | 整块铺底 |
| `clearRect(x0, y0, x1, y1)` | 清成透明 |
| `text(x, y, str, c, {scale, spacing, align})` | 5×7 点阵文字；`align`: `left`/`center`/`right`；自动转大写，未知字符变 `?` |
| `blit(rows, x, y, map)` | 贴字符画，如 `s.blit(['..#..','.#.#.'], 4, 4, {'.': 0, '#': 1})` |
| `outline(c, {diagonal})` | 给所有非透明像素描边（不会盖掉原像素） |
| `replace(from, to)` | 换色 |
| `map(fn)` | 逐像素改造：`fn(x, y, key, hex)` 返回新颜色；返回 `null` 保持原样 |
| `def(key, color)` / `defs({...})` | 定义 / 覆盖色卡 |
| `colorOf(c)` | 解析成色号（必要时新建） |
| `hexOf(key)` | 色号 → `#RRGGBB` |
| `usedKeys()` | 用到的色号（升序） |
| `toGrid()` | `number[][]` |
| `toCode({pad, defs, comments, title})` | 导出 SeedImage 像素代码文本 |
| `toRGBA({scale, bg})` | 展开成 RGBA（`bg:'transparent'` 时 alpha=0） |
| `toAscii()` / `print()` | 终端字符预览（自检用） |
| `stats()` | `{width, height, cells, painted, coverage, colorCount, usedKeys, colors}` |

## 命令行 `scripts/draw.mjs`

```
node <skill-directory>/scripts/draw.mjs <输入> <输出.png> [选项]
```

| 输入 | 说明 |
| --- | --- |
| `art.mjs` / `art.js` | 画图脚本：`export const size = [宽,高]` + `export default function draw(s) {...}` |
| `art.txt` / `art.md` | SeedImage 像素代码（见 `pixel-code.md`） |
| `art.json` | SeedImage 软件保存的项目文件（合并可见图层） |

| 选项 | 说明 |
| --- | --- |
| `--scale N` \| `--scale auto` | 放大倍数，默认 `auto`（最长边约 512 像素） |
| `--bg 颜色` | 背景，默认 `transparent`；可写 `#FFFFFF` / `white` / `蓝` |
| `--code out.txt` | 顺便导出 SeedImage 像素代码 |
| `--svg out.svg` | 顺便导出 SVG（同色横向合并成 `<rect>`） |
| `--ascii` | 终端打印字符预览（每个色号一个字符） |
| `--json` | 打印机器可读统计（含每个色号的十六进制） |
| `--allow-empty` | 允许全透明空图 |
| `--quiet` | 只输出结果路径 |

退出码：`0` 成功；`1` 出错或画出空图（防止交付一张空白图片）；`2` 参数不对。

## 自检 `scripts/selftest.mjs`

```
node <skill-directory>/scripts/selftest.mjs
```

校验字体、几何、颜色解析、代码往返、PNG/SVG 编码，共 27 项。改动库以后先跑它。
