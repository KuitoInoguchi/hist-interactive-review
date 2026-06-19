import { expect, type Page, test } from "@playwright/test";

function questionChip(page: Page, questionId: number) {
  return page.locator(".question-nav .question-chip").nth(questionId - 1);
}

async function openQuestionPanel(page: Page) {
  const panel = page.locator(".question-nav-panel");
  if ((await panel.getAttribute("open")) === null) {
    await panel.locator("summary").click();
  }
}

async function closeQuestionPanelIfMobile(page: Page, isMobile: boolean) {
  if (!isMobile) return;
  const panel = page.locator(".question-nav-panel");
  if ((await panel.getAttribute("open")) !== null) {
    await page.locator(".question-nav-panel .mobile-menu-backdrop").click({ position: { x: 8, y: 8 } });
  }
}

async function advanceTour(page: Page, title: string) {
  await page.locator(".driver-popover-next-btn").click({ force: true });
  await expect(page.locator(".driver-popover")).toContainText(title);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.evaluate(() => window.localStorage.setItem("interactive-review:onboarding-v1-completed", "true"));
  await page.reload();
});

test("submitting an answer shows feedback and highlights the reference block", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop reference pane behavior");

  await page.locator(".option-row").filter({ hasText: "中国的封建势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();

  await expect(page.getByText("回答错误")).toBeVisible();
  await expect(page.getByText("正确答案：C")).toBeVisible();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);
});

test("progress survives refresh and reset clears the attempt", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop reset control behavior");

  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();

  await page.reload();
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  page.once("dialog", (dialog) => dialog.accept());
  await page.getByLabel("重置练习").click();
  await expect(page.getByText("回答正确")).toHaveCount(0);
  await expect(page.locator(".summary-grid div").filter({ hasText: "已提交" })).toContainText("0");
});

test("question chip becomes pending after selecting an unsubmitted answer", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop chapter selector behavior");

  await openQuestionPanel(page);
  const questionThreeChip = questionChip(page, 3);

  await questionThreeChip.click();
  await page.locator(".option-row").filter({ hasText: "宗族家长制" }).click();

  await expect(questionThreeChip).toHaveClass(/is-pending/);
});

test("flagged questions stay highlighted even after grading", async ({ page, isMobile }) => {
  await openQuestionPanel(page);
  const questionOneChip = questionChip(page, 1);
  const flagButton = page.getByRole("button", { name: "记不清" });
  await closeQuestionPanelIfMobile(page, isMobile);

  await flagButton.click();
  await expect(flagButton).toHaveAttribute("aria-label", "取消记不清");
  await expect(questionOneChip).toHaveClass(/is-flagged/);

  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();

  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(questionOneChip).toHaveClass(/is-correct/);
  await expect(questionOneChip).toHaveClass(/is-flagged/);
});

test("flagging works with legacy saved progress from older chapters", async ({ page, isMobile }) => {
  await page.evaluate(() => {
    window.localStorage.setItem(
      "interactive-review:multi-chapter-progress",
      JSON.stringify({
        selectedChapterId: "regular-2",
        referenceCollapsed: false,
        progressByChapter: {
          "regular-2": {
            currentIndex: 0,
            selectedByQuestion: {},
            attempts: {},
            activeSourceIds: [],
          },
        },
      }),
    );
  });
  await page.reload();

  const flagButton = page.getByRole("button", { name: "记不清" });
  await openQuestionPanel(page);
  const questionOneChip = questionChip(page, 1);
  await closeQuestionPanelIfMobile(page, isMobile);

  await flagButton.click();
  if (!isMobile) {
    await expect(page.getByRole("heading", { name: "第二章习题" })).toBeVisible();
  }
  await expect(flagButton).toHaveAttribute("aria-label", "取消记不清");
  await expect(questionOneChip).toHaveClass(/is-flagged/);
});

