import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CourseDocument } from '../schemas/course.schema';

@Injectable()
export class CourseDiscoveryService {
  constructor(
    @InjectModel('Course')
    private readonly courseModel: Model<CourseDocument>,
  ) {}

  /**
   * Full-text search across course title and description.
   *
   * Uses MongoDB's $text operator against the compound text index
   * { title: 'text', description: 'text' } defined on the Course schema.
   * This avoids full-collection scans that regex-based search causes.
   *
   * Results are ranked by textScore so the most relevant courses surface first.
   *
   * When no query is provided, returns all courses ordered by creation date.
   *
   * Time complexity:  O(k) — k = documents matching the text index (not full collection)
   * Space complexity: O(k)
   */
  async search(query: string): Promise<CourseDocument[]> {
    if (!query?.trim()) {
      return this.courseModel
        .find()
        .sort({ createdAt: -1 })
        .lean()
        .exec() as Promise<CourseDocument[]>;
    }

    return this.courseModel
      .find(
        { $text: { $search: query } },
        { score: { $meta: 'textScore' } },
      )
      .sort({ score: { $meta: 'textScore' } })
      .lean()
      .exec() as Promise<CourseDocument[]>;
  }

  /**
   * Retrieve a single course by its ID.
   * Throws NotFoundException if the course does not exist.
   */
  async findOne(id: string): Promise<CourseDocument> {
    const course = await this.courseModel
      .findById(id)
      .lean()
      .exec() as CourseDocument | null;

    if (!course) {
      throw new NotFoundException(`Course ${id} not found`);
    }

    return course;
  }
}
