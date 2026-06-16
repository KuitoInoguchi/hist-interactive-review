import { describe, expect, it } from "vitest";
import { areAnswersEqual, answerListLabel } from "../src/lib/answerCheck";

describe("answer checking", () => {
  it("accepts multiple-choice answers regardless of selection order", () => {
    expect(areAnswersEqual(["D", "B", "A", "C"], ["A", "B", "C", "D"])).toBe(true);
  });

  it("rejects missing, extra, or wrong answers", () => {
    expect(areAnswersEqual(["A", "B"], ["A", "B", "C"])).toBe(false);
    expect(areAnswersEqual(["A", "B", "C"], ["A", "B"])).toBe(false);
    expect(areAnswersEqual(["A", "C"], ["A", "B"])).toBe(false);
  });

  it("renders judge answers as readable Chinese labels", () => {
    expect(answerListLabel(["true"])).toBe("正确");
    expect(answerListLabel(["false"])).toBe("错误");
  });
});
