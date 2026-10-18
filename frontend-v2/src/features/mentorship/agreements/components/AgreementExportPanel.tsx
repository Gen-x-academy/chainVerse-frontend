'use client';

import { useId, useState } from 'react';
import type { AgreementExportFormat, AgreementExportJob } from '../agreement-export';
import {
  agreementExportService,
  trackAgreementExportRequested,
} from '../agreement-export.service';

export interface AgreementExportPanelProps {
  agreementId: string;
  canExport: boolean;
  actorKey?: string;
  defaultFormat?: AgreementExportFormat;
}

type PanelStatus = 'empty' | 'loading' | 'success' | 'error';

export function AgreementExportPanel({
  agreementId,
  canExport,
  actorKey = 'participant',
  defaultFormat = 'json',
}: AgreementExportPanelProps) {
  const formatId = useId();
  const statusId = useId();
  const [format, setFormat] = useState<AgreementExportFormat>(defaultFormat);
  const [status, setStatus] = useState<PanelStatus>('empty');
  const [job, setJob] = useState<AgreementExportJob | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [downloaded, setDownloaded] = useState(false);
  const [idempotencyKey, setIdempotencyKey] = useState(`${agreementId}-${Date.now()}`);

  if (!canExport) {
    return (
      <section aria-labelledby={`${formatId}-title`} className="rounded-2xl border border-slate-200 bg-white p-6">
        <h2 id={`${formatId}-title`} className="text-lg font-semibold text-slate-900">
          Export agreement records
        </h2>
        <p role="alert" className="mt-2 text-sm text-red-700">
          Only participants in this agreement can export its records.
        </p>
      </section>
    );
  }

  const request = async () => {
    setStatus('loading');
    setError(null);
    setDownloaded(false);
    try {
      const nextJob = await agreementExportService.request(agreementId, {
        format,
        idempotencyKey,
      });
      setJob(nextJob);
      setStatus('success');
      trackAgreementExportRequested(nextJob, actorKey);
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : 'The export could not be generated.');
    }
  };

  const download = async () => {
    if (!job) return;
    try {
      await agreementExportService.download(job.downloadToken);
      setDownloaded(true);
    } catch (caught) {
      setStatus('error');
      setError(caught instanceof Error ? caught.message : 'The export could not be downloaded.');
    }
  };

  return (
    <section aria-labelledby={`${formatId}-title`} className="rounded-2xl border border-slate-200 bg-white p-6">
      <h2 id={`${formatId}-title`} className="text-lg font-semibold text-slate-900">
        Export agreement records
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Includes accepted terms, amendments, approvals, session summary and financial summary.
        Private internal notes are excluded.
      </p>

      <div className="mt-4 space-y-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
          <div className="min-w-0 flex-1">
            <label htmlFor={formatId} className="block text-sm font-medium text-slate-700">
              Export format
            </label>
            <select
              id={formatId}
              value={format}
              onChange={(event) => {
                setFormat(event.target.value as AgreementExportFormat);
                setIdempotencyKey(`${agreementId}-${Date.now()}`);
              }}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
            >
              <option value="json">JSON</option>
              <option value="csv">CSV</option>
            </select>
          </div>
          <button
            type="button"
            onClick={() => void request()}
            disabled={status === 'loading'}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {status === 'loading' ? 'Generating…' : 'Generate export'}
          </button>
        </div>

        <div id={statusId} aria-live="polite">
          {status === 'empty' && (
            <p role="status" className="text-sm text-slate-600">
              No export has been generated yet.
            </p>
          )}
          {status === 'loading' && (
            <p role="status" className="text-sm text-slate-600">
              Generating your agreement export…
            </p>
          )}
          {status === 'success' && job && (
            <div role="status" className="space-y-2 text-sm text-slate-700">
              <p>
                Export ready. This link expires at{' '}
                <time dateTime={job.expiresAt}>{new Date(job.expiresAt).toLocaleString()}</time>.
              </p>
              <button
                type="button"
                onClick={() => void download()}
                className="rounded-lg border border-indigo-600 px-4 py-2 font-semibold text-indigo-700"
              >
                Download export
              </button>
              {downloaded && <p>Export downloaded.</p>}
            </div>
          )}
          {status === 'error' && error && (
            <p role="alert" className="text-sm text-red-700">
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  );
}

export default AgreementExportPanel;
