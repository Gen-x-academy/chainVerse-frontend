import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type IdempotencyDocument = IdempotencyRecord & Document;

@Schema({ timestamps: true })
export class IdempotencyRecord {
  @Prop({ required: true })
  key: string;

  @Prop({ required: true })
  userId: string;

  /**
   * The request path this key was first used for.
   * Used to detect Idempotency-Key reuse across different endpoints.
   */
  @Prop({ required: true })
  path: string;

  @Prop({ type: Object, required: true })
  responseBody: Record<string, unknown>;

  @Prop()
  statusCode: number;
}

export const IdempotencySchema = SchemaFactory.createForClass(IdempotencyRecord);

// Compound unique index: one key per user
IdempotencySchema.index({ key: 1, userId: 1 }, { unique: true });
