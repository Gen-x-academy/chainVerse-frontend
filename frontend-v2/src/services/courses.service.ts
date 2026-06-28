import { apiClient } from '@/src/lib/api-client';
import type { Course, CourseListResponse, PaginationParams } from '@/src/types/api';

export interface CourseSearchParams extends PaginationParams {
  search?: string;
  category?: string;
  level?: string;
}

export const coursesApiService = {
  list: (params: CourseSearchParams = {}): Promise<CourseListResponse> => {
    const query = new URLSearchParams();
    if (params.page) query.set('page', String(params.page));
    if (params.limit) query.set('limit', String(params.limit));
    if (params.search) query.set('search', params.search);
    if (params.category) query.set('category', params.category);
    if (params.level) query.set('level', params.level);
    const qs = query.toString();
    return apiClient.get<CourseListResponse>(`/courses${qs ? `?${qs}` : ''}`);
  },

  getById: (id: string): Promise<Course> =>
    apiClient.get<Course>(`/courses/${id}`),

  search: (query: string, params?: PaginationParams): Promise<CourseListResponse> =>
    apiClient.get<CourseListResponse>(
      `/courses?search=${encodeURIComponent(query)}&page=${params?.page ?? 1}&limit=${params?.limit ?? 12}`
    ),
};
