import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { VerificationLog, VerificationLogSchema } from './verification-log.entity';
import { VerificationLogRepository } from './verification-log.repository';
import { VerificationService } from './verification.service';
import { VerificationController } from './verification.controller';

@Module({
  imports: [
    MongooseModule.forFeature([{ name: VerificationLog.name, schema: VerificationLogSchema }]),
  ],
  providers: [VerificationLogRepository, VerificationService],
  controllers: [VerificationController],
  exports: [VerificationService],
})
export class VerificationModule {}
