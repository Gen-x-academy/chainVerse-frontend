'use client';

import { type FormEvent, useId, useRef, useState } from 'react';
import { milestoneEvidenceService } from '../service';
import type { EvidenceType, MilestoneEvidence, SubmitEvidencePayload } from '../types';

type SubmitStatus = 'idle' | 'loading' | 'success' | 'error';

type Props = {
  milestoneId: string;
  awardId: string;
  recipientId: string;
  onSuccess?: (evidence: MilestoneEvidence, isNew: boolean) => void;
};

function generateSubmissionKey(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function SubmitEvidenceForm({ milestoneId, awardId, recipientId, onSuccess }: Props) {
  const formId = useId();
  const [evidenceType, setEvidenceType] = useState<EvidenceType>('document');
  const [content, setContent] = useState('');
  const [encryptOffChain, setEncryptOffChain] = useState(false);
  const [status, setStatus] = useState<SubmitStatus>('idle');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastEvidence, setLastEvidence] = useState<MilestoneEvidence | null>(null);
  const [isDuplicate, setIsDuplicate] = useState(false);
  const submissionKeyRef = useRef<string>(generateSubmissionKey());
  const statusRegionId = `${formId}-status`;

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!content.trim()) return;

    setStatus('loading');
    setErrorMessage('');

    const payload: SubmitEvidencePayload = {
      milestoneId,
      awardId,
      evidenceType,
      content: content.trim(),
      encryptOffChain,
      submissionKey: submissionKeyRef.current,
    };

    try {
      const result = await milestoneEvidenceService.submit(payload);
      setLastEvidence(result.evidence);
      setIsDuplicate(!result.isNew);
      setStatus('success');
      if (!result.isNew) {
        submissionKeyRef.current = generateSubmissionKey();
      }
      onSuccess?.(result.evidence, result.isNew);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Submission failed. Please try again.');
      setStatus('error');
    }
  };

  const handleReset = () => {
    setContent('');
    setStatus('idle');
    setErrorMessage('');
    setLastEvidence(null);
    setIsDuplicate(false);
    submissionKeyRef.current = generateSubmissionKey();
  };

  const canSubmit = !recipientId
    ? false
    : status !== 'loading';

  if (!recipientId) {
    return (
      <section
        aria-label="Submit milestone evidence"
        className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900"
        role="alert"
      >
        You must be logged in as an award recipient to submit evidence.
      </section>
    );
  }

  return (
    <section
      aria-label="Submit milestone evidence"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Milestone evidence
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Submit evidence</h2>
        <p className="text-sm text-slate-500">
          Upload or link evidence for this milestone. Duplicate submissions with the same key are
          safely de-duplicated.
        </p>
      </header>

      <div
        id={statusRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status === 'loading' && 'Submitting evidence…'}
        {status === 'success' && (isDuplicate ? 'Duplicate detected — existing record returned.' : 'Evidence submitted successfully.')}
        {status === 'error' && `Error: ${errorMessage}`}
      </div>

      {status === 'success' && lastEvidence ? (
        <div
          role="status"
          className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
        >
          <p className="font-semibold text-emerald-800">
            {isDuplicate
              ? 'Duplicate submission detected — existing evidence record returned.'
              : 'Evidence submitted successfully.'}
          </p>
          <dl className="space-y-2 text-sm text-emerald-700">
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Evidence ID</dt>
              <dd className="break-all font-mono text-xs">{lastEvidence.id}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Version</dt>
              <dd>{lastEvidence.version}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Content hash</dt>
              <dd className="break-all font-mono text-xs">{lastEvidence.contentHash}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Encrypted off-chain</dt>
              <dd>{lastEvidence.encryptedOffChain ? 'Yes' : 'No'}</dd>
            </div>
          </dl>
          <button
            type="button"
            onClick={handleReset}
            className="mt-2 rounded-full bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
          >
            Submit another
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} aria-describedby={statusRegionId} noValidate>
          <fieldset className="space-y-5" disabled={status === 'loading'}>
            <legend className="sr-only">Evidence details</legend>

            <div className="space-y-2">
              <label
                htmlFor={`${formId}-type`}
                className="block text-sm font-medium text-slate-700"
              >
                Evidence type
              </label>
              <select
                id={`${formId}-type`}
                value={evidenceType}
                onChange={(e) => setEvidenceType(e.target.value as EvidenceType)}
                className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="document">Document</option>
                <option value="url">URL</option>
                <option value="attestation">Attestation</option>
                <option value="image">Image</option>
              </select>
            </div>

            <div className="space-y-2">
              <label
                htmlFor={`${formId}-content`}
                className="block text-sm font-medium text-slate-700"
              >
                {evidenceType === 'url' ? 'Evidence URL' : evidenceType === 'attestation' ? 'Attestation statement' : 'Evidence content'}
                <span className="ml-1 text-red-500" aria-hidden="true">*</span>
              </label>
              {evidenceType === 'attestation' ? (
                <textarea
                  id={`${formId}-content`}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={4}
                  required
                  aria-required="true"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter your attestation statement…"
                />
              ) : (
                <input
                  id={`${formId}-content`}
                  type={evidenceType === 'url' ? 'url' : 'text'}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  required
                  aria-required="true"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder={evidenceType === 'url' ? 'https://…' : 'Enter evidence reference…'}
                />
              )}
            </div>

            <label className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={encryptOffChain}
                onChange={(e) => setEncryptOffChain(e.target.checked)}
                aria-label="Encrypt sensitive evidence and store off-chain"
                className="h-4 w-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
              />
              Encrypt evidence off-chain (recommended for sensitive data)
            </label>

            {status === 'error' && (
              <div
                role="alert"
                className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800"
              >
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={!canSubmit || !content.trim()}
              className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              aria-busy={status === 'loading'}
            >
              {status === 'loading' ? 'Submitting…' : 'Submit evidence'}
            </button>
          </fieldset>
        </form>
      )}
    </section>
  );
}

export default SubmitEvidenceForm;
