'use client';

/**
 * Library Reports page — condition reports, repair tickets, lost-item cases.
 *
 * Real mutations:  all three tabs call reportsService via React Query hooks.
 * Permission gate: page and individual features are hidden when the signed-in
 *                  user lacks the `reports` librarian permission.
 * No demo data:    mock patrons/items are not shipped; data comes from the API.
 * Sensitive fields: patronId / patronName are forwarded only when the auth role
 *                   includes the `patrons` permission (server enforces this too).
 */

import React, { useMemo } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { AlertCircle, ShieldOff } from 'lucide-react';
import { LibrarianLayout } from '@/components/elibrary/LibrarianLayout';
import { ItemConditionReport } from '@/components/elibrary/ItemConditionReport';
import { RepairTracking } from '@/components/elibrary/RepairTracking';
import { LostItemResolution } from '@/components/elibrary/LostItemResolution';
import { useLibrarianPermissions, hasLibrarianPermission } from '@/src/features/library/hooks/useLibrarianPermissions';
import { useAuthStore } from '@/src/store/authStore';
import {
  useConditionReport,
  useUpdateConditionReport,
  useRepairTickets,
  useCreateRepairTicket,
  useUpdateRepairTicket,
  useLostItemCases,
  useResolveLostItem,
} from '@/src/features/library/hooks/useReports';
import { canViewCostData } from '@/src/features/library/hooks/useLibrarianPermissions';
import type {
  UpdateConditionPayload,
  CreateRepairTicketPayload,
  UpdateRepairTicketPayload,
  ResolveLostItemPayload,
  LostItemStatus,
} from '@/src/features/library/types/reports.types';

// ─── Static configuration (no patron/item names) ─────────────────────────────

/**
 * Conditions for which a staff note is mandatory before submitting.
 * This is a UI-level guard; the server validates independently.
 */
const REQUIRES_NOTES_FOR_CONDITIONS = ['damaged', 'lost', 'in-repair'] as const;

/**
 * Consequences shown to staff before they confirm a condition change.
 * These mirror the server-side business rules and must be kept in sync.
 */
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { ItemConditionReport } from '@/components/elibrary/ItemConditionReport';
import { LostItemResolution } from '@/components/elibrary/LostItemResolution';
import { RepairTracking } from '@/components/elibrary/RepairTracking';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  useLibrarianPermissions,
  hasLibrarianPermission,
} from '@/src/features/library/hooks/useLibrarianPermissions';
import {
  canPerformLibrarianAction,
} from '@/src/features/library/utils/librarian-permissions';
import { useReportsData } from '@/src/features/library/hooks/useReportsData';

/**
 * Which conditions on an item require a mandatory notes field.
 * Matches the business rules enforced by the back-end.
 */
const REQUIRES_NOTES_FOR_CONDITIONS = ['damaged', 'lost', 'in-repair'] as const;

const CONDITION_PATRON_CONSEQUENCES = {
  good: [],
  worn: [],
  damaged: [
    'A damage fee will be assessed on the patron account.',
    'Borrowing privileges may be restricted until the fee is paid.',
  ],
  lost: [
    'Patron will be charged the full replacement cost.',
    'Borrowing privileges are suspended until payment is received.',
    'Patron account will be charged a damage fee',
    'Borrowing privileges may be restricted until fee is paid',
  ],
  lost: [
    'Patron will be charged the full replacement cost',
    'Borrowing privileges suspended until payment is received',
  ],
  'in-repair': [],
} as const;

const LOST_ITEM_REQUIRES_NOTES: LostItemStatus[] = ['paid', 'waived', 'disputed'];

const LOST_ITEM_PATRON_CONSEQUENCES: Record<LostItemStatus, string[]> = {
  found: ['Patron borrowing privileges reinstated.', 'All outstanding fees waived.'],
  paid: ['Payment marked as received.', 'Account returned to good standing.'],
  replaced: ['Replacement item catalogued.', 'Patron account cleared.'],
  waived: ['Fees waived by library administration.', 'Patron account cleared.'],
  disputed: [
    'Patron account placed on hold.',
    'Investigation initiated.',
    'Borrowing privileges suspended pending resolution.',
  ],
};

