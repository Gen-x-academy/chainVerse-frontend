'use client';

import type { ImportPreviewRow, ImportPreviewResult } from '@/src/features/library/types/import.types';

interface ImportValidationReportProps {
  preview: ImportPreviewResult | null;
  isLoading?: boolean;
  error?: string | null;
}

/** #928: Row-level validation report for import dry-run */
export function ImportValidationReport({ preview, isLoading, error }: ImportValidationReportProps) {
  if (isLoading) {
    return (
      <div aria-label="Loading validation report" className="py-6 text-center text-sm text-muted-foreground">
        Running validation…
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

  if (!preview) {
    return (
      <p className="py-6 text-center text-sm text-muted-foreground">
        Upload a file and run validation to see results.
      </p>
    );
  }

  const errorRows = preview.rows.filter((r) => r.status === 'invalid');

  return (
    <div className="space-y-4">
      <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
        <div className="rounded-md border p-3">
          <dt className="text-muted-foreground">Total rows</dt>
          <dd className="text-xl font-bold">{preview.totalRows}</dd>
        </div>
        <div className="rounded-md border p-3 border-green-200 bg-green-50">
          <dt className="text-green-800">Valid</dt>
          <dd className="text-xl font-bold text-green-900">{preview.validRows}</dd>
        </div>
        <div className="rounded-md border p-3 border-red-200 bg-red-50">
          <dt className="text-red-800">Invalid</dt>
          <dd className="text-xl font-bold text-red-900">{preview.invalidRows}</dd>
        </div>
        <div className="rounded-md border p-3">
          <dt className="text-muted-foreground">Skipped (already imported)</dt>
          <dd className="text-xl font-bold">{preview.skippedRows}</dd>
        </div>
      </dl>

      {!preview.canImport && (
        <div role="alert" className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
          Fix validation errors before starting the import. Partial failures will be reported after import.
        </div>
      )}

      {errorRows.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th className="py-2 pr-4">Row</th>
                <th className="py-2 pr-4">Field</th>
                <th className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {errorRows.flatMap((row: ImportPreviewRow) =>
                row.errors.map((err, i) => (
                  <tr key={`${row.row}-${i}`} className="border-b">
                    <td className="py-2 pr-4">{row.row}</td>
                    <td className="py-2 pr-4">{err.field ?? '—'}</td>
                    <td className="py-2 text-destructive">{err.message}</td>
                  </tr>
                )),
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
