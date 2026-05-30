import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import {
  PrivateTutoringBooking,
  PrivateTutoringBookingSchema,
} from './schemas/private-tutoring-booking.schema';
import { PrivateTutoringBookingsService } from './private-tutoring-bookings.service';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: PrivateTutoringBooking.name, schema: PrivateTutoringBookingSchema },
    ]),
  ],
  providers: [PrivateTutoringBookingsService],
  exports: [PrivateTutoringBookingsService],
})
export class PrivateTutoringBookingsModule {}
