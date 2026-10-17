import { describe, expect, it } from 'vitest';
import {
  type EngagementWithHistory,
  applyEngagementTransition,
  allowedEngagementTransitions,
  isTerminalEngagementState,
  ENGAGEMENT_DEMO_STATUSES,
} from '../lifecycle-state-machine';
import { MENTORSHIP_LIFECYCLES } from '../../glossary';

function proposedEngagement(): EngagementWithHistory {
  return {
    engagementId: 'eng_seed-eng-1',
    status: 'proposed',
    history: [],
  };
}

const ACTOR = {
  actorId: 'usr_1234',
  actorRole: 'organization-staff',
  reason: 'Confirming after the mentee accepted on-chain.',
  occurredAt: '2026-03-01T10:00:00.000Z',
};

describe('engagement lifecycle state machine (MENTOR-004)', () => {
  it('walks the happy path proposed -> accepted -> active -> completed', () => {
    let engagement = proposedEngagement();
    let outcome = applyEngagementTransition(engagement, 'accepted', ACTOR);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      engagement = outcome.engagement;
      expect(outcome.noop).toBe(false);
    }
    outcome = applyEngagementTransition(engagement, 'active', { ...ACTOR, occurredAt: '2026-03-02T10:00:00.000Z' });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) engagement = outcome.engagement;
    outcome = applyEngagementTransition(engagement, 'completed', { ...ACTOR, occurredAt: '2026-04-02T10:00:00.000Z' });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) engagement = outcome.engagement;
    expect(engagement.status).toBe('completed');
    expect(engagement.history).toHaveLength(3);
    expect(isTerminalEngagementState(engagement.status)).toBe(true);
  });

  it('rejects an illegal jump with the glossary error code', () => {
    const outcome = applyEngagementTransition(proposedEngagement(), 'completed', ACTOR);
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.code).toBe('ILLEGAL_TRANSITION');
      expect(outcome.failure.from).toBe('proposed');
      expect(outcome.failure.to).toBe('completed');
    }
  });

  it('rejects unknown states', () => {
    const outcome = applyEngagementTransition(
      proposedEngagement(),
      'archived' as never,
      ACTOR,
    );
    expect(outcome.ok).toBe(false);
    if (!outcome.ok) {
      expect(outcome.failure.code).toBe('UNKNOWN_STATE');
    }
  });

  it('is idempotent when re-applying the current state', () => {
    const engagement = proposedEngagement();
    const outcome = applyEngagementTransition(engagement, 'proposed', ACTOR);
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      expect(outcome.noop).toBe(true);
      expect(outcome.engagement).toBe(engagement);
      expect(outcome.engagement.history).toHaveLength(0);
    }
  });

  it('records prior state, actor, reason, and time on every applied transition', () => {
    const outcome = applyEngagementTransition(proposedEngagement(), 'withdrawn', {
      actorId: 'usr_5678',
      actorRole: 'mentor',
      reason: 'Mentor overbooked the cohort window.',
      occurredAt: '2026-03-05T12:00:00.000Z',
    });
    expect(outcome.ok).toBe(true);
    if (outcome.ok) {
      const record = outcome.engagement.history[0];
      expect(record).toEqual({
        from: 'proposed',
        to: 'withdrawn',
        actorId: 'usr_5678',
        actorRole: 'mentor',
        reason: 'Mentor overbooked the cohort window.',
        occurredAt: '2026-03-05T12:00:00.000Z',
      });
    }
  });

  it('requires a reason for withdrawn, cancelled, and disputed targets', () => {
    for (const target of ['withdrawn', 'cancelled', 'disputed'] as const) {
      const outcome = applyEngagementTransition(proposedEngagement(), target, {
        ...ACTOR,
        reason: '   ',
      });
      expect(outcome.ok).toBe(false);
      if (!outcome.ok) {
        expect(outcome.failure.code).toBe('REASON_REQUIRED');
      }
    }
    // From accepted, 'withdrawn' is legal and the plain glossary check applies.
    const accepted = applyEngagementTransition(proposedEngagement(), 'accepted', ACTOR);
    expect(accepted.ok).toBe(true);
  });

  it('exposes the canonical outgoing transitions for each demo status', () => {
    for (const status of ENGAGEMENT_DEMO_STATUSES) {
      const allowed = allowedEngagementTransitions(status);
      const table = MENTORSHIP_LIFECYCLES.engagement.transitions[status] ?? [];
      expect(allowed).toEqual(table);
    }
    expect(allowedEngagementTransitions('completed')).toEqual([]);
  });
});
