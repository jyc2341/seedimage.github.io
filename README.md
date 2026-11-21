# SeedImage · 像素绘图工作台

一个网页版像素绘图软件：**像画图软件一样画**（画笔、油漆桶、图层、色卡、撤销、导出 PNG），
**也可以直接用代码写图**（每个颜色用 `<>` 包起来，例如 `<1><2><3>`），而且两边随时互转。

---

## 1. 打开

| 方式 | 做法 |
| --- | --- |
| 最简单 | 双击 `start.bat`（或直接双击 `index.html`） |
| 需要 http:// | `node tools/serve.js` → 浏览器打开 http://127.0.0.1:8123/ |

无需安装任何依赖，纯 HTML + CSS + JS。

---

## 2. 代码语法（核心）

每个颜色都要用 `<>` 包起来，`<>` 里面写**色号**：

```
5*5（5*5像素）
<1><1><1><1><1>
<2><2><2><2><2>
<3><3><3><3><3>
<1><1><1><1><1>
<1><1><1><1><1>

1 = 红              ← 1 号色 = 红
                      2、3 号没写定义，就按右边「色卡」里的颜色来
```

### 全部写法

| 写法 | 含义 |
| --- | --- |
| `5*5` / `5x5` / `5×5` | 画布尺寸，**可以省略**（省略时按行列自动推断），后面可以跟说明文字 |
| `<1>` | 色号 1 的颜色 |
| `<0>` 或 `<>` | 透明 |
| `<#FF0000>` `<#f00>` `<rgb(255,0,0)>` `<红>` `<red>` | 直接写颜色，会自动分配一个色号 |
| `1 = 红` | 定义色卡：1 号色 = 红（中文、英文色名都认） |
| `1 = #FB8C00` | 定义色卡：1 号色 = 这个十六进制颜色 |
| `2,3 = 按色卡来` | 说明行，会被忽略并提示 |
| `# 注释` 或 `// 注释` | 注释，行尾注释也支持 |

### 三条取色规则（按顺序）

1. 代码里写了 `1 = 红` → 用代码里定义的颜色（并写回右侧色卡）；
2. 代码里没写 → 用右侧**色卡**里该色号的颜色；
3. 色卡里也没有这个色号 → 用洋红占位，并在代码面板给出提示。

### 双向互转

* **代码 → 画布**：代码面板里点 `▶ 应用代码`（右侧可选 `替换整个文档` / `当前图层` / `新图层`）。
* **画布 → 代码**：点 `↺ 从画布生成`，可导出当前图层或所有可见图层的合成结果，然后复制 / 下载 `.txt`。
* 代码每敲一下就自动做**语法检查**，报错会带行号，且报错时绝不动画布。

### 现成示例

`examples/` 里有 5 个可以直接导入的 `.txt`：

| 文件 | 内容 |
| --- | --- |
| `01-用户示例5x5.txt` | 就是上面那个 5×5 最小例子 |
| `02-笑脸16x16.txt` | 16×16 笑脸 |
| `03-爱心16x16.txt` | 16×16 爱心 |
| `04-色卡总览12x12.txt` | 12 个色号各一条 |
| `05-直接写颜色渐变8x8.txt` | 不用色号，直接在 `<>` 里写 `#RRGGBB` |

导入方式：代码面板 → `导入 .txt`。渲染出来的样子见 `preview/`（这些图是
`node tools/render-png.js examples/02-笑脸16x16.txt preview/smiley.png 16` 生成的，纯 Node 无依赖）。

---

## 3. 画面工具

| 分类 | 内容 |
| --- | --- |
| 工具 | 铅笔、橡皮、油漆桶、直线、矩形框、实心矩形、椭圆、吸管、移动图层 |
| 笔刷 | 1–32 像素方形笔刷（印章式，形状工具也会跟着变粗） |
| 图层 | 新建 / 复制 / 删除 / 上移 / 下移 / 向下合并 / 清空 / 显示隐藏 / 不透明度 / 双击重命名 |
| 色卡 | 12 色默认，可增删改任意色号；内置 4 套方案：默认 12 色、PICO-8 16 色、灰度 16 级、暖色 12 色 |
| 画布 | 滚轮缩放（5%–12800%）、空格或中键拖动平移、像素网格、适应窗口、调整尺寸（居中/左上对齐） |
| 历史 | 撤销 / 重做，最多 80 步 |
| 文件 | 项目 `.json` 存读、导出 PNG（1–16× 放大，透明/白/黑/灰背景）、自动保存到浏览器（下次打开自动恢复） |

**右键 = 橡皮**，**Alt + 点击 = 吸管**（任何工具下都能临时吸色）。

---

## 4. 快捷键

| 键 | 作用 |
| --- | --- |
| `P` `E` `G` `L` `R` `Shift+R` `O` `I` `V` | 铅笔 / 橡皮 / 油漆桶 / 直线 / 矩形框 / 实心矩形 / 椭圆 / 吸管 / 移动 |
| `1`–`9`、`0` | 选中 1–9、10 号色 |
| `[` `]` | 笔刷减 / 加 |
| 滚轮 / `+` `-` | 缩放；`Ctrl+0` 适应窗口 |
| 空格 + 拖动、中键拖动 | 平移画布 |
| `Ctrl+Z` / `Ctrl+Y` | 撤销 / 重做 |
| `Ctrl+S` | 保存项目 |
| `Ctrl+N` | 新建画布 |

---

## 5. 用代码控制软件（控制台 API）

打开软件后按 F12，在控制台里可以直接画：

