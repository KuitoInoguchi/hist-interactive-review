import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..", "..");
const appDir = resolve(import.meta.dirname, "..");
const generatedDir = resolve(appDir, "src", "generated");
const downloadsDir = resolve(appDir, "public", "downloads");
const quizDownloadsDir = resolve(downloadsDir, "quizzes");
const referenceDownloadsDir = resolve(downloadsDir, "reference");

const chapterOneSource = resolve(rootDir, "中国近现代史纲要 复习指导.md");
const chapterTwoSource = resolve(rootDir, "reference", "chapter_2.md");
const referenceSource = resolve(rootDir, "reference", "中国近现代史纲要 复习.md");
const referencePdfSource = resolve(rootDir, "reference", "中国近现代史纲要复4习.pdf");
const pdfDir = resolve(rootDir, "pdf");

const chapterOneQuestionsPath = resolve(generatedDir, "questions.json");
const referenceUnitsPath = resolve(generatedDir, "referenceUnits.json");
const chaptersOutputPath = resolve(generatedDir, "chapters.json");

const typeOrder = ["single", "multiple", "judge"];
const typeTitles = {
  single: "一、单选题",
  multiple: "二、多选题",
  judge: "三、判断题",
};

function stripMarkdown(value) {
  return value
    .replace(/\*\*/g, "")
    .replace(/_\(/g, "（")
    .replace(/\)_/g, "）")
    .replace(/_/g, "")
    .trim();
}

function normalizeSpace(value) {
  return value.replace(/\s+/g, " ").trim();
}

function typeFromHeading(line) {
  if (line.includes("单项选择题") || line.includes("单选题")) return "single";
  if (line.includes("多项选择题") || line.includes("多选题")) return "multiple";
  if (line.includes("判断题")) return "judge";
  return null;
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
  const withoutNumber = raw.replace(/^\*\*(\d+)\.\s*/, "").replace(/\*\*\s*$/, "");
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

function parseQuestions(blockText) {
  const questions = new Map();
  let currentType = null;

  for (const rawLine of blockText.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) continue;

    const headingType = typeFromHeading(line);
    if (headingType) {
      currentType = headingType;
      continue;
    }

    if (currentType === null) continue;
    const match = line.match(/^\*\*(\d+)\.\s*(.+)$/);
    if (!match) continue;

    questions.set(Number(match[1]), {
      localId: Number(match[1]),
      type: currentType,
      body: match[2].trim(),
    });
  }

  return questions;
}

function parseAnswerSegments(answerText) {
  const headers = [...answerText.matchAll(/\*\*【(单项选择题|多项选择题|判断题)答案】\*\*/g)];
  return headers.map((header, index) => {
    const start = header.index + header[0].length;
    const end = index + 1 < headers.length ? headers[index + 1].index : answerText.length;
    return {
      type: typeFromHeading(header[1]),
      text: answerText.slice(start, end),
    };
  });
}

function stripPromptTail(text) {
  const markers = [
    " 如果这",
    "如果这",
    " 如果你",
    "如果你",
    " 这些题目",
    "这些题目",
    " 这一篇章",
    "这一篇章",
    " 需要继续",
    "需要继续",
    " 准备好进入",
    "准备好进入",
    " 接下来你想",
    "接下来你想",
    " ---",
    "---",
  ];
  let cutAt = text.length;
  for (const marker of markers) {
    const found = text.indexOf(marker);
    if (found !== -1) cutAt = Math.min(cutAt, found);
  }
  return text.slice(0, cutAt).trim();
}

function parseAnswers(answerText) {
  const answers = new Map();
  const entryPattern =
    /(?<!\d)(\d+)\.\s*(\*\*(?:[A-D]+|正确|错误)\*\*。.*?)(?=(?<!\d)\d+\.\s*\*\*(?:[A-D]+|正确|错误)\*\*。|$)/gs;

  for (const segment of parseAnswerSegments(answerText)) {
    const normalized = normalizeSpace(segment.text);
    for (const match of normalized.matchAll(entryPattern)) {
      answers.set(Number(match[1]), {
        localId: Number(match[1]),
        type: segment.type,
        body: stripPromptTail(match[2].trim()),
      });
    }
  }

  return answers;
}

