'use client';

import { useEffect, useState } from 'react';
import { recoveryService } from '../service';
import type { DiagnosticReport } from '../types';

type Props = {
  failureId: string;
};

export function DiagnosticsReport({ failureId }: Props) {
  const [report, setReport] = useState<DiagnosticReport | null>(null);
  const [status, setStatus] = useState<'loading' | 'loaded' | 'error'>('loading');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    let cancelled = false;

    recoveryService
      .getDiagnostics(failureId)
      .then((data) => {
        if (!cancelled) {
          setReport(data);
          setStatus('loaded');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : 'Failed to load diagnostics.');
          setStatus('error');
        }
      });

    return () => {
      cancelled = true;
    };
  }, [failureId]);

  if (status === 'loading') {
    return (
      <div role="status" aria-label="Loading diagnostics" className="space-y-2">
        <div className="h-4 w-48 animate-pulse rounded bg-slate-100" aria-hidden="true" />
        <div className="h-4 w-full animate-pulse rounded bg-slate-100" aria-hidden="true" />
      </div>
    );
  }

  if (status === 'error') {
    return (
      <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-800">
        {errorMessage}
      </div>
    );
  }

  if (!report) return null;

  return (
    <section
      aria-label="Operator diagnostics"
      className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4 text-sm"
    >
      <header>
        <h4 className="font-semibold text-slate-900">Operator diagnostics</h4>
        <p className="text-xs text-slate-400">Generated {new Date(report.generatedAt).toLocaleString()}</p>
      </header>

      <dl className="space-y-3">
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Failure reason</dt>
          <dd className="mt-0.5 font-medium text-slate-800 capitalize">
            {report.failureReason.replace(/_/g, ' ')}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Suggested action</dt>
          <dd className="mt-0.5 text-slate-700">{report.suggestedAction}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Operator notes</dt>
          <dd className="mt-0.5 text-slate-700">{report.operatorNotes}</dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Award eligibility</dt>
          <dd className={`mt-0.5 font-medium ${report.awardEligibilityPreserved ? 'text-emerald-700' : 'text-red-700'}`}>
            {report.awardEligibilityPreserved ? 'Preserved' : 'At risk — review required'}
          </dd>
        </div>
        <div>
          <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Retry available</dt>
          <dd className={`mt-0.5 font-medium ${report.canRetry ? 'text-emerald-700' : 'text-slate-500'}`}>
            {report.canRetry
              ? report.retryRequiresNewEnvelope
                ? 'Yes (new transaction envelope required)'
                : 'Yes'
              : 'No — manual intervention needed'}
          </dd>
        </div>
        {report.affectedAccounts.length > 0 && (
          <div>
            <dt className="text-xs font-medium text-slate-500 uppercase tracking-wide">Affected accounts</dt>
            <dd className="mt-1 space-y-1">
              {report.affectedAccounts.map((acc) => (
                <p key={acc} className="break-all font-mono text-xs text-slate-600">{acc}</p>
              ))}
            </dd>
          </div>
        )}
      </dl>
    </section>
  );
}

export default DiagnosticsReport;
