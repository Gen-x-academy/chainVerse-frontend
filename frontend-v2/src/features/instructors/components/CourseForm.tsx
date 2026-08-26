'use client';

import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Modal } from '@/src/shared/components/ui/Modal';

const accessibilitySchema = z.object({
  largePrint: z.boolean().default(false),
  braille: z.boolean().default(false),
  dyslexiaFriendly: z.boolean().default(false),
  captioned: z.boolean().default(false),
  transcript: z.boolean().default(false),
  screenReaderCompatible: z.boolean().default(false),
});

const courseSchema = z.object({
  title: z.string().min(1, 'Title is required').min(3, 'Title must be at least 3 characters'),
  description: z.string().min(1, 'Description is required').min(10, 'Description must be at least 10 characters'),
  category: z.string().min(1, 'Category is required'),
  level: z.string().min(1, 'Level is required'),
  price: z.coerce.number().min(0, 'Price must be 0 or more'),
  thumbnailUrl: z.string().url('Must be a valid URL').optional().or(z.literal('')),
  accessibility: accessibilitySchema.optional(),
});

export type CourseFormData = z.infer<typeof courseSchema>;

interface CourseFormProps {
  defaultValues?: Partial<CourseFormData>;
  onSubmit: (data: CourseFormData, action: 'draft' | 'publish' | 'update') => void;
  onDelete?: () => void;
  isEditing?: boolean;
  loading?: boolean;
}

const CATEGORIES = ['Blockchain', 'DeFi', 'NFTs', 'Smart Contracts', 'Web3'];
const LEVELS = ['Beginner', 'Intermediate', 'Advanced'];
const ACCESSIBILITY_OPTIONS = [
  { key: 'largePrint', label: 'Large Print', description: 'Course materials available in large print format' },
  { key: 'braille', label: 'Braille', description: 'Course content available in braille format' },
  { key: 'dyslexiaFriendly', label: 'Dyslexia-Friendly', description: 'Optimized formatting for readers with dyslexia' },
  { key: 'captioned', label: 'Closed Captions', description: 'All video content includes accurate closed captions' },
  { key: 'transcript', label: 'Transcripts Available', description: 'Full text transcripts for all audio/video content' },
  { key: 'screenReaderCompatible', label: 'Screen Reader Compatible', description: 'Fully compatible with popular screen readers' },
] as const;

