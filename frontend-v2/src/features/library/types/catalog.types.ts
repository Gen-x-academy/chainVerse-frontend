export interface CatalogItem {
  id: string;
  title: string;
  authorId?: string;
  authorName?: string;
  coverUrl?: string;
  format?: string;
  genre?: string;
  year?: number;
  isArchived?: boolean;
}

export interface CatalogSearchParams {
  query?: string;
  facets?: Record<string, string[]>;
  cursor?: string | null;
  limit?: number;
  includeArchived?: boolean;
}

export interface CatalogSearchResponse {
  data: CatalogItem[];
  nextCursor: string | null;
  prevCursor: string | null;
  total: number;
}
