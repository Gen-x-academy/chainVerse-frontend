import type { LibrarianPermission } from '@/components/elibrary/LibrarianNav';

export type LibrarianAction =
  | 'book.create'
  | 'book.edit'
  | 'book.status'
  | 'book.isbn-import'
  | 'reports.condition'
  | 'reports.repair'
  | 'reports.lost-item';

const ACTION_PERMISSIONS: Record<LibrarianAction, LibrarianPermission[]> = {
  'book.create': ['catalog', 'acquisitions'],
  'book.edit': ['catalog'],
  'book.status': ['catalog'],
  'book.isbn-import': ['acquisitions', 'catalog'],
  // Condition reports require the reports section plus catalog (item metadata access)
  'reports.condition': ['reports', 'catalog'],
  // Repair tracking is a reports-only action
  'reports.repair': ['reports'],
  // Resolving lost items touches circulation records in addition to reports
  'reports.lost-item': ['reports', 'circulation'],
};

/** Admin users receive full librarian access until a dedicated librarian role exists. */
export function resolveLibrarianPermissions(role: string): LibrarianPermission[] {
  if (role === 'admin') {
    return ['catalog', 'circulation', 'patrons', 'acquisitions', 'reports', 'configuration', 'audits'];
  }
  return [];
}

export function canPerformLibrarianAction(
  permissions: LibrarianPermission[],
  action: LibrarianAction,
): boolean {
  const required = ACTION_PERMISSIONS[action];
  return required.some((p) => permissions.includes(p));
}
