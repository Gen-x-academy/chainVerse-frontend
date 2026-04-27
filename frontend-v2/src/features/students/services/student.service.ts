
type Student = {
type StudentListResponse = {
type StudentPayload = {

import { apiClient } from '@/lib/api-client';
import type { Student, StudentListResponse, StudentPayload } from '../types/students.types';

  list: (page = 1, pageSize = 10) =>
    apiClient.get<StudentListResponse>(`/students?page=${page}&pageSize=${pageSize}`),
  getById: (id: string) =>
    apiClient.get<Student>(`/students/${id}`),
  create: (payload: StudentPayload) =>
    apiClient.post<Student>('/students', payload),
  update: (id: string, payload: Partial<StudentPayload>) =>
    apiClient.patch<Student>(`/students/${id}`, payload),
  remove: (id: string) =>
    apiClient.delete<{ success: boolean }>(`/students/${id}`),
}
