import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { Enrollment, EnrollmentSchema } from './schemas/enrollment.schema';
import { StudentEnrollmentService } from './student-enrollment.service';
import { StudentEnrollmentController } from './student-enrollment.controller';
import { CourseSchema } from '../schemas/course.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Enrollment.name, schema: EnrollmentSchema },
      { name: 'Course', schema: CourseSchema },
    ]),
  ],
  providers: [StudentEnrollmentService],
  controllers: [StudentEnrollmentController],
  exports: [StudentEnrollmentService],
})
export class StudentEnrollmentModule {}
