import { driver, type DriveStep, type Driver } from "driver.js";
import "driver.js/dist/driver.css";

export const ONBOARDING_STORAGE_KEY = "interactive-review:onboarding-v1-completed";

export type OnboardingApi = {
  closeTourMenus: () => void;
  openDownloadMenu: () => void;
  openModeMenu: () => void;
  prepareDemo: () => void;
  resetDemoQuestion: () => void;
  restoreAfterTour: () => void;
  selectAndGradeDemoAnswer: () => void;
  selectDemoAnswer: () => void;
  setDemoGradingMode: (mode: "instant" | "manual") => void;
  showDemoKnowledgePoint: () => void;
  submitDemoAnswer: () => void;
  toggleDemoFlag: () => void;
};

function isMobileViewport() {
  return window.matchMedia("(max-width: 760px)").matches;
}

function getTourElement(selector: string): Element {
  const elements = Array.from(document.querySelectorAll(selector));
  return (
    elements.find((element) => {
      const rect = element.getBoundingClientRect();
      const style = window.getComputedStyle(element);
      return rect.width > 0 && rect.height > 0 && style.visibility !== "hidden" && style.display !== "none";
    }) ??
    elements[0] ??
    document.body
  );
}

function deferTourRefresh(activeDriver: Driver, delay = 80) {
  window.setTimeout(() => activeDriver.refresh(), delay);
}

function advanceAfterAction(activeDriver: Driver, action?: () => void, delay = 40) {
  action?.();
  window.setTimeout(() => {
    activeDriver.moveNext();
    deferTourRefresh(activeDriver);
  }, delay);
}

function scrollTourElementIntoView(selector: string) {
  const element = getTourElement(selector);
  element.scrollIntoView({ block: "center", inline: "center", behavior: "auto" });
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

function openChapterMenu() {
  const menu = getTourElement('[data-tour="chapter-menu"]');
  if (menu instanceof HTMLDetailsElement) {
    menu.setAttribute("open", "");
  }
}

function createTourSteps(api: OnboardingApi): DriveStep[] {
  return [
    {
      element: () => getTourElement('[data-tour="question-card"]'),
      onHighlightStarted: () => {
        closeFloatingDetails();
        showQuizPane();
      },
      popover: {
        title: "用一个题目快速试一遍",
        description: "导览会临时切到一题可定位资料的演示题。结束或跳过后，会恢复你原来的章节、题号和作答进度。",
        side: "top",
        align: "center",
      },
    },
    {
      element: () => getTourElement('[data-tour="demo-answer-option"]'),
      popover: {
        title: "先选一个答案",
        description: "这一步演示普通作答。点下一步后，系统会替你选择演示答案。",
        side: "top",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          advanceAfterAction(activeDriver, api.selectDemoAnswer);
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="submit-button"]'),
      popover: {
        title: "提交后立即定位知识点",
        description: "提交后不仅会显示对错，还会把这道题对应的资料段落高亮出来。",
        side: "top",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          advanceAfterAction(activeDriver, api.submitDemoAnswer);
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="feedback-card"]'),
      popover: {
        title: "判题反馈",
        description: isMobileViewport()
          ? "移动端可以点“查看本题知识点”，直接跳到资料页里的高亮段落。"
          : "桌面端右侧资料会同步高亮这道题对应的知识点。",
        side: "top",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          api.showDemoKnowledgePoint();
          window.setTimeout(() => {
            activeDriver.moveNext();
            deferTourRefresh(activeDriver, 420);
          }, 80);
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="active-source"]'),
      onHighlightStarted: () => {
        showReferencePane();
      },
      popover: {
        title: "对应知识点会高亮",
        description: "高亮段落就是这道题命中的复习资料位置。刷题时可以把题目和知识点直接对上。",
        side: "bottom",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          showQuizPane();
          api.openModeMenu();
          window.setTimeout(() => {
            scrollTourElementIntoView('[data-tour="mode-menu-trigger"]');
            activeDriver.moveNext();
            deferTourRefresh(activeDriver, 220);
          }, 220);
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="mode-menu-trigger"]'),
      onHighlightStarted: () => {
        showQuizPane();
        api.openModeMenu();
      },
      popover: {
        title: "切换判题模式",
        description: "这里可以在“提交后判题”和“点选即判”之间切换。下一步会先切到点选即判。",
        side: "bottom",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          advanceAfterAction(activeDriver);
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="mode-option-instant"]'),
      onHighlightStarted: api.openModeMenu,
      popover: {
        title: "点选即判",
        description: "这个模式下，单选和判断题点选后会立刻判题。下一步会重置演示题并试一次。",
        side: "bottom",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          advanceAfterAction(activeDriver, () => {
            api.setDemoGradingMode("instant");
            api.resetDemoQuestion();
            api.selectAndGradeDemoAnswer();
          });
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="mode-option-manual"]'),
      onHighlightStarted: api.openModeMenu,
      popover: {
        title: "回到提交后判题",
        description: "如果想先选完、再统一提交，就用提交后判题。下一步会切回来继续演示其他工具。",
        side: "bottom",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          api.setDemoGradingMode("manual");
          window.setTimeout(() => {
            activeDriver.moveNext();
            window.setTimeout(() => {
              api.closeTourMenus();
              deferTourRefresh(activeDriver);
            }, 80);
          }, 40);
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="flag-button"]'),
      onHighlightStarted: showQuizPane,
      popover: {
        title: "标记记不准",
        description: "遇到拿不稳的题，可以用书签标记，之后在题号面板里会保留这个状态。",
        side: "top",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          advanceAfterAction(activeDriver, api.toggleDemoFlag);
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="submit-button"]'),
      popover: {
        title: "重置本题",
        description: "题目提交后，中间按钮会变成重置本题，用来重新作答当前题。",
        side: "top",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          advanceAfterAction(activeDriver, () => {
            api.resetDemoQuestion();
            api.openDownloadMenu();
          });
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="download-menu-trigger"]'),
      onHighlightStarted: () => {
        showQuizPane();
        api.openDownloadMenu();
      },
      popover: {
        title: "下载资料",
        description: "章节习题和复习资料可以从下载菜单取走，方便离线整理。",
        side: "bottom",
        align: "center",
        onNextClick: (_element, _step, { driver: activeDriver }) => {
          advanceAfterAction(activeDriver, api.openDownloadMenu);
        },
      },
    },
    {
      element: () => getTourElement('[data-tour="download-menu-content"]'),
      popover: {
        title: "选择下载格式",
        description: "有 md 和 PDF 两类入口；某些章节若资料暂缺，会在这里直接提示。",
        side: "bottom",
        align: "center",
      },
    },
    {
      element: () => getTourElement('[data-tour="help-button"]'),
      onHighlightStarted: closeFloatingDetails,
      popover: {
        title: "随时回来看",
        description: "忘记某个按钮含义时，点右下角问号打开帮助面板，也可以从那里重新播放导览。",
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

export function startOnboarding(options: { api: OnboardingApi; onFinish?: () => void }): Driver {
  showQuizPane();
  let finished = false;
  function finishOnce() {
    if (finished) return;
    finished = true;
    closeFloatingDetails();
    options.api.restoreAfterTour();
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
    steps: createTourSteps(options.api),
  });
  tour.drive();
  return tour;
}
