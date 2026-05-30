import { ForbiddenException, Injectable } from '@nestjs/common';

interface StudentVerificationState {
  isVerified: boolean;
  verificationAttempts: number;
  maxVerificationAttempts: number;
}

@Injectable()
export class StudentAuthService {
  verifyEmail(state: StudentVerificationState, tokenIsValid: boolean) {
    if (state.verificationAttempts >= state.maxVerificationAttempts) {
      throw new ForbiddenException('Maximum verification attempts reached');
    }

    if (!tokenIsValid) {
      state.verificationAttempts += 1;
      return { ok: false, message: 'Invalid verification token' };
    }

    state.isVerified = true;
    return { ok: true };
  }
}