// ─── Sub-panel: Condition Reports ─────────────────────────────────────────────

/**
 * Renders the condition report for a single selected item.
 * In a full implementation, a search / list would precede this panel so staff
 * can choose which item to inspect.  The itemId would come from URL params or
 * a selection component; hard-coding it here would ship demo data, so we
 * instead show a placeholder until itemId is provided.
 */
function ConditionReportPanel({ itemId }: { itemId: string | null }) {
  const { data, isLoading, error } = useConditionReport(itemId ?? '');
  const updateMutation = useUpdateConditionReport(itemId ?? '');
  const role = useAuthStore((s) => s.user?.role);
  const showPatronInfo = canViewCostData(role) || role === 'admin'; // patrons permission check

  if (!itemId) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        Select an item from the catalog to view or update its condition report.
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading condition report">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-20 w-full" />
      </div>
    );
  }

  if (error) {
    const is403 = (error as { statusCode?: number })?.statusCode === 403;
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {is403
            ? 'You do not have permission to view condition reports.'
            : `Failed to load condition report: ${error.message}`}
        </AlertDescription>
      </Alert>
    );
  }

  if (!data) return null;

  // Strip patron identity when the current role has no patron access.
  const report = showPatronInfo
    ? data
    : { ...data, patronId: undefined, patronName: undefined };

  const handleSubmit = async (updates: Partial<typeof report>) => {
    if (!updates.currentCondition || !updates.repairStatus) return;
    const payload: UpdateConditionPayload = {
      currentCondition: updates.currentCondition,
      repairStatus: updates.repairStatus,
      notes: updates.notes ?? '',
    };
    await updateMutation.mutateAsync({ payload });
  };

  return (
    <ItemConditionReport
      report={report}
      isLoading={updateMutation.isPending}
      error={updateMutation.isError ? updateMutation.error?.message : undefined}
      success={updateMutation.isSuccess ? 'Condition report updated.' : undefined}
      onSubmit={handleSubmit}
      requiresNotesForStatus={[...REQUIRES_NOTES_FOR_CONDITIONS]}
      patronConsequences={CONDITION_PATRON_CONSEQUENCES}
    />
  );
}

// ─── Sub-panel: Repair Tickets ────────────────────────────────────────────────

function RepairTicketsPanel() {
  const { data, isLoading, error } = useRepairTickets();
  const createMutation = useCreateRepairTicket();
  const updateMutation = useUpdateRepairTicket();
  const role = useAuthStore((s) => s.user?.role);
  const showCosts = canViewCostData(role);

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading repair tickets">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 w-full" />
          ))}
        </div>
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  if (error) {
    const is403 = (error as { statusCode?: number })?.statusCode === 403;
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {is403
            ? 'You do not have permission to view repair tickets.'
            : `Failed to load repair tickets: ${error.message}`}
        </AlertDescription>
      </Alert>
    );
  }

  const tickets = (data?.data ?? []).map((t) =>
    showCosts ? t : { ...t, estimatedCost: undefined, actualCost: undefined }
  );

  const handleCreate = async (ticket: CreateRepairTicketPayload) => {
    await createMutation.mutateAsync(ticket);
  };

  const handleUpdate = async (id: string, updates: UpdateRepairTicketPayload) => {
    await updateMutation.mutateAsync({ ticketId: id, payload: updates });
  };

  const mutationError =
    createMutation.isError || updateMutation.isError
      ? (createMutation.error ?? updateMutation.error)?.message
      : undefined;

  return (
    <>
      {mutationError && (
        <Alert variant="destructive" role="alert" className="mb-4">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{mutationError}</AlertDescription>
        </Alert>
      )}
      <RepairTracking
        tickets={tickets}
        isLoading={createMutation.isPending || updateMutation.isPending}
        onCreateTicket={handleCreate}
        onUpdateTicket={handleUpdate}
      />
    </>
  );
}

// ─── Sub-panel: Lost Items ────────────────────────────────────────────────────

