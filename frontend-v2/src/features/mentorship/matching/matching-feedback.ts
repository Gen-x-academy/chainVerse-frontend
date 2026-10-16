/** MENTOR-043: matching feedback loop - collect post-match ratings and feed them back into ranking. */
export interface MatchFeedback {
  matchId: string;
  authorId: string;
  /** 1 (poor) to 5 (excellent). */
  rating: number;
  tags: FeedbackTag[];
  comment?: string;
  submittedAt: string;
}

export type FeedbackTag = 'good_communication' | 'good_fit' | 'schedule_issues' | 'skills_mismatch' | 'goals_mismatch';

export const FEEDBACK_TAGS: FeedbackTag[] = ['good_communication', 'good_fit', 'schedule_issues', 'skills_mismatch', 'goals_mismatch'];
const MAX_COMMENT = 1000;

export function validateFeedback(f: Omit<MatchFeedback, 'submittedAt'>): string[] {
  const errors: string[] = [];
  if (!Number.isInteger(f.rating) || f.rating < 1 || f.rating > 5) errors.push('Rating must be 1-5');
  if (f.tags.some((t) => !FEEDBACK_TAGS.includes(t))) errors.push('Unknown feedback tag');
  if ((f.comment?.length ?? 0) > MAX_COMMENT) errors.push(`Comment must be at most ${MAX_COMMENT} characters`);
  return errors;
}

/** One feedback per author per match; resubmitting replaces the earlier one. */
export function upsertFeedback(all: MatchFeedback[], input: Omit<MatchFeedback, 'submittedAt'>, now: Date = new Date()): MatchFeedback[] {
  const errors = validateFeedback(input);
  if (errors.length) throw new Error(errors.join('; '));
  const rest = all.filter((f) => !(f.matchId === input.matchId && f.authorId === input.authorId));
  return [...rest, { ...input, submittedAt: now.toISOString() }];
}

/**
 * Ranking adjustment in [-0.2, +0.2] from a mentor's feedback. Shrinks toward neutral with few
 * samples (Bayesian average with prior weight 5) so one rating cannot swing the ranking.
 */
export function rankingAdjustment(feedback: MatchFeedback[]): number {
  const PRIOR_WEIGHT = 5;
  const NEUTRAL = 3;
  const total = feedback.reduce((s, f) => s + f.rating, 0);
  const avg = (total + PRIOR_WEIGHT * NEUTRAL) / (feedback.length + PRIOR_WEIGHT);
  return ((avg - NEUTRAL) / 2) * 0.2;
}

export function tagCounts(feedback: MatchFeedback[]): Record<FeedbackTag, number> {
  const out = Object.fromEntries(FEEDBACK_TAGS.map((t) => [t, 0])) as Record<FeedbackTag, number>;
  for (const f of feedback) for (const t of f.tags) out[t] += 1;
  return out;
}
