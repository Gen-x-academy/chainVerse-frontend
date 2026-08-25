'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { UserActivityChart } from '../components/UserActivityChart';
import { WelcomeBanner } from '../components/WelcomeBanner';
import { StudentStatsGrid } from '../components/StudentStatsGrid';
import { EnrolledCoursesList } from '../components/EnrolledCoursesList';
import { studentService } from '../services/student.service';
import { useAuthStore } from '@/src/store/authStore';
import type { Student, EnrollmentRecord } from '../types/students.types';

export const StudentDashboardPage: React.FC = () => {
  const authUser = useAuthStore((state) => state.user);
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
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
      })
      .catch(() => {})
      .finally(() => setIsLoading(false));
  }, [authUser]);

  const firstName = authUser?.firstName ?? 'there';

  const stats = student
    ? [
        { label: 'Courses Enrolled', value: String(student.courseIds.length) },
        { label: 'Learning Hours', value: '0' },
        { label: 'Certificates Earned', value: '0' },
        { label: 'Avg. Rating', value: '0' },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Suspense fallback={<div className="h-32 bg-gray-200 rounded-xl animate-pulse mb-8" />}>
          <WelcomeBanner firstName={firstName} />
          <StudentStatsGrid stats={stats} isLoading={isLoading} />
        </Suspense>

        <EnrolledCoursesList enrollments={enrollments} />

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
