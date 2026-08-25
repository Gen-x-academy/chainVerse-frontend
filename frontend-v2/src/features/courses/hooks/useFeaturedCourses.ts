'use client';

import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/src/lib/api-client';
import type { Course } from '../types';

export function useFeaturedCourses() {
  return useQuery({
    queryKey: ['courses', 'featured'],
    queryFn: () => apiClient.get<Course[]>('/course-discovery?featured=true&limit=3'),
  });
}
