'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  auditOutcome,
  fairnessDefinitions,
  fairnessService,
  FUNNEL_STAGE_LABELS,
  MIN_COHORT_SIZE,
  SMALL_COHORT_THRESHOLD,
} from '../service';
import type { BiasAudit, FairnessDefinition, FunnelMetric } from '../types';

type ScholarshipFairnessReportProps = {
  programId?: string;
  canManage?: boolean;
};

type Panel = 'funnel' | 'bias-audit';

type RollbackPlanState = Record<string, string>;

export function ScholarshipFairnessReport({
  programId = 'chainverse-scholarship',
  canManage = true,
}: ScholarshipFairnessReportProps) {
  const formId = useId();
  const headingId = `${formId}-heading`;

  const [funnel, setFunnel] = useState<FunnelMetric[]>([]);
  const [audits, setAudits] = useState<BiasAudit[]>([]);
  const [definitions, setDefinitions] = useState<FairnessDefinition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [panel, setPanel] = useState<Panel>('funnel');
  const [plans, setPlans] = useState<RollbackPlanState>({});

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [loadedFunnel, loadedAudits] = await Promise.all([
        fairnessService.getFunnel(programId),
        fairnessService.getAudits(programId),
      ]);
      setFunnel(loadedFunnel);
      setAudits(loadedAudits);
      setDefinitions(fairnessDefinitions());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load the fairness report.');
    } finally {
      setLoading(false);
    }
  }, [programId]);

  useEffect(() => {
    void load();
  }, [load]);

  const suppressedCount = useMemo(
    () => funnel.filter((metric) => metric.suppressed).length,
    [funnel]
  );

  if (!canManage) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
        role="note"
        data-testid="fairness-permission-denied"
      >
        <h2 className="text-lg font-semibold text-slate-900">Fairness report is read-only</h2>
        <p className="mt-2 text-sm text-slate-600">
          Your role cannot edit a bias audit or a rollback plan. Ask the programme owner to record
          changes, or review the published rates below.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600 shadow-sm"
        role="status"
        aria-live="polite"
      >
        Loading funnel and bias audit data for {programId}...
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-4">
        <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
          {error}
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white focus:outline-none focus:ring-2 focus:ring-slate-300"
        >
          Retry loading the report
        </button>
      </div>
    );
  }

  if (funnel.length === 0 && audits.length === 0) {
    return (
      <div
        className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600"
        role="status"
        aria-live="polite"
      >
        No fairness data is available for this programme yet. Run a round before publishing rates.
      </div>
    );
  }

  return (
    <section
      className="mx-auto max-w-6xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
      aria-labelledby={headingId}
    >
      <header>
        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Equity</p>
        <h2 id={headingId} className="mt-2 text-2xl font-black text-slate-900">
          Selection funnel and bias audit
        </h2>
        <p className="mt-2 text-sm text-slate-600">
          Rates are published per stage with a definition and a caveat. Cohorts smaller than{' '}
          {SMALL_COHORT_THRESHOLD.threshold} are suppressed and no individual applicant is ever
          exposed.
        </p>
      </header>

      <div className="flex gap-2" role="group" aria-label="Report sections">
        {(['funnel', 'bias-audit'] as Panel[]).map((value) => (
          <button
            key={value}
            type="button"
            aria-pressed={panel === value}
            onClick={() => setPanel(value)}
            className={`rounded-full px-4 py-2 text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-emerald-200 ${
              panel === value
                ? 'bg-emerald-700 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
          >
            {value === 'funnel' ? 'Funnel' : 'Bias audit'}
          </button>
        ))}
      </div>

      {panel === 'funnel' ? (
        <div className="space-y-4">
          <p className="text-sm text-slate-700" role="status" aria-live="polite">
            {funnel.length} stages reported, {suppressedCount} suppressed for a small cohort.
          </p>
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="mb-2 text-left text-sm text-slate-600">
                Application funnel for {programId}. The table is the accessible source of truth for
                every rate; suppressed cells never show a number.
              </caption>
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    Stage
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    Applicants
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    From previous stage
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    From eligible
                  </th>
                </tr>
              </thead>
              <tbody>
                {funnel.map((metric) => (
                  <tr key={metric.stage} className="border-b border-slate-100">
                    <th scope="row" className="px-3 py-2 font-medium text-slate-900">
                      {FUNNEL_STAGE_LABELS[metric.stage]}
                    </th>
                    <td className="px-3 py-2 text-slate-700">
                      {metric.suppressed ? (
                        <span
                          aria-label={`Applicants suppressed because the cohort is smaller than ${MIN_COHORT_SIZE}`}
                        >
                          Suppressed (cohort &lt; {MIN_COHORT_SIZE})
                        </span>
                      ) : (
                        metric.count.toLocaleString()
                      )}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {metric.suppressed || metric.rateFromPrevious === null
                        ? 'Not available'
                        : `${Math.round(metric.rateFromPrevious * 100)}%`}
                    </td>
                    <td className="px-3 py-2 text-slate-700">
                      {metric.suppressed ? 'Not available' : `${Math.round(metric.rateFromEligible * 100)}%`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <section aria-labelledby={`${formId}-definitions`}>
            <h3 id={`${formId}-definitions`} className="text-lg font-semibold text-slate-900">
              Definitions and caveats
            </h3>
            <ul className="mt-2 space-y-2">
              {definitions.map((definition) => (
                <li key={definition.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                  <details>
                    <summary className="cursor-pointer text-sm font-semibold text-slate-900">
                      {definition.name}
                    </summary>
                    <p className="mt-2 text-sm text-slate-700">{definition.definition}</p>
                    <p className="mt-1 text-sm text-amber-800">Caveat: {definition.caveat}</p>
                    <p className="mt-1 text-xs text-slate-500">
                      Source cohort: {definition.sourceCohort}. Computed {definition.computedAt}.
                    </p>
                  </details>
                </li>
              ))}
            </ul>
          </section>
        </div>
      ) : (
        <div className="space-y-4">
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-left text-sm">
              <caption className="mb-2 text-left text-sm text-slate-600">
                Bias audits for the selection rule versions of {programId}. A high-risk rule version
                cannot be cleared without a named approver.
              </caption>
              <thead>
                <tr className="border-b border-slate-200">
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    Rule version
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    Owner
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    Test cohort
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    Disparate impact ratio
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    Outcome
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold text-slate-900">
                    Approval
                  </th>
                </tr>
              </thead>
              <tbody>
                {audits.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-3 py-6 text-slate-600">
                      No bias audit has been recorded for this programme.
                    </td>
                  </tr>
                ) : (
                  audits.map((audit) => {
                    const decision = auditOutcome(audit);
                    return (
                      <tr key={audit.id} className="border-b border-slate-100 align-top">
                        <th scope="row" className="px-3 py-2 font-medium text-slate-900">
                          {audit.ruleVersionId}
                        </th>
                        <td className="px-3 py-2 text-slate-700">{audit.owner}</td>
                        <td className="px-3 py-2 text-slate-700">{audit.testCohort}</td>
                        <td className="px-3 py-2 text-slate-700">
                          {audit.disparateImpactRatio.toFixed(2)}
                          {decision.highRisk ? (
                            <span className="mt-1 block text-xs font-semibold text-red-800">
                              Below the 80% floor
                            </span>
                          ) : null}
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          <span className="font-semibold">{decision.outcome}</span>
                          <span className="mt-1 block text-xs text-slate-600">{decision.explanation}</span>
                        </td>
                        <td className="px-3 py-2 text-slate-700">
                          {decision.approvalRequired ? 'Approval required' : 'Not required'}
                          {audit.approvedBy ? ` — approved by ${audit.approvedBy}` : ''}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <section aria-labelledby={`${formId}-rollback`}>
            <h3 id={`${formId}-rollback`} className="text-lg font-semibold text-slate-900">
              Rollback plans
            </h3>
            <p className="mt-1 text-sm text-slate-600">
              Every rule version records how to return to the previous scoring behaviour.
            </p>
            <ul className="mt-3 space-y-3">
              {audits.map((audit) => {
                const planFieldId = `${formId}-plan-${audit.id}`;
                return (
                  <li key={audit.id} className="rounded-lg border border-slate-200 bg-slate-50 p-3">
                    <label htmlFor={planFieldId} className="block text-sm font-medium text-slate-800">
                      Rollback plan for {audit.ruleVersionId}
                    </label>
                    <p className="mt-1 text-xs text-slate-600">Recorded plan: {audit.rollbackPlan}</p>
                    <textarea
                      id={planFieldId}
                      rows={2}
                      value={plans[audit.id] ?? ''}
                      disabled={!canManage}
                      onChange={(event) =>
                        setPlans((current) => ({ ...current, [audit.id]: event.target.value }))
                      }
                      className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:opacity-60"
                    />
                  </li>
                );
              })}
            </ul>
          </section>
        </div>
      )}
    </section>
  );
}

export default ScholarshipFairnessReport;
