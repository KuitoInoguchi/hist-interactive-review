import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dirname, "..");
const chaptersPath = resolve(appDir, "src", "generated", "chapters.json");
const outputPath = resolve(appDir, "src", "data", "chapterSourceMaps.json");
const chapterIds = new Set(["regular-6", "regular-7"]);

const payload = JSON.parse(readFileSync(chaptersPath, "utf8"));
const sourceMaps = {};

for (const chapter of payload.chapters) {
  if (!chapterIds.has(chapter.id)) continue;
  sourceMaps[chapter.id] = Object.fromEntries(
    chapter.questions.map((question) => [
      String(question.id),
      {
        stem: question.stem,
        sourceIds: question.sourceIds,
      },
    ]),
  );
}

for (const chapterId of chapterIds) {
  if (!sourceMaps[chapterId]) {
    throw new Error(`Missing generated chapter: ${chapterId}`);
  }
}

writeFileSync(outputPath, `${JSON.stringify(sourceMaps, null, 2)}\n`);
console.log(`Wrote fixed chapter source maps to ${outputPath}`);
