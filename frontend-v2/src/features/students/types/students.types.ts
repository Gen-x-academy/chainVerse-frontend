export enum StudentStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  GRADUATED = 'GRADUATED',
  SUSPENDED = 'SUSPENDED',
}

export interface Student {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  enrollmentDate: string;
  status: StudentStatus;
  courseIds: string[]; // Reference to Course IDs
  avatarUrl?: string;
  bio?: string;
}

export type StudentSummary = Pick<Student, 'id' | 'firstName' | 'lastName' | 'avatarUrl' | 'status'>;

export interface EnrollmentRecord {
  studentId: string;
  courseId: string;
  enrolledAt: string;
  progress: number; // Percentage 0-100
}
