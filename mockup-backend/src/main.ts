import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { MetricsModule } from "./metrics/metrics.module";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable shutdown hooks for proper SIGTERM handling
  // This triggers NestJS lifecycle onModuleDestroy hooks, including Mongoose connection close
  app.enableShutdownHooks();

  // Main API on port 3000
  await app.listen(3000);

  // Metrics on separate internal port 9090 (not accessible outside cluster)
  const metricsApp = await NestFactory.create(MetricsModule);
  await metricsApp.listen(9090);
}
bootstrap();
