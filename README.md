# 开发者工具箱 · DevToolkit

一个零依赖的 Chrome 扩展（Manifest V3）。点击工具栏图标打开一个 H5 页面：左侧是功能切换 TAB，右侧是当前功能的操作区。当前内置三个功能：JSON 处理、编码转换、时间戳转换，后续小工具往同一个容器里加。

## 安装

1. 打开 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录 `dev-toolkit-extension`
4. 点击工具栏上的扩展图标，会在新标签页打开工具箱页面

> 修改代码后回到扩展管理页点一下刷新按钮即可生效。

## 界面

- **侧栏可收起**：顶栏左侧的箭头把侧栏折成 76px 的图标列，工具照样能切，主区腾出 168px；再点一次展开。状态存在本地，下次打开保持原样
- **双栏可拖拽**：JSON 和编码面板中间有一条分隔条，拖动改左右宽度，双击回到 50:50；Tab 聚焦后 `←` `→` 每格 2%，`Home` / `End` 一步拉到 20% / 80%。比例全局一份，切 TAB 不会跳
- 窗口窄于 1120px 时两栏自动上下堆叠并隐藏分隔条，窄于 860px 时侧栏直接进图标列

## JSON 处理

页面是「输入 / 输出」双栏。输入框实时语法着色，三种动作都只处理当前输入，结果写进右侧输出栏。

| 功能 | 输入 | 输出 |
| --- | --- | --- |
| 格式化 | `{"a":1,"b":[1,2]}` | 2 空格缩进的多行 JSON |
| 压缩转义 | 任意合法 JSON | `"{\"a\":1,\"b\":[1,2]}"`，带外层引号，可直接贴进 Java / JS 字符串 |
| 去除转义 | `"{\"a\":1}"` 或 `{\"a\":1}` | 还原并格式化后的可读 JSON |

其他交互：

- **错误定位**：解析失败时状态栏显示「第 N 行第 M 列」和中文原因，行号标红，点击提示可把光标跳到出错位置
- **自动换行**：长行默认折行显示，行号跟着折行块变高（后续折行行留空）；工具栏右上角的开关可以关掉，切回左右拖动查看，开关状态随草稿保存
- **用作输入**：把输出回填到输入框，方便「压缩转义 → 去除转义」这种往返验证
- **复制 / 清空**：一键复制输出、清空两侧内容
- **草稿**：输入内容通过 `chrome.storage.local` 防抖保存，关掉标签页再打开会自动恢复

## 编码转换

上方两个分段控件分别选「类型」和「方向」，输入即转，输出栏同步刷新。

| 类型 | 编码 | 解码 |
| --- | --- | --- |
| Base64 | 按 UTF-8 编码，中文和 emoji 都不会乱码 | 兼容 URL-safe 的 `-` `_`、自动补 `=`，非法字符和非 UTF-8 字节会明确报错 |
| URL | 等价 `encodeURIComponent`，适合拼 query / path | 还原 `%XX`，不会把 `+` 当成空格 |
| Unicode | 非 ASCII 转 `\uXXXX`，ASCII 原样保留 | 支持 `\uXXXX`、`\u{1F600}`、`\xXX` 三种写法 |

## 时间戳转换

一个输入框，双向识别：

- **纯数字** → 按阈值自动区分秒 / 毫秒（`1e11` 是分界），10 位、13 位都直接贴
- **日期文本** → `2026-10-28`、`2026/10/28 20:30`、`2026-10-28 20:30:00.123` 按本地时区解析
- 其他交给 `Date.parse`，ISO 8601 之类也能吃

合法输入会展开 8 个视角，每行可单独复制：本地时间、UTC、ISO 8601、秒级、毫秒级、星期、相对现在、本地时区。顶部三张卡片实时显示当前时间的毫秒 / 秒 / 本地时间，可直接复制或「填入当前时间」。

日期解析用正则 + 构造后回读校验，`2026-02-30` 这类不存在的日期会提示校验失败，而不是被静默滚到 3 月。

## 目录结构

```
manifest.json           MV3 配置：action + background service worker + storage 权限
index.html              单页结构：左侧 TAB、三个工具面板
css/app.css             样式：侧栏、卡片、深色编辑器、语法着色、分段控件、时间戳结果卡片
js/background.js        点击图标在新标签页打开 index.html
js/ui.js                通用层：存储、toast、复制、编辑器（含折行测量）、草稿、统计文本
js/json-tool.js         JSON 纯函数：format / minify / minifyEscape / unescape / highlight
js/codec-tool.js        编码纯函数：Base64 / URL / Unicode 双向转换
js/timestamp-tool.js    时间戳纯函数：解析、本地/UTC/ISO 格式化、相对时间
js/tools/json-panel.js      JSON 面板：动作、错误定位、草稿
js/tools/codec-panel.js     编码面板：类型/方向状态、实时转换
js/tools/timestamp-panel.js 时间戳面板：当前时间轮询、结果卡片渲染
js/main.js              骨架层：工具注册表与 TAB 切换、侧栏折叠与双栏宽度
icons/                  16 / 48 / 128 图标
tests/                  核心逻辑自测
```

分四层，互不越界：

1. **纯函数层** `js/<tool>-tool.js`：不含 DOM，Node 里可直接跑测试
2. **通用层** `js/ui.js`：三个面板共用的编辑器、草稿、复制、toast
3. **面板层** `js/tools/<tool>-panel.js`：只操作自己那一块 DOM，对外暴露 `init(panel)` 和 `onShow()`
4. **骨架层** `js/main.js`：一张 `TOOLS` 表 + 切换逻辑，不认识任何具体工具

## 加一个新工具

1. 写 `js/<tool>-tool.js` 纯函数模块
2. 写 `js/tools/<tool>-panel.js` 面板模块，`init(panel)` 返回 `{ onShow }`
3. 在 `index.html` 里加 `.nav` 按钮（`data-tool`）、面板（`data-panel`）和两个 `<script>`
4. 在 `main.js` 的 `TOOLS` 表里加一行

切换逻辑按 `data-tool` 与 `data-panel` 自动配对，不需要写额外的胶水代码。

## 数据与隐私

没有网络请求，没有内容脚本，不用任何远程资源。`storage` 权限只用来存本地草稿与界面布局，草稿按工具分键，命名约定是 `dev-toolkit.draft.<tool>.v1`，当前用到 `dev-toolkit.draft.json.v1`、`dev-toolkit.draft.codec.v1`、`dev-toolkit.draft.timestamp.v1`；布局存在 `dev-toolkit.ui.layout.v1`，形如 `{ collapsed: false, split: 54 }`。

直接用浏览器打开 `index.html` 预览时，草稿会降级存到 `localStorage`。

## 自测

```bash
node tests/json-tool.test.js
node tests/codec-tool.test.js
node tests/timestamp-tool.test.js
```

零依赖，用 `node:assert` 直接跑。共 47 项，覆盖：

- JSON：格式化、压缩、转义/反转义（含 `\u`、`\\n`）、往返一致性、错误行列定位、高亮转义
- 编码：Base64 中文与 emoji、URL-safe、缺 padding、非法字符、URL 编解码、Unicode 两种写法与非法输入
- 时间戳：秒/毫秒识别、本地日期解析与非法日期、相对时间分级、ISO 与星期、往返一致
