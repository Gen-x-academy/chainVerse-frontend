import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type TutorDocument = Tutor & Document;

@Schema({ timestamps: true })
export class Tutor {
  @Prop({ default: 0 })
  courseCount: number;

  @Prop({ default: 0 })
  totalCourses: number;

  @Prop({ default: 0 })
  publishedCourses: number;

  @Prop({ default: 0 })
  draftCourses: number;

  @Prop({ default: 0 })
  pendingCourses: number;

  @Prop({ default: 0 })
  rejectedCourses: number;

  @Prop({ default: false })
  isDeleted: boolean;

  @Prop({ default: null })
  deletedAt: Date | null;
}

export const TutorSchema = SchemaFactory.createForClass(Tutor);
