import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { AdminCourseService } from './admin-course.service';
import { Tutor, TutorSchema } from '../schemas/tutor.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Tutor.name, schema: TutorSchema },
    ]),
  ],
  providers: [AdminCourseService],
  exports: [AdminCourseService],
})
export class AdminCourseModule {}
