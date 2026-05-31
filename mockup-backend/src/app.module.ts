import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseRatingsFeedbackModule } from './course-ratings-feedback/course-ratings-feedback.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { TutorCourseModule } from './tutor-course/tutor-course.module';
import { HealthModule } from './health/health.module';
import { SubscriptionPlanModule } from './subscription-plan/subscription-plan.module';
import { FaqManagementModule } from './faq-management/faq-management.module';
import { GamificationPointsModule } from './gamification-points/gamification-points.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRootAsync({
      useFactory: (config: ConfigService) => ({
        uri: config.get<string>('MONGO_URI'),
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
    HealthModule,
    SubscriptionPlanModule,
    FaqManagementModule,
    GamificationPointsModule,
  ],
})
export class AppModule {}
