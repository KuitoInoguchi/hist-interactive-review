import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, dirname, resolve } from "node:path";

const rootDir = resolve(import.meta.dirname, "..", "..");
const appDir = resolve(import.meta.dirname, "..");
const generatedDir = resolve(appDir, "src", "generated");
const docsDir = resolve(appDir, "public", "docs");

const chapterOneSource = resolve(rootDir, "中国近现代史纲要 复习指导.md");
const chapterTwoSource = resolve(rootDir, "reference", "chapter_2.md");
const chapterThreeSource = resolve(rootDir, "reference", "chapter_3.md");
const chapterFourSource = resolve(rootDir, "reference", "chapter_4.md");
const chapterFiveSource = resolve(rootDir, "reference", "chapter_5.md");
const chapterSixSource = resolve(rootDir, "reference", "chapter_6.md");
const chapterSevenSource = resolve(rootDir, "reference", "chapter_7.md");
const referenceSource = resolve(rootDir, "reference", "中国近现代史纲要 复习.md");

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
    " 准备好开启",
    "准备好开启",
    " 接下来你想",
    "接下来你想",
    " 恭喜你",
    "恭喜你",
    " 🎉",
    "🎉",
    " 这12道题",
    "这12道题",
    " 这25道题",
    "这25道题",
    " 这部分的逻辑",
    "这部分的逻辑",
    " 我们接下来",
    "我们接下来",
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
  const sectionNumbers = [];
  for (const match of blockText.matchAll(/第(\d+(?:\s*[、,，]\s*\d+)+)题/g)) {
    sectionNumbers.push(...match[1].split(/[、,，]/).map((value) => Number(value.trim())));
  }
  for (const match of blockText.matchAll(/第(\d+)(?:\s*[-—–至]\s*(\d+))?题/g)) {
    const start = Number(match[1]);
    const end = Number(match[2] ?? match[1]);
    for (let sectionNo = start; sectionNo <= end; sectionNo += 1) {
      sectionNumbers.push(sectionNo);
    }
  }
  return [...new Set(sectionNumbers)];
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

function unitsForSections(referenceUnits, sectionNumbers) {
  return referenceUnits.filter((unit) => sectionNumbers.includes(unit.sectionNo));
}

function preferredSourceIds(referenceUnits, sectionNumbers) {
  const ids = [];
  for (const sectionNo of sectionNumbers) {
    const units = referenceUnits.filter((unit) => unit.sectionNo === sectionNo);
    const preferred = units.find((unit) => unit.kind === "listItem") ?? units.find((unit) => unit.kind === "heading");
    if (preferred) ids.push(preferred.id);
  }
  return [...new Set(ids)];
}

