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
}
