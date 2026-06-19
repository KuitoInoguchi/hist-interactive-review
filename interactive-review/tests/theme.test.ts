import { describe, expect, it } from "vitest";
import { resolveTheme, resolveUtc8Theme } from "../src/lib/theme";

function utcDate(hour: number, minute: number) {
  return new Date(Date.UTC(2026, 0, 1, hour, minute));
}

describe("theme resolution", () => {
  it("uses UTC+8 night hours for automatic theme mode", () => {
    expect(resolveUtc8Theme(utcDate(11, 59))).toBe("light");
    expect(resolveUtc8Theme(utcDate(12, 0))).toBe("dark");
    expect(resolveUtc8Theme(utcDate(21, 59))).toBe("dark");
    expect(resolveUtc8Theme(utcDate(22, 0))).toBe("light");
  });

  it("keeps manual light and dark choices ahead of automatic time rules", () => {
    const utc8Night = utcDate(12, 0);
    const utc8Day = utcDate(4, 0);

    expect(resolveTheme("light", utc8Night)).toBe("light");
    expect(resolveTheme("dark", utc8Day)).toBe("dark");
    expect(resolveTheme("auto", utc8Night)).toBe("dark");
    expect(resolveTheme("auto", utc8Day)).toBe("light");
  });
});
