import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  
  // Enable shutdown hooks for proper SIGTERM handling
  // This triggers NestJS lifecycle onModuleDestroy hooks, including Mongoose connection close
  app.enableShutdownHooks();
  
  await app.listen(3000);
}
bootstrap();
