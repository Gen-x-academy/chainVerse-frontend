'use client';

import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  BookOpen,
  Building,
  Calendar,
  CheckCircle2,
  Globe,
  Info,
  Users,
  X,
} from 'lucide-react';
import { validateProgramScope } from '../domain';
import type {
  CreateProgramScopePayload,
  ProgramScopeTarget,
  ScopeOverlapPolicy,
  ScopeStatus,
  ScopingReferenceData,
} from '../types';

interface ProgramScopeFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (payload: CreateProgramScopePayload) => Promise<void>;
  initialScope?: ProgramScopeTarget | null;
  referenceData: ScopingReferenceData;
  isSubmitting?: boolean;
}

export function ProgramScopeForm({
  isOpen,
  onClose,
  onSubmit,
  initialScope,
  referenceData,
  isSubmitting = false,
}: ProgramScopeFormProps) {
  const isEditing = Boolean(initialScope);

  const [programId, setProgramId] = useState(initialScope?.programId ?? '');
  const [programName, setProgramName] = useState(initialScope?.programName ?? '');
  const [name, setName] = useState(initialScope?.name ?? '');
  const [description, setDescription] = useState(initialScope?.description ?? '');
  const [status, setStatus] = useState<ScopeStatus>(initialScope?.status ?? 'active');
  const [overlapPolicy, setOverlapPolicy] = useState<ScopeOverlapPolicy>(
    initialScope?.overlapPolicy ?? 'allow_concurrent'
  );
  const [allowNewApplications, setAllowNewApplications] = useState<boolean>(
    initialScope?.allowNewApplications ?? true
  );
  const [cohortIds, setCohortIds] = useState<string[]>(initialScope?.cohortIds ?? []);
  const [termIds, setTermIds] = useState<string[]>(initialScope?.termIds ?? []);
  const [courseIds, setCourseIds] = useState<string[]>(initialScope?.courseIds ?? []);
  const [institutionIds, setInstitutionIds] = useState<string[]>(
    initialScope?.institutionIds ?? []
  );
  const [regions, setRegions] = useState<string[]>(initialScope?.regions ?? []);
  const [applicationStartDate, setApplicationStartDate] = useState(
    initialScope?.applicationStartDate ? initialScope.applicationStartDate.slice(0, 10) : ''
  );
  const [applicationEndDate, setApplicationEndDate] = useState(
    initialScope?.applicationEndDate ? initialScope.applicationEndDate.slice(0, 10) : ''
  );

  const [formErrors, setFormErrors] = useState<string[]>([]);

  useEffect(() => {
    if (initialScope) {
      setProgramId(initialScope.programId);
      setProgramName(initialScope.programName ?? '');
      setName(initialScope.name);
      setDescription(initialScope.description ?? '');
      setStatus(initialScope.status);
      setOverlapPolicy(initialScope.overlapPolicy);
      setAllowNewApplications(initialScope.allowNewApplications);
      setCohortIds(initialScope.cohortIds);
      setTermIds(initialScope.termIds);
      setCourseIds(initialScope.courseIds);
      setInstitutionIds(initialScope.institutionIds);
      setRegions(initialScope.regions);
      setApplicationStartDate(
        initialScope.applicationStartDate ? initialScope.applicationStartDate.slice(0, 10) : ''
      );
      setApplicationEndDate(
        initialScope.applicationEndDate ? initialScope.applicationEndDate.slice(0, 10) : ''
      );
    } else {
      setProgramId('prog-stellar-fellows-2026');
      setProgramName('Stellar Developer Fellowship 2026');
      setName('');
      setDescription('');
      setStatus('active');
      setOverlapPolicy('allow_concurrent');
      setAllowNewApplications(true);
      setCohortIds([]);
      setTermIds([]);
      setCourseIds([]);
      setInstitutionIds([]);
      setRegions([]);
      setApplicationStartDate('');
      setApplicationEndDate('');
    }
    setFormErrors([]);
  }, [initialScope, isOpen]);

  // Invariant enforcement: Inactive or archived scopes cannot accept new applications
  const handleStatusChange = (newStatus: ScopeStatus) => {
    setStatus(newStatus);
    if (newStatus !== 'active') {
      setAllowNewApplications(false);
    }
  };

  const toggleItem = (list: string[], setList: (val: string[]) => void, id: string) => {
    if (list.includes(id)) {
      setList(list.filter((item) => item !== id));
    } else {
      setList([...list, id]);
    }
  };

  // Keyboard navigation: Escape key closes modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormErrors([]);

    const payload: CreateProgramScopePayload = {
      programId: programId.trim(),
      programName: programName.trim(),
      name: name.trim(),
      description: description.trim(),
      cohortIds,
      termIds,
      courseIds,
      institutionIds,
      regions,
      status,
      overlapPolicy,
      allowNewApplications: status === 'active' ? allowNewApplications : false,
      applicationStartDate: applicationStartDate
        ? new Date(applicationStartDate).toISOString()
        : undefined,
      applicationEndDate: applicationEndDate
        ? new Date(applicationEndDate).toISOString()
        : undefined,
    };

    const validation = validateProgramScope(payload);
    if (!validation.valid) {
      setFormErrors(validation.errors.map((err) => err.message));
      return;
    }

    try {
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Failed to save program scope.';
      setFormErrors([msg]);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="scope-modal-title"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-xs"
    >
      <div className="flex max-h-[90vh] w-full max-w-3xl flex-col rounded-2xl bg-white shadow-2xl">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
          <div>
            <h2 id="scope-modal-title" className="text-xl font-bold text-slate-900">
              {isEditing ? 'Edit Program Scope' : 'Create New Program Scope'}
            </h2>
            <p className="text-xs text-slate-500">
              Associate scholarship programs with target cohorts, terms, courses, institutions, or regions.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
          {formErrors.length > 0 && (
            <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
              <div className="flex items-center gap-2 font-semibold">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>Please correct the following errors:</span>
              </div>
              <ul className="mt-2 list-disc pl-5 space-y-1">
                {formErrors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}

          {/* Scope Basics */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="scope-name-input" className="block text-sm font-medium text-slate-700">
                Scope Name <span className="text-red-500">*</span>
              </label>
              <input
                id="scope-name-input"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Fall 2026 African Engineering Scope"
                aria-describedby="scope-name-desc"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <span id="scope-name-desc" className="sr-only">
                A descriptive title for this cohort or term scope.
              </span>
            </div>

            <div>
              <label htmlFor="scope-program-input" className="block text-sm font-medium text-slate-700">
                Associated Program <span className="text-red-500">*</span>
              </label>
              <input
                id="scope-program-input"
                type="text"
                required
                value={programName}
                onChange={(e) => setProgramName(e.target.value)}
                placeholder="e.g. Stellar Developer Fellowship 2026"
                className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
            </div>
          </div>

          <div>
            <label htmlFor="scope-desc-input" className="block text-sm font-medium text-slate-700">
              Description
            </label>
            <textarea
              id="scope-desc-input"
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Explain the targeting criteria and intent of this scope..."
              className="mt-1 block w-full rounded-xl border border-slate-300 px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>

          {/* Status & Overlap Policy */}
          <div className="grid gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-4 sm:grid-cols-2">
            <div>
              <label htmlFor="scope-status-select" className="block text-sm font-medium text-slate-700">
                Scope Status <span className="text-red-500">*</span>
              </label>
              <select
                id="scope-status-select"
                value={status}
                onChange={(e) => handleStatusChange(e.target.value as ScopeStatus)}
                aria-describedby="scope-status-desc"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="active">Active (Open for configuration)</option>
                <option value="inactive">Inactive (Applications blocked)</option>
                <option value="archived">Archived (Historical read-only)</option>
              </select>
              <p id="scope-status-desc" className="mt-1 text-xs text-slate-500">
                {status !== 'active' ? (
                  <span className="font-semibold text-amber-700">
                    Inactive scopes cannot receive new applications.
                  </span>
                ) : (
                  'Active scopes permit application intake within configured windows.'
                )}
              </p>
            </div>

            <div>
              <label htmlFor="scope-overlap-select" className="block text-sm font-medium text-slate-700">
                Overlap Policy <span className="text-red-500">*</span>
              </label>
              <select
                id="scope-overlap-select"
                value={overlapPolicy}
                onChange={(e) => setOverlapPolicy(e.target.value as ScopeOverlapPolicy)}
                aria-describedby="overlap-policy-desc"
                className="mt-1 block w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="allow_concurrent">Allow Concurrent (Non-blocking)</option>
                <option value="disallow_overlap">Disallow Overlap (Blocks concurrent scopes)</option>
                <option value="strict_exclusive">Strict Exclusive (Single active scholarship)</option>
              </select>
              <p id="overlap-policy-desc" className="mt-1 text-xs text-slate-500">
                {overlapPolicy === 'allow_concurrent' && 'Students can participate in multiple concurrent scopes.'}
                {overlapPolicy === 'disallow_overlap' && 'Rejects concurrent active scopes for matching terms/cohorts.'}
                {overlapPolicy === 'strict_exclusive' && 'Exclusive scholarship enrollment required for this scope.'}
              </p>
            </div>
          </div>

          {/* Application Intake Gating */}
          <div className="rounded-xl border border-slate-200 p-4">
            <div className="flex items-center justify-between">
              <div>
                <span className="text-sm font-medium text-slate-800">
                  Allow New Applications
                </span>
                <p className="text-xs text-slate-500">
                  Controls whether students can submit new applications to this scope.
                </p>
              </div>
              <label className="relative inline-flex cursor-pointer items-center">
                <input
                  type="checkbox"
                  checked={allowNewApplications && status === 'active'}
                  disabled={status !== 'active'}
                  onChange={(e) => setAllowNewApplications(e.target.checked)}
                  aria-label="Allow new applications toggle"
                  className="peer sr-only"
                />
                <div className="peer h-6 w-11 rounded-full bg-slate-200 after:absolute after:top-[2px] after:left-[2px] after:h-5 after:w-5 after:rounded-full after:border after:border-slate-300 after:bg-white after:transition-all after:content-[''] peer-checked:bg-indigo-600 peer-checked:after:translate-x-full peer-checked:after:border-white peer-disabled:cursor-not-allowed peer-disabled:opacity-50"></div>
              </label>
            </div>

            {status !== 'active' && (
              <div className="mt-2 flex items-center gap-1.5 text-xs font-semibold text-amber-700">
                <Info className="h-3.5 w-3.5 shrink-0" />
                <span>Notice: Scope is {status}. Inactive scopes cannot receive new applications.</span>
              </div>
            )}

            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <div>
                <label htmlFor="app-start-input" className="block text-xs font-medium text-slate-600">
                  Application Window Start
                </label>
                <input
                  id="app-start-input"
                  type="date"
                  value={applicationStartDate}
                  onChange={(e) => setApplicationStartDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
              <div>
                <label htmlFor="app-end-input" className="block text-xs font-medium text-slate-600">
                  Application Deadline
                </label>
                <input
                  id="app-end-input"
                  type="date"
                  value={applicationEndDate}
                  onChange={(e) => setApplicationEndDate(e.target.value)}
                  className="mt-1 block w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs shadow-xs focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>
          </div>

          {/* Scoping Dimension Selectors */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-600">
              Scoping Dimensions (Select all that apply)
            </h3>

            {/* Academic Terms */}
            <fieldset className="rounded-xl border border-slate-200 p-4">
              <legend className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700">
                <Calendar className="h-3.5 w-3.5 text-indigo-600" />
                <span>Academic Terms</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {referenceData.terms.map((term) => (
                  <label
                    key={term.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs transition ${
                      termIds.includes(term.id)
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={termIds.includes(term.id)}
                      onChange={() => toggleItem(termIds, setTermIds, term.id)}
                      aria-label={`Select term ${term.name}`}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold">{term.name} ({term.code})</p>
                      <p className="text-[11px] text-slate-500">
                        {term.academicYear} • Status: {term.status}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Academic Cohorts */}
            <fieldset className="rounded-xl border border-slate-200 p-4">
              <legend className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700">
                <Users className="h-3.5 w-3.5 text-indigo-600" />
                <span>Cohorts</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {referenceData.cohorts.map((cohort) => (
                  <label
                    key={cohort.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs transition ${
                      cohortIds.includes(cohort.id)
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={cohortIds.includes(cohort.id)}
                      onChange={() => toggleItem(cohortIds, setCohortIds, cohort.id)}
                      aria-label={`Select cohort ${cohort.name}`}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold">{cohort.name}</p>
                      <p className="text-[11px] text-slate-500">
                        Code: {cohort.code} • Status: {cohort.status}
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Courses */}
            <fieldset className="rounded-xl border border-slate-200 p-4">
              <legend className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700">
                <BookOpen className="h-3.5 w-3.5 text-indigo-600" />
                <span>Courses</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {referenceData.courses.map((course) => (
                  <label
                    key={course.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs transition ${
                      courseIds.includes(course.id)
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={courseIds.includes(course.id)}
                      onChange={() => toggleItem(courseIds, setCourseIds, course.id)}
                      aria-label={`Select course ${course.title}`}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold">{course.code}: {course.title}</p>
                      <p className="text-[11px] text-slate-500">{course.department}</p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Institutions */}
            <fieldset className="rounded-xl border border-slate-200 p-4">
              <legend className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700">
                <Building className="h-3.5 w-3.5 text-indigo-600" />
                <span>Institutions</span>
              </legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {referenceData.institutions.map((inst) => (
                  <label
                    key={inst.id}
                    className={`flex cursor-pointer items-start gap-2.5 rounded-lg border p-2.5 text-xs transition ${
                      institutionIds.includes(inst.id)
                        ? 'border-indigo-500 bg-indigo-50/60 text-indigo-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={institutionIds.includes(inst.id)}
                      onChange={() => toggleItem(institutionIds, setInstitutionIds, inst.id)}
                      aria-label={`Select institution ${inst.name}`}
                      className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <div>
                      <p className="font-semibold">{inst.name}</p>
                      <p className="text-[11px] text-slate-500">
                        {inst.country} ({inst.region})
                      </p>
                    </div>
                  </label>
                ))}
              </div>
            </fieldset>

            {/* Geographic Regions */}
            <fieldset className="rounded-xl border border-slate-200 p-4">
              <legend className="flex items-center gap-1.5 px-2 text-xs font-bold text-slate-700">
                <Globe className="h-3.5 w-3.5 text-indigo-600" />
                <span>Geographic Regions</span>
              </legend>
              <div className="flex flex-wrap gap-2">
                {referenceData.regions.map((reg) => (
                  <label
                    key={reg.id}
                    className={`flex cursor-pointer items-center gap-2 rounded-lg border px-3 py-1.5 text-xs transition ${
                      regions.includes(reg.code)
                        ? 'border-indigo-500 bg-indigo-50/60 font-semibold text-indigo-900'
                        : 'border-slate-200 hover:bg-slate-50 text-slate-700'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={regions.includes(reg.code)}
                      onChange={() => toggleItem(regions, setRegions, reg.code)}
                      aria-label={`Select region ${reg.name}`}
                      className="rounded text-indigo-600 focus:ring-indigo-500"
                    />
                    <span>{reg.name}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </div>

          {/* Form Actions */}
          <div className="flex items-center justify-end gap-3 border-t border-slate-200 pt-4">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 rounded-xl bg-indigo-600 px-5 py-2 text-sm font-semibold text-white shadow-xs hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isSubmitting && <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />}
              <span>{isEditing ? 'Save Changes' : 'Create Scope'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
