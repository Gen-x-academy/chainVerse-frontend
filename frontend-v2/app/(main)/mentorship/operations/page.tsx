'use client';

/**
 * Coordinator operations dashboard route (closes #1363, MENTOR-116).
 * Role-aware navigation and a deny-by-default guard wrap the dashboard.
 */

import React from 'react';
import { useAuthStore } from '@/src/store/authStore';
import {
  MentorshipPageShell,
  canAccessMentorshipArea,
  type MentorshipPrincipal,
  type MentorshipRole,
  toMentorshipRole,
} from '@/src/features/mentorship';
import {
  DEFAULT_DASHBOARD_FILTERS,
  CoordinatorOperationsDashboard,
  dashboardService,
  type DashboardFilters,
  type DashboardLoadState,
} from '@/src/features/mentorship/operations';

const NAV_ITEMS = [
  { href: '/mentorship', label: 'Overview' },
  { href: '/mentorship/roles', label: 'Roles & permissions' },
  { href: '/mentorship/config', label: 'Capabilities' },
  { href: '/mentorship/operations', label: 'Operations' },
];

export default function MentorOperationsPage() {
  const user = useAuthStore((state) => state.user);
  const role = user?.role;
  const allowed = canAccessMentorshipArea(role, 'operations');

  const [filters, setFilters] = React.useState<DashboardFilters>(DEFAULT_DASHBOARD_FILTERS);
  const [state, setState] = React.useState<DashboardLoadState>({ status: 'loading' });

  const tenantId = user?.tenantId ?? 'platform';
  const principal: MentorshipPrincipal = {
    userId: user?.id ?? 'anonymous',
    role: (role === 'admin' ? 'administrator' : toMentorshipRole(role) ?? 'student') as MentorshipRole,
    tenantId,
  };

  const load = React.useCallback(async () => {
    setState({ status: 'loading' });
    try {
      const snapshot = await dashboardService.load({ tenantId, filters });
      setState({ status: 'success', snapshot, stale: dashboardService.isStale(snapshot) });
    } catch (error) {
      setState({
        status: 'error',
        message: error instanceof Error ? error.message : 'The dashboard could not be loaded.',
      });
    }
  }, [tenantId, filters]);

  React.useEffect(() => {
    if (!allowed) return;
    void load();
  }, [allowed, load]);

  return (
    <MentorshipPageShell
      allowed={allowed}
      title="Coordinator operations"
      description="Capacity, review queues, unmatched participants, expiring proposals, schedule risks, overdue milestones, and disputes."
      activeHref="/mentorship/operations"
      navItems={NAV_ITEMS}
    >
      <CoordinatorOperationsDashboard
        principal={principal}
        state={state}
        filters={filters}
        onFiltersChange={setFilters}
        onRefresh={() => void load()}
      />
    </MentorshipPageShell>
  );
}
