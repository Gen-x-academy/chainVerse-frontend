'use client';

import { type ChangeEvent, useEffect, useMemo, useState } from 'react';
import { evaluateEligibility, validateRuleSet } from '../rules';
import { scholarshipFallbackRules, scholarshipService } from '../service';
import type { EligibilityApplicant, EligibilityRuleSet } from '../types';

const defaultApplicant: EligibilityApplicant = {
  enrollmentStatus: 'current',
  courseIds: ['intro-to-blockchain'],
  gradeValue: 82,
  gradeMetric: 'percentage',
  region: 'africa',
  incomeBand: 'low',
  role: 'student',
  age: 21,
  customAttestation: 'confirmed',
  completedAchievementIds: ['blockchain-foundations'],
  selectedScholarshipIds: [],
  priorAwardIds: [],
  evidencePermissionGranted: true,
};

export function EligibilityRuleBuilder() {
  const [rules, setRules] = useState<EligibilityRuleSet[]>(scholarshipFallbackRules);
  const [applicant, setApplicant] = useState<EligibilityApplicant>(defaultApplicant);
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'empty'>('loading');

  useEffect(() => {
    let isMounted = true;

    const loadRules = async () => {
      try {
        const response = await scholarshipService.listRules();
        if (!isMounted) return;

        if (!response || response.length === 0) {
          setRules([]);
          setStatus('empty');
          return;
        }

        setRules(response);
        setStatus('success');
      } catch {
        if (!isMounted) return;
        setRules(scholarshipFallbackRules);
        setStatus('error');
      }
    };

    void loadRules();
    return () => {
      isMounted = false;
    };
  }, []);

  const validation = useMemo(
    () => validateRuleSet(rules[0] ?? {
      id: 'draft-rules',
      name: 'Draft scholarship rules',
      description: 'Draft publication state.',
      operator: 'all',
      rules: [],
      published: false,
      lastUpdated: new Date().toISOString(),
    }),
    [rules]
  );

  const decision = useMemo(() => {
    const activeSet = rules[0] ?? {
      id: 'draft-rules',
      name: 'Draft scholarship rules',
      description: 'Draft publication state.',
      operator: 'all',
      rules: [],
      published: false,
      lastUpdated: new Date().toISOString(),
    };

    return evaluateEligibility(activeSet, applicant);
  }, [applicant, rules]);

  const handlePermissionChange = (event: ChangeEvent<HTMLInputElement>) => {
    setApplicant((current) => ({
      ...current,
      evidencePermissionGranted: event.target.checked,
    }));
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-6 px-4 py-8 text-slate-900">
      <header className="space-y-2">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">
          Scholarships & access
        </p>
        <h1 className="text-3xl font-bold tracking-tight md:text-4xl">
          Eligibility rules builder
        </h1>
        <p className="max-w-2xl text-sm text-slate-600 md:text-base">
          Compose requirements for enrollment, course fit, academic score, geography, income band,
          role, age, and custom attestation while minimizing sensitive evidence collection.
        </p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[1.3fr_0.7fr]">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Rule set</h2>
              <button
                type="button"
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2"
                aria-label="Validate scholarship rules"
              >
                Validate rules
              </button>
            </div>

            {status === 'loading' && (
              <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
                Loading eligibility rules…
              </div>
            )}

            {status === 'error' && (
              <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                A fallback rule set is being used because the scholarship service is temporarily unavailable.
              </div>
            )}

            {status === 'empty' && (
              <div role="status" aria-live="polite" className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
                No rules are configured yet. Add the first eligibility rule to publish a scholarship.
              </div>
            )}

            {(status === 'success' || status === 'error') && rules.length > 0 && (
              <ul className="space-y-3" aria-label="Eligibility rule list">
                {rules[0].rules.map((rule) => (
                  <li key={rule.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="font-medium text-slate-900">{rule.label}</p>
                        <p className="text-sm text-slate-600">{rule.description}</p>
                      </div>
                      <span className="rounded-full bg-indigo-100 px-2.5 py-1 text-xs font-medium text-indigo-700">
                        {rule.type}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-xl font-semibold">Applicant snapshot</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="space-y-2 text-sm font-medium text-slate-700">
                Enrollment status
                <select
                  value={applicant.enrollmentStatus ?? 'current'}
                  onChange={(event) => setApplicant((current) => ({ ...current, enrollmentStatus: event.target.value as any }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Choose enrollment status"
                >
                  <option value="current">Current</option>
                  <option value="prospective">Prospective</option>
                  <option value="alumni">Alumni</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Region
                <select
                  value={applicant.region ?? 'africa'}
                  onChange={(event) => setApplicant((current) => ({ ...current, region: event.target.value as any }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Choose the applicant region"
                >
                  <option value="africa">Africa</option>
                  <option value="asia">Asia</option>
                  <option value="europe">Europe</option>
                  <option value="north-america">North America</option>
                  <option value="south-america">South America</option>
                  <option value="oceania">Oceania</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Income band
                <select
                  value={applicant.incomeBand ?? 'low'}
                  onChange={(event) => setApplicant((current) => ({ ...current, incomeBand: event.target.value as any }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Choose income band"
                >
                  <option value="low">Low</option>
                  <option value="middle">Middle</option>
                  <option value="upper">Upper</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Role
                <select
                  value={applicant.role ?? 'student'}
                  onChange={(event) => setApplicant((current) => ({ ...current, role: event.target.value as any }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Choose role"
                >
                  <option value="student">Student</option>
                  <option value="mentor">Mentor</option>
                  <option value="staff">Staff</option>
                  <option value="alumni">Alumni</option>
                </select>
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Age
                <input
                  type="number"
                  min={0}
                  value={applicant.age ?? 20}
                  onChange={(event) => setApplicant((current) => ({ ...current, age: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Applicant age"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Grade score
                <input
                  type="number"
                  min={0}
                  max={100}
                  value={applicant.gradeValue ?? 0}
                  onChange={(event) => setApplicant((current) => ({ ...current, gradeValue: Number(event.target.value) }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Applicant grade score"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Completed achievements
                <input
                  type="text"
                  value={(applicant.completedAchievementIds ?? []).join(', ')}
                  onChange={(event) => setApplicant((current) => ({
                    ...current,
                    completedAchievementIds: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                  }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Completed achievement identifiers"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Prior award identifiers
                <input
                  type="text"
                  value={(applicant.priorAwardIds ?? []).join(', ')}
                  onChange={(event) => setApplicant((current) => ({
                    ...current,
                    priorAwardIds: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                  }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Prior award identifiers"
                />
              </label>

              <label className="space-y-2 text-sm font-medium text-slate-700">
                Selected scholarship identifiers
                <input
                  type="text"
                  value={(applicant.selectedScholarshipIds ?? []).join(', ')}
                  onChange={(event) => setApplicant((current) => ({
                    ...current,
                    selectedScholarshipIds: event.target.value.split(',').map((value) => value.trim()).filter(Boolean),
                  }))}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  aria-label="Selected scholarship identifiers"
                />
              </label>
            </div>

            <label className="mt-4 flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={applicant.evidencePermissionGranted ?? true}
                onChange={handlePermissionChange}
                aria-label="Grant permission to collect limited evidence"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Permission granted for limited evidence collection
            </label>
          </div>
        </div>

        <aside className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-slate-900 p-5 text-white shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-300">Publication gate</p>
            <div className="mt-3 flex items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Validation status</h2>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${
                  validation.valid ? 'bg-emerald-500/20 text-emerald-200' : 'bg-red-500/20 text-red-200'
                }`}
              >
                {validation.valid ? 'Ready' : 'Blocked'}
              </span>
            </div>

            <ul className="mt-4 space-y-2 text-sm text-slate-200" aria-live="polite">
              {validation.errors.length === 0 ? (
                <li>No validation errors detected.</li>
              ) : (
                validation.errors.map((error) => <li key={error}>• {error}</li>)
              )}
            </ul>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-lg font-semibold text-slate-900">Eligibility decision</h3>
            <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-sm text-slate-600">Decision</p>
              <p className={`mt-1 text-2xl font-bold ${decision.passed ? 'text-emerald-600' : 'text-amber-600'}`}>
                {decision.passed ? 'Eligible' : 'Not eligible'}
              </p>
            </div>

            <dl className="mt-4 space-y-3 text-sm text-slate-600">
              <div>
                <dt className="font-medium text-slate-900">Matched rules</dt>
                <dd>{decision.matchedRules.length > 0 ? decision.matchedRules.join(', ') : 'None yet'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Missing evidence</dt>
                <dd>{decision.missingEvidence.length > 0 ? decision.missingEvidence.join(', ') : 'No missing evidence'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Permission required</dt>
                <dd>{decision.permissionRequired.length > 0 ? decision.permissionRequired.join(', ') : 'No extra permission requested'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Exclusion reason codes</dt>
                <dd>{decision.exclusionReasons.length > 0 ? decision.exclusionReasons.join(', ') : 'No exclusion applied'}</dd>
              </div>
              <div>
                <dt className="font-medium text-slate-900">Decision key</dt>
                <dd className="break-all font-mono text-xs">{decision.decisionKey}</dd>
              </div>
            </dl>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default EligibilityRuleBuilder;
