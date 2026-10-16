/** MENTOR-032: configurable application questions (typed, ordered, conditional, validated). */
export type QuestionType = 'text' | 'longText' | 'number' | 'singleChoice' | 'multiChoice' | 'boolean';

export interface VisibilityCondition {
  questionId: string;
  operator: 'equals' | 'notEquals' | 'includes';
  value: string | number | boolean;
}

export interface ApplicationQuestion {
  id: string;
  type: QuestionType;
  label: string;
  helpText?: string;
  required: boolean;
  order: number;
  options?: string[];
  min?: number;
  max?: number;
  maxLength?: number;
  visibleWhen?: VisibilityCondition;
}

export type AnswerValue = string | number | boolean | string[] | undefined;
export type Answers = Record<string, AnswerValue>;

const UNSAFE_MARKUP = /<\s*\/?\s*[a-z!][^>]*>|javascript:/i;

/** Questions in display order; ties are broken by id so ordering is deterministic. */
export function sortQuestions(questions: ApplicationQuestion[]): ApplicationQuestion[] {
  return [...questions].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id));
}

export function isQuestionVisible(q: ApplicationQuestion, answers: Answers): boolean {
  const c = q.visibleWhen;
  if (!c) return true;
  const v = answers[c.questionId];
  if (c.operator === 'equals') return v === c.value;
  if (c.operator === 'notEquals') return v !== c.value;
  return Array.isArray(v) && v.includes(String(c.value));
}

/** Returns config problems (unsafe markup, bad options, dangling or cyclic conditions). */
export function validateQuestionConfig(questions: ApplicationQuestion[]): string[] {
  const errors: string[] = [];
  const ids = new Set(questions.map((q) => q.id));
  if (ids.size !== questions.length) errors.push('Question ids must be unique');
  for (const q of questions) {
    if (UNSAFE_MARKUP.test(q.label) || (q.helpText && UNSAFE_MARKUP.test(q.helpText))) {
      errors.push(`${q.id}: markup is not allowed in label or help text`);
    }
    if ((q.type === 'singleChoice' || q.type === 'multiChoice') && !q.options?.length) {
      errors.push(`${q.id}: choice questions need options`);
    }
    const dep = q.visibleWhen?.questionId;
    if (dep && !ids.has(dep)) errors.push(`${q.id}: condition references unknown question ${dep}`);
    if (dep) {
      const dq = questions.find((x) => x.id === dep);
      if (dq && dq.order >= q.order) errors.push(`${q.id}: condition must reference an earlier question`);
    }
  }
  return errors;
}

/** Field-level errors for visible questions only; hidden answers are ignored. */
export function validateAnswers(questions: ApplicationQuestion[], answers: Answers): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const q of sortQuestions(questions)) {
    if (!isQuestionVisible(q, answers)) continue;
    const v = answers[q.id];
    const empty = v === undefined || v === '' || (Array.isArray(v) && v.length === 0);
    if (empty) {
      if (q.required) errors[q.id] = 'This question is required';
      continue;
    }
    if ((q.type === 'text' || q.type === 'longText') && typeof v === 'string') {
      if (q.maxLength && v.length > q.maxLength) errors[q.id] = `Must be at most ${q.maxLength} characters`;
    } else if (q.type === 'number') {
      if (typeof v !== 'number' || Number.isNaN(v)) errors[q.id] = 'Enter a number';
      else if (q.min !== undefined && v < q.min) errors[q.id] = `Must be at least ${q.min}`;
      else if (q.max !== undefined && v > q.max) errors[q.id] = `Must be at most ${q.max}`;
    } else if (q.type === 'singleChoice') {
      if (typeof v !== 'string' || !q.options?.includes(v)) errors[q.id] = 'Choose one of the listed options';
    } else if (q.type === 'multiChoice') {
      if (!Array.isArray(v) || v.some((x) => !q.options?.includes(x))) errors[q.id] = 'Choose only listed options';
    }
  }
  return errors;
}
