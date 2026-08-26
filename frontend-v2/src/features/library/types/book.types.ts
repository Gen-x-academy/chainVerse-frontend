export type BookStatus = 'draft' | 'published' | 'archived' | 'withdrawn';

export type ContributorRole = 'author' | 'editor' | 'translator' | 'illustrator';

export interface Contributor {
  name: string;
  role: ContributorRole;
}

export interface Holding {
  location: string;
  callNumber: string;
  copies: number;
}

export type DigitalFormatType = 'pdf' | 'epub' | 'audiobook';

export interface DigitalFormat {
  format: DigitalFormatType;
  url?: string;
  fileSizeMb?: number;
}

export interface BookBibliographic {
  title: string;
  subtitle?: string;
  description: string;
  isbn?: string;
  isbn13?: string;
  publisher?: string;
  publicationYear?: number;
  language: string;
  pages?: number;
}

export interface BookTaxonomy {
  subjects: string[];
  deweyDecimal?: string;
  audience: string;
}

export interface Book {
  id: string;
  version: number;
  status: BookStatus;
  bibliographic: BookBibliographic;
  contributors: Contributor[];
  taxonomy: BookTaxonomy;
  holdings: Holding[];
  digitalFormats: DigitalFormat[];
  coverUrl?: string;
  createdAt: string;
  updatedAt: string;
}

export type BookCreatePayload = Omit<Book, 'id' | 'version' | 'createdAt' | 'updatedAt'>;

export type BookUpdatePayload = Partial<
  Omit<Book, 'id' | 'version' | 'status' | 'createdAt' | 'updatedAt'>
>;

export type BookFieldPath =
  | keyof BookBibliographic
  | `contributors.${number}.${keyof Contributor}`
  | `taxonomy.${keyof BookTaxonomy}`
  | `holdings.${number}.${keyof Holding}`
  | `digitalFormats.${number}.${keyof DigitalFormat}`
  | 'coverUrl';

export interface BookValidationError {
  status: 422;
  fieldErrors: Partial<Record<string, string>>;
  message: string;
}

export interface BookConflictPayload {
  status: 409;
  message: string;
  serverVersion: number;
  serverRecord: Book;
  clientVersion: number;
}

export type ISBNProvenance = 'open-library' | 'google-books' | 'internal';

export interface ISBNLookupResult {
  isbn: string;
  provenance: ISBNProvenance;
  fetchedAt: string;
  bibliographic: Partial<BookBibliographic>;
  contributors: Contributor[];
  taxonomy?: Partial<BookTaxonomy>;
  coverUrl?: string;
}

export interface BookStatusTransition {
  from: BookStatus;
  to: BookStatus;
  label: string;
  description: string;
  confirmMessage: string;
}
