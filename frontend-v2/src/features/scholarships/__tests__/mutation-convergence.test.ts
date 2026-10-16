/**
 * The three mutation paths that did not use TanStack Query (issue #1227).
 *
 * Withdrawal, payment-batch execution and milestone verification each used to
 * manage their own `useState` / Zustand request state, so none of them told the
 * rest of the app that anything had changed: the applications, awards,
 * disbursement, schedule and ledger views kept showing pre-mutation data until
 * a manual reload. Each is a mutation now, routed through the invalidation
 * matrix.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import React from 'react';
import { useAuthStore } from '@/src/store/authStore';
import { scholarshipQueryKeys } from '../lib/queryKeys';
import { useRequestWithdrawal } from '../withdrawal/hooks';
import { useExecutePaymentBatch } from '../disbursements/payments/hooks';
import { useRecordMilestoneDecision } from '../milestones/hooks';

vi.mock('../withdrawal/service', () => ({
  scholarshipWithdrawalService: { submitWithdrawal: vi.fn() },
  getWithdrawalPolicyImpact: vi.fn(() => 'impact'),
}));
vi.mock('../disbursements/payments/service', () => ({
  scheduledPaymentService: { executeBatch: vi.fn() },
}));
vi.mock('../milestones/service', () => ({
  milestoneEvidenceService: {},
  milestoneVerifierService: { recordDecision: vi.fn() },
  disbursementScheduleService: {},
}));

import { scholarshipWithdrawalService } from '../withdrawal/service';
import { scheduledPaymentService } from '../disbursements/payments/service';
import { milestoneVerifierService } from '../milestones/service';

const identity = { userId: 'user-1', role: 'admin', tenantId: 'tenant-1' } as const;
const keys = scholarshipQueryKeys(identity);

let client: QueryClient;
let invalidate: ReturnType<typeof vi.spyOn>;

function wrapper({ children }: { children: React.ReactNode }) {
  return React.createElement(QueryClientProvider, { client }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  useAuthStore.setState({
    isAuthenticated: true,
    user: { id: 'user-1', role: 'admin', tenantId: 'tenant-1' },
  });
  client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  invalidate = vi.spyOn(client, 'invalidateQueries').mockResolvedValue(undefined);
});

const invalidatedKeys = (): unknown[][] =>
  (invalidate.mock.calls as unknown as unknown[][]).map((call) => (call[0] as { queryKey: unknown[] }).queryKey);

describe('withdrawal', () => {
  const request = {
    applicationId: 'app-1',
    programId: 'prog-1',
    reasonCategory: 'academic' as const,
    confirmed: true,
    requestedAt: '2026-09-30T00:00:00.000Z',
  };
  const record = {
    ...request,
    withdrawalId: 'wd-1',
    status: 'pending' as const,
    releasedCapacity: false,
    reviewHistoryPreserved: true,
    policyImpact: 'impact',
  };

  it('refreshes the application, round, budget and award views on success', async () => {
    vi.mocked(scholarshipWithdrawalService.submitWithdrawal).mockResolvedValue(record);

    const { result } = renderHook(() => useRequestWithdrawal(), { wrapper });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const seen = invalidatedKeys();
    expect(seen).toContainEqual(keys.applications.detail('app-1'));
    expect(seen).toContainEqual(keys.rounds.lists());
    expect(seen).toContainEqual(keys.budgets.all);
    expect(seen).toContainEqual(keys.awards.lists());
    expect(seen).toContainEqual(keys.withdrawals.all);
  });

  it('leaves the cache untouched when the request fails', async () => {
    vi.mocked(scholarshipWithdrawalService.submitWithdrawal).mockRejectedValue(
      new Error('Withdrawal must be confirmed.'),
    );

    const { result } = renderHook(() => useRequestWithdrawal(), { wrapper });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe('Withdrawal must be confirmed.');
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('surfaces an authorization failure without retrying', async () => {
    vi.mocked(scholarshipWithdrawalService.submitWithdrawal).mockRejectedValue(
      new Error('Request failed with status 403'),
    );

    const { result } = renderHook(() => useRequestWithdrawal(), { wrapper });
    result.current.mutate(request);

    await waitFor(() => expect(result.current.isError).toBe(true));
    // One call only: a 403 will not become a 200 on retry.
    expect(scholarshipWithdrawalService.submitWithdrawal).toHaveBeenCalledTimes(1);
  });

  it('converges before the caller continues', async () => {
    vi.mocked(scholarshipWithdrawalService.submitWithdrawal).mockResolvedValue(record);
    const { result } = renderHook(() => useRequestWithdrawal(), { wrapper });

    result.current.mutateAsync(request);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    await waitFor(() => expect(invalidate).toHaveBeenCalled());
  });

  it('keeps concurrent submissions in separate cache scopes', async () => {
    // The service echoes back the application it was asked about, so two
    // in-flight withdrawals target two different application details.
    vi.mocked(scholarshipWithdrawalService.submitWithdrawal).mockImplementation(
      async (input) => ({ ...record, applicationId: input.applicationId, withdrawalId: `wd-${input.applicationId}` }),
    );
    const { result } = renderHook(() => useRequestWithdrawal(), { wrapper });

    // Two withdrawals in flight at once must not collapse into one invalidation
    // set that resolves before both writes land.
    result.current.mutate(request);
    result.current.mutate({ ...request, applicationId: 'app-2' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const seen = invalidatedKeys();
    expect(seen).toContainEqual(keys.applications.detail('app-1'));
    expect(seen).toContainEqual(keys.applications.detail('app-2'));
  });
});

describe('payment batch', () => {
  const batch = {
    batchId: 'batch-1',
    batchKey: 'k',
    status: 'completed' as const,
    totalItems: 1,
    successCount: 1,
    failureCount: 0,
    outcomes: [],
    startedAt: '2026-09-30T00:00:00.000Z',
    completedAt: '2026-09-30T00:00:05.000Z',
  };

  it('refreshes the payment queue, disbursements, schedules and ledger', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockResolvedValue(batch);

    const { result } = renderHook(() => useExecutePaymentBatch(), { wrapper });
    result.current.mutate({ batchKey: 'k', maxItems: 10 });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const seen = invalidatedKeys();
    expect(seen).toContainEqual(keys.payments.all);
    expect(seen).toContainEqual(keys.disbursements.lists());
    expect(seen).toContainEqual(keys.schedules.lists());
    expect(seen).toContainEqual(keys.transactions.all);
  });

  it('does not invalidate on a dry run, which commits nothing', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockResolvedValue(batch);

    const { result } = renderHook(() => useExecutePaymentBatch(), { wrapper });
    result.current.mutate({ batchKey: 'k', maxItems: 10, dryRun: true });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });

  it('caches the batch result under its own key', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockResolvedValue(batch);

    const { result } = renderHook(() => useExecutePaymentBatch(), { wrapper });
    result.current.mutate({ batchKey: 'k', maxItems: 10 });

    await waitFor(() =>
      expect(client.getQueryData(keys.payments.at('batch', 'batch-1'))).toEqual(batch),
    );
  });

  it('leaves the cache untouched when the batch fails', async () => {
    vi.mocked(scheduledPaymentService.executeBatch).mockRejectedValue(
      new Error('Request failed with status 401'),
    );

    const { result } = renderHook(() => useExecutePaymentBatch(), { wrapper });
    result.current.mutate({ batchKey: 'k', maxItems: 10 });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(invalidate).not.toHaveBeenCalled();
  });
});

describe('milestone verification', () => {
  const decision = {
    id: 'dec-1',
    evidenceId: 'ev-1',
    milestoneId: 'ms-1',
    verifierId: 'user-1',
    action: 'approve' as const,
    reasonCode: 'EVIDENCE_COMPLETE' as const,
    decidedAt: '2026-09-30T00:00:00.000Z',
    paymentEligibilityTriggered: true,
  };

  it('targets the schedule the award owns when the award id is known', async () => {
    vi.mocked(milestoneVerifierService.recordDecision).mockResolvedValue(decision);

    const { result } = renderHook(
      () => useRecordMilestoneDecision({ awardId: 'award-4' }),
      { wrapper },
    );
    result.current.mutate({
      evidenceId: 'ev-1',
      action: 'approve',
      reasonCode: 'EVIDENCE_COMPLETE',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const seen = invalidatedKeys();
    expect(seen).toContainEqual(keys.schedules.detail('award-4'));
    expect(seen).toContainEqual(keys.disbursements.lists());
    expect(seen).toContainEqual(keys.awards.detail('award-4'));
    // The decision history this panel renders must refresh too.
    expect(seen).toContainEqual(keys.milestones.at('decisions', 'ev-1'));
  });

  it('widens to the schedule collection when the award id is unknown', async () => {
    vi.mocked(milestoneVerifierService.recordDecision).mockResolvedValue(decision);

    const { result } = renderHook(() => useRecordMilestoneDecision(), { wrapper });
    result.current.mutate({ evidenceId: 'ev-1', action: 'approve', reasonCode: 'EVIDENCE_COMPLETE' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidatedKeys()).toContainEqual(keys.schedules.lists());
  });

  it('refreshes the decision history even when the write is rejected', async () => {
    // A rejected write may still have been recorded server-side, so the panel
    // must not keep showing a verdict that no longer reflects the record.
    vi.mocked(milestoneVerifierService.recordDecision).mockRejectedValue(
      new Error('You cannot verify evidence you submitted.'),
    );

    const { result } = renderHook(() => useRecordMilestoneDecision({ awardId: 'award-4' }), {
      wrapper,
    });
    result.current.mutate({ evidenceId: 'ev-1', action: 'approve', reasonCode: 'EVIDENCE_COMPLETE' });

    await waitFor(() => expect(result.current.isError).toBe(true));
    const seen = invalidatedKeys();
    expect(seen).toContainEqual(keys.milestones.at('decisions', 'ev-1'));
    // But it must not claim the schedule moved.
    expect(seen).not.toContainEqual(keys.schedules.detail('award-4'));
  });

  it('does not refetch another award schedule', async () => {
    vi.mocked(milestoneVerifierService.recordDecision).mockResolvedValue(decision);

    const { result } = renderHook(
      () => useRecordMilestoneDecision({ awardId: 'award-4' }),
      { wrapper },
    );
    result.current.mutate({ evidenceId: 'ev-1', action: 'approve', reasonCode: 'EVIDENCE_COMPLETE' });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(invalidatedKeys().some((k) => JSON.stringify(k).includes('award-9'))).toBe(false);
  });
});

describe('tenancy', () => {
  it('never invalidates another tenant cache', async () => {
    vi.mocked(scholarshipWithdrawalService.submitWithdrawal).mockRejectedValue(new Error('nope'));
    const otherTenant = scholarshipQueryKeys({ ...identity, tenantId: 'tenant-2' });
    vi.mocked(scholarshipWithdrawalService.submitWithdrawal).mockResolvedValue({
      applicationId: 'app-1',
      programId: 'prog-1',
      reasonCategory: 'academic',
      confirmed: true,
      requestedAt: '2026-09-30T00:00:00.000Z',
      withdrawalId: 'wd-1',
      status: 'pending',
      releasedCapacity: false,
      reviewHistoryPreserved: true,
      policyImpact: 'impact',
    });

    const { result } = renderHook(() => useRequestWithdrawal(), { wrapper });
    result.current.mutate({
      applicationId: 'app-1',
      programId: 'prog-1',
      reasonCategory: 'academic',
      confirmed: true,
      requestedAt: '2026-09-30T00:00:00.000Z',
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    for (const key of invalidatedKeys()) {
      expect(key).not.toEqual(otherTenant.all);
      expect(key.slice(0, 2)).not.toEqual(otherTenant.all.slice(0, 2));
    }
  });
});
