'use client';

import React from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { BookOpen, Clock, AlertTriangle, Settings, History, Lock } from 'lucide-react';
import { SectionContainer } from '@/src/shared/components/layout/SectionContainer';
import { useAuthStore } from '@/src/store/authStore';
import { LoanActivityPanel } from '@/src/features/library/components/LoanActivityPanel';
import { AccountOverviewPanel } from '@/src/features/library/components/account/AccountOverviewPanel';
import { CurrentLoansTab } from '@/src/features/library/components/account/CurrentLoansTab';
import { ActiveHoldsTab } from '@/src/features/library/components/account/ActiveHoldsTab';
import { FinesTab } from '@/src/features/library/components/account/FinesTab';
import { SettingsTab } from '@/src/features/library/components/account/SettingsTab';
import type { PatronAccountTab } from '@/src/features/library/types/account.types';

const TAB_LINKS: { tab: PatronAccountTab; href: string; label: string; icon: React.ElementType }[] = [
  { tab: 'overview', href: '/library/account', label: 'Overview', icon: BookOpen },
  { tab: 'loans', href: '/library/account?tab=loans', label: 'Current Loans', icon: BookOpen },
  { tab: 'holds', href: '/library/account?tab=holds', label: 'Active Holds', icon: Clock },
  { tab: 'fines', href: '/library/account?tab=fines', label: 'Fines & Fees', icon: AlertTriangle },
  { tab: 'activity', href: '/library/account?tab=activity', label: 'Loan History', icon: History },
  { tab: 'settings', href: '/library/account?tab=settings', label: 'Preferences', icon: Settings },
];

export default function LibraryAccountPage() {
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const user = useAuthStore((state) => state.user);
  const searchParams = useSearchParams();
  const tab = (searchParams.get('tab') as PatronAccountTab | null) ?? 'overview';
  const name = user?.firstName ?? 'there';
  const patronId = isAuthenticated ? user?.id : undefined;

  return (
    <SectionContainer className="py-12">
      <h1 className="mb-2 text-3xl font-bold text-gray-900">My Library Account</h1>
      <p className="mb-8 text-gray-600">Welcome back, {name}. Here&apos;s your library overview.</p>

      {!isAuthenticated ? (
        <div className="rounded-lg border border-gray-200 bg-white p-10 text-center" role="status">
          <Lock className="mx-auto mb-3 h-10 w-10 text-gray-300" aria-hidden="true" />
          <h2 className="font-semibold text-gray-900">Sign in required</h2>
          <p className="mt-2 text-sm text-gray-500">
            Your loans, holds, fines, and preferences are shown after you sign in.
          </p>
          <Link
            href="/auth/login"
            className="mt-5 inline-block rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
          >
            Sign in
          </Link>
        </div>
      ) : (
        <>
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
                {TAB_LINKS.filter((l) => l.tab !== 'overview' && l.tab !== 'activity').map(
                  ({ tab: t, href, label, icon: Icon }) => (
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
                  )
                )}
              </div>
              <AccountOverviewPanel patronId={patronId} />
            </>
          )}

          {tab === 'loans' && <CurrentLoansTab patronId={patronId} />}

          {tab === 'holds' && <ActiveHoldsTab patronId={patronId} />}

          {tab === 'fines' && <FinesTab patronId={patronId} />}

          {tab === 'settings' && <SettingsTab patronId={patronId} />}

          {tab === 'activity' && (
            <div className="rounded-lg border border-gray-200 bg-white p-6">
              <LoanActivityPanel />
            </div>
          )}
        </>
      )}
    </SectionContainer>
  );
}