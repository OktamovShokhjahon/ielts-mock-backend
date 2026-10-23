import type { IQuestion } from "../models/MockTest.js";

/** Exam payload: no correctAnswer; matching shows left column only (right answers stay server-side). */
type SanitizedQuestion = Omit<IQuestion, "correctAnswer" | "matchingPairs"> & {
  matchingPairs?: Array<{ left: string }>;
};

function stripQuestion(q: IQuestion): SanitizedQuestion {
  const { correctAnswer: _c, matchingPairs, ...rest } = q;
  void _c;
  if (q.type === "matching" && matchingPairs?.length) {
    return {
      ...rest,
      matchingPairs: matchingPairs.map(({ left }) => ({ left })),
    };
  }
  return { ...rest, matchingPairs: undefined };
}

export function sanitizeMockForExam(mock: Record<string, unknown>): Record<string, unknown> {
  const m = JSON.parse(JSON.stringify(mock)) as Record<string, unknown>;
  const sections = m.sections as
    | {
        reading?: { parts?: Array<{ questions?: IQuestion[] }> };
        listening?: { parts?: Array<{ questions?: IQuestion[] }> };
      }
    | undefined;

  if (sections?.reading?.parts) {
    for (const part of sections.reading.parts) {
      if (part.questions) {
        part.questions = part.questions.map(stripQuestion) as IQuestion[];
      }
    }
  }
  if (sections?.listening?.parts) {
    for (const part of sections.listening.parts) {
      if (part.questions) {
        part.questions = part.questions.map(stripQuestion) as IQuestion[];
      }
    }
  }
  return m;
}
