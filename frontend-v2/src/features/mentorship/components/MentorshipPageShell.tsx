'use client';

import React from 'react';
import Link from 'next/link';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface MentorshipNavItem {
  href: string;
  label: string;
}

export interface MentorshipPageShellProps {
  /** UX guard — the API enforces the same grant (MENTOR-003). */
  allowed: boolean;
  title: string;
  description?: string;
  activeHref: string;
  navItems: MentorshipNavItem[];
  children: React.ReactNode;
  className?: string;
}

export function MentorshipPageShell({
  allowed,
  title,
  description,
  activeHref,
  navItems,
  children,
  className,
}: MentorshipPageShellProps) {
  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center" role="alert">
          <Users className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-gray-600">
            You do not have permission to view this mentorship section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8 px-4 py-8 md:flex-row">
      <aside className="shrink-0 md:w-56">
        <nav aria-label="Mentorship sections" className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activeHref === item.href ? 'page' : undefined}
              className={cn(
                'block rounded-lg px-4 py-2 text-sm font-medium transition',
                activeHref === item.href
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50',
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className={cn('min-w-0 flex-1', className)}>
        <header className="mb-6">
          <h1 className="text-2xl font-bold text-gray-900 md:text-3xl">{title}</h1>
          {description && <p className="mt-1 text-gray-600">{description}</p>}
        </header>
        {children}
      </main>
    </div>
  );
}
