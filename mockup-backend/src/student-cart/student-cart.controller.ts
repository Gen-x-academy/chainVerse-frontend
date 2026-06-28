import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
} from '@nestjs/common';
import { StudentCartService } from './student-cart.service';

@Controller('students/:studentId/cart')
export class StudentCartController {
  constructor(private readonly cartService: StudentCartService) {}

  @Post(':courseId')
  addToCart(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.cartService.addToCart(studentId, courseId);
  }

  @Get()
  getCart(@Param('studentId') studentId: string) {
    return this.cartService.getCart(studentId);
  }

  @Delete(':courseId')
  removeFromCart(
    @Param('studentId') studentId: string,
    @Param('courseId') courseId: string,
  ) {
    return this.cartService.removeFromCart(studentId, courseId);
  }

  @Delete()
  clearCart(@Param('studentId') studentId: string) {
    return this.cartService.clearCart(studentId);
  }
}