test("batch grading submits all selected unanswered questions", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop question navigation behavior");

  await expect(page.locator(".question-nav-panel")).not.toHaveAttribute("open", "");
  await openQuestionPanel(page);
  const batchButton = page.locator(".question-actions").getByRole("button", { name: /一键批改/ });

  await expect(batchButton).toBeDisabled();

  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await expect(questionChip(page, 1)).toHaveClass(/is-pending/);
  await expect(batchButton).toBeEnabled();

  await questionChip(page, 2).click();
  await page.locator(".option-row").filter({ hasText: "外国公使馆" }).click();
  await expect(questionChip(page, 2)).toHaveClass(/is-pending/);

  await batchButton.click();

  await expect(page.locator(".summary-grid div").filter({ hasText: "已提交" })).toContainText("2");
  await expect(questionChip(page, 1)).toHaveClass(/is-correct/);
  await expect(questionChip(page, 2)).toHaveClass(/is-wrong/);
  await expect(batchButton).toBeDisabled();
  await expect(page.getByText("回答错误")).toBeVisible();
});

test("switching to a graded question syncs reference highlight", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop reference pane behavior");

  await openQuestionPanel(page);
  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  await questionChip(page, 2).click();
  await page.locator(".option-row").filter({ hasText: "中国的封建势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.locator("#ref-c1-s6-l47-list")).toHaveClass(/active-source/);

  await questionChip(page, 1).click();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  await questionChip(page, 2).click();
  await expect(page.locator("#ref-c1-s6-l47-list")).toHaveClass(/active-source/);
});

test("switching graded questions scrolls the reference pane without moving the page", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop page scroll behavior");

  await openQuestionPanel(page);
  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await questionChip(page, 2).click();
  await page.locator(".option-row").filter({ hasText: "中国的封建势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();

  await page.evaluate(() => window.scrollTo({ top: 420, behavior: "instant" }));
  const beforeScrollY = await page.evaluate(() => window.scrollY);

  await questionChip(page, 1).click();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  const afterScrollY = await page.evaluate(() => window.scrollY);
  expect(Math.abs(afterScrollY - beforeScrollY)).toBeLessThan(5);
});

test("chapter switching, coming-soon chapters, and download links work", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop chapter selector behavior");

  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "第二章习题" }).click();
  await expect(page.getByRole("heading", { name: "第二章习题" })).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("131");

  await page.locator(".option-row").filter({ hasText: "广西省桂平县金田村" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c2-s26-l163-list")).toHaveClass(/active-source/);

  await page.locator(".header-actions").getByRole("button", { name: /下载习题/ }).click();
  await expect(page.locator('a[href="/docs/chapter-2/chapter-2.md"]')).toContainText("下载为 md 格式");
  await expect(page.locator('a[href="/docs/chapter-2/chapter-2.pdf"]')).toContainText("下载为 PDF 格式");
  await expect(page.locator('a[href="/docs/中国近现代史纲要 复习.md"]')).toContainText("下载为 md 格式");
  await expect(page.locator('a[href="/docs/中国近现代史纲要复4习.pdf"]')).toContainText("下载为 PDF 格式");

  await page.keyboard.press("Escape");
  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "第三章习题" }).click();
  await expect(page.getByRole("heading", { name: "第三章习题" })).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("85");
  await page.locator(".header-actions").getByRole("button", { name: /下载习题/ }).click();
  await expect(page.locator('a[href="/docs/chapter-3/chapter-3.md"]')).toContainText("下载为 md 格式");
  await page.keyboard.press("Escape");
  await page.locator(".option-row").filter({ hasText: "颁布《钦定宪法大纲》" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c3-s46-l295-list")).toHaveClass(/active-source/);

  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "第四章习题" }).click();
  await expect(page.getByRole("heading", { name: "第四章习题" })).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("84");
  await page.locator(".header-actions").getByRole("button", { name: /下载习题/ }).click();
  await expect(page.locator('a[href="/docs/chapter-4/chapter-4.md"]')).toContainText("下载为 md 格式");
  await page.keyboard.press("Escape");
  await page.locator(".option-row").filter({ hasText: "《青年杂志》" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c4-s63-l410-list")).toHaveClass(/active-source/);

  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "第五章习题" }).click();
  await expect(page.getByRole("heading", { name: "第五章习题" })).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("84");
  await page.locator(".header-actions").getByRole("button", { name: /下载习题/ }).click();
  await expect(page.locator('a[href="/docs/chapter-5/chapter-5.md"]')).toContainText("下载为 md 格式");
  await page.keyboard.press("Escape");
  await page.locator(".option-row").filter({ hasText: "张学良宣布东北易帜" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c5-s80-l537-list")).toHaveClass(/active-source/);

  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "（学习通）" }).click();
  await expect(page.getByRole("heading", { name: "（学习通）" })).toBeVisible();
  await expect(page.getByText("如果你的任课老师在学习通发布了题目，请在学习通上完成哦。")).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "总题数" })).toContainText("0");
});

