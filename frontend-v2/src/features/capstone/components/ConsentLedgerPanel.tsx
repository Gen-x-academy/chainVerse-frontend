'use client';

import React, { useId, useState } from 'react';
import {
  CONSENT_PURPOSES,
  PURPOSE_DEFINITIONS,
  grantConsent,
  withdrawConsent,
  type ConsentActor,
  type ConsentPurpose,
  type ConsentRecord,
  type ConsentLedgerStore,
  createConsentLedgerStore,
  initializeProjectConsents,
} from '../consent-ledger';
import {
  CapstoneConflictState,
  CapstoneConfirmationModal,
  CapstoneEmptyState,
  CapstoneErrorState,
  CapstoneLoadingState,
  CapstonePermissionDeniedState,
  CapstoneSuccessState,
} from './CapstoneSharedStates';

export interface ConsentLedgerPanelProps {
  projectId: string;
  participantId: string;
  organizationId: string;
  actor: ConsentActor;
  initialRecords?: ConsentRecord[];
  onConsentChanged?: (record: ConsentRecord) => void;
}

export function ConsentLedgerPanel({
  projectId,
  participantId,
  organizationId,
  actor,
  initialRecords,
  onConsentChanged,
}: ConsentLedgerPanelProps) {
  const headingId = useId();
  const [store, setStore] = useState<ConsentLedgerStore>(() => {
    const records =
      initialRecords && initialRecords.length > 0
        ? initialRecords
        : initializeProjectConsents(projectId, participantId, organizationId, new Date().toISOString());
    return createConsentLedgerStore(records);
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [conflictMessage, setConflictMessage] = useState<string | null>(null);
  const [successNotice, setSuccessNotice] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<{
    purpose: ConsentPurpose;
    action: 'grant' | 'withdraw';
    recordId: string;
    expectedRevision: number;
    consequential: boolean;
    warning?: string;
  } | null>(null);

  const isAuthorized =
    actor.organizationId === organizationId &&
    (actor.id === participantId || actor.role === 'administrator');

  if (!isAuthorized) {
    return (
      <CapstonePermissionDeniedState
        message="You are not authorized to inspect or modify consent records for this participant."
      />
    );
  }

  const recordsList = CONSENT_PURPOSES.map((purpose) => {
    const existing = Array.from(store.records.values()).find(
      (r) => r.purpose === purpose && r.participantId === participantId && r.projectId === projectId
    );
    const def = PURPOSE_DEFINITIONS[purpose];
    return {
      purpose,
      def,
      record: existing ?? {
        id: `cns_${projectId}_${participantId}_${purpose}`,
        projectId,
        participantId,
        organizationId,
        purpose,
        state: 'pending' as const,
        required: !def.isOptional,
        updatedAt: new Date().toISOString(),
        revision: 1,
      },
    };
  });

  const handleExecuteAction = (
    purpose: ConsentPurpose,
    action: 'grant' | 'withdraw',
    recordId: string,
    expectedRevision: number
  ) => {
    setIsLoading(true);
    setErrorMessage(null);
    setConflictMessage(null);
    setSuccessNotice(null);

    const now = new Date().toISOString();
    const requestId = `req_${action}_${purpose}_${Date.now()}`;

    if (action === 'grant') {
      const result = grantConsent(store, {
        requestId,
        recordId,
        projectId,
        participantId,
        organizationId,
        purpose,
        actor,
        now,
        expectedRevision,
      });

      if (result.ok) {
        setStore(createConsentLedgerStore(Array.from(store.records.values())));
        setSuccessNotice(`Consent granted for ${PURPOSE_DEFINITIONS[purpose].title}.`);
        onConsentChanged?.(result.value);
      } else if (result.code === 'STALE_REVISION') {
        setConflictMessage(`The consent record for ${PURPOSE_DEFINITIONS[purpose].title} was updated elsewhere.`);
      } else {
        setErrorMessage(result.message);
      }
    } else {
      const result = withdrawConsent(store, {
        requestId,
        recordId,
        projectId,
        participantId,
        organizationId,
        actor,
        now,
        expectedRevision,
      });

      if (result.ok) {
        setStore(createConsentLedgerStore(Array.from(store.records.values())));
        setSuccessNotice(`Consent withdrawn for ${PURPOSE_DEFINITIONS[purpose].title}.`);
        onConsentChanged?.(result.value);
      } else if (result.code === 'STALE_REVISION') {
        setConflictMessage(`The consent record for ${PURPOSE_DEFINITIONS[purpose].title} was updated elsewhere.`);
      } else {
        setErrorMessage(result.message);
      }
    }

    setIsLoading(false);
    setPendingAction(null);
  };

  const handleRequestAction = (
    purpose: ConsentPurpose,
    action: 'grant' | 'withdraw',
    recordId: string,
    expectedRevision: number
  ) => {
    const def = PURPOSE_DEFINITIONS[purpose];
    if (action === 'withdraw' && def.isConsequentialOnWithdrawal) {
      setPendingAction({
        purpose,
        action,
        recordId,
        expectedRevision,
        consequential: true,
        warning: def.consequentialWarning,
      });
    } else {
      handleExecuteAction(purpose, action, recordId, expectedRevision);
    }
  };

  const getStateBadgeClass = (state: string) => {
    switch (state) {
      case 'granted':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'withdrawn':
        return 'bg-amber-100 text-amber-800 border-amber-200';
      case 'expired':
        return 'bg-red-100 text-red-800 border-red-200';
      case 'unavailable':
        return 'bg-gray-100 text-gray-800 border-gray-200';
      default:
        return 'bg-blue-100 text-blue-800 border-blue-200';
    }
  };

  return (
    <div className="space-y-6" aria-labelledby={headingId}>
      <header className="border-b border-gray-200 pb-4">
        <h2 id={headingId} className="text-xl font-bold text-gray-900">
          Capstone Consent Ledger
        </h2>
        <p className="mt-1 text-sm text-gray-600">
          Manage purpose-specific consent for project participation, verification, and data processing.
          Every purpose is controlled separately and privacy-preserved.
        </p>
      </header>

      {isLoading && <CapstoneLoadingState label="Updating consent record…" />}
      {errorMessage && <CapstoneErrorState message={errorMessage} onRetry={() => setErrorMessage(null)} />}
      {conflictMessage && (
        <CapstoneConflictState
          message={conflictMessage}
          onRefresh={() => {
            setConflictMessage(null);
            setStore(createConsentLedgerStore(Array.from(store.records.values())));
          }}
        />
      )}
      {successNotice && <CapstoneSuccessState>{successNotice}</CapstoneSuccessState>}

      <div className="divide-y divide-gray-200 rounded-lg border border-gray-200 bg-white shadow-sm">
        {recordsList.map(({ purpose, def, record }) => {
          const isGranted = record.state === 'granted';
          const isUnavailable = record.state === 'unavailable';

          return (
            <section
              key={purpose}
              aria-labelledby={`consent-title-${purpose}`}
              className="p-5 transition-colors hover:bg-gray-50/50"
            >
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="flex-1 space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3
                      id={`consent-title-${purpose}`}
                      className="text-base font-semibold text-gray-900"
                    >
                      {def.title}
                    </h3>
                    <span
                      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize ${getStateBadgeClass(
                        record.state
                      )}`}
                    >
                      {record.state}
                    </span>
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                        def.isOptional
                          ? 'bg-gray-100 text-gray-700'
                          : 'bg-indigo-50 text-indigo-700 font-semibold'
                      }`}
                    >
                      {def.isOptional ? 'Optional' : 'Required for Active Research'}
                    </span>
                  </div>

                  <p className="text-sm text-gray-600">{def.description}</p>

                  <div className="rounded bg-gray-50 p-2.5 text-xs text-gray-500">
                    <span className="font-medium text-gray-700">Data covered:</span> {def.dataCovered}
                  </div>

                  {record.updatedAt && (
                    <div className="text-xs text-gray-400">
                      Revision: {record.revision} • Last updated: {new Date(record.updatedAt).toLocaleString()}
                    </div>
                  )}
                </div>

                <div className="flex sm:flex-col items-center sm:items-end gap-2 shrink-0">
                  {isGranted ? (
                    <button
                      type="button"
                      disabled={isUnavailable || isLoading}
                      onClick={() =>
                        handleRequestAction(purpose, 'withdraw', record.id, record.revision)
                      }
                      className="w-full sm:w-auto rounded border border-red-300 bg-white px-3 py-1.5 text-xs font-semibold text-red-700 hover:bg-red-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500 disabled:opacity-50"
                    >
                      Withdraw consent
                    </button>
                  ) : (
                    <button
                      type="button"
                      disabled={isUnavailable || isLoading}
                      onClick={() =>
                        handleRequestAction(purpose, 'grant', record.id, record.revision)
                      }
                      className="w-full sm:w-auto rounded bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-blue-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 disabled:opacity-50"
                    >
                      Grant consent
                    </button>
                  )}
                </div>
              </div>
            </section>
          );
        })}
      </div>

      <CapstoneConfirmationModal
        isOpen={Boolean(pendingAction)}
        title="Consequential Consent Change"
        description={
          pendingAction?.warning ??
          'Withdrawing consent for this purpose has consequences for your project access and review eligibility.'
        }
        confirmLabel="Confirm withdrawal"
        isDestructive={true}
        onConfirm={() => {
          if (pendingAction) {
            handleExecuteAction(
              pendingAction.purpose,
              pendingAction.action,
              pendingAction.recordId,
              pendingAction.expectedRevision
            );
          }
        }}
        onCancel={() => setPendingAction(null)}
      />
    </div>
  );
}
