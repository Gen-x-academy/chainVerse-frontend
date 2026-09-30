/**
 * Scholarship mutation → cache invalidation matrix (issue #1227).
 *
 * The backend treats an award decision as one transaction that also commits a
 * reservation, a ledger entry, eligibility and a disbursement intent. The
 * browser has to converge on all of those, but the corresponding views are
 * driven by different queries. This module is the single place that says which
 * queries a given mutation invalidates, so the fan-out is reviewable as data
 * instead of being rediscovered per component.
 *
 * Two rules hold for every row:
 *
 * 1. **Never guess an id.** A mutation that does not know an award id
 *    invalidates the award *collection*; one that does invalidates the specific
 *    `detail`. Guessing produces a key that matches nothing and a view that
 *    silently stays stale.
 * 2. **Never widen to `all` unless the whole feature changed.** A full
 *    `keys.all` invalidation refetches every mounted query, so using it as a
 *    shortcut turns one decision into a burst of requests. The only rows that
 *    use it are ones that genuinely can alter any view.
 */

import type { QueryClient } from '@tanstack/react-query';
import type { ScholarshipQueryKey, ScholarshipQueryKeySet } from './queryKeys';

/**
 * Ids a mutation is known to have. Callers pass whatever the server returned;
 * anything omitted simply widens that row from `detail` to the collection.
 */
export type InvalidationContext = {
  awardId?: string;
  applicationId?: string;
  programId?: string;
  windowId?: string;
};

type MatrixRow = (
  keys: ScholarshipQueryKeySet,
  context: InvalidationContext,
) => ScholarshipQueryKey[];

/** Award detail plus the award collection, or just the collection. */
function awardTargets(
  keys: ScholarshipQueryKeySet,
  awardId?: string,
): ScholarshipQueryKey[] {
  return awardId
    ? [keys.awards.lists(), keys.awards.detail(awardId)]
    : [keys.awards.lists()];
}

/**
 * The matrix. Keys are mutation names in the same vocabulary as
 * `lib/server-identity.ts`'s `IdempotencyScope`, extended with the
 * application-, window- and payment-side transitions.
 */
