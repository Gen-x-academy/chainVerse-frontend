import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { CartItem, CartItemSchema } from './schemas/cart-item.schema';
import { StudentCartService } from './student-cart.service';
import { StudentCartController } from './student-cart.controller';
import { CourseSchema } from '../schemas/course.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: CartItem.name, schema: CartItemSchema },
      { name: 'Course', schema: CourseSchema },
    ]),
  ],
  providers: [StudentCartService],
  controllers: [StudentCartController],
  exports: [StudentCartService],
})
export class StudentCartModule {}
