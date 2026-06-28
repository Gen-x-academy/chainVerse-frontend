import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { CartItem, CartItemDocument } from './schemas/cart-item.schema';

export interface CartItemDto {
  cartItemId: string;
  addedAt: Date;
  course: Record<string, unknown> | null;
}

@Injectable()
export class StudentCartService {
  constructor(
    @InjectModel(CartItem.name)
    private readonly cartItemModel: Model<CartItemDocument>,
    @InjectModel('Course')
    private readonly courseModel: Model<any>,
  ) {}

  /**
   * Add a course to the student's cart.
   * Throws NotFoundException if the course does not exist.
   * Throws ConflictException if the course is already in the cart.
   */
  async addToCart(studentId: string, courseId: string): Promise<CartItemDocument> {
    const course = await this.courseModel
      .findById(new Types.ObjectId(courseId))
      .lean()
      .exec();

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    const existing = await this.cartItemModel
      .findOne({ studentId, courseId: new Types.ObjectId(courseId) })
      .lean()
      .exec();

    if (existing) {
      throw new ConflictException('Course is already in the cart');
    }

    return this.cartItemModel.create({
      studentId,
      courseId: new Types.ObjectId(courseId),
      addedAt: new Date(),
    });
  }

  /**
   * Get all items in a student's cart, each hydrated with its course document.
   *
   * Replaces the N+1 pattern (one findById per cart item) with two total
   * DB queries regardless of cart size:
   *   1. Find all cart items for the student          — O(1) DB round-trip
   *   2. $in query to fetch all courses at once       — O(1) DB round-trip
   *
   * A Map<courseId, course> provides O(1) per-item lookup during assembly.
   *
   * Time complexity:  O(n) — n = number of items in the cart
   * Space complexity: O(n) — courseMap holds at most n entries
   */
  async getCart(studentId: string): Promise<CartItemDto[]> {
    // Query 1: all cart items for this student
    const items = await this.cartItemModel
      .find({ studentId })
      .lean()
      .exec();

    if (items.length === 0) {
      return [];
    }

    // Extract courseIds — O(n)
    const courseIds = items.map((i) => i.courseId);

    // Query 2: single $in to fetch every course in one round-trip
    const courses = await this.courseModel
      .find({ _id: { $in: courseIds } })
      .lean()
      .exec();

    // Build lookup Map for O(1) access per item — O(n)
    const courseMap = new Map<string, Record<string, unknown>>(
      courses.map((c) => [c._id.toString(), c as Record<string, unknown>]),
    );

    // Assemble response — O(n)
    return items.map((item) => ({
      cartItemId: item._id.toString(),
      addedAt: item.addedAt,
      course: courseMap.get(item.courseId.toString()) ?? null,
    }));
  }

  /**
   * Remove a single course from the student's cart.
   */
  async removeFromCart(studentId: string, courseId: string): Promise<void> {
    const result = await this.cartItemModel
      .findOneAndDelete({ studentId, courseId: new Types.ObjectId(courseId) })
      .exec();

    if (!result) {
      throw new NotFoundException('Cart item not found');
    }
  }

  /**
   * Remove all items from the student's cart (e.g. after checkout).
   */
  async clearCart(studentId: string): Promise<void> {
    await this.cartItemModel.deleteMany({ studentId }).exec();
  }
}
