'use client';

import React from 'react';
import { AnalyticsCards } from '../components/AnalyticsCards';
import { RevenueChart } from '../components/RevenueChart';
import { CourseTable } from '../components/CourseTable';

export function InstructorDashboardPage() {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Instructor Dashboard</h1>
            <p className="text-gray-600 mt-2">Welcome back! Here&apos;s your teaching performance overview.</p>
          </div>
          <a
            href="/instructors/courses/create"
            className="px-4 py-2 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition"
          >
            Create New Course
          </a>
        </div>

        {/* Stats Cards */}
        <div className="mb-8">
          <AnalyticsCards />
        </div>

        {/* Revenue Chart */}
        <div className="mb-8">
          <RevenueChart />
        </div>

        {/* Courses Table */}
        <CourseTable />
      </div>
    </div>
  );
}
