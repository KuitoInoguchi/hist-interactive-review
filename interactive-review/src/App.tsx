import {
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Grid3X3,
  HelpCircle,
  ListChecks,
  Monitor,
  Moon,
  X,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Sun,
  Trophy,
  Undo2,
} from "lucide-react";
import {
  type MouseEvent as ReactMouseEvent,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type SyntheticEvent,
  type TouchEvent as ReactTouchEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ReferencePane } from "./components/ReferencePane";
import chaptersData from "./generated/chapters.json";
import { answerListLabel, areAnswersEqual } from "./lib/answerCheck";
import {
  THEME_STORAGE_KEY,
  type ResolvedTheme,
  type ThemeMode,
  isThemeMode,
  resolveTheme,
  themeModeLabels,
} from "./lib/theme";
import { shouldAutoStartOnboarding, startOnboarding, type OnboardingApi } from "./lib/onboarding";
import type { Question, QuizAttempt } from "./types";

const chaptersPayload = chaptersData as {
  chapters: Array<{
    id: string;
    kind: "regular" | "xuetong";
    chapterNo: number;
    numeral: string;
    title: string;
    available: boolean;
    questions: Question[];
    downloads: { markdown: string | null; pdf: string | null };
  }>;
  referenceDownloads: { markdown: string | null; pdf: string | null };
};
const chapters = chaptersPayload.chapters;
const regularChapters = chapters.filter((chapter) => chapter.kind === "regular");
const xuetongChapter = {
  id: "xuetong",
  kind: "xuetong" as const,
  chapterNo: 0,
  numeral: "学习通",
  title: "（学习通）",
  available: true,
  questions: [] as Question[],
  downloads: { markdown: null, pdf: null },
};
const selectableChapters = [...regularChapters, xuetongChapter];
const defaultChapterId = chapters[0]?.id ?? "regular-1";
const STORAGE_KEY = "interactive-review:multi-chapter-progress";
const modeLabels = {
  "per-question-submit": "提交后判题",
  "instant-on-select": "点选即判",
  "batch-submit": "一键批改",
} as const;
type GradingMode = keyof typeof modeLabels;
const DEFAULT_GRADING_MODE: GradingMode = "per-question-submit";

type ChapterProgress = {
  currentIndex: number;
  selectedByQuestion: Record<number, string[]>;
  attempts: Record<number, QuizAttempt>;
  flaggedQuestionIds: number[];
  activeSourceIds: string[];
};

type SavedQuizState = {
  selectedChapterId: string;
  progressByChapter: Record<string, ChapterProgress>;
  referenceCollapsed: boolean;
  gradingMode: GradingMode;
};

type ResetSnapshot = {
  chapterId: string;
  progress: ChapterProgress;
};

type OnboardingSnapshot = {
  activeMobilePage: 0 | 1;
  gradingMode: GradingMode;
  lastResetSnapshot: ResetSnapshot | null;
  openMenu: string | null;
  progressByChapter: Record<string, ChapterProgress>;
  questionPanelPinned: boolean;
  referenceCollapsed: boolean;
  resetSelectionIds: number[];
  resetSelectionMode: boolean;
  selectedChapterId: string;
};

const HELP_DIALOG_ANIMATION_MS = 180;

function normalizeProgress(progress?: Partial<ChapterProgress> | null): ChapterProgress {
  return {
    currentIndex: progress?.currentIndex ?? 0,
    selectedByQuestion: progress?.selectedByQuestion ?? {},
    attempts: progress?.attempts ?? {},
    flaggedQuestionIds: progress?.flaggedQuestionIds ?? [],
    activeSourceIds: progress?.activeSourceIds ?? [],
  };
}

function readSavedState(): Partial<SavedQuizState> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Partial<SavedQuizState>;
    const progressByChapter = Object.fromEntries(
      Object.entries(parsed.progressByChapter ?? {}).map(([chapterId, progress]) => [
        chapterId,
        normalizeProgress(progress),
      ]),
    );
    return {
      ...parsed,
      gradingMode: normalizeGradingMode(parsed.gradingMode),
      progressByChapter,
    };
  } catch {
    return {};
  }
}

function readThemeMode(): ThemeMode {
  if (typeof window === "undefined") return "auto";
  const savedTheme = window.localStorage.getItem(THEME_STORAGE_KEY);
  return isThemeMode(savedTheme) ? savedTheme : "auto";
}

function typeLabel(type: Question["type"]) {
  if (type === "single") return "单选题";
  if (type === "multiple") return "多选题";
  return "判断题";
}

function questionStatusClass(
  attempt: QuizAttempt | undefined,
  hasPendingSelection: boolean,
  isFlagged: boolean,
) {
  if (isFlagged) return attempt ? `is-flagged ${attempt.isCorrect ? "is-correct" : "is-wrong"}` : "is-flagged";
  if (!attempt && hasPendingSelection) return "is-pending";
  if (!attempt) return "";
  return attempt.isCorrect ? "is-correct" : "is-wrong";
}

function emptyProgress(): ChapterProgress {
  return {
    currentIndex: 0,
    selectedByQuestion: {},
    attempts: {},
    flaggedQuestionIds: [],
    activeSourceIds: [],
  };
}

function normalizeGradingMode(mode?: string | null): GradingMode {
  if (mode === "manual") return "per-question-submit";
  if (mode === "instant") return "instant-on-select";
  return mode && mode in modeLabels ? (mode as GradingMode) : DEFAULT_GRADING_MODE;
}

function assetUrl(path: string | null): string | null {
  if (!path) return null;
  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\//, '')}`;
}

function PopupMenu({
  children,
  className = "",
  id,
  label,
  menuKey,
  onToggle,
  openMenu,
  tourContent,
  tourTrigger,
}: {
  children: ReactNode;
  className?: string;
  id: string;
  label: ReactNode;
  menuKey: string;
  onToggle: (menuKey: string) => void;
  openMenu: string | null;
  tourContent?: string;
  tourTrigger?: string;
}) {
  const isOpen = openMenu === menuKey;
  return (
    <div className={`popup-menu expandable-menu ${className}`}>
      <button
        aria-controls={id}
        aria-expanded={isOpen}
        className="secondary-button popup-summary"
        data-tour={tourTrigger}
        onClick={() => onToggle(menuKey)}
        type="button"
      >
        {label}
      </button>
      {isOpen ? (
        <div className="popup-options" data-tour={tourContent} id={id} role="menu">
          {children}
        </div>
      ) : null}
    </div>
  );
}

function DownloadMenu({
  label,
  markdown,
  menuKey,
  onToggle,
  openMenu,
  pdf,
}: {
  label: string;
  markdown: string | null;
  menuKey: string;
  onToggle: (menuKey: string) => void;
  openMenu: string | null;
  pdf: string | null;
}) {
  const hasDownloads = Boolean(markdown || pdf);
  return (
    <PopupMenu
      className="download-menu"
      id={`${menuKey}-options`}
      label={
        <>
          <Download size={18} />
          {label}
        </>
      }
      menuKey={menuKey}
      onToggle={onToggle}
      openMenu={openMenu}
      tourContent="download-menu-content"
      tourTrigger="download-menu-trigger"
    >
      {markdown ? (
        <a download href={assetUrl(markdown)!} role="menuitem">
          下载为 md 格式
        </a>
      ) : (
        <span>md 格式暂不可用</span>
      )}
      {pdf ? (
        <a download href={assetUrl(pdf)!} role="menuitem">
          下载为 PDF 格式
        </a>
      ) : (
        <span>PDF 格式暂不可用</span>
      )}
      {!hasDownloads ? <span>资源整理中</span> : null}
    </PopupMenu>
  );
}

