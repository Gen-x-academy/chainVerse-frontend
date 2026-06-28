import { Controller, Get } from '@nestjs/common';
import { PrometheusController } from '@willsoto/nestjs-prometheus';

@Controller('metrics')
export class MetricsController extends PrometheusController {
  // This controller will be registered on a separate internal port (9090)
  // to prevent public access to Prometheus metrics
}
