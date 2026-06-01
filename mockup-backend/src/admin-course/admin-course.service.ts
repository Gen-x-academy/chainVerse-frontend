import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model } from 'mongoose';
import { Tutor, TutorDocument } from '../schemas/tutor.schema';

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

@Injectable()
export class AdminCourseService {
  constructor(
    @InjectModel(Tutor.name)
    private readonly tutorModel: Model<TutorDocument>,
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
}
