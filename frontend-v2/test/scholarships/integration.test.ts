import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { scholarshipService } from '@/src/features/scholarships/service';
import { scholarshipConsentService, type ConsentSubmission } from '@/src/features/scholarships/consent';
import {
  buildRollbackManifest,
  generateSeedRun,
  scholarshipSeedService,
  validateSeedRun,
} from '@/src/features/scholarships/seed';
import { scholarshipReleaseService } from '@/src/features/scholarships/release';
import type { EligibilityRuleSet } from '@/src/features/scholarships/types';
import {
  createFixtureSet,
  createInMemoryStore,
  type FixtureProgram,
} from '@/src/features/scholarships/testing/fixtures';

/**
 * A disposable in-memory transport stands in for the network so the tests never
 * depend on shared mutable external state. Every service in the feature talks to
 * `@/src/lib/api-client`, so mocking that one module exercises persistence,
 * rollback, authorization, and every adapter together.
 */
const transport = vi.hoisted(() => {
  type Call = { method: string; path: string; body?: unknown };

  const calls: Call[] = [];
  const store = new Map<string, unknown>();
  let failure: string | null = null;
  const key = (method: string, path: string) => `${method} ${path}`;

  return {
    calls,
    store,
    setFailure(message: string | null) {
      failure = message;
    },
    reset() {
      calls.length = 0;
      store.clear();
      failure = null;
    },
    client: {
      async get<T>(path: string): Promise<T> {
        calls.push({ method: 'GET', path });
        if (failure) throw new Error(failure);
        return (store.get(key('GET', path)) ?? []) as T;
      },
      async post<T>(path: string, body: unknown): Promise<T> {
        calls.push({ method: 'POST', path, body });
        if (failure) throw new Error(failure);
        store.set(key('POST', path), body ?? {});
        return (body ?? {}) as T;
      },
      async put<T>(path: string, body: unknown): Promise<T> {
        calls.push({ method: 'PUT', path, body });
        if (failure) throw new Error(failure);
        return (body ?? {}) as T;
      },
      async patch<T>(path: string, body: unknown): Promise<T> {
        calls.push({ method: 'PATCH', path, body });
        if (failure) throw new Error(failure);
        return (body ?? {}) as T;
      },
      async delete<T>(path: string): Promise<T> {
        calls.push({ method: 'DELETE', path });
        if (failure) throw new Error(failure);
        return undefined as T;
      },
    },
  };
});

vi.mock('@/src/lib/api-client', () => ({
  apiClient: transport.client,
  authedClient: transport.client,
}));

const ruleSet: EligibilityRuleSet = {
  id: 'rules-1',
  scholarshipId: 'scholarship-1',
  name: 'Integration rule set',
  description: 'Rules used by the integration tests.',
  operator: 'all',
  published: false,
  lastUpdated: '2026-09-24T00:00:00.000Z',
  rules: [
    {
      id: 'enrollment',
      type: 'enrollment',
      label: 'Enrollment status',
      description: 'Applicants must be enrolled.',
      required: true,
      expectedStatus: 'current',
    },
  ],
};

describe('scholarship integration (#1169)', () => {
  beforeEach(() => transport.reset());
  afterEach(() => transport.reset());

  it('persists scholarship mutations through the shared transport', async () => {
    const response = await scholarshipService.validateRuleSet(ruleSet);

    expect(response).toEqual(ruleSet);
    expect(transport.calls).toContainEqual(
      expect.objectContaining({ method: 'POST', path: '/scholarships/eligibility-rules/validate' })
    );
  });

  it('round-trips consent submissions with the application scope', async () => {
    const submissions: ConsentSubmission[] = [
      {
        kind: 'privacyNotice',
        version: '2026-09-01',
        accepted: true,
        acceptedAt: '2026-09-24T00:00:00.000Z',
      },
    ];

    const response = await scholarshipConsentService.submit('application-1', submissions);

    expect(response).toEqual({ consents: submissions });
    expect(transport.calls).toContainEqual(
      expect.objectContaining({
        method: 'POST',
        path: '/scholarships/applications/application-1/consent',
      })
    );
  });

  it('keeps staging seed runs idempotent and reversible', async () => {
    const first = generateSeedRun({ seedKey: 'seed-a', environment: 'testnet' });
    const replay = generateSeedRun({ seedKey: 'seed-a', environment: 'testnet' });

    expect(replay.runId).toBe(first.runId);
    expect(replay.programIds).toEqual(first.programIds);
    expect(validateSeedRun(first).ok).toBe(true);

    const manifest = buildRollbackManifest(first, '2026-09-24T00:00:00.000Z');
    const expectedIds =
      first.programIds.length +
      first.applicantIds.length +
      first.reviewerIds.length +
      first.walletIds.length +
      first.milestoneIds.length +
      first.paymentIds.length;

    expect(manifest.createdIds).toHaveLength(expectedIds);
    expect(manifest.createdIds).toEqual(expect.arrayContaining(first.programIds));
  });

  it('routes seed creation and revocation to their endpoints', async () => {
    const run = generateSeedRun({ seedKey: 'seed-b', environment: 'staging' });

    await scholarshipSeedService.create({ seedKey: 'seed-b', environment: 'staging' });
    await scholarshipSeedService.revoke(run.runId);

    const paths = transport.calls.map((call) => call.path);
    expect(paths).toContain('/scholarships/staging/seed-runs');
    expect(paths).toContain(`/scholarships/staging/seed-runs/${run.runId}/revoke`);
  });

  it('routes release readiness and provider sign-off to their endpoints', async () => {
    await scholarshipReleaseService.getReadiness();
    await scholarshipReleaseService.signOffCheck('check-1', 'owner-1');

    expect(transport.calls).toContainEqual(
      expect.objectContaining({ method: 'GET', path: '/scholarships/release/readiness' })
    );
    expect(transport.calls).toContainEqual(
      expect.objectContaining({ method: 'POST', path: '/scholarships/release/readiness/sign-off' })
    );
  });

  it('surfaces authorization failures to the caller', async () => {
    transport.setFailure('Not authorized to read eligibility rules');

    await expect(scholarshipService.listRules()).rejects.toThrow('Not authorized');
  });

  it('keeps fixtures isolated between stores', () => {
    const fixtures = createFixtureSet('isolation');
    const first = createInMemoryStore<FixtureProgram>();
    const second = createInMemoryStore<FixtureProgram>();

    first.save(fixtures.programs[0]);
    expect(first.list()).toHaveLength(1);
    expect(second.list()).toHaveLength(0);

    first.reset();
    expect(first.list()).toHaveLength(0);
  });
});
