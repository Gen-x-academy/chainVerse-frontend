import { describe, it, expect } from 'vitest';
import {
  canPerformLibrarianAction,
  resolveLibrarianPermissions,
} from '../librarian-permissions';
import { isValidTransition } from '../book-lifecycle';

describe('librarian-permissions', () => {
  it('grants admin full librarian permissions', () => {
    const perms = resolveLibrarianPermissions('admin');
    expect(perms).toContain('catalog');
    expect(perms).toContain('acquisitions');
  });

  it('denies student role librarian actions', () => {
    const perms = resolveLibrarianPermissions('student');
    expect(canPerformLibrarianAction(perms, 'book.create')).toBe(false);
  });

  it('allows catalog permission for book edit', () => {
    expect(canPerformLibrarianAction(['catalog'], 'book.edit')).toBe(true);
  });

  it('requires acquisitions or catalog for ISBN import', () => {
    expect(canPerformLibrarianAction(['circulation'], 'book.isbn-import')).toBe(false);
    expect(canPerformLibrarianAction(['acquisitions'], 'book.isbn-import')).toBe(true);
  });
});

describe('book-lifecycle', () => {
  it('blocks invalid transitions', () => {
    expect(isValidTransition('draft', 'withdrawn')).toBe(false);
    expect(isValidTransition('draft', 'published')).toBe(true);
  });
});
