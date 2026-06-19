import { expect, test } from "@playwright/test";

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();
});

test("submitting an answer shows feedback and highlights the reference block", async ({ page }) => {
  await page.locator(".option-row").filter({ hasText: "中国的封建势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();

  await expect(page.getByText("回答错误")).toBeVisible();
  await expect(page.getByText("正确答案：C")).toBeVisible();
  await page.getByRole("button", { name: /查看本题知识点/ }).click();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);
});

test("progress survives refresh and reset clears the attempt", async ({ page }) => {
  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();

  await page.reload();
  await expect(page.getByText("回答正确")).toBeVisible();
  await page.getByRole("button", { name: /查看本题知识点/ }).click();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  page.on("dialog", (dialog) => dialog.accept());
  await page.getByLabel("更多操作").click();
  await page.getByRole("button", { name: "重置练习" }).click();
  await expect(page.getByText("回答正确")).toHaveCount(0);
  await expect(page.locator(".summary-grid div").filter({ hasText: "已提交" })).toContainText("0");
});

test("question chip becomes pending after selecting an unsubmitted answer", async ({ page }) => {
  const questionThreeChip = page.getByRole("button", { name: "3", exact: true });

  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "第一章习题" }).click();
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.locator(".option-row").filter({ hasText: "宗族家长制" }).click();

  await expect(questionThreeChip).toHaveClass(/is-pending/);
});

test("batch grading submits all selected unanswered questions", async ({ page }) => {
  const batchButton = page.getByRole("button", { name: /一键批改/ });

  await expect(batchButton).toBeDisabled();

  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await expect(page.getByRole("button", { name: "1", exact: true })).toHaveClass(/is-pending/);
  await expect(batchButton).toBeEnabled();

  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.locator(".option-row").filter({ hasText: "外国公使馆" }).click();
  await expect(page.getByRole("button", { name: "2", exact: true })).toHaveClass(/is-pending/);

  await batchButton.click();

  await expect(page.locator(".summary-grid div").filter({ hasText: "已提交" })).toContainText("2");
  await expect(page.getByRole("button", { name: "1", exact: true })).toHaveClass(/is-correct/);
  await expect(page.getByRole("button", { name: "2", exact: true })).toHaveClass(/is-wrong/);
  await expect(batchButton).toBeDisabled();
  await expect(page.getByText("回答错误")).toBeVisible();
});

