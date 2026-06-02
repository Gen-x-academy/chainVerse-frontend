import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  Enrollment,
  EnrollmentDocument,
} from './schemas/enrollment.schema';

export interface EnrolledCourseDto {
  enrollmentId: string;
  enrolledAt: Date;
  status: string;
  progress: number;
  completedAt: Date | null;
  course: Record<string, unknown> | null;
}

@Injectable()
export class StudentEnrollmentService {
  constructor(
    @InjectModel(Enrollment.name)
    private readonly enrollmentModel: Model<EnrollmentDocument>,
    @InjectModel('Course')
    private readonly courseModel: Model<any>,
  ) {}

  /**
   * Enroll a student in a course.
   * Throws ConflictException if already enrolled.
   */
  async enroll(studentId: string, courseId: string): Promise<EnrollmentDocument> {
    const course = await this.courseModel
      .findById(new Types.ObjectId(courseId))
      .lean()
      .exec();

    if (!course) {
      throw new NotFoundException(`Course ${courseId} not found`);
    }

    const existing = await this.enrollmentModel
      .findOne({ studentId, courseId: new Types.ObjectId(courseId) })
      .lean()
      .exec();

    if (existing) {
      throw new ConflictException('Student is already enrolled in this course');
    }

    const [enrollment] = await Promise.all([
      this.enrollmentModel.create({
        studentId,
        courseId: new Types.ObjectId(courseId),
        enrolledAt: new Date(),
      }),
      this.courseModel
        .findByIdAndUpdate(courseId, { $inc: { totalEnrollments: 1 } })
        .exec(),
    ]);

    return enrollment;
  }

  /**
   * Get all courses a student is enrolled in.
   *
   * Replaces the previous N+1 pattern (one findById per enrollment) with
   * two total queries:
   *   1. Find all enrollments for the student          — O(1) DB round-trip
   *   2. $in query to fetch all courses at once        — O(1) DB round-trip
   *
   * Then builds a Map<courseId, course> for O(1) per-lookup assembly.
   *
   * Time complexity:  O(n) — n = number of enrollments
   * Space complexity: O(n) — courseMap holds at most n entries
   */
  async getMyCourses(studentId: string): Promise<EnrolledCourseDto[]> {
    // Query 1: all enrollments for this student
    const enrollments = await this.enrollmentModel
      .find({ studentId })
      .lean()
      .exec();

    if (enrollments.length === 0) {
      return [];
    }

    // Extract courseIds — O(n)
    const courseIds = enrollments.map((e) => e.courseId);

    // Query 2: single $in to fetch every course in one round-trip
    const courses = await this.courseModel
      .find({ _id: { $in: courseIds } })
      .lean()
      .exec();

    // Build lookup Map for O(1) access per enrollment — O(n)
    const courseMap = new Map<string, Record<string, unknown>>(
      courses.map((c) => [c._id.toString(), c as Record<string, unknown>]),
    );

    // Assemble response — O(n)
    return enrollments.map((enrollment) => ({
      enrollmentId: enrollment._id.toString(),
      enrolledAt: enrollment.enrolledAt,
      status: enrollment.status,
      progress: enrollment.progress,
      completedAt: enrollment.completedAt,
      course: courseMap.get(enrollment.courseId.toString()) ?? null,
    }));
  }

  /**
   * Drop (soft-delete) a student's enrollment in a course.
   */
  async unenroll(studentId: string, courseId: string): Promise<void> {
    const enrollment = await this.enrollmentModel
      .findOne({ studentId, courseId: new Types.ObjectId(courseId) })
      .exec();

    if (!enrollment) {
      throw new NotFoundException('Enrollment not found');
    }

    enrollment.status = 'dropped';
    await enrollment.save();
  }
}
