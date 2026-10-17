/**
 * Engagement lifecycle state machine (closes #1251, MENTOR-004).
 *
 * The glossary (MENTOR-001) owns the engagement lifecycle table. This module
 * turns that table into a guarded, auditable application step for engagements
 * only:
 *
 * 1. every transition is validated against the canonical table before it is
 *    applied, so an illegal jump is rejected by the same code the UI renders
 *    from;
 * 2. every applied transition records the prior state, the actor, a reason,
 *    and the timestamp, giving the engagement a durable, reviewable history;
 * 3. re-applying the transition the engagement is already in is an idempotent
 *    no-op (the record is returned unchanged and no duplicate history entry
 *    is written), which makes client retries safe;
 * 4. the destructive targets (`withdrawn`, `cancelled`, `disputed`) require a
 *    non-empty reason, and the requirement is checked before anything is
 *    written.
 *
 * The frontend guard is a UX boundary only; the API must enforce the same
 * table (see `docs/mentorship/README.md`). Companion flows live next to this
 * file: `pause-resume.ts` (MENTOR-049) and `complete-terminate.ts`.
 */

import {
  type EngagementState,
  type MentorshipState,
  MENTORSHIP_LIFECYCLES,
  evaluateMentorshipTransition,
  isTerminalMentorshipState,
} from '../glossary';

/** A recorded transition: prior state, actor, reason, and time. */
export interface EngagementTransitionRecord {
  /** State the engagement was in before the transition. */
  from: EngagementState;
  /** State the engagement moved to. */
  to: EngagementState;
  /** Opaque actor id; never a name or email. */
  actorId: string;
  /** Optional platform role label for the audit view. */
  actorRole?: string;
  /** Why the transition was requested; non-empty. */
  reason: string;
  /** ISO 8601 instant when the transition was applied. */
  occurredAt: string;
}

export interface EngagementWithHistory {
  /** Opaque engagement identifier (`eng_<key>`), stable across renames. */
  engagementId: string;
  status: EngagementState;
  /** Applied transitions, oldest first. */
  history: readonly EngagementTransitionRecord[];
}

export type EngagementTransitionContext = {
  actorId: string;
  actorRole?: string;
  reason: string;
  /** ISO 8601 instant; the caller owns the clock for determinism. */
  occurredAt: string;
};

export type EngagementTransitionFailure =
  | {
      code: 'UNKNOWN_STATE' | 'ILLEGAL_TRANSITION';
      from: EngagementState;
      to: EngagementState;
      message: string;
    }
  | { code: 'REASON_REQUIRED'; from: EngagementState; to: EngagementState; message: string };

export type EngagementTransitionOutcome =
  | { ok: true; engagement: EngagementWithHistory; noop: boolean }
  | { ok: false; failure: EngagementTransitionFailure };

/** Destructive destinations that always require an explicit reason. */
const REASON_REQUIRED_TARGETS: readonly EngagementState[] = [
  'withdrawn',
  'cancelled',
  'disputed',
];

/**
 * Applies `to` to the engagement.
 *
 * Same-state requests are idempotent no-ops: nothing is appended to the
 * history and the record is returned unchanged.
 */
export function applyEngagementTransition(
  engagement: EngagementWithHistory,
  to: EngagementState,
  context: EngagementTransitionContext,
): EngagementTransitionOutcome {
  const from = engagement.status;
  if (to !== from && REASON_REQUIRED_TARGETS.includes(to) && !context.reason.trim()) {
    return {
      ok: false,
      failure: {
        code: 'REASON_REQUIRED',
        from,
        to,
        message: `A reason is required to move an engagement to "${to}".`,
      },
    };
  }

  const evaluated = evaluateMentorshipTransition('engagement', from, to as MentorshipState);
  if (!evaluated.ok) {
    return {
      ok: false,
      failure: {
        code: evaluated.error.code,
        from,
        to,
        message: evaluated.error.message,
      },
    };
  }

  if (to === from) {
    // Idempotent no-op: nothing changes, no duplicate history entry.
    return { ok: true, engagement, noop: true };
  }

  const record: EngagementTransitionRecord = {
    from,
    to,
    actorId: context.actorId,
    actorRole: context.actorRole,
    reason: context.reason.trim(),
    occurredAt: context.occurredAt,
  };

  return {
    ok: true,
    noop: false,
    engagement: {
      ...engagement,
      status: to,
      history: [...engagement.history, record],
    },
  };
}

/**
 * The canonical outgoing transitions for a status, straight from the glossary
 * table. Used to render transition buttons and to document terminal states.
 */
export function allowedEngagementTransitions(
  status: EngagementState,
): readonly EngagementState[] {
  const table = MENTORSHIP_LIFECYCLES.engagement.transitions;
  const raw = table[status] ?? [];
  return raw as readonly EngagementState[];
}

/** True when the aggregate's table declares the state terminal. */
export function isTerminalEngagementState(status: EngagementState): boolean {
  return isTerminalMentorshipState('engagement', status);
}

/**
 * Full locked statuses used by the seed data (MENTOR-007) so every warning,
 * empty, and terminal view is demonstrable even in a fresh environment.
 */
export const ENGAGEMENT_DEMO_STATUSES: readonly EngagementState[] = [
  'proposed',
  'accepted',
  'active',
  'completed',
  'declined',
  'withdrawn',
  'cancelled',
  'disputed',
];
