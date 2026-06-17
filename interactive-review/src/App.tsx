import { BookOpen, ChevronLeft, ChevronRight, Download, RotateCcw, Send, Trophy } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
  activeSourceIds: string[];
};

type SavedQuizState = {
  selectedChapterId: string;
  progressByChapter: Record<string, ChapterProgress>;
  referenceCollapsed: boolean;
};

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

function questionStatusClass(attempt?: QuizAttempt) {
  if (!attempt) return "";
  return attempt.isCorrect ? "is-correct" : "is-wrong";
}

function emptyProgress(): ChapterProgress {
  return {
    currentIndex: 0,
    selectedByQuestion: {},
    attempts: {},
    activeSourceIds: [],
  };
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
          <a download href={markdown}>
            下载为 md 格式
          </a>
        ) : (
          <span>md 格式暂不可用</span>
        )}
        {pdf ? (
          <a download href={pdf}>
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
  const [progressByChapter, setProgressByChapter] = useState<Record<string, ChapterProgress>>(
    savedState.progressByChapter ?? { [defaultChapterId]: emptyProgress() },
  );
  const [referenceCollapsed, setReferenceCollapsed] = useState(savedState.referenceCollapsed ?? false);

  const currentChapter = chapters.find((chapter) => chapter.id === selectedChapterId) ?? chapters[0];
  const questions = currentChapter.questions;
  const currentProgress = progressByChapter[currentChapter.id] ?? emptyProgress();
  const currentIndex = Math.min(currentProgress.currentIndex, Math.max(questions.length - 1, 0));
  const selectedByQuestion = currentProgress.selectedByQuestion;
  const attempts = currentProgress.attempts;
  const activeSourceIds = currentProgress.activeSourceIds;
  const currentQuestion = questions[currentIndex];
  const currentAttempt = currentQuestion ? attempts[currentQuestion.id] : undefined;
  const selectedAnswers = currentQuestion ? selectedByQuestion[currentQuestion.id] ?? [] : [];
  const submittedCount = Object.keys(attempts).length;
  const correctCount = Object.values(attempts).filter((attempt) => attempt.isCorrect).length;
  const isAvailable = currentChapter.available && questions.length > 0;

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
      const progress = previous[currentChapter.id] ?? emptyProgress();
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

  function resetQuiz() {
    setProgressByChapter((previous) => ({
      ...previous,
      [currentChapter.id]: emptyProgress(),
    }));
  }

  return (
    <main className="app-shell">
      <div className="learning-layout">
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
              onClick={() =>
                updateCurrentProgress((progress) => ({
                  ...progress,
                  currentIndex: Math.max(0, currentIndex - 1),
                }))
              }
              type="button"
            >
              <ChevronLeft size={18} />
              上一题
            </button>
            <button
              className="primary-button"
              disabled={selectedAnswers.length === 0 || Boolean(currentAttempt)}
              onClick={submitCurrentQuestion}
              type="button"
            >
              <Send size={18} />
              提交答案
            </button>
            <button
              className="secondary-button"
              disabled={currentIndex === questions.length - 1}
              onClick={() =>
                updateCurrentProgress((progress) => ({
                  ...progress,
                  currentIndex: Math.min(questions.length - 1, currentIndex + 1),
                }))
              }
              type="button"
            >
              下一题
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
            </aside>
          ) : null}
        </section>
        ) : (
          <section className="question-card coming-soon" aria-label="敬请期待">
            <h2>敬请期待</h2>
            <p>{currentChapter.title}还在整理中。</p>
          </section>
        )}

        {isAvailable ? (
        <nav className="question-nav" aria-label="题号导航">
          {questions.map((question, index) => (
            <button
              className={`question-chip ${index === currentIndex ? "is-active" : ""} ${questionStatusClass(attempts[question.id])}`}
              key={question.id}
              onClick={() =>
                updateCurrentProgress((progress) => ({
                  ...progress,
                  currentIndex: index,
                }))
              }
              type="button"
            >
              {question.id}
            </button>
          ))}
        </nav>
        ) : null}
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
        />
      </section>
      </div>
      <footer className="site-footer">
        联系我（们）/反馈问题/提供建议：<a href="mailto:kt_i@qq.com">kt_i@qq.com</a>
      </footer>
    </main>
  );
}
