import { NestFactory } from '@nestjs/core';
import { VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AppModule } from './app.module';
import { helmet } from "helmet";
async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enforce body size limits to prevent memory exhaustion from large payloads
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));
  app.use(helmet());
  app.enableCors({
    origin: process.env.ALLOWED_ORIGINS?.split(',') ?? 'http://localhost:3000',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  // URI-based versioning: /v1/student/register, /v1/courses, etc.
  // defaultVersion ensures undecorated controllers are served under v1.
  app.enableVersioning({
    type: VersioningType.URI,
    defaultVersion: '1',
  });

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? process.env.PORT ?? 3000;
  await app.listen(port);
}
bootstrap();
