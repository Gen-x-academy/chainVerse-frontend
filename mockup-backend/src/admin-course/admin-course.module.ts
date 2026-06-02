import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminCourseService } from './admin-course.service';
import { AdminCourseController } from './admin-course.controller';
import { Tutor, TutorSchema } from '../schemas/tutor.schema';
import { CourseSchema } from '../schemas/course.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tutor.name, schema: TutorSchema },
      { name: 'Course', schema: CourseSchema },
    ]),
  ],
  providers: [AdminCourseService],
  controllers: [AdminCourseController],
  exports: [AdminCourseService],
})
export class AdminCourseModule {}
