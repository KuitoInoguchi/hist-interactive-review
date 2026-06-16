import { describe, expect, it } from "vitest";
import questions from "../src/generated/questions.json";
import referenceUnits from "../src/generated/referenceUnits.json";
import sourceMap from "../src/data/sourceMap.json";
import type { Question } from "../src/types";

const typedQuestions = questions as Question[];
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
});
