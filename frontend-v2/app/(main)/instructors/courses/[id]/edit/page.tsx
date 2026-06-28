'use client';

import React, { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { CourseForm, CourseFormData } from '@/features/instructors/components/CourseForm';
import { useCourseById, useUpdateCourse, useRemoveCourse } from '@/features/courses/hooks/useCourses';

export default function EditCoursePage() {
  const params = useParams();
  const router = useRouter();
  const courseId = params.id as string;
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const { data: course, isLoading, error } = useCourseById(courseId);
  const updateCourse = useUpdateCourse();
  const removeCourse = useRemoveCourse();

  const handleSubmit = async (data: CourseFormData) => {
    setToast(null);
    try {
      await updateCourse.mutateAsync({
        id: courseId,
        payload: { title: data.title, description: data.description, thumbnailUrl: data.thumbnailUrl, price: data.price },
      });
      setToast({ type: 'success', message: 'Course updated successfully!' });
      setTimeout(() => router.push('/instructors/dashboard'), 1500);
    } catch {
      setToast({ type: 'error', message: 'Failed to update course. Please try again.' });
    }
  };

  const handleDelete = async () => {
    try {
      await removeCourse.mutateAsync(courseId);
      router.push('/instructors/dashboard');
    } catch {
      setToast({ type: 'error', message: 'Failed to delete course.' });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !course) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <p className="text-red-600">{error ? (error as Error).message : 'Course not found.'}</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Edit Course</h1>
          <p className="text-gray-600 mt-2">Update your course details below.</p>
        </div>

        {toast && (
          <div className={`mb-6 px-4 py-3 rounded-lg text-sm font-medium ${
            toast.type === 'success'
              ? 'bg-green-50 border border-green-200 text-green-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}>
            {toast.message}
          </div>
        )}

        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
          <CourseForm
            defaultValues={{
              title: course.title,
              description: course.description ?? '',
              category: course.category ?? '',
              level: course.level ?? '',
              price: course.price ?? 0,
              thumbnailUrl: course.thumbnailUrl ?? '',
            }}
            onSubmit={handleSubmit}
            onDelete={handleDelete}
            isEditing
            loading={updateCourse.isPending || removeCourse.isPending}
          />
        </div>
      </div>
    </div>
  );
}
