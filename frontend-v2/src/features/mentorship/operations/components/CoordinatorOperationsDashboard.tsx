'use client';

/**
 * Coordinator operations dashboard (closes #1363, MENTOR-116).
 *
 * Renders the coordinator queues as accessible cards with explicit
 * loading / empty / error / success states. Filters persist across loads,
 * aggregates link to the matching records, stale snapshots are labeled, and
 * every action is gated per card by the deny-by-default RBAC guard.
 */

import React from 'react';
import Link from 'next/link';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import {
  canPerformMentorshipAction,
  type MentorshipPrincipal,
} from '@/src/features/mentorship/rbac';
import {
  canActOnCard,
  filterCards,
  isSnapshotStale,
  parseFilters,
  serializeFilters,
  type DashboardCardData,
  type DashboardFilters,
  type DashboardLoadState,
} from './types';

const FILTER_STORAGE_KEY = 'mentorship.operations.filters';

export interface CoordinatorOperationsDashboardProps {
  principal: MentorshipPrincipal;
  state: DashboardLoadState;
  filters: DashboardFilters;
  onFiltersChange: (filters: DashboardFilters) => void;
  onRefresh: () => void;
  renderLink?: (href: string) => React.ReactNode;
}

function CardShell({
  card,
  actionable,
  children,
}: {
  card: DashboardCardData;
  actionable: boolean;
  children: React.ReactNode;
}) {
  return (
    <article
      aria-labelledby={`card-${card.id}-title`}
      className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm"
      data-testid={`dashboard-card-${card.id}`}
    >
      <div className="flex items-start justify-between gap-2">
        <h3 id={`card-${card.id}-title`} className="text-sm font-semibold text-gray-900">
          {card.title}
        </h3>
        <span
          className="rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700"
          aria-label={`${card.count} records`}
        >
          {card.count}
        </span>
      </div>
      <p className="mt-1 text-xs text-gray-500">{card.description}</p>
      {!actionable && (
        <p className="mt-2 text-xs text-gray-400" data-testid={`card-${card.id}-readonly`}>
          Read-only for your role.
        </p>
      )}
      {children}
    </article>
  );
}

export function CoordinatorOperationsDashboard({
  principal,
  state,
  filters,
  onFiltersChange,
  onRefresh,
  renderLink,
}: CoordinatorOperationsDashboardProps) {
  const [hydrated, setHydrated] = React.useState(false);

  React.useEffect(() => {
    // Restore persisted filters on first mount only.
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem(FILTER_STORAGE_KEY) : null;
    if (stored) onFiltersChange(parseFilters(stored));
    setHydrated(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  React.useEffect(() => {
    if (!hydrated || typeof window === 'undefined') return;
    window.localStorage.setItem(FILTER_STORAGE_KEY, serializeFilters(filters));
  }, [filters, hydrated]);

  return (
    <section aria-label="Coordinator operations" className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Coordinator operations</h1>
          <p className="text-sm text-gray-600">
            Capacity, review queues, risks, milestones, and disputes in one view.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="dashboard-status-filter" className="text-sm text-gray-700">
            Status
          </label>
          <select
            id="dashboard-status-filter"
            value={filters.status}
            onChange={(event) =>
              onFiltersChange({ ...filters, status: event.target.value as DashboardFilters['status'] })
            }
            className="rounded-md border border-gray-300 px-2 py-1 text-sm"
          >
            <option value="all">All</option>
            <option value="attention">Needs attention</option>
            <option value="ok">On track</option>
          </select>
          <button
            type="button"
            onClick={onRefresh}
            className="inline-flex items-center gap-1 rounded-md border border-gray-300 px-3 py-1 text-sm hover:bg-gray-50"
          >
            <RefreshCw className="h-4 w-4" aria-hidden="true" />
            Refresh
          </button>
        </div>
      </header>

      {state.status === 'loading' && (
        <p role="status" aria-live="polite" className="text-sm text-gray-600" data-testid="dashboard-loading">
          Loading operations data…
        </p>
      )}

      {state.status === 'error' && (
        <div role="alert" className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <AlertTriangle className="mr-1 inline h-4 w-4" aria-hidden="true" />
          <span data-testid="dashboard-error">{state.message}</span>
          <button type="button" onClick={onRefresh} className="ml-2 underline">
            Try again
          </button>
        </div>
      )}

      {state.status === 'success' && (
        <>
          <p aria-live="polite" className="text-xs text-gray-500">
            {state.stale && (
              <span data-testid="dashboard-stale" className="mr-2 rounded bg-amber-100 px-2 py-0.5 text-amber-800">
                Stale data — last generated {new Date(state.snapshot.generatedAt).toLocaleString()}
              </span>
            )}
            {filterCards(state.snapshot.cards, filters).length} of {state.snapshot.cards.length} queues shown.
          </p>

          {filterCards(state.snapshot.cards, filters).length === 0 ? (
            <p className="rounded-md border border-dashed border-gray-300 p-6 text-center text-sm text-gray-500" data-testid="dashboard-empty">
              Nothing matches this filter. Coordinators have no outstanding queues.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filterCards(state.snapshot.cards, filters).map((card) => {
                const decision = canPerformMentorshipAction(
                  principal,
                  { resource: card.resource, tenantId: state.snapshot.tenantId },
                  card.action,
                );
                const actionable = canActOnCard(card, decision);
                return (
                  <CardShell key={card.id} card={card} actionable={actionable}>
                    {card.links.length > 0 ? (
                      <ul className="mt-2 space-y-1">
                        {card.links.map((link) => (
                          <li key={link.href}>
                            {renderLink ? (
                              renderLink(link.href)
                            ) : (
                              <Link href={link.href} className="text-sm text-blue-700 hover:underline">
                                {link.label}
                              </Link>
                            )}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs text-gray-400" data-testid={`card-${card.id}-empty`}>
                        No matching records.
                      </p>
                    )}
                  </CardShell>
                );
              })}
            </div>
          )}
        </>
      )}
    </section>
  );
}

export { isSnapshotStale };
