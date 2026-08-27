'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { CatalogExportControls } from '@/components/elibrary/CatalogExportControls';
import { ExportJobStatus } from '@/components/elibrary/ExportJobStatus';
import { catalogExportService } from '@/src/features/library/services/catalog-export.service';
import type { ExportFilters, ExportFormat, ExportJob, ExportScopeSummary } from '@/src/features/library/types/export.types';

/** #929: Bulk catalog export with background jobs */
export default function CatalogExportPage() {
  const [scopeSummary, setScopeSummary] = useState<ExportScopeSummary | null>(null);
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isLoadingJobs, setIsLoadingJobs] = useState(true);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [jobsError, setJobsError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const loadJobs = useCallback(async () => {
    try {
      const data = await catalogExportService.listJobs();
      setJobs(data);
      setJobsError(null);
    } catch (err) {
      setJobsError(err instanceof Error ? err.message : 'Failed to load jobs');
    } finally {
      setIsLoadingJobs(false);
    }
  }, []);

  useEffect(() => {
    loadJobs();
    pollRef.current = setInterval(loadJobs, 5000);
    return () => { if (pollRef.current) clearInterval(pollRef.current); };
  }, [loadJobs]);

  const handlePreview = async (filters: ExportFilters, format: ExportFormat) => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const summary = await catalogExportService.previewScope(filters, format);
      setScopeSummary(summary);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
      throw err;
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleSubmit = async (filters: ExportFilters, format: ExportFormat) => {
    setIsSubmitting(true);
    try {
      await catalogExportService.startExport(filters, format);
      await loadJobs();
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Export failed');
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <LibraryAdminLayout requiredPermission="catalog" activeHref="/library/catalog">
      <div className="space-y-8">
        <div>
          <Link href="/library/catalog" className="text-sm text-indigo-600 hover:underline">
            ← Catalog admin
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Bulk catalog export</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Filter, preview scope, and export catalog metadata with background job tracking.
          </p>
        </div>

        <CatalogExportControls
          scopeSummary={scopeSummary}
          isPreviewLoading={isPreviewLoading}
          previewError={previewError}
          onPreview={handlePreview}
          onSubmit={handleSubmit}
          isSubmitting={isSubmitting}
        />

        <div>
          <h2 className="text-lg font-semibold mb-4">Export jobs</h2>
          <ExportJobStatus jobs={jobs} isLoading={isLoadingJobs} error={jobsError} />
        </div>
      </div>
    </LibraryAdminLayout>
  );
}
