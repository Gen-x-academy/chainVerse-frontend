import { apiClient } from '@/src/lib/api-client';

export type Student = {
  id: string;
  name: string;
  email?: string;
  avatarUrl?: string;
  enrolledCourseIds?: string[];
  completedCourseIds?: string[];
};

export type StudentListResponse = {
  data: Student[];
  total: number;
};

export type StudentPayload = {
  name: string;
  email?: string;
  avatarUrl?: string;
};

export const studentService = {
  list: (page = 1, pageSize = 10) =>
    apiClient.get<StudentListResponse>(
      `/students?page=${page}&pageSize=${pageSize}`
    ),

  getById: (id: string) =>
    apiClient.get<Student>(`/students/${id}`),

  create: (payload: StudentPayload) =>
    apiClient.post<Student>('/students', payload),

  update: (id: string, payload: Partial<StudentPayload>) =>
    apiClient.patch<Student>(`/students/${id}`, payload),

  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/students/${id}`),
};
