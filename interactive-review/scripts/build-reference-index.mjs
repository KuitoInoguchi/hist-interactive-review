import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..", "..");
const inputPath = resolve(rootDir, "reference", "中国近现代史纲要 复习.md");
const generatedDir = resolve(import.meta.dirname, "..", "src", "generated");
const markdownOutputPath = resolve(generatedDir, "reference.md");
const indexOutputPath = resolve(generatedDir, "referenceUnits.json");

function stripMarkdown(value) {
  return value
    .replace(/\*\*/g, "")
    .replace(/\*/g, "")
    .replace(/`/g, "")
    .replace(/^\s*[-#]+\s*/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function headingInfo(line) {
  const match = line.match(/^(#{1,6})\s+(.+)$/);
  if (!match) return null;
  return {
    level: match[1].length,
    text: stripMarkdown(match[2]),
  };
}

function listInfo(line) {
  const match = line.match(/^(\s*)-\s+(.+)$/);
  if (!match) return null;
  return {
    level: Math.floor(match[1].replace(/\t/g, "  ").length / 2),
    text: stripMarkdown(match[2]),
  };
}

function paragraphInfo(line) {
  const trimmed = line.trim();
  if (!trimmed || trimmed === "---") return null;
  if (headingInfo(trimmed) || listInfo(line)) return null;
  return { text: stripMarkdown(trimmed) };
}

function parseSectionNo(text) {
  const match = text.match(/^(\d+)[.、\s]/);
  return match ? Number(match[1]) : null;
}

function createId(chapterNo, sectionNo, lineNumber, kind) {
  const chapter = chapterNo === null ? "x" : chapterNo;
  const section = sectionNo === null ? "x" : sectionNo;
  return `ref-c${chapter}-s${section}-l${lineNumber}-${kind}`;
}

function indexReference(markdown) {
  const lines = markdown.split(/\r?\n/);
  const units = [];
  let chapterNo = null;
  let chapterTitle = "";
  let sectionNo = null;
  let sectionTitle = "";

  lines.forEach((line, index) => {
    const lineNumber = index + 1;
    const heading = headingInfo(line.trim());
    if (heading) {
      if (heading.level === 1) {
        chapterNo += 1;
        sectionNo = null;
        chapterTitle = heading.text;
        sectionTitle = "";
      }
      if (heading.level === 2) {
        sectionNo = parseSectionNo(heading.text);
        sectionTitle = heading.text;
      }
      units.push({
        id: createId(chapterNo, sectionNo, lineNumber, "heading"),
        kind: "heading",
        chapterNo,
        chapterTitle,
        sectionNo,
        sectionTitle: heading.level === 2 ? heading.text : sectionTitle,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        plainText: heading.text,
      });
      return;
    }

    const list = listInfo(line);
    if (list) {
      units.push({
        id: createId(chapterNo, sectionNo, lineNumber, "list"),
        kind: "listItem",
        chapterNo,
        chapterTitle,
        sectionNo,
        sectionTitle,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        plainText: list.text,
      });
      return;
    }

    const paragraph = paragraphInfo(line);
    if (paragraph) {
      units.push({
        id: createId(chapterNo, sectionNo, lineNumber, "paragraph"),
        kind: "paragraph",
        chapterNo,
        chapterTitle,
        sectionNo,
        sectionTitle,
        lineStart: lineNumber,
        lineEnd: lineNumber,
        plainText: paragraph.text,
      });
    }
  });

  return units;
}

const markdown = readFileSync(inputPath, "utf8");
const units = indexReference(markdown);
const ids = new Set(units.map((unit) => unit.id));
if (ids.size !== units.length) {
  throw new Error("Reference index contains duplicate source IDs");
}

mkdirSync(dirname(markdownOutputPath), { recursive: true });
writeFileSync(markdownOutputPath, markdown);
writeFileSync(indexOutputPath, `${JSON.stringify(units, null, 2)}\n`);

console.log(`Wrote ${units.length} reference units to ${indexOutputPath}`);
