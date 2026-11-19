/**
 * Session feedback capture (MENTOR-066).
 *
 * After an eligible session, each participant role (mentor and mentee) can give
 * structured ratings and an optional protected comment, once. Edits follow a
 * policy window, comments stay restricted (never shown to the other party
 * unless the author allows it), and reveal timing is configurable so feedback
 * cannot be used to retaliate. Aggregates handle missing data without
 * inventing values, and analytics use only consented data.
 */

export type FeedbackRole = "mentor" | "mentee";

export const RATING_DIMENSIONS = ["preparation", "communication", "usefulness", "respect"] as const;
export type RatingDimension = (typeof RATING_DIMENSIONS)[number];

export type Ratings = Partial<Record<RatingDimension, 1 | 2 | 3 | 4 | 5>>;

export interface FeedbackResponse {
  sessionId: string;
  role: FeedbackRole;
  authorId: string;
  ratings: Ratings;
  /** Protected comment. */
  comment?: string;
  /** Whether the author lets the other party read the comment. */
  commentSharedWithCounterpart: boolean;
  /** Author consents to this response being included in anonymized analytics. */
  analyticsConsent: boolean;
  submittedAt: string;
  lastEditedAt: string;
  edits: number;
}

export interface FeedbackPolicy {
  /** Sessions end this long ago at most to still accept feedback. */
  submitWithinHours: number;
  /** Responses can be edited for this long after submission, up to `maxEdits` times. */
  editWindowHours: number;
  maxEdits: number;
  /** "immediate", "after_both" (when both roles responded), or "after_delay". */
  reveal: "immediate" | "after_both" | "after_delay";
  revealDelayHours: number;
  maxCommentLength: number;
}

export const DEFAULT_POLICY: FeedbackPolicy = { submitWithinHours: 72, editWindowHours: 24, maxEdits: 2, reveal: "after_both", revealDelayHours: 48, maxCommentLength: 1000 };

export interface SessionInfo {
  id: string;
  mentorId: string;
  menteeId: string;
  /** Set only when the session actually took place. */
  completedAt?: string;
  cancelled: boolean;
}

export type SubmitError = "NOT_PARTICIPANT" | "SESSION_NOT_ELIGIBLE" | "WINDOW_CLOSED" | "ALREADY_SUBMITTED" | "NO_RATINGS" | "INVALID_RATING" | "COMMENT_TOO_LONG";
export type EditError = "NOT_FOUND" | "NOT_AUTHOR" | "EDIT_WINDOW_CLOSED" | "EDIT_LIMIT_REACHED" | "INVALID_RATING" | "COMMENT_TOO_LONG";

const hoursBetween = (from: string, to: Date) => (to.getTime() - Date.parse(from)) / 3_600_000;

export function roleOf(session: SessionInfo, userId: string): FeedbackRole | null {
  return userId === session.mentorId ? "mentor" : userId === session.menteeId ? "mentee" : null;
}

function checkRatings(r: Ratings): "NO_RATINGS" | "INVALID_RATING" | null {
  const entries = Object.entries(r);
  if (entries.length === 0) return "NO_RATINGS";
  for (const [k, v] of entries) {
    if (!(RATING_DIMENSIONS as readonly string[]).includes(k) || !Number.isInteger(v) || (v as number) < 1 || (v as number) > 5) return "INVALID_RATING";
  }
  return null;
}

/** One response per role per session; eligibility follows the session outcome. */
export function submitFeedback(
  existing: readonly FeedbackResponse[],
  session: SessionInfo,
  userId: string,
  input: { ratings: Ratings; comment?: string; commentSharedWithCounterpart?: boolean; analyticsConsent?: boolean },
  now: Date,
  policy: FeedbackPolicy = DEFAULT_POLICY,
): { ok: true; responses: FeedbackResponse[]; response: FeedbackResponse } | { ok: false; error: SubmitError } {
  const role = roleOf(session, userId);
  if (!role) return { ok: false, error: "NOT_PARTICIPANT" };
  if (session.cancelled || !session.completedAt) return { ok: false, error: "SESSION_NOT_ELIGIBLE" };
  const since = hoursBetween(session.completedAt, now);
  if (since < 0 || since > policy.submitWithinHours) return { ok: false, error: "WINDOW_CLOSED" };
  if (existing.some((r) => r.sessionId === session.id && r.role === role)) return { ok: false, error: "ALREADY_SUBMITTED" };
  const bad = checkRatings(input.ratings);
  if (bad) return { ok: false, error: bad };
  const comment = input.comment?.trim();
  if (comment && comment.length > policy.maxCommentLength) return { ok: false, error: "COMMENT_TOO_LONG" };

  const response: FeedbackResponse = {
    sessionId: session.id,
    role,
    authorId: userId,
    ratings: { ...input.ratings },
    ...(comment ? { comment } : {}),
    commentSharedWithCounterpart: input.commentSharedWithCounterpart === true,
    analyticsConsent: input.analyticsConsent === true,
    submittedAt: now.toISOString(),
    lastEditedAt: now.toISOString(),
    edits: 0,
  };
  return { ok: true, responses: [...existing, response], response };
}

