import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..", "..");
const inputPath = resolve(rootDir, "中国近现代史纲要 复习指导.md");
const outputPath = resolve(import.meta.dirname, "..", "src", "generated", "questions.json");
const sourceMapPath = resolve(import.meta.dirname, "..", "src", "data", "sourceMap.json");

const sectionTypeByTitle = new Map([
  ["一、单选题", "single"],
  ["二、多选题", "multiple"],
  ["三、判断题", "judge"],
]);

function stripMarkdown(value) {
  return value
    .replace(/\*\*/g, "")
    .replace(/_\(/g, "（")
    .replace(/\)_/g, "）")
    .replace(/_/g, "")
    .trim();
}

function splitOptions(raw) {
  const text = stripMarkdown(raw);
  const matches = [...text.matchAll(/(?<![A-Za-z])([ABCD])[.．]\s*/g)];
  if (matches.length === 0) {
    return { stem: text, options: [] };
  }

  const stem = text.slice(0, matches[0].index).trim();
  const options = matches.map((match, index) => {
    const end = index + 1 < matches.length ? matches[index + 1].index : text.length;
    return {
      id: match[1],
      label: text.slice(match.index + match[0].length, end).trim(),
    };
  });

  return { stem, options };
}

function normalizeQuestion(raw, type) {
  const withoutNumber = raw.replace(/^\*\*(\d+)\.\s*/, "");
  if (type === "judge") {
    return {
      stem: stripMarkdown(withoutNumber),
      options: [
        { id: "true", label: "正确" },
        { id: "false", label: "错误" },
      ],
    };
  }
  return splitOptions(withoutNumber);
}

function parseQuestions(markdown) {
  const beforeAnswers = markdown.split("答案与解析")[0];
  const questions = [];
  let currentType = null;
  let currentLines = [];

  function finishQuestion() {
    if (currentLines.length === 0 || currentType === null) {
      currentLines = [];
      return;
    }

    const raw = currentLines.join(" ").trim();
    const numberMatch = raw.match(/^\*\*(\d+)\./);
    if (!numberMatch) {
      throw new Error(`Cannot parse question number from: ${raw}`);
    }

    const id = Number(numberMatch[1]);
    const normalized = normalizeQuestion(raw, currentType);
    questions.push({
      id,
      type: currentType,
      stem: normalized.stem,
      options: normalized.options,
      correctAnswers: [],
      explanation: "",
      sourceIds: [],
    });
    currentLines = [];
  }

  for (const rawLine of beforeAnswers.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      finishQuestion();
      continue;
    }

    if (sectionTypeByTitle.has(line)) {
      finishQuestion();
      currentType = sectionTypeByTitle.get(line);
      continue;
    }

    if (/^\*\*\d+\./.test(line)) {
      finishQuestion();
      currentLines = [line];
      continue;
    }

    if (currentLines.length > 0) {
      currentLines.push(line);
    }
  }
  finishQuestion();

  return questions;
}

function parseAnswerEntries(markdown) {
  const answerPart = markdown.split("答案与解析")[1];
  const entries = [];
  let current = null;

  for (const rawLine of answerPart.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const match = line.match(/^(\d+)\.\s*(.*)$/);
    if (match) {
      if (current) entries.push(current);
      current = { id: Number(match[1]), text: match[2] };
    } else if (current) {
      current.text += ` ${line}`;
    }
  }
  if (current) entries.push(current);
  return entries;
}

function answerIdsFor(question, answerText) {
  const clean = stripMarkdown(answerText);
  if (question.type === "judge") {
    if (clean.startsWith("正确")) return ["true"];
    if (clean.startsWith("错误")) return ["false"];
    throw new Error(`Cannot parse judge answer for Q${question.id}: ${answerText}`);
  }

  const match = clean.match(/^([ABCD]{1,4})/);
  if (!match) {
    throw new Error(`Cannot parse choice answer for Q${question.id}: ${answerText}`);
  }
  return match[1].split("");
}

function withAnswers(questions, answerEntries) {
  const byId = new Map(questions.map((question) => [question.id, question]));
  for (const entry of answerEntries) {
    const question = byId.get(entry.id);
    if (!question) {
      throw new Error(`Answer has no matching question: ${entry.id}`);
    }
    question.correctAnswers = answerIdsFor(question, entry.text);
    question.explanation = stripMarkdown(entry.text);
  }
  return questions;
}

const markdown = readFileSync(inputPath, "utf8");
const sourceMap = existsSync(sourceMapPath) ? JSON.parse(readFileSync(sourceMapPath, "utf8")) : {};
const questions = withAnswers(parseQuestions(markdown), parseAnswerEntries(markdown)).map((question) => ({
  ...question,
  sourceIds: sourceMap[String(question.id)] ?? [],
}));

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(questions, null, 2)}\n`);

const counts = questions.reduce(
  (acc, question) => {
    acc[question.type] += 1;
    return acc;
  },
  { single: 0, multiple: 0, judge: 0 },
);

if (questions.length !== 95 || counts.single !== 45 || counts.multiple !== 15 || counts.judge !== 35) {
  throw new Error(`Unexpected quiz counts: ${JSON.stringify({ total: questions.length, ...counts })}`);
}

console.log(`Wrote ${questions.length} questions to ${outputPath}`);
