import type {
  ColumnMapping,
  ImportFormat,
  ImportJob,
  ImportPreviewResult,
} from '../types/import.types';

const BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';
const ACCESS_TOKEN_KEY = 'accessToken';

export class CatalogImportError extends Error {
  constructor(
    message: string,
    public readonly code: 'forbidden' | 'validation' | 'conflict' | 'unknown',
  ) {
    super(message);
    this.name = 'CatalogImportError';
  }
}

function mapError(err: unknown): CatalogImportError {
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (message.includes('403') || message.toLowerCase().includes('forbidden')) {
    return new CatalogImportError('You do not have permission to import catalog records.', 'forbidden');
  }
  if (message.includes('400') || message.toLowerCase().includes('validation')) {
    return new CatalogImportError('Import validation failed.', 'validation');
  }
  return new CatalogImportError(message, 'unknown');
}

async function uploadFile<T>(path: string, formData: FormData): Promise<T> {
  if (!BASE_URL) throw new CatalogImportError('API base URL is not configured', 'unknown');

  const token = typeof window !== 'undefined' ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
  const response = await fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : {},
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => '');
    throw new CatalogImportError(text || `Upload failed (${response.status})`, 'unknown');
  }

  return response.json() as Promise<T>;
}

/** #928: Bulk catalog import with dry-run validation */
export const catalogImportService = {
  async uploadAndValidate(
    file: File,
    format: ImportFormat,
    columnMappings?: ColumnMapping[],
  ): Promise<ImportPreviewResult> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('format', format);
      if (columnMappings?.length) {
        formData.append('columnMappings', JSON.stringify(columnMappings));
      }
      return await uploadFile<ImportPreviewResult>('/library/catalog/import/validate', formData);
    } catch (err) {
      throw mapError(err);
    }
  },

  async startImport(jobId: string): Promise<ImportJob> {
    try {
      const { apiClient } = await import('@/src/lib/api-client');
      return await apiClient.post<ImportJob>(`/library/catalog/import/${jobId}/start`, {});
    } catch (err) {
      throw mapError(err);
    }
  },

  async getJob(jobId: string): Promise<ImportJob> {
    try {
      const { apiClient } = await import('@/src/lib/api-client');
      return await apiClient.get<ImportJob>(`/library/catalog/import/${jobId}`);
    } catch (err) {
      throw mapError(err);
    }
  },

  async listJobs(): Promise<ImportJob[]> {
    try {
      const { apiClient } = await import('@/src/lib/api-client');
      return await apiClient.get<ImportJob[]>('/library/catalog/import/jobs');
    } catch (err) {
      throw mapError(err);
    }
  },

  getErrorExportUrl(jobId: string): string {
    return `${BASE_URL}/library/catalog/import/${jobId}/errors`;
  },
};