export const SCHOLARSHIP_INVALIDATION_MATRIX = {
  // ── Applications ───────────────────────────────────────────────────────────
  'application.create': (keys) => [
    keys.applications.lists(),
    keys.drafts.lists(),
    keys.validation.all,
  ],
  'application.decide': (keys, { applicationId }) => [
    ...(applicationId
      ? [keys.applications.detail(applicationId)]
      : [keys.applications.lists()]),
    keys.applications.lists(),
    keys.rounds.lists(),
  ],

  // ── Withdrawals ────────────────────────────────────────────────────────────
  /**
   * Withdrawal releases round capacity, so the round and budget views move with
   * it, and a pending award can be cancelled as a consequence.
   */
  'application.withdraw': (keys, { applicationId }) => [
    ...(applicationId
      ? [keys.applications.detail(applicationId)]
      : [keys.applications.lists()]),
    keys.applications.lists(),
    keys.withdrawals.all,
    keys.awards.lists(),
    keys.budgets.all,
    keys.rounds.lists(),
  ],

  // ── Awards ─────────────────────────────────────────────────────────────────
  /**
   * Award creation is one backend transaction that also commits a reservation, a
   * ledger entry, eligibility and a disbursement intent, so all five views are
   * stale the moment it lands.
   */
  'award.create': (keys, { awardId }) => [
    ...awardTargets(keys, awardId),
    keys.awards.lists(),
    keys.applications.lists(),
    keys.rounds.lists(),
    keys.budgets.all,
    keys.disbursements.lists(),
  ],
  'award.accept': (keys, { awardId }) => [
    ...awardTargets(keys, awardId),
    ...(awardId ? [keys.agreements.detail(awardId)] : [keys.agreements.all]),
    keys.disbursements.lists(),
    ...(awardId ? [keys.schedules.detail(awardId)] : [keys.schedules.lists()]),
  ],
  'award.decline': (keys, { awardId }) => [
    ...awardTargets(keys, awardId),
    ...(awardId ? [keys.agreements.detail(awardId)] : [keys.agreements.all]),
    keys.schedules.lists(),
    keys.rounds.lists(),
    keys.budgets.all,
  ],
  /** Cancellation and termination both unwind the schedule and the reservation. */
  'award.cancel': (keys, { awardId }) => [
    ...awardTargets(keys, awardId),
    ...(awardId ? [keys.agreements.detail(awardId)] : [keys.agreements.all]),
    ...(awardId ? [keys.schedules.detail(awardId)] : [keys.schedules.lists()]),
    keys.disbursements.lists(),
    keys.budgets.all,
    keys.rounds.lists(),
  ],
  'award.terminate': (keys, { awardId }) => [
    ...awardTargets(keys, awardId),
    ...(awardId ? [keys.agreements.detail(awardId)] : [keys.agreements.all]),
    ...(awardId ? [keys.schedules.detail(awardId)] : [keys.schedules.lists()]),
    keys.disbursements.lists(),
    keys.budgets.all,
    keys.rounds.lists(),
  ],

  // ── Milestones ─────────────────────────────────────────────────────────────
  /** Verifying a milestone is what advances the schedule and releases an installment. */
  'milestone.verify': (keys, { awardId }) => [
    ...(awardId ? [keys.schedules.detail(awardId)] : [keys.schedules.lists()]),
    keys.schedules.lists(),
    keys.disbursements.lists(),
    ...awardTargets(keys, awardId),
  ],
  'milestone.schedule.create': (keys, { awardId }) => [
    ...(awardId ? [keys.schedules.detail(awardId)] : [keys.schedules.lists()]),
    keys.schedules.lists(),
    keys.disbursements.lists(),
  ],
  'milestone.schedule.amend': (keys, { awardId }) => [
    ...(awardId ? [keys.schedules.detail(awardId)] : [keys.schedules.lists()]),
    keys.schedules.lists(),
    keys.disbursements.lists(),
  ],

  // ── Payments ───────────────────────────────────────────────────────────────
  /**
   * A batch settles installments, so the payment queue, the disbursement view,
   * every affected schedule and the transaction log all move together.
   */
  'payment.batch.execute': (keys) => [
    keys.payments.all,
    keys.disbursements.lists(),
    keys.schedules.lists(),
    keys.transactions.all,
  ],

  // ── Windows ────────────────────────────────────────────────────────────────
  /**
   * A deadline change is grandfathered, so already-submitted applications stay
   * valid, but the open/closed window list and the affected round both change.
   */
  'window.create': (keys) => [keys.windows.all, keys.rounds.lists()],
  'window.update': (keys, { windowId }) => [
    keys.windows.all,
    ...(windowId ? [keys.windows.detail(windowId)] : []),
    keys.rounds.lists(),
    keys.applications.lists(),
  ],

  // ── Duplicates and scopes ──────────────────────────────────────────────────
  'duplicate.merge': (keys) => [keys.duplicates.all, keys.applications.lists()],
  'scope.update': (keys) => [keys.scopes.all, keys.applications.lists()],
} satisfies Record<string, MatrixRow>;

export type ScholarshipMutation = keyof typeof SCHOLARSHIP_INVALIDATION_MATRIX;

/**
 * Resolves the concrete key targets for a mutation, de-duplicated and in a
 * stable order so tests can assert the exact list.
 */
export function scholarshipInvalidationTargets(
  keys: ScholarshipQueryKeySet,
  mutation: ScholarshipMutation,
  context: InvalidationContext = {},
): ScholarshipQueryKey[] {
  const row = SCHOLARSHIP_INVALIDATION_MATRIX[mutation] as MatrixRow | undefined;
  if (!row) {
    throw new Error(`Unknown scholarship mutation: ${String(mutation)}`);
  }
  const seen = new Set<string>();
  const unique: ScholarshipQueryKey[] = [];
  for (const target of row(keys, context)) {
    const serialised = JSON.stringify(target);
    if (seen.has(serialised)) continue;
    seen.add(serialised);
    unique.push(target);
  }
  return unique;
}

/**
 * Invalidates every view a mutation affects, without reloading the page.
 *
 * Resolves once all refetches have settled so callers can await convergence
 * (for example before navigating to a detail view).
 */
export async function applyScholarshipInvalidation(
  queryClient: QueryClient,
  keys: ScholarshipQueryKeySet,
  mutation: ScholarshipMutation,
  context: InvalidationContext = {},
): Promise<ScholarshipQueryKey[]> {
  const targets = scholarshipInvalidationTargets(keys, mutation, context);
  await Promise.all(
    targets.map((queryKey) => queryClient.invalidateQueries({ queryKey })),
  );
  return targets;
}
