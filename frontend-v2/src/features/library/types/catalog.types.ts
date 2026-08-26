/** #927: Catalog record and duplicate-merge types */

export type CatalogFormat = 'print' | 'ebook' | 'audiobook' | 'digital';

export interface CatalogRecord {
  id: string;
  title: string;
  author: string;
  isbn?: string;
  publisher?: string;
  publishedYear?: number;
  format: CatalogFormat;
  subjects?: string[];
  description?: string;
}

export interface DuplicateCandidate {
  groupId: string;
  matchScore: number;
  records: CatalogRecord[];
  holdingsCount: number;
  activeLoansCount: number;
  pendingHoldsCount: number;
}

export interface MergeFieldDecision {
  field: keyof CatalogRecord | 'subjects';
  sourceRecordId: string;
}

export interface MergePreview {
  groupId: string;
  canonicalRecordId: string;
  mergedRecord: Partial<CatalogRecord>;
  holdingsToReassign: number;
  loansToTransfer: number;
  holdsToTransfer: number;
  warnings: string[];
}

export interface MergeResult {
  canonicalRecordId: string;
  mergedRecordIds: string[];
  redirectUrl: string;
}
