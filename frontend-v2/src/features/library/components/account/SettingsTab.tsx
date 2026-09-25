'use client';

import React, { useCallback } from 'react';
import { AutoRenewalStatus } from '@/components/elibrary/AutoRenewalStatus';
import LibraryNotificationList from '@/components/elibrary/LibraryNotificationList';
import { Bell } from 'lucide-react';
import {
  useAccountNotifications,
  useAutoRenewal,
  useCurrentLoans,
  useUpdateAutoRenewal,
} from '../../hooks/usePatronAccount';
import type { LoanAutoRenewal } from '@/components/elibrary/AutoRenewalStatus';
import type { LibraryNotification } from '@/components/elibrary/LibraryNotificationList';

export interface SettingsTabProps {
  patronId?: string;
}

const EMPTY_PREFS = { enabled: false, notifyBeforeRenewal: false, notifyOnFailure: false };

export function SettingsTab({ patronId }: SettingsTabProps) {
  const loansQuery = useCurrentLoans(patronId);
  const prefsQuery = useAutoRenewal(patronId);
  const notificationsQuery = useAccountNotifications(patronId);
  const updatePrefs = useUpdateAutoRenewal(patronId);

  const preferences = prefsQuery.data
    ? {
        enabled: prefsQuery.data.enabled,
        notifyBeforeRenewal: prefsQuery.data.notifyBeforeRenewal,
        notifyOnFailure: prefsQuery.data.notifyOnFailure,
      }
    : EMPTY_PREFS;

  const autoRenewalLoans: LoanAutoRenewal[] = (loansQuery.data ?? []).map((loan) => ({
    id: loan.id,
    title: loan.title,
    eligible: loan.canRenew,
    enabled: loan.canRenew && preferences.enabled,
    nextEvaluationDate: loan.currentDueDate,
    currentDueDate: loan.currentDueDate,
    renewalsUsed: loan.renewalsUsed,
    maxRenewals: loan.maxRenewals,
  }));

  const handleUpdatePreferences = useCallback(
    (next: { enabled: boolean; notifyBeforeRenewal: boolean; notifyOnFailure: boolean }) => {
      updatePrefs.mutate({
        enabled: next.enabled,
        notifyBeforeRenewal: next.notifyBeforeRenewal,
        notifyOnFailure: next.notifyOnFailure,
      });
    },
    [updatePrefs]
  );

  const notifications = notificationsQuery.data ?? [];

  return (
    <div className="space-y-8">
      <section aria-label="Auto-renewal preferences">
        <AutoRenewalStatus
          loans={autoRenewalLoans}
          preferences={preferences}
          isLoading={loansQuery.isLoading || prefsQuery.isLoading}
          error={
            loansQuery.isError || prefsQuery.isError
              ? (loansQuery.error ?? prefsQuery.error) instanceof Error
                ? ((loansQuery.error ?? prefsQuery.error) as Error).message
                : 'Failed to load auto-renewal preferences.'
              : null
          }
          scope="account"
          onUpdatePreferences={handleUpdatePreferences}
          className="max-w-2xl"
        />
      </section>

      <section aria-label="Library notifications">
        <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold text-gray-900">
          <Bell className="h-5 w-5 text-indigo-500" aria-hidden="true" />
          Notifications
        </h2>
        {notificationsQuery.isLoading ? (
          <div className="space-y-2" aria-busy="true" aria-label="Loading notifications">
            {[1, 2].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-lg border bg-gray-100" />
            ))}
          </div>
        ) : notificationsQuery.isError ? (
          <p role="alert" className="text-sm text-red-600">
            {notificationsQuery.error instanceof Error
              ? notificationsQuery.error.message
              : 'Unable to load notifications.'}
          </p>
        ) : (
          <div className="rounded-lg border border-gray-200 bg-white">
            <LibraryNotificationList
              notifications={notifications}
              onOpen={() => {}}
            />
          </div>
        )}
      </section>
    </div>
  );
}

export type { LibraryNotification };