test("chapter 5 question mapping jumps to the matched source block", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop chapter selector behavior");

  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "第五章习题" }).click();
  await openQuestionPanel(page);

  await page.getByRole("button", { name: "56", exact: true }).click();
  await page.locator(".option-row").filter({ hasText: "必须坚持独立自主解决中国革命实际问题" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.locator("#ref-c5-s88-l597-list")).toHaveClass(/active-source/);

  await page.getByRole("button", { name: "58", exact: true }).click();
  await page.locator(".option-row").filter({ hasText: "只有把马克思主义基本原理同中国革命具体实际结合起来，革命事业才能胜利" }).click();
  await page.locator(".option-row").filter({ hasText: "长征是一次理想信念的伟大远征" }).click();
  await page.locator(".option-row").filter({ hasText: "长征是一次检验真理、唤醒民众、开创新局的伟大远征" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.locator("#ref-c5-s89-l602-list")).toHaveClass(/active-source/);

  await page.getByRole("button", { name: "59", exact: true }).click();
  await page.locator(".option-row").filter({ hasText: "《论反对日本帝国主义的策略》" }).click();
  await page.locator(".option-row").filter({ hasText: "《中国革命战争的战略问题》" }).click();
  await page.locator(".option-row").filter({ hasText: "《实践论》" }).click();
  await page.locator(".option-row").filter({ hasText: "《矛盾论》" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.locator("#ref-c5-s90-l609-list")).toHaveClass(/active-source/);
});

test("footer links to the project repository", async ({ page }) => {
  const repositoryLink = page.getByRole("link", { name: "GitHub 仓库" });
  const moreMaterialsLink = page.getByRole("link", { name: "飞书资料" });

  await expect(repositoryLink).toBeVisible();
  await expect(repositoryLink).toHaveAttribute("href", "https://github.com/KuitoInoguchi/hist-interactive-review");
  await expect(moreMaterialsLink).toBeVisible();
  await expect(moreMaterialsLink).toHaveAttribute("href", "https://my.feishu.cn/wiki/AatBwiDa7ig7RJkzdlocLm1cnTh");
});

test("automatic theme follows UTC+8 night hours when no manual choice is saved", async ({ page }) => {
  await page.addInitScript(() => {
    const fixedTime = Date.UTC(2026, 0, 1, 12, 0);
    const NativeDate = Date;
    function FixedDate(this: Date, ...args: unknown[]) {
      return args.length === 0
        ? new NativeDate(fixedTime)
        : new NativeDate(...(args as [number | string | Date]));
    }
    FixedDate.UTC = NativeDate.UTC;
    FixedDate.parse = NativeDate.parse;
    FixedDate.now = () => fixedTime;
    FixedDate.prototype = NativeDate.prototype;
    window.Date = FixedDate as unknown as DateConstructor;
  });

  await page.goto("/");
  await page.evaluate(() => window.localStorage.clear());
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "auto");
});

test("floating theme button stores a manual theme choice across refreshes", async ({ page }) => {
  await page.evaluate(() => window.localStorage.setItem("interactive-review:theme-mode", "dark"));
  await page.reload();

  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  await page.getByRole("button", { name: "切换到日间模式" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "light");

  await page.reload();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "light");
});

