import {
  BookOpen,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  ListChecks,
  MoreHorizontal,
  RotateCcw,
  Send,
  Settings2,
  Trophy,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ReferencePane } from "./components/ReferencePane";
import chaptersData from "./generated/chapters.json";
import { answerListLabel, areAnswersEqual } from "./lib/answerCheck";
import type { GradingMode, Question, QuizAttempt } from "./types";

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
const DEFAULT_GRADING_MODE: GradingMode = "per-question-submit";

type ChapterProgress = {
  currentIndex: number;
  selectedByQuestion: Record<number, string[]>;
  attempts: Record<number, QuizAttempt>;
  activeSourceIds: string[];
  gradingMode: GradingMode;
  hasBatchResult: boolean;
};

type SavedQuizState = {
  selectedChapterId: string;
  progressByChapter: Record<string, Partial<ChapterProgress>>;
  referenceCollapsed: boolean;
};

function emptyProgress(): ChapterProgress {
  return {
    currentIndex: 0,
    selectedByQuestion: {},
    attempts: {},
    activeSourceIds: [],
    gradingMode: DEFAULT_GRADING_MODE,
    hasBatchResult: false,
  };
}

function normalizeProgress(progress?: Partial<ChapterProgress>): ChapterProgress {
  return { ...emptyProgress(), ...(progress ?? {}) };
}

function readSavedState(): Partial<SavedQuizState> {
  if (typeof window === "undefined") return {};
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return {};
  try {
    return JSON.parse(raw) as Partial<SavedQuizState>;
  } catch {
    return {};
  }
}

function typeLabel(type: Question["type"]) {
  if (type === "single") return "单选题";
  if (type === "multiple") return "多选题";
  return "判断题";
}

function questionStatusClass(attempt: QuizAttempt | undefined, hasPendingSelection: boolean) {
  if (!attempt && hasPendingSelection) return "is-pending";
  if (!attempt) return "";
  return attempt.isCorrect ? "is-correct" : "is-wrong";
}

function gradingModeLabel(mode: GradingMode) {
  if (mode === "instant-on-select") return "点选即判";
  if (mode === "batch-submit") return "统一提交";
  return "逐题提交";
}

function createAttempt(question: Question, selectedAnswers: string[]): QuizAttempt {
  return {
    questionId: question.id,
    selectedAnswers,
    isCorrect: areAnswersEqual(selectedAnswers, question.correctAnswers),
    submittedAt: new Date().toISOString(),
  };
}

