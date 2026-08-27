/** #929: Bulk catalog export types */

export type ExportFormat = 'csv' | 'json' | 'marc';

export type ExportJobStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'failed'
  | 'expired';

export interface ExportFilters {
  query?: string;
  format?: string;
  subject?: string;
  includeHoldings: boolean;
  dateFrom?: string;
  dateTo?: string;
}

export interface ExportScopeSummary {
  estimatedRecords: number;
  estimatedHoldings: number;
  filters: ExportFilters;
}

export interface ExportJob {
  id: string;
  status: ExportJobStatus;
  format: ExportFormat;
  filters: ExportFilters;
  estimatedRecords: number;
  downloadUrl?: string;
  expiresAt?: string;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
}
