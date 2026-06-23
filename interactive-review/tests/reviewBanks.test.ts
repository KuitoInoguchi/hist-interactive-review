import { describe, expect, it } from "vitest";
import type { Question, QuizAttempt } from "../src/types";
import {
  buildFlaggedReviewBankEntries,
  buildWrongReviewBankEntries,
  getReviewBankSourceLabel,
  removeQuestionFromFlaggedBank,
  removeQuestionFromWrongBank,
  REVIEW_BANK_FLAGGED_ID,
  REVIEW_BANK_WRONG_ID,
  type ReviewBankChapterEntry,
  type ReviewBankProgressByChapter,
} from "../src/lib/reviewBanks";

function createQuestion(id: number, sourceIds: string[]): Question {
  return {
    id,
    type: "single",
    stem: `Question ${id}`,
    options: [
      { id: "A", label: "A" },
      { id: "B", label: "B" },
    ],
    correctAnswers: ["A"],
    explanation: `Explanation ${id}`,
    sourceIds,
  };
}

function createAttempt(questionId: number, isCorrect: boolean): QuizAttempt {
  return {
    questionId,
    selectedAnswers: [isCorrect ? "A" : "B"],
    isCorrect,
    submittedAt: "2026-06-23T00:00:00.000Z",
  };
}

const chapters: ReviewBankChapterEntry[] = [
  {
    id: "regular-1",
    kind: "regular",
    chapterNo: 1,
    numeral: "一",
    title: "第一章习题",
    available: true,
    questions: [createQuestion(1, ["ref-1"]), createQuestion(2, ["ref-2"])],
    downloads: { markdown: null, pdf: null },
  },
  {
    id: "regular-2",
    kind: "regular",
    chapterNo: 2,
    numeral: "二",
    title: "第二章习题",
    available: true,
    questions: [createQuestion(1, ["ref-3"]), createQuestion(3, ["ref-4"])],
    downloads: { markdown: null, pdf: null },
  },
  {
    id: "xuetong-1",
    kind: "xuetong",
    chapterNo: 1,
    numeral: "一",
    title: "（学习通）第一章客观题练习题",
    available: false,
    questions: [createQuestion(8, ["ignore-me"])],
    downloads: { markdown: null, pdf: null },
  },
];

describe("review banks", () => {
  it("builds flagged review bank entries from all regular chapters in chapter/question order", () => {
    const progressByChapter: ReviewBankProgressByChapter = {
      "regular-1": {
        currentIndex: 0,
        selectedByQuestion: {},
        attempts: {},
        flaggedQuestionIds: [2],
        activeSourceIds: [],
      },
      "regular-2": {
        currentIndex: 0,
        selectedByQuestion: {},
        attempts: {},
        flaggedQuestionIds: [1, 3],
        activeSourceIds: [],
      },
    };

    const entries = buildFlaggedReviewBankEntries(chapters, progressByChapter);

    expect(entries.map((entry) => `${entry.sourceChapterId}:${entry.question.id}`)).toEqual([
      "regular-1:2",
      "regular-2:1",
      "regular-2:3",
    ]);
    expect(entries.every((entry) => entry.reviewBankId === REVIEW_BANK_FLAGGED_ID)).toBe(true);
  });

  it("builds wrong review bank entries from incorrect attempts only", () => {
    const progressByChapter: ReviewBankProgressByChapter = {
      "regular-1": {
        currentIndex: 0,
        selectedByQuestion: {
          1: ["B"],
          2: ["A"],
        },
        attempts: {
          1: createAttempt(1, false),
          2: createAttempt(2, true),
        },
        flaggedQuestionIds: [],
        activeSourceIds: [],
      },
      "regular-2": {
        currentIndex: 0,
        selectedByQuestion: {
          3: ["B"],
        },
        attempts: {
          3: createAttempt(3, false),
        },
        flaggedQuestionIds: [],
        activeSourceIds: [],
      },
    };

    const entries = buildWrongReviewBankEntries(chapters, progressByChapter);

    expect(entries.map((entry) => `${entry.sourceChapterId}:${entry.question.id}`)).toEqual([
      "regular-1:1",
      "regular-2:3",
    ]);
    expect(entries.every((entry) => entry.reviewBankId === REVIEW_BANK_WRONG_ID)).toBe(true);
  });

  it("formats source labels with chapter title and original question id", () => {
    const [entry] = buildFlaggedReviewBankEntries(chapters, {
      "regular-1": {
        currentIndex: 0,
        selectedByQuestion: {},
        attempts: {},
        flaggedQuestionIds: [2],
        activeSourceIds: [],
      },
    });

    expect(getReviewBankSourceLabel(entry)).toBe("第一章 · 2");
  });

  it("removes a flagged question by clearing only the flagged state", () => {
    const progressByChapter: ReviewBankProgressByChapter = {
      "regular-1": {
        currentIndex: 1,
        selectedByQuestion: {
          2: ["A"],
        },
        attempts: {
          2: createAttempt(2, true),
        },
        flaggedQuestionIds: [2],
        activeSourceIds: ["ref-2"],
      },
    };

    const next = removeQuestionFromFlaggedBank(progressByChapter, "regular-1", 2);

    expect(next["regular-1"].flaggedQuestionIds).toEqual([]);
    expect(next["regular-1"].attempts[2]?.isCorrect).toBe(true);
    expect(next["regular-1"].selectedByQuestion[2]).toEqual(["A"]);
  });

  it("removes a wrong question by clearing both attempt and selected answers", () => {
    const progressByChapter: ReviewBankProgressByChapter = {
      "regular-2": {
        currentIndex: 0,
        selectedByQuestion: {
          3: ["B"],
        },
        attempts: {
          3: createAttempt(3, false),
        },
        flaggedQuestionIds: [3],
        activeSourceIds: ["ref-4"],
      },
    };

    const next = removeQuestionFromWrongBank(progressByChapter, "regular-2", 3);

    expect(next["regular-2"].attempts[3]).toBeUndefined();
    expect(next["regular-2"].selectedByQuestion[3]).toBeUndefined();
    expect(next["regular-2"].flaggedQuestionIds).toEqual([3]);
  });
});
