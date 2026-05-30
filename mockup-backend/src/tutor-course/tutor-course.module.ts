import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { TutorCourseService } from './tutor-course.service';
import { TutorCourseController } from './tutor-course.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      {
        name: 'Course',
        schema: require('../schemas/course.schema').CourseSchema,
      },
    ]),
  ],
  providers: [TutorCourseService],
  controllers: [TutorCourseController],
})
export class TutorCourseModule {}
