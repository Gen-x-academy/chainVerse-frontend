import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Types } from 'mongoose';

export type CartItemDocument = CartItem & Document;

@Schema({ timestamps: true })
export class CartItem {
  @Prop({ required: true, index: true })
  studentId: string;

  @Prop({ type: Types.ObjectId, required: true, index: true })
  courseId: Types.ObjectId;

  @Prop({ required: true, default: Date.now })
  addedAt: Date;
}

export const CartItemSchema = SchemaFactory.createForClass(CartItem);

// Compound unique index — a course can only appear once per student's cart
CartItemSchema.index({ studentId: 1, courseId: 1 }, { unique: true });
