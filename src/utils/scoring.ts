import type { IQuestion } from "../models/MockTest.js";

function normalizeAnswer(s: string): string {
  return s.trim().toLowerCase();
}

function matchAnswer(q: IQuestion, given: string | undefined): boolean {
  if (given === undefined || given === "") return false;

  if (q.type === "matching") {
    if (!q.matchingPairs || q.matchingPairs.length === 0) return false;
    try {
      const userPairs = JSON.parse(given) as Record<string, string>;
      return q.matchingPairs.every(
        (pair) => normalizeAnswer(userPairs[pair.left] || "") === normalizeAnswer(pair.right)
      );
    } catch {
      return false;
    }
  }

  const correct = q.correctAnswer ?? "";
  if (q.type === "true_false_ng") {
    const c = normalizeAnswer(correct);
    const g = normalizeAnswer(given);
    return c === g || (c === "not given" && g === "ng") || (c === "ng" && g === "not given");
  }

  return normalizeAnswer(correct) === normalizeAnswer(given);
}

export function scoreSection(
  questions: IQuestion[],
  answers: Record<string, string> | Map<string, string> | undefined
): { correct: number; total: number; percent: number } {
  const map =
    answers instanceof Map ? Object.fromEntries(answers.entries()) : answers || {};
  let correct = 0;
  const total = questions.length;
  for (const q of questions) {
    if (matchAnswer(q, map[q.id])) correct += 1;
  }
  const percent = total === 0 ? 0 : Math.round((correct / total) * 10000) / 100;
  return { correct, total, percent };
}

export function percentToBand(percent: number): number {
  if (percent >= 90) return 9;
  if (percent >= 80) return 8;
  if (percent >= 70) return 7;
  if (percent >= 60) return 6.5;
  if (percent >= 50) return 6;
  if (percent >= 40) return 5.5;
  if (percent >= 30) return 5;
  if (percent >= 20) return 4.5;
  return 4;
}

export function overallBand(listeningPct: number, readingPct: number): number {
  const a = percentToBand(listeningPct);
  const b = percentToBand(readingPct);
  const mid = (a + b) / 2;
  return Math.round(mid * 2) / 2;
}

export function collectQuestions(parts: Array<{ questions?: IQuestion[] }>): IQuestion[] {
  return parts.flatMap((p) => p.questions || []);
}
