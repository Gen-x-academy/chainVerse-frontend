import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  CourseRatingFeedback,
  CourseRatingFeedbackSchema,
} from './course-ratings-feedback.schema';
import { CourseRatingsFeedbackService } from './course-ratings-feedback.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CourseRatingFeedback.name, schema: CourseRatingFeedbackSchema },
    ]),
  ],
  providers: [CourseRatingsFeedbackService],
  exports: [CourseRatingsFeedbackService],
})
export class CourseRatingsFeedbackModule {}
