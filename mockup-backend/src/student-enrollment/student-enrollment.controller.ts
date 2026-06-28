import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { StudentEnrollmentService } from './student-enrollment.service';

@Controller('students/:studentId/enrollments')
export class StudentEnrollmentController {
  constructor(private readonly enrollmentService: StudentEnrollmentService) {}

  @Post(':courseId')
  enroll(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentService.enroll(studentId, courseId);
  }

  @Get()
  getMyCourses(@Param('studentId') studentId: string) {
    return this.enrollmentService.getMyCourses(studentId);
  }

  @Delete(':courseId')
  unenroll(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.enrollmentService.unenroll(studentId, courseId);
  }
}
