import { describe, expect, it } from "vitest";
import questions from "../src/generated/questions.json";
import chaptersPayload from "../src/generated/chapters.json";
import referenceUnits from "../src/generated/referenceUnits.json";
import sourceMap from "../src/data/sourceMap.json";
import type { Question } from "../src/types";

const typedQuestions = questions as Question[];
const chapters = chaptersPayload.chapters as Array<{
  id: number;
  available: boolean;
  questions: Question[];
  downloads: { markdown: string | null; pdf: string | null };
}>;
const referenceIds = new Set(referenceUnits.map((unit) => unit.id));

describe("generated quiz data", () => {
  it("contains the expected first-chapter question counts", () => {
    const counts = typedQuestions.reduce(
      (acc, question) => {
        acc[question.type] += 1;
        return acc;
      },
      { single: 0, multiple: 0, judge: 0 },
    );

    expect(typedQuestions).toHaveLength(95);
    expect(counts).toEqual({ single: 45, multiple: 15, judge: 35 });
  });

  it("has answer, explanation, and source mapping for every question", () => {
    for (const question of typedQuestions) {
      expect(question.correctAnswers.length, `Q${question.id} correctAnswers`).toBeGreaterThan(0);
      expect(question.explanation.length, `Q${question.id} explanation`).toBeGreaterThan(0);
      expect(question.sourceIds.length, `Q${question.id} sourceIds`).toBeGreaterThan(0);
      expect(sourceMap[String(question.id) as keyof typeof sourceMap]).toEqual(question.sourceIds);
    }
  });

  it("references only valid source blocks", () => {
    for (const question of typedQuestions) {
      for (const sourceId of question.sourceIds) {
        expect(referenceIds.has(sourceId), `Q${question.id} ${sourceId}`).toBe(true);
      }
    }
  });

  it("contains seven chapter entries with the first two available", () => {
    expect(chapters.map((chapter) => chapter.id)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(chapters.map((chapter) => chapter.available)).toEqual([
      true,
      true,
      false,
      false,
      false,
      false,
      false,
    ]);
  });

  it("contains the expected second-chapter question counts and source links", () => {
    const chapterTwo = chapters.find((chapter) => chapter.id === 2);
    expect(chapterTwo).toBeDefined();
    const chapterTwoQuestions = chapterTwo?.questions ?? [];
    const counts = chapterTwoQuestions.reduce(
      (acc, question) => {
        acc[question.type] += 1;
        return acc;
      },
      { single: 0, multiple: 0, judge: 0 },
    );

    expect(chapterTwoQuestions).toHaveLength(131);
    expect(counts).toEqual({ single: 66, multiple: 27, judge: 38 });
    for (const question of chapterTwoQuestions) {
      expect(question.correctAnswers.length, `chapter 2 Q${question.id} correctAnswers`).toBeGreaterThan(0);
      expect(question.explanation.length, `chapter 2 Q${question.id} explanation`).toBeGreaterThan(0);
      expect(question.sourceIds.length, `chapter 2 Q${question.id} sourceIds`).toBeGreaterThan(0);
      for (const sourceId of question.sourceIds) {
        expect(referenceIds.has(sourceId), `chapter 2 Q${question.id} ${sourceId}`).toBe(true);
      }
    }
  });

  it("provides download links for completed chapters and reference material", () => {
    expect(chapters[0].downloads).toEqual({
      markdown: "/downloads/quizzes/chapter-1.md",
      pdf: "/downloads/quizzes/chapter-1.pdf",
    });
    expect(chapters[1].downloads).toEqual({
      markdown: "/downloads/quizzes/chapter-2.md",
      pdf: "/downloads/quizzes/chapter-2.pdf",
    });
    expect(chapters.slice(2).every((chapter) => chapter.downloads.markdown === null && chapter.downloads.pdf === null)).toBe(
      true,
    );
    expect(chaptersPayload.referenceDownloads.markdown).toMatch(/\/downloads\/reference\/.+\.md$/);
    expect(chaptersPayload.referenceDownloads.pdf).toMatch(/\/downloads\/reference\/.+\.pdf$/);
  });
});
