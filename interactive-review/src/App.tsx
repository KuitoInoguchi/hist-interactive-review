import {
  BookOpen,
  Bookmark,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  ListChecks,
  RotateCcw,
  Send,
  SlidersHorizontal,
  Trophy,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { ReferencePane } from "./components/ReferencePane";
import chaptersData from "./generated/chapters.json";
import { answerListLabel, areAnswersEqual } from "./lib/answerCheck";
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
const defaultChapterId = chapters[0]?.id ?? "regular-1";
const STORAGE_KEY = "interactive-review:multi-chapter-progress";

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
};

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
      progressByChapter,
    };
  } catch {
    return {};
  }
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

function assetUrl(path: string | null): string | null {
  if (!path) return null;
  const base = import.meta.env.BASE_URL;
  return `${base}${path.replace(/^\//, '')}`;
}

function DownloadMenu({
  label,
  markdown,
  pdf,
}: {
  label: string;
  markdown: string | null;
  pdf: string | null;
}) {
  const hasDownloads = Boolean(markdown || pdf);
  return (
    <details className="download-menu">
      <summary className="secondary-button download-summary">
        <Download size={18} />
        {label}
      </summary>
      <div className="download-options">
        {markdown ? (
          <a download href={assetUrl(markdown)!}>
            下载为 md 格式
          </a>
        ) : (
          <span>md 格式暂不可用</span>
        )}
        {pdf ? (
          <a download href={assetUrl(pdf)!}>
            下载为 PDF 格式
          </a>
        ) : (
          <span>PDF 格式暂不可用</span>
        )}
        {!hasDownloads ? <span>资源整理中</span> : null}
      </div>
    </details>
  );
}

