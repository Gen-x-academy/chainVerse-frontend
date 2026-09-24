import type { AwardInventory, AwardInventoryDecision, AwardInventoryUpdateInput } from './types';

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
  const next: AwardInventory = clampRemainingCapacity({
    ...current,
    programId: input.programId,
    maxRecipients: input.maxRecipients ?? current.maxRecipients,
    perAwardAmount: input.perAwardAmount ?? current.perAwardAmount,
    totalBudget: input.totalBudget ?? current.totalBudget,
    reserveAmount: input.reserveAmount ?? current.reserveAmount,
    currency: input.currency ?? current.currency,
    updatedAt: new Date().toISOString(),
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

export function evaluateAwardDecision(inventory: AwardInventory, requestedRecipients: number, requestedAmount: number): AwardInventoryDecision {
  const budgetNeeded = requestedRecipients * requestedAmount;
  const maxRecipientsAvailable = Math.max(0, inventory.maxRecipients - inventory.committedAwards);
  const remainingBudget = Math.max(0, inventory.totalBudget - inventory.reserveAmount - inventory.committedAwards * inventory.perAwardAmount);
  const withinRecipients = requestedRecipients <= maxRecipientsAvailable;
  const withinBudget = budgetNeeded <= remainingBudget;

  if (!withinRecipients || !withinBudget) {
    return {
      decisionId: `decision-${Date.now().toString(36)}`,
      programId: inventory.programId,
      awardAmount: requestedAmount,
      recipientsCount: requestedRecipients,
      committedAt: new Date().toISOString(),
      status: 'rejected',
      reason: !withinRecipients
        ? 'Requested recipients exceed the remaining inventory capacity.'
        : 'Requested award commitment exceeds the available budget after reserve rules.',
    };
  }

  return {
    decisionId: `decision-${Date.now().toString(36)}`,
    programId: inventory.programId,
    awardAmount: requestedAmount,
    recipientsCount: requestedRecipients,
    committedAt: new Date().toISOString(),
    status: 'approved',
  };
}

export const awardInventoryService = {
  getAwardInventory,
  updateAwardInventory,
  evaluateAwardDecision,
  computeAwardCapacity,
};
