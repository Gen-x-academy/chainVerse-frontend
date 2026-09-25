/**
 * Scholarship domain state machines and boundary rules (issue #1168).
 *
 * Programs, applications, awards, milestones, and payments each move through a
 * small, explicit state machine. `evaluateTransition` returns either the new
 * state or a typed error, so the UI and the tests share one source of truth for
 * every legal transition, boundary value, and typed error.
 */

export type ScholarshipDomainErrorCode =
  | 'ILLEGAL_TRANSITION'
  | 'AMOUNT_BELOW_MINIMUM'
  | 'AMOUNT_ABOVE_MAXIMUM'
  | 'MILESTONE_ORDER_VIOLATION';

export type ScholarshipDomainError = {
  code: ScholarshipDomainErrorCode;
  entity: string;
  message: string;
  from?: string;
  to?: string;
};

export type TransitionResult<TState extends string> =
  | { ok: true; state: TState }
  | { ok: false; error: ScholarshipDomainError };

export type TransitionTable<TState extends string> = Record<TState, readonly TState[]>;

/** Re-entering the same state is a harmless no-op; anything else must be listed. */
export function evaluateTransition<TState extends string>(
  entity: string,
  table: TransitionTable<TState>,
  from: TState,
  to: TState
): TransitionResult<TState> {
  if (from === to) return { ok: true, state: to };
  if ((table[from] ?? []).includes(to)) return { ok: true, state: to };

  return {
    ok: false,
    error: {
      code: 'ILLEGAL_TRANSITION',
      entity,
      from,
      to,
      message: `Cannot move ${entity} from "${from}" to "${to}".`,
    },
  };
}

export function isTerminalState<TState extends string>(
  table: TransitionTable<TState>,
  state: TState
): boolean {
  return (table[state] ?? []).length === 0;
}

export type ProgramState = 'draft' | 'published' | 'paused' | 'closed' | 'archived';

export const PROGRAM_TRANSITIONS: TransitionTable<ProgramState> = {
  draft: ['published'],
  published: ['paused', 'closed'],
  paused: ['published', 'closed'],
  closed: ['archived'],
  archived: [],
};

export function transitionProgram(from: ProgramState, to: ProgramState): TransitionResult<ProgramState> {
  return evaluateTransition('program', PROGRAM_TRANSITIONS, from, to);
}

export type ApplicationState = 'draft' | 'submitted' | 'under-review' | 'withdrawn' | 'decided';

export const APPLICATION_TRANSITIONS: TransitionTable<ApplicationState> = {
  draft: ['submitted', 'withdrawn'],
  submitted: ['under-review', 'withdrawn'],
  'under-review': ['decided'],
  withdrawn: [],
  decided: [],
};

export function transitionApplication(
  from: ApplicationState,
  to: ApplicationState
): TransitionResult<ApplicationState> {
  return evaluateTransition('application', APPLICATION_TRANSITIONS, from, to);
}

export type AwardState = 'offered' | 'accepted' | 'declined' | 'cancelled' | 'completed';

export const AWARD_TRANSITIONS: TransitionTable<AwardState> = {
  offered: ['accepted', 'declined', 'cancelled'],
  accepted: ['completed', 'cancelled'],
  declined: [],
  cancelled: [],
  completed: [],
};

export function transitionAward(from: AwardState, to: AwardState): TransitionResult<AwardState> {
  return evaluateTransition('award', AWARD_TRANSITIONS, from, to);
}

export type MilestoneState = 'pending' | 'evidence-submitted' | 'verified' | 'rejected' | 'paid';

export const MILESTONE_TRANSITIONS: TransitionTable<MilestoneState> = {
  pending: ['evidence-submitted'],
  'evidence-submitted': ['verified', 'rejected'],
  rejected: ['evidence-submitted'],
  verified: ['paid'],
  paid: [],
};

export function transitionMilestone(
  from: MilestoneState,
  to: MilestoneState
): TransitionResult<MilestoneState> {
  return evaluateTransition('milestone', MILESTONE_TRANSITIONS, from, to);
}

export type PaymentState = 'intent' | 'submitted' | 'confirmed' | 'failed' | 'refunded';

export const PAYMENT_TRANSITIONS: TransitionTable<PaymentState> = {
  intent: ['submitted'],
  submitted: ['confirmed', 'failed'],
  confirmed: ['refunded'],
  failed: ['submitted'],
  refunded: [],
};

export function transitionPayment(from: PaymentState, to: PaymentState): TransitionResult<PaymentState> {
  return evaluateTransition('payment', PAYMENT_TRANSITIONS, from, to);
}

export const MIN_AWARD_AMOUNT = 1;
export const MAX_AWARD_AMOUNT = 100_000;

export function validateAwardAmount(amount: number): ScholarshipDomainError[] {
  const errors: ScholarshipDomainError[] = [];

  if (!Number.isFinite(amount)) {
    errors.push({
      code: 'AMOUNT_BELOW_MINIMUM',
      entity: 'award',
      message: 'Award amount must be a finite number.',
    });
    return errors;
  }

  if (amount < MIN_AWARD_AMOUNT) {
    errors.push({
      code: 'AMOUNT_BELOW_MINIMUM',
      entity: 'award',
      message: `Award amount must be at least ${MIN_AWARD_AMOUNT}.`,
    });
  }
  if (amount > MAX_AWARD_AMOUNT) {
    errors.push({
      code: 'AMOUNT_ABOVE_MAXIMUM',
      entity: 'award',
      message: `Award amount cannot exceed ${MAX_AWARD_AMOUNT}.`,
    });
  }

  return errors;
}

export function validateMilestoneOrder(
  milestones: Array<{ id: string; order: number }>
): ScholarshipDomainError[] {
  const seen = new Set<number>();
  for (const milestone of milestones) {
    if (seen.has(milestone.order)) {
      return [
        {
          code: 'MILESTONE_ORDER_VIOLATION',
          entity: 'milestone',
          message: `Milestone order values must be unique (duplicate: ${milestone.order}).`,
        },
      ];
    }
    seen.add(milestone.order);
  }
  return [];
}
