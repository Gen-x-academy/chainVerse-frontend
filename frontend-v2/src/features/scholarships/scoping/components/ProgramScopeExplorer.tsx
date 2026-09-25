'use client';

import React, { useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowRight,
  BookOpen,
  Building,
  Calendar,
  CheckCircle2,
  Clock,
  Compass,
  Filter,
  Globe,
  Search,
  Users,
} from 'lucide-react';
import { canScopeAcceptApplications } from '../domain';
import { useProgramScopes, useScopingReferenceData } from '../hooks';
import type { ProgramScopeTarget } from '../types';

export function ProgramScopeExplorer() {
  const [selectedCohort, setSelectedCohort] = useState<string>('');
  const [selectedTerm, setSelectedTerm] = useState<string>('');
  const [selectedInstitution, setSelectedInstitution] = useState<string>('');
  const [selectedRegion, setSelectedRegion] = useState<string>('');
  const [search, setSearch] = useState<string>('');

  const { data: referenceData } = useScopingReferenceData();

  const queryParams = useMemo(() => {
    return {
      search: search || undefined,
      cohortId: selectedCohort || undefined,
      termId: selectedTerm || undefined,
      institutionId: selectedInstitution || undefined,
      region: selectedRegion || undefined,
      status: 'active' as const,
    };
  }, [search, selectedCohort, selectedTerm, selectedInstitution, selectedRegion]);

  const { data: scopes, isLoading, isError, error } = useProgramScopes(queryParams);

  const handleResetFilters = () => {
    setSelectedCohort('');
    setSelectedTerm('');
    setSelectedInstitution('');
    setSelectedRegion('');
    setSearch('');
  };

  return (
    <section aria-labelledby="explorer-heading" className="space-y-6 text-slate-900">
      <header className="border-b border-slate-200 pb-4">
        <div className="flex items-center gap-2">
          <Compass className="h-5 w-5 text-indigo-600" />
          <h2 id="explorer-heading" className="text-xl font-bold text-slate-900">
            Find Scholarships by Cohort & Term
          </h2>
        </div>
        <p className="mt-1 text-xs text-slate-600">
          Match scholarship funding opportunities to your current academic term, learning cohort, or institution.
        </p>
      </header>

      {/* Explorer Controls */}
      <div className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-xs sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label htmlFor="explorer-term-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Academic Term
          </label>
          <select
            id="explorer-term-select"
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Academic Terms</option>
            {referenceData?.terms.map((term) => (
              <option key={term.id} value={term.id}>
                {term.name} ({term.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="explorer-cohort-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Cohort
          </label>
          <select
            id="explorer-cohort-select"
            value={selectedCohort}
            onChange={(e) => setSelectedCohort(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Cohorts</option>
            {referenceData?.cohorts.map((cohort) => (
              <option key={cohort.id} value={cohort.id}>
                {cohort.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="explorer-institution-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Institution
          </label>
          <select
            id="explorer-institution-select"
            value={selectedInstitution}
            onChange={(e) => setSelectedInstitution(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Institutions</option>
            {referenceData?.institutions.map((inst) => (
              <option key={inst.id} value={inst.id}>
                {inst.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="explorer-region-select" className="block text-xs font-semibold uppercase tracking-wider text-slate-500 mb-1">
            Region
          </label>
          <select
            id="explorer-region-select"
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2 text-xs focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="">All Geographic Regions</option>
            {referenceData?.regions.map((reg) => (
              <option key={reg.id} value={reg.code}>
                {reg.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Explorer Live Results Count */}
      <div className="flex items-center justify-between text-xs text-slate-500" aria-live="polite">
        <p>
          Found <span className="font-semibold text-slate-800">{scopes?.length ?? 0}</span> program scope(s) matching your profile.
        </p>
        {(selectedTerm || selectedCohort || selectedInstitution || selectedRegion || search) && (
          <button
            type="button"
            onClick={handleResetFilters}
            className="font-medium text-indigo-600 hover:text-indigo-800 underline focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            Reset filters
          </button>
        )}
      </div>

      {/* Results View */}
      {isLoading && (
        <div role="status" aria-busy="true" className="space-y-3">
          <p className="sr-only">Searching matching scholarship programs...</p>
          {[1, 2].map((i) => (
            <div key={i} className="h-32 animate-pulse rounded-2xl border border-slate-200 bg-slate-50" />
          ))}
        </div>
      )}

      {isError && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800">
          <div className="flex items-center gap-2 font-bold">
            <AlertCircle className="h-4 w-4 text-red-600" />
            <span>Unable to load program scopes.</span>
          </div>
          <p className="mt-1">{error instanceof Error ? error.message : 'Please check your connection and retry.'}</p>
        </div>
      )}

      {!isLoading && !isError && scopes && scopes.length === 0 && (
        <div role="status" className="rounded-2xl border border-slate-200 bg-white py-12 text-center shadow-xs">
          <Filter className="mx-auto h-8 w-8 text-slate-300" />
          <h3 className="mt-2 text-sm font-semibold text-slate-900">No matching scholarship scopes found</h3>
          <p className="mt-1 text-xs text-slate-500">
            Try broadening your selection of term, cohort, or region to see available opportunities.
          </p>
          <button
            type="button"
            onClick={handleResetFilters}
            className="mt-4 rounded-xl border border-slate-300 px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50"
          >
            Reset All Filters
          </button>
        </div>
      )}

      {!isLoading && !isError && scopes && scopes.length > 0 && (
        <div className="space-y-4">
          {scopes.map((scope) => {
            const acceptance = canScopeAcceptApplications(scope);

            return (
              <article
                key={scope.id}
                className="flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-5 shadow-xs transition hover:border-indigo-200 hover:shadow-md md:flex-row md:items-center"
              >
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-full bg-indigo-50 px-2.5 py-0.5 text-xs font-semibold text-indigo-700">
                      {scope.programName ?? scope.programId}
                    </span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                        acceptance.canAccept
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-900'
                      }`}
                    >
                      {acceptance.canAccept ? 'Open for Applications' : 'Applications Closed'}
                    </span>
                  </div>

                  <h3 className="text-base font-bold text-slate-900">{scope.name}</h3>
                  {scope.description && (
                    <p className="text-xs text-slate-600 max-w-2xl">{scope.description}</p>
                  )}

                  <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 pt-1">
                    {scope.termIds.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3 text-indigo-500" />
                        Terms: {scope.termIds.join(', ')}
                      </span>
                    )}
                    {scope.cohortIds.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Users className="h-3 w-3 text-indigo-500" />
                        Cohorts: {scope.cohortIds.join(', ')}
                      </span>
                    )}
                    {scope.regions.length > 0 && (
                      <span className="flex items-center gap-1">
                        <Globe className="h-3 w-3 text-indigo-500" />
                        Regions: {scope.regions.join(', ')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-4 shrink-0 md:mt-0 md:pl-6">
                  <button
                    type="button"
                    disabled={!acceptance.canAccept}
                    aria-disabled={!acceptance.canAccept}
                    className={`inline-flex items-center gap-2 rounded-xl px-5 py-2.5 text-xs font-semibold transition ${
                      acceptance.canAccept
                        ? 'bg-indigo-600 text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500'
                        : 'cursor-not-allowed bg-slate-100 text-slate-400'
                    }`}
                  >
                    <span>{acceptance.canAccept ? 'Apply Now' : 'Applications Closed'}</span>
                    {acceptance.canAccept && <ArrowRight className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
