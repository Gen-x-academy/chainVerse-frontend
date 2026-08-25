'use client';

import React from 'react';
import { BookOpen } from 'lucide-react';
import type { EnrollmentRecord } from '../types/students.types';

interface EnrolledCoursesListProps {
  enrollments: EnrollmentRecord[];
}

export function EnrolledCoursesList({ enrollments }: EnrolledCoursesListProps) {
  if (enrollments.length === 0) return null;

  return (
    <section aria-labelledby="course-progress-heading" className="bg-white rounded-lg shadow-sm border border-gray-100 p-6 mb-8">
      <h2 id="course-progress-heading" className="text-lg font-semibold text-gray-900 mb-4">
        Enrolled Courses
      </h2>
      <ul className="space-y-4" aria-label="Enrolled course cards">
        {enrollments.map((enrollment) => (
          <li key={enrollment.courseId} className="flex gap-4 items-start">
            <div className="w-16 h-16 sm:w-24 sm:h-24 rounded-lg flex-shrink-0 bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center">
              <BookOpen className="w-8 h-8 sm:w-12 sm:h-12 text-white" aria-hidden="true" />
            </div>
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
          </li>
        ))}
      </ul>
    </section>
  );
}
