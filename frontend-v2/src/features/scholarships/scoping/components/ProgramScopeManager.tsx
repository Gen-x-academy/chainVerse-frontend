'use client';

import React, { useId, useMemo, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  Building,
  Calendar,
  CheckCircle2,
  Filter,
  Globe,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Users,
} from 'lucide-react';
import { canScopeAcceptApplications, evaluateScopeOverlap } from '../domain';
import {
  useCreateProgramScope,
  useDeleteProgramScope,
  useProgramScopes,
  useScopingReferenceData,
  useUpdateProgramScope,
} from '../hooks';
import { ProgramScopeForm } from './ProgramScopeForm';
import type {
  CreateProgramScopePayload,
  ProgramScopeTarget,
  ScopeOverlapPolicy,
  ScopeQueryParams,
  ScopeStatus,
} from '../types';

export interface ProgramScopeManagerProps {
  userRole?: string;
  className?: string;
}

export function ProgramScopeManager({
  userRole = 'administrator',
  className = '',
}: ProgramScopeManagerProps) {
  const isManager = userRole === 'administrator' || userRole === 'sponsor';
  const searchInputId = useId();
  const statusFilterId = useId();
  const policyFilterId = useId();

  // Search & filter state
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | ScopeStatus>('all');
  const [policyFilter, setPolicyFilter] = useState<'all' | ScopeOverlapPolicy>('all');
  const [acceptingOnly, setAcceptingOnly] = useState(false);

  // Active query parameters
  const queryParams = useMemo<ScopeQueryParams>(() => {
    return {
      search: search || undefined,
      status: statusFilter !== 'all' ? statusFilter : undefined,
      overlapPolicy: policyFilter !== 'all' ? policyFilter : undefined,
      acceptingApplicationsOnly: acceptingOnly || undefined,
    };
  }, [search, statusFilter, policyFilter, acceptingOnly]);

  // Queries & Mutations
  const {
    data: scopes,
    isLoading,
    isError,
    error,
    refetch,
  } = useProgramScopes(queryParams);

  const { data: referenceData } = useScopingReferenceData();
  const createMutation = useCreateProgramScope();
  const updateMutation = useUpdateProgramScope();
  const deleteMutation = useDeleteProgramScope();

  // UI state
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScope, setEditingScope] = useState<ProgramScopeTarget | null>(null);
  const [successBanner, setSuccessBanner] = useState<string | null>(null);
  const [selectedScopeForOverlap, setSelectedScopeForOverlap] =
    useState<ProgramScopeTarget | null>(null);

  // Overlap evaluation for selected scope
  const overlapEvaluation = useMemo(() => {
    if (!selectedScopeForOverlap || !scopes) return null;
    return evaluateScopeOverlap(selectedScopeForOverlap, scopes);
  }, [selectedScopeForOverlap, scopes]);

  const handleOpenCreate = () => {
    setEditingScope(null);
    setIsFormOpen(true);
  };

  const handleOpenEdit = (scope: ProgramScopeTarget) => {
    setEditingScope(scope);
    setIsFormOpen(true);
  };

  const handleFormSubmit = async (payload: CreateProgramScopePayload) => {
    if (editingScope) {
      await updateMutation.mutateAsync({
        id: editingScope.id,
        updates: payload,
      });
      setSuccessBanner(`Scope "${payload.name}" updated successfully.`);
    } else {
      await createMutation.mutateAsync(payload);
      setSuccessBanner(`Scope "${payload.name}" created successfully.`);
    }
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  const handleToggleScopeStatus = async (scope: ProgramScopeTarget) => {
    const nextStatus: ScopeStatus = scope.status === 'active' ? 'inactive' : 'active';
    await updateMutation.mutateAsync({
      id: scope.id,
      updates: {
        id: scope.id,
        status: nextStatus,
        allowNewApplications: nextStatus === 'active',
      },
    });
    setSuccessBanner(
      nextStatus === 'inactive'
        ? `Scope "${scope.name}" set to Inactive. Inactive scopes cannot receive new applications.`
        : `Scope "${scope.name}" activated and open for applications.`
    );
    setTimeout(() => setSuccessBanner(null), 5000);
  };

  const handleResetFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPolicyFilter('all');
    setAcceptingOnly(false);
  };

  return (
    <section
      aria-labelledby="scoping-manager-title"
      className={`mx-auto w-full max-w-7xl space-y-6 text-slate-900 ${className}`}
    >
      {/* Header and Controls */}
      <header className="flex flex-col gap-4 border-b border-slate-200 pb-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-indigo-100 px-3 py-0.5 text-xs font-semibold text-indigo-700">
              Scholarship Operations
            </span>
            <span className="text-xs text-slate-500">RBAC: {userRole}</span>
          </div>
          <h1
            id="scoping-manager-title"
            className="mt-1 text-2xl font-bold tracking-tight text-slate-900 md:text-3xl"
          >
            Program Scoping & Eligibility Cohorts
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Associate programs with cohorts, terms, courses, institutions, and regions with strict overlap control.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isManager ? (
            <button
              type="button"
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-xs transition hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              <Plus className="h-4 w-4" />
              <span>New Program Scope</span>
            </button>
          ) : (
            <div
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
              role="status"
            >
              <ShieldAlert className="h-4 w-4 text-slate-400" />
              <span>Scope configuration requires administrator or sponsor privileges.</span>
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
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
            <span>{successBanner}</span>
          </div>
          <button
            type="button"
            onClick={() => setSuccessBanner(null)}
            className="text-emerald-700 hover:text-emerald-900 text-xs font-bold"
          >
            Dismiss
          </button>
        </div>
      )}

      {/* Inactive Scope Rule Alert */}
      <div className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50/70 p-4 text-sm text-amber-900">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
        <div>
          <p className="font-semibold text-amber-950">
            Acceptance Rule: Inactive scopes cannot receive new applications
          </p>
          <p className="mt-0.5 text-xs text-amber-800">
            Scopes that are toggled to inactive or archived automatically reject new student applications.
            Configure explicit overlap policies to control concurrent enrollments across terms and cohorts.
          </p>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        {/* Search */}
        <div className="relative">
          <label htmlFor={searchInputId} className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Search Scopes
          </label>
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
            <input
              id={searchInputId}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, cohort, term, program..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50/50 pl-9 pr-3 py-2 text-xs shadow-xs transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
        </div>

        {/* Status Filter */}
        <div>
          <label htmlFor={statusFilterId} className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Scope Status
          </label>
          <select
            id={statusFilterId}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as 'all' | ScopeStatus)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs shadow-xs transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active (Open)</option>
            <option value="inactive">Inactive (Closed)</option>
            <option value="archived">Archived</option>
          </select>
        </div>

        {/* Policy Filter */}
        <div>
          <label htmlFor={policyFilterId} className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Overlap Policy
          </label>
          <select
            id={policyFilterId}
            value={policyFilter}
            onChange={(e) => setPolicyFilter(e.target.value as 'all' | ScopeOverlapPolicy)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs shadow-xs transition focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Overlap Policies</option>
            <option value="allow_concurrent">Allow Concurrent</option>
            <option value="disallow_overlap">Disallow Overlap</option>
            <option value="strict_exclusive">Strict Exclusive</option>
          </select>
        </div>

        {/* Checkbox: Accepting Applications Only */}
        <div className="flex items-end pb-1">
          <label className="flex cursor-pointer items-center gap-2 text-xs font-medium text-slate-700">
            <input
              type="checkbox"
              checked={acceptingOnly}
              onChange={(e) => setAcceptingOnly(e.target.checked)}
              aria-label="Filter accepting applications only"
              className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
            />
            <span>Accepting Applications Only</span>
          </label>
        </div>
      </div>

      {/* Query Status / Live Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-500" aria-live="polite">
        <p>
          Showing <span className="font-semibold text-slate-800">{scopes?.length ?? 0}</span> program scope(s)
          {acceptingOnly ? ' accepting applications' : ''}.
        </p>
        {(search || statusFilter !== 'all' || policyFilter !== 'all' || acceptingOnly) && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="font-medium text-indigo-600 hover:text-indigo-800 underline focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Reset all filters
          </button>
        )}
      </div>

      {/* Overlap Inspection Modal / Banner */}
      {selectedScopeForOverlap && overlapEvaluation && (
        <div
          role="region"
          aria-labelledby="overlap-inspection-heading"
          className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-5 shadow-xs"
        >
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              {overlapEvaluation.hasOverlap ? (
                overlapEvaluation.isAllowed ? (
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                ) : (
                  <ShieldAlert className="h-5 w-5 text-red-600" />
                )
              ) : (
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
              )}
              <h2 id="overlap-inspection-heading" className="text-base font-bold text-slate-900">
                Overlap Evaluation for: &quot;{selectedScopeForOverlap.name}&quot;
              </h2>
            </div>
            <button
              type="button"
              onClick={() => setSelectedScopeForOverlap(null)}
              className="text-xs font-semibold text-slate-600 hover:text-slate-900"
            >
              Close
            </button>
          </div>

          <p className="mt-1 text-xs text-slate-700">{overlapEvaluation.message}</p>

          {overlapEvaluation.conflicts.length > 0 && (
            <ul className="mt-3 space-y-2">
              {overlapEvaluation.conflicts.map((conflict, i) => (
                <li
                  key={i}
                  className={`rounded-xl border p-3 text-xs ${
                    conflict.isBlocking
                      ? 'border-red-200 bg-red-50 text-red-900'
                      : 'border-amber-200 bg-amber-50 text-amber-900'
                  }`}
                >
                  <p className="font-bold">{conflict.message}</p>
                  <div className="mt-1 flex flex-wrap gap-2 text-[11px]">
                    {conflict.overlappingCohortIds.length > 0 && (
                      <span>Cohorts: {conflict.overlappingCohortIds.join(', ')}</span>
                    )}
                    {conflict.overlappingTermIds.length > 0 && (
                      <span>Terms: {conflict.overlappingTermIds.join(', ')}</span>
                    )}
                    <span className="font-semibold">
                      Policy: {conflict.policy} ({conflict.isBlocking ? 'Blocking' : 'Allowed'})
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Main Content Area: Loading, Error, Empty, and Success Grid */}
      {/* 1. LOADING STATE */}
      {isLoading && (
        <div
          role="status"
          aria-busy="true"
          aria-label="Loading program scopes"
          className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          <span className="sr-only">Loading program scopes...</span>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              className="flex h-64 flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs"
            >
              <div className="space-y-3">
                <div className="h-5 w-2/3 animate-pulse rounded bg-slate-200" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100" />
                <div className="h-16 w-full animate-pulse rounded bg-slate-50" />
              </div>
              <div className="h-8 w-full animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
      )}

      {/* 2. ERROR STATE */}
      {isError && (
        <div
          role="alert"
          className="flex flex-col items-center justify-center rounded-2xl border border-red-200 bg-red-50/80 p-8 text-center"
        >
          <AlertCircle className="h-10 w-10 text-red-600" />
          <h2 className="mt-3 text-lg font-bold text-red-900">
            Failed to load program scopes
          </h2>
          <p className="mt-1 max-w-md text-sm text-red-700">
            {error instanceof Error ? error.message : 'An unexpected network error occurred while querying scopes.'}
          </p>
          <button
            type="button"
            onClick={() => refetch()}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}

      {/* 3. EMPTY STATE */}
      {!isLoading && !isError && scopes && scopes.length === 0 && (
        <div
          role="status"
          className="flex flex-col items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 px-4 text-center shadow-xs"
        >
          <Filter className="h-12 w-12 text-slate-300" />
          <h2 className="mt-4 text-lg font-bold text-slate-900">No program scopes found</h2>
          <p className="mt-1 max-w-sm text-xs text-slate-500">
            No scopes matched your selected cohort, term, region, or status filters.
          </p>
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleResetFilters}
              className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Clear Filters
            </button>
            {isManager && (
              <button
                type="button"
                onClick={handleOpenCreate}
                className="rounded-xl bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                Create New Scope
              </button>
            )}
          </div>
        </div>
      )}

      {/* 4. SUCCESS / DATA GRID */}
      {!isLoading && !isError && scopes && scopes.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {scopes.map((scope) => {
            const acceptance = canScopeAcceptApplications(scope);
            const isInactive = scope.status !== 'active';

            return (
              <article
                key={scope.id}
                aria-labelledby={`scope-title-${scope.id}`}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md"
              >
                <div>
                  {/* Top Badges */}
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span
                      aria-label={`Status: ${scope.status}`}
                      className={`rounded-full px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider ${
                        scope.status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : scope.status === 'inactive'
                          ? 'bg-amber-100 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                      }`}
                    >
                      {scope.status}
                    </span>

                    <span
                      aria-label={`Overlap policy: ${scope.overlapPolicy}`}
                      className="rounded-full bg-slate-100 px-2.5 py-0.5 text-[11px] font-medium text-slate-600"
                    >
                      Policy: {scope.overlapPolicy.replace('_', ' ')}
                    </span>
                  </div>

                  {/* Program & Scope Title */}
                  <div className="mt-3">
                    <p className="text-xs font-semibold uppercase tracking-wider text-indigo-600">
                      {scope.programName ?? scope.programId}
                    </p>
                    <h2
                      id={`scope-title-${scope.id}`}
                      className="mt-1 text-base font-bold text-slate-900"
                    >
                      {scope.name}
                    </h2>
                    {scope.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                        {scope.description}
                      </p>
                    )}
                  </div>

                  {/* Scoping Dimension Chips */}
                  <div className="mt-4 space-y-2 border-t border-slate-100 pt-3">
                    {/* Terms */}
                    {scope.termIds.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Calendar className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="font-semibold">Terms:</span>
                        <span className="truncate">{scope.termIds.join(', ')}</span>
                      </div>
                    )}

                    {/* Cohorts */}
                    {scope.cohortIds.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Users className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="font-semibold">Cohorts:</span>
                        <span className="truncate">{scope.cohortIds.join(', ')}</span>
                      </div>
                    )}

                    {/* Courses */}
                    {scope.courseIds.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <BookOpen className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="font-semibold">Courses:</span>
                        <span className="truncate">{scope.courseIds.join(', ')}</span>
                      </div>
                    )}

                    {/* Institutions */}
                    {scope.institutionIds.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Building className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="font-semibold">Institutions:</span>
                        <span className="truncate">{scope.institutionIds.join(', ')}</span>
                      </div>
                    )}

                    {/* Regions */}
                    {scope.regions.length > 0 && (
                      <div className="flex items-center gap-1.5 text-xs text-slate-600">
                        <Globe className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                        <span className="font-semibold">Regions:</span>
                        <span className="capitalize">{scope.regions.join(', ')}</span>
                      </div>
                    )}
                  </div>

                  {/* Application Intake Status Indicator */}
                  <div
                    className={`mt-4 rounded-xl p-2.5 text-xs ${
                      acceptance.canAccept
                        ? 'border border-emerald-200 bg-emerald-50/60 text-emerald-800'
                        : 'border border-amber-200 bg-amber-50/70 text-amber-900'
                    }`}
                  >
                    <p className="font-semibold">
                      {acceptance.canAccept ? 'Accepting Applications' : 'Applications Closed'}
                    </p>
                    <p className="mt-0.5 text-[11px] opacity-90">{acceptance.message}</p>
                  </div>
                </div>

                {/* Scope Card Actions */}
                <div className="mt-5 border-t border-slate-100 pt-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => setSelectedScopeForOverlap(scope)}
                      className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 focus:outline-none focus:ring-2 focus:ring-indigo-500 rounded"
                    >
                      Inspect Overlap
                    </button>

                    {isManager && (
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleToggleScopeStatus(scope)}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition focus:outline-none focus:ring-2 ${
                            scope.status === 'active'
                              ? 'border border-amber-300 bg-amber-50 text-amber-800 hover:bg-amber-100 focus:ring-amber-500'
                              : 'border border-emerald-300 bg-emerald-50 text-emerald-800 hover:bg-emerald-100 focus:ring-emerald-500'
                          }`}
                        >
                          {scope.status === 'active' ? 'Deactivate' : 'Activate'}
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenEdit(scope)}
                          className="rounded-lg border border-slate-300 bg-white px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          Edit
                        </button>
                      </div>
                    )}
                  </div>

                  {/* Student Application Button */}
                  <div className="mt-3">
                    <button
                      type="button"
                      disabled={!acceptance.canAccept}
                      aria-disabled={!acceptance.canAccept}
                      className={`w-full flex items-center justify-center gap-1.5 rounded-xl py-2 text-xs font-semibold transition ${
                        acceptance.canAccept
                          ? 'bg-indigo-600 text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-1'
                          : 'cursor-not-allowed bg-slate-100 text-slate-400'
                      }`}
                    >
                      <span>
                        {acceptance.canAccept
                          ? 'Apply in this Scope'
                          : 'Applications Closed for Inactive Scope'}
                      </span>
                      {acceptance.canAccept && <ArrowRight className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {/* Program Scope Creation / Editing Modal */}
      {referenceData && (
        <ProgramScopeForm
          isOpen={isFormOpen}
          onClose={() => setIsFormOpen(false)}
          onSubmit={handleFormSubmit}
          initialScope={editingScope}
          referenceData={referenceData}
          isSubmitting={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </section>
  );
}
