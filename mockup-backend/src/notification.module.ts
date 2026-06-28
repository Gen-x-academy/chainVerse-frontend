import { Module } from '@nestjs/common';
import { NotificationController } from './notification.controller';
import { EmailModule } from './email/email.module';
import { NotificationListener } from './events/listeners/notification.listener';

@Module({
  imports: [EmailModule],
  controllers: [NotificationController],
  providers: [NotificationListener],
})
export class NotificationModule {}
