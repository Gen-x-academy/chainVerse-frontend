'use client';

import React from 'react';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import { cn } from '@/lib/utils';

export interface ScholarshipNavItem {
  href: string;
  label: string;
}

export interface ScholarshipPageShellProps {
  /** UX guard — the API enforces grants regardless (ADR-001). */
  allowed: boolean;
  title: string;
  description?: string;
  activeHref: string;
  navItems: ScholarshipNavItem[];
  children: React.ReactNode;
  className?: string;
}

export function ScholarshipPageShell({
  allowed,
  title,
  description,
  activeHref,
  navItems,
  children,
  className,
}: ScholarshipPageShellProps) {
  if (!allowed) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center bg-gray-50 px-4">
        <div className="max-w-md text-center" role="alert">
          <GraduationCap className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-gray-900">Access denied</h1>
          <p className="mt-2 text-gray-600">
            You do not have permission to view this scholarships section.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col gap-8 md:flex-row">
      <aside className="md:w-56 shrink-0">
        <nav aria-label="Scholarship sections" className="space-y-1">
          {navItems.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              aria-current={activeHref === item.href ? 'page' : undefined}
              className={cn(
                'block rounded-lg px-4 py-2 text-sm font-medium transition',
                activeHref === item.href
                  ? 'bg-indigo-600 text-white'
                  : 'border border-gray-200 bg-white text-gray-700 hover:bg-gray-50'
              )}
            >
              {item.label}
            </Link>
          ))}
        </nav>
      </aside>
      <main className={cn('min-w-0 flex-1', className)}>
        <header className="mb-6">
          <h1 className="text-2xl md:text-3xl font-bold text-gray-900">{title}</h1>
          {description && <p className="mt-1 text-gray-600">{description}</p>}
        </header>
        {children}
      </main>
    </div>
  );
}