test("theme menu can return to automatic mode", async ({ page, isMobile }) => {
  await page.evaluate(() => window.localStorage.setItem("interactive-review:theme-mode", "dark"));
  await page.reload();

  if (isMobile) {
    await page.locator(".mobile-course-menu > summary").click();
    await page.locator(".mobile-course-popover").getByRole("button", { name: /主题/ }).click();
  } else {
    await page.locator(".header-actions").getByRole("button", { name: /主题/ }).click();
  }

  await page.getByRole("menuitem", { name: /自动/ }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme-mode", "auto");
});

test("first visit automatically starts onboarding and stores completion", async ({ page }) => {
  await page.evaluate(() => window.localStorage.removeItem("interactive-review:onboarding-v1-completed"));
  await page.reload();

  await expect(page.locator(".driver-popover")).toBeVisible();
  await expect(page.locator(".driver-popover")).toContainText("用一个题目快速试一遍");
  await page.locator(".driver-popover-close-btn").click();
  await expect
    .poll(() => page.evaluate(() => window.localStorage.getItem("interactive-review:onboarding-v1-completed")))
    .toBe("true");

  await page.reload();
  await expect(page.locator(".driver-popover")).toHaveCount(0);
});

test("help panel explains controls and can replay onboarding", async ({ page }) => {
  await page.getByRole("button", { name: "打开帮助" }).click();

  await expect(page.getByRole("dialog", { name: "按钮和流程说明" })).toBeVisible();
  await expect(page.getByText("题号面板：重置")).toBeVisible();
  await expect(page.getByText("移动端手势")).toBeVisible();
  await expect(page.locator(".help-item-icon svg")).toHaveCount(14);

  await page.getByRole("button", { name: "重新开始导览" }).click();
  await expect(page.locator(".driver-popover")).toBeVisible();
  await expect(page.locator(".driver-popover")).toContainText("用一个题目快速试一遍");
});

test("interactive onboarding demos quiz features and restores progress", async ({ page, isMobile }) => {
  test.skip(isMobile, "desktop-only state restoration path");

  await page.locator(".chapter-selector-panel > summary").click();
  await page.locator(".chapter-option").filter({ hasText: "第二章习题" }).click();
  await openQuestionPanel(page);
  await page.getByRole("button", { name: "3", exact: true }).click();
  await page.locator(".option-row").filter({ hasText: "《天朝田亩制度》" }).click();

  await page.getByRole("button", { name: "打开帮助" }).click();
  await page.getByRole("button", { name: "重新开始导览" }).click();

  await expect(page.locator(".driver-popover")).toContainText("用一个题目快速试一遍");
  await expect(page.getByRole("heading", { name: "第一章习题" })).toBeVisible();

  await advanceTour(page, "先选一个答案");
  await advanceTour(page, "提交后立即定位知识点");
  await expect(page.locator(".option-row.is-selected")).toContainText("资本-帝国主义侵略势力");

  await advanceTour(page, "判题反馈");
  await expect(page.getByText("回答正确")).toBeVisible();
  await expect(page.locator("#ref-c1-s6-l46-list")).toHaveClass(/active-source/);

  await advanceTour(page, "对应知识点会高亮");
  await expect(page.locator('[data-tour="active-source"]')).toHaveClass(/active-source/);

  await advanceTour(page, "切换判题模式");
  await advanceTour(page, "点选即判");
  await advanceTour(page, "回到提交后判题");
  await expect(page.locator('[data-tour="mode-option-manual"]')).toBeVisible();
  await expect(page.locator(".summary-grid div").filter({ hasText: "已提交" })).toContainText("1");

  await advanceTour(page, "标记记不准");
  await expect(page.locator('[data-tour="flag-button"]')).toBeVisible();
  await advanceTour(page, "重置本题");
  await expect(page.getByRole("button", { name: "取消记不清" })).toBeVisible();

  await advanceTour(page, "下载资料");
  await expect(page.getByRole("button", { name: /提交答案/ })).toBeDisabled();

  await advanceTour(page, "选择下载格式");
  await expect(page.locator('[data-tour="download-menu-content"]')).toContainText("下载为 md 格式");

  await page.locator(".driver-popover-close-btn").click();
  await expect(page.getByRole("heading", { name: "第二章习题" })).toBeVisible();
  await expect(page.locator(".question-meta")).toContainText("3 / 131");
  await expect(page.locator(".option-row.is-selected")).toContainText("《天朝田亩制度》");
  await expect(page.locator(".summary-grid div").filter({ hasText: "已提交" })).toContainText("0");
});

test("mobile help panel scrolls internally without moving the quiz pane", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");
  await page.setViewportSize({ width: 393, height: 520 });

  await page.getByRole("button", { name: "打开帮助" }).click();
  await expect(page.getByRole("dialog", { name: "按钮和流程说明" })).toBeVisible();

  const scrollState = await page.evaluate(() => {
    const content = document.querySelector(".help-dialog-content");
    const quizPane = document.querySelector(".quiz-pane");
    if (!(content instanceof HTMLElement) || !(quizPane instanceof HTMLElement)) return null;
    quizPane.scrollTop = 24;
    const quizBefore = quizPane.scrollTop;
    const helpBefore = content.scrollTop;
    content.scrollTop = content.scrollHeight;
    return {
      helpAfter: content.scrollTop,
      helpBefore,
      helpClientHeight: content.clientHeight,
      helpScrollHeight: content.scrollHeight,
      quizAfter: quizPane.scrollTop,
      quizBefore,
    };
  });

  expect(scrollState).not.toBeNull();
  expect(scrollState!.helpScrollHeight).toBeGreaterThan(scrollState!.helpClientHeight);
  expect(scrollState!.helpAfter).toBeGreaterThan(scrollState!.helpBefore);
  expect(scrollState!.quizAfter).toBe(scrollState!.quizBefore);
});

