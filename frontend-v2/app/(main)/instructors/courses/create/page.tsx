'use client';

import React, { useState } from 'react';
import { CourseForm, CourseFormData } from '@/features/instructors/components/CourseForm';
import { courseService } from '@/features/courses/services/course.service';

export default function CreateCoursePage() {
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (data: CourseFormData, action: 'draft' | 'publish' | 'update') => {
    setLoading(true);
    setToast(null);
    try {
      await courseService.create({
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        price: data.price,
      });
      setToast({ type: 'success', message: `Course ${action === 'publish' ? 'published' : 'saved as draft'} successfully!` });
      setTimeout(() => {
        window.location.href = '/instructors/dashboard';
      }, 1500);
    } catch {
      setToast({ type: 'error', message: 'Failed to create course. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Create New Course</h1>
          <p className="text-gray-600 mt-2">Fill in the details to create a new course.</p>
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
          <CourseForm onSubmit={handleSubmit} loading={loading} />
        </div>
      </div>
    </div>
  );
}
