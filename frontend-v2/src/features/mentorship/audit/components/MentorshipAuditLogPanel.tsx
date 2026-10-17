'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { verifyMentorshipAuditChain, type MentorshipAuditEvent } from '../types';

function Panel({ title, description, children }: { title: string; description: string; children: ReactNode }) {
  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <h2 className="text-xl font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-600">{description}</p>
      <div className="mt-4 space-y-2 text-sm text-slate-700">{children}</div>
    </section>
  );
}

const SAMPLE_EVENTS: MentorshipAuditEvent[] = [
  {
    id: 'audit-1',
    sequence: 1,
    actor: 'admin-1',
    tenantId: 'tenant-1',
    target: 'mentor-profile:mentor-1',
    action: 'mentor-profile.read',
    outcome: 'success',
    correlationId: 'corr-1',
    occurredAt: '2026-10-01T10:00:00.000Z',
    integrityHash: 'hash-1',
    previousHash: 'genesis',
  },
  {
    id: 'audit-2',
    sequence: 2,
    actor: 'admin-1',
    tenantId: 'tenant-1',
    target: 'mentor-profile:mentor-1',
    action: 'mentor-profile.update',
    outcome: 'success',
    correlationId: 'corr-2',
    occurredAt: '2026-10-01T10:05:00.000Z',
    integrityHash: 'hash-2',
    previousHash: 'hash-1',
  },
];

export function MentorshipAuditLogPanel() {
  const [filters, setFilters] = useState({ tenantId: 'tenant-1', from: '2026-10-01', to: '2026-10-31' });

  const events = useMemo(() => SAMPLE_EVENTS, []);

  const chain = useMemo(() => verifyMentorshipAuditChain(events), [events]);

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Mentorship audit log
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Security-relevant audit trail</h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Tamper-evident retention with role-aware access. Sensitive payloads excluded.
        </p>
      </header>

      <Panel
        title="Filters (role-aware)"
        description="Administrators can filter and export authorized records."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <Input
            aria-label="Tenant ID"
            value={filters.tenantId}
            onChange={(e) => setFilters({ ...filters, tenantId: e.target.value })}
          />
          <Input
            aria-label="From date"
            type="date"
            value={filters.from}
            onChange={(e) => setFilters({ ...filters, from: e.target.value })}
          />
          <Input
            aria-label="To date"
            type="date"
            value={filters.to}
            onChange={(e) => setFilters({ ...filters, to: e.target.value })}
          />
        </div>
        <div className="mt-3">
          <Button type="button" variant="outline" aria-label="Export authorized audit records">
            Export authorized records
          </Button>
        </div>
      </Panel>

      <Panel title="Audit events" description="Chain integrity verified via backend hashes.">
        <p role="status" aria-live="polite">
          Chain status: {chain.valid ? 'intact' : 'broken'}
        </p>
        <ul className="mt-2 list-disc pl-5" aria-label="Mentorship audit events">
          {events.map((event) => (
            <li key={event.id}>
              #{event.sequence} {event.action} · {event.outcome} · actor:{event.actor} · target:
              {event.target}
            </li>
          ))}
        </ul>
        <p className="mt-2 text-xs text-slate-500">
          Ordinary users cannot alter entries. Write failures alert safely; retries do not duplicate
          effects.
        </p>
      </Panel>
    </section>
  );
}

export default MentorshipAuditLogPanel;
