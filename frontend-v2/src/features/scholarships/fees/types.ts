/**
 * Platform and network fee schedules, quotes, and fee revenue (issue #1128).
 *
 * Money is integer minor units with an explicit `currency` on every component
 * and every quote. Fee schedules are versioned and only one version is active
 * at a time. A quote always satisfies `netRecipientCents + totalFeeCents ===
 * grossCents`, so a recipient is never silently reduced and the arithmetic is
 * always auditable.
 */

export type FeeBasis =
  | 'gross-amount'
  | 'net-amount'
  | 'flat-per-award'
  | 'percentage-of-platform-fee';

export type FeeComponentKind = 'platform' | 'network';

export type FeeComponent = {
  id: string;
  name: string;
  kind: FeeComponentKind;
  basis: FeeBasis;
  /** Rate in basis points: 250 bps = 2.5%. */
  rateBps: number;
  flatCents: number;
  currency: string;
};

export type FeeScheduleStatus = 'draft' | 'active' | 'superseded';

export type FeeScheduleVersion = {
  version: string;
  effectiveFrom: string;
  components: FeeComponent[];
  createdBy: string;
  createdAt: string;
  status: FeeScheduleStatus;
};

export type RoundingMode = 'half-even' | 'half-up' | 'down';

export type FeeQuote = {
  scheduleVersion: string;
  grossCents: number;
  platformFeeCents: number;
  networkFeeCents: number;
  totalFeeCents: number;
  netRecipientCents: number;
  currency: string;
  rounding: RoundingMode;
  quotedAt: string;
};

export type FeeLedgerAccount = {
  platformRevenueCents: number;
  networkCostCents: number;
  currency: string;
};

/** Basis points in a whole: 10 000 bps = 100%. */
export const BASIS_POINTS = 10_000;

export const ROUNDING_MODES: readonly RoundingMode[] = ['half-even', 'half-up', 'down'];

/** Roles permitted to manage fee schedules. */
export const FEE_ROLES: readonly string[] = ['finance', 'administrator'];

export function canManageFees(role?: string): boolean {
  if (!role) return false;
  return FEE_ROLES.includes(role);
}
