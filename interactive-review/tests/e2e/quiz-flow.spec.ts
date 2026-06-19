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

test("chapter switching, coming-soon chapters, and download links work", async ({ page, isMobile }) => {
  if (isMobile) {
    await page.getByLabel("选择章节").click();
  } else {
    await page.locator(".chapter-selector-panel > summary").click();
  }
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
  await expect(page.getByText("敬请期待")).toBeVisible();
  await expect(page.getByRole("heading", { name: "第三章习题" })).toBeVisible();

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
