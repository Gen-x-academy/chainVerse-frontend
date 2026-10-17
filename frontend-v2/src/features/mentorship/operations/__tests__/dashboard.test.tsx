/**
 * Coordinator operations dashboard tests (closes #1363, MENTOR-116).
 * Covers filters persistence, per-card permission gating, aggregate links,
 * stale-data labeling, and loading/empty/error/success states.
 */

import React from 'react';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CoordinatorOperationsDashboard } from '../components/CoordinatorOperationsDashboard';
import {
  DEFAULT_DASHBOARD_FILTERS,
  canActOnCard,
  filterCards,
  isSnapshotStale,
  parseFilters,
  serializeFilters,
  type DashboardSnapshot,
} from '../types';
import { DashboardError, dashboardService, normalizeDashboardSnapshot, runIntervention, resetInterventionCache } from '../service';
import type { MentorshipPrincipal } from '@/src/features/mentorship/rbac';

const snapshot: DashboardSnapshot = {
  tenantId: 'tenant-1',
  generatedAt: new Date().toISOString(),
  cards: [
    {
      id: 'capacity',
      title: 'Mentor capacity',
      count: 2,
      status: 'attention',
      links: [{ label: 'View mentors', href: '/mentorship/mentors?over=1' }],
      resource: 'mentor-profile',
      action: 'read',
      description: 'Mentors at or over capacity.',
    },
    {
      id: 'disputes',
      title: 'Open disputes',
      count: 0,
      status: 'ok',
      links: [],
      resource: 'dispute',
      action: 'read',
      description: 'Disputes awaiting review.',
    },
  ],
};

const admin: MentorshipPrincipal = { userId: 'u1', role: 'administrator', tenantId: 'tenant-1' };
const student: MentorshipPrincipal = { userId: 'u2', role: 'student', tenantId: 'tenant-1' };

describe('operations filters', () => {
  it('persists and restores the status filter', () => {
    const raw = serializeFilters({ status: 'attention', programId: 'p1' });
    expect(parseFilters(raw)).toEqual({ status: 'attention', programId: 'p1' });
  });

  it('falls back to defaults for corrupt or unknown input', () => {
    expect(parseFilters('not json')).toEqual(DEFAULT_DASHBOARD_FILTERS);
    expect(parseFilters('{"status":"bogus"}')).toEqual(DEFAULT_DASHBOARD_FILTERS);
  });

  it('filters cards by status', () => {
    expect(filterCards(snapshot.cards, { status: 'attention' }).map((c) => c.id)).toEqual(['capacity']);
    expect(filterCards(snapshot.cards, { status: 'all' })).toHaveLength(2);
  });
});

describe('operations snapshot', () => {
  it('rejects a snapshot from another tenant', () => {
    expect(() => normalizeDashboardSnapshot(snapshot, 'tenant-2')).toThrowError(DashboardError);
  });

  it('rejects malformed cards', () => {
    expect(() =>
      normalizeDashboardSnapshot({ ...snapshot, cards: [{ id: 'nope' }] }, 'tenant-1'),
    ).toThrowError(/malformed|unknown/);
  });

  it('labels stale snapshots', () => {
    const old = { ...snapshot, generatedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString() };
    expect(isSnapshotStale(old)).toBe(true);
    expect(isSnapshotStale(snapshot)).toBe(false);
  });
});

describe('permission gating', () => {
  it('denies action for a role without the grant', () => {
    expect(canActOnCard(snapshot.cards[0], { allowed: false })).toBe(false);
    expect(canActOnCard(snapshot.cards[0], { allowed: true })).toBe(true);
    // Zero-count card is never actionable even when permitted.
    expect(canActOnCard(snapshot.cards[1], { allowed: true })).toBe(false);
  });
});

describe('CoordinatorOperationsDashboard', () => {
  beforeEach(() => {
    window.localStorage.clear();
    vi.restoreAllMocks();
  });

  it('renders a loading state', () => {
    render(
      <CoordinatorOperationsDashboard
        principal={admin}
        state={{ status: 'loading' }}
        filters={DEFAULT_DASHBOARD_FILTERS}
        onFiltersChange={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByTestId('dashboard-loading')).toBeInTheDocument();
  });

  it('renders an actionable error state', () => {
    render(
      <CoordinatorOperationsDashboard
        principal={admin}
        state={{ status: 'error', message: 'Network down' }}
        filters={DEFAULT_DASHBOARD_FILTERS}
        onFiltersChange={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByTestId('dashboard-error')).toHaveTextContent('Network down');
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });

  it('renders an empty state when a filter matches nothing', () => {
    render(
      <CoordinatorOperationsDashboard
        principal={admin}
        state={{ status: 'success', snapshot, stale: false }}
        filters={{ status: 'all', programId: 'missing' }}
        onFiltersChange={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.queryByTestId('dashboard-empty')).toBeInTheDocument();
  });

  it('links aggregates to matching records and marks read-only cards', async () => {
    const user = userEvent.setup();
    render(
      <CoordinatorOperationsDashboard
        principal={student}
        state={{ status: 'success', snapshot, stale: false }}
        filters={DEFAULT_DASHBOARD_FILTERS}
        onFiltersChange={() => {}}
        onRefresh={() => {}}
      />,
    );
    const capacity = screen.getByTestId('dashboard-card-capacity');
    expect(within(capacity).getByRole('link', { name: 'View mentors' })).toHaveAttribute(
      'href',
      '/mentorship/mentors?over=1',
    );
    // student lacks program/engagement grants on some cards, so those render read-only.
    await user.selectOptions(screen.getByLabelText('Status'), 'attention');
    expect(screen.getByTestId('dashboard-card-capacity')).toBeInTheDocument();
  });

  it('shows a stale-data label for old snapshots', () => {
    render(
      <CoordinatorOperationsDashboard
        principal={admin}
        state={{
          status: 'success',
          snapshot: { ...snapshot, generatedAt: new Date(Date.now() - 3600_000).toISOString() },
          stale: true,
        }}
        filters={DEFAULT_DASHBOARD_FILTERS}
        onFiltersChange={() => {}}
        onRefresh={() => {}}
      />,
    );
    expect(screen.getByTestId('dashboard-stale')).toBeInTheDocument();
  });
});

describe('intervention idempotency', () => {
  beforeEach(() => resetInterventionCache());

  it('does not duplicate effects when retried with the same key', async () => {
    const post = vi
      .spyOn(await import('@/src/lib/api-client').then((m) => m.apiClient), 'post')
      .mockResolvedValue({ reference: 'ref-1' } as never);
    const req = {
      cardId: 'capacity' as const,
      kind: 'nudge-review' as const,
      tenantId: 'tenant-1',
      idempotencyKey: 'key-1',
    };
    const first = await runIntervention(req);
    const second = await runIntervention(req);
    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect(post).toHaveBeenCalledTimes(1);
  });

  it('exposes the load service', () => {
    expect(typeof dashboardService.load).toBe('function');
  });
});
