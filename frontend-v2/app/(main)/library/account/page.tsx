'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Clock, AlertTriangle, Settings, History } from 'lucide-react';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';
import { useAuthStore } from '@/src/store/authStore';
import { LoanActivityPanel } from '@/src/features/library/components/LoanActivityPanel';

type AccountTab = 'overview' | 'loans' | 'holds' | 'fines' | 'settings' | 'activity';

const TAB_LINKS: { tab: AccountTab; href: string; label: string; icon: React.ElementType }[] = [
  { tab: 'overview', href: '/library/account', label: 'Overview', icon: BookOpen },
  { tab: 'loans', href: '/library/account?tab=loans', label: 'Current Loans', icon: BookOpen },
  { tab: 'holds', href: '/library/account?tab=holds', label: 'Active Holds', icon: Clock },
  { tab: 'fines', href: '/library/account?tab=fines', label: 'Fines & Fees', icon: AlertTriangle },
  { tab: 'activity', href: '/library/account?tab=activity', label: 'Loan History', icon: History },
  { tab: 'settings', href: '/library/account?tab=settings', label: 'Preferences', icon: Settings },
];

function OverviewPanel() {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h2 className="mb-4 text-lg font-semibold text-gray-900">Account Summary</h2>
      <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div>
          <dt className="text-sm text-gray-500">Active Loans</dt>
          <dd className="text-2xl font-bold text-gray-900">0</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Pending Holds</dt>
          <dd className="text-2xl font-bold text-gray-900">0</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Total Checkouts</dt>
          <dd className="text-2xl font-bold text-gray-900">0</dd>
        </div>
        <div>
          <dt className="text-sm text-gray-500">Outstanding Fines</dt>
          <dd className="text-2xl font-bold text-gray-900">$0.00</dd>
        </div>
      </dl>
    </div>
  );
}

function PlaceholderPanel({ title, description }: { title: string; description: string }) {
  return (
    <div className="rounded-lg border border-gray-200 bg-white p-8 text-center" role="status">
      <p className="font-medium text-gray-900">{title}</p>
      <p className="mt-2 text-sm text-gray-500">{description}</p>
    </div>
  );
}

export default function LibraryAccountPage() {
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as AccountTab | null) ?? 'overview';
  const name = user?.firstName ?? 'there';

  return (
    <SectionContainer className="py-12">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">My Library Account</h1>
      <p className="mb-8 text-gray-600">Welcome back, {name}. Here&apos;s your library overview.</p>

      <nav className="mb-8 flex flex-wrap gap-2" aria-label="Account sections">
        {TAB_LINKS.map(({ tab: t, href, label }) => (
          <Link
            key={t}
            href={href}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${
              tab === t
                ? 'bg-indigo-600 text-white'
                : 'bg-white border border-gray-200 text-gray-700 hover:bg-gray-50'
            }`}
            aria-current={tab === t ? 'page' : undefined}
          >
            {label}
          </Link>
        ))}
      </nav>

      {tab === 'overview' && (
        <>
          <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
            {TAB_LINKS.filter((l) => l.tab !== 'overview').map(({ tab: t, href, label, icon: Icon }) => (
              <Link
                key={t}
                href={href}
                className="group rounded-lg border border-gray-200 bg-white p-6 transition hover:shadow-md"
              >
                <Icon className="mb-3 h-8 w-8 text-indigo-600" aria-hidden="true" />
                <h3 className="font-semibold text-gray-900 transition group-hover:text-indigo-600">
                  {label}
                </h3>
              </Link>
            ))}
          </div>
          <OverviewPanel />
        </>
      )}

      {tab === 'loans' && (
        <PlaceholderPanel
          title="Current Loans"
          description="Active loans and renewal controls will appear here."
        />
      )}

      {tab === 'holds' && (
        <PlaceholderPanel
          title="Active Holds"
          description="Your hold queue and pickup notices will appear here."
        />
      )}

      {tab === 'fines' && (
        <PlaceholderPanel
          title="Fines & Fees"
          description="Outstanding balances and payment options will appear here."
        />
      )}

      {tab === 'settings' && (
        <PlaceholderPanel
          title="Preferences"
          description="Notification and auto-renewal settings will appear here."
        />
      )}

      {tab === 'activity' && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <LoanActivityPanel />
        </div>
      )}
    </SectionContainer>
  );
}
