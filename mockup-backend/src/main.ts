import { NestFactory } from '@nestjs/core';
import { ConfigService } from '@nestjs/config';
import * as express from 'express';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enforce body size limits to prevent memory exhaustion from large payloads
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ limit: '1mb', extended: true }));

  app.enableShutdownHooks();

  const configService = app.get(ConfigService);
  const port = configService.get<number>('port') ?? 3000;
  await app.listen(port);
}
bootstrap();
