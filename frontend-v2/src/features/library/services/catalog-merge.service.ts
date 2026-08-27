import { apiClient } from '@/src/lib/api-client';
import type {
  DuplicateCandidate,
  MergeFieldDecision,
  MergePreview,
  MergeResult,
} from '../types/catalog.types';

export class CatalogMergeError extends Error {
  constructor(
    message: string,
    public readonly code: 'forbidden' | 'not-found' | 'conflict' | 'unknown',
  ) {
    super(message);
    this.name = 'CatalogMergeError';
  }
}

function mapError(err: unknown): CatalogMergeError {
  const message = err instanceof Error ? err.message : 'Unknown error';
  if (message.includes('403') || message.toLowerCase().includes('forbidden')) {
    return new CatalogMergeError('You do not have permission to merge catalog records.', 'forbidden');
  }
  if (message.includes('404') || message.toLowerCase().includes('not found')) {
    return new CatalogMergeError('Duplicate group not found.', 'not-found');
  }
  if (message.includes('409') || message.toLowerCase().includes('conflict')) {
    return new CatalogMergeError('Merge conflict — records may have changed.', 'conflict');
  }
  return new CatalogMergeError(message, 'unknown');
}

/** #927: Duplicate detection and merge API */
export const catalogMergeService = {
  async listDuplicates(): Promise<DuplicateCandidate[]> {
    try {
      return await apiClient.get<DuplicateCandidate[]>('/library/catalog/duplicates');
    } catch (err) {
      throw mapError(err);
    }
  },

  async getDuplicateGroup(groupId: string): Promise<DuplicateCandidate> {
    try {
      return await apiClient.get<DuplicateCandidate>(`/library/catalog/duplicates/${groupId}`);
    } catch (err) {
      throw mapError(err);
    }
  },

  async previewMerge(
    groupId: string,
    canonicalRecordId: string,
    fieldDecisions: MergeFieldDecision[],
  ): Promise<MergePreview> {
    try {
      return await apiClient.post<MergePreview>(`/library/catalog/duplicates/${groupId}/preview`, {
        canonicalRecordId,
        fieldDecisions,
      });
    } catch (err) {
      throw mapError(err);
    }
  },

  async commitMerge(
    groupId: string,
    canonicalRecordId: string,
    fieldDecisions: MergeFieldDecision[],
  ): Promise<MergeResult> {
    try {
      return await apiClient.post<MergeResult>(`/library/catalog/duplicates/${groupId}/merge`, {
        canonicalRecordId,
        fieldDecisions,
      });
    } catch (err) {
      throw mapError(err);
    }
  },
};
