/**
 * Scholarship state machines
 *
 * Four pure, side-effect-free transition functions:
 *   applyApplicationEvent  — drives Application lifecycle
 *   applyAwardEvent        — drives Award lifecycle
 *   applyMilestoneEvent    — drives Milestone lifecycle
 *   applyPaymentEvent      — drives Payment lifecycle
 *
 * Each function returns the NEXT state or throws a ScholarshipTransitionError
 * for illegal transitions.  All transitions are deterministic and reproducible
 * from a fixed seed (see property tests).
 *
 * Ownership  : Frontend Platform team
 * Privacy    : No PII stored in state shapes — IDs only.
 * Migration  : Adding a new state requires updating VALID_TRANSITIONS and
 *              re-running the property-test suite before merging.
 * Ops impact : Pure functions — zero network, zero side-effects.
 */

import type {
  ApplicationStatus,
  AwardStatus,
  MilestoneStatus,
  PaymentStatus,
  ApplicationEvent,
  AwardEvent,
  MilestoneEvent,
  PaymentEvent,
} from '@/types/scholarship';

// ─── Custom error ─────────────────────────────────────────────────────────────

export class ScholarshipTransitionError extends Error {
  constructor(
    public readonly from: string,
    public readonly event: string,
    message?: string,
  ) {
    super(
      message ??
        `Illegal transition: cannot apply "${event}" when state is "${from}"`,
    );
    this.name = 'ScholarshipTransitionError';
  }
}

// ─── Application machine ──────────────────────────────────────────────────────

/**
 * All valid (from → event → to) triples for the Application machine.
 *
 * The map key is `"${from}:${event.type}"`.
 */
const APPLICATION_TRANSITIONS: Record<string, ApplicationStatus> = {
  // From DRAFT
  'DRAFT:SAVE_DRAFT': 'DRAFT',
  'DRAFT:SUBMIT': 'SUBMITTED',
  'DRAFT:WITHDRAW': 'WITHDRAWN',

  // From SUBMITTED
  'SUBMITTED:BEGIN_REVIEW': 'UNDER_REVIEW',
  'SUBMITTED:WITHDRAW': 'WITHDRAWN',

  // From UNDER_REVIEW
  'UNDER_REVIEW:APPROVE': 'APPROVED',
  'UNDER_REVIEW:REJECT': 'REJECTED',
  'UNDER_REVIEW:WAITLIST': 'WAITLISTED',

  // From WAITLISTED
  'WAITLISTED:PROMOTE_FROM_WAITLIST': 'APPROVED',
  'WAITLISTED:REJECT': 'REJECTED',
  'WAITLISTED:WITHDRAW': 'WITHDRAWN',

  // From APPROVED
  'APPROVED:AWARD': 'AWARDED',
  'APPROVED:WITHDRAW': 'WITHDRAWN',

  // Terminal states — no outgoing transitions
  // REJECTED, AWARDED, WITHDRAWN are sinks
};

export function applyApplicationEvent(
  current: ApplicationStatus,
  event: ApplicationEvent,
): ApplicationStatus {
  const key = `${current}:${event.type}`;
  const next = APPLICATION_TRANSITIONS[key];
  if (next === undefined) {
    throw new ScholarshipTransitionError(current, event.type);
  }
  return next;
}

/** Returns every event type that is legal from the given state. */
export function legalApplicationEvents(
  state: ApplicationStatus,
): ApplicationEvent['type'][] {
  return Object.keys(APPLICATION_TRANSITIONS)
    .filter((k) => k.startsWith(`${state}:`))
    .map((k) => k.split(':')[1] as ApplicationEvent['type']);
}

/** Returns every event type that is NOT legal from the given state. */
export function illegalApplicationEvents(
  state: ApplicationStatus,
): ApplicationEvent['type'][] {
  const all: ApplicationEvent['type'][] = [
    'SAVE_DRAFT',
    'SUBMIT',
    'BEGIN_REVIEW',
    'APPROVE',
    'REJECT',
    'WAITLIST',
    'PROMOTE_FROM_WAITLIST',
    'AWARD',
    'WITHDRAW',
  ];
  const legal = new Set(legalApplicationEvents(state));
  return all.filter((e) => !legal.has(e));
}

// ─── Award machine ────────────────────────────────────────────────────────────

const AWARD_TRANSITIONS: Record<string, AwardStatus> = {
  // From PENDING_ACCEPTANCE
  'PENDING_ACCEPTANCE:ACCEPT': 'ACCEPTED',
  'PENDING_ACCEPTANCE:DECLINE': 'DECLINED',

  // From ACCEPTED
  'ACCEPTED:ACTIVATE': 'ACTIVE',
  'ACCEPTED:REVOKE': 'REVOKED',

  // From ACTIVE
  'ACTIVE:COMPLETE': 'COMPLETED',
  'ACTIVE:REVOKE': 'REVOKED',

  // Terminal: DECLINED, COMPLETED, REVOKED
};

export function applyAwardEvent(
  current: AwardStatus,
  event: AwardEvent,
): AwardStatus {
  const key = `${current}:${event.type}`;
  const next = AWARD_TRANSITIONS[key];
  if (next === undefined) {
    throw new ScholarshipTransitionError(current, event.type);
  }
  return next;
}

