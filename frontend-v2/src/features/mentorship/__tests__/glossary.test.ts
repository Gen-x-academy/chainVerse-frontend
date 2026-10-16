import { describe, expect, it } from 'vitest';
import {
  MENTORSHIP_AGGREGATES,
  MENTORSHIP_GLOSSARY,
  MENTORSHIP_HAPPY_PATH,
  MENTORSHIP_OWNERSHIP,
  MENTORSHIP_VOCABULARY_VERSION,
  evaluateMentorshipTransition,
  glossaryAliasesAreUnique,
  happyPathIsValid,
  isMentorshipId,
  isTerminalMentorshipState,
  mentorshipId,
  resolveGlossaryTerm,
  validateMentorshipInvariants,
} from '../glossary';

describe('mentorship vocabulary', () => {
  it('is versioned and covers every aggregate', () => {
    expect(MENTORSHIP_VOCABULARY_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    const covered = new Set(MENTORSHIP_GLOSSARY.map((entry) => entry.aggregate));
    for (const aggregate of MENTORSHIP_AGGREGATES) {
      expect(covered.has(aggregate)).toBe(true);
    }
  });

  it('has a unique alias for every canonical term', () => {
    expect(glossaryAliasesAreUnique()).toBe(true);
  });

  it('resolves a canonical term and an alias to the same entry', () => {
    expect(resolveGlossaryTerm('Mentor')?.aggregate).toBe('mentor');
    expect(resolveGlossaryTerm('tutor')?.term).toBe('Mentor');
    expect(resolveGlossaryTerm('  student ')?.aggregate).toBe('mentee');
    expect(resolveGlossaryTerm('not-a-term')).toBeUndefined();
  });

  it('names one owner per aggregate', () => {
    const owners = MENTORSHIP_OWNERSHIP.map((boundary) => boundary.aggregate);
    expect(new Set(owners).size).toBe(MENTORSHIP_AGGREGATES.length);
  });

  it('round-trips a stable identifier', () => {
    const id = mentorshipId('engagement', 'abc123');
    expect(id).toBe('eng_abc123');
    expect(isMentorshipId('engagement', id)).toBe(true);
    expect(isMentorshipId('engagement', 'mtr_abc123')).toBe(false);
  });

  it('refuses an empty identifier value', () => {
    expect(() => mentorshipId('session', '   ')).toThrow();
  });
});

describe('mentorship lifecycle', () => {
  it('accepts a listed transition and a same-state no-op', () => {
    expect(evaluateMentorshipTransition('session', 'scheduled', 'confirmed').ok).toBe(true);
    expect(evaluateMentorshipTransition('session', 'scheduled', 'scheduled').ok).toBe(true);
  });

  it('rejects an unlisted transition with a stable code', () => {
    const result = evaluateMentorshipTransition('session', 'scheduled', 'completed');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ILLEGAL_TRANSITION');
  });

  it('rejects an unknown state with a stable code', () => {
    const result = evaluateMentorshipTransition(
      'mentor',
      'applicant',
      'ghost' as never,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('UNKNOWN_STATE');
  });

  it('knows terminal states', () => {
    expect(isTerminalMentorshipState('payment', 'settled')).toBe(true);
    expect(isTerminalMentorshipState('payment', 'captured')).toBe(false);
  });

  it('has a fully legal happy path', () => {
    expect(MENTORSHIP_HAPPY_PATH.length).toBeGreaterThan(0);
    expect(happyPathIsValid()).toBe(true);
  });
});

describe('mentorship invariants', () => {
  it('allows a session on an accepted engagement', () => {
    const violations = validateMentorshipInvariants({
      engagementState: 'accepted',
      sessionMentorId: 'mentor-1',
      sessionMenteeId: 'mentee-1',
    });
    expect(violations).toEqual([]);
  });

  it('flags a session on a non-accepted engagement', () => {
    const violations = validateMentorshipInvariants({
      engagementState: 'proposed',
      sessionMentorId: 'mentor-1',
    });
    expect(violations.map((v) => v.id)).toContain('MENTOR-001-01');
  });

  it('flags a mentor acting as their own mentee', () => {
    const violations = validateMentorshipInvariants({
      sessionMentorId: 'same',
      sessionMenteeId: 'same',
    });
    expect(violations.map((v) => v.id)).toContain('MENTOR-001-02');
  });

  it('flags a settlement while a dispute is open', () => {
    const violations = validateMentorshipInvariants({ paymentState: 'settled', openDisputes: 1 });
    expect(violations.map((v) => v.id)).toContain('MENTOR-001-05');
  });

  it('flags a payment authorized before the engagement is accepted', () => {
    const violations = validateMentorshipInvariants({
      engagementState: 'active',
      paymentState: 'authorized',
    });
    expect(violations.map((v) => v.id)).toContain('MENTOR-001-03');
  });
});
