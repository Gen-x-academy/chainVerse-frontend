import { vi, describe, it, expect, beforeEach } from 'vitest';

interface EnrollmentStats {
  totalEnrollments: number;
  completionRate: number;
}

// Minimal course analytics service using aggregation
class CourseAnalyticsService {
  constructor(private db: { aggregate: (pipeline: object[]) => Promise<EnrollmentStats[]> }) {}

  async getStats(courseId: string): Promise<EnrollmentStats> {
    const results = await this.db.aggregate([
      { $match: { courseId } },
      { $group: { _id: null, total: { $sum: 1 }, completed: { $sum: { $cond: ['$completed', 1, 0] } } } },
    ]);
    if (!results.length) return { totalEnrollments: 0, completionRate: 0 };
    return results[0];
  }
}

describe('CourseAnalyticsService', () => {
  const mockDb = { aggregate: vi.fn() };
  let service: CourseAnalyticsService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new CourseAnalyticsService(mockDb);
  });

  it('returns zero stats when no enrollments', async () => {
    mockDb.aggregate.mockResolvedValueOnce([]);
    const stats = await service.getStats('course-1');
    expect(stats.totalEnrollments).toBe(0);
    expect(stats.completionRate).toBe(0);
  });

  it('calls aggregate with courseId match', async () => {
    mockDb.aggregate.mockResolvedValueOnce([{ totalEnrollments: 5, completionRate: 0.8 }]);
    await service.getStats('course-abc');
    expect(mockDb.aggregate).toHaveBeenCalledWith(
      expect.arrayContaining([expect.objectContaining({ $match: { courseId: 'course-abc' } })])
    );
  });

  it('returns aggregated stats', async () => {
    mockDb.aggregate.mockResolvedValueOnce([{ totalEnrollments: 10, completionRate: 0.5 }]);
    const stats = await service.getStats('course-2');
    expect(stats.totalEnrollments).toBe(10);
  });
});