function LostItemsPanel() {
  const { data, isLoading, error } = useLostItemCases();
  const role = useAuthStore((s) => s.user?.role);
  const showPatronInfo = role === 'admin';

  if (isLoading) {
    return (
      <div className="space-y-4" aria-busy="true" aria-label="Loading lost item cases">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    );
  }

  if (error) {
    const is403 = (error as { statusCode?: number })?.statusCode === 403;
    return (
      <Alert variant="destructive" role="alert">
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          {is403
            ? 'You do not have permission to view lost item cases.'
            : `Failed to load lost item cases: ${error.message}`}
        </AlertDescription>
      </Alert>
    );
  }

  const cases = data?.data ?? [];

  if (cases.length === 0) {
    return (
      <div className="flex items-center justify-center rounded-lg border border-dashed p-12 text-center text-sm text-muted-foreground">
        No open lost-item cases.
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {cases.map((lostCase) => (
        <LostItemCaseRow
          key={lostCase.id}
          caseId={lostCase.id}
          itemTitle={lostCase.itemTitle}
          replacementCost={lostCase.replacementCost}
          status={lostCase.status}
          patronName={showPatronInfo ? lostCase.patronName : undefined}
          activityHistory={lostCase.activityHistory}
        />
      ))}
    </div>
  );
}

interface LostItemCaseRowProps {
  caseId: string;
  itemTitle: string;
  replacementCost: number;
  status: LostItemStatus;
  patronName?: string;
  activityHistory: import('@/src/features/library/types/reports.types').ActivityLog[];
}

function LostItemCaseRow({
  caseId,
  itemTitle,
  replacementCost,
  status,
  patronName,
  activityHistory,
}: LostItemCaseRowProps) {
  const resolveMutation = useResolveLostItem(caseId);

  const handleResolve = async (newStatus: LostItemStatus, notes: string) => {
    const payload: ResolveLostItemPayload = { status: newStatus, notes };
    await resolveMutation.mutateAsync({ payload });
  };

  return (
    <LostItemResolution
      itemTitle={itemTitle}
      replacementCost={replacementCost}
      status={status}
      patronName={patronName}
      activityHistory={activityHistory}
      isLoading={resolveMutation.isPending}
      error={resolveMutation.isError ? resolveMutation.error?.message : undefined}
      success={resolveMutation.isSuccess ? 'Lost item status updated.' : undefined}
      onResolve={handleResolve}
      requiresNotesForStatus={LOST_ITEM_REQUIRES_NOTES}
      patronConsequences={LOST_ITEM_PATRON_CONSEQUENCES}
    />
  );
}

// ─── Page root ─────────────────────────────────────────────────────────────────

export default function LibraryReportsPage() {
  const role = useAuthStore((s) => s.user?.role);
  const permissions = useLibrarianPermissions(role);
  const canAccess = hasLibrarianPermission(permissions, 'reports');

  /**
   * In a real app, the selected itemId would come from a search widget or URL
   * query param. We pass null here so the condition-report panel shows the
   * "select an item" placeholder without shipping any demo item IDs.
   */
  const selectedItemId: string | null = null;

  if (!canAccess) {
    return (
      <LibrarianLayout
        permissions={permissions}
        activeHref="/library/reports"
        title="Reports & item management"
      >
        <Alert role="alert" className="max-w-lg">
          <ShieldOff className="h-4 w-4" />
          <AlertDescription>
            You do not have permission to access the Reports section.
          </AlertDescription>
        </Alert>
      </LibrarianLayout>
    );
  }

  return (
    <LibrarianLayout
      permissions={permissions}
      activeHref="/library/reports"
      title="Reports & item management"
    >
      <p className="text-muted-foreground mb-6">
        Manage item conditions, track repairs, and resolve lost-item cases.
      </p>

      <Tabs defaultValue="condition-reports" className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="condition-reports">Condition reports</TabsTrigger>
          <TabsTrigger value="repair-tracking">Repair tracking</TabsTrigger>
          <TabsTrigger value="lost-items">Lost items</TabsTrigger>
        </TabsList>

        <TabsContent value="condition-reports" className="mt-6">
          <ConditionReportPanel itemId={selectedItemId} />
        </TabsContent>

        <TabsContent value="repair-tracking" className="mt-6">
          <RepairTicketsPanel />
        </TabsContent>

        <TabsContent value="lost-items" className="mt-6">
          <LostItemsPanel />
        </TabsContent>
      </Tabs>
    </LibrarianLayout>
  );
}
const LOST_ITEM_REQUIRES_NOTES = ['paid', 'waived', 'disputed'] as const;

const LOST_ITEM_PATRON_CONSEQUENCES = {
  found: ['Patron borrowing privileges reinstated', 'All outstanding fees waived'],
  paid: ['Payment marked as received', 'Account restored to good standing'],
  replaced: ['Item replaced in catalog', 'Patron account cleared'],
  waived: ['Fees waived by library administration', 'Patron account cleared'],
  disputed: [
    'Patron account placed on hold',
    'Investigation initiated',
    'Borrowing privileges suspended',
  ],
} as const;

export default function LibraryReportsPage() {
  const permissions = useLibrarianPermissions();

  const canManageCondition = canPerformLibrarianAction(permissions, 'reports.condition');
  const canManageRepairs = canPerformLibrarianAction(permissions, 'reports.repair');
  const canManageLostItems = canPerformLibrarianAction(permissions, 'reports.lost-item');

  const {
    conditionReport,
    conditionLoading,
    conditionError,
    lostItem,
    lostItemLoading,
    lostItemError,
    repairTickets,
    repairLoading,
    repairError,
    submitConditionReport,
    resolveLostItem,
    createRepairTicket,
    updateRepairTicket,
  } = useReportsData({
    enableCondition: canManageCondition,
    enableLostItem: canManageLostItems,
    enableRepairs: canManageRepairs,
  });

  return (
    <LibraryAdminLayout requiredPermission="reports" activeHref="/library/reports">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Reports &amp; Item Management</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage item conditions, track repairs, and resolve lost items.
          </p>
        </div>

        <Tabs defaultValue="condition-reports" className="w-full">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="condition-reports" disabled={!canManageCondition}>
              Condition Reports
            </TabsTrigger>
            <TabsTrigger value="repair-tracking" disabled={!canManageRepairs}>
              Repair Tracking
            </TabsTrigger>
            <TabsTrigger value="lost-items" disabled={!canManageLostItems}>
              Lost Item Resolution
            </TabsTrigger>
          </TabsList>

          {/* Condition Reports */}
          <TabsContent value="condition-reports" className="mt-6">
            {canManageCondition ? (
              <ItemConditionReport
                report={conditionReport ?? undefined}
                isLoading={conditionLoading}
                error={conditionError ?? undefined}
                onSubmit={submitConditionReport}
                requiresNotesForStatus={[...REQUIRES_NOTES_FOR_CONDITIONS]}
                patronConsequences={CONDITION_PATRON_CONSEQUENCES}
              />
            ) : (
              <p role="alert" className="text-sm text-red-600">
                You do not have permission to manage condition reports.
              </p>
            )}
          </TabsContent>

          {/* Repair Tracking */}
          <TabsContent value="repair-tracking" className="mt-6">
            {canManageRepairs ? (
              <RepairTracking
                tickets={repairTickets ?? []}
                isLoading={repairLoading}
                error={repairError ?? undefined}
                onCreateTicket={createRepairTicket}
                onUpdateTicket={updateRepairTicket}
              />
            ) : (
              <p role="alert" className="text-sm text-red-600">
                You do not have permission to manage repair tickets.
              </p>
            )}
          </TabsContent>

          {/* Lost Item Resolution */}
          <TabsContent value="lost-items" className="mt-6">
            {canManageLostItems ? (
              lostItem ? (
                <LostItemResolution
                  itemTitle={lostItem.itemTitle}
                  replacementCost={lostItem.replacementCost}
                  status={lostItem.status}
                  patronName={lostItem.patronName}
                  activityHistory={lostItem.activityHistory}
                  isLoading={lostItemLoading}
                  error={lostItemError ?? undefined}
                  onResolve={resolveLostItem}
                  requiresNotesForStatus={[...LOST_ITEM_REQUIRES_NOTES]}
                  patronConsequences={LOST_ITEM_PATRON_CONSEQUENCES}
                />
              ) : (
                !lostItemLoading && (
                  <p className="text-sm text-gray-500">No active lost-item cases.</p>
                )
              )
            ) : (
              <p role="alert" className="text-sm text-red-600">
                You do not have permission to manage lost item resolutions.
              </p>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </LibraryAdminLayout>
  );
}
