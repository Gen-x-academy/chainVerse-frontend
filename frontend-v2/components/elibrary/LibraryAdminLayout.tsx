'use client';

import { LibrarianNav } from '@/components/elibrary/LibrarianNav';
import {
  hasLibrarianPermission,
  useLibrarianPermissions,
} from '@/src/features/library/hooks/useLibrarianPermissions';
import type { LibrarianPermission } from '@/components/elibrary/LibrarianNav';

interface LibraryAdminLayoutProps {
  children: React.ReactNode;
  requiredPermission?: LibrarianPermission;
  activeHref?: string;
}

/** Shared layout for librarian admin sections with permission guard */
export function LibraryAdminLayout({
  children,
  requiredPermission,
  activeHref,
}: LibraryAdminLayoutProps) {
  const permissions = useLibrarianPermissions();

  if (permissions.length === 0) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div role="alert" className="rounded-md border p-6 text-center">
          <h1 className="text-lg font-semibold mb-2">Access denied</h1>
          <p className="text-sm text-muted-foreground">
            You do not have librarian permissions to view this section.
          </p>
        </div>
      </div>
    );
  }

  if (requiredPermission && !hasLibrarianPermission(permissions, requiredPermission)) {
    return (
      <div className="max-w-3xl mx-auto py-12 px-4">
        <div role="alert" className="rounded-md border p-6 text-center">
          <h1 className="text-lg font-semibold mb-2">Insufficient permissions</h1>
          <p className="text-sm text-muted-foreground">
            Your role does not include access to this library section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      <div className="max-w-[1400px] mx-auto flex flex-col lg:flex-row gap-6 p-4 sm:p-6 lg:p-8">
        <aside className="lg:w-56 shrink-0">
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3 px-3">
            Library Admin
          </h2>
          <LibrarianNav permissions={permissions} activeHref={activeHref} />
        </aside>
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
