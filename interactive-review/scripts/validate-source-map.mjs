import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appDir = resolve(import.meta.dirname, "..");
const questions = JSON.parse(readFileSync(resolve(appDir, "src", "generated", "questions.json"), "utf8"));
const referenceUnits = JSON.parse(readFileSync(resolve(appDir, "src", "generated", "referenceUnits.json"), "utf8"));
const sourceMap = JSON.parse(readFileSync(resolve(appDir, "src", "data", "sourceMap.json"), "utf8"));

const referenceIds = new Set(referenceUnits.map((unit) => unit.id));
const questionIds = new Set(questions.map((question) => String(question.id)));
const errors = [];

for (const question of questions) {
  const mapped = sourceMap[String(question.id)];
  if (!Array.isArray(mapped) || mapped.length === 0) {
    errors.push(`Q${question.id} has no sourceIds`);
    continue;
  }
  for (const sourceId of mapped) {
    if (!referenceIds.has(sourceId)) {
      errors.push(`Q${question.id} references missing sourceId ${sourceId}`);
    }
  }
  const generated = question.sourceIds ?? [];
  if (generated.join("|") !== mapped.join("|")) {
    errors.push(`Q${question.id} generated sourceIds do not match sourceMap`);
  }
}

for (const questionId of Object.keys(sourceMap)) {
  if (!questionIds.has(questionId)) {
    errors.push(`sourceMap contains unknown question ${questionId}`);
  }
}

if (errors.length > 0) {
  console.error(errors.join("\n"));
  process.exit(1);
}

console.log(`Validated source mappings for ${questions.length} questions`);
