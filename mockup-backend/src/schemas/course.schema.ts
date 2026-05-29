import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type CourseDocument = Course & Document;

@Schema()
export class Course {
  @Prop({ required: true })
  title: string;

  @Prop({ required: true })
  description: string;

  @Prop({ required: true })
  instructorId: string;

  @Prop({ default: 0 })
  totalEnrollments: number;

  // REMOVED: enrolledStudents: string[] - This was causing MongoDB 16MB document limit issues
  // Enrollment status should now be queried from the Enrollment collection:
  // enrollmentModel.countDocuments({ courseId })

  @Prop({ default: Date.now })
  createdAt: Date;

  @Prop({ default: Date.now })
  updatedAt: Date;
}

export const CourseSchema = SchemaFactory.createForClass(Course);
