import { ConflictException, Injectable } from '@nestjs/common';
import {
  ApplyForFinancialAidDto,
  FinancialAidRepository,
} from '../contracts/financial-aid.repository';

@Injectable()
export class ApplyForFinancialAidUseCase {
  constructor(private readonly repository: FinancialAidRepository) {}

  async execute(dto: ApplyForFinancialAidDto) {
    const existing = await this.repository.findByStudentAndCourse(
      dto.studentId,
      dto.courseId,
    );
    if (existing) throw new ConflictException('Application already submitted');
    return this.repository.save(dto);
  }
}
