export interface Author {
  id: string;
  name: string;
  bio: string;
  avatarUrl?: string;
  birthYear?: number;
  deathYear?: number;
  nationality?: string;
  website?: string;
  bookCount: number;
}

export interface AuthorSummary {
  id: string;
  name: string;
  avatarUrl?: string;
  bookCount: number;
  nationality?: string;
}

export interface AuthorBook {
  id: string;
  title: string;
  coverUrl?: string;
  year?: number;
  format?: string;
  isbn?: string;
}

export interface AuthorBooksResponse {
  data: AuthorBook[];
  total: number;
  page: number;
  limit: number;
}
