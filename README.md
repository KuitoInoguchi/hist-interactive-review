# hist-interactive-review

中国近现代史纲要交互式复习项目。

这个仓库以 Markdown 资料为源，生成可在浏览器中使用的本地静态复习应用。当前实现位于 `interactive-review/`，采用 Vite + React + TypeScript 构建，支持题目练习、答案解析、知识点定位和资料下载。

## 当前状态

- 已完成常规题库第 1 章和第 2 章。
- 第 1 章共 95 题：单选 45 / 多选 15 / 判断 35。
- 第 2 章共 131 题：单选 66 / 多选 27 / 判断 38。
- 第 3 章到第 7 章、学习通题库入口已预留，当前页面中显示为“敬请期待”。

## 仓库结构

- `interactive-review/`
  - 前端应用、生成脚本、测试和静态资源。
- `reference/`
  - 复习资料与章节原始 Markdown。
- `中国近现代史纲要 复习指导.md`
  - 第一章题库原始资料。

## 主要功能

- 单选、多选、判断题交互练习。
- 提交后立即显示正误、正确答案与解析。
- 根据题目 `sourceIds` 自动定位并高亮右侧资料段落。
- 使用 `localStorage` 保存练习进度。
- 支持章节切换、重置练习和资料折叠。
- 支持下载已整理章节的 Markdown / PDF 资料。

## 本地开发

前端工程目录：

```bash
cd interactive-review
```

安装依赖：

```bash
npm install
```

启动开发服务器：

```bash
npm run dev
```

默认会在本地打开一个 Vite 开发服务，常见地址是 `http://127.0.0.1:5173`。

## 常用命令

在 `interactive-review/` 目录下执行：

```bash
npm run generate
```

重新生成题库、资料索引和章节数据。

```bash
npm run test
```

运行单元测试。

```bash
npx playwright install chromium
npm run test:e2e
```

安装 Playwright 浏览器并运行端到端测试。

```bash
npm run build
```

构建静态产物。

## 数据来源

- 第一章题库：`中国近现代史纲要 复习指导.md`
- 第二章题库：`reference/chapter_2.md`
- 复习资料：`reference/中国近现代史纲要 复习.md`
- 题目与资料映射：`interactive-review/src/data/sourceMap.json`

生成后的关键文件位于：

- `interactive-review/src/generated/questions.json`
- `interactive-review/src/generated/chapters.json`
- `interactive-review/src/generated/referenceUnits.json`

## 测试

当前仓库包含两类测试：

- Vitest：验证题库数量、题型分布、答案映射和章节数据。
- Playwright：验证答题反馈、资料高亮、进度恢复、章节切换和页脚仓库链接。

更细的前端说明见 [interactive-review/README.md](./interactive-review/README.md)。
