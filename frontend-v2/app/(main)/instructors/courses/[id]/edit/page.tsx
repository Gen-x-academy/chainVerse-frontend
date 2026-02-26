'use client';

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { CourseForm, CourseFormData } from '@/features/instructors/components/CourseForm';
import { courseService } from '@/features/courses/services/course.service';

const MOCK_COURSE = {
  title: 'Advanced React Patterns',
  description: 'Learn advanced React patterns including compound components, render props, and hooks.',
  category: 'Web3',
  level: 'Advanced',
  price: 89.99,
  thumbnailUrl: '',
};

export default function EditCoursePage() {
  const params = useParams();
  const courseId = params.id as string;
  const [loading, setLoading] = useState(false);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const handleSubmit = async (data: CourseFormData) => {
    setLoading(true);
    setToast(null);
    try {
      await courseService.update(courseId, {
        title: data.title,
        description: data.description,
        thumbnailUrl: data.thumbnailUrl,
        price: data.price,
      });
      setToast({ type: 'success', message: 'Course updated successfully!' });
      setTimeout(() => {
        window.location.href = '/instructors/dashboard';
      }, 1500);
    } catch {
      setToast({ type: 'error', message: 'Failed to update course. Please try again.' });
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setLoading(true);
    try {
      await courseService.remove(courseId);
      window.location.href = '/instructors/dashboard';
    } catch {
      setToast({ type: 'error', message: 'Failed to delete course.' });
      setLoading(false);
    }
  };

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
            defaultValues={MOCK_COURSE}
            onSubmit={handleSubmit}
            onDelete={() => setShowDeleteModal(true)}
            isEditing
            loading={loading}
          />
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-2">Delete Course</h3>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete this course? This action cannot be undone.
            </p>
            <div className="flex items-center gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={loading}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 rounded-lg hover:bg-red-700 transition disabled:opacity-50"
              >
                {loading ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
