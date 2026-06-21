# 中国近现代史纲要交互式复习

本项目是一个本地静态复习小程序，基于 Vite、React 和 TypeScript 构建。当前覆盖常规题库第 1 章到第 7 章，支持提交后即时反馈、答案解析、进度保存，以及在右侧 Markdown 资料窗中滚动并高亮对应知识点段落。

## 当前题库

- 第 1 章：95 题，单选 45 / 多选 15 / 判断 35。
- 第 2 章：131 题，单选 66 / 多选 27 / 判断 38。
- 第 3 章：85 题，单选 41 / 多选 19 / 判断 25。
- 第 4 章：84 题，单选 42 / 多选 18 / 判断 24。
- 第 5 章：84 题，单选 42 / 多选 18 / 判断 24。
- 第 6 章：203 题，单选 79 / 多选 61 / 判断 63。
- 第 7 章：77 题，单选 31 / 多选 25 / 判断 21。
- 学习通题库入口已预留，暂显示“敬请期待”。

## 数据来源

- 第一章题库：`../中国近现代史纲要 复习指导.md`
- 第二章题库：`../reference/chapter_2.md`
- 第三章题库：`../reference/chapter_3.md`
- 第四章题库：`../reference/chapter_4.md`
- 第五章题库：`../reference/chapter_5.md`
- 第六章题库：`../reference/chapter_6.md`
- 第七章题库：`../reference/chapter_7.md`
- 复习资料：`../reference/中国近现代史纲要 复习.md`
- 第一章固定映射：`src/data/sourceMap.json`
- 第六、七章固定映射：`src/data/chapterSourceMaps.json`

生成后的章节题库位于 `src/generated/chapters.json`，第一章兼容数据位于 `src/generated/questions.json`，复习资料索引位于 `src/generated/referenceUnits.json`。每道题至少绑定一个有效的 `sourceId`，用于提交答案后定位右侧资料段落。

第 2-5 章的 `sourceIds` 由 `scripts/build-chapters-data.mjs` 逐题生成：脚本会先用题库块声明的复习资料小节限定候选范围，再根据题干、正确选项和解析匹配最相关的资料段落；多选题会按正确选项尽量匹配多个知识点。

第 6-7 章先以同样方式生成候选映射，再逐题人工审计并固化到 `src/data/chapterSourceMaps.json`。构建器会校验固定映射题数、题干、资料段落存在性、所属资料范围和段落精度，任一项漂移都会中止生成。

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
- 支持“提交后判题”和“点选即判”模式。
- 判题后锁定当前题并显示正确/错误、正确答案和解析。
- 右侧渲染 Markdown 复习资料。
- 根据题目 `sourceIds` 自动滚动并临时高亮资料段落。
- 使用 `localStorage` 保存答题进度。
- 支持重置练习。
- 支持下载已整理章节习题和复习资料。
- 桌面双栏布局，移动端上下布局并可折叠资料区。

## 测试覆盖

单元测试覆盖题库解析数量、章节题型分布、答案和解析完整性、source map 有效性、多选题顺序无关判分、第 2-7 章资料映射粒度，以及第 6-7 章固定映射一致性。

Playwright e2e 覆盖提交反馈、资料段落高亮、刷新后进度恢复、重置后清空进度、章节切换、下载链接，以及移动端资料窗折叠和展开。

## 部署

稳定版和测试版都使用静态构建产物。`dev` 分支用于 GitHub Pages 测试版，测试版路径为稳定版站点下的 `/dev/`。