test("mobile onboarding points to the knowledge button and reference highlight", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");

  await page.getByRole("button", { name: "打开帮助" }).click();
  await page.getByRole("button", { name: "重新开始导览" }).click();

  await advanceTour(page, "先选一个答案");
  await advanceTour(page, "提交后立即定位知识点");
  await advanceTour(page, "判题反馈");
  await expect(page.locator('[data-tour="knowledge-button"]')).toBeVisible();

  await advanceTour(page, "对应知识点会高亮");
  await expect(page.locator(".mobile-page-dots button").nth(1)).toHaveClass(/is-active/);
  await expect(page.locator('[data-tour="active-source"]')).toHaveClass(/active-source/);

  await page.locator(".driver-popover-close-btn").click();
  await expect(page.locator(".mobile-page-dots button").nth(0)).toHaveClass(/is-active/);
});

test("mobile layout can switch to the reference pane", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");

  await page.getByRole("button", { name: "资料区域" }).click();
  await expect(page.locator(".reference-pane")).toBeVisible();
  await expect(page.locator(".mobile-page-dots button").nth(1)).toHaveClass(/is-active/);
});

test("mobile layout can swipe to the reference pane", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");

  const quizPane = page.locator(".quiz-pane");
  const box = await quizPane.boundingBox();
  expect(box).not.toBeNull();

  await page.evaluate(({ startX, endX, y }) => {
    const layout = document.querySelector(".learning-layout");
    if (!(layout instanceof HTMLElement)) return;
    layout.dispatchEvent(
      new TouchEvent("touchstart", {
        bubbles: true,
        cancelable: true,
        touches: [new Touch({ identifier: 1, target: layout, clientX: startX, clientY: y })],
      }),
    );
    layout.dispatchEvent(
      new TouchEvent("touchend", {
        bubbles: true,
        cancelable: true,
        changedTouches: [new Touch({ identifier: 1, target: layout, clientX: endX, clientY: y })],
      }),
    );
  }, {
    startX: box!.x + box!.width * 0.8,
    endX: box!.x + box!.width * 0.2,
    y: box!.y + box!.height * 0.45,
  });

  await expect
    .poll(() =>
      page.evaluate(() => {
        const layout = document.querySelector(".learning-layout");
        return layout instanceof HTMLElement ? layout.scrollLeft : 0;
      }),
    )
    .toBeGreaterThan(100);
  await expect(page.locator(".mobile-page-dots button").nth(1)).toHaveClass(/is-active/);
  await expect(page.locator(".reference-content")).toContainText("半殖民地半封建社会");
});

