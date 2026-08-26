'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ExportFilters, ExportFormat, ExportScopeSummary } from '@/src/features/library/types/export.types';

interface CatalogExportControlsProps {
  scopeSummary: ExportScopeSummary | null;
  isPreviewLoading?: boolean;
  previewError?: string | null;
  onPreview: (filters: ExportFilters, format: ExportFormat) => Promise<void>;
  onSubmit: (filters: ExportFilters, format: ExportFormat) => Promise<void>;
  isSubmitting?: boolean;
  disabled?: boolean;
}

const FORMAT_OPTIONS: { value: ExportFormat; label: string }[] = [
  { value: 'csv', label: 'CSV' },
  { value: 'json', label: 'JSON' },
  { value: 'marc', label: 'MARC' },
];

/** #929: Filtered export controls with scope preview */
export function CatalogExportControls({
  scopeSummary,
  isPreviewLoading,
  previewError,
  onPreview,
  onSubmit,
  isSubmitting,
  disabled,
}: CatalogExportControlsProps) {
  const [format, setFormat] = useState<ExportFormat>('csv');
  const [filters, setFilters] = useState<ExportFilters>({
    includeHoldings: true,
  });
  const [confirmed, setConfirmed] = useState(false);

  const updateFilter = <K extends keyof ExportFilters>(key: K, value: ExportFilters[K]) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
    setConfirmed(false);
  };

  const handlePreview = async () => {
    setConfirmed(false);
    await onPreview(filters, format);
  };

  const handleSubmit = async () => {
    if (!confirmed) return;
    await onSubmit(filters, format);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Export catalog</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Export format</legend>
          <div className="flex flex-wrap gap-4">
            {FORMAT_OPTIONS.map((opt) => (
              <label key={opt.value} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="export-format"
                  value={opt.value}
                  checked={format === opt.value}
                  onChange={() => { setFormat(opt.value); setConfirmed(false); }}
                />
                {opt.label}
              </label>
            ))}
          </div>
        </fieldset>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="export-query" className="text-sm font-medium">Search query</label>
            <input
              id="export-query"
              type="text"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={filters.query ?? ''}
              onChange={(e) => updateFilter('query', e.target.value || undefined)}
              placeholder="Title, author, ISBN…"
            />
          </div>
          <div>
            <label htmlFor="export-subject" className="text-sm font-medium">Subject</label>
            <input
              id="export-subject"
              type="text"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={filters.subject ?? ''}
              onChange={(e) => updateFilter('subject', e.target.value || undefined)}
            />
          </div>
          <div>
            <label htmlFor="export-date-from" className="text-sm font-medium">Added from</label>
            <input
              id="export-date-from"
              type="date"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={filters.dateFrom ?? ''}
              onChange={(e) => updateFilter('dateFrom', e.target.value || undefined)}
            />
          </div>
          <div>
            <label htmlFor="export-date-to" className="text-sm font-medium">Added to</label>
            <input
              id="export-date-to"
              type="date"
              className="mt-1 w-full rounded-md border px-3 py-2 text-sm"
              value={filters.dateTo ?? ''}
              onChange={(e) => updateFilter('dateTo', e.target.value || undefined)}
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={filters.includeHoldings}
            onChange={(e) => updateFilter('includeHoldings', e.target.checked)}
          />
          Include holdings data
        </label>

        {previewError && (
          <div role="alert" className="text-sm text-destructive">{previewError}</div>
        )}

        {scopeSummary && (
          <div className="rounded-md border bg-gray-50 p-4 text-sm space-y-2">
            <p className="font-medium">Export scope summary</p>
            <dl className="grid grid-cols-2 gap-2">
              <div>
                <dt className="text-muted-foreground">Estimated records</dt>
                <dd className="font-bold">{scopeSummary.estimatedRecords}</dd>
              </div>
              {scopeSummary.estimatedHoldings > 0 && (
                <div>
                  <dt className="text-muted-foreground">Estimated holdings</dt>
                  <dd className="font-bold">{scopeSummary.estimatedHoldings}</dd>
                </div>
              )}
            </dl>
            <label className="flex items-start gap-2 mt-2 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-1"
              />
              <span>I confirm this export scope and understand the job may run in the background.</span>
            </label>
          </div>
        )}

        <div className="flex flex-col sm:flex-row gap-2">
          <Button type="button" variant="outline" onClick={handlePreview} disabled={disabled || isPreviewLoading}>
            {isPreviewLoading ? 'Calculating scope…' : 'Preview scope'}
          </Button>
          <Button
            type="button"
            onClick={handleSubmit}
            disabled={disabled || !confirmed || !scopeSummary || isSubmitting}
          >
            {isSubmitting ? 'Starting export…' : 'Start export'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
