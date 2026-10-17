/**
 * Coordinator operations dashboard service (closes #1363, MENTOR-116).
 *
 * - **Tenant-scoped.** Every request carries the coordinator's tenant; the
 *   snapshot is rejected if the API returns a different tenant.
 * - **Retries do not duplicate effects.** Intervention actions send an
 *   idempotency key; `runIntervention` is a no-op when the key has already
 *   succeeded.
 * - **Stable errors.** Failures surface a `DashboardErrorCode` the UI can act
 *   on, never a raw server string.
 */

import { apiClient } from '@/src/lib/api-client';
import {
  isSnapshotStale,
  type DashboardCardData,
  type DashboardCardId,
  type DashboardFilters,
  type DashboardSnapshot,
} from './types';

export type DashboardErrorCode = 'UNAUTHORIZED' | 'NETWORK' | 'SERVER' | 'INVALID_PAYLOAD';

export class DashboardError extends Error {
  constructor(
    public readonly code: DashboardErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'DashboardError';
  }
}

const CARD_IDS: readonly DashboardCardId[] = [
  'capacity',
  'review-queue',
  'unmatched',
  'expiring-proposals',
  'schedule-risks',
  'overdue-milestones',
  'disputes',
];

/** Rejects payloads that are not a well-formed, tenant-matching snapshot. */
export function normalizeDashboardSnapshot(
  payload: unknown,
  tenantId: string,
): DashboardSnapshot {
  if (typeof payload !== 'object' || payload === null) {
    throw new DashboardError('INVALID_PAYLOAD', 'The operations payload was empty.');
  }
  const raw = payload as Partial<DashboardSnapshot>;
  if (raw.tenantId !== tenantId) {
    throw new DashboardError('UNAUTHORIZED', 'This snapshot belongs to a different organization.');
  }
  if (typeof raw.generatedAt !== 'string' || !Array.isArray(raw.cards)) {
    throw new DashboardError('INVALID_PAYLOAD', 'The operations payload was malformed.');
  }
  const cards = raw.cards.filter((card): card is DashboardCardData =>
    CARD_IDS.includes((card as DashboardCardData)?.id),
  );
  if (cards.length !== raw.cards.length) {
    throw new DashboardError('INVALID_PAYLOAD', 'The operations payload contained unknown cards.');
  }
  return { tenantId: raw.tenantId, generatedAt: raw.generatedAt, cards };
}

export interface DashboardQuery {
  tenantId: string;
  filters: DashboardFilters;
}

export const dashboardService = {
  load: async ({ tenantId, filters }: DashboardQuery): Promise<DashboardSnapshot> => {
    try {
      const query = new URLSearchParams({ status: filters.status });
      if (filters.programId) query.set('programId', filters.programId);
      const payload = await apiClient.get<unknown>(
        `/mentorship/operations/dashboard?${query.toString()}`,
        { headers: { 'X-Tenant-Id': tenantId } },
      );
      return normalizeDashboardSnapshot(payload, tenantId);
    } catch (error) {
      if (error instanceof DashboardError) throw error;
      throw new DashboardError('NETWORK', 'The operations dashboard could not be loaded.');
    }
  },

  isStale: isSnapshotStale,
};

// ─── Intervention actions (idempotent) ────────────────────────────────────────

export type InterventionKind =
  | 'nudge-review'
  | 'offer-rematch'
  | 'extend-proposal'
  | 'escalate-dispute';

export interface InterventionRequest {
  cardId: DashboardCardId;
  kind: InterventionKind;
  tenantId: string;
  /** Stable client-generated key; retries reuse it so effects apply once. */
  idempotencyKey: string;
}

export interface InterventionResult {
  applied: boolean;
  reference: string;
}

const succeededKeys = new Set<string>();

export function resetInterventionCache(): void {
  succeededKeys.clear();
}

/** Applies an intervention once per idempotency key, even across retries. */
export async function runIntervention(request: InterventionRequest): Promise<InterventionResult> {
  if (succeededKeys.has(request.idempotencyKey)) {
    return { applied: false, reference: request.idempotencyKey };
  }
  try {
    const result = await apiClient.post<{ reference: string }>(
      '/mentorship/operations/interventions',
      { ...request, appliedAt: undefined },
      { headers: { 'X-Tenant-Id': request.tenantId, 'Idempotency-Key': request.idempotencyKey } },
    );
    succeededKeys.add(request.idempotencyKey);
    return { applied: true, reference: result.reference ?? request.idempotencyKey };
  } catch (error) {
    throw new DashboardError('SERVER', 'The intervention could not be recorded.');
  }
}
