import { apiClient } from '../../../lib/api-client';

export type IsEnrolledResponse = {
  enrolled: boolean;
  courseId: string;
};

export const studentEnrollmentService = {
  isEnrolled: async (courseId: string): Promise<IsEnrolledResponse> => {
    const enrolled = await apiClient.get<boolean>(`/is-enrolled/${courseId}`);
    return { enrolled, courseId };
  },
};
