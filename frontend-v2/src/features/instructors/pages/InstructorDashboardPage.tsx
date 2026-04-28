'use client';

import React, { Suspense } from 'react';
import Link from 'next/link';
import { AnalyticsCards } from '../components/AnalyticsCards';
import { RevenueChart } from '../components/RevenueChart';
import { CourseTable } from '../components/CourseTable';
import { SectionContainer } from '@/shared/components/layout/SectionContainer';

function SectionFallback({ rows = 3 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="h-10 bg-gray-200 rounded-lg" />
      ))}
    </div>
  );
}

/** Fixes #346 — Suspense boundaries around each async section enable streaming. */
export function InstructorDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <SectionContainer className="py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Instructor Dashboard
            </h1>
            <p className="text-gray-600 mt-2">
              Welcome back! Here&apos;s your teaching performance overview.
            </p>
          </div>
          <Link
            href="/instructors/courses/create"
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            Create New Course
          </Link>
        </div>

        {/* Stats Cards */}
        <div className="mb-8">
          <Suspense fallback={<SectionFallback rows={4} />}>
            <AnalyticsCards />
          </Suspense>
        </div>

        {/* Revenue Chart */}
        <div className="mb-8">
          <Suspense fallback={<SectionFallback rows={6} />}>
            <RevenueChart />
          </Suspense>
        </div>

        {/* Courses Table */}
        <Suspense fallback={<SectionFallback rows={5} />}>
          <CourseTable />
        </Suspense>
      </SectionContainer>
    </div>
  );
}
