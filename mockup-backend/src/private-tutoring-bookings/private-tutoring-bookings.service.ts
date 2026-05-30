import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import {
  PrivateTutoringBooking,
  PrivateTutoringBookingDocument,
} from './schemas/private-tutoring-booking.schema';

@Injectable()
export class PrivateTutoringBookingsService {
  constructor(
    @InjectModel(PrivateTutoringBooking.name)
    private readonly bookingModel: Model<PrivateTutoringBookingDocument>,
  ) {}

  async create(dto: Partial<PrivateTutoringBooking>): Promise<PrivateTutoringBookingDocument> {
    return this.bookingModel.create(dto);
  }

  async findAllByStudent(studentId: string): Promise<PrivateTutoringBookingDocument[]> {
    return this.bookingModel.find({ studentId: new Types.ObjectId(studentId) }).exec();
  }

  async findOne(id: string): Promise<PrivateTutoringBookingDocument> {
    const booking = await this.bookingModel.findById(id).exec();
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  async update(
    id: string,
    dto: Partial<PrivateTutoringBooking>,
  ): Promise<PrivateTutoringBookingDocument> {
    const booking = await this.bookingModel.findByIdAndUpdate(id, dto, { new: true }).exec();
    if (!booking) throw new NotFoundException(`Booking ${id} not found`);
    return booking;
  }

  async remove(id: string): Promise<void> {
    const result = await this.bookingModel.findByIdAndDelete(id).exec();
    if (!result) throw new NotFoundException(`Booking ${id} not found`);
  }
}
