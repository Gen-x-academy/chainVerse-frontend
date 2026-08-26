import { apiClient } from '@/src/lib/api-client';
import type { ExportFilters, ExportFormat, ExportJob, ExportScopeSummary } from '../types/export.types';

export class CatalogExportError extends Error {
  constructor(
    message: string,
    public readonly code: 'forbidden' | 'not-found' | 'unknown',
  ) {
    super(message);
    this.name = 'CatalogExportError';
  }
}

function mapError(err: unknown): CatalogExportError {
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (message.includes('403') || message.toLowerCase().includes('forbidden')) {
    return new CatalogExportError('You do not have permission to export catalog records.', 'forbidden');
  }
  if (message.includes('404')) {
    return new CatalogExportError('Export job not found.', 'not-found');
  }
  return new CatalogExportError(message, 'unknown');
}

/** #929: Filtered catalog export with background jobs */
export const catalogExportService = {
  async previewScope(filters: ExportFilters, format: ExportFormat): Promise<ExportScopeSummary> {
    try {
      return await apiClient.post<ExportScopeSummary>('/library/catalog/export/preview', {
        filters,
        format,
      });
    } catch (err) {
      throw mapError(err);
    }
  },

  async startExport(filters: ExportFilters, format: ExportFormat): Promise<ExportJob> {
    try {
      return await apiClient.post<ExportJob>('/library/catalog/export', { filters, format });
    } catch (err) {
      throw mapError(err);
    }
  },

  async listJobs(): Promise<ExportJob[]> {
    try {
      return await apiClient.get<ExportJob[]>('/library/catalog/export/jobs');
    } catch (err) {
      throw mapError(err);
    }
  },

  async getJob(jobId: string): Promise<ExportJob> {
    try {
      return await apiClient.get<ExportJob>(`/library/catalog/export/${jobId}`);
    } catch (err) {
      throw mapError(err);
    }
  },
};
