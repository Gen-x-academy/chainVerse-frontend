'use client';

import type { ExportJob } from '@/src/features/library/types/export.types';

interface ExportJobStatusProps {
  jobs: ExportJob[];
  isLoading?: boolean;
  error?: string | null;
}

function formatExpiry(expiresAt?: string): string {
  if (!expiresAt) return '—';
  const expiry = new Date(expiresAt);
  const now = new Date();
  if (expiry <= now) return 'Expired';
  const hours = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60));
  return `Expires in ${hours}h`;
}

const STATUS_LABEL: Record<ExportJob['status'], string> = {
  pending: 'Queued',
  processing: 'Processing',
  completed: 'Ready',
  failed: 'Failed',
  expired: 'Expired',
};

/** #929: Background export job list with download expiry */
export function ExportJobStatus({ jobs, isLoading, error }: ExportJobStatusProps) {
  if (isLoading) {
    return (
      <div aria-label="Loading export jobs" className="py-6 text-center text-sm text-muted-foreground">
        Loading export jobs…
      </div>
    );
  }

  if (error) {
    return (
      <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
        {error}
      </div>
    );
  }

  if (jobs.length === 0) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        No export jobs yet. Start an export above.
      </p>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b text-left text-muted-foreground">
            <th className="py-2 pr-4">Created</th>
            <th className="py-2 pr-4">Format</th>
            <th className="py-2 pr-4">Records</th>
            <th className="py-2 pr-4">Status</th>
            <th className="py-2 pr-4 hidden sm:table-cell">Expiry</th>
            <th className="py-2">Download</th>
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id} className="border-b">
              <td className="py-2 pr-4">{new Date(job.createdAt).toLocaleString()}</td>
              <td className="py-2 pr-4 uppercase">{job.format}</td>
              <td className="py-2 pr-4">{job.estimatedRecords}</td>
              <td className="py-2 pr-4">
                <span className={
                  job.status === 'expired' ? 'text-muted-foreground line-through' :
                  job.status === 'failed' ? 'text-destructive' :
                  job.status === 'completed' ? 'text-green-700' : ''
                }>
                  {STATUS_LABEL[job.status]}
                </span>
              </td>
              <td className="py-2 pr-4 hidden sm:table-cell">
                <span className={job.status === 'expired' ? 'text-destructive font-medium' : ''}>
                  {formatExpiry(job.expiresAt)}
                </span>
              </td>
              <td className="py-2">
                {job.status === 'completed' && job.downloadUrl ? (
                  <a
                    href={job.downloadUrl}
                    className="text-indigo-600 hover:underline font-medium"
                    download
                  >
                    Download
                  </a>
                ) : job.status === 'expired' ? (
                  <span className="text-muted-foreground text-xs">Link expired</span>
                ) : job.status === 'processing' || job.status === 'pending' ? (
                  <span className="text-muted-foreground text-xs">In progress…</span>
                ) : job.errorMessage ? (
                  <span className="text-destructive text-xs">{job.errorMessage}</span>
                ) : (
                  '—'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
