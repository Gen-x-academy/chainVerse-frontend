'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { BookOpen, Clock, Trophy, TrendingUp } from 'lucide-react';
import { UserActivityChart } from '../components/UserActivityChart';
import { studentService } from '../services/student.service';
import { useAuthStore } from '@/src/store/authStore';
import type { Student, EnrollmentRecord } from '../types/students.types';

interface DashboardStats {
  coursesEnrolled: number;
  learningHours: number;
  certificatesEarned: number;
  avgRating: number;
}

const STAT_ICONS = [BookOpen, Clock, Trophy, TrendingUp];
const STAT_COLORS = [
  'bg-blue-100 text-blue-600',
  'bg-orange-100 text-orange-600',
  'bg-green-100 text-green-600',
  'bg-purple-100 text-purple-600',
];

export const StudentDashboardPage: React.FC = () => {
  const authUser = useAuthStore((state) => state.user);
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authUser) return;
    setIsLoading(true);
    Promise.all([
      studentService.list(1, 1),
    ])
      .then(([res]) => {
        const me = res.data[0] ?? null;
        setStudent(me);
        if (me) {
          setStats({
            coursesEnrolled: me.courseIds.length,
            learningHours: 0,
            certificatesEarned: 0,
            avgRating: 0,
          });
        }
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [authUser]);

  const statItems = stats
    ? [
        { label: 'Courses Enrolled', value: String(stats.coursesEnrolled) },
        { label: 'Learning Hours', value: String(stats.learningHours) },
        { label: 'Certificates Earned', value: String(stats.certificatesEarned) },
        { label: 'Avg. Rating', value: String(stats.avgRating) },
      ]
    : [];

  const firstName = authUser?.firstName ?? 'there';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={<div className="h-32 bg-gray-200 rounded-xl animate-pulse mb-8" />}>
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-8 mb-8">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold mb-2">Welcome back, {firstName}!</h1>
            <p className="text-blue-100">
              You&apos;re making great progress! Keep up the momentum and complete your courses.
            </p>
          </div>

          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-28 bg-gray-200 rounded-lg animate-pulse" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              {statItems.map((stat, index) => {
                const Icon = STAT_ICONS[index];
                return (
                  <div
                    key={index}
                    className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 hover:shadow-md transition"
                  >
                    <div className="flex items-center justify-between flex-wrap gap-2">
                      <div>
                        <p className="text-gray-600 text-sm font-medium mb-1">{stat.label}</p>
                        <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                      </div>
                      <div className={`${STAT_COLORS[index]} p-3 rounded-lg flex-shrink-0`}>
                        <Icon size={24} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Suspense>

        {enrollments.length > 0 && (
          <section aria-labelledby="course-progress-heading" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-8">
            <Suspense fallback={<div className="h-48 bg-gray-200 rounded-lg animate-pulse" />}>
              <h2 id="course-progress-heading" className="text-lg font-semibold text-gray-900 mb-4">
                Enrolled Courses
              </h2>
              <ul className="space-y-4" aria-label="Enrolled course cards">
                {enrollments.map((enrollment) => (
                  <li key={enrollment.courseId}>
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-sm font-medium text-gray-700">{enrollment.courseId}</span>
                      <span className="text-sm text-gray-500" aria-hidden="true">{enrollment.progress}%</span>
                    </div>
                    <div
                      role="progressbar"
                      aria-valuenow={enrollment.progress}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-label={`${enrollment.courseId} — ${enrollment.progress}% complete`}
                      className="w-full bg-gray-200 rounded-full h-2"
                    >
                      <div
                        className="bg-indigo-600 h-2 rounded-full"
                        style={{ width: `${enrollment.progress}%` }}
                      />
                    {/* Issue #706: Responsive course card with proper image sizing and text truncation */}
                    <div className="flex gap-4 items-start">
                      {/* Responsive image: smaller on mobile, normal on sm+ */}
                      <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-lg flex-shrink-0 bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
                        <BookOpen className="w-8 h-8 sm:w-12 sm:h-12 text-white" aria-hidden="true" />
                      </div>
                      {/* Content area: min-w-0 allows text to truncate properly on narrow screens */}
                      <div className="flex-1 min-w-0 space-y-2">
                        <div className="flex justify-between items-center gap-2">
                          <h3 className="text-sm sm:text-base font-semibold text-gray-900 truncate">
                            {enrollment.courseId}
                          </h3>
                          <span className="text-sm text-gray-500 flex-shrink-0" aria-hidden="true">
                            {enrollment.progress}%
                          </span>
                        </div>
                        <div
                          role="progressbar"
                          aria-valuenow={enrollment.progress}
                          aria-valuemin={0}
                          aria-valuemax={100}
                          aria-label={`${enrollment.courseId} progress`}
                          className="w-full bg-gray-200 rounded-full h-2 overflow-hidden"
                        >
                          <div
                            className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                            style={{ width: `${enrollment.progress}%` }}
                          />
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </Suspense>
          </section>
        )}

        <Suspense fallback={<div className="h-64 bg-gray-200 rounded-lg animate-pulse" />}>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-3">
              <UserActivityChart />
            </div>
          </div>
        </Suspense>
      </div>
    </div>
  );
};
