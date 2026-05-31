import { ForbiddenException, Injectable } from '@nestjs/common';

interface CheckoutInput {
  studentId: string;
  courseId: string;
  paymentConfirmed: boolean;
}

@Injectable()
export class CheckoutService {
  checkout(input: CheckoutInput) {
    if (!input.paymentConfirmed) {
      throw new ForbiddenException(
        'Payment must be processed before enrollment',
      );
    }

    return {
      ok: true,
      studentId: input.studentId,
      courseId: input.courseId,
      enrolled: true,
    };
  }
}
