---
name: seedimage-draw
description: Draw images by writing and running a Node.js script — pixel art, icons, sprites, logos, badges, posters, landscapes, charts — with a zero-dependency canvas API, then render to PNG or SVG and export SeedImage `<色号>` pixel code. Use when the user asks to draw, paint, or generate a picture/icon/logo/pixel art from code (用代码画画 / 画图 / 画一个 / 像素画 / 图标 / 海报), or to turn an existing SeedImage .txt / .json into an image. Do not use for photo editing, OCR, or hand-authored vector illustration.
---

# 用脚本画画（SeedImage Draw）

写一个 node 脚本描述画面 → 渲染成 PNG / SVG → 自检后交付。
零依赖，只用 node 标准库，不需要安装任何包，也不需要联网。

## 第一步：定尺寸和色卡

| 用途 | 建议尺寸 |
| --- | --- |
| 图标 / 头像 / 表情 | 16×16、24×24、32×32 |
| 精灵图 / 小插画 | 32×32、48×48、64×64 |
| 海报 / 场景 / 带文字的图 | 64×48、96×64、128×128 |

色卡默认是 SeedImage 12 色（`1 红 2 橙 3 黄 4 绿 5 青 6 蓝 7 紫 8 粉 9 棕 10 黑 11 白 12 灰`）。
像素画好看的关键是**限制用色**：一张图通常 3–8 个颜色就够；需要别的颜色可以直接写
`'#RRGGBB'` / `'红'`，库会自动给它分配一个新色号。
用 `{ palette: 'pico8' | 'gray' | 'warm' }` 可以整块换色卡。

## 第二步：写画图脚本

把脚本写到**任务工作区**（不要写进 skill 目录，那里是只读资源）：

```js
// art.mjs
export const size = [32, 32];          // 必填
export const title = '标题';            // 可选

export default function draw(s) {
  s.rect(0, 0, 31, 31, '#1B3A57', { fill: true });   // 铺底
  s.circle(16, 16, 12, '黄', { fill: true });         // 大形状
  s.circle(11, 12, 3, '黑', { fill: true });          // 细节
  s.text(16, 26, 'HI', '白', { align: 'center' });    // 5×7 点阵文字
  s.outline('黑');                                    // 统一描边
  return s;
}
```

绘制点：`px(x,y,c)` `line` `rect` `ellipse` `circle` `fill`(油漆桶) `bg` `text` `blit`(贴字符画)
处理点：`outline(c)` 自动描边（描边前先画完主体）、`replace` 换色、`map(fn)` 逐像素改造
输出点：`toCode()` 导出 `<色号>` 像素代码、`toAscii()` 终端预览、`stats()`

坐标是像素网格，`(0,0)` 在左上角，`x` 向右、`y` 向下，越界会被安全忽略。
完整签名与全部参数见 `references/api.md`，像素代码格式见 `references/pixel-code.md`。

### 常用技巧

- **分层画**：先 `bg` 或大矩形铺底 → 中形状 → 小细节 → 最后 `outline` 描边，层次最清楚。
- **渐变 / 纹理**：用 `s.map((x, y, key) => ...)` 按坐标改色，例如
  `s.map((x, y, key) => (key && (x + y) % 4 === 0 ? '#FFFFFF' : null))` 加高光噪点。
- **对称图形**：只画左半边然后 `s.px(W - 1 - x, y, c)` 镜像，比手写坐标可靠。
- **曲线**：`for` 循环 + `Math.sin` 生成山峦、波浪；数学不等式生成心形、星形。
- **文字**：只有 5×7 大写点阵（自动转大写，中文等非 ASCII 字符会变成 `?`）。需要更大用 `{ scale: 2 }`。

## 第三步：渲染并自检（必做）

```bash
node "<skill-directory>/scripts/draw.mjs" art.mjs out/art.png --scale auto --ascii
```

`<skill-directory>` 是本 skill 所在目录（SKILL.md 同级）。渲染前可以先用
`node "<skill-directory>/scripts/selftest.mjs"` 确认库本身正常（27 项校验）。

交付前逐条检查：

1. 命令退出码是 0。退出码 1 且提示「画布是空的」= 画错了，必须回去改脚本。
2. 看 `--ascii` 打出来的字符预览：主体形状、位置、比例是否真的是用户要的东西；
   每个色号一个字符，图例给的是 `符号=色号 #RRGGBB`。
3. `stats` 的覆盖率合理（图标类一般 30%–90%；100% 说明背景实心，可能没留透明）。
4. 如果当前模型能看图，用 `read_image` 打开生成的 PNG 再确认一次。
5. 用户要求里有具体元素（文字、颜色、数量、比例）时，逐个对照，不要只说"已完成"。

## 交付

- 主交付物是 PNG；把它放在任务工作区，并在回复里用 `![说明](路径)` 展示。
- 用户想在 SeedImage 软件里继续手工编辑时，加 `--code out/art.txt` 一起给，并说明
  「打开软件 → 代码面板 → 导入 .txt / 粘贴 → 应用代码」。
- 需要无损放大或网页使用时，加 `--svg out/art.svg`。
- 复用现成例子：`<skill-directory>/examples/heart-32.mjs`（数学画心形）、
  `badge.mjs`（边框 + 文字徽章）、`landscape.mjs`（渐变天空/山峦/水面）。
- 本机 SeedImage 软件在 `D:\Seedimage\index.html`（若存在），导出的 `.txt` 可直接被它导入。

## 常见错误

| 现象 | 原因 / 处理 |
| --- | --- |
| `色号 13 还没有颜色` | 用了数字色号但没定义。改成颜色字符串（自动占号）或先 `s.def(13, '#123456')` |
| 图是空的 / 退出码 1 | 坐标算错、都画到画布外了；用 `--ascii` 看，或先画个 `bg` 定位 |
| 文字变成 `?` | 非 ASCII 字符不在 5×7 字库里；改用英文/数字 |
| 画面糊 / 太"吵" | 用色过多或描边过重；减到 3–6 色，缩小尺寸（像素画 32×32 比 128×128 更耐看） |
| 越界没效果、也不报错 | 这是设计如此；用 `s.inside(x, y)` 自查坐标 |
| `--scale` 太大 | 单张 PNG 边长别超过 ~2000 px；`--scale auto` 默认按最长边 512 输出 |

## 资源

| 路径 | 内容 |
| --- | --- |
| `scripts/core.mjs` | 颜色解析、像素代码解析/生成、几何、洪水填充 |
| `scripts/surface.mjs` | 画布 API（Surface） |
| `scripts/font5x7.mjs` | 5×7 点阵字体 |
| `scripts/render.mjs` | PNG 编码、SVG 导出、代码/项目文件 → 画布 |
| `scripts/draw.mjs` | 命令行入口 |
| `scripts/selftest.mjs` | 库自检（27 项） |
| `examples/` | 可直接运行的例子 |
| `references/` | API 与像素代码格式说明 |
