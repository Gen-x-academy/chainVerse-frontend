// @vitest-environment node
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  compareApiEndpoints,
  compareDbSchemas,
  compareEvents,
  compareAbis,
  evaluateCompatibilityGate,
} from '@/src/features/scholarships/compatibility';
import type {
  AbiArtifact,
  ApiArtifact,
  CompatibilityApproval,
  DbArtifact,
  EventsArtifact,
} from '@/src/features/scholarships/compatibility';

function loadJson<T>(path: string): T {
  return JSON.parse(readFileSync(resolve(process.cwd(), path), 'utf8')) as T;
}

describe('scholarships compatibility gate', () => {
  const apiCurrent = loadJson<ApiArtifact>('scripts/scholarships/artifacts/api-contracts.json');
  const apiBaseline = loadJson<ApiArtifact>('scripts/scholarships/artifacts/baseline/api-contracts.json');
  const eventsCurrent = loadJson<EventsArtifact>('scripts/scholarships/artifacts/events.json');
  const eventsBaseline = loadJson<EventsArtifact>('scripts/scholarships/artifacts/baseline/events.json');
  const dbCurrent = loadJson<DbArtifact>('scripts/scholarships/artifacts/db-schema.json');
  const dbBaseline = loadJson<DbArtifact>('scripts/scholarships/artifacts/baseline/db-schema.json');
  const abiCurrent = loadJson<AbiArtifact>('scripts/scholarships/artifacts/stellar-abi.json');
  const abiBaseline = loadJson<AbiArtifact>('scripts/scholarships/artifacts/baseline/stellar-abi.json');
  const approvals = loadJson<CompatibilityApproval[]>('scripts/scholarships/artifacts/compatibility-approvals.json');

  it('classifies newly added endpoints as additive, never blocking', () => {
    const changes = compareApiEndpoints(apiCurrent, apiBaseline);

    expect(changes.length).toBeGreaterThan(0);
    expect(changes.every((change) => change.changeClass !== 'breaking')).toBe(true);
    expect(apiCurrent.some((endpoint) => endpoint.route.startsWith('/scholarships/staging/'))).toBe(true);
  });

  it('classifies removed endpoints as breaking with a stable approval key', () => {
    const baseline = [
      { route: '/scholarships/legacy/all', method: 'POST', requestFields: ['applicant'], responseFields: ['id'] },
    ];
    const changes = compareApiEndpoints([], baseline);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeClass).toBe('breaking');
    expect(changes[0].approvalKey).toBe('api:POST /scholarships/legacy/all:endpoint-removed');
  });

  it('classifies removed required event fields as breaking', () => {
    const baseline: EventsArtifact = [
      { name: 'PaymentConfirmed', version: '1.0.0', fields: [{ name: 'paymentId', type: 'string', required: true }, { name: 'signature', type: 'string', required: true }] },
    ];
    const current: EventsArtifact = [
      { name: 'PaymentConfirmed', version: '1.0.0', fields: [{ name: 'paymentId', type: 'string', required: true }] },
    ];

    const changes = compareEvents(current, baseline);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeClass).toBe('breaking');
    expect(changes[0].entity).toBe('PaymentConfirmed.signature');
  });

  it('classifies columns made NOT NULL as breaking', () => {
    const baseline: DbArtifact = [{ name: 'seed_run', columns: [{ name: 'revokedAt', type: 'string', nullable: true }] }];
    const current: DbArtifact = [{ name: 'seed_run', columns: [{ name: 'revokedAt', type: 'string', nullable: false }] }];

    const changes = compareDbSchemas(current, baseline);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeClass).toBe('breaking');
    expect(changes[0].reason).toBe('column-made-not-null');
  });

  it('classifies an ABI signature change as breaking', () => {
    const baseline: AbiArtifact = [{ name: 'submit_application', kind: 'function', inputs: [{ name: 'applicantId', type: 'string' }, { name: 'scholarshipId', type: 'string' }], mutability: 'writable' }];
    const current: AbiArtifact = [{ name: 'submit_application', kind: 'function', inputs: [{ name: 'applicantId', type: 'string' }], mutability: 'writable' }];

    const changes = compareAbis(current, baseline);

    expect(changes).toHaveLength(1);
    expect(changes[0].changeClass).toBe('breaking');
    expect(changes[0].reason).toBe('abi-signature-changed');
  });

  it('blocks breaking changes until a matching approval exists', () => {
    const baseline: ApiArtifact = [{ route: '/scholarships/applications', method: 'POST', requestFields: ['applicantId'], responseFields: ['id'] }];
    const current: ApiArtifact = [{ route: '/scholarships/applications', method: 'POST', requestFields: [], responseFields: ['id'] }];

    const withoutApproval = evaluateCompatibilityGate(
      { api: { current, baseline }, events: { current: eventsCurrent, baseline: eventsBaseline }, db: { current: dbCurrent, baseline: dbBaseline }, abi: { current: abiCurrent, baseline: abiBaseline } },
      []
    );
    expect(withoutApproval.ok).toBe(false);
    expect(withoutApproval.blocking).toHaveLength(1);

    const change = withoutApproval.blocking[0];
    const withApproval = evaluateCompatibilityGate(
      { api: { current, baseline }, events: { current: eventsCurrent, baseline: eventsBaseline }, db: { current: dbCurrent, baseline: dbBaseline }, abi: { current: abiCurrent, baseline: abiBaseline } },
      [{ approvalKey: change.approvalKey, issue: '#9876', approvedBy: 'Platform engineering', date: '2026-09-20' }]
    );
    expect(withApproval.ok).toBe(true);
  });

  it('passes for the checked-in artifacts and baseline', () => {
    const result = evaluateCompatibilityGate(
      { api: { current: apiCurrent, baseline: apiBaseline }, events: { current: eventsCurrent, baseline: eventsBaseline }, db: { current: dbCurrent, baseline: dbBaseline }, abi: { current: abiCurrent, baseline: abiBaseline } },
      approvals
    );

    expect(result.ok).toBe(true);
    expect(result.blocking).toEqual([]);
    expect(result.additive.length).toBeGreaterThan(0);
  });
});