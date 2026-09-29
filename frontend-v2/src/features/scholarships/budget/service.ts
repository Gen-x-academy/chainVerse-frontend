import { assertServerAssignedId, UnverifiedServerIdentifierError } from '../lib/server-identity';
import type {
  AwardInventory,
  AwardInventoryDecision,
  AwardInventoryDecisionProposal,
  AwardInventoryUpdateInput,
} from './types';

const fallbackInventory: AwardInventory = {
  programId: 'chainverse-scholarship',
  programName: 'ChainVerse Scholarship',
  maxRecipients: 12,
  perAwardAmount: 4000,
  totalBudget: 48000,
  reserveAmount: 6000,
  currency: 'USD',
  remainingCapacity: 12,
  reservedCapacity: 6000,
  committedAwards: 0,
  updatedAt: '2025-03-01T00:00:00.000Z',
  version: '2025.03',
};

const INVENTORY_PATH = '/scholarship-awards';
const DECISIONS_PATH = '/scholarship-awards/decisions';

/** Raised when a decision could not be recorded server-side. */
export class AwardDecisionNotRecordedError extends Error {
  readonly code = 'DECISION_NOT_RECORDED' as const;

  constructor(message: string) {
    super(message);
    this.name = 'AwardDecisionNotRecordedError';
  }
}

/**
 * The commit time has to come from the API. A client clock is not evidence of
 * when a budget commitment was made, and a skewed browser clock would write a
 * false audit trail into the finance log.
 */
function assertServerRecordedTimestamp(value: unknown, context: string): string {
  if (typeof value !== 'string' || Number.isNaN(Date.parse(value))) {
    throw new UnverifiedServerIdentifierError(context, value);
  }
  return value;
}

function clampRemainingCapacity(inventory: AwardInventory): AwardInventory {
  const usableBudget = Math.max(0, inventory.totalBudget - inventory.reserveAmount - inventory.committedAwards * inventory.perAwardAmount);
  const remainingRecipients = Math.max(0, inventory.maxRecipients - inventory.committedAwards);
  return {
    ...inventory,
    remainingCapacity: Math.min(remainingRecipients, Math.floor(usableBudget / Math.max(inventory.perAwardAmount, 1))),
    reservedCapacity: inventory.reserveAmount,
  };
}

export function computeAwardCapacity(input: Pick<AwardInventory, 'maxRecipients' | 'perAwardAmount' | 'totalBudget' | 'reserveAmount' | 'committedAwards'>): number {
  const usableBudget = Math.max(0, input.totalBudget - input.reserveAmount - input.committedAwards * input.perAwardAmount);
  const remainingRecipients = Math.max(0, input.maxRecipients - input.committedAwards);
  return Math.min(remainingRecipients, Math.floor(usableBudget / Math.max(input.perAwardAmount, 1)));
}

export async function getAwardInventory(programId: string): Promise<AwardInventory> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  if (!baseUrl) {
    return clampRemainingCapacity({ ...fallbackInventory, programId, programName: fallbackInventory.programName });
  }

  try {
    const response = await fetch(`${baseUrl}${INVENTORY_PATH}?programId=${encodeURIComponent(programId)}`);
    if (!response.ok) {
      return clampRemainingCapacity({ ...fallbackInventory, programId, programName: fallbackInventory.programName });
    }

    const data = (await response.json()) as Partial<AwardInventory>;
    const resolved = { ...fallbackInventory, ...data, programId };
    return clampRemainingCapacity(resolved);
  } catch {
    return clampRemainingCapacity({ ...fallbackInventory, programId, programName: fallbackInventory.programName });
  }
}

