'use client';

import React from 'react';
import { Star } from 'lucide-react';
import { EmptyState } from '@/shared/components/ui/EmptyState';
import Link from 'next/link';

interface CourseItem {
  id: string;
  title: string;
  instructor?: string;
  category?: string;
  level?: string;
  price?: number;
  rating?: number;
  students?: number;
  image?: string;
}

interface CourseListProps {
  courses: CourseItem[];
}

export const CourseList: React.FC<CourseListProps> = ({ courses }) => {
  if (courses.length === 0) {
    return (
      <EmptyState
        title="No courses found"
        description="Try adjusting your filters."
      />
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {courses.map((course) => (
        <Link
          key={course.id}
          href={`/courses/${course.id}`}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-md transition block"
        >
          <div className="h-40 bg-gradient-to-br from-blue-400 to-indigo-600 flex items-center justify-center">
            <span className="text-white text-sm font-semibold">{course.category}</span>
          </div>

          <div className="p-5 space-y-3">
            <div className="flex items-center justify-between">
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${
                course.level === 'Beginner'
                  ? 'bg-green-100 text-green-700'
                  : course.level === 'Intermediate'
                    ? 'bg-blue-100 text-blue-700'
                    : 'bg-purple-100 text-purple-700'
              }`}>
                {course.level}
              </span>
              <span className="text-lg font-bold text-indigo-600">
                {(course.price ?? 0) > 0 ? `$${(course.price as number).toFixed(2)}` : 'Free'}
              </span>
            </div>

            <h3 className="text-base font-bold text-gray-900 line-clamp-2">{course.title}</h3>
            <p className="text-xs text-gray-600">By {course.instructor}</p>

            <div className="flex items-center justify-between pt-3 border-t border-gray-100">
              <div className="flex items-center gap-1">
                <Star size={14} className="fill-yellow-400 text-yellow-400" />
                <span className="text-sm font-semibold text-gray-700">{course.rating ?? 0}</span>
              </div>
              <span className="text-xs text-gray-500">{course.students} students</span>
            </div>
          </div>
        </Link>
      ))}
    </div>
  );
};
