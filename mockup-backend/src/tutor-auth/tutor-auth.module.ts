import { Module } from '@nestjs/common';
import { TutorAuthController } from './tutor-auth.controller';

@Module({
  controllers: [TutorAuthController],
})
export class TutorAuthModule {}
