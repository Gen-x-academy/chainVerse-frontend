'use client';

import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import {
  canReviewVerification,
  discloseVerification,
  mentorshipVerificationService,
  startReverification,
  validateVerificationSubmission,
} from '../service';
import {
  APPROVED_VERIFICATION_PROVIDERS,
  type MentorVerification,
  type VerificationProvider,
  type VerificationReviewerRole,
} from '../types';

type Props = {
  mentorId: string;
  /** When set (with `reviewerRole`), a moderator/administrator may review. */
  reviewerId?: string;
  reviewerRole?: VerificationReviewerRole;
};

const PROVIDER_LABELS: Record<VerificationProvider, string> = {
  'government-id': 'Government-issued ID',
  'professional-body': 'Professional body',
  'institution-registry': 'Institution registry',
  'manual-review': 'Manual review',
};

const STATUS_STYLES: Record<string, string> = {
  unverified: 'bg-slate-100 text-slate-700',
  pending: 'bg-amber-100 text-amber-800',
  verified: 'bg-emerald-100 text-emerald-800',
  rejected: 'bg-red-100 text-red-700',
  expired: 'bg-orange-100 text-orange-800',
};

const INPUT_CLASS =
  'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 focus:outline-none focus:ring-2 focus:ring-indigo-200';

