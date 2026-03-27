import { apiClient } from '@/lib/api-client';
import type { Course, CourseListResponse, CoursePayload } from '../types';

export const courseService = {
  list: (page = 1, pageSize = 10) =>
    apiClient.get<CourseListResponse>(`/courses?page=${page}&pageSize=${pageSize}`),

  getById: (id: string) =>
    apiClient.get<Course>(`/courses/${id}`),

  create: (payload: CoursePayload) =>
    apiClient.post<Course>('/courses', payload),

  update: (id: string, payload: Partial<CoursePayload>) =>
    apiClient.patch<Course>(`/courses/${id}`, payload),

  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/courses/${id}`),
}