export function editFeedback(
  existing: readonly FeedbackResponse[],
  sessionId: string,
  userId: string,
  patch: { ratings?: Ratings; comment?: string; commentSharedWithCounterpart?: boolean; analyticsConsent?: boolean },
  now: Date,
  policy: FeedbackPolicy = DEFAULT_POLICY,
): { ok: true; responses: FeedbackResponse[] } | { ok: false; error: EditError } {
  const target = existing.find((r) => r.sessionId === sessionId && r.authorId === userId);
  if (!target) return { ok: false, error: existing.some((r) => r.sessionId === sessionId) ? "NOT_AUTHOR" : "NOT_FOUND" };
  if (hoursBetween(target.submittedAt, now) > policy.editWindowHours) return { ok: false, error: "EDIT_WINDOW_CLOSED" };
  if (target.edits >= policy.maxEdits) return { ok: false, error: "EDIT_LIMIT_REACHED" };
  if (patch.ratings) {
    const bad = checkRatings(patch.ratings);
    if (bad) return { ok: false, error: "INVALID_RATING" };
  }
  const comment = patch.comment === undefined ? target.comment : patch.comment.trim() || undefined;
  if (comment && comment.length > policy.maxCommentLength) return { ok: false, error: "COMMENT_TOO_LONG" };

  const { comment: _old, ...rest } = target;
  const updated: FeedbackResponse = {
    ...rest,
    ...(comment ? { comment } : {}),
    ratings: patch.ratings ? { ...patch.ratings } : target.ratings,
    commentSharedWithCounterpart: patch.commentSharedWithCounterpart ?? target.commentSharedWithCounterpart,
    analyticsConsent: patch.analyticsConsent ?? target.analyticsConsent,
    lastEditedAt: now.toISOString(),
    edits: target.edits + 1,
  };
  return { ok: true, responses: existing.map((r) => (r === target ? updated : r)) };
}

/** Is the counterpart's feedback visible to `viewerId` yet? The author always sees their own. */
export function isRevealed(responses: readonly FeedbackResponse[], target: FeedbackResponse, viewerId: string, now: Date, policy: FeedbackPolicy = DEFAULT_POLICY): boolean {
  if (viewerId === target.authorId) return true;
  switch (policy.reveal) {
    case "immediate":
      return true;
    case "after_both": {
      const roles = new Set(responses.filter((r) => r.sessionId === target.sessionId).map((r) => r.role));
      return roles.has("mentor") && roles.has("mentee");
    }
    case "after_delay":
      return hoursBetween(target.submittedAt, now) >= policy.revealDelayHours;
  }
}

export interface FeedbackView {
  role: FeedbackRole;
  ratings: Ratings;
  /** Present only when the viewer is allowed to read it. */
  comment?: string;
}

/** What `viewerId` may see of a response: ratings once revealed; comments only for the author or when shared. */
export function viewFeedback(responses: readonly FeedbackResponse[], target: FeedbackResponse, viewerId: string, now: Date, policy: FeedbackPolicy = DEFAULT_POLICY): FeedbackView | null {
  if (!isRevealed(responses, target, viewerId, now, policy)) return null;
  const own = viewerId === target.authorId;
  return { role: target.role, ratings: target.ratings, ...(target.comment && (own || target.commentSharedWithCounterpart) ? { comment: target.comment } : {}) };
}

export interface Aggregate {
  responses: number;
  /** Average per dimension, or null when no one rated it (never a fabricated 0). */
  averages: Record<RatingDimension, number | null>;
  /** How many ratings each dimension is based on. */
  counts: Record<RatingDimension, number>;
}

/** Aggregate only consented responses, ignoring missing dimensions. */
export function aggregate(responses: readonly FeedbackResponse[]): Aggregate {
  const used = responses.filter((r) => r.analyticsConsent);
  const averages = {} as Aggregate["averages"];
  const counts = {} as Aggregate["counts"];
  for (const d of RATING_DIMENSIONS) {
    const values = used.map((r) => r.ratings[d]).filter((v): v is NonNullable<typeof v> => v !== undefined);
    counts[d] = values.length;
    averages[d] = values.length === 0 ? null : Math.round((values.reduce((a, b) => a + b, 0) / values.length) * 100) / 100;
  }
  return { responses: used.length, averages, counts };
}
