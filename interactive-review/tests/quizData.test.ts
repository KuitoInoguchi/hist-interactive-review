import { describe, expect, it } from "vitest";
import questions from "../src/generated/questions.json";
import chaptersPayload from "../src/generated/chapters.json";
import referenceUnits from "../src/generated/referenceUnits.json";
import sourceMap from "../src/data/sourceMap.json";
import type { Question } from "../src/types";

const typedQuestions = questions as Question[];
const chapters = chaptersPayload.chapters as Array<{
  id: string;
  kind: "regular" | "xuetong";
  chapterNo: number;
  title: string;
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

  it("contains fourteen quiz entries with regular and xuetong groups", () => {
    expect(chapters.map((chapter) => chapter.id)).toEqual([
      "regular-1",
      "regular-2",
      "regular-3",
      "regular-4",
      "regular-5",
      "regular-6",
      "regular-7",
      "xuetong-1",
      "xuetong-2",
      "xuetong-3",
      "xuetong-4",
      "xuetong-5",
      "xuetong-6",
      "xuetong-7",
    ]);
    expect(chapters.map((chapter) => chapter.title)).toEqual([
      "第一章习题",
      "第二章习题",
      "第三章习题",
      "第四章习题",
      "第五章习题",
      "第六章习题",
      "第七章习题",
      "（学习通）第一章客观题练习题",
      "（学习通）第二章客观题练习题",
      "（学习通）第三章客观题练习题",
      "（学习通）第四章客观题练习题",
      "（学习通）第五章客观题练习题",
      "（学习通）第六章客观题练习题",
      "（学习通）第七章客观题练习题",
    ]);
    expect(chapters.filter((chapter) => chapter.available).map((chapter) => chapter.id)).toEqual(["regular-1", "regular-2"]);
  });

  it("contains the expected second-chapter question counts and source links", () => {
    const chapterTwo = chapters.find((chapter) => chapter.id === "regular-2");
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
      markdown: "/docs/chapter-1/chapter-1.md",
      pdf: "/docs/chapter-1/chapter-1.pdf",
    });
    expect(chapters[1].downloads).toEqual({
      markdown: "/docs/chapter-2/chapter-2.md",
      pdf: "/docs/chapter-2/chapter-2.pdf",
    });
    expect(
      chapters
        .filter((chapter) => !chapter.available)
        .every((chapter) => chapter.downloads.markdown === null && chapter.downloads.pdf === null),
    ).toBe(true);
    expect(chaptersPayload.referenceDownloads.markdown).toMatch(/\/docs\/.+\.md$/);
    expect(chaptersPayload.referenceDownloads.pdf).toMatch(/\/docs\/.+\.pdf$/);
  });
});
