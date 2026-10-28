# 开发者工具箱 · DevToolkit

一个零依赖的 Chrome 扩展（Manifest V3）。点击工具栏图标打开一个 H5 页面：左侧是功能切换 TAB，右侧是当前功能的操作区。当前内置第一个功能「JSON 处理」，后续小工具往同一个容器里加。

## 安装

1. 打开 `chrome://extensions/`
2. 打开右上角「开发者模式」
3. 点击「加载已解压的扩展程序」，选择本目录 `dev-toolkit-extension`
4. 点击工具栏上的扩展图标，会在新标签页打开工具箱页面

> 修改代码后回到扩展管理页点一下刷新按钮即可生效。

## JSON 处理

页面是「输入 / 输出」双栏。输入框实时语法着色，三种动作都只处理当前输入，结果写进右侧输出栏。

| 功能 | 输入 | 输出 |
| --- | --- | --- |
| 格式化 | `{"a":1,"b":[1,2]}` | 2 空格缩进的多行 JSON |
| 压缩转义 | 任意合法 JSON | `"{\"a\":1,\"b\":[1,2]}"`，带外层引号，可直接贴进 Java / JS 字符串 |
| 去除转义 | `"{\"a\":1}"` 或 `{\"a\":1}` | 还原并格式化后的可读 JSON |

其他交互：

- **错误定位**：解析失败时状态栏显示「第 N 行第 M 列」和中文原因，行号标红，点击提示可把光标跳到出错位置
- **用作输入**：把输出回填到输入框，方便「压缩转义 → 去除转义」这种往返验证
- **复制 / 清空**：一键复制输出、清空两侧内容
- **草稿**：输入内容通过 `chrome.storage.local` 防抖保存，关掉标签页再打开会自动恢复

## 目录结构

```
manifest.json          MV3 配置：action + background service worker + storage 权限
index.html             单页结构：左侧 TAB、右侧操作区、输入/输出双栏
css/app.css            样式：侧栏、卡片、深色编辑器、语法着色、响应式
js/background.js       点击图标在新标签页打开 index.html
js/json-tool.js        JSON 工具纯函数层：format / minify / minifyEscape / unescape / highlight
js/main.js             骨架层：编辑器渲染、工具注册与切换、草稿、复制
icons/                 16 / 48 / 128 图标
tests/                 核心逻辑自测
```

工具模块与页面骨架是分开的：`main.js` 只管「有哪些工具、怎么切」，单个工具的逻辑落在自己的 `js/<tool>.js` 里，新工具不会把主文件撞大。

## 加一个新工具

1. 在 `index.html` 的 `.nav` 里加一个 `data-tool="xxx"` 的按钮
2. 在 `.main` 里加一个 `data-panel="xxx"` 的面板
3. 需要复用编辑器的，直接照抄现有 `.pane` 结构，`main.js` 的 `createEditor` 可以复用

TAB 切换逻辑按 `data-tool` 与 `data-panel` 自动配对了，不用改 JS。

## 数据与隐私

没有网络请求，没有内容脚本，不用任何远程资源。`storage` 权限只用来存本地草稿，按工具分键，命名约定是 `dev-toolkit.draft.<tool>.v1`，JSON 工具当前用 `dev-toolkit.draft.json.v1`。

## 自测

```bash
node tests/json-tool.test.js
```

覆盖格式化、压缩、转义/反转义（含 `\u`、`\\n`）、往返一致性、错误行列定位和高亮转义，共 14 项。
