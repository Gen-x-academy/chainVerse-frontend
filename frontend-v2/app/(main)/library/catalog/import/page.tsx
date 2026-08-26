'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { CatalogImportUploader } from '@/components/elibrary/CatalogImportUploader';
import { ImportValidationReport } from '@/components/elibrary/ImportValidationReport';
import { ImportPreviewTable } from '@/components/elibrary/ImportPreviewTable';
import { catalogImportService } from '@/src/features/library/services/catalog-import.service';
import type { ColumnMapping, ImportFormat, ImportJob, ImportPreviewResult } from '@/src/features/library/types/import.types';

/** #928: Bulk catalog import with dry-run validation */
export default function CatalogImportPage() {
  const [preview, setPreview] = useState<ImportPreviewResult | null>(null);
  const [job, setJob] = useState<ImportJob | null>(null);
  const [isValidating, setIsValidating] = useState(false);
  const [isStarting, setIsStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [detectedColumns, setDetectedColumns] = useState<string[]>([]);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const startPolling = useCallback((jobId: string) => {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const updated = await catalogImportService.getJob(jobId);
        setJob(updated);
        if (updated.status === 'completed' || updated.status === 'failed') {
          stopPolling();
        }
      } catch {
        stopPolling();
      }
    }, 2000);
  }, [stopPolling]);

  useEffect(() => () => stopPolling(), [stopPolling]);

  const handleValidate = async (file: File, format: ImportFormat, mappings?: ColumnMapping[]) => {
    setIsValidating(true);
    setError(null);
    setPreview(null);
    setJob(null);
    try {
      const result = await catalogImportService.uploadAndValidate(file, format, mappings);
      setPreview(result);
      if (result.rows.length > 0) {
        const cols = Object.keys(result.rows[0].data);
        setDetectedColumns(cols);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
      throw err;
    } finally {
      setIsValidating(false);
    }
  };

  const handleStartImport = async () => {
    if (!preview?.jobId) return;
    setIsStarting(true);
    setError(null);
    try {
      const started = await catalogImportService.startImport(preview.jobId);
      setJob(started);
      startPolling(started.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed to start');
    } finally {
      setIsStarting(false);
    }
  };

  const handleExportErrors = () => {
    if (job?.id) {
      window.open(catalogImportService.getErrorExportUrl(job.id), '_blank');
    }
  };

  return (
    <LibraryAdminLayout requiredPermission="catalog" activeHref="/library/catalog">
      <div className="space-y-6">
        <div>
          <Link href="/library/catalog" className="text-sm text-indigo-600 hover:underline">
            ← Catalog admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Bulk catalog import</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Upload CSV or JSON, map columns, validate, then import.
          </p>
        </div>

        <CatalogImportUploader
          onValidate={handleValidate}
          detectedColumns={detectedColumns}
          isValidating={isValidating}
        />

        <ImportValidationReport preview={preview} isLoading={isValidating} error={error} />

        <ImportPreviewTable
          preview={preview}
          job={job}
          onStartImport={handleStartImport}
          onExportErrors={handleExportErrors}
          isStarting={isStarting}
        />
      </div>
    </LibraryAdminLayout>
  );
}