function textForMatching(value) {
  return stripMarkdown(value)
    .replace(/[（(]\s*[）)]/g, " ")
    .replace(/【[^】]*】/g, " ")
    .replace(/避坑[:：]?/g, " ")
    .replace(/正确答案[:：]?/g, " ")
    .replace(/答案[:：]?/g, " ")
    .replace(/^[A-D]|^正确|^错误/, " ")
    .replace(/[^\p{Script=Han}A-Za-z0-9]+/gu, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function bigrams(value) {
  const compact = value.replace(/\s+/g, "");
  const grams = new Set();
  for (let index = 0; index < compact.length - 1; index += 1) {
    grams.add(compact.slice(index, index + 2));
  }
  return grams;
}

function keywords(value) {
  const normalized = textForMatching(value);
  const terms = new Set();
  for (const match of normalized.matchAll(/[\p{Script=Han}A-Za-z0-9]{2,}/gu)) {
    const term = match[0];
    if (term.length >= 2) terms.add(term);
    if (/^[\p{Script=Han}]{5,}$/u.test(term)) {
      for (let index = 0; index <= term.length - 4; index += 2) {
        terms.add(term.slice(index, index + 4));
      }
    }
  }
  return [...terms];
}

function overlapScore(queryText, unitText) {
  const queryGrams = bigrams(queryText);
  const unitGrams = bigrams(textForMatching(unitText));
  if (queryGrams.size === 0 || unitGrams.size === 0) return 0;

  let overlap = 0;
  for (const gram of queryGrams) {
    if (unitGrams.has(gram)) overlap += 1;
  }

  const dice = (2 * overlap) / (queryGrams.size + unitGrams.size);
  const phraseBoost = keywords(queryText).reduce((score, term) => {
    if (term.length >= 4 && unitText.includes(term)) return score + Math.min(0.45, term.length * 0.025);
    return score;
  }, 0);

  return dice + phraseBoost;
}

function bestSourceIdsForQuery(queryText, candidateUnits, fallbackIds, options = {}) {
  const { maxIds = 3, relativeThreshold = 0.72, absoluteDrop = 0.18 } = options;
  const scored = candidateUnits
    .map((unit) => ({
      id: unit.id,
      score: overlapScore(textForMatching(queryText), unit.plainText) * sourceUnitWeight(unit),
    }))
    .sort((left, right) => right.score - left.score);

  const best = scored[0];
  if (!best || best.score <= 0) return fallbackIds;

  return scored
    .filter((item) => item.score >= Math.max(best.score * relativeThreshold, best.score - absoluteDrop))
    .slice(0, maxIds)
    .map((item) => item.id);
}

function sourceUnitWeight(unit) {
  if (unit.kind === "heading") return 0.42;
  if (unit.kind === "paragraph" && unit.plainText.length < 24) return 0.35;
  return 1;
}

function sourceIdsForQuestion(question, answer, normalized, referenceUnits, sectionNumbers) {
  const candidateUnits = unitsForSections(referenceUnits, sectionNumbers).filter((unit) =>
    ["heading", "paragraph", "listItem"].includes(unit.kind),
  );
  const fallbackIds = preferredSourceIds(referenceUnits, sectionNumbers);
  if (candidateUnits.length === 0) return fallbackIds;

  const correctAnswers = answerIdsFor(question.type, answer.body);
  const correctOptions = normalized.options.filter((option) => correctAnswers.includes(option.id));
  const correctOptionLabels = correctOptions.map((option) => option.label).join(" ");

  if (question.type === "multiple" && correctOptions.length > 1) {
    const selected = [];
    for (const option of correctOptions) {
      selected.push(
        ...bestSourceIdsForQuery(`${normalized.stem} ${option.label} ${answer.body}`, candidateUnits, fallbackIds, {
          maxIds: 1,
          relativeThreshold: 0.9,
          absoluteDrop: 0.08,
        }),
      );
    }
    if (selected.length > 0) return [...new Set(selected)].slice(0, 5);
  }

  const selected = bestSourceIdsForQuery(`${normalized.stem} ${correctOptionLabels} ${answer.body}`, candidateUnits, fallbackIds);

  return [...new Set(selected)];
}

function parseGeneratedChapter(markdown, referenceUnits, chapterLabel, blockSectionOverrides = {}) {
  const grouped = { single: [], multiple: [], judge: [] };

  for (const [blockIndex, block] of iterQuizBlocks(markdown).entries()) {
    const questions = parseQuestions(block.before);
    const answers = parseAnswers(block.answerPart);
    const sectionNumbers = block.targetSections.length > 0 ? block.targetSections : blockSectionOverrides[blockIndex + 1] ?? [];

    for (const localId of [...questions.keys()].sort((a, b) => a - b)) {
      const question = questions.get(localId);
      const answer = answers.get(localId);
      if (!answer) throw new Error(`Missing answer in ${chapterLabel} block for question ${localId}`);
      if (answer.type !== question.type) {
        throw new Error(`Type mismatch in ${chapterLabel} block for question ${localId}`);
      }
      const normalized = normalizeQuestion(`**${localId}. ${question.body}`, question.type);
      const correctAnswers = answerIdsFor(question.type, answer.body);
      const sourceIds = sourceIdsForQuestion(question, answer, normalized, referenceUnits, sectionNumbers);
      grouped[question.type].push({
        type: question.type,
        stem: normalized.stem,
        options: normalized.options,
        correctAnswers,
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
mkdirSync(docsDir, { recursive: true });

const chapterOneQuestions = JSON.parse(readFileSync(chapterOneQuestionsPath, "utf8"));
const referenceUnits = JSON.parse(readFileSync(referenceUnitsPath, "utf8"));
const chapterTwo = parseGeneratedChapter(readFileSync(chapterTwoSource, "utf8"), referenceUnits, "chapter 2");
const chapterThree = parseGeneratedChapter(readFileSync(chapterThreeSource, "utf8"), referenceUnits, "chapter 3");
const chapterFour = parseGeneratedChapter(readFileSync(chapterFourSource, "utf8"), referenceUnits, "chapter 4");
const chapterFive = parseGeneratedChapter(readFileSync(chapterFiveSource, "utf8"), referenceUnits, "chapter 5");
const chapterSix = parseGeneratedChapter(readFileSync(chapterSixSource, "utf8"), referenceUnits, "chapter 6", {
  4: [99, 100, 101],
});
const chapterSeven = parseGeneratedChapter(readFileSync(chapterSevenSource, "utf8"), referenceUnits, "chapter 7");

if (chapterTwo.questions.length !== 131) {
  throw new Error(`Unexpected chapter 2 count: ${chapterTwo.questions.length}`);
}
if (chapterThree.questions.length !== 85) {
  throw new Error(`Unexpected chapter 3 count: ${chapterThree.questions.length}`);
}
if (chapterFour.questions.length !== 84) {
  throw new Error(`Unexpected chapter 4 count: ${chapterFour.questions.length}`);
}
if (chapterFive.questions.length !== 84) {
  throw new Error(`Unexpected chapter 5 count: ${chapterFive.questions.length}`);
}
if (chapterSix.questions.length !== 203) {
  throw new Error(`Unexpected chapter 6 count: ${chapterSix.questions.length}`);
}
if (chapterSeven.questions.length !== 77) {
  throw new Error(`Unexpected chapter 7 count: ${chapterSeven.questions.length}`);
}

const chapterOneDir = resolve(docsDir, "chapter-1");
const chapterTwoDir = resolve(docsDir, "chapter-2");
const chapterThreeDir = resolve(docsDir, "chapter-3");
const chapterFourDir = resolve(docsDir, "chapter-4");
const chapterFiveDir = resolve(docsDir, "chapter-5");
const chapterSixDir = resolve(docsDir, "chapter-6");
const chapterSevenDir = resolve(docsDir, "chapter-7");
mkdirSync(chapterOneDir, { recursive: true });
mkdirSync(chapterTwoDir, { recursive: true });
mkdirSync(chapterThreeDir, { recursive: true });
mkdirSync(chapterFourDir, { recursive: true });
mkdirSync(chapterFiveDir, { recursive: true });
mkdirSync(chapterSixDir, { recursive: true });
mkdirSync(chapterSevenDir, { recursive: true });

const chapterOneMarkdownDownload = resolve(chapterOneDir, "chapter-1.md");
const chapterTwoMarkdownDownload = resolve(chapterTwoDir, "chapter-2.md");
const chapterThreeMarkdownDownload = resolve(chapterThreeDir, "chapter-3.md");
const chapterFourMarkdownDownload = resolve(chapterFourDir, "chapter-4.md");
const chapterFiveMarkdownDownload = resolve(chapterFiveDir, "chapter-5.md");
const chapterSixMarkdownDownload = resolve(chapterSixDir, "chapter-6.md");
const chapterSevenMarkdownDownload = resolve(chapterSevenDir, "chapter-7.md");
writeFileSync(chapterOneMarkdownDownload, readFileSync(chapterOneSource, "utf8"));
writeFileSync(
  chapterTwoMarkdownDownload,
  serializeChapterMarkdown("第二章 选择题 判断题", chapterTwo.grouped, chapterTwo.questions),
);
writeFileSync(
  chapterThreeMarkdownDownload,
  serializeChapterMarkdown("第三章 选择题 判断题", chapterThree.grouped, chapterThree.questions),
);
writeFileSync(
  chapterFourMarkdownDownload,
  serializeChapterMarkdown("第四章 选择题 判断题", chapterFour.grouped, chapterFour.questions),
);
writeFileSync(
  chapterFiveMarkdownDownload,
  serializeChapterMarkdown("第五章 选择题 判断题", chapterFive.grouped, chapterFive.questions),
);
writeFileSync(
  chapterSixMarkdownDownload,
  serializeChapterMarkdown("第六章 选择题 判断题", chapterSix.grouped, chapterSix.questions),
);
writeFileSync(
  chapterSevenMarkdownDownload,
  serializeChapterMarkdown("第七章 选择题 判断题", chapterSeven.grouped, chapterSeven.questions),
);

const referenceMarkdownDownload = resolve(docsDir, basename(referenceSource));
copyIfExists(referenceSource, referenceMarkdownDownload);
const referencePdfDownload = resolve(docsDir, "中国近现代史纲要复4习.pdf");
const chapterOnePdf = resolve(chapterOneDir, "chapter-1.pdf");
const chapterTwoPdf = resolve(chapterTwoDir, "chapter-2.pdf");

const numerals = ["", "一", "二", "三", "四", "五", "六", "七"];
const regularCompletedByChapter = new Map([
  [
    1,
    {
      questions: chapterOneQuestions,
      downloads: {
        markdown: "/docs/chapter-1/chapter-1.md",
        pdf: existsSync(chapterOnePdf) ? "/docs/chapter-1/chapter-1.pdf" : null,
      },
    },
  ],
  [
    2,
    {
      questions: chapterTwo.questions,
      downloads: {
        markdown: "/docs/chapter-2/chapter-2.md",
        pdf: existsSync(chapterTwoPdf) ? "/docs/chapter-2/chapter-2.pdf" : null,
      },
    },
  ],
  [
    3,
    {
      questions: chapterThree.questions,
      downloads: {
        markdown: "/docs/chapter-3/chapter-3.md",
        pdf: null,
      },
    },
  ],
  [
    4,
    {
      questions: chapterFour.questions,
      downloads: {
        markdown: "/docs/chapter-4/chapter-4.md",
        pdf: null,
      },
    },
  ],
  [
    5,
    {
      questions: chapterFive.questions,
      downloads: {
        markdown: "/docs/chapter-5/chapter-5.md",
        pdf: null,
      },
    },
  ],
  [
    6,
    {
      questions: chapterSix.questions,
      downloads: {
        markdown: "/docs/chapter-6/chapter-6.md",
        pdf: null,
      },
    },
  ],
  [
    7,
    {
      questions: chapterSeven.questions,
      downloads: {
        markdown: "/docs/chapter-7/chapter-7.md",
        pdf: null,
      },
    },
  ],
]);
const xuetongCompletedByChapter = new Map();

function createQuizEntry(kind, chapterNo) {
  const isXuetong = kind === "xuetong";
  const completed = isXuetong
    ? xuetongCompletedByChapter.get(chapterNo)
    : regularCompletedByChapter.get(chapterNo);
  return {
    id: `${kind}-${chapterNo}`,
    kind,
    chapterNo,
    numeral: numerals[chapterNo],
    title: isXuetong
      ? `（学习通）第${numerals[chapterNo]}章客观题练习题`
      : `第${numerals[chapterNo]}章习题`,
    available: Boolean(completed),
    questions: completed?.questions ?? [],
    downloads: completed?.downloads ?? { markdown: null, pdf: null },
  };
}

const chapters = [
  ...[1, 2, 3, 4, 5, 6, 7].map((chapterNo) => createQuizEntry("regular", chapterNo)),
  ...[1, 2, 3, 4, 5, 6, 7].map((chapterNo) => createQuizEntry("xuetong", chapterNo)),
];

writeFileSync(
  chaptersOutputPath,
  `${JSON.stringify(
    {
      chapters,
      referenceDownloads: {
        markdown: `/docs/${basename(referenceSource)}`,
        pdf: existsSync(referencePdfDownload) ? `/docs/${basename(referencePdfDownload)}` : null,
      },
    },
    null,
    2,
  )}\n`,
);

for (const chapter of chapters.slice(0, 7)) {
  const counts = countsFor(chapter.questions);
  console.log(
    `Chapter ${chapter.id}: ${chapter.questions.length} questions (${counts.single}/${counts.multiple}/${counts.judge})`,
  );
}
console.log(`Wrote chapter data to ${chaptersOutputPath}`);
