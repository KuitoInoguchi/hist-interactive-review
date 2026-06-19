import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

export const ONBOARDING_STORAGE_KEY = "interactive-review:onboarding-v1-completed";

function isMobileViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function getTourElement(selector: string): Element {
  return document.querySelector(selector) ?? document.body;
}

function closeFloatingDetails() {
  document.querySelectorAll<HTMLDetailsElement>("details.expandable-menu[open]").forEach((element) => {
    if (!element.classList.contains("is-pinned")) {
      element.removeAttribute("open");
    }
  });
}

function openQuestionPanel() {
  const panel = document.querySelector<HTMLDetailsElement>('[data-tour="question-panel"]');
  panel?.setAttribute("open", "");
}

function showQuizPane() {
  const layout = document.querySelector<HTMLElement>(".learning-layout");
  if (!layout || !isMobileViewport()) return;
  layout.scrollTo({ left: 0, behavior: "instant" });
}

function showReferencePane() {
  const layout = document.querySelector<HTMLElement>(".learning-layout");
  if (!layout || !isMobileViewport()) return;
  layout.scrollTo({ left: layout.clientWidth, behavior: "smooth" });
}

function createTourSteps(): DriveStep[] {
  return [
    {
      element: () => getTourElement('[data-tour="chapter-menu"]'),
      popover: {
        title: "选择章节",
        description: "从这里切换章节、判题模式、主题和下载资料。移动端点章节标题即可展开菜单。",
        side: "bottom",
        align: "start",
      },
    },
    {
      element: () => getTourElement('[data-tour="question-card"]'),
      popover: {
        title: "阅读题目并作答",
        description: "题干和选项都在答题卡中。单选、判断题点选一个答案；多选题可以选择多个选项。",
        side: "top",
        align: "center",
      },
    },
    {
      element: () => getTourElement('[data-tour="question-actions"]'),
      popover: {
        title: "提交与标记",
        description: "中间按钮用于提交；判题后会变成重置本题。书签图标表示记不清，一键批改会提交所有已选择但未判题的题目。",
        side: "top",
        align: "center",
      },
    },
    {
      element: () => getTourElement('[data-tour="reference-entry"]'),
      onHighlightStarted: showReferencePane,
      popover: {
        title: "查看资料",
        description: "移动端可点击底部圆点或左右滑动进入资料页；判题后也可以点“查看本题知识点”跳到高亮段落。",
        side: "top",
        align: "center",
      },
    },
    {
      element: () => getTourElement('[data-tour="question-panel"]'),
      onHighlightStarted: () => {
        showQuizPane();
        openQuestionPanel();
      },
      popover: {
        title: "题号面板",
        description: "这里可以快速跳题。题号区域露出下一行的一截，表示还能继续上下滑动查看更多题号。",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: () => getTourElement('[data-tour="question-panel-tools"]'),
      onHighlightStarted: openQuestionPanel,
      popover: {
        title: "题号面板工具",
        description: "重置可先选择题目再确认；全部会重置整章；撤销能恢复最近一次重置。书本图标可让题号面板常驻。",
        side: "left",
        align: "center",
      },
    },
    {
      element: () => getTourElement('[data-tour="theme-toggle"]'),
      popover: {
        title: "夜间模式",
        description: "右下角月亮/太阳按钮可以快速切换主题。默认会按 UTC+8 的 20:00 到 06:00 自动启用夜间模式。",
        side: "left",
        align: "center",
      },
    },
    {
      element: () => getTourElement('[data-tour="help-button"]'),
      popover: {
        title: "随时查看帮助",
        description: "忘记按钮含义时，点问号打开帮助面板；也可以从那里重新播放这段导览。",
        side: "left",
        align: "center",
      },
    },
  ];
}

export function shouldAutoStartOnboarding() {
  return window.localStorage.getItem(ONBOARDING_STORAGE_KEY) !== "true";
}

export function markOnboardingCompleted() {
  window.localStorage.setItem(ONBOARDING_STORAGE_KEY, "true");
}

export function startOnboarding(options: { onFinish?: () => void } = {}): Driver {
  showQuizPane();
  let finished = false;
  function finishOnce() {
    if (finished) return;
    finished = true;
    closeFloatingDetails();
    markOnboardingCompleted();
    options.onFinish?.();
  }
  const tour = driver({
    allowClose: true,
    allowKeyboardControl: true,
    animate: true,
    disableActiveInteraction: true,
    doneBtnText: "完成",
    nextBtnText: "下一步",
    onCloseClick: (_element, _step, { driver: activeDriver }) => {
      finishOnce();
      activeDriver.destroy();
    },
    onDestroyed: finishOnce,
    overlayClickBehavior: "close",
    popoverClass: "app-tour-popover",
    prevBtnText: "上一步",
    progressText: "{{current}} / {{total}}",
    showButtons: ["previous", "next", "close"],
    showProgress: true,
    stagePadding: 6,
    stageRadius: 2,
    steps: createTourSteps(),
  });
  tour.drive();
  return tour;
}
