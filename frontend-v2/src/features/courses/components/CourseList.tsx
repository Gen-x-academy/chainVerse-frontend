'use client';

import React from 'react';
import { EmptyState } from '@/src/shared/components/ui/EmptyState';
import { CourseCard } from './courseCard';
import { BookOpen, Star } from 'lucide-react';
import type { Course } from '../types';

interface CourseListProps {
  courses: Course[];
  onClearFilters?: () => void;
}

export const CourseList: React.FC<CourseListProps> = ({ courses, onClearFilters }) => {
  if (courses.length === 0) {
    return (
      <div className="col-span-full flex flex-col items-center justify-center py-16 gap-4">
        <BookOpen size={48} className="text-gray-300" />
        <p className="text-gray-500 text-lg font-medium">No courses match your filters</p>
        {onClearFilters && (
          <button
            type="button"
            onClick={onClearFilters}
            className="text-indigo-600 hover:underline text-sm"
          >
            Clear all filters
          </button>
        )}
      </div>
    );
  }

  return (
    <section aria-label="Course listings">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
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
              <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${getLevelBadgeClass(course.level)}`}>
                {formatLevel(course.level)}
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
    </section>
  );
};