import { ConflictException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import {
  CourseRatingFeedback,
  CourseRatingFeedbackDocument,
} from './course-ratings-feedback.schema';

export interface CreateCourseRatingFeedbackDto {
  courseId: string;
  studentId: string;
  rating: number;
  feedback?: string;
}

@Injectable()
export class CourseRatingsFeedbackService {
  constructor(
    @InjectModel(CourseRatingFeedback.name)
    private readonly ratingModel: Model<CourseRatingFeedbackDocument>,
  ) {}

  async create(
    createCourseRatingFeedbackDto: CreateCourseRatingFeedbackDto,
  ): Promise<CourseRatingFeedbackDocument> {
    const { courseId, studentId } = createCourseRatingFeedbackDto;

    const existing = await this.ratingModel
      .findOne({ courseId, studentId })
      .exec();

    if (existing) {
      throw new ConflictException('You have already rated this course');
    }

    const rating = new this.ratingModel(createCourseRatingFeedbackDto);

    return rating.save();
  }
}
