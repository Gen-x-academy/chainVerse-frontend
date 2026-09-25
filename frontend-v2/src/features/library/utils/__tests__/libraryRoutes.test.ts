import { describe, expect, it } from 'vitest';
import {
  authorRoute,
  bookDetailRoute,
  bookEditRoute,
  libraryAccountRoute,
  libraryCatalogRoute,
} from '../libraryRoutes';

describe('libraryRoutes', () => {
  it('builds the canonical book detail route', () => {
    expect(bookDetailRoute('book-123')).toBe('/catalog/book-123');
  });

  it('never routes books to the course feature', () => {
    expect(bookDetailRoute('book-123')).not.toMatch(/^\/courses/);
    expect(bookDetailRoute('book-123')).not.toContain('/courses/');
  });

  it('builds author, library-account, and librarian edit routes', () => {
    expect(authorRoute('author-1')).toBe('/authors/author-1');
    expect(bookEditRoute('book-9')).toBe('/library/catalog/book-9/edit');
    expect(libraryAccountRoute()).toBe('/library/account');
    expect(libraryAccountRoute('fines')).toBe('/library/account?tab=fines');
    expect(libraryCatalogRoute).toBe('/library/catalog');
  });

  it('escapes ids when interpolated into URLs', () => {
    const id = 'a b/c';
    expect(bookDetailRoute(id)).toContain(encodeURIComponent('a b/c'));
  });
});