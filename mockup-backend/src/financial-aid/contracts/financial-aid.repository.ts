export interface ApplyForFinancialAidDto {
  studentId: string;
  courseId: string;
  reason?: string;
}

export interface FinancialAidApplication {
  id: string;
  studentId: string;
  courseId: string;
  reason?: string;
  createdAt: Date;
}

export interface FinancialAidRepository {
  findByStudentAndCourse(
    studentId: string,
    courseId: string,
  ): Promise<FinancialAidApplication | null>;
  save(dto: ApplyForFinancialAidDto): Promise<FinancialAidApplication>;
}
