import { Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseRatingsFeedbackModule } from './course-ratings-feedback/course-ratings-feedback.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { TutorCourseModule } from './tutor-course/tutor-course.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
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
  ],
})
export class AppModule {}
