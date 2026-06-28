'use client';

import React from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Star, Users, Clock, BookOpen } from 'lucide-react';
import { useCourseById } from '@/features/courses/hooks/useCourses';

export default function CourseDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data: course, isLoading, error } = useCourseById(id);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-red-600 text-lg">{error ? (error as Error).message : 'Course not found.'}</p>
        <Link href="/courses" className="text-indigo-600 hover:underline flex items-center gap-1">
          <ArrowLeft className="w-4 h-4" /> Back to courses
        </Link>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      {/* Back link */}
      <Link href="/courses" className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Courses
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main content */}
        <div className="lg:col-span-2 space-y-6">
          {course.thumbnailUrl && (
            <img
              src={course.thumbnailUrl}
              alt={course.title}
              className="w-full h-56 object-cover rounded-xl"
            />
          )}

          <div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{course.title}</h1>
            {course.instructor && (
              <p className="text-sm text-gray-500 mb-4">By {course.instructor}</p>
            )}
            <div className="flex flex-wrap gap-3 mb-4">
              {course.level && (
                <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full">
                  {course.level}
                </span>
              )}
              {course.category && (
                <span className="px-3 py-1 bg-purple-50 text-purple-700 text-xs font-semibold rounded-full">
                  {course.category}
                </span>
              )}
              {course.rating != null && (
                <span className="flex items-center gap-1 px-3 py-1 bg-yellow-50 text-yellow-700 text-xs font-semibold rounded-full">
                  <Star className="w-3 h-3" />
                  {course.rating.toFixed(1)}
                </span>
              )}
              {course.studentCount != null && (
                <span className="flex items-center gap-1 px-3 py-1 bg-gray-100 text-gray-700 text-xs font-semibold rounded-full">
                  <Users className="w-3 h-3" />
                  {course.studentCount.toLocaleString()} students
                </span>
              )}
            </div>
            {course.description && (
              <p className="text-gray-700 leading-relaxed">{course.description}</p>
            )}
          </div>

          {/* Course includes */}
          <div className="border border-gray-200 rounded-xl p-5">
            <h2 className="font-semibold text-gray-900 mb-3">This course includes</h2>
            <ul className="space-y-2 text-sm text-gray-700">
              <li className="flex items-center gap-2"><BookOpen className="w-4 h-4 text-indigo-500" /> Full lifetime access</li>
              <li className="flex items-center gap-2"><Clock className="w-4 h-4 text-indigo-500" /> Learn at your own pace</li>
              <li className="flex items-center gap-2"><Star className="w-4 h-4 text-indigo-500" /> Certificate of completion (NFT)</li>
            </ul>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1">
          <div className="sticky top-6 border border-gray-200 rounded-xl p-6 bg-white shadow-sm">
            <p className="text-3xl font-bold text-gray-900 mb-1">
              {course.price === 0 ? 'Free' : `$${course.price}`}
            </p>
            <button className="w-full mt-4 py-3 px-6 bg-indigo-600 hover:bg-indigo-700 text-white font-semibold rounded-lg transition">
              {course.price === 0 ? 'Enroll for Free' : 'Enroll Now'}
            </button>
            <p className="text-center text-xs text-gray-400 mt-2">30-day money-back guarantee</p>
          </div>
        </div>
      </div>
    </div>
  );
}
