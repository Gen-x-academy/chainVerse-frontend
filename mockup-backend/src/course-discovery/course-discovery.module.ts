import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CourseSchema } from '../schemas/course.schema';
import { CourseDiscoveryService } from './course-discovery.service';
import { CourseDiscoveryController } from './course-discovery.controller';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: 'Course', schema: CourseSchema },
    ]),
  ],
  providers: [CourseDiscoveryService],
  controllers: [CourseDiscoveryController],
  exports: [CourseDiscoveryService],
})
export class CourseDiscoveryModule {}
