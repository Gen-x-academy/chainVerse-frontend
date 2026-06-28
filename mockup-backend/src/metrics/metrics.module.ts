import { Module } from '@nestjs/common';
import { PrometheusModule } from '@willsoto/nestjs-prometheus';
import { MetricsController } from './metrics.controller';

@Module({
  imports: [
    PrometheusModule.register({
      path: 'metrics',
      defaultMetrics: {
        enabled: true,
        config: {
          labels: {
            app: 'chainverse-backend',
          },
        },
      },
    }),
  ],
  controllers: [MetricsController],
})
export class MetricsModule {}