function ModeMenu({
  gradingMode,
  menuKey,
  onChange,
  onToggle,
  openMenu,
}: {
  gradingMode: GradingMode;
  menuKey: string;
  onChange: (mode: GradingMode) => void;
  onToggle: (menuKey: string) => void;
  openMenu: string | null;
}) {
  return (
    <PopupMenu
      className="mode-menu"
      id={`${menuKey}-options`}
      label={
        <>
          <SlidersHorizontal size={18} />
          <span>判题模式：{modeLabels[gradingMode]}</span>
        </>
      }
      menuKey={menuKey}
      onToggle={onToggle}
      openMenu={openMenu}
      tourContent="mode-menu-content"
      tourTrigger="mode-menu-trigger"
    >
      {(Object.keys(modeLabels) as GradingMode[]).map((mode) => (
        <button
          className={`mode-option ${gradingMode === mode ? "is-active" : ""}`}
          data-tour={`mode-option-${mode}`}
          key={mode}
          onClick={() => onChange(mode)}
          role="menuitem"
          type="button"
        >
          {modeLabels[mode]}
        </button>
      ))}
    </PopupMenu>
  );
}

function ThemeMenu({
  menuKey,
  onChange,
  onToggle,
  openMenu,
  resolvedTheme,
  themeMode,
}: {
  menuKey: string;
  onChange: (mode: ThemeMode) => void;
  onToggle: (menuKey: string) => void;
  openMenu: string | null;
  resolvedTheme: ResolvedTheme;
  themeMode: ThemeMode;
}) {
  const ThemeIcon = resolvedTheme === "dark" ? Moon : Sun;
  return (
    <PopupMenu
      className="theme-menu"
      id={`${menuKey}-options`}
      label={
        <>
          <ThemeIcon size={18} />
          <span>主题：{themeModeLabels[themeMode]}</span>
        </>
      }
      menuKey={menuKey}
      onToggle={onToggle}
      openMenu={openMenu}
    >
      {(Object.keys(themeModeLabels) as ThemeMode[]).map((mode) => {
        const Icon = mode === "auto" ? Monitor : mode === "dark" ? Moon : Sun;
        return (
          <button
            className={`mode-option ${themeMode === mode ? "is-active" : ""}`}
            key={mode}
            onClick={() => onChange(mode)}
            role="menuitem"
            type="button"
          >
            <Icon size={16} />
            <span>{themeModeLabels[mode]}</span>
          </button>
        );
      })}
    </PopupMenu>
  );
}

const helpSections: Array<{
  title: string;
  items: Array<{ term: string; description: string; icon: ReactNode }>;
}> = [
  {
    title: "快速开始",
    items: [
      { term: "选择章节", description: "移动端点顶部章节按钮，桌面端使用题库选择。", icon: <BookOpen /> },
      {
        term: "作答并提交",
        description: "选择答案后点中间提交按钮；判题后会显示解析和资料高亮。",
        icon: <Send />,
      },
      { term: "查看资料", description: "移动端点底部右侧圆点或左右滑动进入资料页。", icon: <Eye /> },
      {
        term: "定位题目",
        description: "打开题号面板可跳题，题号区域上下滑动查看更多题号。",
        icon: <Grid3X3 />,
      },
    ],
  },
  {
    title: "按钮说明",
    items: [
      { term: "记不清", description: "标记拿不准的题目，再点一次取消标记。", icon: <Bookmark /> },
      {
        term: "提交/重置本题",
        description: "未判题时提交答案；判题后同一按钮变成重置本题。",
        icon: <RotateCcw />,
      },
      { term: "一键批改", description: "提交所有已经选择答案但还没判题的题目。", icon: <ListChecks /> },
      {
        term: "题号面板：重置",
        description: "先进入多选状态，选中题号后再点重置确认。",
        icon: <RotateCcw />,
      },
      {
        term: "题号面板：全部/撤销/取消",
        description: "全部重置整章；撤销恢复最近一次重置；取消退出多选重置。",
        icon: <Undo2 />,
      },
      {
        term: "常驻",
        description: "题号面板标题行的书本图标可让面板固定显示，再点一次取消。",
        icon: <BookOpen />,
      },
      {
        term: "夜间模式",
        description: "右下角月亮/太阳按钮快速切换主题；自动模式按 UTC+8 夜间时段启用。",
        icon: <Moon />,
      },
    ],
  },
  {
    title: "移动端手势",
    items: [
      { term: "左右滑动", description: "在答题区和资料区之间切换。", icon: <ChevronRight /> },
      { term: "点击空白处", description: "收起已展开的章节菜单或题号面板。", icon: <X /> },
      {
        term: "题号区露出半行",
        description: "看到下一行题号露出一截时，表示这里可以继续上下滑动。",
        icon: <ChevronDown />,
      },
    ],
  },
];

function HelpDialog({
  isClosing,
  onClose,
  onStartTour,
}: {
  isClosing: boolean;
  onClose: () => void;
  onStartTour: () => void;
}) {
  return (
    <div className={`help-overlay ${isClosing ? "is-closing" : ""}`} onClick={onClose}>
      <section
        aria-labelledby="help-dialog-title"
        aria-modal="true"
        className={`help-dialog ${isClosing ? "is-closing" : ""}`}
        onClick={(event) => event.stopPropagation()}
        onTouchMove={(event) => event.stopPropagation()}
        onWheel={(event) => event.stopPropagation()}
        role="dialog"
      >
        <header className="help-dialog-header">
          <div>
            <p className="eyebrow">使用帮助</p>
            <h2 id="help-dialog-title">按钮和流程说明</h2>
          </div>
          <button aria-label="关闭帮助" className="icon-button" onClick={onClose} type="button">
            <X size={18} />
          </button>
        </header>
        <div className="help-dialog-content">
          {helpSections.map((section) => (
            <section className="help-section" key={section.title}>
              <h3>{section.title}</h3>
              <dl>
                {section.items.map(({ description, icon, term }) => (
                  <div key={term}>
                    <dt>
                      <span className="help-item-icon" aria-hidden="true">
                        {icon}
                      </span>
                      <span>{term}</span>
                    </dt>
                    <dd>{description}</dd>
                  </div>
                ))}
              </dl>
            </section>
          ))}
        </div>
        <footer className="help-dialog-actions">
          <button className="primary-button" onClick={onStartTour} type="button">
            <HelpCircle size={18} />
            重新开始导览
          </button>
          <button className="secondary-button" onClick={onClose} type="button">
            关闭
          </button>
        </footer>
      </section>
    </div>
  );
}