test("mobile menus float without taking vertical space", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");

  const controlsLayout = await page.evaluate(() => {
    const chapterSummary = document.querySelector(".mobile-course-menu > summary")?.getBoundingClientRect();
    const questionSummary = document.querySelector(".question-nav-panel > summary")?.getBoundingClientRect();
    const questionCard = document.querySelector(".question-card")?.getBoundingClientRect();
    return chapterSummary && questionSummary && questionCard
      ? {
          chapterTop: chapterSummary.top,
          chapterBottom: chapterSummary.bottom,
          questionTop: questionSummary.top,
          questionBottom: questionSummary.bottom,
          cardTop: questionCard.top,
        }
      : null;
  });

  expect(controlsLayout).not.toBeNull();
  expect(Math.abs(controlsLayout!.chapterTop - controlsLayout!.questionTop)).toBeLessThan(2);
  expect(Math.abs(controlsLayout!.chapterBottom - controlsLayout!.questionBottom)).toBeLessThan(2);
  expect(controlsLayout!.questionBottom - controlsLayout!.questionTop).toBeLessThan(40);

  await page.locator(".mobile-course-menu > summary").click();
  await expect(page.locator(".mobile-course-popover")).toBeVisible();

  const layout = await page.evaluate(() => {
    const popover = document.querySelector(".mobile-course-popover")?.getBoundingClientRect();
    const questionCard = document.querySelector(".question-card")?.getBoundingClientRect();
    return popover && questionCard
      ? {
          popoverTop: popover.top,
          questionCardTop: questionCard.top,
        }
      : null;
  });

  expect(layout).not.toBeNull();
  expect(Math.abs(layout!.questionCardTop - controlsLayout!.cardTop)).toBeLessThan(2);
  expect(layout!.popoverTop).toBeLessThanOrEqual(layout!.questionCardTop);

  await page.locator(".mobile-course-menu .mobile-menu-backdrop").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".mobile-course-menu")).not.toHaveAttribute("open", "");

  await page.locator(".question-nav-panel > summary").click();
  await expect(page.locator(".question-nav")).toBeVisible();
  await expect(page.locator(".question-nav-tools .question-tool-button")).toHaveCount(3);
  await expect(page.getByRole("button", { name: /切换到/ })).toBeVisible();
  await page.locator(".question-nav-panel .mobile-menu-backdrop").click({ position: { x: 8, y: 8 } });
  await expect(page.locator(".question-nav-panel")).not.toHaveAttribute("open", "");
});

test("submitted questions can be reset and restored", async ({ page }) => {
  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();

  await page.getByRole("button", { name: "重置本题" }).click();
  await expect(page.getByText("回答正确")).toHaveCount(0);
  await expect(page.getByRole("button", { name: /提交答案/ })).toBeDisabled();

  await openQuestionPanel(page);
  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByText("回答正确")).toBeVisible();
});

