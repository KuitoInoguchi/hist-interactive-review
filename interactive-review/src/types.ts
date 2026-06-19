export type QuestionType = "single" | "multiple" | "judge";

export type ChoiceOption = {
  id: string;
  label: string;
};

export type Question = {
  id: number;
  type: QuestionType;
  stem: string;
  options: ChoiceOption[];
  correctAnswers: string[];
  explanation: string;
  sourceIds: string[];
};

export type QuizAttempt = {
  questionId: number;
  selectedAnswers: string[];
  isCorrect: boolean;
  submittedAt: string;
};

export type GradingMode = "instant-on-select" | "per-question-submit" | "batch-submit";
