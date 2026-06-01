import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseRatingsFeedbackModule } from './course-ratings-feedback/course-ratings-feedback.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { TutorCourseModule } from './tutor-course/tutor-course.module';
import { AdminCourseModule } from './admin-course/admin-course.module';
import { StudentAuthModule } from './student-auth/student-auth.module';
import { TutorAuthModule } from './tutor-auth/tutor-auth.module';
import { NotificationModule } from './notification.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
        serverSelectionTimeoutMS: 5000,
        connectTimeoutMS: 10000,
      }),
      inject: [ConfigService],
    }),
    CourseRatingsFeedbackModule,
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (config: ConfigService) => {
        const limits = config.get('throttler.limits') || [
          { ttl: 60, limit: 10 },
        ];
        return limits;
      },
      inject: [ConfigService],
    }),
    AdminAuthModule,
    TutorCourseModule,
    AdminCourseModule,
    StudentAuthModule,
    TutorAuthModule,
    NotificationModule,
  ],
})
export class AppModule {}