export const CourseForm: React.FC<CourseFormProps> = ({
  defaultValues,
  onSubmit,
  onDelete,
  isEditing = false,
  loading = false,
}) => {
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<CourseFormData>({
    resolver: zodResolver(courseSchema),
    defaultValues: {
      title: '',
      description: '',
      category: '',
      level: '',
      price: 0,
      thumbnailUrl: '',
      ...defaultValues,
    },
  });

  return (
    <form className="space-y-6" onSubmit={handleSubmit((data) => onSubmit(data, isEditing ? 'update' : 'publish'))}>
      {/* Title */}
      <div>
        <label htmlFor="course-title" className="block text-sm font-semibold text-gray-700 mb-2">Title</label>
        <input
          id="course-title"
          type="text"
          placeholder="Course title"
          className={`w-full px-4 py-3 border rounded-lg focus-ring transition ${
            errors.title ? 'border-red-300 focus-visible:ring-red-500' : 'border-gray-300'
          }`}
          {...register('title')}
        />
        {errors.title && <p className="text-red-500 text-sm mt-1">{errors.title.message}</p>}
      </div>

      {/* Description */}
      <div>
        <label htmlFor="course-description" className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
        <textarea
          id="course-description"
          rows={4}
          placeholder="Course description"
          className={`w-full px-4 py-3 border rounded-lg focus-ring transition resize-none ${
            errors.description ? 'border-red-300 focus-visible:ring-red-500' : 'border-gray-300'
          }`}
          {...register('description')}
        />
        {errors.description && <p className="text-red-500 text-sm mt-1">{errors.description.message}</p>}
      </div>

      {/* Category & Level */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label htmlFor="course-category" className="block text-sm font-semibold text-gray-700 mb-2">Category</label>
          <select
            className={`w-full px-4 py-3 border rounded-lg focus-ring transition ${
              errors.category ? 'border-red-300 focus-visible:ring-red-500' : 'border-gray-300'
            id="course-category"
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition ${
              errors.category ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'
            }`}
            {...register('category')}
          >
            <option value="">Select category</option>
            {CATEGORIES.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
          {errors.category && <p className="text-red-500 text-sm mt-1">{errors.category.message}</p>}
        </div>

        <div>
          <label htmlFor="course-level" className="block text-sm font-semibold text-gray-700 mb-2">Level</label>
          <select
            className={`w-full px-4 py-3 border rounded-lg focus-ring transition ${
              errors.level ? 'border-red-300 focus-visible:ring-red-500' : 'border-gray-300'
            id="course-level"
            className={`w-full px-4 py-3 border rounded-lg focus:outline-none focus:ring-2 transition ${
              errors.level ? 'border-red-300 focus:ring-red-500' : 'border-gray-300 focus:ring-indigo-500'
            }`}
            {...register('level')}
          >
            <option value="">Select level</option>
            {LEVELS.map((level) => (
              <option key={level} value={level}>{level}</option>
            ))}
          </select>
          {errors.level && <p className="text-red-500 text-sm mt-1">{errors.level.message}</p>}
        </div>
      </div>

      {/* Price */}
      <div>
        <label htmlFor="course-price" className="block text-sm font-semibold text-gray-700 mb-2">Price ($)</label>
        <input
          id="course-price"
          type="number"
          step="0.01"
          min="0"
          placeholder="0.00"
          className={`w-full px-4 py-3 border rounded-lg focus-ring transition ${
            errors.price ? 'border-red-300 focus-visible:ring-red-500' : 'border-gray-300'
          }`}
          {...register('price')}
        />
        {errors.price && <p className="text-red-500 text-sm mt-1">{errors.price.message}</p>}
      </div>

      {/* Thumbnail URL */}
      <div>
        <label htmlFor="course-thumbnail" className="block text-sm font-semibold text-gray-700 mb-2">Thumbnail URL</label>
        <input
          id="course-thumbnail"
          type="text"
          placeholder="https://example.com/image.jpg"
          className="w-full px-4 py-3 border border-gray-300 rounded-lg focus-ring transition"
          {...register('thumbnailUrl')}
        />
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-4">
        {isEditing ? (
          <>
            <button
              type="button"
              onClick={handleSubmit((data) => onSubmit(data, 'update'))}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Update
            </button>
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(true)}
              disabled={loading}
              className="px-6 py-3 bg-red-600 text-white font-semibold rounded-lg hover:bg-red-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={handleSubmit((data) => onSubmit(data, 'draft'))}
              disabled={loading}
              className="px-6 py-3 bg-gray-200 text-gray-800 font-semibold rounded-lg hover:bg-gray-300 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />}
              Save Draft
            </button>
            <button
              type="button"
              onClick={handleSubmit((data) => onSubmit(data, 'publish'))}
              disabled={loading}
              className="px-6 py-3 bg-indigo-600 text-white font-semibold rounded-lg hover:bg-indigo-700 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
            >
              {loading && <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />}
              Publish
            </button>
          </>
        )}
      </div>

      <Modal
        isOpen={showDeleteConfirm}
        onClose={() => setShowDeleteConfirm(false)}
        title="Delete Course"
      >
        <p className="text-gray-600 mb-6">Are you sure you want to delete this course? This action cannot be undone.</p>
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setShowDeleteConfirm(false)}
            className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition font-medium"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => { setShowDeleteConfirm(false); onDelete?.(); }}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition font-medium"
          >
            Delete
          </button>
        </div>
      </Modal>
    </form>
  );
};