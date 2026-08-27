'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ImportJob, ImportPreviewResult } from '@/src/features/library/types/import.types';

interface ImportPreviewTableProps {
  preview: ImportPreviewResult | null;
  job: ImportJob | null;
  onStartImport: () => Promise<void>;
  onExportErrors?: () => void;
  isStarting?: boolean;
}

/** #928: Import confirmation and progress tracking */
export function ImportPreviewTable({
  preview,
  job,
  onStartImport,
  onExportErrors,
  isStarting,
}: ImportPreviewTableProps) {
  if (!preview && !job) return null;

  const progress = job && job.totalRows > 0
    ? Math.round((job.processedRows / job.totalRows) * 100)
    : 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Import progress</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {job ? (
          <>
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span>Status: <strong>{job.status}</strong></span>
                <span>{job.processedRows} / {job.totalRows} rows</span>
              </div>
              <div className="h-2 rounded-full bg-gray-200 overflow-hidden">
                <div
                  className="h-full bg-indigo-600 transition-all"
                  style={{ width: `${progress}%` }}
                  role="progressbar"
                  aria-valuenow={progress}
                  aria-valuemin={0}
                  aria-valuemax={100}
                />
              </div>
              <dl className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <dt className="text-muted-foreground">Successful</dt>
                  <dd className="font-medium text-green-700">{job.successCount}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Failed</dt>
                  <dd className="font-medium text-red-700">{job.failureCount}</dd>
                </div>
              </dl>
            </div>
            {job.failureCount > 0 && onExportErrors && (
              <Button type="button" variant="outline" onClick={onExportErrors}>
                Export row-level errors
              </Button>
            )}
            {job.status === 'completed' && (
              <p className="text-sm text-green-700">
                Import complete. Retrying will skip already-imported rows.
              </p>
            )}
          </>
        ) : preview?.canImport ? (
          <>
            <p className="text-sm text-muted-foreground">
              Validation passed for {preview.validRows} rows. Ready to import.
            </p>
            <Button type="button" onClick={onStartImport} disabled={isStarting}>
              {isStarting ? 'Starting import…' : 'Start import'}
            </Button>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