```js
SeedImage.setPixel(0, 0, 1)                   // 在 (0,0) 画一个 1 号色
SeedImage.paint(0, 0, 10, 10, 3)              // 画线
SeedImage.shape('ellipse', 2, 2, 20, 20, 5)   // 画椭圆（rect / rectFill / line 同理）
SeedImage.fill(0, 0, 4)                       // 油漆桶
SeedImage.setCode('<1><2><3>')               // 写进代码框（返回解析结果）
SeedImage.toCode({ pad: true })               // 把画布导出成代码
SeedImage.undo() / SeedImage.redo()
SeedImage.getDoc()                            // 拿到文档数据
SeedImage.core.parsePixelCode('...')          // 纯解析函数
```

---

## 6. AI 技能：让 AI 用脚本画画

`skill/seedimage-draw/` 是一个 **DSH 技能包**：装好之后，AI 可以自己写 node 脚本画出图像，
渲染成 PNG / SVG 交付，并顺手导出 SeedImage 能直接导入的 `<色号>` 像素代码。零依赖，只用 node 标准库。

```bash
node tools/install-skill.js            # 装到 DSH 用户级技能目录（所有会话可用）
node tools/install-skill.js --project  # 只装到当前项目的 .dsh/skills
```

装好后 AI 会话里会出现 `seedimage-draw` 技能（watcher 自动发现，无需重启）。AI 的用法是：

```bash
node "<技能目录>/scripts/draw.mjs" art.mjs out/art.png --scale auto --code out/art.txt --ascii
```

| 技能目录里的东西 | 作用 |
| --- | --- |
| `SKILL.md` | 技能说明：三步流程、API 速查、必做自检、常见错误 |
| `scripts/surface.mjs` | 画布 API：`px / line / rect / ellipse / circle / fill / text / blit / outline / replace / map` |
| `scripts/core.mjs` | 颜色解析、`<色号>` 代码解析与生成、几何算法、洪水填充 |
| `scripts/font5x7.mjs` | 5×7 点阵字体（大写字母、数字、常用符号） |
| `scripts/render.mjs` | PNG 编码器（zlib 手写 PNG）、SVG 导出、代码/项目文件 → 画布 |
| `scripts/draw.mjs` | 命令行入口（`.mjs` 画图脚本 / `.txt` 像素代码 / `.json` 项目文件 → PNG） |
| `scripts/selftest.mjs` | 库自检 27 项，改完库先跑它 |
| `examples/` | 4 个可直接运行的例子：爱心（数学不等式）、徽章（边框+文字）、风景（渐变+山峦）、种子发芽 |
| `references/` | API 与像素代码格式说明 |

一个画图脚本长这样（`size` + `draw(s)`）：

```js
export const size = [32, 32];
export default function draw(s) {
  s.circle(16, 16, 12, '黄', { fill: true });   // 颜色可以写 '红' / '#E53935' / 色号
  s.circle(11, 12, 3, '黑', { fill: true });
  s.text(16, 26, 'HI', '白', { align: 'center' });  // 5×7 点阵文字
  s.outline('黑');                                   // 自动描边
  return s;
}
```

`preview/sprout-32.png` / `sprout-32.txt` / `sprout-32.svg` 就是用这个技能画出来的
（`examples/sprout-32.mjs`，8 个色号、覆盖率 38%），生成的 `.txt` 已用 SeedImage 自己的解析器
反查过：解析 OK、往返一致。

---

## 7. 文件结构

```
SeedImage/
├── index.html                 界面结构
├── app.css                    PS 风深色样式
├── app.js                     第一部分：纯逻辑（解析/生成/几何/填充，可在 node 里测）
│                              第二部分：UI（画布、工具箱、色卡、图层、代码面板）
├── start.bat                  双击即打开
├── package.json               npm test / npm run examples / npm run serve
├── examples/                  5 个可直接导入的示例代码
├── preview/                   示例渲染出来的 PNG 预览
├── skill/
│   └── seedimage-draw/        AI 技能包（SKILL.md + scripts + examples + references）
├── tools/
│   ├── make-examples.js       重新生成 examples/
│   ├── check-examples.js      检查 examples/ 是否都能解析
│   ├── render-png.js          把 .txt 代码渲染成 PNG（纯 Node，可用来出图/校验）
│   ├── install-skill.js       安装 / 更新 seedimage-draw 技能
│   └── serve.js               可选本地静态服务器
└── test/
    ├── core.test.js           解析/生成/几何/填充 单元测试
    └── ui.smoke.js            模拟浏览器跑 UI：初始化、代码↔画布、鼠标绘制、撤销
```

## 8. 测试

```bash
npm test                              # 或 node test/core.test.js && node test/ui.smoke.js
node skill/seedimage-draw/scripts/selftest.mjs   # 技能包自检 27 项
```

* `core.test.js` — 36 项：颜色写法、`<号>` 解析、注释与十六进制冲突、行长短补齐/截断、往返一致性、直线/矩形/椭圆/笔刷/洪水填充。
* `ui.smoke.js` — 26 项：用一个最小 DOM 假装浏览器，校验 `index.html` 的 id 与 `app.js` 完全一致、UI 能初始化、
  代码→画布、画布→代码闭环、铅笔/右键擦除/油漆桶/吸管/形状工具/撤销重做。
* `selftest.mjs` — 27 项：点阵字体、颜色解析、几何、油漆桶、描边、`map`、代码往返、PNG/SVG 编码、统计。

## 9. 已知限制

* 图层不透明度是**显示层**效果；「向下合并」时按像素覆盖（像素画以**色号**存储，不是真彩色 alpha 通道）。
* 单个画布上限 1024 × 1024。
* 还没有：选区、图层混合模式、自定义笔刷形状、动画帧、GIF 导出。需要的话可以继续加。
