import { vi, describe, it, expect, beforeEach } from 'vitest';
import { studentEnrollmentService } from '../student-enrollment.service';

vi.mock('@/src/lib/api-client', () => ({
  apiClient: {
    get: vi.fn(),
  },
}));

import { apiClient } from '@/src/lib/api-client';

describe('studentEnrollmentService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('calls GET /is-enrolled/:courseId and returns enrollment state', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(true);

    const result = await studentEnrollmentService.isEnrolled('course-123');

    expect(apiClient.get).toHaveBeenCalledWith('/is-enrolled/course-123');
    expect(result).toEqual({ enrolled: true, courseId: 'course-123' });
  });

  it('returns false enrollment state when the course is not enrolled', async () => {
    vi.mocked(apiClient.get).mockResolvedValueOnce(false);

    const result = await studentEnrollmentService.isEnrolled('course-456');

    expect(apiClient.get).toHaveBeenCalledWith('/is-enrolled/course-456');
    expect(result).toEqual({ enrolled: false, courseId: 'course-456' });
  });

  it('propagates apiClient errors from the enrollment check', async () => {
    vi.mocked(apiClient.get).mockRejectedValueOnce(new Error('Network error'));

    await expect(studentEnrollmentService.isEnrolled('course-789')).rejects.toThrow('Network error');
  });
});
