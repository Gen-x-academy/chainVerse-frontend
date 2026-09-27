/**
 * Fee schedule versioning, basis-point quoting, and fee revenue accounting
 * (issue #1128).
 *
 * All arithmetic is integer arithmetic on minor units — no floats, no
 * currency conversion. The invariant `netRecipientCents + totalFeeCents ===
 * grossCents` holds by construction for every quote.
 */

import { apiClient } from '@/src/lib/api-client';
import { canManageFees, BASIS_POINTS, type FeeComponent, type FeeLedgerAccount, type FeeQuote, type FeeScheduleVersion, type RoundingMode } from './types';

const FEES_PATH = '/scholarships/fees';

/**
 * Rounds `numerator / denominator` to an integer using the requested mode, with
 * exact integer arithmetic (no floating point, so there is no drift at
 * half-even boundaries).
 *
 * - `half-up`   — ties round away from zero.
 * - `down`      — ties and everything below round toward zero.
 * - `half-even` — ties round to the nearest even integer (banker's rounding),
 *                which keeps a long run of equal fees from biasing upward.
 */
export function divideWithRounding(numerator: number, denominator: number, mode: RoundingMode): number {
  if (denominator === 0) {
    throw new Error('Cannot divide by zero when rounding a fee.');
  }
  if (numerator < 0) {
    return -divideWithRounding(-numerator, denominator, mode);
  }

  const quotient = Math.floor(numerator / denominator);
  const remainder = numerator - quotient * denominator;
  const doubled = remainder * 2;

  if (doubled < denominator) return quotient;
  if (doubled > denominator) return quotient + 1;

  // Exactly half: `down` truncates, `half-up` goes up, `half-even` picks even.
  if (mode === 'down') return quotient;
  if (mode === 'half-up') return quotient + 1;
  return quotient % 2 === 0 ? quotient : quotient + 1;
}

/** Applies a basis-point rate to a minor-unit amount, rounding per `mode`. */
export function applyBasisPoints(baseCents: number, rateBps: number, mode: RoundingMode): number {
  return divideWithRounding(baseCents * rateBps, BASIS_POINTS, mode);
}

/**
 * The active schedule at `at`: the active version with the latest
 * `effectiveFrom` that is already in force. `null` when none applies.
 */
export function activeSchedule(versions: FeeScheduleVersion[], at: string): FeeScheduleVersion | null {
  const atMs = Date.parse(at);
  const candidates = versions
    .filter((version) => version.status === 'active')
    .filter((version) => Date.parse(version.effectiveFrom) <= atMs)
    .sort((a, b) => Date.parse(b.effectiveFrom) - Date.parse(a.effectiveFrom));

  return candidates[0] ?? null;
}

function componentFee(
  component: FeeComponent,
  base: { grossCents: number; netCents: number; platformFeeCents: number },
  rounding: RoundingMode
): number {
  switch (component.basis) {
    case 'gross-amount':
      return applyBasisPoints(base.grossCents, component.rateBps, rounding);
    case 'net-amount':
      // The fee is a share of what the recipient receives, so it is derived
      // from the remaining amount rather than the gross.
      return base.netCents - applyBasisPoints(base.netCents, BASIS_POINTS - component.rateBps, rounding);
    case 'percentage-of-platform-fee':
      return applyBasisPoints(base.platformFeeCents, component.rateBps, rounding);
    case 'flat-per-award':
    default:
      return 0;
  }
}

/**
 * Quotes the fees on a gross amount.
 *
 * Platform components are evaluated first so that a `percentage-of-platform-fee`
 * component always has a platform base to work from. The net recipient amount
 * is derived by subtraction, which is what guarantees the balance invariant:
 * recipients are never quietly short-changed to make a fee line fit.
 */
export function quoteFees(
  grossCents: number,
  schedule: FeeScheduleVersion,
  rounding: RoundingMode,
  quotedAt: string
): FeeQuote {
  const components = schedule.components;
  const currency = components[0]?.currency ?? 'USD';

  let platformFeeCents = 0;
  let networkFeeCents = 0;

  const ordered = [
    ...components.filter((component) => component.kind === 'platform'),
    ...components.filter((component) => component.kind === 'network'),
  ];

  for (const component of ordered) {
    const base = { grossCents, netCents: grossCents - platformFeeCents - networkFeeCents, platformFeeCents };
    const fee = componentFee(component, base, rounding) + component.flatCents;

    if (component.kind === 'platform') platformFeeCents += fee;
    else networkFeeCents += fee;
  }

  const totalFeeCents = platformFeeCents + networkFeeCents;

  return {
    scheduleVersion: schedule.version,
    grossCents,
    platformFeeCents,
    networkFeeCents,
    totalFeeCents,
    netRecipientCents: grossCents - totalFeeCents,
    currency,
    rounding,
    quotedAt,
  };
}

/** The quote invariant: net recipient plus total fees equals the gross amount. */
export function assertQuoteBalanced(quote: FeeQuote): boolean {
  return quote.netRecipientCents + quote.totalFeeCents === quote.grossCents;
}

