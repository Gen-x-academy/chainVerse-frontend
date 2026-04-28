'use client';

import React, { useEffect, useState } from 'react';
import { BookOpen, Clock, Trophy, TrendingUp } from 'lucide-react';
import { UserActivityChart } from '../components/UserActivityChart';
import { studentService } from '../services/student.service';
import { useSession } from '@/src/features/auth/hooks/useSession';
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
  const { token } = useSession();
  const [student, setStudent] = useState<Student | null>(null);
  const [enrollments, setEnrollments] = useState<EnrollmentRecord[]>([]);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    setIsLoading(true);
    // Fetch student profile and enrollments in parallel
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
      .catch(() => {/* silently degrade */})
      .finally(() => setIsLoading(false));
  }, [token]);

  const statItems = stats
    ? [
        { label: 'Courses Enrolled', value: String(stats.coursesEnrolled) },
        { label: 'Learning Hours', value: String(stats.learningHours) },
        { label: 'Certificates Earned', value: String(stats.certificatesEarned) },
        { label: 'Avg. Rating', value: String(stats.avgRating) },
      ]
    : [];

  const firstName = student?.firstName ?? 'there';

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Welcome Banner */}
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl p-8 mb-8">
          <h1 className="text-3xl font-bold mb-2">Welcome back, {firstName}! 👋</h1>
          <p className="text-blue-100">
            You&apos;re making great progress! Keep up the momentum and complete your courses.
          </p>
        </div>

        {/* Stats Grid */}
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
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-gray-600 text-sm font-medium mb-1">{stat.label}</p>
                      <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
                    </div>
                    <div className={`${STAT_COLORS[index]} p-3 rounded-lg`}>
                      <Icon size={24} />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-3">
            <UserActivityChart />
          </div>
        </div>
      </div>
    </div>
  );
};
