'use client';

import React from 'react';
import Link from 'next/link';
import { BookOpen, Clock, AlertTriangle, Settings } from 'lucide-react';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';
import { useAuthStore } from '@/src/store/authStore';

export default function LibraryAccountPage() {
  const user = useAuthStore((state) => state.user);
  const name = user?.firstName ?? 'there';

  return (
    <SectionContainer className="py-12">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">My Library Account</h1>
      <p className="text-gray-600 mb-8">Welcome back, {name}. Here&apos;s your library overview.</p>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
        <Link
          href="/library/account?tab=loans"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition group"
        >
          <BookOpen className="w-8 h-8 text-indigo-600 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">Current Loans</h3>
          <p className="text-sm text-gray-500 mt-1">View and manage your borrowed items</p>
        </Link>

        <Link
          href="/library/account?tab=holds"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition group"
        >
          <Clock className="w-8 h-8 text-orange-500 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">Active Holds</h3>
          <p className="text-sm text-gray-500 mt-1">Check hold queue status and pickups</p>
        </Link>

        <Link
          href="/library/account?tab=fines"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition group"
        >
          <AlertTriangle className="w-8 h-8 text-red-500 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">Fines &amp; Fees</h3>
          <p className="text-sm text-gray-500 mt-1">Review outstanding balances</p>
        </Link>

        <Link
          href="/library/account?tab=settings"
          className="bg-white border border-gray-200 rounded-lg p-6 hover:shadow-md transition group"
        >
          <Settings className="w-8 h-8 text-gray-500 mb-3" />
          <h3 className="font-semibold text-gray-900 group-hover:text-indigo-600 transition">Preferences</h3>
          <p className="text-sm text-gray-500 mt-1">Notification and renewal settings</p>
        </Link>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Account Summary</h2>
        <dl className="grid grid-cols-2 sm:grid-cols-4 gap-4">
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
    </SectionContainer>
  );
}
