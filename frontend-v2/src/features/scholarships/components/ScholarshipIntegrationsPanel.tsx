'use client';

import { useMemo, type ReactNode } from 'react';
import {
  buildIdempotencyKey,
  createIdempotencyRecord,
  decideIdempotentMutation,
  fingerprintRequest,
} from '../idempotency';
import {
  SCHOLARSHIP_API_CONTRACTS,
  evaluateContractCompatibility,
  type ScholarshipContractEndpoint,
} from '../contracts';
import {
  deliveryHistory,
  nextRetryDelayMs,
  SCHOLARSHIP_WEBHOOK_EVENTS,
  type WebhookDelivery,
} from '../webhooks';

const deliverySamples: WebhookDelivery[] = [
  {
    id: 'delivery-1',
    subscriptionId: 'sub-1',
    event: SCHOLARSHIP_WEBHOOK_EVENTS[0],
    attempt: 1,
    status: 'delivered',
    statusCode: 200,
    deliveredAt: '2026-09-24T10:00:00.000Z',
  },
  {
    id: 'delivery-2',
    subscriptionId: 'sub-1',
    event: SCHOLARSHIP_WEBHOOK_EVENTS[3],
    attempt: 2,
    status: 'failed',
    statusCode: 503,
    nextAttemptAt: '2026-09-24T10:04:00.000Z',
  },
];

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

export function ScholarshipIntegrationsPanel() {
  const idempotency = useMemo(() => {
    const request = {
      key: buildIdempotencyKey({
        actorId: 'student-1',
        operation: 'application.submit',
        resourceId: 'program-1',
        clientNonce: 'nonce-1',
      }),
      actorId: 'student-1',
      operation: 'application.submit' as const,
      requestFingerprint: fingerprintRequest({ programId: 'program-1', answers: ['a'] }),
    };
    const record = createIdempotencyRecord(request, 'application-1');

    return {
      key: request.key,
      firstAttempt: decideIdempotentMutation(undefined, request),
      concurrentRetry: decideIdempotentMutation(record, request),
      conflictingRetry: decideIdempotentMutation(record, {
        ...request,
        requestFingerprint: fingerprintRequest({ programId: 'program-1', answers: ['b'] }),
      }),
    };
  }, []);

  const contracts = useMemo(() => {
    const next: ScholarshipContractEndpoint[] = SCHOLARSHIP_API_CONTRACTS.map((endpoint) =>
      endpoint.id === 'programs.list'
        ? { ...endpoint, responseFields: [...endpoint.responseFields, 'updatedAt'] }
        : endpoint
    );
    const breaking: ScholarshipContractEndpoint[] = SCHOLARSHIP_API_CONTRACTS.map((endpoint) =>
      endpoint.id === 'programs.list'
        ? { ...endpoint, responseFields: endpoint.responseFields.filter((field) => field !== 'total') }
        : endpoint
    );

    return {
      additive: evaluateContractCompatibility(SCHOLARSHIP_API_CONTRACTS, next),
      breaking: evaluateContractCompatibility(SCHOLARSHIP_API_CONTRACTS, breaking),
    };
  }, []);

  const deliveries = useMemo(() => deliveryHistory(deliverySamples, 'sub-1'), []);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Scholarships integrations
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Contracts, idempotency &amp; sponsor webhooks
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Versioned API contracts, safe retries for every scholarship mutation, and signed,
          replay-resistant webhook delivery to approved sponsor endpoints.
        </p>
      </header>

      <Panel
        title="Mutation idempotency"
        description="A key binds the actor and operation; retries return one outcome."
      >
        <p className="break-all font-mono text-xs text-slate-500">key: {idempotency.key}</p>
        <ul className="list-disc pl-5" aria-label="Idempotency decisions">
          <li>First attempt: {idempotency.firstAttempt.action}</li>
          <li>Concurrent retry: {idempotency.concurrentRetry.action}</li>
          <li>Conflicting retry: {idempotency.conflictingRetry.action}</li>
        </ul>
      </Panel>

      <Panel
        title="API contract compatibility"
        description="Breaking changes require a new contract version before they can ship."
      >
        <p>
          Adding a response field:{' '}
          {contracts.additive.requiresVersionBump ? 'requires version bump' : 'compatible'}
        </p>
        <p>
          Removing a response field:{' '}
          {contracts.breaking.requiresVersionBump ? 'requires version bump' : 'compatible'}
        </p>
        <p>{contracts.breaking.changes.length} breaking change(s) detected in the sample diff.</p>
      </Panel>

      <Panel
        title="Sponsor webhook delivery"
        description="Deliveries are signed, timestamped, retried with backoff, and replay-protected."
      >
        <ul className="space-y-2" aria-label="Webhook delivery history">
          {deliveries.map((delivery) => (
            <li key={delivery.id} className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <span className="font-medium">{delivery.event}</span> — attempt {delivery.attempt},{' '}
              {delivery.status}
              {delivery.status === 'failed' && (
                <span className="text-amber-700">
                  {' '}
                  (next retry in {Math.round(nextRetryDelayMs(delivery.attempt) / 1000)}s)
                </span>
              )}
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}

export default ScholarshipIntegrationsPanel;
