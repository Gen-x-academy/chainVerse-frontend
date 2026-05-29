import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

export interface TutorCourseAttrs {
  title: string;
  description: string;
  tutorId: string;
  price?: number;
  status?: 'draft' | 'pending_review' | 'published' | 'rejected';
}

@Injectable()
export class TutorCourseService {
  constructor(
    @InjectModel('Course') private readonly courseModel: Model<any>,
  ) {}

  async create(tutorId: string, dto: Omit<TutorCourseAttrs, 'tutorId'>) {
    return this.courseModel.create({ ...dto, tutorId, status: 'draft' });
  }

  async findAllByTutor(tutorId: string) {
    return this.courseModel.find({ tutorId }).exec();
  }

  async findOne(id: string, tutorId: string) {
    const course = await this.courseModel.findById(id).exec();
    if (!course) throw new NotFoundException(`Course ${id} not found`);
    if (course.tutorId.toString() !== tutorId)
      throw new ForbiddenException('You do not own this course');
    return course;
  }

  async update(id: string, tutorId: string, dto: Partial<TutorCourseAttrs>) {
    const course = await this.findOne(id, tutorId);
    Object.assign(course, dto);
    return course.save();
  }

  async submitForReview(id: string, tutorId: string) {
    return this.update(id, tutorId, { status: 'pending_review' });
  }

  async remove(id: string, tutorId: string) {
    await this.findOne(id, tutorId);
    await this.courseModel.findByIdAndDelete(id).exec();
  }
}
