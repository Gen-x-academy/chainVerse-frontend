import { Module } from "@nestjs/common";
import { ThrottlerModule } from "@nestjs/throttler";
import { ConfigModule, ConfigService } from "@nestjs/config";
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
  ],
})
export class AppModule {}