test("question panel can batch reset, undo reset, and pin on mobile", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");

  await page.locator(".option-row").filter({ hasText: "资本-帝国主义侵略势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答正确")).toBeVisible();

  await page.locator(".question-nav-panel > summary").click();
  const toolButtons = page.locator(".question-nav-tools .question-tool-button");
  await expect(toolButtons).toHaveCount(3);
  await expect(toolButtons.nth(0)).toContainText("重置");
  await expect(toolButtons.nth(1)).toContainText("全部");
  await expect(toolButtons.nth(2)).toContainText("撤销");

  await toolButtons.nth(0).click();
  await expect(page.getByText("选择要重置的题目，再点重置确认")).toBeVisible();
  await expect(toolButtons.nth(0)).toHaveClass(/is-active/);
  await expect(toolButtons.nth(2)).toContainText("取消");
  await questionChip(page, 1).click();
  page.once("dialog", (dialog) => dialog.accept());
  await toolButtons.nth(0).click();
  await expect(page.getByText("回答正确")).toHaveCount(0);

  await page.getByRole("button", { name: "撤销", exact: true }).click();
  await expect(page.getByText("回答正确")).toBeVisible();

  await toolButtons.nth(0).click();
  await expect(toolButtons.nth(2)).toContainText("取消");
  await toolButtons.nth(2).click();
  await expect(toolButtons.nth(2)).toContainText("撤销");

  await page.getByLabel("常驻开启").click();
  const pinnedLayout = await page.evaluate(() => {
    const panel = document.querySelector(".question-nav-panel");
    const nav = document.querySelector(".question-nav");
    const card = document.querySelector(".question-card");
    const popover = document.querySelector(".question-nav-popover");
    if (!(panel instanceof HTMLElement) || !(nav instanceof HTMLElement) || !card || !popover) return null;
    const panelRect = panel.getBoundingClientRect();
    const navRect = nav.getBoundingClientRect();
    const cardRect = card.getBoundingClientRect();
    const popoverRect = popover.getBoundingClientRect();
    const firstChip = nav.querySelector(".question-chip")?.getBoundingClientRect();
    return {
      panelOpen: panel.hasAttribute("open"),
      cardTop: cardRect.top,
      popoverBottom: popoverRect.bottom,
      navHeight: navRect.height,
      chipHeight: firstChip?.height ?? 0,
      rowGap: Number.parseFloat(getComputedStyle(nav).rowGap) || 0,
      navScrollTop: nav.scrollTop,
      navScrollHeight: nav.scrollHeight,
      navClientHeight: nav.clientHeight,
    };
  });
  expect(pinnedLayout).not.toBeNull();
  expect(pinnedLayout!.panelOpen).toBe(true);
  expect(pinnedLayout!.cardTop).toBeGreaterThanOrEqual(pinnedLayout!.popoverBottom);
  expect(pinnedLayout!.navHeight).toBeGreaterThan(pinnedLayout!.chipHeight * 3 + pinnedLayout!.rowGap * 2);
  expect(pinnedLayout!.navHeight).toBeLessThan(pinnedLayout!.chipHeight * 4 + pinnedLayout!.rowGap * 3);
  expect(pinnedLayout!.navScrollHeight).toBeGreaterThan(pinnedLayout!.navClientHeight);

  await page.getByLabel("取消常驻").click();
  await expect(page.locator(".question-nav-panel")).not.toHaveAttribute("open", "");
});

test("mobile quiz pane remains scrollable after feedback expands the page", async ({ page, isMobile }) => {
  test.skip(!isMobile, "mobile-only behavior");
  await page.setViewportSize({ width: 393, height: 520 });

  await page.locator(".option-row").filter({ hasText: "中国的封建势力" }).click();
  await page.getByRole("button", { name: /提交答案/ }).click();
  await expect(page.getByText("回答错误")).toBeVisible();

  const scrollState = await page.evaluate(() => {
    const pane = document.querySelector(".quiz-pane");
    if (!(pane instanceof HTMLElement)) return null;
    const before = pane.scrollTop;
    pane.scrollTop = pane.scrollHeight;
    return {
      before,
      after: pane.scrollTop,
      clientHeight: pane.clientHeight,
      scrollHeight: pane.scrollHeight,
    };
  });

  expect(scrollState).not.toBeNull();
  expect(scrollState!.scrollHeight).toBeGreaterThan(scrollState!.clientHeight);
  expect(scrollState!.after).toBeGreaterThan(scrollState!.before);
});
