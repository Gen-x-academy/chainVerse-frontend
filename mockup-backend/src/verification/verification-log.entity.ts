import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type VerificationLogDocument = VerificationLog & Document;

@Schema({ timestamps: true })
export class VerificationLog {
  @Prop({ type: Types.ObjectId, required: true })
  userId: Types.ObjectId;

  @Prop({ required: true, enum: ['student', 'tutor'] })
  userType: string;

  @Prop({ required: true, enum: ['email', 'phone', 'document'] })
  verificationType: string;

  @Prop({ required: true, enum: ['success', 'failure'] })
  outcome: string;

  @Prop()
  failureReason: string;
}

export const VerificationLogSchema = SchemaFactory.createForClass(VerificationLog);
