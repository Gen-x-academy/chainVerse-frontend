'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  GO_LIVE_CHECKS,
  defaultReadinessPolicy,
  evaluateReadiness,
  planRollback,
  schedulePostLaunchReview,
} from '../release';
import type { ActiveApplication, FundItem, GoLiveCheck, PostLaunchReview, RollbackPlan } from '../release';

const sampleApplications: ActiveApplication[] = [
  { id: 'app-2001', applicantId: 'apt-9001', status: 'under-review', version: 3 },
  { id: 'app-2002', applicantId: 'apt-9002', status: 'committed', version: 2 },
];

const sampleFunds: FundItem[] = [
  { id: 'fund-301', applicationId: 'app-2001', amount: '500', status: 'escrowed' },
  { id: 'fund-302', applicationId: 'app-2001', amount: '1200', status: 'disbursed' },
  { id: 'fund-303', applicationId: 'app-2002', amount: '800', status: 'disbursing' },
];

const defaultReview: PostLaunchReview = {
  reviewId: 'review-2026-10-15',
  scheduledFor: '2026-10-15T09:00:00.000Z',
  reviewers: ['Finance operations', 'Platform engineering'],
  criteria: ['Decision slope and payment failure rate are within target.', 'No new support escalations for 48 hours.'],
  owner: 'Program delivery',
  status: 'scheduled',
};

