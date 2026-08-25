'use client';

import { useQuery } from '@tanstack/react-query';
import { authedClient } from '@/src/lib/api-client';
import type { Course } from '@/src/features/courses/types';

export function useInstructorCourses() {
  return useQuery({
    queryKey: ['instructor', 'courses'],
    queryFn: () => authedClient.get<Course[]>('/admin/courses'),
  });
}
