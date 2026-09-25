'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  buildConsentSubmission,
  consentRequirements,
  needsReconsent,
  scholarshipConsentService,
} from '../consent';
import type { ConsentKind, ConsentRecord, ConsentRequirement } from '../consent';

const applicationId = 'demo-application';

function recordFor(records: ConsentRecord[], kind: ConsentKind) {
  return records.find((record) => record.kind === kind);
}

export function ApplicantConsent() {
  const [requirements, setRequirements] = useState<ConsentRequirement[]>(consentRequirements);
  const [records, setRecords] = useState<ConsentRecord[]>([]);
  const [acceptedKinds, setAcceptedKinds] = useState<Set<ConsentKind>>(new Set());
  const [status, setStatus] = useState<'loading' | 'empty' | 'success' | 'error'>('loading');
  const [submitStatus, setSubmitStatus] = useState<'idle' | 'saving' | 'success' | 'error'>('idle');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;
    scholarshipConsentService.get(applicationId)
      .then((response) => {
        if (!isMounted) return;
        setRequirements(response.requirements);
        setRecords(response.records);
        setStatus(response.requirements.length === 0 ? 'empty' : 'success');
      })
      .catch(() => {
        if (!isMounted) return;
        setStatus('error');
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const needsConsent = useMemo(
    () => requirements.filter((requirement) => needsReconsent(requirement, recordFor(records, requirement.kind))),
    [records, requirements]
  );
  const requiredNeedsConsent = needsConsent.filter((requirement) => requirement.required);
  const hasAllRequiredConsents = requiredNeedsConsent.every(
    (requirement) => !requirement.required || acceptedKinds.has(requirement.kind)
  );

  const handleConsentChange = (kind: ConsentKind, checked: boolean) => {
    setAcceptedKinds((current) => {
      const next = new Set(current);
      if (checked) next.add(kind);
      else next.delete(kind);
      return next;
    });
    setSubmitStatus('idle');
    setError(null);
  };

  const handleSubmit = async () => {
    if (!hasAllRequiredConsents) {
      setError('Accept every current required consent before continuing.');
      setSubmitStatus('error');
      return;
    }

    setSubmitStatus('saving');
    setError(null);
    try {
      const nextState = await scholarshipConsentService.submit(
        applicationId,
        buildConsentSubmission(requirements, acceptedKinds)
      );
      setRecords(nextState.records);
      setAcceptedKinds(new Set());
      setSubmitStatus('success');
    } catch {
      setError('Consent could not be saved. Please try again.');
      setSubmitStatus('error');
    }
  };

  const handleRevoke = async (kind: ConsentKind) => {
    setSubmitStatus('saving');
    setError(null);
    try {
      const nextState = await scholarshipConsentService.revoke(applicationId, kind);
      setRecords(nextState.records);
      setSubmitStatus('success');
    } catch {
      setError('This consent could not be withdrawn. Please try again.');
      setSubmitStatus('error');
    }
  };

  return (
    <section className="mx-auto w-full max-w-6xl space-y-5 px-4 pb-10 text-slate-900" aria-labelledby="applicant-consent-title">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="space-y-2">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-indigo-600">Applicant agreement</p>
          <h2 id="applicant-consent-title" className="text-2xl font-bold tracking-tight">Review and give consent</h2>
          <p className="max-w-2xl text-sm text-slate-600">
            Consent is recorded with the policy version and time you accept it. A changed notice requires fresh consent.
            Optional permissions can be withdrawn where marked revocable.
          </p>
        </div>

        {status === 'loading' && <p role="status" className="mt-5 text-sm text-slate-600">Loading current consent requirements…</p>}
        {status === 'error' && <p role="alert" className="mt-5 text-sm text-red-700">Consent requirements could not be loaded.</p>}
        {status === 'empty' && <p role="status" className="mt-5 rounded-xl border border-dashed border-slate-300 p-5 text-sm text-slate-600">No consent requirements are configured for this application.</p>}

        {status === 'success' && (
          <>
            <div className="mt-5 grid gap-3" role="group" aria-label="Required applicant consents">
              {requirements.map((requirement) => {
                const record = recordFor(records, requirement.kind);
                const reconsentRequired = needsReconsent(requirement, record);
                const checked = reconsentRequired ? acceptedKinds.has(requirement.kind) : true;
                return (
                  <label key={requirement.kind} className="flex items-start gap-3 rounded-xl border border-slate-200 p-4 transition has-[:checked]:border-emerald-500 has-[:checked]:bg-emerald-50">
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!reconsentRequired}
                      onChange={(event) => handleConsentChange(requirement.kind, event.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 disabled:cursor-not-allowed disabled:opacity-60"
                      aria-describedby={`${requirement.kind}-description`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2 font-medium text-slate-900">
                        {requirement.title}
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600">v{requirement.version}</span>
                        {!requirement.revocable && <span className="text-xs font-normal text-slate-500">Cannot be withdrawn</span>}
                        {!reconsentRequired && <span className="text-xs font-normal text-emerald-700">Accepted</span>}
                        {reconsentRequired && record && <span className="text-xs font-normal text-amber-700">Updated consent required</span>}
                      </span>
                      <span id={`${requirement.kind}-description`} className="mt-1 block text-sm text-slate-600">{requirement.description}</span>
                      <a href={requirement.documentUrl} className="mt-2 inline-block text-sm font-medium text-indigo-700 underline focus:outline-none focus:ring-2 focus:ring-indigo-500">Read the {requirement.title.toLowerCase()}</a>
                      {!reconsentRequired && requirement.revocable && (
                        <button
                          type="button"
                          onClick={() => void handleRevoke(requirement.kind)}
                          disabled={submitStatus === 'saving'}
                          className="ml-4 text-sm font-medium text-slate-700 underline focus:outline-none focus:ring-2 focus:ring-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          Withdraw consent
                        </button>
                      )}
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-sm text-slate-600" aria-live="polite">
                {requiredNeedsConsent.length === 0 ? 'All current required consent versions are recorded.' : `${requiredNeedsConsent.length} consent${requiredNeedsConsent.length === 1 ? '' : 's'} require${requiredNeedsConsent.length === 1 ? 's' : ''} your review.`}
              </p>
              <button
                type="button"
                onClick={handleSubmit}
                disabled={!hasAllRequiredConsents || requiredNeedsConsent.length === 0 || submitStatus === 'saving'}
                className="rounded-full bg-indigo-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:bg-slate-400"
              >
                {submitStatus === 'saving' ? 'Saving consent…' : requiredNeedsConsent.length === 0 ? 'Consent up to date' : 'Save consent'}
              </button>
            </div>
          </>
        )}

        <div className="mt-4" aria-live="polite">
          {submitStatus === 'success' && <p role="status" className="text-sm text-emerald-700">Your consent choices were recorded with their policy versions and timestamps.</p>}
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        </div>
      </div>
    </section>
  );
}
