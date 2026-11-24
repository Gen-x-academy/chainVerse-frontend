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

const PROJECT_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    href: '/projects/[projectId]/timeline',
    label: 'Timeline',
    permission: 'projects.timeline.read',
    description: 'Project timeline and roadmap',
  },
  {
    href: '/projects/[projectId]/workspace',
    label: 'Workspace',
    permission: 'projects.workspace.read',
    description: 'Project collaboration workspace',
  },
  {
    href: '/projects/[projectId]/resources',
    label: 'Resources',
    permission: 'projects.resources.read',
    description: 'Project resource library',
  },
  {
    href: '/projects/[projectId]/consent',
    label: 'Consent',
    permission: 'projects.consent.read',
    description: 'Purpose-specific capstone consent ledger',
  },
  {
    href: '/projects/[projectId]/privacy',
    label: 'Privacy',
    permission: 'projects.privacy.read',
    description: 'Project field-level privacy controls',
  },
  {
    href: '/projects/[projectId]/secrets',
    label: 'Secrets',
    permission: 'projects.secrets.read',
    description: 'Project secrets and sensitive-field protection',
  },
];

const WORKSPACE_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    href: '/projects/dashboard',
    label: 'Participant Dashboard',
    permission: 'projects.dashboard.read',
    description: 'Centralized participant project and operational dashboard',
  },
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
  {
    href: '/workspace/reviews/blinded',
    label: 'Blinded Reviews',
    permission: 'workspace.reviews.blinded.read',
    description: 'Reviews with participant and reviewer identities hidden',
  },
  {
    href: '/workspace/rubrics',
    label: 'Review Rubrics',
    permission: 'workspace.rubrics.read',
    description: 'Versioned review criteria, weights, and aggregation rules',
  },
  {
    href: '/workspace/projects/:projectId/notes',
    label: 'Collaborative Notes',
    permission: 'workspace.notes.read',
    description: 'Shared project notes with revision history',
  },
  {
    href: '/workspace/projects/:projectId/activity',
    label: 'Activity',
    permission: 'workspace.activity.read',
    description: 'Permission-filtered project activity feed',
  },
];

const INTEGRITY_NAV_ITEMS: WorkspaceNavItem[] = [
  {
    href: '/integrity/originality',
    label: 'Originality',
    permission: 'integrity:checks:read',
    description: 'Consent-aware similarity and citation checks',
  },
  {
    href: '/integrity/screening',
    label: 'Ethics Screening',
    permission: 'integrity:screening:read',
    description: 'Research ethics approval pathways',
  },
  {
    href: '/integrity/reports',
    label: 'Concerns',
    permission: 'integrity:reports:read',
    description: 'Report and triage integrity concerns',
  },
  {
    href: '/integrity/disputes',
    label: 'Disputes',
    permission: 'integrity:disputes:read',
    description: 'Claims, appeals and remedies',
  },
];

function isActivePath(pathname: string | null, href: string): boolean {
  if (!pathname) return false;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function resolveHref(href: string, pathname: string | null): string {
  if (!href.includes('[projectId]')) return href;
  const match = pathname?.match(/^\/projects\/([^/]+)/);
  const projectId = match?.[1];
  if (!projectId) return href;
  return href.replace('[projectId]', projectId);
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

  const visibleProjectItems = PROJECT_NAV_ITEMS.filter((item) => can(item.permission));
  const visibleItems = WORKSPACE_NAV_ITEMS.filter((item) => can(item.permission));

  return (
    <>
      <Header />
      <main className="min-h-screen">
        {(visibleProjectItems.length > 0 || visibleItems.length > 0) && (
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
                  {visibleProjectItems.map((item) => {
                    const href = resolveHref(item.href, pathname);
                    const active = isActivePath(pathname, href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={href}
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
                {visibleProjectItems.map((item) => {
                  const href = resolveHref(item.href, pathname);
                  const active = isActivePath(pathname, href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={href}
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