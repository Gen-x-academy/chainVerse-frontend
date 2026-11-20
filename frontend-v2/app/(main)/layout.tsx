'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useId, useState } from 'react';
import { Header } from '@/src/components/common/Header';
import { Footer } from '@/src/components/common/Footer';
import { useSession } from '@/src/hooks/useSession';
import { useIntegritySession, type IntegrityCapability } from '@/src/features/capstone/integrity/useIntegritySession';

type WorkspaceNavItem = {
  href: string;
  label: string;
  permission: string;
  description: string;
};

const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    href: '/workspace/decisions',
    label: 'Decisions',
    permission: 'workspace.decisions.read',
    description: 'Record and review project decisions',
  },
  {
    href: '/workspace/source-control',
    label: 'Source Control',
    permission: 'workspace.sourceControl.read',
    description: 'Linked repositories, branches, commits, and releases',
  },
  {
    href: '/workspace/review-queue',
    label: 'Review Queue',
    permission: 'workspace.reviews.queue.read',
    description: 'Assigned proposal review queues',
  },
  {
    href: '/workspace/reviews',
    label: 'Reviews',
    permission: 'workspace.reviews.read',
    description: 'Independent proposal reviews',
  },
];

const INTEGRITY_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    href: '/integrity/originality',
    label: 'Originality',
    permission: 'integrity:checks:read',
    description: 'Consent-aware similarity and citation checks',
  },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const pathname = usePathname();
  const { can } = useSession();
  const { can: canIntegrity } = useIntegritySession();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuId = useId();
  const contentHeadingId = useId();

  const visibleItems = [...WORKSPACE_NAV_ITEMS, ...INTEGRITY_NAV_ITEMS].filter(
    (item) => can(item.permission) || canIntegrity(item.permission as IntegrityCapability),
  );

  return (
    <>
      <Header />
      <main className="min-h-screen">
        {visibleItems.length > 0 && (
          <nav
            aria-label="Workspace"
            className="border-b border-gray-200 bg-white"
          >
            <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
              {/* Mobile disclosure */}
              <div className="md:hidden">
                <button
                  type="button"
                  className="flex w-full items-center justify-between py-3 text-left text-sm font-medium text-gray-900 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  aria-expanded={isMenuOpen}
                  aria-controls={menuId}
                  onClick={() => setIsMenuOpen((open) => !open)}
                >
                  <span>Workspace</span>
                  <span aria-hidden="true">{isMenuOpen ? '−' : '+'}</span>
                </button>
                <ul
                  id={menuId}
                  hidden={!isMenuOpen}
                  className="space-y-1 pb-3"
                >
                  {visibleItems.map((item) => {
                    const active = isActivePath(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? 'page' : undefined}
                          aria-label={item.description}
                          className={`block rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                            active
                              ? 'bg-blue-50 font-semibold text-blue-700'
                              : 'text-gray-700 hover:bg-gray-50'
                          }`}
                          onClick={() => setIsMenuOpen(false)}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>

              {/* Desktop horizontal nav */}
              <ul className="hidden md:flex md:space-x-1 md:py-2">
                {visibleItems.map((item) => {
                  const active = isActivePath(pathname, item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        aria-current={active ? 'page' : undefined}
                        aria-label={item.description}
                        className={`inline-block rounded px-3 py-2 text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 ${
                          active
                            ? 'bg-blue-50 font-semibold text-blue-700'
                            : 'text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          </nav>
        )}
        <section aria-labelledby={contentHeadingId} className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 id={contentHeadingId} className="sr-only">
            Workspace content
          </h2>
          {children}
        </section>
      </main>
      <Footer />
    </>
  );
}