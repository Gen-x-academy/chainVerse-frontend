'use client';

import { useEffect, useState } from 'react';
import {
  REDACTED_PLACEHOLDER,
  blindReviewService,
  hasLeakedPii,
  redactApplicant,
  redactReviewer,
} from '../blind-review';
import type { ApplicantProfile, BlindMode, ReviewerIdentity, UnblindRequest } from '../blind-review';
import { fallbackReviewerPool } from '../reviewer-pool';

const APPLICATION_ID = 'demo-application';

const demoApplicant: ApplicantProfile = {
  id: 'student-99',
  name: 'Kwame Mensah',
  email: 'kwame.mensah@example.com',
  institution: 'University of Ghana',
  location: 'Accra, Ghana',
  profileUrl: 'https://example.com/profiles/kwame',
  photo: 'https://example.com/photos/kwame.jpg',
  courseIds: ['intro-to-blockchain'],
  gradeValue: 88,
  statementOfPurpose:
    'I want to learn blockchain technology to build financial tools for underserved communities.',
};

const demoReviewer: ReviewerIdentity = {
  id: fallbackReviewerPool.reviewers[0].id,
  displayName: fallbackReviewerPool.reviewers[0].displayName,
  email: 'amara.osei@example.com',
  institution: 'Accra Technical University',
};

const modeDescriptions: Record<BlindMode, string> = {
  none: 'All applicant and reviewer details are visible.',
  'single-blind': 'Applicant identity is hidden from reviewers. Reviewer identity is visible.',
  'double-blind': 'Both applicant and reviewer identities are hidden from each other.',
};

