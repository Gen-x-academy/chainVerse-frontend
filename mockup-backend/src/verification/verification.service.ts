import { Injectable } from '@nestjs/common';
import { VerificationLogRepository } from './verification-log.repository';
import { VerificationLog } from './verification-log.entity';

@Injectable()
export class VerificationService {
  constructor(private readonly logRepo: VerificationLogRepository) {}

  async logAttempt(dto: Partial<VerificationLog>) {
    return this.logRepo.create(dto);
  }

  async getLogsForUser(userId: string) {
    return this.logRepo.findByUser(userId);
  }
}