test("switching to a graded question syncs reference highlight", async ({ page }) => {
  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.locator(".option-row").filter({ hasText: "中国的封建势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.locator("#ref-c1-s6-l47-list")).toHaveClass(/active-source/);

  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  await page.getByRole("button", { name: "2", exact: true }).click();
  await expect(page.locator("#ref-c1-s6-l47-list")).toHaveClass(/active-source/);
});

test("switching graded questions scrolls the reference pane without moving the page", async ({ page }) => {
  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await page.getByRole("button", { name: "2", exact: true }).click();
  await page.locator(".option-row").filter({ hasText: "中国的封建势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();

  await page.evaluate(() => window.scrollTo({ top: 420, behavior: "instant" }));
  const beforeScrollY = await page.evaluate(() => window.scrollY);

  await page.getByRole("button", { name: "1", exact: true }).click();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  const afterScrollY = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThan(5);
});

test("chapter switching, coming-soon chapters, and download links work", async ({ page, isMobile }) => {
  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "第二章习题" }).click();
  await expect(page.getByRole("heading", { name: "第二章习题" })).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("131");

  await page.locator(".option-row").filter({ hasText: "广西省桂平县金田村" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();
  await page.getByRole("button", { name: /查看本题知识点/ }).click();
  await expect(page.locator("#ref-c2-s26-l162-list")).toHaveClass(/active-source/);

  await page.getByLabel("更多操作").click();
  await page.locator(".more-menu .download-summary").click();
  await expect(page.locator('a[href="/docs/chapter-2/chapter-2.md"]')).toContainText("下载为 md 格式");
  await expect(page.locator('a[href="/docs/chapter-2/chapter-2.pdf"]')).toContainText("下载为 PDF 格式");
  await expect(page.locator('a[href="/docs/中国近现代史纲要 复习.md"]')).toContainText("下载为 md 格式");
  await expect(page.locator('a[href="/docs/中国近现代史纲要复4习.pdf"]')).toContainText("下载为 PDF 格式");
  await page.getByLabel("更多操作").click();

  if (isMobile) {
    await page.getByLabel("选择章节").click();
  }
  await page.locator(".chapter-option").filter({ hasText: "第三章习题" }).click();
  await expect(page.getByRole("heading", { name: "第三章习题" })).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("85");
  await expect(page.locator('a[href="/docs/chapter-3/chapter-3.md"]')).toContainText("下载为 md 格式");
  await page.locator(".option-row").filter({ hasText: "颁布《钦定宪法大纲》" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c3-s46-l291-list")).toHaveClass(/active-source/);

  await page.locator(".chapter-option").filter({ hasText: "第四章习题" }).click();
  await expect(page.getByRole("heading", { name: "第四章习题" })).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("84");
  await expect(page.locator('a[href="/docs/chapter-4/chapter-4.md"]')).toContainText("下载为 md 格式");
  await page.locator(".option-row").filter({ hasText: "《青年杂志》" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c4-s63-l410-list")).toHaveClass(/active-source/);

  if (isMobile) {
    await page.getByLabel("选择章节").click();
  }
  await page.locator(".chapter-option").filter({ hasText: "（学习通）第一章客观题练习题" }).click();
  await expect(page.getByRole("heading", { name: "（学习通）第一章客观题练习题" })).toBeVisible();
  await expect(page.getByText("敬请期待")).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("0");
});

test("grading modes support instant and batch submissions", async ({ page }) => {
  await page.getByText("模式").click();
  await page.getByRole("button", { name: "点选即判" }).click();
  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await expect(page.getByText("回答正确")).toBeVisible();

  await page.getByText("模式").click();
  await page.getByRole("button", { name: "统一提交" }).click();
  await page.getByRole("button", { name: /下一题/ }).click();
  await page.locator(".option-row").filter({ hasText: "半殖民地半封建社会" }).click();
  await page.getByRole("button", { name: /提交已作答/ }).click();
  await expect(page.getByRole("heading", { name: /\/ 2/ })).toBeVisible();
  await expect(page.getByText(/已判题 2 道/)).toBeVisible();
});

test("footer links to the project repository", async ({ page }) => {
  const repositoryLink = page.getByRole("link", { name: "GitHub 仓库" });
  const moreMaterialsLink = page.getByRole("link", { name: "飞书资料" });

  await expect(repositoryLink).toBeVisible();
  await expect(repositoryLink).toHaveAttribute("href", "https://github.com/KuitoInoguchi/hist-interactive-review");
  await expect(moreMaterialsLink).toBeVisible();
  await expect(moreMaterialsLink).toHaveAttribute("href", "https://my.feishu.cn/wiki/AatBwiDa7ig7RJkzdlocLm1cnTh");
});

test("mobile layout can collapse and expand the reference pane", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");

  await expect(page.getByRole("button", { name: /查看复习资料/ })).toBeVisible();
  await page.getByRole("button", { name: /查看复习资料/ }).click();
  await expect(page.getByRole("button", { name: /收起复习资料/ })).toBeVisible();
  await page.getByRole("button", { name: /收起复习资料/ }).click();
  await expect(page.getByRole("button", { name: /查看复习资料/ })).toBeVisible();
  await expect(page.locator(".reference-pane")).toBeHidden();

  await page.getByRole("button", { name: /查看复习资料/ }).click();
  await expect(page.locator(".reference-pane")).toBeVisible();
});