export default function App() {
  const layoutRef = useRef<HTMLDivElement>(null);
  const savedState = useMemo(readSavedState, []);
  const initialChapterId = chapters.some((chapter) => chapter.id === savedState.selectedChapterId)
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

  const currentChapter = chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0];
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
  const submittedCount = Object.keys(attempts).length;
  const correctCount = Object.values(attempts).filter((attempt) => attempt.isCorrect).length;
  const isAvailable = currentChapter.available && questions.length > 0;
  const pendingReviewCount = questions.filter((question) => {
    const answers = selectedByQuestion[question.id] ?? [];
    return answers.length > 0 && !attempts[question.id];
  }).length;
  const currentQuestionFlagged = currentQuestion ? flaggedQuestionIdSet.has(currentQuestion.id) : false;

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
    };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [progressByChapter, referenceCollapsed, selectedChapterId]);

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
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter?.available) {
      setProgressByChapter((previous) => ({
        ...previous,
        [chapterId]: emptyProgress(),
      }));
    }
  }

  function setSelected(question: Question, optionId: string) {
    if (attempts[question.id]) return;

    updateCurrentProgress((progress) => {
      const current = progress.selectedByQuestion[question.id] ?? [];
      if (question.type === "multiple") {
        const next = current.includes(optionId)
          ? current.filter((answer) => answer !== optionId)
          : [...current, optionId];
        return {
          ...progress,
          selectedByQuestion: { ...progress.selectedByQuestion, [question.id]: next },
        };
      }
      return {
        ...progress,
        selectedByQuestion: { ...progress.selectedByQuestion, [question.id]: [optionId] },
      };
    });
  }

  function submitCurrentQuestion() {
    if (!currentQuestion || selectedAnswers.length === 0 || currentAttempt) return;
    const isCorrect = areAnswersEqual(selectedAnswers, currentQuestion.correctAnswers);
    updateCurrentProgress((progress) => ({
      ...progress,
      attempts: {
        ...progress.attempts,
        [currentQuestion.id]: {
          questionId: currentQuestion.id,
          selectedAnswers,
          isCorrect,
          submittedAt: new Date().toISOString(),
        },
      },
      activeSourceIds: currentQuestion.sourceIds,
    }));
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

  function resetQuiz() {
    setProgressByChapter((previous) => ({
      ...previous,
      [currentChapter.id]: emptyProgress(),
    }));
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

  function gradeAllSelectedQuestions() {
    updateCurrentProgress((progress) => gradeSelectedQuestions(questions, progress, currentQuestion?.id));
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

  return (
    <main className="app-shell">
      <div className="learning-layout" ref={layoutRef} onScroll={handleLayoutScroll}>
      <section className="quiz-pane">
        <details className="mobile-course-menu">
          <summary>
            <span>{currentChapter.title}</span>
            <ChevronDown size={16} />
          </summary>
          <div className="mobile-course-popover">
            <section className="mobile-menu-group" aria-label="选择章节">
              <p>选择章节</p>
              <div className="mobile-chapter-list">
                {chapters.map((chapter) => (
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
              </div>
            </section>
            <button className="secondary-button mobile-mode-button" type="button">
              <SlidersHorizontal size={17} />
              判题模式：提交后判题
            </button>
            <DownloadMenu
              label="下载习题"
              markdown={currentChapter.downloads.markdown}
              pdf={currentChapter.downloads.pdf}
            />
          </div>
        </details>

        <header className="app-header">
          <div>
            <p className="eyebrow">中国近现代史纲要</p>
            <h1>{currentChapter.title}</h1>
          </div>
          <div className="header-actions">
            <button className="icon-button" type="button" onClick={resetQuiz} aria-label="重置练习">
              <RotateCcw size={18} />
            </button>
            <DownloadMenu
              label="下载习题"
              markdown={currentChapter.downloads.markdown}
              pdf={currentChapter.downloads.pdf}
            />
          </div>
        </header>

        <details className="chapter-selector-panel">
          <summary>
            <span>题库选择</span>
            <strong>{currentChapter.title}</strong>
          </summary>
          <section className="chapter-selector" aria-label="章节习题选择">
            {chapters.map((chapter) => (
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

        {isAvailable ? (
          <details className="question-nav-panel">
            <summary>
              <ListChecks size={18} />
              <span>
                题号面板 · {currentIndex + 1}/{questions.length}
              </span>
            </summary>
            <nav className="question-nav" aria-label="题号导航">
              {questions.map((question, index) => (
                <button
                  className={`question-chip ${index === currentIndex ? "is-active" : ""} ${questionStatusClass(
                    attempts[question.id],
                    (selectedByQuestion[question.id] ?? []).length > 0,
                    flaggedQuestionIdSet.has(question.id),
                  )}`}
                  key={question.id}
                  onClick={() => jumpToQuestion(index)}
                  type="button"
                >
                  {question.id}
                </button>
              ))}
            </nav>
            <div className="batch-actions">
              <button
                className="secondary-button"
                disabled={pendingReviewCount === 0}
                onClick={gradeAllSelectedQuestions}
                type="button"
              >
                <Trophy size={18} />
                一键批改
              </button>
            </div>
          </details>
        ) : null}

        {isAvailable && currentQuestion ? (
        <section className="question-card">
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
              return (
                <label
                  className={`option-row ${selected ? "is-selected" : ""}`}
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

          <div className="question-actions">
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
              className={`secondary-button flag-button ${currentQuestionFlagged ? "is-active" : ""}`}
              onClick={toggleCurrentQuestionFlag}
              type="button"
            >
              <Bookmark size={18} />
              {currentQuestionFlagged ? "取消记不清" : "记不清"}
            </button>
            <button
              className="primary-button"
              disabled={selectedAnswers.length === 0 || Boolean(currentAttempt)}
              onClick={submitCurrentQuestion}
              type="button"
            >
              <Send size={18} />
              <span className="action-label">提交答案</span>
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
            <aside className={`feedback-card ${currentAttempt.isCorrect ? "is-correct" : "is-wrong"}`}>
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
            <h2>敬请期待</h2>
            <p>{currentChapter.title}还在整理中。</p>
          </section>
        )}

      </section>
      <section className="reference-shell">
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
