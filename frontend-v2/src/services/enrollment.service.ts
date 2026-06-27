import { apiClient } from '@/src/lib/api-client';
import type { EnrollmentRecord, EnrollmentListResponse } from '@/src/types/api';

export const enrollmentApiService = {
  enroll: (courseId: string): Promise<EnrollmentRecord> =>
    apiClient.post<EnrollmentRecord>('/enrollments', { courseId }),

  myEnrollments: (): Promise<EnrollmentListResponse> =>
    apiClient.get<EnrollmentListResponse>('/enrollments/my'),

  getProgress: (enrollmentId: string): Promise<EnrollmentRecord> =>
    apiClient.get<EnrollmentRecord>(`/enrollments/${enrollmentId}`),

  updateProgress: (enrollmentId: string, progress: number): Promise<EnrollmentRecord> =>
    apiClient.patch<EnrollmentRecord>(`/enrollments/${enrollmentId}/progress`, { progress }),
};
