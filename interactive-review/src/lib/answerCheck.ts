export function normalizeAnswers(answers: string[]) {
  return [...answers].sort((a, b) => a.localeCompare(b));
}

export function areAnswersEqual(selectedAnswers: string[], correctAnswers: string[]) {
  const selected = normalizeAnswers(selectedAnswers);
  const correct = normalizeAnswers(correctAnswers);

  if (selected.length !== correct.length) {
    return false;
  }

  return selected.every((answer, index) => answer === correct[index]);
}

export function answerLabel(answerId: string) {
  if (answerId === "true") return "正确";
  if (answerId === "false") return "错误";
  return answerId;
}

export function answerListLabel(answerIds: string[]) {
  return answerIds.map(answerLabel).join("、");
}
