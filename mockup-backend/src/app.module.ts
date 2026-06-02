import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseRatingsFeedbackModule } from './course-ratings-feedback/course-ratings-feedback.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { TutorCourseModule } from './tutor-course/tutor-course.module';
import { AdminCourseModule } from './admin-course/admin-course.module';
import { CourseDiscoveryModule } from './course-discovery/course-discovery.module';
import { StudentCartModule } from './student-cart/student-cart.module';
import { StudentEnrollmentModule } from './student-enrollment/student-enrollment.module';
import { ThrottlerStorageRedisService } from "@nest-lab/throttler-storage-redis";

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
        const redisUrl = config.get("redis.url");
        const limits = config.get("throttler.limits") || [
          { ttl: 60, limit: 10 },
        ];

        return {
          throttlers: limits,
          storage: redisUrl
            ? new ThrottlerStorageRedisService(redisUrl)
            : undefined,
        };
      },
      inject: [ConfigService],
    }),
    AdminAuthModule,
    TutorCourseModule,
    AdminCourseModule,
    CourseDiscoveryModule,
    StudentCartModule,
    StudentEnrollmentModule,
  ],
})
export class AppModule {}
