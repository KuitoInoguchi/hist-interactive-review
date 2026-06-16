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
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);
});

test("progress survives refresh and reset clears the attempt", async ({ page }) => {
  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();

  await page.reload();
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  await page.getByLabel("重置练习").click();
  await expect(page.getByText("回答正确")).toHaveCount(0);
  await expect(page.locator(".summary-grid div").filter({ hasText: "已提交" })).toContainText("0");
});

test("mobile layout can collapse and expand the reference pane", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");

  await expect(page.getByRole("button", { name: /折叠资料/ })).toBeVisible();
  await page.getByRole("button", { name: /折叠资料/ }).click();
  await expect(page.getByRole("button", { name: /展开资料/ })).toBeVisible();
  await expect(page.locator(".reference-pane")).toBeHidden();

  await page.getByRole("button", { name: /展开资料/ }).click();
  await expect(page.locator(".reference-pane")).toBeVisible();
});
