import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { ThrottlerModule } from '@nestjs/throttler';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { CourseRatingsFeedbackModule } from './course-ratings-feedback/course-ratings-feedback.module';
import { AdminAuthModule } from './admin-auth/admin-auth.module';
import { TutorCourseModule } from './tutor-course/tutor-course.module';
import { StudentAuthModule } from './student-auth/student-auth.module';
import { GoogleAuthModule } from './google-auth/google-auth.module';
import { ContactMessageModule } from './contact-message/contact-message.module';
import { NotificationModule } from './notification.module';
import { PointsModule } from './points/points.module';
import { OrganizationModule } from './organization/organization.module';
import { OrganizationMemberModule } from './organization-member/organization-member.module';

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
    StudentAuthModule,
    GoogleAuthModule,
    ContactMessageModule,
    NotificationModule,
    PointsModule,
    OrganizationModule,
    OrganizationMemberModule,
  ],
})
export class AppModule {}
