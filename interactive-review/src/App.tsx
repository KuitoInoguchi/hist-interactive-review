import { BookOpen, ChevronLeft, ChevronRight, RotateCcw, Send, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { ReferencePane } from "./components/ReferencePane";
import questionsData from "./generated/questions.json";
import { answerListLabel, areAnswersEqual } from "./lib/answerCheck";
import type { Question, QuizAttempt } from "./types";

const questions = questionsData as Question[];

function typeLabel(type: Question["type"]) {
  if (type === "single") return "单选题";
  if (type === "multiple") return "多选题";
  return "判断题";
}

function questionStatusClass(attempt?: QuizAttempt) {
  if (!attempt) return "";
  return attempt.isCorrect ? "is-correct" : "is-wrong";
}

export default function App() {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [selectedByQuestion, setSelectedByQuestion] = useState<Record<number, string[]>>({});
  const [attempts, setAttempts] = useState<Record<number, QuizAttempt>>({});
  const [activeSourceIds, setActiveSourceIds] = useState<string[]>([]);
  const [referenceCollapsed, setReferenceCollapsed] = useState(false);

  const currentQuestion = questions[currentIndex];
  const currentAttempt = attempts[currentQuestion.id];
  const selectedAnswers = selectedByQuestion[currentQuestion.id] ?? [];
  const submittedCount = Object.keys(attempts).length;
  const correctCount = Object.values(attempts).filter((attempt) => attempt.isCorrect).length;

  const groupedCounts = useMemo(() => {
    return questions.reduce(
      (counts, question) => {
        counts[question.type] += 1;
        return counts;
      },
      { single: 0, multiple: 0, judge: 0 },
    );
  }, []);

  function setSelected(question: Question, optionId: string) {
    if (attempts[question.id]) return;

    setSelectedByQuestion((previous) => {
      const current = previous[question.id] ?? [];
      if (question.type === "multiple") {
        const next = current.includes(optionId)
          ? current.filter((answer) => answer !== optionId)
          : [...current, optionId];
        return { ...previous, [question.id]: next };
      }
      return { ...previous, [question.id]: [optionId] };
    });
  }

  function submitCurrentQuestion() {
    if (selectedAnswers.length === 0 || currentAttempt) return;
    const isCorrect = areAnswersEqual(selectedAnswers, currentQuestion.correctAnswers);
    setAttempts((previous) => ({
      ...previous,
      [currentQuestion.id]: {
        questionId: currentQuestion.id,
        selectedAnswers,
        isCorrect,
        submittedAt: new Date().toISOString(),
      },
    }));
    setActiveSourceIds(currentQuestion.sourceIds);
  }

  function resetQuiz() {
    setCurrentIndex(0);
    setSelectedByQuestion({});
    setAttempts({});
    setActiveSourceIds([]);
  }

  return (
    <main className="app-shell">
      <div className="learning-layout">
      <section className="quiz-pane">
        <header className="app-header">
          <div>
            <p className="eyebrow">中国近现代史纲要</p>
            <h1>第一章交互式复习</h1>
          </div>
          <button className="icon-button" type="button" onClick={resetQuiz} aria-label="重置练习">
            <RotateCcw size={18} />
          </button>
        </header>

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
              onClick={() => setCurrentIndex((index) => Math.max(0, index - 1))}
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
              onClick={() => setCurrentIndex((index) => Math.min(questions.length - 1, index + 1))}
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
                已在右侧资料中高亮 {currentQuestion.sourceIds.length} 处对应知识点。
              </p>
            </aside>
          ) : null}
        </section>

        <nav className="question-nav" aria-label="题号导航">
          {questions.map((question, index) => (
            <button
              className={`question-chip ${index === currentIndex ? "is-active" : ""} ${questionStatusClass(attempts[question.id])}`}
              key={question.id}
              onClick={() => setCurrentIndex(index)}
              type="button"
            >
              {question.id}
            </button>
          ))}
        </nav>
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
        <ReferencePane activeSourceIds={activeSourceIds} collapsed={referenceCollapsed} />
      </section>
      </div>
    </main>
  );
}
