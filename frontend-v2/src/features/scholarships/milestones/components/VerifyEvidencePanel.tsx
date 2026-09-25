'use client';

import { useEffect, useId, useState } from 'react';
import { milestoneEvidenceService, milestoneVerifierService } from '../service';
import type {
  MilestoneEvidence,
  RecordDecisionPayload,
  VerificationAction,
  VerifierDecision,
  VerifierDecisionReasonCode,
} from '../types';

type PanelStatus = 'loading' | 'empty' | 'ready' | 'submitting' | 'decided' | 'error' | 'conflict';

type Props = {
  evidenceId: string;
  verifierId: string;
  onDecision?: (decision: VerifierDecision) => void;
};

const REASON_LABELS: Record<VerifierDecisionReasonCode, string> = {
  EVIDENCE_COMPLETE: 'Evidence is complete',
  EVIDENCE_INSUFFICIENT: 'Evidence is insufficient',
  EVIDENCE_FRAUDULENT: 'Evidence appears fraudulent',
  MILESTONE_NOT_MET: 'Milestone criteria not met',
  CHANGES_REQUIRED: 'Changes are required',
  CONFLICT_OF_INTEREST: 'Conflict of interest',
};

const ACTION_REASON_MAP: Record<VerificationAction, VerifierDecisionReasonCode[]> = {
  approve: ['EVIDENCE_COMPLETE'],
  reject: ['EVIDENCE_INSUFFICIENT', 'EVIDENCE_FRAUDULENT', 'MILESTONE_NOT_MET'],
  request_changes: ['CHANGES_REQUIRED'],
};

