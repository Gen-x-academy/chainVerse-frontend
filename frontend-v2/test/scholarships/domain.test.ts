import { describe, expect, it } from 'vitest';
import {
  APPLICATION_TRANSITIONS,
  AWARD_TRANSITIONS,
  MILESTONE_TRANSITIONS,
  PAYMENT_TRANSITIONS,
  PROGRAM_TRANSITIONS,
  isTerminalState,
  transitionApplication,
  transitionAward,
  transitionMilestone,
  transitionPayment,
  transitionProgram,
  validateAwardAmount,
  validateMilestoneOrder,
  type ApplicationState,
  type AwardState,
  type MilestoneState,
  type PaymentState,
  type ProgramState,
  type ScholarshipDomainErrorCode,
} from '@/src/features/scholarships/domain';

const programCases: Array<[ProgramState, ProgramState]> = [
  ['draft', 'published'],
  ['published', 'paused'],
  ['paused', 'published'],
  ['published', 'closed'],
  ['paused', 'closed'],
  ['closed', 'archived'],
];

const applicationCases: Array<[ApplicationState, ApplicationState]> = [
  ['draft', 'submitted'],
  ['draft', 'withdrawn'],
  ['submitted', 'under-review'],
  ['submitted', 'withdrawn'],
  ['under-review', 'decided'],
];

const awardCases: Array<[AwardState, AwardState]> = [
  ['offered', 'accepted'],
  ['offered', 'declined'],
  ['offered', 'cancelled'],
  ['accepted', 'completed'],
  ['accepted', 'cancelled'],
];

const milestoneCases: Array<[MilestoneState, MilestoneState]> = [
  ['pending', 'evidence-submitted'],
  ['evidence-submitted', 'verified'],
  ['evidence-submitted', 'rejected'],
  ['rejected', 'evidence-submitted'],
  ['verified', 'paid'],
];

const paymentCases: Array<[PaymentState, PaymentState]> = [
  ['intent', 'submitted'],
  ['submitted', 'confirmed'],
  ['submitted', 'failed'],
  ['failed', 'submitted'],
  ['confirmed', 'refunded'],
];

describe('scholarship domain state machines (#1168)', () => {
  it.each(programCases)('program %s -> %s is legal', (from, to) => {
    expect(transitionProgram(from, to).ok).toBe(true);
  });

  it.each(applicationCases)('application %s -> %s is legal', (from, to) => {
    expect(transitionApplication(from, to).ok).toBe(true);
  });

  it.each(awardCases)('award %s -> %s is legal', (from, to) => {
    expect(transitionAward(from, to).ok).toBe(true);
  });

  it.each(milestoneCases)('milestone %s -> %s is legal', (from, to) => {
    expect(transitionMilestone(from, to).ok).toBe(true);
  });

  it.each(paymentCases)('payment %s -> %s is legal', (from, to) => {
    expect(transitionPayment(from, to).ok).toBe(true);
  });

  it('accepts every transition listed in the tables', () => {
    for (const [from, targets] of Object.entries(PROGRAM_TRANSITIONS)) {
      for (const to of targets as ProgramState[]) {
        expect(transitionProgram(from as ProgramState, to).ok).toBe(true);
      }
    }
    for (const [from, targets] of Object.entries(AWARD_TRANSITIONS)) {
      for (const to of targets as AwardState[]) {
        expect(transitionAward(from as AwardState, to).ok).toBe(true);
      }
    }
    for (const [from, targets] of Object.entries(MILESTONE_TRANSITIONS)) {
      for (const to of targets as MilestoneState[]) {
        expect(transitionMilestone(from as MilestoneState, to).ok).toBe(true);
      }
    }
    for (const [from, targets] of Object.entries(PAYMENT_TRANSITIONS)) {
      for (const to of targets as PaymentState[]) {
        expect(transitionPayment(from as PaymentState, to).ok).toBe(true);
      }
    }
    for (const [from, targets] of Object.entries(APPLICATION_TRANSITIONS)) {
      for (const to of targets as ApplicationState[]) {
        expect(transitionApplication(from as ApplicationState, to).ok).toBe(true);
      }
    }
  });

  it('treats re-entering the same state as a no-op', () => {
    expect(transitionProgram('draft', 'draft')).toEqual({ ok: true, state: 'draft' });
    expect(transitionPayment('failed', 'failed')).toEqual({ ok: true, state: 'failed' });
  });

  it('returns a typed error for every illegal transition', () => {
    const results = [
      transitionProgram('archived', 'published'),
      transitionApplication('decided', 'draft'),
      transitionAward('completed', 'accepted'),
      transitionMilestone('paid', 'pending'),
      transitionPayment('refunded', 'submitted'),
    ];

    for (const result of results) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe('ILLEGAL_TRANSITION');
        expect(result.error.message.length).toBeGreaterThan(0);
      }
    }
  });

  it('marks terminal states correctly', () => {
    expect(isTerminalState(PROGRAM_TRANSITIONS, 'archived')).toBe(true);
    expect(isTerminalState(APPLICATION_TRANSITIONS, 'decided')).toBe(true);
    expect(isTerminalState(AWARD_TRANSITIONS, 'completed')).toBe(true);
    expect(isTerminalState(MILESTONE_TRANSITIONS, 'paid')).toBe(true);
    expect(isTerminalState(PAYMENT_TRANSITIONS, 'refunded')).toBe(true);
    expect(isTerminalState(PAYMENT_TRANSITIONS, 'failed')).toBe(false);
  });
});

describe('scholarship domain boundaries (#1168)', () => {
  const amountCases: Array<[number, ScholarshipDomainErrorCode | null]> = [
    [-1, 'AMOUNT_BELOW_MINIMUM'],
    [0, 'AMOUNT_BELOW_MINIMUM'],
    [1, null],
    [500, null],
    [100_000, null],
    [100_001, 'AMOUNT_ABOVE_MAXIMUM'],
  ];

  it.each(amountCases)('validates award amount %i', (amount, expectedCode) => {
    const errors = validateAwardAmount(amount);
    expect(errors[0]?.code ?? null).toBe(expectedCode);
  });

  it('rejects non-finite award amounts', () => {
    expect(validateAwardAmount(Number.NaN)[0].code).toBe('AMOUNT_BELOW_MINIMUM');
  });

  it('rejects duplicate milestone order values', () => {
    expect(validateMilestoneOrder([{ id: 'a', order: 1 }, { id: 'b', order: 2 }])).toEqual([]);

    const errors = validateMilestoneOrder([{ id: 'a', order: 1 }, { id: 'b', order: 1 }]);
    expect(errors[0].code).toBe('MILESTONE_ORDER_VIOLATION');
  });
});
