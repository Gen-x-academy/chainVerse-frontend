import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseRatingFeedbackDocument = CourseRatingFeedback & Document;

@Schema({ timestamps: true })
export class CourseRatingFeedback {
  @Prop({ required: true })
  courseId!: string;

  @Prop({ required: true })
  studentId!: string;

  @Prop({ required: true, min: 1, max: 5 })
  rating!: number;

  @Prop({ trim: true })
  feedback?: string;
}

export const CourseRatingFeedbackSchema =
  SchemaFactory.createForClass(CourseRatingFeedback);

// Enforce one rating per student per course at the database level.
CourseRatingFeedbackSchema.index(
  { courseId: 1, studentId: 1 },
  { unique: true },
);
