/** MENTOR-077: configure versioned mentorship pricing models (free, per-session, milestone, subscription, sponsored). */
export type PricingMode = 'free' | 'per-session' | 'milestone' | 'subscription' | 'sponsored';

export type PricingPayer = 'mentee' | 'sponsor' | 'program';
export type PricingRecipient = 'mentor' | 'platform';

export interface PricingModel {
  id: string;
  mode: PricingMode;
  /** ISO-4217 currency code; empty for sponsored or free models that carry no amount. */
  currency: string;
  /** Amount in minor units (e.g. cents) to avoid floating-point drift. */
  amountMinor: number;
  payer: PricingPayer;
  recipient: PricingRecipient;
  /** Platform commission in basis points (0-10000). */
  platformFeeBps: number;
  /** Monotonic version; each revision produces a new immutable version. */
  version: number;
  /** ISO timestamp when this version becomes effective. */
  effectiveFrom: string;
  createdAt: string;
  createdById: string;
}

export interface DefinePricingModelInput {
  id: string;
  mode: PricingMode;
  currency?: string;
  amountMinor?: number;
  payer?: PricingPayer;
  recipient?: PricingRecipient;
  platformFeeBps?: number;
  effectiveFrom?: string;
  createdById: string;
}

export const MAX_PLATFORM_FEE_BPS = 10_000;
const CURRENCY_RE = /^[A-Z]{3}$/;

const isCurrency = (code: string) => CURRENCY_RE.test(code);
const isCounted = (n: number) => Number.isInteger(n) && n >= 0;

/** Modes that move money must name a currency and a positive amount. */
const isPaid = (mode: PricingMode) => mode === 'per-session' || mode === 'milestone' || mode === 'subscription';

function assertAmounts(mode: PricingMode, currency: string, amountMinor: number, feeBps: number): void {
  if (!isCounted(amountMinor)) throw new Error('Amount must be a non-negative integer in minor units');
  if (!isCounted(feeBps) || feeBps > MAX_PLATFORM_FEE_BPS) {
    throw new Error(`Platform fee must be between 0 and ${MAX_PLATFORM_FEE_BPS} basis points`);
  }
  if (mode === 'free') {
    if (amountMinor !== 0) throw new Error('A free pricing model cannot carry an amount');
    return;
  }
  if (mode === 'sponsored') {
    if (!currency || !isCurrency(currency)) throw new Error('A sponsored model needs a valid currency');
    return;
  }
  if (!isPaid(mode)) throw new Error('Unknown pricing mode');
  if (!isCurrency(currency)) throw new Error('A paid pricing model needs a 3-letter currency code');
  if (amountMinor <= 0) throw new Error('A paid pricing model needs a positive amount');
}

/** Creates the first version of a pricing model. */
export function definePricingModel(input: DefinePricingModelInput, now: Date = new Date()): PricingModel {
  const mode = input.mode;
  const currency = mode === 'free' ? '' : (input.currency ?? '');
  const amountMinor = mode === 'free' ? 0 : (input.amountMinor ?? 0);
  const feeBps = input.platformFeeBps ?? 0;
  assertAmounts(mode, currency, amountMinor, feeBps);

  const payer = input.payer ?? (mode === 'sponsored' ? 'sponsor' : 'mentee');
  const recipient = input.recipient ?? 'mentor';
  if (!input.createdById) throw new Error('A pricing model needs a creator');
  if (input.effectiveFrom && !Number.isFinite(Date.parse(input.effectiveFrom))) {
    throw new Error('The effective date is not a valid date');
  }

  return {
    id: input.id,
    mode,
    currency,
    amountMinor,
    payer,
    recipient,
    platformFeeBps: feeBps,
    version: 1,
    effectiveFrom: input.effectiveFrom ?? now.toISOString(),
    createdAt: now.toISOString(),
    createdById: input.createdById,
  };
}

/**
 * Publishes a new immutable version. The previous version is left untouched so
 * past engagements keep the pricing they agreed to; the new version must apply later.
 */
export function revisePricingModel(
  current: PricingModel,
  changes: Partial<Omit<PricingModel, 'id' | 'version' | 'createdAt' | 'createdById'>>,
  createdById: string,
  now: Date = new Date(),
): PricingModel {
  if (!createdById) throw new Error('A pricing model revision needs an author');
  const next: PricingModel = { ...current, ...changes, version: current.version + 1, createdAt: now.toISOString(), createdById };
  assertAmounts(next.mode, next.currency, next.amountMinor, next.platformFeeBps);
  if (Date.parse(next.effectiveFrom) < Date.parse(current.effectiveFrom)) {
    throw new Error('A new version cannot take effect before the version it supersedes');
  }
  return next;
}

/** A version is effective from `effectiveFrom` until the next version takes over. */
export function isEffectiveAt(model: PricingModel, at: Date): boolean {
  return Date.parse(model.effectiveFrom) <= at.getTime();
}

/**
 * Picks the version in force at a point in time. The highest version whose
 * `effectiveFrom` has passed wins, so callers never need to sort externally.
 */
export function resolveEffectivePricing(models: PricingModel[], id: string, at: Date = new Date()): PricingModel | undefined {
  return models
    .filter((model) => model.id === id && isEffectiveAt(model, at))
    .sort((a, b) => b.version - a.version)[0];
}