/**
 * Sums quotes into a single fee ledger account. Fee revenue is accounted
 * separately from scholarship disbursement, and quotes in different currencies
 * are never combined.
 */
export function splitFeeRevenue(quotes: FeeQuote[]): FeeLedgerAccount {
  if (quotes.length === 0) {
    return { platformRevenueCents: 0, networkCostCents: 0, currency: '' };
  }

  const currencies = new Set(quotes.map((quote) => quote.currency));
  if (currencies.size > 1) {
    throw new Error(`Fee revenue cannot mix currencies: ${[...currencies].sort().join(', ')}.`);
  }

  return {
    platformRevenueCents: quotes.reduce((total, quote) => total + quote.platformFeeCents, 0),
    networkCostCents: quotes.reduce((total, quote) => total + quote.networkFeeCents, 0),
    currency: quotes[0].currency,
  };
}

/** The next patch version after the highest one on file. */
export function nextScheduleVersion(versions: FeeScheduleVersion[]): string {
  let major = 0;
  let minor = 0;
  let patch = -1;
  let found = false;

  for (const version of versions) {
    const match = /^v(\d+)\.(\d+)\.(\d+)$/.exec(version.version);
    if (!match) continue;
    const candidate = {
      major: Number(match[1]),
      minor: Number(match[2]),
      patch: Number(match[3]),
    };
    const isHigher =
      !found ||
      candidate.major > major ||
      (candidate.major === major && candidate.minor > minor) ||
      (candidate.major === major && candidate.minor === minor && candidate.patch > patch);
    if (isHigher) {
      found = true;
      major = candidate.major;
      minor = candidate.minor;
      patch = candidate.patch;
    }
  }

  if (!found) return 'v1.0.0';

  let nextPatch = patch + 1;
  if (nextPatch > 999) {
    nextPatch = 0;
    minor += 1;
  }
  if (minor > 999) {
    minor = 0;
    major += 1;
  }

  return `v${major}.${minor}.${nextPatch}`;
}

/**
 * Activates `newVersion` and supersedes whatever was active. Returns a new
 * array — earlier versions are never mutated, and only one version stays
 * active. History is a log of versions, not a rewrite of them.
 */
export function supersedeSchedule(
  versions: FeeScheduleVersion[],
  newVersion: FeeScheduleVersion
): FeeScheduleVersion[] {
  const replaced = versions.filter((version) => version.version !== newVersion.version);
  return [
    { ...newVersion, status: 'active' },
    ...replaced.map((version) => (version.status === 'active' ? { ...version, status: 'superseded' as const } : version)),
  ];
}

/** Creates an inactive draft version from a template. */
export function createDraftVersion(
  versions: FeeScheduleVersion[],
  components: FeeComponent[],
  createdBy: string,
  createdAt: string,
  effectiveFrom: string
): FeeScheduleVersion {
  return {
    version: nextScheduleVersion(versions),
    effectiveFrom,
    components: components.map((component) => ({ ...component })),
    createdBy,
    createdAt,
    status: 'draft',
  };
}

export type QuoteFeesRequest = {
  grossCents: number;
  currency: string;
  scheduleVersion: string;
  rounding: RoundingMode;
  idempotencyKey: string;
};

export const feeService = {
  listVersions: (): Promise<FeeScheduleVersion[]> =>
    apiClient.get<FeeScheduleVersion[]>(`${FEES_PATH}/schedules`),

  getActiveVersion: (at?: string): Promise<FeeScheduleVersion> => {
    const query = at ? `?at=${encodeURIComponent(at)}` : '';
    return apiClient.get<FeeScheduleVersion>(`${FEES_PATH}/schedules/active${query}`);
  },

  createDraft: (payload: {
    version: string;
    effectiveFrom: string;
    components: FeeComponent[];
    createdBy: string;
  }): Promise<FeeScheduleVersion> => apiClient.post<FeeScheduleVersion>(`${FEES_PATH}/schedules`, payload),

  activate: (version: string, body: { activatedBy: string; expectedStatus: 'draft' }): Promise<FeeScheduleVersion> =>
    apiClient.post<FeeScheduleVersion>(
      `${FEES_PATH}/schedules/${encodeURIComponent(version)}/activation`,
      body
    ),

  quote: (payload: QuoteFeesRequest): Promise<FeeQuote> => apiClient.post<FeeQuote>(`${FEES_PATH}/quotes`, payload),

  listQuotes: (scheduleVersion?: string): Promise<FeeQuote[]> => {
    const query = scheduleVersion ? `?scheduleVersion=${encodeURIComponent(scheduleVersion)}` : '';
    return apiClient.get<FeeQuote[]>(`${FEES_PATH}/quotes${query}`);
  },

  getFeeLedger: (currency?: string): Promise<FeeLedgerAccount> => {
    const query = currency ? `?currency=${encodeURIComponent(currency)}` : '';
    return apiClient.get<FeeLedgerAccount>(`${FEES_PATH}/revenue${query}`);
  },
};

export { canManageFees };
