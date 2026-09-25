'use client';

import React, { useId, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  Calendar,
  CheckCircle2,
  Clock,
  Filter,
  Globe,
  Hourglass,
  Lock,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  ShieldCheck,
} from 'lucide-react';
import {
  COMMON_TIMEZONES,
  determineWindowStatus,
  validateApplicationWindow,
} from '../domain';
import {
  useCreateProgramWindow,
  useProgramWindows,
  useUpdateProgramWindow,
} from '../hooks';
import { DeadlineChangePreviewModal } from './DeadlineChangePreviewModal';
import { WindowStatusBadge } from './WindowStatusBadge';
import type {
  ApplicationWindow,
  CreateWindowPayload,
  LateSubmissionPolicy,
  UpdateWindowPayload,
} from '../types';

export interface ProgramDeadlineManagerProps {
  userRole?: string;
  className?: string;
}

export function ProgramDeadlineManager({
  userRole = 'administrator',
  className = '',
}: ProgramDeadlineManagerProps) {
  const isManager = userRole === 'administrator' || userRole === 'sponsor';
  const searchInputId = useId();

  // Queries & Mutations
  const [search, setSearch] = useState('');
  const { data: windows, isLoading, isError, error, refetch } = useProgramWindows({
    search: search || undefined,
  });

  const createMutation = useCreateProgramWindow();
  const updateMutation = useUpdateProgramWindow();

  // Form & Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [selectedWindowForEdit, setSelectedWindowForEdit] = useState<ApplicationWindow | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [validationErrors, setValidationErrors] = useState<string[]>([]);

  // New Window Form State
  const [name, setName] = useState('');
  const [programId, setProgramId] = useState('prog-stellar-fellows-2026');
  const [programName, setProgramName] = useState('Stellar Developer Fellowship 2026');
  const [description, setDescription] = useState('');
  const [openDate, setOpenDate] = useState('2026-10-01');
  const [openTime, setOpenTime] = useState('09:00');
  const [closeDate, setCloseDate] = useState('2026-12-15');
  const [closeTime, setCloseTime] = useState('23:59');
  const [timeZone, setTimeZone] = useState('Africa/Nairobi');
  const [gracePeriodMinutes, setGracePeriodMinutes] = useState(30);
  const [lateSubmissionPolicy, setLateSubmissionPolicy] =
    useState<LateSubmissionPolicy>('strict_reject');
  const [latePenaltyPercent, setLatePenaltyPercent] = useState<number | undefined>(10);
  const [lateCutoffDate, setLateCutoffDate] = useState('');
  const [lateCutoffTime, setLateCutoffTime] = useState('');

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setValidationErrors([]);

    const payload: CreateWindowPayload = {
      programId: programId.trim(),
      programName: programName.trim(),
      name: name.trim(),
      description: description.trim(),
      openDate,
      openTime,
      closeDate,
      closeTime,
      timeZone,
      gracePeriodMinutes: Number(gracePeriodMinutes),
      lateSubmissionPolicy,
      latePenaltyPercent:
        lateSubmissionPolicy === 'allow_with_penalty' ? Number(latePenaltyPercent) : undefined,
      lateCutoffDate: lateCutoffDate || undefined,
      lateCutoffTime: lateCutoffTime || undefined,
    };

    const validation = validateApplicationWindow(payload);
    if (!validation.valid) {
      setValidationErrors(validation.errors.map((err) => err.message));
      return;
    }

    try {
      await createMutation.mutateAsync(payload);
      setSuccessBanner(`Window "${payload.name}" created with deterministic boundary calculations.`);
      setIsCreateOpen(false);
      setName('');
      setDescription('');
      setTimeout(() => setSuccessBanner(null), 5000);
    } catch (err: unknown) {
      setValidationErrors([err instanceof Error ? err.message : 'Failed to create window.']);
    }
  };

  const handleConfirmDeadlineUpdate = async (payload: UpdateWindowPayload) => {
    await updateMutation.mutateAsync({
      id: payload.id,
      updates: payload,
    });
    setSuccessBanner('Deadline adjusted successfully. Grandfathering rules preserved submitted applications.');
    setSelectedWindowForEdit(null);
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  return (
    <section aria-labelledby="deadline-manager-title" className={`space-y-6 text-slate-900 ${className}`}>
      {/* Header */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-700">
              Schedule & Timing
            </span>
            <span className="text-xs text-slate-500">RBAC: {userRole}</span>
          </div>
          <h1 id="deadline-manager-title" className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl">
            Application Opening & Deadline Windows
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Define deterministic opening, closing, explicit timezones, network grace periods, and late-submission policies.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isManager ? (
            <button
              type="button"
              onClick={() => setIsCreateOpen(!isCreateOpen)}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <Plus className="h-4 w-4" />
              <span>{isCreateOpen ? 'Cancel Window Creation' : 'New Deadline Window'}</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
              role="status"
            >
              <ShieldAlert className="h-4 w-4 text-slate-400" />
              <span>Window configuration requires manager permissions.</span>
            </div>
          )}
        </div>
      </header>

      {/* Success Notification Banner */}
      {successBanner && (
        <div
          role="status"
          aria-live="polite"
          className="flex items-center justify-between rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-800"
        >
          <div className="flex items-center gap-2">
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

      {/* Invariant Banner */}
      <div className="flex items-start gap-3 rounded-2xl border border-indigo-200 bg-indigo-50/70 p-4 text-sm text-indigo-950">
        <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-indigo-600" />
        <div>
          <p className="font-semibold text-indigo-950">
            Acceptance Rule: Deterministic Boundaries & Non-invalidation of Submissions
          </p>
          <p className="mt-0.5 text-xs text-indigo-800">
            All boundary instants convert deterministically across timezones to exact UTC instants. If a deadline is adjusted earlier or later,
            previously submitted applications are permanently grandfathered and will never be silently invalidated.
          </p>
        </div>
      </div>

      {/* Creation Form Panel */}
      {isCreateOpen && (
        <form
          onSubmit={handleCreateSubmit}
          className="rounded-3xl border border-slate-200 bg-white p-6 shadow-md space-y-5"
        >
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h2 className="text-base font-bold text-slate-900">Define New Application Window</h2>
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="text-xs font-semibold text-slate-400 hover:text-slate-600"
            >
              Cancel
            </button>
          </div>

          {validationErrors.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
              <ul className="list-disc pl-4 space-y-1">
                {validationErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="win-name-input" className="block text-xs font-semibold text-slate-700">
                Window Name <span className="text-red-500">*</span>
              </label>
              <input
                id="win-name-input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fall 2026 Main Application Window"
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs shadow-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
            <div>
              <label htmlFor="win-prog-input" className="block text-xs font-semibold text-slate-700">
                Program Name <span className="text-red-500">*</span>
              </label>
              <input
                id="win-prog-input"
                type="text"
                required
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                className="mt-1 w-full rounded-xl border border-slate-300 p-2 text-xs shadow-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          {/* Opening & Closing Instants + Timezone */}
          <div className="grid gap-4 rounded-2xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-3">
            <div>
              <label htmlFor="open-date-input" className="block text-xs font-semibold text-slate-700">
                Opening Date & Time <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="open-date-input"
                  type="date"
                  required
                  value={openDate}
                  onChange={(e) => setOpenDate(e.target.value)}
                  className="w-2/3 rounded-lg border border-slate-300 bg-white p-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="time"
                  required
                  value={openTime}
                  onChange={(e) => setOpenTime(e.target.value)}
                  className="w-1/3 rounded-lg border border-slate-300 bg-white p-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="close-date-input" className="block text-xs font-semibold text-slate-700">
                Closing Deadline Date & Time <span className="text-red-500">*</span>
              </label>
              <div className="mt-1 flex gap-2">
                <input
                  id="close-date-input"
                  type="date"
                  required
                  value={closeDate}
                  onChange={(e) => setCloseDate(e.target.value)}
                  className="w-2/3 rounded-lg border border-slate-300 bg-white p-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
                />
                <input
                  type="time"
                  required
                  value={closeTime}
                  onChange={(e) => setCloseTime(e.target.value)}
                  className="w-1/3 rounded-lg border border-slate-300 bg-white p-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div>
              <label htmlFor="timezone-select" className="block text-xs font-semibold text-slate-700">
                Timezone <span className="text-red-500">*</span>
              </label>
              <select
                id="timezone-select"
                value={timeZone}
                onChange={(e) => setTimeZone(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 bg-white p-1.5 text-xs focus:ring-2 focus:ring-indigo-500"
              >
                {COMMON_TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Grace Period & Late Submission Policy */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
              <label htmlFor="grace-period-input" className="block text-xs font-semibold text-slate-700">
                Network Grace Period (Minutes)
              </label>
              <p className="text-[11px] text-slate-500">
                Protects applicants with in-flight submissions experiencing network or wallet latency.
              </p>
              <input
                id="grace-period-input"
                type="number"
                min={0}
                max={180}
                value={gracePeriodMinutes}
                onChange={(e) => setGracePeriodMinutes(parseInt(e.target.value, 10) || 0)}
                className="w-full rounded-lg border border-slate-300 p-2 text-xs focus:ring-2 focus:ring-indigo-500"
              />
            </div>

            <div className="rounded-2xl border border-slate-200 p-4 space-y-2">
              <label htmlFor="late-policy-select" className="block text-xs font-semibold text-slate-700">
                Late-Submission Rule
              </label>
              <select
                id="late-policy-select"
                value={lateSubmissionPolicy}
                onChange={(e) => setLateSubmissionPolicy(e.target.value as LateSubmissionPolicy)}
                className="w-full rounded-lg border border-slate-300 bg-white p-2 text-xs focus:ring-2 focus:ring-indigo-500"
              >
                <option value="strict_reject">Strict Rejection (No late submissions accepted)</option>
                <option value="allow_with_penalty">Allow With Penalty (Deduction applies)</option>
                <option value="requires_waiver">Requires Verified Administrative Waiver</option>
                <option value="discretionary_review">Route to Discretionary Committee Review</option>
              </select>
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={() => setIsCreateOpen(false)}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={createMutation.isPending}
              className="rounded-xl bg-indigo-600 px-5 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 focus:ring-2 focus:ring-indigo-500"
            >
              {createMutation.isPending ? 'Calculating boundaries…' : 'Save Application Window'}
            </button>
          </div>
        </form>
      )}

      {/* Filter / Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs">
        <div className="relative w-full max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            id={searchInputId}
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search windows, programs, deadlines..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 pl-9 pr-3 py-2 text-xs focus:bg-white focus:ring-2 focus:ring-indigo-500"
          />
        </div>
        <div className="text-xs text-slate-500" aria-live="polite">
          Showing <span className="font-bold text-slate-800">{windows?.length ?? 0}</span> window(s)
        </div>
      </div>

      {/* 1. LOADING STATE */}
      {isLoading && (
        <div role="status" aria-busy="true" className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          <p className="sr-only">Loading application windows…</p>
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-64 animate-pulse rounded-3xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      )}

      {/* 2. ERROR STATE */}
      {isError && (
        <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-900">
          <AlertCircle className="mx-auto h-8 w-8 text-red-600" />
          <h2 className="mt-2 text-sm font-bold">Failed to load application windows</h2>
          <p className="mt-1 text-xs text-red-700">
            {error instanceof Error ? error.message : 'Please check your connection and retry.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700"
          >
            Try Again
          </button>
        </div>
      )}

      {/* 3. EMPTY STATE */}
      {!isLoading && !isError && windows && windows.length === 0 && (
        <div role="status" className="rounded-3xl border border-slate-200 bg-white p-12 text-center shadow-xs">
          <Clock className="mx-auto h-10 w-10 text-slate-300" />
          <h2 className="mt-3 text-sm font-bold text-slate-900">No Application Windows Configured</h2>
          <p className="mt-1 text-xs text-slate-500">
            No schedule windows matched your search query.
          </p>
          {isManager && (
            <button
              type="button"
              onClick={() => setIsCreateOpen(true)}
              className="mt-4 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white hover:bg-indigo-700"
            >
              Create First Window
            </button>
          )}
        </div>
      )}

      {/* 4. SUCCESS / WINDOW CARDS GRID */}
      {!isLoading && !isError && windows && windows.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {windows.map((win) => {
            return (
              <article
                key={win.id}
                className="flex flex-col justify-between rounded-3xl border border-slate-200 bg-white p-6 shadow-xs transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-center justify-between gap-2">
                    <WindowStatusBadge window={win} />
                    <span className="font-mono text-[10px] text-slate-400">v{win.version}</span>
                  </div>

                  <div className="mt-3">
                    <p className="text-xs font-bold uppercase tracking-wider text-indigo-600">
                      {win.programName ?? win.programId}
                    </p>
                    <h2 className="mt-1 text-base font-bold text-slate-900">{win.name}</h2>
                    {win.description && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">{win.description}</p>
                    )}
                  </div>

                  {/* Boundary Instants & Timezone Breakdown */}
                  <div className="mt-4 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5 space-y-2 text-xs">
                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Globe className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                      <span className="font-semibold">Timezone:</span>
                      <span className="truncate">{win.timeZone}</span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Calendar className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                      <span className="font-semibold">Opens:</span>
                      <span>
                        {win.openDate} {win.openTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Clock className="h-3.5 w-3.5 text-red-500 shrink-0" />
                      <span className="font-semibold">Deadline:</span>
                      <span className="font-bold text-slate-900">
                        {win.closeDate} {win.closeTime}
                      </span>
                    </div>

                    <div className="flex items-center gap-1.5 text-slate-600">
                      <Hourglass className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                      <span className="font-semibold">Grace Period:</span>
                      <span>{win.gracePeriodMinutes} mins</span>
                    </div>

                    <div className="border-t border-slate-200/60 pt-2 text-[11px] text-slate-500">
                      <span>UTC Boundary: </span>
                      <span className="font-mono text-slate-700">
                        {new Date(win.closeInstantUtc).toUTCString()}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="mt-5 border-t border-slate-100 pt-3 flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-slate-500">
                    Policy: {win.lateSubmissionPolicy.replace('_', ' ')}
                  </span>

                  {isManager && (
                    <button
                      type="button"
                      onClick={() => setSelectedWindowForEdit(win)}
                      className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    >
                      Adjust Deadline
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Deadline Change Preview & Grandfathering Modal */}
      {selectedWindowForEdit && (
        <DeadlineChangePreviewModal
          isOpen={Boolean(selectedWindowForEdit)}
          onClose={() => setSelectedWindowForEdit(null)}
          window={selectedWindowForEdit}
          onConfirmUpdate={handleConfirmDeadlineUpdate}
          isUpdating={updateMutation.isPending}
        />
      )}
    </section>
  );
}
