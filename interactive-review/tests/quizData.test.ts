import { describe, expect, it } from "vitest";
import questions from "../src/generated/questions.json";
import chaptersPayload from "../src/generated/chapters.json";
import referenceUnits from "../src/generated/referenceUnits.json";
import chapterSourceMaps from "../src/data/chapterSourceMaps.json";
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
    expect(chapters.filter((chapter) => chapter.available).map((chapter) => chapter.id)).toEqual([
      "regular-1",
      "regular-2",
      "regular-3",
      "regular-4",
      "regular-5",
      "regular-6",
      "regular-7",
    ]);
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

  it("contains the expected third-chapter question counts and source links", () => {
    const chapterThree = chapters.find((chapter) => chapter.id === "regular-3");
    expect(chapterThree).toBeDefined();
    const chapterThreeQuestions = chapterThree?.questions ?? [];
    const counts = chapterThreeQuestions.reduce(
      (acc, question) => {
        acc[question.type] += 1;
        return acc;
      },
      { single: 0, multiple: 0, judge: 0 },
    );

    expect(chapterThreeQuestions).toHaveLength(85);
    expect(counts).toEqual({ single: 41, multiple: 19, judge: 25 });
    for (const question of chapterThreeQuestions) {
      expect(question.correctAnswers.length, `chapter 3 Q${question.id} correctAnswers`).toBeGreaterThan(0);
      expect(question.explanation.length, `chapter 3 Q${question.id} explanation`).toBeGreaterThan(0);
      expect(question.sourceIds.length, `chapter 3 Q${question.id} sourceIds`).toBeGreaterThan(0);
      for (const sourceId of question.sourceIds) {
        expect(referenceIds.has(sourceId), `chapter 3 Q${question.id} ${sourceId}`).toBe(true);
      }
    }
  });

  it("contains the expected fourth-chapter question counts and source links", () => {
    const chapterFour = chapters.find((chapter) => chapter.id === "regular-4");
    expect(chapterFour).toBeDefined();
    const chapterFourQuestions = chapterFour?.questions ?? [];
    const counts = chapterFourQuestions.reduce(
      (acc, question) => {
        acc[question.type] += 1;
        return acc;
      },
      { single: 0, multiple: 0, judge: 0 },
    );

    expect(chapterFourQuestions).toHaveLength(84);
    expect(counts).toEqual({ single: 42, multiple: 18, judge: 24 });
    for (const question of chapterFourQuestions) {
      expect(question.correctAnswers.length, `chapter 4 Q${question.id} correctAnswers`).toBeGreaterThan(0);
      expect(question.explanation.length, `chapter 4 Q${question.id} explanation`).toBeGreaterThan(0);
      expect(question.sourceIds.length, `chapter 4 Q${question.id} sourceIds`).toBeGreaterThan(0);
      for (const sourceId of question.sourceIds) {
        expect(referenceIds.has(sourceId), `chapter 4 Q${question.id} ${sourceId}`).toBe(true);
      }
    }
  });

  it("contains the expected fifth-chapter question counts and source links", () => {
    const chapterFive = chapters.find((chapter) => chapter.id === "regular-5");
    expect(chapterFive).toBeDefined();
    const chapterFiveQuestions = chapterFive?.questions ?? [];
    const counts = chapterFiveQuestions.reduce(
      (acc, question) => {
        acc[question.type] += 1;
        return acc;
      },
      { single: 0, multiple: 0, judge: 0 },
    );

    expect(chapterFiveQuestions).toHaveLength(84);
    expect(counts).toEqual({ single: 42, multiple: 18, judge: 24 });
    for (const question of chapterFiveQuestions) {
      expect(question.correctAnswers.length, `chapter 5 Q${question.id} correctAnswers`).toBeGreaterThan(0);
      expect(question.explanation.length, `chapter 5 Q${question.id} explanation`).toBeGreaterThan(0);
      expect(question.sourceIds.length, `chapter 5 Q${question.id} sourceIds`).toBeGreaterThan(0);
      for (const sourceId of question.sourceIds) {
        expect(referenceIds.has(sourceId), `chapter 5 Q${question.id} ${sourceId}`).toBe(true);
      }
    }

    expect(chapterFiveQuestions.find((question) => question.id === 56)?.sourceIds).toEqual(["ref-c5-s88-l597-list"]);
    expect(chapterFiveQuestions.find((question) => question.id === 58)?.sourceIds).toEqual([
      "ref-c5-s89-l602-list",
      "ref-c5-s89-l601-list",
    ]);
    expect(chapterFiveQuestions.find((question) => question.id === 59)?.sourceIds).toEqual([
      "ref-c5-s90-l609-list",
      "ref-c5-s90-l610-list",
      "ref-c5-s90-l608-list",
    ]);
  });

  it.each([
    ["regular-6", 203, { single: 79, multiple: 61, judge: 63 }],
    ["regular-7", 77, { single: 31, multiple: 25, judge: 21 }],
  ] as const)("contains the expected %s question counts and fixed source links", (chapterId, total, expectedCounts) => {
    const chapter = chapters.find((item) => item.id === chapterId);
    expect(chapter).toBeDefined();
    const chapterQuestions = chapter?.questions ?? [];
    const counts = chapterQuestions.reduce(
      (acc, question) => {
        acc[question.type] += 1;
        return acc;
      },
      { single: 0, multiple: 0, judge: 0 },
    );
    const fixedMap = chapterSourceMaps[chapterId];

    expect(chapterQuestions).toHaveLength(total);
    expect(counts).toEqual(expectedCounts);
    expect(Object.keys(fixedMap)).toHaveLength(total);
    for (const question of chapterQuestions) {
      const fixed = fixedMap[String(question.id) as keyof typeof fixedMap];
      expect(fixed.stem, `${chapterId} Q${question.id} stem`).toBe(question.stem);
      expect(question.sourceIds, `${chapterId} Q${question.id} sourceIds`).toEqual(fixed.sourceIds);
      expect(question.correctAnswers.length, `${chapterId} Q${question.id} correctAnswers`).toBeGreaterThan(0);
      expect(question.explanation.length, `${chapterId} Q${question.id} explanation`).toBeGreaterThan(0);
      for (const sourceId of question.sourceIds) {
        expect(referenceIds.has(sourceId), `${chapterId} Q${question.id} ${sourceId}`).toBe(true);
      }
    }
  });

  it("keeps generated source mappings specific for completed generated chapters", () => {
    const minimumsByChapter = new Map([
      ["regular-2", { sourceIds: 50, sourceSets: 50, multiSourceMultiple: 8 }],
      ["regular-3", { sourceIds: 45, sourceSets: 45, multiSourceMultiple: 10 }],
      ["regular-4", { sourceIds: 50, sourceSets: 50, multiSourceMultiple: 14 }],
      ["regular-5", { sourceIds: 45, sourceSets: 45, multiSourceMultiple: 14 }],
      ["regular-6", { sourceIds: 65, sourceSets: 70, multiSourceMultiple: 15 }],
      ["regular-7", { sourceIds: 30, sourceSets: 30, multiSourceMultiple: 4 }],
    ]);

    for (const [chapterId, minimums] of minimumsByChapter) {
      const chapter = chapters.find((item) => item.id === chapterId);
      expect(chapter, chapterId).toBeDefined();
      const chapterQuestions = chapter?.questions ?? [];
      const uniqueSourceIds = new Set(chapterQuestions.flatMap((question) => question.sourceIds));
      const uniqueSourceSets = new Set(chapterQuestions.map((question) => question.sourceIds.join("|")));
      const multiSourceMultipleQuestions = chapterQuestions.filter(
        (question) => question.type === "multiple" && question.sourceIds.length > 1,
      );

      expect(uniqueSourceIds.size, `${chapterId} unique source ids`).toBeGreaterThanOrEqual(minimums.sourceIds);
      expect(uniqueSourceSets.size, `${chapterId} unique source sets`).toBeGreaterThanOrEqual(minimums.sourceSets);
      expect(
        multiSourceMultipleQuestions.length,
        `${chapterId} multiple questions with more than one source id`,
      ).toBeGreaterThanOrEqual(minimums.multiSourceMultiple);
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
    expect(chapters[2].downloads).toEqual({
      markdown: "/docs/chapter-3/chapter-3.md",
      pdf: null,
    });
    expect(chapters[3].downloads).toEqual({
      markdown: "/docs/chapter-4/chapter-4.md",
      pdf: null,
    });
    expect(chapters[4].downloads).toEqual({
      markdown: "/docs/chapter-5/chapter-5.md",
      pdf: null,
    });
    expect(chapters[5].downloads).toEqual({
      markdown: "/docs/chapter-6/chapter-6.md",
      pdf: null,
    });
    expect(chapters[6].downloads).toEqual({
      markdown: "/docs/chapter-7/chapter-7.md",
      pdf: null,
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