export function VerifyEvidencePanel({ evidenceId, verifierId, onDecision }: Props) {
  const formId = useId();
  const [evidence, setEvidence] = useState<MilestoneEvidence | null>(null);
  const [existingDecisions, setExistingDecisions] = useState<VerifierDecision[]>([]);
  const [action, setAction] = useState<VerificationAction>('approve');
  const [reasonCode, setReasonCode] = useState<VerifierDecisionReasonCode>('EVIDENCE_COMPLETE');
  const [reasonNote, setReasonNote] = useState('');
  const [status, setStatus] = useState<PanelStatus>('loading');
  const [errorMessage, setErrorMessage] = useState('');
  const [lastDecision, setLastDecision] = useState<VerifierDecision | null>(null);
  const statusRegionId = `${formId}-status`;

  useEffect(() => {
    let isMounted = true;

    const load = async () => {
      try {
        const [evidenceData, decisions] = await Promise.all([
          milestoneEvidenceService.getById(evidenceId),
          milestoneVerifierService.getDecisions(evidenceId),
        ]);

        if (!isMounted) return;

        const conflict = evidenceData.recipientId === verifierId;
        if (conflict) {
          setStatus('conflict');
          return;
        }

        if (!evidenceData) {
          setStatus('empty');
          return;
        }

        setEvidence(evidenceData);
        setExistingDecisions(decisions);
        setStatus('ready');
      } catch {
        if (!isMounted) return;
        setErrorMessage('Failed to load evidence. Please refresh and try again.');
        setStatus('error');
      }
    };

    void load();
    return () => {
      isMounted = false;
    };
  }, [evidenceId, verifierId]);

  const handleActionChange = (nextAction: VerificationAction) => {
    setAction(nextAction);
    setReasonCode(ACTION_REASON_MAP[nextAction][0]);
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setStatus('submitting');
    setErrorMessage('');

    const payload: RecordDecisionPayload = {
      evidenceId,
      action,
      reasonCode,
      reasonNote: reasonNote.trim() || undefined,
    };

    try {
      const decision = await milestoneVerifierService.recordDecision(payload);
      setLastDecision(decision);
      setStatus('decided');
      onDecision?.(decision);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Decision submission failed. Please try again.');
      setStatus('ready');
    }
  };

  return (
    <section
      aria-label="Verify milestone evidence"
      className="mx-auto w-full max-w-2xl space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm"
    >
      <header className="space-y-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-indigo-600">
          Evidence review
        </p>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Verify evidence</h2>
        <p className="text-sm text-slate-500">
          Approve, reject, or request changes. Every decision is audited and cannot be reversed.
        </p>
      </header>

      <div
        id={statusRegionId}
        aria-live="polite"
        aria-atomic="true"
        className="sr-only"
      >
        {status === 'loading' && 'Loading evidence…'}
        {status === 'submitting' && 'Recording decision…'}
        {status === 'decided' && 'Decision recorded.'}
        {status === 'conflict' && 'You cannot verify evidence you submitted.'}
        {status === 'error' && `Error: ${errorMessage}`}
      </div>

      {status === 'loading' && (
        <div role="status" aria-live="polite" className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
          Loading evidence details…
        </div>
      )}

      {status === 'empty' && (
        <div role="status" aria-live="polite" className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center text-sm text-slate-600">
          No evidence found for this ID.
        </div>
      )}

      {status === 'conflict' && (
        <div role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          <p className="font-semibold">Conflict of interest detected</p>
          <p className="mt-1">
            You submitted this evidence and cannot act as the verifier. Another authorized verifier
            must review this submission to ensure an impartial decision.
          </p>
        </div>
      )}

      {status === 'error' && (
        <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
          {errorMessage}
        </div>
      )}

      {status === 'decided' && lastDecision && (
        <div role="status" className="space-y-4 rounded-xl border border-emerald-200 bg-emerald-50 p-5">
          <p className="font-semibold text-emerald-800">Decision recorded successfully.</p>
          <dl className="space-y-2 text-sm text-emerald-700">
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Action</dt>
              <dd className="capitalize">{lastDecision.action.replace('_', ' ')}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Reason</dt>
              <dd>{REASON_LABELS[lastDecision.reasonCode]}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Payment eligibility triggered</dt>
              <dd>{lastDecision.paymentEligibilityTriggered ? 'Yes' : 'No'}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="font-medium text-emerald-900">Decided at</dt>
              <dd>{new Date(lastDecision.decidedAt).toLocaleString()}</dd>
            </div>
          </dl>
        </div>
      )}

      {(status === 'ready' || status === 'submitting') && evidence && (
        <>
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <h3 className="mb-3 text-sm font-semibold text-slate-900">Evidence summary</h3>
            <dl className="space-y-2 text-sm text-slate-600">
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-slate-900">Type</dt>
                <dd className="capitalize">{evidence.evidenceType}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-slate-900">Version</dt>
                <dd>{evidence.version}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-slate-900">Content hash</dt>
                <dd className="break-all font-mono text-xs">{evidence.contentHash}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-slate-900">Encrypted off-chain</dt>
                <dd>{evidence.encryptedOffChain ? 'Yes' : 'No'}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="font-medium text-slate-900">Submitted</dt>
                <dd>{new Date(evidence.submittedAt).toLocaleString()}</dd>
              </div>
            </dl>
          </div>

          {existingDecisions.length > 0 && (
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
              <h3 className="mb-3 text-sm font-semibold text-slate-900">
                Prior decisions ({existingDecisions.length})
              </h3>
              <ul className="space-y-2" aria-label="Prior verifier decisions">
                {existingDecisions.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                  >
                    <span className="capitalize font-medium">{d.action.replace('_', ' ')}</span>
                    {' — '}
                    {REASON_LABELS[d.reasonCode]}
                    {' · '}
                    <time dateTime={d.decidedAt}>{new Date(d.decidedAt).toLocaleDateString()}</time>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <form onSubmit={handleSubmit} aria-describedby={statusRegionId} noValidate>
            <fieldset className="space-y-5" disabled={status === 'submitting'}>
              <legend className="text-sm font-semibold text-slate-900">Record a decision</legend>

              <div
                role="group"
                aria-label="Verification action"
                className="flex flex-wrap gap-3"
              >
                {(['approve', 'reject', 'request_changes'] as VerificationAction[]).map((a) => (
                  <label
                    key={a}
                    className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-medium transition focus-within:ring-2 focus-within:ring-indigo-500 focus-within:ring-offset-2 ${
                      action === a
                        ? a === 'approve'
                          ? 'border-emerald-500 bg-emerald-50 text-emerald-700'
                          : a === 'reject'
                          ? 'border-red-400 bg-red-50 text-red-700'
                          : 'border-amber-400 bg-amber-50 text-amber-700'
                        : 'border-slate-200 bg-white text-slate-600'
                    }`}
                  >
                    <input
                      type="radio"
                      name="action"
                      value={a}
                      checked={action === a}
                      onChange={() => handleActionChange(a)}
                      className="sr-only"
                    />
                    {a === 'approve' ? 'Approve' : a === 'reject' ? 'Reject' : 'Request changes'}
                  </label>
                ))}
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-reason`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Reason code
                  <span className="ml-1 text-red-500" aria-hidden="true">*</span>
                </label>
                <select
                  id={`${formId}-reason`}
                  value={reasonCode}
                  onChange={(e) => setReasonCode(e.target.value as VerifierDecisionReasonCode)}
                  required
                  aria-required="true"
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {ACTION_REASON_MAP[action].map((code) => (
                    <option key={code} value={code}>
                      {REASON_LABELS[code]}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-2">
                <label
                  htmlFor={`${formId}-note`}
                  className="block text-sm font-medium text-slate-700"
                >
                  Additional notes{' '}
                  <span className="font-normal text-slate-400">(optional)</span>
                </label>
                <textarea
                  id={`${formId}-note`}
                  value={reasonNote}
                  onChange={(e) => setReasonNote(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Provide any additional context for this decision…"
                />
              </div>

              {status === 'ready' && errorMessage && (
                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
                  {errorMessage}
                </div>
              )}

              <button
                type="submit"
                disabled={status === 'submitting'}
                className="w-full rounded-full bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                aria-busy={status === 'submitting'}
              >
                {status === 'submitting' ? 'Recording decision…' : 'Record decision'}
              </button>
            </fieldset>
          </form>
        </>
      )}
    </section>
  );
}

export default VerifyEvidencePanel;