export function legalAwardEvents(state: AwardStatus): AwardEvent['type'][] {
  return Object.keys(AWARD_TRANSITIONS)
    .filter((k) => k.startsWith(`${state}:`))
    .map((k) => k.split(':')[1] as AwardEvent['type']);
}

export function illegalAwardEvents(state: AwardStatus): AwardEvent['type'][] {
  const all: AwardEvent['type'][] = [
    'ACCEPT',
    'DECLINE',
    'ACTIVATE',
    'COMPLETE',
    'REVOKE',
  ];
  const legal = new Set(legalAwardEvents(state));
  return all.filter((e) => !legal.has(e));
}

// ─── Milestone machine ────────────────────────────────────────────────────────

const MILESTONE_TRANSITIONS: Record<string, MilestoneStatus> = {
  'LOCKED:UNLOCK': 'IN_PROGRESS',
  'IN_PROGRESS:START': 'IN_PROGRESS', // idempotent
  'IN_PROGRESS:SUBMIT_PROOF': 'SUBMITTED',
  'SUBMITTED:VERIFY': 'VERIFIED',
  'SUBMITTED:FAIL': 'FAILED',
  'FAILED:START': 'IN_PROGRESS', // allow retry

  // Terminal: VERIFIED
};

export function applyMilestoneEvent(
  current: MilestoneStatus,
  event: MilestoneEvent,
): MilestoneStatus {
  const key = `${current}:${event.type}`;
  const next = MILESTONE_TRANSITIONS[key];
  if (next === undefined) {
    throw new ScholarshipTransitionError(current, event.type);
  }
  return next;
}

export function legalMilestoneEvents(
  state: MilestoneStatus,
): MilestoneEvent['type'][] {
  return Object.keys(MILESTONE_TRANSITIONS)
    .filter((k) => k.startsWith(`${state}:`))
    .map((k) => k.split(':')[1] as MilestoneEvent['type']);
}

export function illegalMilestoneEvents(
  state: MilestoneStatus,
): MilestoneEvent['type'][] {
  const all: MilestoneEvent['type'][] = [
    'UNLOCK',
    'START',
    'SUBMIT_PROOF',
    'VERIFY',
    'FAIL',
  ];
  const legal = new Set(legalMilestoneEvents(state));
  return all.filter((e) => !legal.has(e));
}

// ─── Payment machine ──────────────────────────────────────────────────────────

const PAYMENT_TRANSITIONS: Record<string, PaymentStatus> = {
  'PENDING:INITIATE': 'PENDING', // idempotent guard
  'PENDING:PROCESS': 'PROCESSING',
  'PROCESSING:CONFIRM': 'COMPLETED',
  'PROCESSING:FAIL': 'FAILED',
  'FAILED:PROCESS': 'PROCESSING', // retry
  'COMPLETED:REFUND': 'REFUNDED',

  // Terminal: REFUNDED
};

export function applyPaymentEvent(
  current: PaymentStatus,
  event: PaymentEvent,
): PaymentStatus {
  const key = `${current}:${event.type}`;
  const next = PAYMENT_TRANSITIONS[key];
  if (next === undefined) {
    throw new ScholarshipTransitionError(current, event.type);
  }
  return next;
}

export function legalPaymentEvents(state: PaymentStatus): PaymentEvent['type'][] {
  return Object.keys(PAYMENT_TRANSITIONS)
    .filter((k) => k.startsWith(`${state}:`))
    .map((k) => k.split(':')[1] as PaymentEvent['type']);
}

export function illegalPaymentEvents(
  state: PaymentStatus,
): PaymentEvent['type'][] {
  const all: PaymentEvent['type'][] = [
    'INITIATE',
    'PROCESS',
    'CONFIRM',
    'FAIL',
    'REFUND',
  ];
  const legal = new Set(legalPaymentEvents(state));
  return all.filter((e) => !legal.has(e));
}

// ─── Budget conservation helper ───────────────────────────────────────────────

/**
 * Verifies that the sum of all completed + pending payments never exceeds
 * the total budget of a scholarship.  All values are treated as BigInt to
 * avoid floating-point drift.
 *
 * Returns true when the invariant holds.
 */
export function checkBudgetConservation(params: {
  totalBudget: string;
  payments: Array<{ amount: string; status: PaymentStatus }>;
}): boolean {
  const budget = BigInt(params.totalBudget);
  const committed = params.payments
    .filter((p) => p.status !== 'FAILED' && p.status !== 'REFUNDED')
    .reduce((acc, p) => acc + BigInt(p.amount), 0n);
  return committed <= budget;
}

/**
 * Verifies that the sum of milestone payouts exactly equals the award total.
 */
export function checkMilestonePayoutConservation(params: {
  totalAmount: string;
  milestones: Array<{ payoutAmount: string }>;
}): boolean {
  const total = BigInt(params.totalAmount);
  const sum = params.milestones.reduce(
    (acc, m) => acc + BigInt(m.payoutAmount),
    0n,
  );
  return sum === total;
}