function targetSectionsForBlock(blockText) {
  return [...blockText.matchAll(/第(\d+)题/g)].map((match) => Number(match[1]));
}

function iterQuizBlocks(markdown) {
  const answerHeaders = [...markdown.matchAll(/^### .*答案.*解析.*$/gm)];
  let previousEnd = 0;
  const blocks = [];

  for (const header of answerHeaders) {
    const before = markdown.slice(previousEnd, header.index);
    const afterHeader = markdown.slice(header.index + header[0].length);
    const separator = afterHeader.match(/^---+\s*$/m);
    const blockEnd = separator
      ? header.index + header[0].length + separator.index + separator[0].length
      : markdown.length;
    const answerPart = markdown.slice(header.index + header[0].length, blockEnd);
    previousEnd = blockEnd;

    if (!before.includes("选择题") && !before.includes("判断题")) continue;
    blocks.push({
      before,
      answerPart,
      targetSections: targetSectionsForBlock(before),
    });
  }

  return blocks;
}

function answerIdsFor(type, answerText) {
  const clean = stripMarkdown(answerText);
  if (type === "judge") {
    if (clean.startsWith("正确")) return ["true"];
    if (clean.startsWith("错误")) return ["false"];
    throw new Error(`Cannot parse judge answer: ${answerText}`);
  }

  const match = clean.match(/^([ABCD]{1,4})/);
  if (!match) throw new Error(`Cannot parse choice answer: ${answerText}`);
  return match[1].split("");
}

function sectionSourceIds(referenceUnits, sectionNumbers) {
  const ids = [];
  for (const sectionNo of sectionNumbers) {
    const units = referenceUnits.filter((unit) => unit.sectionNo === sectionNo);
    const preferred = units.find((unit) => unit.kind === "listItem") ?? units.find((unit) => unit.kind === "heading");
    if (preferred) ids.push(preferred.id);
  }
  return [...new Set(ids)];
}

function parseChapterTwo(markdown, referenceUnits) {
  const grouped = { single: [], multiple: [], judge: [] };

  for (const block of iterQuizBlocks(markdown)) {
    const questions = parseQuestions(block.before);
    const answers = parseAnswers(block.answerPart);
    const sourceIds = sectionSourceIds(referenceUnits, block.targetSections);

    for (const localId of [...questions.keys()].sort((a, b) => a - b)) {
      const question = questions.get(localId);
      const answer = answers.get(localId);
      if (!answer) throw new Error(`Missing answer in chapter 2 block for question ${localId}`);
      if (answer.type !== question.type) {
        throw new Error(`Type mismatch in chapter 2 block for question ${localId}`);
      }
      const normalized = normalizeQuestion(`**${localId}. ${question.body}`, question.type);
      grouped[question.type].push({
        type: question.type,
        stem: normalized.stem,
        options: normalized.options,
        correctAnswers: answerIdsFor(question.type, answer.body),
        explanation: stripMarkdown(answer.body),
        sourceIds,
      });
    }
  }

  let id = 1;
  const questions = [];
  for (const type of typeOrder) {
    for (const question of grouped[type]) {
      questions.push({ id, ...question });
      id += 1;
    }
  }

  return { grouped, questions };
}

function serializeChapterMarkdown(chapterTitle, grouped, questions) {
  const byType = new Map(typeOrder.map((type) => [type, questions.filter((question) => question.type === type)]));
  const lines = [`# ${chapterTitle}`, ""];

  for (const type of typeOrder) {
    lines.push(typeTitles[type], "");
    for (const question of byType.get(type)) {
      lines.push(`**${question.id}. ${question.stem}**`);
      if (question.type === "judge") {
        lines.push("");
        continue;
      }
      lines.push(question.options.map((option) => `${option.id}. ${option.label}`).join(" "));
      lines.push("");
    }
  }

  lines.push("答案与解析", "");
  for (const question of questions) {
    lines.push(`${question.id}. ${question.explanation}`);
    lines.push("");
  }

  return `${lines.join("\n").trim()}\n`;
}

function countsFor(questions) {
  return questions.reduce(
    (counts, question) => {
      counts[question.type] += 1;
      return counts;
    },
    { single: 0, multiple: 0, judge: 0 },
  );
}

function copyIfExists(source, target) {
  if (!existsSync(source)) return null;
  mkdirSync(dirname(target), { recursive: true });
  copyFileSync(source, target);
  return target;
}

mkdirSync(generatedDir, { recursive: true });
mkdirSync(quizDownloadsDir, { recursive: true });
mkdirSync(referenceDownloadsDir, { recursive: true });

const chapterOneQuestions = JSON.parse(readFileSync(chapterOneQuestionsPath, "utf8"));
const referenceUnits = JSON.parse(readFileSync(referenceUnitsPath, "utf8"));
const chapterTwo = parseChapterTwo(readFileSync(chapterTwoSource, "utf8"), referenceUnits);

if (chapterTwo.questions.length !== 131) {
  throw new Error(`Unexpected chapter 2 count: ${chapterTwo.questions.length}`);
}

const chapterOneMarkdownDownload = resolve(quizDownloadsDir, "chapter-1.md");
const chapterTwoMarkdownDownload = resolve(quizDownloadsDir, "chapter-2.md");
writeFileSync(chapterOneMarkdownDownload, readFileSync(chapterOneSource, "utf8"));
writeFileSync(
  chapterTwoMarkdownDownload,
  serializeChapterMarkdown("第二章 选择题 判断题", chapterTwo.grouped, chapterTwo.questions),
);

const referenceMarkdownDownload = resolve(referenceDownloadsDir, basename(referenceSource));
copyIfExists(referenceSource, referenceMarkdownDownload);
const referencePdfDownload = resolve(referenceDownloadsDir, basename(referencePdfSource));
copyIfExists(referencePdfSource, referencePdfDownload);

const chapterOnePdf = copyIfExists(
  resolve(pdfDir, "中国近现代史纲要 第一章复习试卷.pdf"),
  resolve(quizDownloadsDir, "chapter-1.pdf"),
);
const chapterTwoPdf = copyIfExists(
  resolve(pdfDir, "中国近现代史纲要 第二章复习试卷.pdf"),
  resolve(quizDownloadsDir, "chapter-2.pdf"),
);

const chapters = [
  {
    id: 1,
    numeral: "一",
    title: "第一章习题",
    longTitle: "（学习通）第一章客观题练习题",
    available: true,
    questions: chapterOneQuestions,
    downloads: {
      markdown: "/downloads/quizzes/chapter-1.md",
      pdf: chapterOnePdf ? "/downloads/quizzes/chapter-1.pdf" : null,
    },
  },
  {
    id: 2,
    numeral: "二",
    title: "第二章习题",
    longTitle: "（学习通）第二章客观题练习题",
    available: true,
    questions: chapterTwo.questions,
    downloads: {
      markdown: "/downloads/quizzes/chapter-2.md",
      pdf: chapterTwoPdf ? "/downloads/quizzes/chapter-2.pdf" : null,
    },
  },
  ...[3, 4, 5, 6, 7].map((id) => {
    const numerals = ["", "一", "二", "三", "四", "五", "六", "七"];
    return {
      id,
      numeral: numerals[id],
      title: `第${numerals[id]}章习题`,
      longTitle: `（学习通）第${numerals[id]}章客观题练习题`,
      available: false,
      questions: [],
      downloads: { markdown: null, pdf: null },
    };
  }),
];

writeFileSync(
  chaptersOutputPath,
  `${JSON.stringify(
    {
      chapters,
      referenceDownloads: {
        markdown: `/downloads/reference/${basename(referenceSource)}`,
        pdf: existsSync(referencePdfDownload) ? `/downloads/reference/${basename(referencePdfSource)}` : null,
      },
    },
    null,
    2,
  )}\n`,
);

for (const chapter of chapters.slice(0, 2)) {
  const counts = countsFor(chapter.questions);
  console.log(
    `Chapter ${chapter.id}: ${chapter.questions.length} questions (${counts.single}/${counts.multiple}/${counts.judge})`,
  );
}
console.log(`Wrote chapter data to ${chaptersOutputPath}`);
