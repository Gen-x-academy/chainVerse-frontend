import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Tutor, TutorDocument } from '../schemas/tutor.schema';
import { CourseDocument } from '../schemas/course.schema';

export type TutorStatsUpdate = Partial<
  Record<
    | 'courseCount'
    | 'totalCourses'
    | 'publishedCourses'
    | 'draftCourses'
    | 'pendingCourses'
    | 'rejectedCourses',
    number
  >
>;

export interface PaginatedCoursesResult {
  data: CourseDocument[];
  total: number;
  page: number;
  limit: number;
}

const MAX_LIMIT = 50;

@Injectable()
export class AdminCourseService {
  constructor(
    @InjectModel(Tutor.name)
    private readonly tutorModel: Model<TutorDocument>,
    @InjectModel('Course')
    private readonly courseModel: Model<CourseDocument>,
  ) {}

  async updateTutorStats(tutorId: string, update: TutorStatsUpdate): Promise<void> {
    const tutorFilter: FilterQuery<TutorDocument> = {
      _id: tutorId,
      isDeleted: { $ne: true },
      deletedAt: null,
    };

    const result = await this.tutorModel
      .updateOne(tutorFilter, { $inc: update })
      .exec();

    if (result.matchedCount === 0) {
      throw new NotFoundException(`Tutor ${tutorId} not found`);
    }
  }

  /**
   * Return a paginated list of all courses for the admin dashboard.
   *
   * - page  : 1-based page number, clamped to >= 1
   * - limit : results per page, clamped to [1, MAX_LIMIT (50)]
   *
   * Runs countDocuments and find in parallel so both round-trips
   * happen simultaneously rather than sequentially.
   *
   * Time complexity:  O(limit) — only `limit` documents are fetched
   * Space complexity: O(limit)
   */
  async findAll(page: number, limit: number): Promise<PaginatedCoursesResult> {
    const safePage = Math.max(1, page);
    const safeLimit = Math.min(Math.max(1, limit), MAX_LIMIT);
    const skip = (safePage - 1) * safeLimit;

    const [data, total] = await Promise.all([
      this.courseModel
        .find()
        .skip(skip)
        .limit(safeLimit)
        .lean()
        .exec() as Promise<CourseDocument[]>,
      this.courseModel.countDocuments().exec(),
    ]);

    return { data, total, page: safePage, limit: safeLimit };
  }
}