export function LaunchReadinessChecklist() {
  const [checks, setChecks] = useState<GoLiveCheck[]>(GO_LIVE_CHECKS.map((check) => ({ ...check })));
  const [owner, setOwner] = useState('Platform engineering');
  const [rollbackPlan, setRollbackPlan] = useState<RollbackPlan | null>(null);
  const [review, setReview] = useState<PostLaunchReview | null>(defaultReview);
  const [status, setStatus] = useState<'ready' | 'loading' | 'error'>('loading');

  useEffect(() => {
    const timer = window.setTimeout(() => setStatus('ready'), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const verdict = useMemo(() => evaluateReadiness(checks, defaultReadinessPolicy), [checks]);

  const handleToggle = (checkId: string) => {
    setChecks((current) =>
      current.map((check) =>
        check.id === checkId
          ? {
              ...check,
              status: check.status !== 'passed' ? 'passed' : 'pending',
              signedOffBy: check.status !== 'passed' ? owner : undefined,
              signedOffAt: check.status !== 'passed' ? new Date().toISOString() : undefined,
            }
          : check
      )
    );
  };

  const handlePlanRollback = () => {
    try {
      setRollbackPlan(planRollback({ featureFlagsToDisable: ['scholarships.release', 'scholarships.payments'], applications: sampleApplications, funds: sampleFunds }));
    } catch {
      setStatus('error');
    }
  };

  const handleScheduleReview = () => {
    try {
      setReview(schedulePostLaunchReview({ ...defaultReview, owner }));
    } catch {
      setStatus('error');
    }
  };

  const categoryLabel: Record<string, string> = {
    security: 'Security',
    privacy: 'Privacy',
    accessibility: 'Accessibility',
    solvency: 'Solvency',
    support: 'Support',
    monitoring: 'Monitoring',
    dataMigration: 'Data migration',
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Launch readiness & rollback</p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">Scholarship launch checklist</h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Every blocking criterion must be signed off by its named owner before launch. Rollback planning preserves
          active applications and funds so launch can always be reversed safely.
        </p>
      </header>

      {status === 'loading' && (
        <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          Loading launch checks…
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
          The launch service is temporarily unavailable. Reviewing may be retried.
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">Go-live checks</h2>
          <span
            className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold ${
              verdict.ready ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
            }`}
            aria-live="polite"
          >
            {verdict.ready ? 'Ready to launch' : 'Not ready'}
          </span>
        </div>

        {['security', 'privacy', 'accessibility', 'solvency', 'support', 'monitoring', 'dataMigration'].map((category) => (
          <div key={category} className="mb-4">
            <h3 className="mb-2 text-sm font-semibold uppercase tracking-wide text-slate-500">{categoryLabel[category]}</h3>
            <ul className="space-y-2">
              {checks
                .filter((check) => check.category === category)
                .map((check) => (
                  <li key={check.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="max-w-xl">
                        <p className="font-medium text-slate-900">{check.title}</p>
                        <p className="text-sm text-slate-600">{check.description}</p>
                        <p className="mt-1 text-xs text-slate-500">Criteria: {check.measurableCriteria}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          Owner: {check.owner}
                          {check.signedOffBy ? ` · Signed off by ${check.signedOffBy}` : ''}
                        </p>
                      </div>
                      <div className="flex items-center gap-3">
                        {check.status === 'passed' && (
                          <span className="rounded-full bg-emerald-100 px-2.5 py-1 text-xs font-semibold text-emerald-700">Passed</span>
                        )}
                        <button
                          type="button"
                          onClick={() => handleToggle(check.id)}
                          aria-pressed={check.status === 'passed'}
                          aria-label={`${check.status === 'passed' ? 'Reopen' : 'Pass'} ${check.title}`}
                          className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                        >
                          {check.status === 'passed' ? 'Reopen' : 'Mark passed'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
            </ul>
          </div>
        ))}

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <label className="block text-sm font-medium text-slate-700">
            Sign-off identity
            <input
              type="text"
              value={owner}
              onChange={(event) => setOwner(event.target.value)}
              aria-label="Sign-off identity"
              className="mt-1 w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </label>
          <p className="mt-2 text-sm text-slate-600" aria-live="polite">
            {verdict.ready
              ? 'All blocking checks are signed off.'
              : `${verdict.blockedCategories.map((category) => categoryLabel[category]).filter(Boolean).join(', ') || 'Blocking checks pending sign-off'}`}
            {verdict.unsignedOwners.length > 0 && ` · Awaiting sign-off from ${verdict.unsignedOwners.join(', ')}.`}
          </p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Rollback plan</h2>
            <button
              type="button"
              onClick={handlePlanRollback}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Draft plan
            </button>
          </div>

          {rollbackPlan ? (
            <dl className="space-y-3 text-sm text-slate-600">
              <div>
                <dt className="font-medium text-slate-900">Plan ID</dt>
                <dd className="font-mono text-xs">{rollbackPlan.planId}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Flags to disable</dt>
                <dd>{rollbackPlan.featureFlagsToDisable.join(', ')}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Applications retained</dt>
                <dd>
                  {rollbackPlan.retainedApplicationIds.length} active applications kept intact — never deleted on rollback.
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Fund handling</dt>
                <dd>{rollbackPlan.fundActions.map((action) => `${action.fundId} → ${action.action}`).join(' · ')}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Guards</dt>
                <dd>{rollbackPlan.fundActions.some((action) => action.action === 'revert') ? 'Reverts stay in escrow until the application is verified.' : 'No payouts proceed while the rollback lock is active.'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Verification</dt>
                <dd className={`font-semibold ${rollbackPlan.preservesActiveApplications && rollbackPlan.preservesFunds ? 'text-emerald-600' : 'text-red-600'}`}>
                  {rollbackPlan.preservesActiveApplications && rollbackPlan.preservesFunds
                    ? 'Preserves applications and funds'
                    : 'Guard failure'}
                </dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-600">No rollback plan drafted yet.</p>
          )}
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="text-xl font-semibold">Post-launch review</h2>
            <button
              type="button"
              onClick={handleScheduleReview}
              className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
            >
              Schedule
            </button>
          </div>

          {review ? (
            <dl className="space-y-3 text-sm text-slate-600">
              <div>
                <dt className="font-medium text-slate-900">Scheduled for</dt>
                <dd>{new Date(review.scheduledFor).toLocaleString()}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Reviewers</dt>
                <dd>{review.reviewers.join(', ')}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Criteria</dt>
                <dd>
                  <ul className="list-disc space-y-1 pl-5">
                    {review.criteria.map((criterion) => (
                      <li key={criterion}>{criterion}</li>
                    ))}
                  </ul>
                </dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Owner</dt>
                <dd>{review.owner}</dd>
              </div>
            </dl>
          ) : (
            <p className="text-sm text-slate-600">A dated review with named reviewers must be booked before go-live.</p>
          )}
        </div>
      </div>
    </section>
  );
}

export default LaunchReadinessChecklist;