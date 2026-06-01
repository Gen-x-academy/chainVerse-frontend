import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type EnrollmentDocument = Enrollment & Document;

export type EnrollmentStatus = 'active' | 'completed' | 'dropped';

@Schema({ timestamps: true })
export class Enrollment {
  @Prop({ required: true, index: true })
  studentId: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  enrolledAt: Date;

  @Prop({ required: true, enum: ['active', 'completed', 'dropped'], default: 'active' })
  status: EnrollmentStatus;

  @Prop({ required: true, min: 0, max: 100, default: 0 })
  progress: number;

  @Prop({ default: null })
  completedAt: Date | null;
}

export const EnrollmentSchema = SchemaFactory.createForClass(Enrollment);

// Compound unique index — a student can only enroll in a course once
EnrollmentSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
