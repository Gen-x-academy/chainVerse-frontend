'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { LibraryAdminLayout } from '@/components/elibrary/LibraryAdminLayout';
import { DuplicateBookComparison } from '@/components/elibrary/DuplicateBookComparison';
import { CatalogMergePanel } from '@/components/elibrary/CatalogMergePanel';
import { catalogMergeService } from '@/src/features/library/services/catalog-merge.service';
import type {
  DuplicateCandidate,
  MergeFieldDecision,
  MergePreview,
} from '@/src/features/library/types/catalog.types';

const DEFAULT_FIELDS: MergeFieldDecision['field'][] = [
  'title', 'author', 'isbn', 'publisher', 'publishedYear', 'format', 'description', 'subjects',
];

/** #927: Side-by-side duplicate comparison and merge */
export default function DuplicateMergePage() {
  const params = useParams();
  const groupId = params.groupId as string;

  const [group, setGroup] = useState<DuplicateCandidate | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canonicalRecordId, setCanonicalRecordId] = useState('');
  const [fieldDecisions, setFieldDecisions] = useState<MergeFieldDecision[]>([]);
  const [preview, setPreview] = useState<MergePreview | null>(null);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    catalogMergeService.getDuplicateGroup(groupId)
      .then((data) => {
        if (cancelled) return;
        setGroup(data);
        const canonical = data.records[0]?.id ?? '';
        setCanonicalRecordId(canonical);
        setFieldDecisions(
          DEFAULT_FIELDS.map((field) => ({ field, sourceRecordId: canonical })),
        );
      })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : 'Failed to load'); })
      .finally(() => { if (!cancelled) setIsLoading(false); });
    return () => { cancelled = true; };
  }, [groupId]);

  const handleCanonicalChange = useCallback((recordId: string) => {
    setCanonicalRecordId(recordId);
    setPreview(null);
  }, []);

  const handleFieldDecisionChange = useCallback((field: MergeFieldDecision['field'], sourceRecordId: string) => {
    setFieldDecisions((prev) => {
      const existing = prev.filter((d) => d.field !== field);
      return [...existing, { field, sourceRecordId }];
    });
    setPreview(null);
  }, []);

  const decisions = useMemo(() => fieldDecisions, [fieldDecisions]);

  const handlePreview = async () => {
    setIsPreviewLoading(true);
    setPreviewError(null);
    try {
      const result = await catalogMergeService.previewMerge(groupId, canonicalRecordId, decisions);
      setPreview(result);
    } catch (err) {
      setPreviewError(err instanceof Error ? err.message : 'Preview failed');
      throw err;
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleMerge = async () => {
    const result = await catalogMergeService.commitMerge(groupId, canonicalRecordId, decisions);
    return { redirectUrl: result.redirectUrl || `/catalog/${result.canonicalRecordId}` };
  };

  return (
    <LibraryAdminLayout requiredPermission="catalog" activeHref="/library/catalog">
      <div className="space-y-6">
        <div>
          <Link href="/library/catalog/duplicates" className="text-sm text-indigo-600 hover:underline">
            ← All duplicates
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 mt-2">Compare &amp; merge</h1>
        </div>

        <DuplicateBookComparison
          records={group?.records ?? []}
          canonicalRecordId={canonicalRecordId}
          fieldDecisions={decisions}
          onCanonicalChange={handleCanonicalChange}
          onFieldDecisionChange={handleFieldDecisionChange}
          holdingsCount={group?.holdingsCount}
          activeLoansCount={group?.activeLoansCount}
          pendingHoldsCount={group?.pendingHoldsCount}
          isLoading={isLoading}
          error={error}
        />

        {!isLoading && !error && group && (
          <CatalogMergePanel
            preview={preview}
            isPreviewLoading={isPreviewLoading}
            previewError={previewError}
            onPreview={handlePreview}
            onMerge={handleMerge}
            disabled={!canonicalRecordId}
          />
        )}
      </div>
    </LibraryAdminLayout>
  );
}
