'use client';

import React, { useId, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  FileCheck2,
  FileText,
  GitMerge,
  History,
  Lock,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Users,
} from 'lucide-react';
import {
  useDuplicateClusters,
  useMergeApplications,
  useMergeAuditHistory,
} from '../hooks';
import type {
  DuplicateCluster,
  ExistingApplicationSummary,
  MergeApplicationsPayload,
} from '../types';

export interface ApplicationMergeConsoleProps {
  userRole?: string;
  adminUserId?: string;
  className?: string;
}

export function ApplicationMergeConsole({
  userRole = 'administrator',
  adminUserId = 'admin-officer-1',
  className = '',
}: ApplicationMergeConsoleProps) {
  const isAdministrator = userRole === 'administrator' || userRole === 'reviewer';
  const reasonInputId = useId();

  // Queries & Mutations
  const {
    data: clusters,
    isLoading,
    isError,
    error,
    refetch,
  } = useDuplicateClusters();

  const { data: auditHistory } = useMergeAuditHistory();
  const mergeMutation = useMergeApplications();

  // UI state
  const [selectedClusterId, setSelectedClusterId] = useState<string | null>(null);
  const [primaryAppId, setPrimaryAppId] = useState<string>('');
  const [statementAppId, setStatementAppId] = useState<string>('');
  const [combineDocuments, setCombineDocuments] = useState(true);
  const [adminReason, setAdminReason] = useState('');
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  // Active cluster
  const activeCluster =
    clusters?.find((c) => c.clusterId === selectedClusterId) ?? clusters?.[0] ?? null;

  // Initialize selection when activeCluster changes
  React.useEffect(() => {
    if (activeCluster && activeCluster.applications.length >= 2) {
      setPrimaryAppId(activeCluster.applications[0].id);
      setStatementAppId(activeCluster.applications[0].id);
      setSelectedClusterId(activeCluster.clusterId);
    }
  }, [activeCluster]);

  const handleExecuteMerge = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!activeCluster) return;
    if (!adminReason.trim()) {
      setFormError('Administrative justification reason is mandatory for the audit log.');
      return;
    }

    const secondaryIds = activeCluster.applications
      .map((app) => app.id)
      .filter((id) => id !== primaryAppId);

    const payload: MergeApplicationsPayload = {
      clusterId: activeCluster.clusterId,
      primaryApplicationId: primaryAppId,
      secondaryApplicationIds: secondaryIds,
      combineDocuments,
      selectedStatementApplicationId: statementAppId,
      selectedAmountApplicationId: primaryAppId,
      adminReason: adminReason.trim(),
      adminUserId,
    };

    try {
      await mergeMutation.mutateAsync(payload);
      setSuccessBanner(
        `Successfully merged ${secondaryIds.length} duplicate application(s) into primary record "${primaryAppId}".`
      );
      setAdminReason('');
      setTimeout(() => setSuccessBanner(null), 6000);
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Merge operation failed.');
    }
  };

  return (
    <section
      aria-labelledby="merge-console-title"
      className={`space-y-6 text-slate-900 ${className}`}
    >
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-700">
              Administrative Control
            </span>
            <span className="text-xs text-slate-500">Role: {userRole}</span>
          </div>
          <h1
            id="merge-console-title"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl"
          >
            Duplicate Applications & Controlled Merges
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Audit-logged resolution of duplicate applicant submissions with controlled document consolidation and primary record selection.
          </p>
        </div>

        {!isAdministrator && (
          <div
            role="status"
            className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2 text-xs text-slate-600"
          >
            <ShieldAlert className="h-4 w-4 text-slate-400" />
            <span>Administrator or reviewer grant required to merge records.</span>
          </div>
        )}
      </header>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-xs font-bold text-emerald-700 hover:text-emerald-900"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Acceptance Rule Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
        <div>
          <p className="font-semibold text-indigo-950">
            Acceptance Rule: Idempotency & Controlled Reversible Merges
          </p>
          <p className="mt-0.5 text-xs text-indigo-800">
            Duplicate attempts are idempotent. When multiple submissions exist from the same applicant, administrators
            can safely consolidate them into one primary record while marking duplicates as merged and transferring all supporting evidence.
          </p>
        </div>
      </div>

      {/* 1. LOADING STATE */}
      {isLoading && (
        <div role="status" aria-busy="true" className="space-y-4">
          <p className="sr-only">Scanning for duplicate application clusters…</p>
          {[1, 2].map((i) => (
            <div key={i} className="h-48 animate-pulse rounded-3xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      )}

      {/* 2. ERROR STATE */}
      {isError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-900">
          <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
          <h2 className="mt-2 text-sm font-bold">Failed to load duplicate clusters</h2>
          <p className="mt-1 text-xs text-red-700">
            {error instanceof Error ? error.message : 'Please check your connection and retry.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* 3. EMPTY STATE */}
      {!isLoading && !isError && clusters && clusters.length === 0 && (
        <div role="status" className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <CheckCircle2 className="mx-auto h-12 w-12 text-emerald-500" />
          <h2 className="mt-3 text-base font-bold text-slate-900">No Duplicate Clusters Detected</h2>
          <p className="mt-1 text-xs text-slate-500">
            All submitted applications comply with program uniqueness policies. There are no duplicate records awaiting merge.
          </p>
        </div>
      )}

      {/* 4. SUCCESS / MAIN MERGE CONSOLE */}
      {!isLoading && !isError && activeCluster && (
        <div className="space-y-6">
          {/* Cluster Switcher if multiple */}
          {clusters && clusters.length > 1 && (
            <div className="flex gap-2 overflow-x-auto pb-2">
              {clusters.map((c) => (
                <button
                  key={c.clusterId}
                  type="button"
                  onClick={() => setSelectedClusterId(c.clusterId)}
                  className={`rounded-xl px-4 py-2 text-xs font-semibold whitespace-nowrap transition ${
                    c.clusterId === activeCluster.clusterId
                      ? 'bg-indigo-600 text-white shadow-xs'
                      : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  Cluster: {c.studentName ?? c.studentId} ({c.applications.length} apps)
                </button>
              ))}
            </div>
          )}

          {/* Active Cluster Details */}
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-indigo-600" />
                  <span className="text-sm font-bold text-slate-900">
                    Applicant: {activeCluster.studentName ?? activeCluster.studentId}
                  </span>
                  <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-bold text-amber-800 uppercase">
                    {activeCluster.duplicateConfidence.replace('_', ' ')}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-1">
                  Program: {activeCluster.programName ?? activeCluster.programId} • Detected:{' '}
                  {new Date(activeCluster.detectedAt).toLocaleDateString()}
                </p>
              </div>

              <span className="text-xs font-semibold text-slate-600">
                {activeCluster.applications.length} Conflicting Applications
              </span>
            </div>

            {/* Error in form */}
            {formError && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {formError}
              </div>
            )}

            {/* Side-by-side Comparative Cards */}
            <div className="grid gap-6 md:grid-cols-2">
              {activeCluster.applications.map((app, index) => {
                const isSelectedAsPrimary = app.id === primaryAppId;

                return (
                  <div
                    key={app.id}
                    className={`rounded-2xl border p-5 transition space-y-4 ${
                      isSelectedAsPrimary
                        ? 'border-indigo-500 bg-indigo-50/30 ring-2 ring-indigo-500/20'
                        : 'border-slate-200 bg-slate-50/50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="rounded-full bg-slate-200 px-2 py-0.5 text-[10px] font-bold uppercase text-slate-700">
                          App #{index + 1}
                        </span>
                        <span className="font-mono text-xs font-bold text-slate-900">{app.id}</span>
                      </div>
                      <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[10px] font-bold uppercase text-indigo-700">
                        {app.status}
                      </span>
                    </div>

                    <div className="space-y-1 text-xs">
                      <p className="text-slate-500">
                        Submitted: <span className="font-semibold text-slate-800">{new Date(app.submittedAt).toLocaleString()}</span>
                      </p>
                      {app.requestedAmountCents && (
                        <p className="text-slate-500">
                          Requested: <span className="font-semibold text-slate-800">${(app.requestedAmountCents / 100).toFixed(2)}</span>
                        </p>
                      )}
                      {app.receiptId && (
                        <p className="text-slate-500">
                          Receipt: <span className="font-mono font-medium text-slate-700">{app.receiptId}</span>
                        </p>
                      )}
                    </div>

                    {/* Statement Preview */}
                    <div className="rounded-xl border border-slate-200 bg-white p-3 text-xs space-y-1">
                      <span className="font-bold text-slate-700 block">Personal Statement:</span>
                      <p className="text-slate-600 line-clamp-3 italic">&quot;{app.statementSummary}&quot;</p>
                    </div>

                    {/* Documents */}
                    <div className="text-xs space-y-1">
                      <span className="font-bold text-slate-700 block">
                        Supporting Documents ({app.documents.length}):
                      </span>
                      {app.documents.length === 0 ? (
                        <p className="text-slate-400 italic text-[11px]">No documents attached</p>
                      ) : (
                        <ul className="space-y-1">
                          {app.documents.map((d) => (
                            <li key={d.id} className="flex items-center gap-1.5 text-slate-600 text-[11px]">
                              <FileCheck2 className="h-3 w-3 text-emerald-600" />
                              <span className="font-medium">{d.fileName}</span>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>

                    {/* Primary Selection Radio */}
                    {isAdministrator && (
                      <div className="pt-2 border-t border-slate-200">
                        <label className="flex cursor-pointer items-center gap-2 text-xs font-semibold text-indigo-900">
                          <input
                            type="radio"
                            name="primaryApp"
                            checked={isSelectedAsPrimary}
                            onChange={() => {
                              setPrimaryAppId(app.id);
                              setStatementAppId(app.id);
                            }}
                            className="text-indigo-600 focus:ring-indigo-500"
                          />
                          <span>Select as Surviving Primary Application</span>
                        </label>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* Controlled Merge Options & Execution Form */}
            {isAdministrator && (
              <form
                onSubmit={handleExecuteMerge}
                className="rounded-2xl border border-slate-200 bg-slate-50/70 p-5 space-y-4"
              >
                <h3 className="text-sm font-bold text-slate-900">Configure Merge Parameters</h3>

                <div className="space-y-3 text-xs">
                  <label className="flex cursor-pointer items-center gap-2 text-slate-800 font-medium">
                    <input
                      type="checkbox"
                      checked={combineDocuments}
                      onChange={(e) => setCombineDocuments(e.target.checked)}
                      className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                    />
                    <span>
                      Combine and transfer all verified supporting documents from secondary applications into the surviving primary record.
                    </span>
                  </label>

                  <div>
                    <label htmlFor={reasonInputId} className="block font-bold text-slate-700 mb-1">
                      Administrative Justification Reason <span className="text-red-500">*</span>
                    </label>
                    <p id="merge-reason-desc" className="text-[11px] text-slate-500 mb-1">
                      Mandatory reason for audit trail (e.g., student submitted accidental duplicate across multiple sessions).
                    </p>
                    <textarea
                      id={reasonInputId}
                      required
                      rows={2}
                      value={adminReason}
                      onChange={(e) => setAdminReason(e.target.value)}
                      placeholder="Explain why these duplicate applications are being consolidated..."
                      aria-describedby="merge-reason-desc"
                      className="w-full rounded-xl border border-slate-300 p-2.5 text-xs shadow-xs focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-slate-200">
                  <p className="text-[11px] text-slate-500">
                    Action will mark non-primary applications as <span className="font-bold text-slate-700">merged</span> and generate an audit record.
                  </p>

                  <button
                    type="submit"
                    disabled={mergeMutation.isPending}
                    className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2.5 text-xs font-bold text-white shadow-xs hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500 disabled:opacity-50"
                  >
                    {mergeMutation.isPending && <RefreshCw className="h-3.5 w-3.5 animate-spin" />}
                    <span>Execute Controlled Merge</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Historical Audit Trail of Merges */}
      {auditHistory && auditHistory.length > 0 && (
        <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <History className="h-4 w-4 text-indigo-600" />
            <h2 className="text-sm font-bold text-slate-900">Application Merge Audit History</h2>
          </div>

          <ul className="divide-y divide-slate-100 text-xs">
            {auditHistory.map((audit) => (
              <li key={audit.id} className="py-3 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-800">Primary: {audit.primaryApplicationId}</span>
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 font-mono">
                      Merged: {audit.mergedSecondaryIds.join(', ')}
                    </span>
                  </div>
                  <p className="text-slate-500 mt-0.5">
                    Reason: &quot;{audit.adminReason}&quot; • Admin: {audit.adminUserId}
                  </p>
                </div>

                <div className="text-right text-[11px] text-slate-400">
                  <p>{new Date(audit.mergedAt).toLocaleDateString()}</p>
                  <p>{audit.transferredDocumentCount} document(s) transferred</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
