'use client';

import React from 'react';
import { LibrarianNav, type LibrarianPermission } from '@/components/elibrary/LibrarianNav';
import { cn } from '@/lib/utils';

export interface LibrarianPageShellProps {
  permissions: LibrarianPermission[];
  activeHref: string;
  title: string;
  description?: string;
  allowed?: boolean;
  children: React.ReactNode;
  className?: string;
}

export function LibrarianPageShell({
  permissions,
  activeHref,
  title,
  description,
  allowed = true,
  children,
  className,
}: LibrarianPageShellProps) {
  if (!allowed) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-gray-900">Access denied</h1>
          <p className="text-gray-600 mt-2">
            You do not have librarian permissions for this section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row gap-8">
        <aside className="md:w-48 shrink-0">
          <LibrarianNav permissions={permissions} activeHref={activeHref} />
        </aside>
        <main className={cn('flex-1 min-w-0', className)}>
          <header className="mb-6">
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
            {description && <p className="text-gray-600 mt-1">{description}</p>}
          </header>
          {children}
        </main>
      </div>
    </div>
  );
}
