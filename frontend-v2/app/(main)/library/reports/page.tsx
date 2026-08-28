'use client';

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
    'Patron account will be charged a damage fee',
    'Borrowing privileges may be restricted until fee is paid',
  ],
  lost: [
    'Patron will be charged the full replacement cost',
    'Borrowing privileges suspended until payment is received',
  ],
  'in-repair': [],
} as const;

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