export function MentorVerificationPanel({ mentorId, reviewerId, reviewerRole }: Props) {
  const baseId = useId();
  const [verification, setVerification] = useState<MentorVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [provider, setProvider] = useState<VerificationProvider>('government-id');
  const [consent, setConsent] = useState(false);
  const [evidenceRef, setEvidenceRef] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setVerification(await mentorshipVerificationService.get(mentorId));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load the verification.');
      setVerification(null);
    } finally {
      setLoading(false);
    }
  }, [mentorId]);

  useEffect(() => {
    void load();
  }, [load]);

  const disclosure = useMemo(
    () => (verification ? discloseVerification(verification) : null),
    [verification],
  );

  // A draft never leaves this component; only an evidence reference is sent.
  const draft = useMemo<MentorVerification | null>(() => {
    if (!verification) return null;
    return {
      ...verification,
      provider,
      evidenceRef: evidenceRef.trim() || undefined,
      consentGivenAt: consent ? new Date().toISOString() : undefined,
    };
  }, [verification, provider, evidenceRef, consent]);

  const submitErrors = useMemo(
    () => (draft ? validateVerificationSubmission(draft) : []),
    [draft],
  );

  const canReview = useMemo(() => {
    if (!verification || !reviewerId || !reviewerRole) return false;
    return canReviewVerification({ userId: reviewerId, role: reviewerRole }, verification) === undefined;
  }, [verification, reviewerId, reviewerRole]);

  const submit = async () => {
    if (submitErrors.length > 0) {
      setError('Fix the highlighted fields before submitting.');
      return;
    }
    setSubmitting(true);
    setStatus(null);
    try {
      const saved = await mentorshipVerificationService.submit(mentorId, {
        provider,
        consentGivenAt: new Date().toISOString(),
        evidenceRef: evidenceRef.trim(),
      });
      setVerification(saved);
      setConsent(false);
      setEvidenceRef('');
      setStatus('Verification submitted for review.');
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : 'Unable to submit the verification.');
    } finally {
      setSubmitting(false);
    }
  };

  const beginReverification = () => {
    if (!verification) return;
    setVerification(startReverification(verification));
    setStatus('Start a fresh verification attempt.');
  };

  const review = async (decision: 'approve' | 'reject') => {
    setSubmitting(true);
    setStatus(null);
    try {
      const saved = await mentorshipVerificationService.review(mentorId, {
        decision,
        ...(decision === 'reject' ? { rejectionReason: rejectionReason.trim() || undefined } : {}),
      });
      setVerification(saved);
      setRejectionReason('');
      setStatus(decision === 'approve' ? 'Verification approved.' : 'Verification rejected.');
    } catch (reviewError) {
      setError(reviewError instanceof Error ? reviewError.message : 'Unable to record the review.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600" role="status" aria-live="polite">
        Loading identity verification...
      </div>
    );
  }

  if (error && !verification) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-sm text-red-700" role="alert">
        <p className="font-semibold">The verification could not be loaded.</p>
        <p className="mt-1">{error}</p>
        <button
          type="button"
          onClick={() => void load()}
          className="mt-3 rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white hover:bg-red-800 focus:outline-none focus:ring-2 focus:ring-red-200"
        >
          Retry loading verification
        </button>
      </div>
    );
  }

  if (!verification || !disclosure) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 p-6 text-sm text-slate-600" role="status">
        No verification record exists yet.
      </div>
    );
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm" aria-labelledby={`${baseId}-heading`}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h2 id={`${baseId}-heading`} className="text-xl font-semibold text-slate-900">
          Mentor identity verification
        </h2>
        <span
          className={`w-fit rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide ${STATUS_STYLES[disclosure.status] ?? 'bg-slate-100 text-slate-700'}`}
        >
          {disclosure.status}
        </span>
      </div>

      <p className="mt-3 text-sm text-slate-600">
        {disclosure.eligible
          ? 'This mentor is verified and eligible to be matched.'
          : disclosure.reverificationRequired
            ? 'Verification is not current. Start a fresh attempt to regain eligibility.'
            : 'Verification is not yet complete.'}
      </p>

      {disclosure.expiresAt && (
        <p className="mt-1 text-xs text-slate-500">
          Approved verification expires {new Date(disclosure.expiresAt).toLocaleDateString()}.
        </p>
      )}

      {verification.rejectionReason && !disclosure.eligible && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {verification.rejectionReason}
        </div>
      )}

      {status && (
        <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800" role="status" aria-live="polite">
          {status}
        </div>
      )}

      {error && verification && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700" role="alert">
          {error}
        </div>
      )}

      {!disclosure.eligible && (
        <div className="mt-6 grid gap-4">
          <h3 className="text-sm font-semibold text-slate-900">Submit verification</h3>

          <div>
            <label htmlFor={`${baseId}-provider`} className="block text-sm font-medium text-slate-700">
              Verification provider
            </label>
            <select
              id={`${baseId}-provider`}
              value={provider}
              className={INPUT_CLASS}
              onChange={(event) => setProvider(event.target.value as VerificationProvider)}
            >
              {APPROVED_VERIFICATION_PROVIDERS.map((value) => (
                <option key={value} value={value}>
                  {PROVIDER_LABELS[value]}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor={`${baseId}-evidence`} className="block text-sm font-medium text-slate-700">
              Evidence reference
            </label>
            <input
              id={`${baseId}-evidence`}
              type="text"
              value={evidenceRef}
              placeholder="e.g. provider-case-12345"
              aria-invalid={submitErrors.some((item) => item.code === 'RAW_DOCUMENT_PROHIBITED') || undefined}
              className={INPUT_CLASS}
              onChange={(event) => setEvidenceRef(event.target.value)}
            />
            <p className="mt-1 text-xs text-slate-500">
              Provide an opaque reference only. Never paste a document, scan, or link to a file.
            </p>
          </div>

          <label htmlFor={`${baseId}-consent`} className="flex items-start gap-2 text-sm text-slate-700">
            <input
              id={`${baseId}-consent`}
              type="checkbox"
              checked={consent}
              className="mt-0.5"
              onChange={(event) => setConsent(event.target.checked)}
            />
            <span>I consent to identity verification and understand my document is never stored here.</span>
          </label>

          {submitErrors.length > 0 && (
            <ul className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800" role="alert">
              {submitErrors.map((item) => (
                <li key={item.code}>{item.message}</li>
              ))}
            </ul>
          )}

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={submitting || submitErrors.length > 0}
              aria-busy={submitting}
              onClick={() => void submit()}
              className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-indigo-200 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Submitting...' : 'Submit for verification'}
            </button>
            {disclosure.reverificationRequired && (
              <button
                type="button"
                onClick={beginReverification}
                className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-indigo-200"
              >
                Start re-verification
              </button>
            )}
          </div>
        </div>
      )}

      {canReview && (
        <div className="mt-6 border-t border-slate-200 pt-6">
          <h3 className="text-sm font-semibold text-slate-900">Reviewer decision</h3>
          {verification.status !== 'pending' ? (
            <p className="mt-1 text-xs text-slate-500">Only a pending submission can be reviewed.</p>
          ) : (
            <div className="mt-3 grid gap-3">
              <div>
                <label htmlFor={`${baseId}-rejection`} className="block text-sm font-medium text-slate-700">
                  Rejection reason (required to reject)
                </label>
                <input
                  id={`${baseId}-rejection`}
                  type="text"
                  value={rejectionReason}
                  className={INPUT_CLASS}
                  onChange={(event) => setRejectionReason(event.target.value)}
                />
              </div>
              <div className="flex flex-wrap gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => void review('approve')}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={submitting || rejectionReason.trim().length === 0}
                  onClick={() => void review('reject')}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-200 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-slate-50 p-3 text-xs text-slate-600">
        Only authorized moderators and administrators can review, and never their own verification. No
        raw identity document is stored — just an opaque reference and the provider&apos;s decision.
      </div>
    </section>
  );
}
