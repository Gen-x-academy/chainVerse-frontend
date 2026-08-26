'use client';

import { useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import type { ColumnMapping, ImportFormat } from '@/src/features/library/types/import.types';

const TARGET_FIELDS = [
  'title',
  'author',
  'isbn',
  'publisher',
  'publishedYear',
  'format',
  'subjects',
  'description',
];

interface CatalogImportUploaderProps {
  onValidate: (file: File, format: ImportFormat, mappings?: ColumnMapping[]) => Promise<void>;
  detectedColumns?: string[];
  disabled?: boolean;
  isValidating?: boolean;
}

/** #928: CSV/JSON upload with optional column mapping */
export function CatalogImportUploader({
  onValidate,
  detectedColumns = [],
  disabled,
  isValidating,
}: CatalogImportUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [format, setFormat] = useState<ImportFormat>('csv');
  const [file, setFile] = useState<File | null>(null);
  const [mappings, setMappings] = useState<ColumnMapping[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0] ?? null;
    setFile(selected);
    setError(null);
    if (selected) {
      const ext = selected.name.split('.').pop()?.toLowerCase();
      if (ext === 'json') setFormat('json');
      else if (ext === 'csv') setFormat('csv');
    }
  };

  const handleMappingChange = (sourceColumn: string, targetField: string) => {
    setMappings((prev) => {
      const filtered = prev.filter((m) => m.sourceColumn !== sourceColumn);
      if (targetField) {
        return [...filtered, { sourceColumn, targetField }];
      }
      return filtered;
    });
  };

  const handleValidate = async () => {
    if (!file) {
      setError('Please select a file to upload.');
      return;
    }
    setError(null);
    try {
      await onValidate(file, format, mappings.length ? mappings : undefined);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Validation failed');
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload catalog file</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Format</legend>
            <div className="flex gap-4">
              {(['csv', 'json'] as ImportFormat[]).map((f) => (
                <label key={f} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="import-format"
                    value={f}
                    checked={format === f}
                    onChange={() => setFormat(f)}
                  />
                  {f.toUpperCase()}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        <div>
          <input
            ref={inputRef}
            type="file"
            accept=".csv,.json,text/csv,application/json"
            onChange={handleFileChange}
            className="block w-full text-sm"
            aria-label="Catalog import file"
          />
          {file && (
            <p className="mt-1 text-xs text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(1)} KB)
            </p>
          )}
        </div>

        {format === 'csv' && detectedColumns.length > 0 && (
          <div className="space-y-2">
            <p className="text-sm font-medium">Column mapping</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-muted-foreground">
                    <th className="py-1 pr-4">Source column</th>
                    <th className="py-1">Target field</th>
                  </tr>
                </thead>
                <tbody>
                  {detectedColumns.map((col) => (
                    <tr key={col} className="border-t">
                      <td className="py-2 pr-4">{col}</td>
                      <td className="py-2">
                        <select
                          className="w-full rounded-md border px-2 py-1 text-sm"
                          value={mappings.find((m) => m.sourceColumn === col)?.targetField ?? ''}
                          onChange={(e) => handleMappingChange(col, e.target.value)}
                        >
                          <option value="">— skip —</option>
                          {TARGET_FIELDS.map((field) => (
                            <option key={field} value={field}>{field}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="text-sm text-destructive">{error}</div>
        )}

        <Button
          type="button"
          onClick={handleValidate}
          disabled={disabled || isValidating || !file}
        >
          {isValidating ? 'Validating…' : 'Validate import (dry run)'}
        </Button>
        <p className="text-xs text-muted-foreground">
          Import will not start until validation passes and you confirm.
        </p>
      </CardContent>
    </Card>
  );
}
