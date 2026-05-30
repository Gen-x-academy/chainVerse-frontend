import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type PrivateTutoringBookingDocument = PrivateTutoringBooking & Document;

@Schema({ timestamps: true })
export class PrivateTutoringBooking {
  @Prop({ type: Types.ObjectId, required: true, ref: 'Student' })
  studentId: Types.ObjectId;

  @Prop({ type: Types.ObjectId, required: true, ref: 'Tutor' })
  tutorId: Types.ObjectId;

  @Prop({ required: true })
  scheduledAt: Date;

  @Prop({ required: true, min: 30, max: 180 })
  durationMinutes: number;

  @Prop({ required: true })
  subject: string;

  @Prop({ trim: true })
  notes: string;

  @Prop({ enum: ['pending', 'confirmed', 'cancelled', 'completed'], default: 'pending' })
  status: string;
}

export const PrivateTutoringBookingSchema = SchemaFactory.createForClass(PrivateTutoringBooking);
