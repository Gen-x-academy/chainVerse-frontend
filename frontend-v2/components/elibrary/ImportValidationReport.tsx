'use client';

import { useMemo, useState } from 'react';
import type { ImportPreviewRow, ImportPreviewResult } from '@/src/features/library/types/import.types';

interface ImportValidationReportProps {
  preview: ImportPreviewResult | null;
  isLoading?: boolean;
  error?: string | null;
}

type RowFilter = 'all' | 'invalid' | 'valid' | 'skipped';

const PAGE_SIZE = 25;

/** #928: Row-level validation report for import dry-run */
export function ImportValidationReport({ preview, isLoading, error }: ImportValidationReportProps) {
  const [filter, setFilter] = useState<RowFilter>('invalid');
  const [page, setPage] = useState(0);

  const filteredRows = useMemo<ImportPreviewRow[]>(() => {
    if (!preview) return [];
    if (filter === 'all') return preview.rows;
    if (filter === 'invalid') return preview.rows.filter((r) => r.status === 'invalid');
    if (filter === 'valid') return preview.rows.filter((r) => r.status === 'valid');
    return preview.rows.filter((r) => r.status === 'skipped');
  }, [preview, filter]);

  const pageCount = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const pageRows = filteredRows.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);

  if (isLoading) {
    return (
      <div
        role="status"
        aria-live="polite"
        aria-label="Loading validation report"
        className="py-6 text-center text-sm text-muted-foreground"
      >
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

  const filterOptions: { value: RowFilter; label: string }[] = [
    { value: 'invalid', label: `Invalid (${preview.invalidRows})` },
    { value: 'valid', label: `Valid (${preview.validRows})` },
    { value: 'skipped', label: `Skipped (${preview.skippedRows})` },
    { value: 'all', label: `All (${preview.totalRows})` },
  ];

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

      <div className="flex flex-wrap items-center gap-2" role="group" aria-label="Filter rows by validation status">
        {filterOptions.map((opt) => (
          <button
            key={opt.value}
            type="button"
            aria-pressed={filter === opt.value}
            onClick={() => {
              setFilter(opt.value);
              setPage(0);
            }}
            className={`rounded-md border px-3 py-1 text-sm ${
              filter === opt.value ? 'bg-primary text-primary-foreground' : 'bg-background'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      {pageRows.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted-foreground">No rows match the selected filter.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <caption className="sr-only">Import validation results by row</caption>
            <thead>
              <tr className="border-b text-left text-muted-foreground">
                <th scope="col" className="py-2 pr-4">Row</th>
                <th scope="col" className="py-2 pr-4">Status</th>
                <th scope="col" className="py-2 pr-4">Field</th>
                <th scope="col" className="py-2">Error</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row: ImportPreviewRow) => {
                const rowErrors = row.errors.length > 0 ? row.errors : [null];
                return rowErrors.map((err, i) => (
                  <tr key={`${row.row}-${i}`} className="border-b">
                    <td className="py-2 pr-4">{row.row}</td>
                    <td className="py-2 pr-4">{row.status}</td>
                    <td className="py-2 pr-4">{err?.field ?? '—'}</td>
                    <td className="py-2 text-destructive">{err?.message ?? '—'}</td>
                  </tr>
                ));
              })}
            </tbody>
          </table>
        </div>
      )}

      {pageCount > 1 && (
        <nav className="flex items-center justify-between text-sm" aria-label="Validation report pagination">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={safePage === 0}
            className="rounded-md border px-3 py-1 disabled:opacity-50"
          >
            Previous
          </button>
          <span aria-live="polite">
            Page {safePage + 1} of {pageCount}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(pageCount - 1, p + 1))}
            disabled={safePage >= pageCount - 1}
            className="rounded-md border px-3 py-1 disabled:opacity-50"
          >
            Next
          </button>
        </nav>
      )}
    </div>
  );
}
