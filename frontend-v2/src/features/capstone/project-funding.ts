/**
 * Project funding model configuration (CAPSTONE-081).
 *
 * Supported models: unfunded, grant, milestone, reimbursement, stipend,
 * bounty and sponsor-funded. Configuration is tenant-scoped and pure: callers
 * supply the project context, and no private proposal or financial payload is
 * stored here. Validation errors are stable and actionable.
 */

export const FUNDING_MODELS = [
  "unfunded",
  "grant",
  "milestone",
  "reimbursement",
  "stipend",
  "bounty",
  "sponsor-funded",
] as const;
export type FundingModel = (typeof FUNDING_MODELS)[number];

export interface FundingAsset {
  /** Asset code, e.g. USD, USDC or XLM. */
  code: string;
  /** Issuer account for non-native assets; omitted for XLM. */
  issuer?: string;
}

export interface FundingRecipient {
  memberId: string;
  /** Share of the distributable amount, in basis points (0-10000). */
  shareBps: number;
}

export interface FundingFees {
  /** Platform fee in basis points (0-1000). */
  platformBps: number;
  /** Fixed fee in the smallest unit of the asset. */
  flat: number;
}

export interface FundingConfiguration {
  id: string;
  tenantId: string;
  projectId: string;
  model: FundingModel;
  asset: FundingAsset;
  /** Tenant member id of the payer (or sponsor). */
  payerId: string;
  recipients: readonly FundingRecipient[];
  fees: FundingFees;
  /** Cents/smallest units available; zero when unfunded. */
  committedAmount: number;
  /** Increment on every accepted configuration change. */
  revision: number;
}

export interface FundingContext {
  tenantId: string;
  projectId: string;
  memberIds: readonly string[];
  /** Milestone ids that can be funded under a milestone model. */
  milestoneIds?: readonly string[];
}

export interface FundingIssue {
  field: string;
  message: string;
}

const isNonNegativeInteger = (value: number) => Number.isSafeInteger(value) && value >= 0;

/** Models that require at least one recipient and a committed amount. */
const PAID_MODELS: readonly FundingModel[] = ["grant", "milestone", "reimbursement", "stipend", "bounty", "sponsor-funded"];

export function isFundingModel(value: unknown): value is FundingModel {
  return typeof value === "string" && (FUNDING_MODELS as readonly string[]).includes(value);
}

export function validateFunding(config: FundingConfiguration, ctx: FundingContext): FundingIssue[] {
  const issues: FundingIssue[] = [];
  const bad = (field: string, message: string) => issues.push({ field, message });

  if (!isFundingModel(config.model)) bad("model", "choose a supported funding model");
  if (config.tenantId !== ctx.tenantId || config.projectId !== ctx.projectId) {
    bad("tenantId", "the configuration belongs to a different tenant or project");
  }
  if (!isNonNegativeInteger(config.revision)) bad("revision", "revision must be a non-negative integer");
  if (!config.asset.code || config.asset.code.length > 12) bad("asset.code", "give an asset code of up to 12 characters");
  if (config.asset.code === "XLM" ? config.asset.issuer !== undefined : !config.asset.issuer) {
    bad("asset.issuer", "only XLM is native; other assets need an issuer");
  }
  if (config.model === "unfunded") {
    if (config.committedAmount !== 0) bad("committedAmount", "an unfunded project cannot commit an amount");
    if (config.recipients.length !== 0) bad("recipients", "an unfunded project has no recipients");
  } else if (PAID_MODELS.includes(config.model)) {
    if (!ctx.memberIds.includes(config.payerId)) bad("payerId", "the payer must be a member of this tenant");
    if (config.committedAmount <= 0) bad("committedAmount", "committed amount must be greater than zero");
    if (config.recipients.length === 0) bad("recipients", "add at least one recipient");
  }
  if (config.fees.platformBps < 0 || config.fees.platformBps > 1000) bad("fees.platformBps", "platform fee must be between 0 and 1000 basis points");
  if (!isNonNegativeInteger(config.fees.flat)) bad("fees.flat", "flat fee must be a non-negative integer");

  const recipientIds = new Set<string>();
  let totalShares = 0;
  for (const [index, recipient] of config.recipients.entries()) {
    if (!ctx.memberIds.includes(recipient.memberId)) bad(`recipients[${index}].memberId`, "recipient must be a member of this tenant");
    if (recipientIds.has(recipient.memberId)) bad(`recipients[${index}].memberId`, "recipients must be unique");
    recipientIds.add(recipient.memberId);
    if (!isNonNegativeInteger(recipient.shareBps) || recipient.shareBps > 10000) {
      bad(`recipients[${index}].shareBps`, "share must be between 0 and 10000 basis points");
    } else {
      totalShares += recipient.shareBps;
    }
  }
  if (config.model !== "unfunded" && config.recipients.length > 0 && totalShares !== 10000) {
    bad("recipients", "recipient shares must add up to 10000 basis points");
  }
  return issues;
}

/** Fee and net distributable amount for a committed budget. */
export function fundingBreakdown(config: Pick<FundingConfiguration, "committedAmount" | "fees">) {
  const platformFee = Math.floor((config.committedAmount * config.fees.platformBps) / 10000) + config.fees.flat;
  const net = Math.max(0, config.committedAmount - platformFee);
  return { gross: config.committedAmount, platformFee, net };
}

/** Deterministic allocation order: descending share, then member id. */
export function allocateFunding(config: FundingConfiguration) {
  const { net } = fundingBreakdown(config);
  return [...config.recipients]
    .sort((a, b) => b.shareBps - a.shareBps || a.memberId.localeCompare(b.memberId))
    .map((recipient) => ({
      memberId: recipient.memberId,
      amount: Math.floor((net * recipient.shareBps) / 10000),
    }));
}
