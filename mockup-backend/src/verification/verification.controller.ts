import { Controller, Get, Param } from '@nestjs/common';
import { VerificationService } from './verification.service';

@Controller('verification')
export class VerificationController {
  constructor(private readonly verificationService: VerificationService) {}

  @Get('logs/:userId')
  getLogs(@Param('userId') userId: string) {
    return this.verificationService.getLogsForUser(userId);
  }
}
