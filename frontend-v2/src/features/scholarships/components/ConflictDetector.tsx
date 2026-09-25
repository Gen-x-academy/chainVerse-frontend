'use client';

import { useEffect, useState } from 'react';
import {
  conflictService,
  detectConflicts,
  fallbackConflicts,
  hasActiveConflict,
} from '../conflict';
import type { ConflictRecord, ConflictType } from '../conflict';
import { fallbackReviewerPool } from '../reviewer-pool';

const APPLICATION_ID = 'demo-application';

const conflictTypeLabels: Record<ConflictType, string> = {
  'applicant-relation': 'Applicant relationship',
  'sponsor-relation': 'Sponsor affiliation',
  'institution-relation': 'Shared institution',
  'course-relation': 'Course connection',
  'declared-relationship': 'Declared relationship',
};

export function ConflictDetector() {
  const [records, setRecords] = useState<ConflictRecord[]>(fallbackConflicts);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'empty'>('loading');
  const [overrideReviewerId, setOverrideReviewerId] = useState('');
  const [overrideReason, setOverrideReason] = useState('');
  const [overrideStatus, setOverrideStatus] = useState<'idle' | 'saving' | 'success' | 'error'>(
    'idle'
  );
  const [overrideError, setOverrideError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    conflictService
      .list(APPLICATION_ID)
      .then((data) => {
        if (!isMounted) return;
        if (data.length === 0) {
          setStatus('empty');
          setRecords([]);
          return;
        }
        setRecords(data);
        setStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setRecords(fallbackConflicts);
        setStatus('error');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const liveConflicts = detectConflicts({
    reviewerId: 'reviewer-2',
    applicationApplicantId: 'student-99',
    declaredRelationshipIds: ['reviewer-2'],
    reviewerApplicantIds: [],
  });

  const handleRequestOverride = async () => {
    if (!overrideReviewerId || !overrideReason.trim()) {
      setOverrideError('Select a reviewer and provide a documented reason for the override.');
      setOverrideStatus('error');
      return;
    }
    const conflict = records.find(
      (rec) =>
        rec.reviewerId === overrideReviewerId &&
        rec.applicationId === APPLICATION_ID &&
        (rec.status === 'detected' || rec.status === 'acknowledged')
    );
    if (!conflict) {
      setOverrideError('No active conflict found for the selected reviewer.');
      setOverrideStatus('error');
      return;
    }
    setOverrideStatus('saving');
    setOverrideError(null);
    try {
      const updated = await conflictService.requestOverride(conflict.id, overrideReason, 'admin');
      setRecords((current) => current.map((rec) => (rec.id === updated.id ? updated : rec)));
      setOverrideStatus('success');
      setOverrideReason('');
    } catch {
      setOverrideError('Override request could not be submitted. Please try again.');
      setOverrideStatus('error');
    }
  };

  const activeConflictCount = records.filter(
    (rec) => rec.status === 'detected' || rec.status === 'acknowledged'
  ).length;

  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900"
      aria-labelledby="conflict-detector-title"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Review integrity
        </p>
        <h2
          id="conflict-detector-title"
          className="text-3xl font-bold tracking-tight md:text-4xl"
        >
          Conflict of interest detection
        </h2>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Conflicted reviewers cannot access or score an application. Overrides require documented
          approval and are permanently audited.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          {liveConflicts.length > 0 && (
            <div role="alert" className="rounded-2xl border border-red-200 bg-red-50 p-5">
              <p className="font-semibold text-red-800">
                Conflicts detected for the current reviewer
              </p>
              <ul className="mt-3 space-y-2">
                {liveConflicts.map((conflict) => (
                  <li
                    key={conflict.conflictType}
                    className="flex items-start gap-2 text-sm text-red-700"
                  >
                    <span aria-hidden="true">•</span>
                    <span>
                      <strong>{conflictTypeLabels[conflict.conflictType]}:</strong>{' '}
                      {conflict.description}
                    </span>
                  </li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-red-600">
                Access to this application is blocked until conflicts are resolved or an override is
                approved.
              </p>
            </div>
          )}

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Conflict records</h3>

            {status === 'loading' && (
              <p role="status" aria-live="polite" className="mt-4 text-sm text-slate-600">
                Loading conflict records…
              </p>
            )}
            {status === 'error' && (
              <div
                role="alert"
                className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800"
              >
                Conflict service unavailable. Showing cached records.
              </div>
            )}
            {status === 'empty' && (
              <p
                role="status"
                className="mt-4 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600"
              >
                No conflicts have been detected for this application.
              </p>
            )}

            {records.length > 0 && (
              <ul className="mt-4 space-y-3" aria-label="Conflict record list">
                {records.map((record) => {
                  const blocked = hasActiveConflict(record.reviewerId, record.applicationId, records);
                  return (
                    <li
                      key={record.id}
                      className={`rounded-xl border p-4 ${
                        record.status === 'detected'
                          ? 'border-red-200 bg-red-50'
                          : record.status === 'acknowledged'
                            ? 'border-amber-200 bg-amber-50'
                            : record.status === 'override-approved'
                              ? 'border-emerald-200 bg-emerald-50'
                              : 'border-slate-200 bg-slate-50'
                      }`}
                      aria-label={`Conflict for ${record.reviewerName}: ${record.status}`}
                    >
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div>
                          <p className="font-medium text-slate-900">{record.reviewerName}</p>
                          <p className="text-sm text-slate-600">
                            {conflictTypeLabels[record.conflictType]}
                          </p>
                          <p className="mt-1 text-sm text-slate-700">{record.description}</p>
                        </div>
                        <span
                          className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                            record.status === 'detected'
                              ? 'bg-red-100 text-red-700'
                              : record.status === 'acknowledged'
                                ? 'bg-amber-100 text-amber-700'
                                : record.status === 'override-approved'
                                  ? 'bg-emerald-100 text-emerald-700'
                                  : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {record.status}
                        </span>
                      </div>
                      {record.overrideReason && (
                        <p className="mt-2 text-xs text-slate-600">
                          <span className="font-medium">Override reason:</span>{' '}
                          {record.overrideReason}
                          {record.overrideApprovedBy &&
                            ` (approved by ${record.overrideApprovedBy})`}
                        </p>
                      )}
                      <p className="mt-2 text-xs text-slate-500">
                        {blocked ? 'Access blocked' : 'Access permitted'}
                      </p>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Request override</h3>
            <p className="mt-1 text-sm text-slate-600">
              Overrides require a documented reason and authorized approval before a conflicted
              reviewer can access the application.
            </p>

            <label className="mt-4 block space-y-1 text-sm font-medium text-slate-700">
              Conflicted reviewer
              <select
                value={overrideReviewerId}
                onChange={(e) => {
                  setOverrideReviewerId(e.target.value);
                  setOverrideStatus('idle');
                  setOverrideError(null);
                }}
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-label="Select conflicted reviewer"
              >
                <option value="">Select a reviewer</option>
                {fallbackReviewerPool.reviewers.map((reviewer) => (
                  <option key={reviewer.id} value={reviewer.id}>
                    {reviewer.displayName}
                  </option>
                ))}
              </select>
            </label>

            <label className="mt-4 block space-y-1 text-sm font-medium text-slate-700">
              Documented reason
              <textarea
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
                rows={3}
                placeholder="Explain why this override is justified and who authorized it."
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-describedby="override-reason-help"
              />
              <span id="override-reason-help" className="block text-xs font-normal text-slate-500">
                Permanently recorded in the audit log.
              </span>
            </label>

            <button
              type="button"
              onClick={() => void handleRequestOverride()}
              disabled={overrideStatus === 'saving'}
              className="mt-4 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {overrideStatus === 'saving' ? 'Submitting…' : 'Submit override request'}
            </button>

            <div className="mt-3" aria-live="polite">
              {overrideStatus === 'success' && (
                <p role="status" className="text-sm text-emerald-700">
                  Override request submitted. Pending authorized approval.
                </p>
              )}
              {overrideError && (
                <p role="alert" className="text-sm text-red-700">
                  {overrideError}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Active conflicts
            </p>
            <p className="mt-2 text-3xl font-bold">{activeConflictCount}</p>
            <p className="mt-1 text-sm text-slate-400">blocking assignment</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ConflictDetector;