export default function App() {
  const layoutRef = useRef<HTMLDivElement>(null);
  const swipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const savedState = useMemo(readSavedState, []);
  const initialThemeMode = useMemo(readThemeMode, []);
  const [themeNow, setThemeNow] = useState(() => new Date());
  const [themeMode, setThemeMode] = useState<ThemeMode>(initialThemeMode);
  const initialChapterId = selectableChapters.some((chapter) => chapter.id === savedState.selectedChapterId)
    ? (savedState.selectedChapterId as string)
    : defaultChapterId;
  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId);
  const [progressByChapter, setProgressByChapter] = useState<Record<string, ChapterProgress>>(
    Object.keys(savedState.progressByChapter ?? {}).length > 0
      ? (savedState.progressByChapter as Record<string, ChapterProgress>)
      : { [defaultChapterId]: emptyProgress() },
  );
  const [referenceCollapsed, setReferenceCollapsed] = useState(savedState.referenceCollapsed ?? false);
  const [activeMobilePage, setActiveMobilePage] = useState<0 | 1>(0);
  const [referenceFocusRequest, setReferenceFocusRequest] = useState(0);
  const [gradingMode, setGradingMode] = useState<GradingMode>(normalizeGradingMode(savedState.gradingMode));
  const [openMenu, setOpenMenu] = useState<string | null>(null);
  const [questionPanelPinned, setQuestionPanelPinned] = useState(false);
  const [resetSelectionMode, setResetSelectionMode] = useState(false);
  const [resetSelectionIds, setResetSelectionIds] = useState<number[]>([]);
  const [lastResetSnapshot, setLastResetSnapshot] = useState<ResetSnapshot | null>(null);
  const [helpOpen, setHelpOpen] = useState(false);
  const [helpClosing, setHelpClosing] = useState(false);
  const helpCloseTimeoutRef = useRef<number | null>(null);
  const onboardingSnapshotRef = useRef<OnboardingSnapshot | null>(null);

  const currentChapter = selectableChapters.find((chapter) => chapter.id === selectedChapterId) ?? selectableChapters[0];
  const questions = currentChapter.questions;
  const currentProgress = progressByChapter[currentChapter.id] ?? emptyProgress();
  const currentIndex = Math.min(currentProgress.currentIndex, Math.max(questions.length - 1, 0));
  const selectedByQuestion = currentProgress.selectedByQuestion;
  const attempts = currentProgress.attempts;
  const flaggedQuestionIds = currentProgress.flaggedQuestionIds;
  const flaggedQuestionIdSet = new Set(flaggedQuestionIds);
  const activeSourceIds = currentProgress.activeSourceIds;
  const currentQuestion = questions[currentIndex];
  const currentAttempt = currentQuestion ? attempts[currentQuestion.id] : undefined;
  const selectedAnswers = currentQuestion ? selectedByQuestion[currentQuestion.id] ?? [] : [];
  const pendingQuestions = questions.filter(
    (question) => !attempts[question.id] && (selectedByQuestion[question.id] ?? []).length > 0,
  );
  const submittedCount = Object.keys(attempts).length;
  const correctCount = Object.values(attempts).filter((attempt) => attempt.isCorrect).length;
  const isAvailable = currentChapter.available && questions.length > 0;
  const currentQuestionFlagged = currentQuestion ? flaggedQuestionIdSet.has(currentQuestion.id) : false;
  const isXuetongChapter = currentChapter.id === xuetongChapter.id;
  const resolvedTheme = resolveTheme(themeMode, themeNow);
  const canUndoReset = lastResetSnapshot?.chapterId === currentChapter.id;
  const demoChapter = selectableChapters.find(
    (chapter) => chapter.available && chapter.questions.some((question) => question.sourceIds.length > 0),
  );
  const demoQuestion = demoChapter?.questions.find((question) => question.sourceIds.length > 0);

  const groupedCounts = useMemo(() => {
    return questions.reduce(
      (counts, question) => {
        counts[question.type] += 1;
        return counts;
      },
      { single: 0, multiple: 0, judge: 0 },
    );
  }, [questions]);

  useEffect(() => {
    const state: SavedQuizState = {
      selectedChapterId,
      progressByChapter,
      referenceCollapsed,
      gradingMode,
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [gradingMode, progressByChapter, referenceCollapsed, selectedChapterId]);

  useEffect(() => {
    document.documentElement.dataset.theme = resolvedTheme;
    document.documentElement.dataset.themeMode = themeMode;
    window.localStorage.setItem(THEME_STORAGE_KEY, themeMode);
  }, [resolvedTheme, themeMode]);

  useEffect(() => {
    if (themeMode !== "auto") return;
    const interval = window.setInterval(() => setThemeNow(new Date()), 60_000);
    return () => window.clearInterval(interval);
  }, [themeMode]);

  useEffect(() => {
    if (!isAvailable || !shouldAutoStartOnboarding()) return;
    const timeout = window.setTimeout(() => {
      startGuidedOnboarding();
    }, 800);
    return () => window.clearTimeout(timeout);
  }, [isAvailable]);

  useEffect(() => {
    if (!helpOpen) return;
    function closeOnEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        closeHelpDialog();
      }
    }
    document.addEventListener("keydown", closeOnEscape);
    return () => document.removeEventListener("keydown", closeOnEscape);
  }, [helpOpen]);

  useEffect(() => {
    const dialogVisible = helpOpen || helpClosing;
    document.body.classList.toggle("help-dialog-open", dialogVisible);
    return () => document.body.classList.remove("help-dialog-open");
  }, [helpClosing, helpOpen]);

  useEffect(() => {
    return () => {
      if (helpCloseTimeoutRef.current !== null) {
        window.clearTimeout(helpCloseTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    function shouldKeepQuestionPanelOpen(element: HTMLDetailsElement) {
      if (!element.classList.contains("question-nav-panel")) return false;
      return element.classList.contains("is-pinned") || !window.matchMedia("(max-width: 760px)").matches;
    }

    function closeMenuOnOutsideClick(event: PointerEvent) {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (target instanceof Element && target.closest(".expandable-menu")) return;
      setOpenMenu(null);
      document
        .querySelectorAll<HTMLDetailsElement>("details.expandable-menu[open]")
        .forEach((element) => {
          if (!shouldKeepQuestionPanelOpen(element)) {
            element.removeAttribute("open");
          }
        });
    }

    document.addEventListener("pointerdown", closeMenuOnOutsideClick);
    return () => document.removeEventListener("pointerdown", closeMenuOnOutsideClick);
  }, []);

  function updateCurrentProgress(updater: (progress: ChapterProgress) => ChapterProgress) {
    setProgressByChapter((previous) => {
      const progress = normalizeProgress(previous[currentChapter.id]);
      return {
        ...previous,
        [currentChapter.id]: updater(progress),
      };
    });
  }

  function chooseChapter(chapterId: string) {
    setSelectedChapterId(chapterId);
    setResetSelectionMode(false);
    setResetSelectionIds([]);
    setOpenMenu(null);
    document
      .querySelectorAll<HTMLDetailsElement>("details.expandable-menu[open]")
      .forEach((element) => element.removeAttribute("open"));
    const chapter = selectableChapters.find((item) => item.id === chapterId);
    if (!chapter?.available) {
      setProgressByChapter((previous) => ({
        ...previous,
        [chapterId]: emptyProgress(),
      }));
    }
  }

  function setSelected(question: Question, optionId: string) {
    if (attempts[question.id]) return;

    let nextSelectedAnswers: string[] = [];
    updateCurrentProgress((progress) => {
      const current = progress.selectedByQuestion[question.id] ?? [];
      if (question.type === "multiple") {
        const next = current.includes(optionId)
          ? current.filter((answer) => answer !== optionId)
          : [...current, optionId];
        nextSelectedAnswers = next;
        return {
          ...progress,
          selectedByQuestion: { ...progress.selectedByQuestion, [question.id]: next },
        };
      }
      nextSelectedAnswers = [optionId];
      return {
        ...progress,
        selectedByQuestion: { ...progress.selectedByQuestion, [question.id]: [optionId] },
      };
    });

    if (gradingMode === "instant-on-select" && question.type !== "multiple") {
      submitQuestionWithAnswers(question, nextSelectedAnswers);
    }
  }

  function submitCurrentQuestion() {
    if (!currentQuestion || selectedAnswers.length === 0 || currentAttempt) return;
    submitQuestionWithAnswers(currentQuestion, selectedAnswers);
  }

  function submitQuestionWithAnswers(question: Question, answers: string[]) {
    if (answers.length === 0 || attempts[question.id]) return;
    const isCorrect = areAnswersEqual(answers, question.correctAnswers);
    updateCurrentProgress((progress) => ({
      ...progress,
      attempts: {
        ...progress.attempts,
        [question.id]: {
          questionId: question.id,
          selectedAnswers: answers,
          isCorrect,
          submittedAt: new Date().toISOString(),
        },
      },
      activeSourceIds: question.sourceIds,
    }));
  }

  function submitPendingQuestions() {
    if (pendingQuestions.length === 0) return;
    updateCurrentProgress((progress) => {
      const nextAttempts = { ...progress.attempts };
      for (const question of questions) {
        const answers = progress.selectedByQuestion[question.id] ?? [];
        if (answers.length === 0 || nextAttempts[question.id]) continue;
        nextAttempts[question.id] = {
          questionId: question.id,
          selectedAnswers: answers,
          isCorrect: areAnswersEqual(answers, question.correctAnswers),
          submittedAt: new Date().toISOString(),
        };
      }
      const focusedQuestion = questions[progress.currentIndex];
      return {
        ...progress,
        attempts: nextAttempts,
        activeSourceIds: focusedQuestion ? focusedQuestion.sourceIds : progress.activeSourceIds,
      };
    });
  }

  function toggleCurrentQuestionFlag() {
    if (!currentQuestion) return;

    updateCurrentProgress((progress) => {
      const isFlagged = progress.flaggedQuestionIds.includes(currentQuestion.id);
      return {
        ...progress,
        flaggedQuestionIds: isFlagged
          ? progress.flaggedQuestionIds.filter((questionId) => questionId !== currentQuestion.id)
          : [...progress.flaggedQuestionIds, currentQuestion.id],
      };
    });
  }

  function changeGradingMode(mode: GradingMode) {
    setGradingMode(mode);
    setOpenMenu(null);
  }

  function changeThemeMode(mode: ThemeMode) {
    setThemeMode(mode);
    setThemeNow(new Date());
    setOpenMenu(null);
  }

  function toggleManualTheme() {
    changeThemeMode(resolvedTheme === "dark" ? "light" : "dark");
  }

  function openHelpDialog() {
    if (helpCloseTimeoutRef.current !== null) {
      window.clearTimeout(helpCloseTimeoutRef.current);
      helpCloseTimeoutRef.current = null;
    }
    setHelpClosing(false);
    setHelpOpen(true);
  }

  function closeHelpDialog() {
    if (!helpOpen || helpClosing) return;
    setHelpClosing(true);
    setHelpOpen(false);
    helpCloseTimeoutRef.current = window.setTimeout(() => {
      setHelpClosing(false);
      helpCloseTimeoutRef.current = null;
    }, HELP_DIALOG_ANIMATION_MS);
  }

  function cloneProgressByChapter(progress: Record<string, ChapterProgress>): Record<string, ChapterProgress> {
    return Object.fromEntries(
      Object.entries(progress).map(([chapterId, chapterProgress]) => [
        chapterId,
        {
          currentIndex: chapterProgress.currentIndex,
          selectedByQuestion: { ...chapterProgress.selectedByQuestion },
          attempts: { ...chapterProgress.attempts },
          flaggedQuestionIds: [...chapterProgress.flaggedQuestionIds],
          activeSourceIds: [...chapterProgress.activeSourceIds],
        },
      ]),
    );
  }

  function cloneResetSnapshot(snapshot: ResetSnapshot | null): ResetSnapshot | null {
    if (!snapshot) return null;
    return {
      chapterId: snapshot.chapterId,
      progress: {
        currentIndex: snapshot.progress.currentIndex,
        selectedByQuestion: { ...snapshot.progress.selectedByQuestion },
        attempts: { ...snapshot.progress.attempts },
        flaggedQuestionIds: [...snapshot.progress.flaggedQuestionIds],
        activeSourceIds: [...snapshot.progress.activeSourceIds],
      },
    };
  }

  function saveOnboardingSnapshot() {
    if (onboardingSnapshotRef.current) return;
    onboardingSnapshotRef.current = {
      activeMobilePage,
      gradingMode,
      lastResetSnapshot: cloneResetSnapshot(lastResetSnapshot),
      openMenu,
      progressByChapter: cloneProgressByChapter(progressByChapter),
      questionPanelPinned,
      referenceCollapsed,
      resetSelectionIds: [...resetSelectionIds],
      resetSelectionMode,
      selectedChapterId,
    };
  }

  function resetDemoProgress(
    question: Question,
    baseProgress: ChapterProgress = normalizeProgress(progressByChapter[demoChapter?.id ?? ""]),
  ): ChapterProgress {
    const selectedByQuestion = { ...baseProgress.selectedByQuestion };
    const attempts = { ...baseProgress.attempts };
    delete selectedByQuestion[question.id];
    delete attempts[question.id];
    return {
      ...baseProgress,
      currentIndex: demoChapter?.questions.findIndex((item) => item.id === question.id) ?? 0,
      selectedByQuestion,
      attempts,
      flaggedQuestionIds: baseProgress.flaggedQuestionIds.filter((questionId) => questionId !== question.id),
      activeSourceIds: [],
    };
  }

  function prepareOnboardingDemo() {
    if (!demoChapter || !demoQuestion) return;
    saveOnboardingSnapshot();
    setSelectedChapterId(demoChapter.id);
    setProgressByChapter((previous) => ({
      ...previous,
      [demoChapter.id]: resetDemoProgress(demoQuestion, normalizeProgress(previous[demoChapter.id])),
    }));
    setGradingMode(DEFAULT_GRADING_MODE);
    setReferenceCollapsed(false);
    setActiveMobilePage(0);
    setOpenMenu(null);
    setQuestionPanelPinned(false);
    setResetSelectionMode(false);
    setResetSelectionIds([]);
    setLastResetSnapshot(null);
    document
      .querySelectorAll<HTMLDetailsElement>("details.expandable-menu[open]")
      .forEach((element) => element.removeAttribute("open"));
  }

  function updateDemoProgress(updater: (progress: ChapterProgress) => ChapterProgress) {
    if (!demoChapter) return;
    setProgressByChapter((previous) => {
      const progress = normalizeProgress(previous[demoChapter.id]);
      return {
        ...previous,
        [demoChapter.id]: updater(progress),
      };
    });
  }

  function selectOnboardingDemoAnswer() {
    if (!demoQuestion) return;
    const answer = demoQuestion.correctAnswers[0] ?? demoQuestion.options[0]?.id;
    if (!answer) return;
    updateDemoProgress((progress) => {
      const nextProgress = {
        ...progress,
        selectedByQuestion: { ...progress.selectedByQuestion, [demoQuestion.id]: [answer] },
      };
      if (gradingMode !== "instant-on-select" || demoQuestion.type === "multiple") return nextProgress;
      return {
        ...nextProgress,
        attempts: {
          ...nextProgress.attempts,
          [demoQuestion.id]: {
            questionId: demoQuestion.id,
            selectedAnswers: [answer],
            isCorrect: areAnswersEqual([answer], demoQuestion.correctAnswers),
            submittedAt: new Date().toISOString(),
          },
        },
        activeSourceIds: demoQuestion.sourceIds,
      };
    });
  }

  function selectAndGradeOnboardingDemoAnswer() {
    if (!demoQuestion) return;
    const answer = demoQuestion.correctAnswers[0] ?? demoQuestion.options[0]?.id;
    if (!answer) return;
    updateDemoProgress((progress) => ({
      ...progress,
      selectedByQuestion: { ...progress.selectedByQuestion, [demoQuestion.id]: [answer] },
      attempts: {
        ...progress.attempts,
        [demoQuestion.id]: {
          questionId: demoQuestion.id,
          selectedAnswers: [answer],
          isCorrect: areAnswersEqual([answer], demoQuestion.correctAnswers),
          submittedAt: new Date().toISOString(),
        },
      },
      activeSourceIds: demoQuestion.sourceIds,
    }));
  }

  function submitOnboardingDemoAnswer() {
    if (!demoQuestion) return;
    const fallbackAnswer = demoQuestion.correctAnswers[0] ?? demoQuestion.options[0]?.id;
    if (!fallbackAnswer) return;
    updateDemoProgress((progress) => {
      const answers = progress.selectedByQuestion[demoQuestion.id] ?? [fallbackAnswer];
      if (progress.attempts[demoQuestion.id]) {
        return {
          ...progress,
          activeSourceIds: demoQuestion.sourceIds,
        };
      }
      return {
        ...progress,
        selectedByQuestion: { ...progress.selectedByQuestion, [demoQuestion.id]: answers },
        attempts: {
          ...progress.attempts,
          [demoQuestion.id]: {
            questionId: demoQuestion.id,
            selectedAnswers: answers,
            isCorrect: areAnswersEqual(answers, demoQuestion.correctAnswers),
            submittedAt: new Date().toISOString(),
          },
        },
        activeSourceIds: demoQuestion.sourceIds,
      };
    });
  }

  function resetOnboardingDemoQuestion() {
    if (!demoChapter || !demoQuestion) return;
    setProgressByChapter((previous) => ({
      ...previous,
      [demoChapter.id]: resetDemoProgress(demoQuestion, normalizeProgress(previous[demoChapter.id])),
    }));
  }

  function toggleOnboardingDemoFlag() {
    if (!demoQuestion) return;
    updateDemoProgress((progress) => {
      const isFlagged = progress.flaggedQuestionIds.includes(demoQuestion.id);
      return {
        ...progress,
        flaggedQuestionIds: isFlagged
          ? progress.flaggedQuestionIds.filter((questionId) => questionId !== demoQuestion.id)
          : [...progress.flaggedQuestionIds, demoQuestion.id],
      };
    });
  }

  function showOnboardingKnowledgePoint() {
    if (!demoQuestion) return;
    updateDemoProgress((progress) => ({
      ...progress,
      activeSourceIds: demoQuestion.sourceIds,
    }));
    scrollToMobilePage(1, { focusReference: true });
  }

  function openOnboardingDownloadMenu() {
    const menuKey = window.matchMedia("(max-width: 760px)").matches ? "mobile-download" : "desktop-download";
    openVisibleChapterMenu();
    setOpenMenu(menuKey);
  }

  function openOnboardingModeMenu() {
    const menuKey = window.matchMedia("(max-width: 760px)").matches ? "mobile-mode" : "desktop-mode";
    openVisibleChapterMenu();
    setOpenMenu(menuKey);
  }

  function closeOnboardingMenus() {
    setOpenMenu(null);
    document
      .querySelectorAll<HTMLDetailsElement>("details.expandable-menu[open]")
      .forEach((element) => element.removeAttribute("open"));
  }

  function setOnboardingGradingMode(mode: GradingMode) {
    setGradingMode(mode);
  }

  function openVisibleChapterMenu() {
    const isMobile = window.matchMedia("(max-width: 760px)").matches;
    const selector = isMobile ? ".mobile-course-menu" : ".chapter-selector-panel";
    document.querySelector<HTMLDetailsElement>(selector)?.setAttribute("open", "");
  }

  function restoreOnboardingSnapshot() {
    const snapshot = onboardingSnapshotRef.current;
    if (!snapshot) return;
    onboardingSnapshotRef.current = null;
    setSelectedChapterId(snapshot.selectedChapterId);
    setProgressByChapter(snapshot.progressByChapter);
    setReferenceCollapsed(snapshot.referenceCollapsed);
    setActiveMobilePage(snapshot.activeMobilePage);
    setGradingMode(snapshot.gradingMode);
    setOpenMenu(snapshot.openMenu);
    setQuestionPanelPinned(snapshot.questionPanelPinned);
    setResetSelectionMode(snapshot.resetSelectionMode);
    setResetSelectionIds(snapshot.resetSelectionIds);
    setLastResetSnapshot(snapshot.lastResetSnapshot);
    window.setTimeout(() => {
      const layout = layoutRef.current;
      layout?.scrollTo({
        left: snapshot.activeMobilePage * layout.clientWidth,
        behavior: "instant",
      });
    }, 0);
  }

  function createOnboardingApi(): OnboardingApi {
    return {
      closeTourMenus: closeOnboardingMenus,
      openDownloadMenu: openOnboardingDownloadMenu,
      openModeMenu: openOnboardingModeMenu,
      prepareDemo: prepareOnboardingDemo,
      resetDemoQuestion: resetOnboardingDemoQuestion,
      restoreAfterTour: restoreOnboardingSnapshot,
      selectDemoAnswer: selectOnboardingDemoAnswer,
      selectAndGradeDemoAnswer: selectAndGradeOnboardingDemoAnswer,
      setDemoGradingMode: setOnboardingGradingMode,
      showDemoKnowledgePoint: showOnboardingKnowledgePoint,
      submitDemoAnswer: submitOnboardingDemoAnswer,
      toggleDemoFlag: toggleOnboardingDemoFlag,
    };
  }

  function startGuidedOnboarding() {
    if (!demoChapter || !demoQuestion) return;
    prepareOnboardingDemo();
    window.setTimeout(() => startOnboarding({ api: createOnboardingApi() }), 0);
  }

  function replayOnboarding() {
    closeHelpDialog();
    window.setTimeout(() => startGuidedOnboarding(), HELP_DIALOG_ANIMATION_MS + 60);
  }

  function toggleMenu(menuKey: string) {
    setOpenMenu((current) => (current === menuKey ? null : menuKey));
  }

  function resetQuiz() {
    resetQuestions(questions.map((question) => question.id), { confirm: true });
  }

  function resetQuestions(questionIds: number[], options: { confirm: boolean }) {
    if (questionIds.length === 0) return;
    if (options.confirm && !window.confirm(`确定要重置 ${questionIds.length} 道题的作答情况吗？`)) return;
    const resetIdSet = new Set(questionIds);
    const snapshot = normalizeProgress(currentProgress);
    setLastResetSnapshot({
      chapterId: currentChapter.id,
      progress: {
        ...snapshot,
        selectedByQuestion: { ...snapshot.selectedByQuestion },
        attempts: { ...snapshot.attempts },
        flaggedQuestionIds: [...snapshot.flaggedQuestionIds],
        activeSourceIds: [...snapshot.activeSourceIds],
      },
    });
    updateCurrentProgress((progress) => {
      const nextSelectedByQuestion = { ...progress.selectedByQuestion };
      const nextAttempts = { ...progress.attempts };
      for (const questionId of resetIdSet) {
        delete nextSelectedByQuestion[questionId];
        delete nextAttempts[questionId];
      }
      return {
        ...progress,
        selectedByQuestion: nextSelectedByQuestion,
        attempts: nextAttempts,
        activeSourceIds: resetIdSet.has(currentQuestion?.id ?? -1) ? [] : progress.activeSourceIds,
      };
    });
    setResetSelectionMode(false);
    setResetSelectionIds([]);
  }

  function resetCurrentQuestion() {
    if (!currentQuestion) return;
    resetQuestions([currentQuestion.id], { confirm: false });
  }

  function undoLastReset() {
    if (!lastResetSnapshot || lastResetSnapshot.chapterId !== currentChapter.id) return;
    setProgressByChapter((previous) => ({
      ...previous,
      [lastResetSnapshot.chapterId]: lastResetSnapshot.progress,
    }));
    setLastResetSnapshot(null);
    setResetSelectionMode(false);
    setResetSelectionIds([]);
  }

  function toggleResetSelection(questionId: number) {
    setResetSelectionIds((current) =>
      current.includes(questionId) ? current.filter((id) => id !== questionId) : [...current, questionId],
    );
  }

  function resetSelectedQuestions() {
    resetQuestions(resetSelectionIds, { confirm: true });
  }

  function handleResetToolClick() {
    if (!resetSelectionMode) {
      setResetSelectionMode(true);
      setResetSelectionIds([]);
      return;
    }
    if (resetSelectionIds.length === 0) return;
    resetSelectedQuestions();
  }

  function cancelResetSelection() {
    setResetSelectionMode(false);
    setResetSelectionIds([]);
  }

  function toggleQuestionPanelPinned(event: ReactMouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    setQuestionPanelPinned((pinned) => !pinned);
  }

  function jumpToQuestion(index: number) {
    updateCurrentProgress((progress) => {
      const question = questions[index];
      const attempt = question ? progress.attempts[question.id] : undefined;
      return {
        ...progress,
        currentIndex: index,
        activeSourceIds: attempt ? question.sourceIds : progress.activeSourceIds,
      };
    });
  }

  function scrollToMobilePage(page: 0 | 1, options: { focusReference?: boolean } = {}) {
    setReferenceCollapsed(false);
    setActiveMobilePage(page);
    if (options.focusReference) {
      setReferenceFocusRequest((request) => request + 1);
    }
    const layout = layoutRef.current;
    if (!layout) return;
    layout.scrollTo({
      left: page * layout.clientWidth,
      behavior: "smooth",
    });
  }

  function handleLayoutScroll() {
    const layout = layoutRef.current;
    if (!layout) return;
    const page = layout.scrollLeft > layout.clientWidth / 2 ? 1 : 0;
    setActiveMobilePage(page);
  }

  function handleSwipeStart(event: ReactPointerEvent<HTMLDivElement>) {
    swipeStartRef.current = { x: event.clientX, y: event.clientY };
  }

  function finishSwipe(endX: number, endY: number) {
    const start = swipeStartRef.current;
    swipeStartRef.current = null;
    if (!start) return;

    const deltaX = endX - start.x;
    const deltaY = endY - start.y;
    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) < Math.abs(deltaY) * 1.35) return;

    scrollToMobilePage(deltaX < 0 ? 1 : 0, { focusReference: deltaX < 0 });
  }

  function handleSwipeEnd(event: ReactPointerEvent<HTMLDivElement>) {
    finishSwipe(event.clientX, event.clientY);
  }

  function handleTouchStart(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.touches[0];
    if (!touch) return;
    swipeStartRef.current = { x: touch.clientX, y: touch.clientY };
  }

  function handleTouchEnd(event: ReactTouchEvent<HTMLDivElement>) {
    const touch = event.changedTouches[0];
    if (!touch) return;
    finishSwipe(touch.clientX, touch.clientY);
  }

  function closeDetailsFromBackdrop(event: SyntheticEvent<HTMLElement>) {
    event.currentTarget.closest("details")?.removeAttribute("open");
    setOpenMenu(null);
  }

  function closeOtherDetails(event: SyntheticEvent<HTMLDetailsElement>) {
    const current = event.currentTarget;
    if (!current.open) return;
    setOpenMenu(null);
    document.querySelectorAll<HTMLDetailsElement>("details.expandable-menu[open]").forEach((element) => {
      const keepPinnedQuestionPanel = element.classList.contains("question-nav-panel") && questionPanelPinned;
      if (element !== current && !keepPinnedQuestionPanel) {
        element.removeAttribute("open");
      }
    });
  }

  return (
    <main className="app-shell">
      <div
        className="learning-layout"
        ref={layoutRef}
        onPointerCancel={() => {
          swipeStartRef.current = null;
        }}
        onPointerDown={handleSwipeStart}
        onPointerUp={handleSwipeEnd}
        onScroll={handleLayoutScroll}
        onTouchEnd={handleTouchEnd}
        onTouchStart={handleTouchStart}
      >
      <section className="quiz-pane">
        <header className="app-header">
          <div>
            <p className="eyebrow">中国近现代史纲要</p>
            <h1>{currentChapter.title}</h1>
          </div>
          <div className="header-actions">
            <button className="icon-button" type="button" onClick={resetQuiz} aria-label="重置练习">
              <RotateCcw size={18} />
            </button>
            <ModeMenu
              gradingMode={gradingMode}
              menuKey="desktop-mode"
              onChange={changeGradingMode}
              onToggle={toggleMenu}
              openMenu={openMenu}
            />
            <ThemeMenu
              menuKey="desktop-theme"
              onChange={changeThemeMode}
              onToggle={toggleMenu}
              openMenu={openMenu}
              resolvedTheme={resolvedTheme}
              themeMode={themeMode}
            />
            <DownloadMenu
              label="下载习题"
              markdown={currentChapter.downloads.markdown}
              menuKey="desktop-download"
              onToggle={toggleMenu}
              openMenu={openMenu}
              pdf={currentChapter.downloads.pdf}
            />
          </div>
        </header>

        <details className="chapter-selector-panel expandable-menu" data-tour="chapter-menu">
          <summary>
            <span>题库选择</span>
            <strong>{currentChapter.title}</strong>
          </summary>
          <section className="chapter-selector" aria-label="章节习题选择">
            {selectableChapters.map((chapter) => (
              <button
                className={`chapter-option ${chapter.id === currentChapter.id ? "is-active" : ""} ${
                  chapter.available ? "" : "is-disabled"
                }`}
                key={chapter.id}
                onClick={() => chooseChapter(chapter.id)}
                type="button"
              >
                <span>{chapter.title}</span>
              </button>
            ))}
          </section>
        </details>

        <section className="summary-grid" aria-label="练习统计">
          <div>
            <span>总题数</span>
            <strong>{questions.length}</strong>
          </div>
          <div>
            <span>已提交</span>
            <strong>{submittedCount}</strong>
          </div>
          <div>
            <span>正确</span>
            <strong>{correctCount}</strong>
          </div>
          <div>
            <span>题型</span>
            <strong>
              {groupedCounts.single}/{groupedCounts.multiple}/{groupedCounts.judge}
            </strong>
          </div>
        </section>

        <div className="mobile-top-controls">
          <details className="mobile-course-menu expandable-menu" data-tour="chapter-menu" onToggle={closeOtherDetails}>
            <summary>
              <span>{currentChapter.title}</span>
              <ChevronDown size={16} />
            </summary>
            <button
              aria-label="收起菜单"
              className="mobile-menu-backdrop"
              onClick={closeDetailsFromBackdrop}
              type="button"
            />
            <div className="mobile-course-popover">
              <section className="mobile-menu-group" aria-label="选择章节">
                <p>选择章节</p>
                <div className="mobile-chapter-list">
                  {regularChapters.map((chapter) => (
                    <button
                      className={`chapter-option ${chapter.id === currentChapter.id ? "is-active" : ""} ${
                        chapter.available ? "" : "is-disabled"
                      }`}
                      key={chapter.id}
                      onClick={() => chooseChapter(chapter.id)}
                      type="button"
                      title={chapter.title}
                    >
                      <span>{chapter.numeral}</span>
                    </button>
                  ))}
                </div>
                <button
                  className={`chapter-option mobile-xuetong-option ${
                    xuetongChapter.id === currentChapter.id ? "is-active" : ""
                  }`}
                  onClick={() => chooseChapter(xuetongChapter.id)}
                  type="button"
                >
                  <span>学习通</span>
                </button>
              </section>
              <div className="mobile-menu-divider" />
              <ModeMenu
                gradingMode={gradingMode}
                menuKey="mobile-mode"
                onChange={changeGradingMode}
                onToggle={toggleMenu}
                openMenu={openMenu}
              />
              <ThemeMenu
                menuKey="mobile-theme"
                onChange={changeThemeMode}
                onToggle={toggleMenu}
                openMenu={openMenu}
                resolvedTheme={resolvedTheme}
                themeMode={themeMode}
              />
              <DownloadMenu
                label="下载习题"
                markdown={currentChapter.downloads.markdown}
                menuKey="mobile-download"
                onToggle={toggleMenu}
                openMenu={openMenu}
                pdf={currentChapter.downloads.pdf}
              />
            </div>
          </details>

          {isAvailable ? (
            <details
              className={`question-nav-panel expandable-menu ${questionPanelPinned ? "is-pinned" : ""}`}
              data-tour="question-panel"
              onToggle={closeOtherDetails}
              open={questionPanelPinned || undefined}
            >
              <summary>
                <Grid3X3 size={18} />
                <span>
                  题号面板 · {currentIndex + 1}/{questions.length}
                </span>
                <ChevronDown className="question-nav-toggle" size={16} aria-hidden="true" />
                <button
                  aria-label={questionPanelPinned ? "取消常驻" : "常驻开启"}
                  aria-pressed={questionPanelPinned}
                  className={`question-pin-button ${questionPanelPinned ? "is-active" : ""}`}
                  onClick={toggleQuestionPanelPinned}
                  title={questionPanelPinned ? "取消常驻" : "常驻开启"}
                  type="button"
                >
                  <BookOpen size={16} />
                </button>
              </summary>
              {!questionPanelPinned ? (
                <button
                  aria-label="收起题号面板"
                  className="mobile-menu-backdrop"
                  onClick={closeDetailsFromBackdrop}
                  type="button"
                />
              ) : null}
              <div className="question-nav-popover">
                <div className="question-nav-scroll">
                  <nav className="question-nav" aria-label="题号导航">
                    {questions.map((question, index) => {
                      const isResetSelected = resetSelectionIds.includes(question.id);
                      return (
                        <button
                          className={`question-chip ${index === currentIndex ? "is-active" : ""} ${questionStatusClass(
                            attempts[question.id],
                            (selectedByQuestion[question.id] ?? []).length > 0,
                            flaggedQuestionIdSet.has(question.id),
                          )} ${isResetSelected ? "is-reset-selected" : ""}`}
                          key={question.id}
                          onClick={() => (resetSelectionMode ? toggleResetSelection(question.id) : jumpToQuestion(index))}
                          type="button"
                        >
                          {question.id}
                        </button>
                      );
                    })}
                  </nav>
                </div>
                <div className="question-nav-tools" aria-label="题号面板工具" data-tour="question-panel-tools">
                  <button
                    aria-pressed={resetSelectionMode}
                    className={`question-tool-button ${resetSelectionMode ? "is-active" : ""}`}
                    onClick={handleResetToolClick}
                    title={resetSelectionMode ? "重置已选择题目" : "选择要重置的题目"}
                    type="button"
                  >
                    <RotateCcw size={16} />
                    <span>重置</span>
                  </button>
                  <button
                    className="question-tool-button"
                    onClick={resetQuiz}
                    title="全部重置"
                    type="button"
                  >
                    <RotateCcw size={16} />
                    <span>全部</span>
                  </button>
                  <button
                    className="question-tool-button"
                    disabled={!resetSelectionMode && !canUndoReset}
                    onClick={resetSelectionMode ? cancelResetSelection : undoLastReset}
                    title={resetSelectionMode ? "取消选择" : "撤销重置"}
                    type="button"
                  >
                    <Undo2 size={16} />
                    <span>{resetSelectionMode ? "取消" : "撤销"}</span>
                  </button>
                </div>
                {resetSelectionMode ? (
                  <p className="question-reset-hint" aria-live="polite">
                    选择要重置的题目，再点重置确认
                  </p>
                ) : null}
              </div>
            </details>
          ) : null}
        </div>

        {isAvailable && currentQuestion ? (
        <section className="question-card" data-tour="question-card">
          <div className="question-meta">
            <span>{typeLabel(currentQuestion.type)}</span>
            <span>
              {currentIndex + 1} / {questions.length}
            </span>
          </div>

          <h2>{currentQuestion.id}. {currentQuestion.stem}</h2>

          <div className="options-list">
            {currentQuestion.options.map((option) => {
              const selected = selectedAnswers.includes(option.id);
              const optionType = currentQuestion.type === "multiple" ? "checkbox" : "radio";
              const isDemoAnswerOption =
                currentChapter.id === demoChapter?.id &&
                currentQuestion.id === demoQuestion?.id &&
                option.id === (demoQuestion.correctAnswers[0] ?? demoQuestion.options[0]?.id);
              return (
                <label
                  className={`option-row ${selected ? "is-selected" : ""}`}
                  data-tour={isDemoAnswerOption ? "demo-answer-option" : undefined}
                  key={option.id}
                >
                  <input
                    checked={selected}
                    disabled={Boolean(currentAttempt)}
                    name={`question-${currentQuestion.id}`}
                    onChange={() => setSelected(currentQuestion, option.id)}
                    type={optionType}
                  />
                  <span className="option-id">{option.id === "true" || option.id === "false" ? "" : option.id}</span>
                  <span>{option.label}</span>
                </label>
              );
            })}
          </div>

          <div className="question-actions" data-tour="question-actions">
            <button
              className="secondary-button"
              disabled={currentIndex === 0}
              onClick={() => jumpToQuestion(Math.max(0, currentIndex - 1))}
              type="button"
            >
              <ChevronLeft size={18} />
              <span className="action-label">上一题</span>
            </button>
            <button
              aria-label={currentQuestionFlagged ? "取消记不清" : "记不清"}
              className={`secondary-button flag-button ${currentQuestionFlagged ? "is-active" : ""}`}
              data-tour="flag-button"
              onClick={toggleCurrentQuestionFlag}
              title={currentQuestionFlagged ? "取消记不清" : "记不清"}
              type="button"
            >
              <Bookmark size={18} />
              <span className="action-label">{currentQuestionFlagged ? "取消记不清" : "记不清"}</span>
            </button>
            <button
              className="primary-button"
              data-tour="submit-button"
              disabled={!currentAttempt && selectedAnswers.length === 0}
              onClick={currentAttempt ? resetCurrentQuestion : submitCurrentQuestion}
              type="button"
            >
              {currentAttempt ? <RotateCcw size={18} /> : <Send size={18} />}
              <span className="action-label">{currentAttempt ? "重置本题" : "提交答案"}</span>
            </button>
            <button
              className="secondary-button"
              disabled={pendingQuestions.length === 0}
              onClick={submitPendingQuestions}
              type="button"
            >
              <ListChecks size={18} />
              <span className="action-label">一键批改</span>
            </button>
            <button
              className="secondary-button"
              disabled={currentIndex === questions.length - 1}
              onClick={() => jumpToQuestion(Math.min(questions.length - 1, currentIndex + 1))}
              type="button"
            >
              <span className="action-label">下一题</span>
              <ChevronRight size={18} />
            </button>
          </div>

          {currentAttempt ? (
            <aside
              className={`feedback-card ${currentAttempt.isCorrect ? "is-correct" : "is-wrong"}`}
              data-tour="feedback-card"
            >
              <div className="feedback-title">
                <Trophy size={18} />
                {currentAttempt.isCorrect ? "回答正确" : "回答错误"}
              </div>
              <p>你的答案：{answerListLabel(currentAttempt.selectedAnswers)}</p>
              <p>正确答案：{answerListLabel(currentQuestion.correctAnswers)}</p>
              <p>{currentQuestion.explanation}</p>
              <p className="source-hint">
                {currentQuestion.sourceIds.length > 0
                  ? `已在右侧资料中高亮 ${currentQuestion.sourceIds.length} 处对应知识点。`
                  : "当前题暂未绑定资料段落。"}
              </p>
              {currentQuestion.sourceIds.length > 0 ? (
                <button
                  className="secondary-button knowledge-button"
                  data-tour="knowledge-button"
                  onClick={() => scrollToMobilePage(1, { focusReference: true })}
                  type="button"
                >
                  <Eye size={18} />
                  查看本题知识点
                </button>
              ) : null}
            </aside>
          ) : null}
        </section>
        ) : (
          <section className="question-card coming-soon" aria-label="敬请期待">
            {isXuetongChapter ? (
              <p>如果你的任课老师在学习通发布了题目，请在学习通上完成哦。</p>
            ) : (
              <>
                <h2>敬请期待</h2>
                <p>{currentChapter.title}还在整理中。</p>
              </>
            )}
          </section>
        )}

      </section>
      <section className="reference-shell" data-tour="reference-entry">
        <button
          className="reference-toggle"
          onClick={() => setReferenceCollapsed((collapsed) => !collapsed)}
          type="button"
        >
          <BookOpen size={18} />
          {referenceCollapsed ? "展开资料" : "折叠资料"}
        </button>
        <ReferencePane
          activeSourceIds={activeSourceIds}
          collapsed={referenceCollapsed}
          downloads={chaptersPayload.referenceDownloads}
          focusRequest={referenceFocusRequest}
        />
      </section>
      </div>
      <div className="mobile-page-dots" aria-label="页面位置">
        <button
          aria-label="答题区域"
          className={activeMobilePage === 0 ? "is-active" : ""}
          onClick={() => scrollToMobilePage(0)}
          type="button"
        />
        <button
          aria-label="资料区域"
          className={activeMobilePage === 1 ? "is-active" : ""}
          onClick={() => scrollToMobilePage(1, { focusReference: true })}
          type="button"
        />
      </div>
      <button
        aria-label={resolvedTheme === "dark" ? "切换到日间模式" : "切换到夜间模式"}
        className="theme-fab"
        data-tour="theme-toggle"
        onClick={toggleManualTheme}
        title={resolvedTheme === "dark" ? "切换到日间模式" : "切换到夜间模式"}
        type="button"
      >
        {resolvedTheme === "dark" ? <Sun size={22} /> : <Moon size={22} />}
      </button>
      <button
        aria-label="打开帮助"
        className="help-fab"
        data-tour="help-button"
        onClick={openHelpDialog}
        title="打开帮助"
        type="button"
      >
        <HelpCircle size={22} />
      </button>
      {helpOpen || helpClosing ? (
        <HelpDialog isClosing={helpClosing} onClose={closeHelpDialog} onStartTour={replayOnboarding} />
      ) : null}
      <footer className="site-footer">
        <span>
          联系我（们）/反馈问题/提供建议：<a href="mailto:kt_i@qq.com">kt_i@qq.com</a>
        </span>
        <span>
          仓库地址：
          <a href="https://github.com/KuitoInoguchi/hist-interactive-review" rel="noreferrer" target="_blank">
            GitHub 仓库
          </a>
        </span>
        <span>
          更多资料：
          <a href="https://my.feishu.cn/wiki/AatBwiDa7ig7RJkzdlocLm1cnTh" rel="noreferrer" target="_blank">
            飞书资料
          </a>
        </span>
      </footer>
    </main>
  );
}
