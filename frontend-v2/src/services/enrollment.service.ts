import { apiClient } from '@/src/lib/api-client';
import { useAuthStore } from '@/src/store/authStore';
import type { EnrollmentRecord, EnrollmentListResponse } from '@/src/types/api';

/**
 * Enrollment service (issue #694 Phase 1 wire-up).
 *
 * When a Stellar wallet is connected, the connected public key is read
 * from the auth store and forwarded to the backend so the payment flow
 * can verify the payer. When no wallet is connected, the field is
 * omitted (free courses / non-Stellar flows).
 */
export const enrollmentApiService = {
  enroll: (courseId: string): Promise<EnrollmentRecord> => {
    const walletPublicKey = useAuthStore.getState().walletPublicKey;
    return apiClient.post<EnrollmentRecord>('/enrollments', {
      courseId,
      ...(walletPublicKey ? { walletPublicKey } : {}),
    });
  },

  myEnrollments: (): Promise<EnrollmentListResponse> =>
    apiClient.get<EnrollmentListResponse>('/enrollments/my'),

  getProgress: (enrollmentId: string): Promise<EnrollmentRecord> =>
    apiClient.get<EnrollmentRecord>(`/enrollments/${enrollmentId}`),

  updateProgress: (enrollmentId: string, progress: number): Promise<EnrollmentRecord> =>
    apiClient.patch<EnrollmentRecord>(`/enrollments/${enrollmentId}/progress`, { progress }),
};
