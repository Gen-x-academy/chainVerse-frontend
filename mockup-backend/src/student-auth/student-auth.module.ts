import { Module } from '@nestjs/common';
import { StudentAuthController } from './student-auth.controller';

@Module({
  controllers: [StudentAuthController],
})
export class StudentAuthModule {}
