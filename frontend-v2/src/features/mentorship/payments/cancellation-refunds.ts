/** MENTOR-083: apply a snapshotted cancellation policy to calculate refunds, mentor compensation and platform fee treatment. */
export type CancelledBy = 'mentee' | 'mentor' | 'platform';

export interface CancellationTier {
  /** Minimum notice, in hours before the session, for this tier to apply. */
  minNoticeHours: number;
  /** Share of the paid amount refunded to the payer, in basis points (0-10000). */
  refundBps: number;
}

/** The policy that was in force when the session was booked; applied as a frozen snapshot. */
export interface CancellationPolicy {
  id: string;
  /** Tiers evaluated from the longest notice to the shortest. */
  tiers: CancellationTier[];
}

export interface RefundBreakdown {
  /** Total refunded to the payer, in minor units. */
  refundMinor: number;
  /** Amount paid on to the mentor, in minor units. */
  mentorCompensationMinor: number;
  /** Amount retained by the platform as its fee, in minor units. */
  platformFeeMinor: number;
  /** The refund share that was applied, in basis points. */
  appliedRefundBps: number;
  /** Human-readable, ordered explanation of how the figures were derived. */
  explanation: string[];
}

export interface CalculateCancellationInput {
  policy: CancellationPolicy;
  /** Total amount paid, in minor units. */
  amountMinor: number;
  /** Platform commission on the amount, in basis points (0-10000). */
  platformFeeBps: number;
  cancelledBy: CancelledBy;
  /** Notice given before the session, in hours. May be fractional. */
  noticeHours: number;
}

const BPS = 10_000;
export const FULL_REFUND_BPS = BPS;

const isValidBps = (bps: number) => Number.isInteger(bps) && bps >= 0 && bps <= BPS;

/** Validates a policy snapshot; throws on out-of-range tiers so a bad policy can never price a refund. */
export function validateCancellationPolicy(policy: CancellationPolicy): void {
  if (policy.tiers.length === 0) throw new Error('A cancellation policy needs at least one tier');
  for (const tier of policy.tiers) {
    if (!Number.isFinite(tier.minNoticeHours) || tier.minNoticeHours < 0) {
      throw new Error('A tier notice window must be a non-negative number of hours');
    }
    if (!isValidBps(tier.refundBps)) throw new Error('A tier refund must be between 0 and 10000 basis points');
  }
}

/**
 * Picks the refund share for the notice given. A mentor or platform cancellation always
 * refunds in full; otherwise the highest tier whose notice window has been met applies,
 * and notice shorter than every tier refunds nothing.
 */
export function resolveRefundBps(policy: CancellationPolicy, noticeHours: number, cancelledBy: CancelledBy): number {
  validateCancellationPolicy(policy);
  if (cancelledBy === 'mentor' || cancelledBy === 'platform') return FULL_REFUND_BPS;
  const eligible = policy.tiers
    .filter((tier) => noticeHours >= tier.minNoticeHours)
    .sort((a, b) => b.minNoticeHours - a.minNoticeHours)[0];
  return eligible ? eligible.refundBps : 0;
}

const applyBps = (amountMinor: number, bps: number): number => Math.round((amountMinor * bps) / BPS);

/**
 * Splits the paid amount into refund, mentor compensation and platform fee. The three
 * components always add back up to `amountMinor` exactly: the mentor receives whatever
 * is left after the refund and the platform's proportional fee.
 */
export function calculateCancellation(input: CalculateCancellationInput): RefundBreakdown {
  const { policy, amountMinor, platformFeeBps, cancelledBy, noticeHours } = input;
  if (!Number.isInteger(amountMinor) || amountMinor < 0) {
    throw new Error('Amount must be a non-negative integer in minor units');
  }
  if (!isValidBps(platformFeeBps)) throw new Error('Platform fee must be between 0 and 10000 basis points');

  const appliedRefundBps = resolveRefundBps(policy, noticeHours, cancelledBy);
  const refundMinor = applyBps(amountMinor, appliedRefundBps);
  const retainedMinor = amountMinor - refundMinor;
  const platformFeeMinor = applyBps(retainedMinor, platformFeeBps);
  const mentorCompensationMinor = retainedMinor - platformFeeMinor;

  const explanation = [
    cancelledBy === 'mentee'
      ? `${noticeHours}h notice on policy "${policy.id}" applies a ${appliedRefundBps / 100}% refund`
      : `Cancellation by ${cancelledBy} refunds the payer in full`,
    `Refund: ${amountMinor} x ${appliedRefundBps}/${BPS} = ${refundMinor} minor units`,
    `Retained before fee: ${amountMinor} - ${refundMinor} = ${retainedMinor} minor units`,
    `Platform fee: ${retainedMinor} x ${platformFeeBps}/${BPS} = ${platformFeeMinor} minor units`,
    `Mentor compensation: ${retainedMinor} - ${platformFeeMinor} = ${mentorCompensationMinor} minor units`,
  ];

  return {
    refundMinor,
    mentorCompensationMinor,
    platformFeeMinor,
    appliedRefundBps,
    explanation,
  };
}
