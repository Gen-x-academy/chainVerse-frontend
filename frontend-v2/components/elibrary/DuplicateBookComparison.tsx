'use client';

import type { CatalogRecord, MergeFieldDecision } from '@/src/features/library/types/catalog.types';

const COMPARABLE_FIELDS: (keyof CatalogRecord)[] = [
  'title',
  'author',
  'isbn',
  'publisher',
  'publishedYear',
  'format',
  'description',
];

const FIELD_LABELS: Record<string, string> = {
  title: 'Title',
  author: 'Author',
  isbn: 'ISBN',
  publisher: 'Publisher',
  publishedYear: 'Published year',
  format: 'Format',
  description: 'Description',
  subjects: 'Subjects',
};

interface DuplicateBookComparisonProps {
  records: CatalogRecord[];
  canonicalRecordId: string;
  fieldDecisions: MergeFieldDecision[];
  onCanonicalChange: (recordId: string) => void;
  onFieldDecisionChange: (field: MergeFieldDecision['field'], sourceRecordId: string) => void;
  holdingsCount?: number;
  activeLoansCount?: number;
  pendingHoldsCount?: number;
  isLoading?: boolean;
  error?: string | null;
}

function formatValue(value: unknown): string {
  if (value === undefined || value === null || value === '') return '—';
  if (Array.isArray(value)) return value.join(', ') || '—';
  return String(value);
}

/** #927: Side-by-side duplicate record comparison with canonical field selection */
export function DuplicateBookComparison({
  records,
  canonicalRecordId,
  fieldDecisions,
  onCanonicalChange,
  onFieldDecisionChange,
  holdingsCount = 0,
  activeLoansCount = 0,
  pendingHoldsCount = 0,
  isLoading,
  error,
}: DuplicateBookComparisonProps) {
  if (isLoading) {
    return (
      <div aria-label="Loading duplicate comparison" className="py-8 text-center text-sm text-muted-foreground">
        Loading comparison…
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

  if (records.length < 2) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        Not enough records to compare.
      </p>
    );
  }

  const getDecisionForField = (field: MergeFieldDecision['field']) =>
    fieldDecisions.find((d) => d.field === field)?.sourceRecordId ?? canonicalRecordId;

  return (
    <div className="space-y-6">
      <div className="rounded-lg border bg-amber-50 p-4 text-sm">
        <h3 className="font-semibold text-amber-900 mb-2">Holdings &amp; loan implications</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div>
            <dt className="text-amber-800">Holdings to reassign</dt>
            <dd className="text-lg font-bold text-amber-950">{holdingsCount}</dd>
          </div>
          <div>
            <dt className="text-amber-800">Active loans to transfer</dt>
            <dd className="text-lg font-bold text-amber-950">{activeLoansCount}</dd>
          </div>
          <div>
            <dt className="text-amber-800">Pending holds to transfer</dt>
            <dd className="text-lg font-bold text-amber-950">{pendingHoldsCount}</dd>
          </div>
        </dl>
      </div>

      <fieldset className="space-y-2">
        <legend className="text-sm font-medium">Choose canonical record</legend>
        <div className="flex flex-col sm:flex-row gap-3">
          {records.map((record) => (
            <label
              key={record.id}
              className={`flex items-center gap-2 rounded-md border px-3 py-2 cursor-pointer ${
                canonicalRecordId === record.id ? 'border-indigo-600 bg-indigo-50' : ''
              }`}
            >
              <input
                type="radio"
                name="canonical"
                value={record.id}
                checked={canonicalRecordId === record.id}
                onChange={() => onCanonicalChange(record.id)}
              />
              <span className="text-sm truncate">{record.title}</span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="overflow-x-auto">
        <table className="w-full text-sm border">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="p-2 border-b">Field</th>
              {records.map((r) => (
                <th key={r.id} className="p-2 border-b min-w-[160px]">{r.title.slice(0, 30)}</th>
              ))}
              <th className="p-2 border-b">Selected value</th>
            </tr>
          </thead>
          <tbody>
            {COMPARABLE_FIELDS.map((field) => {
              const selectedId = getDecisionForField(field);
              const selectedRecord = records.find((r) => r.id === selectedId);
              return (
                <tr key={field} className="border-b">
                  <td className="p-2 font-medium">{FIELD_LABELS[field]}</td>
                  {records.map((record) => (
                    <td key={record.id} className="p-2 align-top">
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={`field-${field}`}
                          checked={selectedId === record.id}
                          onChange={() => onFieldDecisionChange(field, record.id)}
                          className="mt-1"
                        />
                        <span>{formatValue(record[field])}</span>
                      </label>
                    </td>
                  ))}
                  <td className="p-2 font-medium text-indigo-700">
                    {formatValue(selectedRecord?.[field])}
                  </td>
                </tr>
              );
            })}
            <tr className="border-b">
              <td className="p-2 font-medium">{FIELD_LABELS.subjects}</td>
              {records.map((record) => (
                <td key={record.id} className="p-2 align-top">
                  <label className="flex items-start gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="field-subjects"
                      checked={getDecisionForField('subjects') === record.id}
                      onChange={() => onFieldDecisionChange('subjects', record.id)}
                      className="mt-1"
                    />
                    <span>{formatValue(record.subjects)}</span>
                  </label>
                </td>
              ))}
              <td className="p-2 font-medium text-indigo-700">
                {formatValue(records.find((r) => r.id === getDecisionForField('subjects'))?.subjects)}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
