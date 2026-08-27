export type ArchiveStatus = 'active' | 'archived';

export interface ArchivedBook {
  id: string;
  title: string;
  authorName: string;
  coverUrl?: string;
  archivedAt: string;
  archivedBy?: string;
  archiveReason?: string;
  status: ArchiveStatus;
}

export interface ArchivedBooksResponse {
  data: ArchivedBook[];
  total: number;
  page: number;
  limit: number;
}
