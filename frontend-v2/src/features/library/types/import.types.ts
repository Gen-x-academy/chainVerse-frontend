/** #928: Bulk catalog import types */

export type ImportFormat = 'csv' | 'json';

export type ImportJobStatus =
  | 'pending'
  | 'validating'
  | 'validated'
  | 'importing'
  | 'completed'
  | 'failed';

export interface ColumnMapping {
  sourceColumn: string;
  targetField: string;
}

export interface ImportValidationError {
  row: number;
  field?: string;
  message: string;
  severity: 'error' | 'warning';
}

export interface ImportPreviewRow {
  row: number;
  data: Record<string, string>;
  status: 'valid' | 'invalid' | 'skipped';
  errors: ImportValidationError[];
}

export interface ImportPreviewResult {
  jobId: string;
  totalRows: number;
  validRows: number;
  invalidRows: number;
  skippedRows: number;
  rows: ImportPreviewRow[];
  canImport: boolean;
}

export interface ImportJob {
  id: string;
  status: ImportJobStatus;
  format: ImportFormat;
  fileName: string;
  totalRows: number;
  processedRows: number;
  successCount: number;
  failureCount: number;
  createdAt: string;
  completedAt?: string;
  errorExportUrl?: string;
}