function gradeSelectedQuestions(
  questions: Question[],
  progress: ChapterProgress,
  activeQuestionId?: number,
): ChapterProgress {
  const pendingQuestions = questions.filter((question) => {
    const selectedAnswers = progress.selectedByQuestion[question.id] ?? [];
    return selectedAnswers.length > 0 && !progress.attempts[question.id];
  });

  if (pendingQuestions.length === 0) {
    return progress;
  }

  const nextAttempts = { ...progress.attempts };
  const submittedAt = new Date().toISOString();

  for (const question of pendingQuestions) {
    const selectedAnswers = progress.selectedByQuestion[question.id] ?? [];
    nextAttempts[question.id] = {
      questionId: question.id,
      selectedAnswers,
      isCorrect: areAnswersEqual(selectedAnswers, question.correctAnswers),
      submittedAt,
    };
  }

  const activeQuestion = activeQuestionId
    ? pendingQuestions.find((question) => question.id === activeQuestionId)
    : undefined;

  return {
    ...progress,
    attempts: nextAttempts,
    activeSourceIds: activeQuestion ? activeQuestion.sourceIds : progress.activeSourceIds,
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
  const savedState = useMemo(readSavedState, []);
  const initialChapterId = chapters.some((chapter) => chapter.id === savedState.selectedChapterId)
    ? (savedState.selectedChapterId as string)
    : defaultChapterId;
  const [selectedChapterId, setSelectedChapterId] = useState(initialChapterId);
  const [progressByChapter, setProgressByChapter] = useState<Record<string, ChapterProgress>>(() => {
    const savedProgress = savedState.progressByChapter ?? {};
    return Object.fromEntries(
      Object.entries({ [defaultChapterId]: emptyProgress(), ...savedProgress }).map(([chapterId, progress]) => [
        chapterId,
        normalizeProgress(progress),
      ]),
    );
  });
  const [referenceCollapsed, setReferenceCollapsed] = useState(savedState.referenceCollapsed ?? true);
  const [sourceScrollRequest, setSourceScrollRequest] = useState(0);
  const [chapterDrawerOpen, setChapterDrawerOpen] = useState(false);
  const [questionDrawerOpen, setQuestionDrawerOpen] = useState(false);
  const [moreMenuOpen, setMoreMenuOpen] = useState(false);

  const currentChapter = chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0];
  const questions = currentChapter.questions;
  const currentProgress = normalizeProgress(progressByChapter[currentChapter.id]);
  const currentIndex = Math.min(currentProgress.currentIndex, Math.max(questions.length - 1, 0));
  const selectedByQuestion = currentProgress.selectedByQuestion;
  const attempts = currentProgress.attempts;
  const activeSourceIds = currentProgress.activeSourceIds;
  const gradingMode = currentProgress.gradingMode;
  const currentQuestion = questions[currentIndex];
  const currentAttempt = currentQuestion ? attempts[currentQuestion.id] : undefined;
  const selectedAnswers = currentQuestion ? selectedByQuestion[currentQuestion.id] ?? [] : [];
  const answeredCount = questions.filter((question) => selectedByQuestion[question.id]?.length).length;
  const submittedCount = Object.keys(attempts).length;
  const correctCount = Object.values(attempts).filter((attempt) => attempt.isCorrect).length;
  const wrongAttempts = questions.filter((question) => attempts[question.id] && !attempts[question.id].isCorrect);
  const isAvailable = currentChapter.available && questions.length > 0;
  const showBatchResult = gradingMode === "batch-submit" && currentProgress.hasBatchResult && submittedCount > 0;
  const pendingReviewCount = questions.filter((question) => {
    const answers = selectedByQuestion[question.id] ?? [];
    return answers.length > 0 && !attempts[question.id];
  }).length;

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
    const state: SavedQuizState = { selectedChapterId, progressByChapter, referenceCollapsed };
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [progressByChapter, referenceCollapsed, selectedChapterId]);

  function updateCurrentProgress(updater: (progress: ChapterProgress) => ChapterProgress) {
    setProgressByChapter((previous) => {
      const progress = normalizeProgress(previous[currentChapter.id]);
      return { ...previous, [currentChapter.id]: normalizeProgress(updater(progress)) };
    });
  }

  function chooseChapter(chapterId: string) {
    setSelectedChapterId(chapterId);
    setChapterDrawerOpen(false);
    const chapter = chapters.find((item) => item.id === chapterId);
    if (!chapter?.available) {
      setProgressByChapter((previous) => ({ ...previous, [chapterId]: emptyProgress() }));
    } else {
      setProgressByChapter((previous) => ({ ...previous, [chapterId]: normalizeProgress(previous[chapterId]) }));
    }
  }

  function setGradingMode(mode: GradingMode) {
    updateCurrentProgress((progress) => ({ ...progress, gradingMode: mode, hasBatchResult: false }));
  }

  function gradeQuestionInProgress(progress: ChapterProgress, question: Question, answers: string[]) {
    if (answers.length === 0 || progress.attempts[question.id]) return progress;
    return {
      ...progress,
      attempts: { ...progress.attempts, [question.id]: createAttempt(question, answers) },
    };
  }

  function setSelected(question: Question, optionId: string) {
    if (attempts[question.id]) return;

    updateCurrentProgress((progress) => {
      const current = progress.selectedByQuestion[question.id] ?? [];
      const next = question.type === "multiple"
        ? current.includes(optionId)
          ? current.filter((answer) => answer !== optionId)
          : [...current, optionId]
        : [optionId];
      const nextProgress = {
        ...progress,
        hasBatchResult: false,
        selectedByQuestion: { ...progress.selectedByQuestion, [question.id]: next },
      };
      if (progress.gradingMode === "instant-on-select" && question.type !== "multiple") {
        return gradeQuestionInProgress(nextProgress, question, next);
      }
      return nextProgress;
    });
  }

  function submitCurrentQuestion() {
    if (!currentQuestion || selectedAnswers.length === 0 || currentAttempt) return;
    updateCurrentProgress((progress) => gradeQuestionInProgress(progress, currentQuestion, selectedAnswers));
  }

  function submitAnsweredQuestions() {
    updateCurrentProgress((progress) => {
      const nextAttempts = { ...progress.attempts };
      for (const question of questions) {
        const answers = progress.selectedByQuestion[question.id] ?? [];
        if (answers.length > 0 && !nextAttempts[question.id]) {
          nextAttempts[question.id] = createAttempt(question, answers);
        }
      }
      return { ...progress, attempts: nextAttempts, hasBatchResult: true };
    });
  }

  function revealSourceForQuestion(question: Question) {
    updateCurrentProgress((progress) => ({ ...progress, activeSourceIds: question.sourceIds }));
    setReferenceCollapsed(false);
    setSourceScrollRequest((request) => request + 1);
  }

  function goToQuestion(index: number) {
    updateCurrentProgress((progress) => ({ ...progress, currentIndex: index }));
    setQuestionDrawerOpen(false);
  }

  function resetQuiz() {
    if (!window.confirm("确定要重置本章练习进度吗？")) return;
    setProgressByChapter((previous) => ({ ...previous, [currentChapter.id]: emptyProgress() }));
    setMoreMenuOpen(false);
  }

  function renderFeedback(question: Question, attempt: QuizAttempt) {
    return (
      <aside className={`feedback-card ${attempt.isCorrect ? "is-correct" : "is-wrong"}`}>
        <div className="feedback-title">
          <Trophy size={18} />
          {attempt.isCorrect ? "回答正确" : "回答错误"}
        </div>
        <p>你的答案：{answerListLabel(attempt.selectedAnswers)}</p>
        <p>正确答案：{answerListLabel(question.correctAnswers)}</p>
        <p>{question.explanation}</p>
        <button className="source-button" type="button" onClick={() => revealSourceForQuestion(question)}>
          <Eye size={18} />
          查看本题知识点
        </button>
      </aside>
    );
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

  return (
    <main className="app-shell">
      <div className="learning-layout">
        <section className="quiz-pane">
          <header className="app-header">
            <div>
              <p className="eyebrow">中国近现代史纲要</p>
              <h1>{currentChapter.title}</h1>
              <p className="mode-caption">当前模式：{gradingModeLabel(gradingMode)}</p>
            </div>
            <div className="header-actions">
              <button className="icon-button" type="button" onClick={() => setChapterDrawerOpen(true)} aria-label="选择章节">
                <ListChecks size={18} />
              </button>
              <details className="mode-menu">
                <summary className="secondary-button mode-summary">
                  <Settings2 size={18} />
                  模式
                </summary>
                <div className="mode-options" role="group" aria-label="判题模式">
                  {(["per-question-submit", "instant-on-select", "batch-submit"] as GradingMode[]).map((mode) => (
                    <button
                      className={mode === gradingMode ? "is-active" : ""}
                      key={mode}
                      type="button"
                      onClick={() => setGradingMode(mode)}
                    >
                      {gradingModeLabel(mode)}
                    </button>
                  ))}
                </div>
              </details>
              <button className="icon-button more-button" type="button" onClick={() => setMoreMenuOpen((open) => !open)} aria-label="更多操作">
                <MoreHorizontal size={18} />
              </button>
              {moreMenuOpen ? (
                <div className="more-menu">
                  <button type="button" onClick={resetQuiz}>重置练习</button>
                  <DownloadMenu label="下载习题" markdown={currentChapter.downloads.markdown} pdf={currentChapter.downloads.pdf} />
                </div>
              ) : null}
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
                  className={`chapter-option ${chapter.id === currentChapter.id ? "is-active" : ""} ${chapter.available ? "" : "is-disabled"}`}
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
            <div><span>总题数</span><strong>{questions.length}</strong></div>
            <div><span>{gradingMode === "batch-submit" ? "已作答" : "已提交"}</span><strong>{gradingMode === "batch-submit" ? answeredCount : submittedCount}</strong></div>
            <div><span>正确</span><strong>{correctCount}</strong></div>
            <div><span>题型</span><strong>{groupedCounts.single}/{groupedCounts.multiple}/{groupedCounts.judge}</strong></div>
          </section>

          {showBatchResult ? (
            <section className="result-card" aria-label="练习结果">
              <p className="eyebrow">本次结果</p>
              <h2>{correctCount} / {submittedCount}</h2>
              <p>已判题 {submittedCount} 道，正确 {correctCount} 道，错误 {submittedCount - correctCount} 道。</p>
              <div className="result-actions">
                <button className="secondary-button" type="button" onClick={() => updateCurrentProgress((progress) => ({ ...progress, hasBatchResult: false }))}>返回答题</button>
                <button className="primary-button" type="button" onClick={() => setQuestionDrawerOpen(true)}>复盘题目</button>
              </div>
              <div className="review-list">
                {(wrongAttempts.length > 0 ? wrongAttempts : questions.filter((question) => attempts[question.id])).map((question) => {
                  const attempt = attempts[question.id];
                  if (!attempt) return null;
                  return (
                    <article className="review-item" key={question.id}>
                      <strong>第 {question.id} 题 · {attempt.isCorrect ? "正确" : "错误"}</strong>
                      <p>你的答案：{answerListLabel(attempt.selectedAnswers)}；正确答案：{answerListLabel(question.correctAnswers)}</p>
                      <button className="source-button" type="button" onClick={() => revealSourceForQuestion(question)}>
                        <Eye size={18} />
                        查看知识点
                      </button>
                    </article>
                  );
                })}
              </div>
            </section>
          ) : isAvailable && currentQuestion ? (
            <section className="question-card">
              <div className="question-meta">
                <span>{typeLabel(currentQuestion.type)}</span>
                <span>{currentIndex + 1} / {questions.length}</span>
              </div>

              <h2>{currentQuestion.id}. {currentQuestion.stem}</h2>

              <div className="options-list">
                {currentQuestion.options.map((option) => {
                  const selected = selectedAnswers.includes(option.id);
                  const optionType = currentQuestion.type === "multiple" ? "checkbox" : "radio";
                  return (
                    <label className={`option-row ${selected ? "is-selected" : ""}`} key={option.id}>
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
                <button className="secondary-button" disabled={currentIndex === 0} onClick={() => goToQuestion(Math.max(0, currentIndex - 1))} type="button">
                  <ChevronLeft size={18} />上一题
                </button>
                {gradingMode === "batch-submit" ? (
                  <button className="primary-button" disabled={answeredCount === 0} onClick={submitAnsweredQuestions} type="button">
                    <CheckCircle2 size={18} />提交已作答 {answeredCount}
                  </button>
                ) : (
                  <button className="primary-button" disabled={selectedAnswers.length === 0 || Boolean(currentAttempt)} onClick={submitCurrentQuestion} type="button">
                    <Send size={18} />{gradingMode === "instant-on-select" && currentQuestion.type === "multiple" ? "确认多选答案" : "提交答案"}
                  </button>
                )}
                <button className="secondary-button" disabled={currentIndex === questions.length - 1} onClick={() => goToQuestion(Math.min(questions.length - 1, currentIndex + 1))} type="button">
                  下一题<ChevronRight size={18} />
                </button>
              </div>

              {currentAttempt ? renderFeedback(currentQuestion, currentAttempt) : null}
            </section>
          ) : (
            <section className="question-card coming-soon" aria-label="敬请期待">
              <h2>敬请期待</h2>
              <p>{currentChapter.title}还在整理中。</p>
            </section>
          )}

          {isAvailable ? (
            <>
              <button className="question-nav-toggle secondary-button" type="button" onClick={() => setQuestionDrawerOpen(true)}>
                <ListChecks size={18} />题号面板 · {currentIndex + 1}/{questions.length}
              </button>
              <nav className="question-nav" aria-label="题号导航">
                {questions.map((question, index) => (
                  <button
                    className={`question-chip ${index === currentIndex ? "is-active" : ""} ${questionStatusClass(
                      attempts[question.id],
                      (selectedByQuestion[question.id] ?? []).length > 0,
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
            </>
          ) : null}
        </section>

        <section className="reference-shell">
          <button className="reference-toggle" onClick={() => setReferenceCollapsed((collapsed) => !collapsed)} type="button">
            <BookOpen size={18} />
            {referenceCollapsed ? "查看复习资料" : "收起复习资料"}
          </button>
          <ReferencePane
            activeSourceIds={activeSourceIds}
            collapsed={referenceCollapsed}
            downloads={chaptersPayload.referenceDownloads}
            scrollRequest={sourceScrollRequest}
          />
        </section>
      </div>

      {chapterDrawerOpen ? (
        <div className="drawer-backdrop" role="presentation">
          <section className="mobile-drawer" aria-label="章节选择">
            <div className="drawer-header"><h2>选择章节</h2><button className="icon-button" type="button" onClick={() => setChapterDrawerOpen(false)} aria-label="关闭章节选择"><X size={18} /></button></div>
            <div className="drawer-list">
              {chapters.map((chapter) => (
                <button className={`chapter-option ${chapter.id === currentChapter.id ? "is-active" : ""} ${chapter.available ? "" : "is-disabled"}`} key={chapter.id} onClick={() => chooseChapter(chapter.id)} type="button">
                  <span>{chapter.title}</span><small>{chapter.available ? `${chapter.questions.length} 道题` : "整理中"}</small>
                </button>
              ))}
            </div>
          </section>
        </div>
      ) : null}

      {questionDrawerOpen ? (
        <div className="drawer-backdrop" role="presentation">
          <section className="mobile-drawer" aria-label="题号面板">
            <div className="drawer-header"><h2>题号面板</h2><button className="icon-button" type="button" onClick={() => setQuestionDrawerOpen(false)} aria-label="关闭题号面板"><X size={18} /></button></div>
            <nav className="drawer-question-grid">
              {questions.map((question, index) => (
                <button className={`question-chip ${index === currentIndex ? "is-active" : ""} ${questionStatusClass(
                      attempts[question.id],
                      (selectedByQuestion[question.id] ?? []).length > 0,
                    )}`} key={question.id} onClick={() => jumpToQuestion(index)} type="button">
                  {question.id}
                </button>
              ))}
            </nav>
          </section>
        </div>
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
