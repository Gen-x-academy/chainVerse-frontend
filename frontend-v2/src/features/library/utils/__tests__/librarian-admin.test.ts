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

  // ── Report-specific action permissions ─────────────────────────────────────
  it('reports.condition requires reports or catalog', () => {
    expect(canPerformLibrarianAction(['circulation'], 'reports.condition')).toBe(false);
    expect(canPerformLibrarianAction(['reports'], 'reports.condition')).toBe(true);
    expect(canPerformLibrarianAction(['catalog'], 'reports.condition')).toBe(true);
  });

  it('reports.repair requires reports only', () => {
    expect(canPerformLibrarianAction(['catalog'], 'reports.repair')).toBe(false);
    expect(canPerformLibrarianAction(['circulation'], 'reports.repair')).toBe(false);
    expect(canPerformLibrarianAction(['reports'], 'reports.repair')).toBe(true);
  });

  it('reports.lost-item requires reports or circulation', () => {
    expect(canPerformLibrarianAction(['catalog'], 'reports.lost-item')).toBe(false);
    expect(canPerformLibrarianAction(['reports'], 'reports.lost-item')).toBe(true);
    expect(canPerformLibrarianAction(['circulation'], 'reports.lost-item')).toBe(true);
  });

  it('admin role receives all report-action permissions', () => {
    const perms = resolveLibrarianPermissions('admin');
    expect(canPerformLibrarianAction(perms, 'reports.condition')).toBe(true);
    expect(canPerformLibrarianAction(perms, 'reports.repair')).toBe(true);
    expect(canPerformLibrarianAction(perms, 'reports.lost-item')).toBe(true);
  });

  it('student role is denied all report actions', () => {
    const perms = resolveLibrarianPermissions('student');
    expect(canPerformLibrarianAction(perms, 'reports.condition')).toBe(false);
    expect(canPerformLibrarianAction(perms, 'reports.repair')).toBe(false);
    expect(canPerformLibrarianAction(perms, 'reports.lost-item')).toBe(false);
  });
});

describe('book-lifecycle', () => {
  it('blocks invalid transitions', () => {
    expect(isValidTransition('draft', 'withdrawn')).toBe(false);
    expect(isValidTransition('draft', 'published')).toBe(true);
  });
});