export async function updateAwardInventory(input: AwardInventoryUpdateInput): Promise<AwardInventory> {
  const current = await getAwardInventory(input.programId);
  // `updatedAt` is deliberately not stamped here. It is part of the persisted
  // record, so the API owns it; a browser clock would write a false audit trail
  // into the finance log (issue #1223). The response below supplies the real
  // value, and the local echo keeps the previously fetched one.
  const next: AwardInventory = clampRemainingCapacity({
    ...current,
    programId: input.programId,
    maxRecipients: input.maxRecipients ?? current.maxRecipients,
    perAwardAmount: input.perAwardAmount ?? current.perAwardAmount,
    totalBudget: input.totalBudget ?? current.totalBudget,
    reserveAmount: input.reserveAmount ?? current.reserveAmount,
    currency: input.currency ?? current.currency,
    version: input.expectedVersion ?? current.version,
  });

  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  if (!baseUrl) {
    return next;
  }

  try {
    const response = await fetch(`${baseUrl}${INVENTORY_PATH}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });

    if (!response.ok) {
      return next;
    }

    const data = (await response.json()) as Partial<AwardInventory>;
    return clampRemainingCapacity({ ...next, ...data });
  } catch {
    return next;
  }
}

export function proposeAwardDecision(inventory: AwardInventory, requestedRecipients: number, requestedAmount: number): AwardInventoryDecisionProposal {
  const budgetNeeded = requestedRecipients * requestedAmount;
  const maxRecipientsAvailable = Math.max(0, inventory.maxRecipients - inventory.committedAwards);
  const remainingBudget = Math.max(0, inventory.totalBudget - inventory.reserveAmount - inventory.committedAwards * inventory.perAwardAmount);
  const withinRecipients = requestedRecipients <= maxRecipientsAvailable;
  const withinBudget = budgetNeeded <= remainingBudget;

  if (!withinRecipients || !withinBudget) {
    return {
      programId: inventory.programId,
      awardAmount: requestedAmount,
      recipientsCount: requestedRecipients,
      status: 'rejected',
      reason: !withinRecipients
        ? 'Requested recipients exceed the remaining inventory capacity.'
        : 'Requested award commitment exceeds the available budget after reserve rules.',
    };
  }

  return {
    programId: inventory.programId,
    awardAmount: requestedAmount,
    recipientsCount: requestedRecipients,
    status: 'approved',
  };
}

/**
 * Asks the scholarship API to record a decision and returns *its* record.
 *
 * The API owns the decision identifier and the commit timestamp. This function
 * deliberately refuses to synthesise either: a `decision-${Date.now()}` minted
 * in the browser looks like a server record, collides across tabs, and — once
 * persisted by the zustand store — is presented to finance as if the server had
 * issued it. If the API is unreachable the proposal stays a proposal and
 * `AwardDecisionNotRecordedError` is raised (issue #1223).
 */
export async function recordAwardDecision(
  proposal: AwardInventoryDecisionProposal,
  clientToken: string,
  fetchImpl: typeof fetch = fetch,
): Promise<AwardInventoryDecision> {
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
  if (!baseUrl) {
    throw new AwardDecisionNotRecordedError(
      'No scholarship API is configured, so the award decision was not recorded. Nothing was committed.',
    );
  }

  let response: Response;
  try {
    response = await fetchImpl(`${baseUrl}${DECISIONS_PATH}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...proposal, clientToken }),
    });
  } catch (error) {
    throw new AwardDecisionNotRecordedError(
      `The scholarship API could not be reached, so the award decision was not recorded. ${
        error instanceof Error ? error.message : ''
      }`.trim(),
    );
  }

  if (response.status === 409) {
    throw new AwardDecisionNotRecordedError(
      'The award decision conflicts with the current inventory version. Reload the inventory and try again.',
    );
  }
  if (response.status === 401 || response.status === 403) {
    throw new AwardDecisionNotRecordedError(
      'You are not authorized to record award decisions for this program.',
    );
  }
  if (!response.ok) {
    throw new AwardDecisionNotRecordedError(
      `The scholarship API rejected the award decision (HTTP ${response.status}).`,
    );
  }

  const recorded = (await response.json()) as Partial<AwardInventoryDecision>;

  return {
    programId: recorded.programId ?? proposal.programId,
    awardAmount: recorded.awardAmount ?? proposal.awardAmount,
    recipientsCount: recorded.recipientsCount ?? proposal.recipientsCount,
    status: recorded.status ?? proposal.status,
    reason: recorded.reason ?? proposal.reason,
    decisionId: assertServerAssignedId(recorded.decisionId, 'Award decision identifier'),
    committedAt: assertServerRecordedTimestamp(recorded.committedAt, 'Award decision commit time'),
  };
}

export const awardInventoryService = {
  getAwardInventory,
  updateAwardInventory,
  proposeAwardDecision,
  recordAwardDecision,
  computeAwardCapacity,
};
