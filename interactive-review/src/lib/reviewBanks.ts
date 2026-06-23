import type { ChapterProgress, Question } from "../types";

export const REVIEW_BANK_FLAGGED_ID = "review-flagged";
export const REVIEW_BANK_WRONG_ID = "review-wrong";

export type ReviewBankQuestionSource = {
  sourceChapterId: string;
  sourceChapterNo: number;
  sourceChapterTitle: string;
  sourceQuestionId: number;
};

export type ReviewBankQuestionEntry = ReviewBankQuestionSource & {
  question: Question;
  reviewBankId: typeof REVIEW_BANK_FLAGGED_ID | typeof REVIEW_BANK_WRONG_ID;
};

export type ReviewBankChapterEntry = {
  id: string;
  kind: "regular" | "xuetong";
  chapterNo: number;
  numeral: string;
  title: string;
  available: boolean;
  questions: Question[];
  downloads: { markdown: string | null; pdf: string | null };
};

export type ReviewBankProgressByChapter = Record<string, ChapterProgress>;

function buildReviewBankEntries(
  reviewBankId: typeof REVIEW_BANK_FLAGGED_ID | typeof REVIEW_BANK_WRONG_ID,
  chapters: ReviewBankChapterEntry[],
  progressByChapter: ReviewBankProgressByChapter,
  matcher: (progress: ChapterProgress, question: Question) => boolean,
): ReviewBankQuestionEntry[] {
  return chapters
    .filter((chapter) => chapter.kind === "regular" && chapter.available)
    .flatMap((chapter) => {
      const progress = progressByChapter[chapter.id];
      if (!progress) return [];
      return chapter.questions
        .filter((question) => matcher(progress, question))
        .map((question) => ({
          reviewBankId,
          question,
          sourceChapterId: chapter.id,
          sourceChapterNo: chapter.chapterNo,
          sourceChapterTitle: chapter.title,
          sourceQuestionId: question.id,
        }));
    });
}

export function buildFlaggedReviewBankEntries(
  chapters: ReviewBankChapterEntry[],
  progressByChapter: ReviewBankProgressByChapter,
) {
  return buildReviewBankEntries(REVIEW_BANK_FLAGGED_ID, chapters, progressByChapter, (progress, question) =>
    progress.flaggedQuestionIds.includes(question.id),
  );
}

export function buildWrongReviewBankEntries(
  chapters: ReviewBankChapterEntry[],
  progressByChapter: ReviewBankProgressByChapter,
) {
  return buildReviewBankEntries(REVIEW_BANK_WRONG_ID, chapters, progressByChapter, (progress, question) => {
    const attempt = progress.attempts[question.id];
    return Boolean(attempt && !attempt.isCorrect);
  });
}

export function getReviewBankSourceLabel(entry: ReviewBankQuestionSource) {
  return `第${toChineseChapterNumber(entry.sourceChapterNo)}章 · ${entry.sourceQuestionId}`;
}

function cloneProgress(progress: ChapterProgress | undefined): ChapterProgress {
  return {
    currentIndex: progress?.currentIndex ?? 0,
    selectedByQuestion: { ...(progress?.selectedByQuestion ?? {}) },
    attempts: { ...(progress?.attempts ?? {}) },
    flaggedQuestionIds: [...(progress?.flaggedQuestionIds ?? [])],
    activeSourceIds: [...(progress?.activeSourceIds ?? [])],
  };
}

export function removeQuestionFromFlaggedBank(
  progressByChapter: ReviewBankProgressByChapter,
  chapterId: string,
  questionId: number,
): ReviewBankProgressByChapter {
  const nextProgress = cloneProgress(progressByChapter[chapterId]);
  nextProgress.flaggedQuestionIds = nextProgress.flaggedQuestionIds.filter((id) => id !== questionId);
  return {
    ...progressByChapter,
    [chapterId]: nextProgress,
  };
}

export function removeQuestionFromWrongBank(
  progressByChapter: ReviewBankProgressByChapter,
  chapterId: string,
  questionId: number,
): ReviewBankProgressByChapter {
  const nextProgress = cloneProgress(progressByChapter[chapterId]);
  delete nextProgress.attempts[questionId];
  delete nextProgress.selectedByQuestion[questionId];
  if (nextProgress.activeSourceIds.length > 0) {
    nextProgress.activeSourceIds = [];
  }
  return {
    ...progressByChapter,
    [chapterId]: nextProgress,
  };
}

function toChineseChapterNumber(chapterNo: number) {
  const numerals = ["零", "一", "二", "三", "四", "五", "六", "七", "八", "九"];
  if (chapterNo <= 10) {
    return chapterNo === 10 ? "十" : numerals[chapterNo];
  }
  if (chapterNo < 20) {
    return `十${numerals[chapterNo - 10]}`;
  }
  const tens = Math.floor(chapterNo / 10);
  const ones = chapterNo % 10;
  return `${numerals[tens]}十${ones === 0 ? "" : numerals[ones]}`;
}
