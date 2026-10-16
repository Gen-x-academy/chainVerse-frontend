/**
 * Mutation → invalidation matrix (issue #1227).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { QueryClient } from '@tanstack/react-query';
import {
  SCHOLARSHIP_INVALIDATION_MATRIX,
  applyScholarshipInvalidation,
  scholarshipInvalidationTargets,
  type ScholarshipMutation,
} from '../invalidation';
import { scholarshipQueryKeys, type ScholarshipIdentity } from '../queryKeys';

const alice: ScholarshipIdentity = { userId: 'user-alice', role: 'student', tenantId: 'tenant-a' };
const keys = scholarshipQueryKeys(alice);

const names = Object.keys(SCHOLARSHIP_INVALIDATION_MATRIX) as ScholarshipMutation[];

describe('the matrix itself', () => {
  it('covers every transition the feature performs', () => {
    expect(names).toEqual(
      expect.arrayContaining([
        'application.create',
        'application.decide',
        'application.withdraw',
        'award.create',
        'award.accept',
        'award.decline',
        'award.cancel',
        'award.terminate',
        'milestone.verify',
        'payment.batch.execute',
        'window.create',
        'window.update',
        'duplicate.merge',
        'scope.update',
      ]),
    );
  });

  it('only ever targets this identity', () => {
    // A cross-identity target would let one user's mutation refetch — and so
    // potentially overwrite — another user's cache entry.
    for (const name of names) {
      for (const context of [{}, { awardId: 'a-1' }, { applicationId: 'app-1', windowId: 'w-1' }]) {
        for (const target of scholarshipInvalidationTargets(keys, name, context)) {
          expect(target.slice(0, 4)).toEqual(keys.all);
        }
      }
    }
  });

  it('never invalidates the whole feature by default', () => {
    // A `keys.all` invalidation refetches every mounted query, so using it as a
    // shortcut turns one decision into a burst of requests.
    for (const name of names) {
      const targets = scholarshipInvalidationTargets(keys, name, { awardId: 'a-1', applicationId: 'app-1' });
      expect(targets).not.toContainEqual(keys.all);
    }
  });

  it('rejects an unknown mutation name', () => {
    expect(() =>
      scholarshipInvalidationTargets(keys, 'award.teleport' as ScholarshipMutation),
    ).toThrow(/Unknown scholarship mutation/);
  });
});

describe('row behaviour', () => {
  it('widens to the collection when the award id is unknown', () => {
    const targets = scholarshipInvalidationTargets(keys, 'award.accept', {});
    expect(targets).toContainEqual(keys.awards.lists());
    expect(targets).toContainEqual(keys.agreements.all);
    expect(targets).toContainEqual(keys.schedules.lists());
  });

  it('targets the record when the award id is known', () => {
    const targets = scholarshipInvalidationTargets(keys, 'award.accept', { awardId: 'award-9' });
    expect(targets).toContainEqual(keys.awards.detail('award-9'));
    expect(targets).toContainEqual(keys.agreements.detail('award-9'));
    expect(targets).toContainEqual(keys.schedules.detail('award-9'));
    // Still refetches the collection: the award's status changed, so the list
    // row for it is stale too.
    expect(targets).toContainEqual(keys.awards.lists());
  });

  it('does not target another award when one id is known', () => {
    const targets = scholarshipInvalidationTargets(keys, 'award.cancel', { awardId: 'award-9' });
    expect(targets.some((t) => JSON.stringify(t).includes('award-other'))).toBe(false);
  });

  it('fans a withdrawal out to everything capacity touches', () => {
    const targets = scholarshipInvalidationTargets(keys, 'application.withdraw', {
      applicationId: 'app-7',
    });
    expect(targets).toContainEqual(keys.applications.detail('app-7'));
    expect(targets).toContainEqual(keys.withdrawals.all);
    // Releasing capacity moves the round, the budget and any pending award.
    expect(targets).toContainEqual(keys.rounds.lists());
    expect(targets).toContainEqual(keys.budgets.all);
    expect(targets).toContainEqual(keys.awards.lists());
  });

  it('fans a milestone decision out to the schedule it advances', () => {
    const targets = scholarshipInvalidationTargets(keys, 'milestone.verify', { awardId: 'award-3' });
    expect(targets).toContainEqual(keys.schedules.detail('award-3'));
    expect(targets).toContainEqual(keys.disbursements.lists());
  });

  it('fans a payment batch out to the queue, schedules and ledger', () => {
    const targets = scholarshipInvalidationTargets(keys, 'payment.batch.execute');
    expect(targets).toContainEqual(keys.payments.all);
    expect(targets).toContainEqual(keys.disbursements.lists());
    expect(targets).toContainEqual(keys.schedules.lists());
    expect(targets).toContainEqual(keys.transactions.all);
  });

  it('keeps a deadline change scoped to the window, round and applications', () => {
    const targets = scholarshipInvalidationTargets(keys, 'window.update', { windowId: 'win-2' });
    expect(targets).toContainEqual(keys.windows.detail('win-2'));
    expect(targets).toContainEqual(keys.rounds.lists());
    expect(targets).toContainEqual(keys.applications.lists());
    // A deadline change must not refetch awards.
    expect(targets).not.toContainEqual(keys.awards.lists());
  });

  it('de-duplicates overlapping targets', () => {
    // `milestone.verify` names both `schedules.lists()` directly and via
    // `awardTargets`; each should be invalidated once, not twice.
    const targets = scholarshipInvalidationTargets(keys, 'milestone.verify', { awardId: 'a-1' });
    expect(new Set(targets.map((t) => JSON.stringify(t))).size).toBe(targets.length);
  });

  it('is stable in order so callers can assert on it', () => {
    expect(scholarshipInvalidationTargets(keys, 'award.decline', { awardId: 'a-1' })).toEqual(
      scholarshipInvalidationTargets(keys, 'award.decline', { awardId: 'a-1' }),
    );
  });
});

describe('applyScholarshipInvalidation', () => {
  let queryClient: QueryClient;
  let invalidate: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    queryClient = new QueryClient();
    invalidate = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue(undefined);
  });

  it('invalidates exactly the resolved targets', async () => {
    const targets = await applyScholarshipInvalidation(queryClient, keys, 'award.accept', {
      awardId: 'award-1',
    });
    expect(invalidate).toHaveBeenCalledTimes(targets.length);
    for (const target of targets) {
      expect(invalidate).toHaveBeenCalledWith({ queryKey: target });
    }
  });

  it('awaits the refetches so a caller can navigate after convergence', async () => {
    const order: string[] = [];
    invalidate.mockImplementation(
      () => new Promise<void>((resolve) => setTimeout(() => { order.push('invalidate'); resolve(); }, 5)),
    );
    await applyScholarshipInvalidation(queryClient, keys, 'window.create');
    expect(order).toHaveLength(2); // windows.all + rounds.lists()
  });

  it('propagates a rejection so a failed fan-out is visible', async () => {
    invalidate.mockRejectedValue(new Error('network down'));
    await expect(
      applyScholarshipInvalidation(queryClient, keys, 'application.create'),
    ).rejects.toThrow('network down');
  });
});
