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
          <div key={course.id} className="relative">
            <a href={`/courses/${course.id}`} className="block">
              <CourseCard
                id={course.id}
                title={course.title}
                rating={course.rating}
                description={course.description}
                instructor={course.instructor}
                level={course.level}
                price={course.price}
                image={course.image}
                category={course.category}
                accessibility={course.accessibility}
              />
            </a>
          </div>
        ))}
      </div>
    </section>
  );
};