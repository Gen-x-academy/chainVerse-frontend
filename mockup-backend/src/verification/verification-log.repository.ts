import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { VerificationLog, VerificationLogDocument } from './verification-log.entity';

@Injectable()
export class VerificationLogRepository {
  constructor(
    @InjectModel(VerificationLog.name)
    private readonly model: Model<VerificationLogDocument>,
  ) {}

  async create(dto: Partial<VerificationLog>): Promise<VerificationLogDocument> {
    return this.model.create(dto);
  }

  async findByUser(userId: string): Promise<VerificationLogDocument[]> {
    return this.model.find({ userId: new Types.ObjectId(userId) }).sort({ createdAt: -1 }).exec();
  }
}
