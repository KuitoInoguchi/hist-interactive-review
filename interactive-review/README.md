# 中国近现代史纲要交互式复习

本项目是一个本地静态复习小程序，基于 Vite、React 和 TypeScript 构建。首版覆盖第一章 95 道题，支持提交后即时反馈、答案解析、进度保存，以及在右侧 Markdown 资料窗中滚动并高亮对应知识点段落。

## 数据来源

- 题库：`../中国近现代史纲要 复习指导.md`
- 复习资料：`../reference/中国近现代史纲要 复习.md`
- 固定映射：`src/data/sourceMap.json`

生成后的题目数据位于 `src/generated/questions.json`，复习资料索引位于 `src/generated/referenceUnits.json`。每道题至少绑定一个有效的 `sourceId`，用于提交答案后定位右侧资料段落。

## 安装

```bash
npm install
```

如果需要下载 Playwright Chromium，请在同一个 shell 命令中先设置代理：

```bash
export https_proxy=http://127.0.0.1:7897
export http_proxy=http://127.0.0.1:7897
export all_proxy=socks5://127.0.0.1:7897
npx playwright install chromium
```

## 常用命令

重新生成题库、资料索引并校验映射：

```bash
npm run generate
```

启动开发服务器：

```bash
npm run dev
```

运行单元测试：

```bash
npm run test
```

运行浏览器端交互测试：

```bash
npm run test:e2e
```

构建静态站点：

```bash
npm run build
```

## 功能范围

- 单选、多选、判断题交互。
- 提交后锁定当前题并显示正确/错误、正确答案和解析。
- 右侧渲染 Markdown 复习资料。
- 根据题目 `sourceIds` 自动滚动并临时高亮资料段落。
- 使用 `localStorage` 保存答题进度。
- 支持重置练习。
- 桌面双栏布局，移动端上下布局并可折叠资料区。

## 测试覆盖

单元测试覆盖题库解析数量、45/15/35 题型分布、答案和解析完整性、source map 有效性，以及多选题顺序无关判分。

Playwright e2e 覆盖提交反馈、资料段落高亮、刷新后进度恢复、重置后清空进度，以及移动端资料窗折叠和展开。