export function BlindReviewPanel() {
  const [mode, setMode] = useState<BlindMode>('single-blind');
  const [unblindRequests, setUnblindRequests] = useState<UnblindRequest[]>([]);
  const [requestStatus, setRequestStatus] = useState<'idle' | 'loading' | 'success' | 'error'>(
    'idle'
  );
  const [unblindReason, setUnblindReason] = useState('');
  const [unblindError, setUnblindError] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');

  useEffect(() => {
    let isMounted = true;
    setRequestStatus('loading');
    blindReviewService
      .listUnblindRequests(APPLICATION_ID)
      .then((data) => {
        if (!isMounted) return;
        setUnblindRequests(data);
        setRequestStatus('success');
      })
      .catch(() => {
        if (!isMounted) return;
        setRequestStatus('error');
      });
    return () => {
      isMounted = false;
    };
  }, []);

  const redactedApplicant = redactApplicant(demoApplicant, mode);
  const redactedReviewer = redactReviewer(demoReviewer, mode);
  const leaked = hasLeakedPii(redactedApplicant, demoApplicant, mode);

  const handleRequestUnblind = async () => {
    if (!unblindReason.trim()) {
      setUnblindError('Provide a reason to request unblinding of this application.');
      setSaveStatus('error');
      return;
    }
    setSaveStatus('saving');
    setUnblindError(null);
    try {
      const request = await blindReviewService.requestUnblind(
        APPLICATION_ID,
        unblindReason,
        'reviewer-1'
      );
      setUnblindRequests((current) => [...current, request]);
      setSaveStatus('success');
      setUnblindReason('');
    } catch {
      setUnblindError('Unblind request could not be submitted. Please try again.');
      setSaveStatus('error');
    }
  };

  const isRedacted = (value: string | undefined): boolean =>
    value === REDACTED_PLACEHOLDER || value === undefined;

  const applicantFields: [string, string][] = [
    ['Name', redactedApplicant.name],
    ['Email', redactedApplicant.email],
    ['Institution', redactedApplicant.institution],
    ['Location', redactedApplicant.location],
    ['Profile URL', redactedApplicant.profileUrl],
    ['Photo', redactedApplicant.photo ?? '[not provided]'],
    ['Courses', redactedApplicant.courseIds.join(', ')],
    ['Grade', String(redactedApplicant.gradeValue ?? '—')],
  ];

  return (
    <section
      className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900"
      aria-labelledby="blind-review-title"
    >
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Review integrity
        </p>
        <h2 id="blind-review-title" className="text-3xl font-bold tracking-tight md:text-4xl">
          Blind and double-blind review
        </h2>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Configured identity fields are redacted before reviewers see an application. Hidden fields
          never leak through exports, events, URLs, or error messages. Authorized unblinding is
          audited.
        </p>
      </header>

      {leaked && (
        <div
          role="alert"
          className="rounded-2xl border border-red-300 bg-red-50 p-4 text-sm font-semibold text-red-800"
        >
          PII leak detected — a redacted field still contains the original value. Review your
          redaction configuration immediately.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Review mode</h3>
            <div
              className="mt-4 grid gap-3"
              role="radiogroup"
              aria-label="Choose review mode"
            >
              {(['none', 'single-blind', 'double-blind'] as BlindMode[]).map((m) => (
                <label
                  key={m}
                  className="flex cursor-pointer gap-3 rounded-xl border border-slate-200 p-3 transition has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50"
                >
                  <input
                    type="radio"
                    name="blind-mode"
                    value={m}
                    checked={mode === m}
                    onChange={() => setMode(m)}
                    className="mt-1 h-4 w-4 border-slate-300 text-indigo-600 focus:ring-indigo-500"
                  />
                  <span>
                    <span className="block font-medium capitalize text-slate-900">
                      {m.replace(/-/g, ' ')}
                    </span>
                    <span className="block text-sm text-slate-600">{modeDescriptions[m]}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Applicant view (as seen by reviewer)</h3>
            <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
              {applicantFields.map(([label, value]) => (
                <div
                  key={label}
                  className={`rounded-xl border p-3 ${
                    isRedacted(value) ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                  }`}
                >
                  <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    {label}
                  </dt>
                  <dd
                    className={`mt-1 break-all font-medium ${
                      isRedacted(value) ? 'text-amber-700' : 'text-slate-900'
                    }`}
                    aria-label={isRedacted(value) ? `${label}: redacted` : undefined}
                  >
                    {value}
                  </dd>
                </div>
              ))}
            </dl>
            <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                Statement of purpose
              </p>
              <p className="mt-1 text-slate-900">{redactedApplicant.statementOfPurpose}</p>
            </div>
          </div>

          {mode === 'double-blind' && (
            <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <h3 className="text-lg font-semibold">Reviewer view (as seen by applicant)</h3>
              <dl className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
                {(
                  [
                    ['Display name', redactedReviewer.displayName],
                    ['Email', redactedReviewer.email],
                    ['Institution', redactedReviewer.institution],
                  ] as [string, string][]
                ).map(([label, value]) => (
                  <div
                    key={label}
                    className={`rounded-xl border p-3 ${
                      isRedacted(value) ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-slate-50'
                    }`}
                  >
                    <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                      {label}
                    </dt>
                    <dd
                      className={`mt-1 font-medium ${
                        isRedacted(value) ? 'text-amber-700' : 'text-slate-900'
                      }`}
                    >
                      {value}
                    </dd>
                  </div>
                ))}
              </dl>
            </div>
          )}
        </div>

        <aside className="space-y-5">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold">Request unblinding</h3>
            <p className="mt-1 text-sm text-slate-600">
              Authorized unblinding is audited. The request is logged before any identity is
              revealed.
            </p>
            <label className="mt-4 block space-y-1 text-sm font-medium text-slate-700">
              Reason
              <textarea
                value={unblindReason}
                onChange={(e) => setUnblindReason(e.target.value)}
                rows={3}
                placeholder="Why is unblinding necessary for this application?"
                className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                aria-describedby="unblind-reason-help"
              />
              <span id="unblind-reason-help" className="block text-xs font-normal text-slate-500">
                Permanently recorded in the audit trail.
              </span>
            </label>
            <button
              type="button"
              onClick={() => void handleRequestUnblind()}
              disabled={saveStatus === 'saving'}
              className="mt-4 w-full rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {saveStatus === 'saving' ? 'Submitting…' : 'Request unblinding'}
            </button>
            <div className="mt-3" aria-live="polite">
              {saveStatus === 'success' && (
                <p role="status" className="text-sm text-emerald-700">
                  Unblind request submitted and logged.
                </p>
              )}
              {unblindError && (
                <p role="alert" className="text-sm text-red-700">
                  {unblindError}
                </p>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="font-semibold">Unblind request history</h3>
            {requestStatus === 'loading' && (
              <p role="status" aria-live="polite" className="mt-3 text-sm text-slate-600">
                Loading…
              </p>
            )}
            {requestStatus === 'error' && (
              <p role="alert" className="mt-3 text-sm text-red-700">
                Could not load request history.
              </p>
            )}
            {requestStatus === 'success' && unblindRequests.length === 0 && (
              <p className="mt-3 text-sm text-slate-600">
                No unblind requests for this application.
              </p>
            )}
            {unblindRequests.length > 0 && (
              <ul className="mt-3 space-y-3" aria-label="Unblind request history">
                {unblindRequests.map((req) => (
                  <li key={req.id} className="rounded-xl border border-slate-200 p-3 text-sm">
                    <p className="font-medium text-slate-900">{req.requestedBy}</p>
                    <p className="mt-1 text-slate-600">{req.reason}</p>
                    <span
                      className={`mt-2 inline-block rounded-full px-2 py-0.5 text-xs font-medium ${
                        req.status === 'approved'
                          ? 'bg-emerald-100 text-emerald-700'
                          : req.status === 'denied'
                            ? 'bg-red-100 text-red-700'
                            : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      {req.status}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">
              Current mode
            </p>
            <p className="mt-2 text-xl font-bold capitalize">{mode.replace(/-/g, ' ')}</p>
            <p className="mt-1 text-sm text-slate-400">{modeDescriptions[mode]}</p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default BlindReviewPanel;
