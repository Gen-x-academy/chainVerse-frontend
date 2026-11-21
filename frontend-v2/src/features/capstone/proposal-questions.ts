/**
 * Configurable proposal questions (CAPSTONE-035).
 *
 * Call owners define typed questions with validation, help text, ordering and
 * conditional visibility. A question set is versioned: publishing a change
 * produces a new version and earlier versions are never edited, so a proposal
 * can always be checked against the questions it was answered under.
 * Question text is plain text; `toSafeText` escapes it for rendering.
 */

export type QuestionType = "short_text" | "long_text" | "number" | "boolean" | "date" | "single_choice" | "multi_choice";

export type AnswerValue = string | number | boolean | string[];

export interface QuestionCondition {
  /** Show the question only when this other question has exactly this answer. */
  questionId: string;
  equals: string | number | boolean;
}

export interface ProposalQuestion {
  id: string;
  type: QuestionType;
  label: string;
  helpText?: string;
  required: boolean;
  /** 1-based position in the form. */
  order: number;
  options?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
  visibleWhen?: QuestionCondition;
}

export interface QuestionSet {
  callId: string;
  version: number;
  questions: ProposalQuestion[];
}

export interface QuestionIssue {
  path: string;
  message: string;
}

export const MAX_QUESTIONS = 50;
export const DEFAULT_MAX_LENGTH = 2000;

const CHOICE_TYPES: QuestionType[] = ["single_choice", "multi_choice"];

/** Escape text so it can be rendered without being read as markup. */
export function toSafeText(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

/** Problems with how the questions are defined, or an empty list when valid. */
export function validateQuestionSet(set: QuestionSet): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  const bad = (path: string, message: string) => issues.push({ path, message });
  if (!Number.isInteger(set.version) || set.version < 1) bad("version", "the version must be a whole number from 1");
  if (set.questions.length > MAX_QUESTIONS) bad("questions", `a form can have at most ${MAX_QUESTIONS} questions`);

  const ids = new Set<string>();
  set.questions.forEach((q, i) => {
    const at = `questions[${i}]`;
    if (q.id.trim().length === 0) bad(`${at}.id`, "give the question an id");
    if (ids.has(q.id)) bad(`${at}.id`, "question ids must be unique");
    ids.add(q.id);
    if (q.label.trim().length === 0) bad(`${at}.label`, "give the question a label");
    if (q.order !== i + 1) bad(`${at}.order`, "order must run 1, 2, 3, ... without gaps");
    if (CHOICE_TYPES.includes(q.type)) {
      const options = q.options ?? [];
      if (options.length < 2) bad(`${at}.options`, "a choice question needs at least two options");
      if (new Set(options).size !== options.length) bad(`${at}.options`, "options must be unique");
    } else if (q.options !== undefined) {
      bad(`${at}.options`, "only choice questions have options");
    }
    if (q.min !== undefined && q.max !== undefined && q.min > q.max) bad(`${at}.min`, "min cannot be above max");
    if (q.maxLength !== undefined && (!Number.isInteger(q.maxLength) || q.maxLength < 1)) bad(`${at}.maxLength`, "maxLength must be a positive whole number");
  });

  // A condition must point at an earlier question so the form can be read top to bottom.
  const position = new Map(set.questions.map((q, i) => [q.id, i]));
  set.questions.forEach((q, i) => {
    if (!q.visibleWhen) return;
    const at = `questions[${i}].visibleWhen`;
    const target = position.get(q.visibleWhen.questionId);
    if (target === undefined) bad(at, `question "${q.visibleWhen.questionId}" was not found`);
    else if (target >= i) bad(at, "a condition can only depend on an earlier question");
  });
  return issues;
}

function conditionMet(condition: QuestionCondition, answers: Readonly<Record<string, AnswerValue>>): boolean {
  const given = answers[condition.questionId];
  if (Array.isArray(given)) return given.includes(String(condition.equals));
  return given === condition.equals;
}

/** The questions a respondent should see for these answers, in order. */
export function visibleQuestions(set: QuestionSet, answers: Readonly<Record<string, AnswerValue>>): ProposalQuestion[] {
  const shown = new Set<string>();
  const result: ProposalQuestion[] = [];
  for (const q of [...set.questions].sort((a, b) => a.order - b.order)) {
    if (q.visibleWhen && !(shown.has(q.visibleWhen.questionId) && conditionMet(q.visibleWhen, answers))) continue;
    shown.add(q.id);
    result.push(q);
  }
  return result;
}

function isBlank(value: AnswerValue | undefined): boolean {
  if (value === undefined) return true;
  if (typeof value === "string") return value.trim().length === 0;
  if (Array.isArray(value)) return value.length === 0;
  return false;
}

/** Problems with the answers given, checking only the questions that are visible. */
export function validateAnswers(set: QuestionSet, answers: Readonly<Record<string, AnswerValue>>): QuestionIssue[] {
  const issues: QuestionIssue[] = [];
  for (const q of visibleQuestions(set, answers)) {
    const at = `answers.${q.id}`;
    const value = answers[q.id];
    if (isBlank(value)) {
      if (q.required) issues.push({ path: at, message: "this question needs an answer" });
      continue;
    }
    switch (q.type) {
      case "short_text":
      case "long_text": {
        const limit = q.maxLength ?? (q.type === "short_text" ? 200 : DEFAULT_MAX_LENGTH);
        if (typeof value !== "string") issues.push({ path: at, message: "answer with text" });
        else if (value.length > limit) issues.push({ path: at, message: `keep the answer under ${limit} characters` });
        break;
      }
      case "number":
        if (typeof value !== "number" || !Number.isFinite(value)) issues.push({ path: at, message: "answer with a number" });
        else if (q.min !== undefined && value < q.min) issues.push({ path: at, message: `the answer must be at least ${q.min}` });
        else if (q.max !== undefined && value > q.max) issues.push({ path: at, message: `the answer must be at most ${q.max}` });
        break;
      case "boolean":
        if (typeof value !== "boolean") issues.push({ path: at, message: "answer yes or no" });
        break;
      case "date":
        if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) issues.push({ path: at, message: "answer with a date like 2026-03-31" });
        break;
      case "single_choice":
        if (typeof value !== "string" || !(q.options ?? []).includes(value)) issues.push({ path: at, message: "choose one of the listed options" });
        break;
      case "multi_choice":
        if (!Array.isArray(value) || value.some((v) => !(q.options ?? []).includes(v))) issues.push({ path: at, message: "choose only from the listed options" });
        break;
    }
  }
  return issues;
}

/** Publish a change as the next version. The previous set is left untouched. */
export function publishNextVersion(previous: QuestionSet, questions: readonly ProposalQuestion[]): QuestionSet {
  const renumbered = questions.map((q, i) => ({ ...q, order: i + 1 }));
  return { callId: previous.callId, version: previous.version + 1, questions: renumbered };
}

/** Move a question to a new 1-based position and renumber, without changing the input. */
export function reorderQuestion(questions: readonly ProposalQuestion[], id: string, toOrder: number): ProposalQuestion[] {
  const index = questions.findIndex((q) => q.id === id);
  if (index < 0) return questions.map((q) => ({ ...q }));
  const list = questions.map((q) => ({ ...q }));
  const [moved] = list.splice(index, 1);
  const target = Math.min(Math.max(1, Math.trunc(toOrder) || 1), questions.length) - 1;
  list.splice(target, 0, moved as ProposalQuestion);
  return list.map((q, i) => ({ ...q, order: i + 1 }));
}
