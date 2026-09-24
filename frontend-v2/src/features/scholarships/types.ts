export type ScholarshipProgram = 'scholarship' | 'bursary' | 'sponsorship';

export type ScholarshipApplicationInput = {
  id?: string;
  applicantName: string;
  email: string;
  programId: string;
  programName: string;
  programVersion?: string;
  submittedAt?: string;
  institution?: string;
  answers?: Record<string, string | number | boolean | null>;
};

export type ScholarshipApplicationRecord = ScholarshipApplicationInput & {
  id: string;
  status: 'submitted';
  createdAt: string;
};

export type ScholarshipSubmissionReceipt = {
  applicationId: string;
  programVersion: string;
  submittedAt: string;
  integrityCommitment: string;
  status: 'submitted';
};

export type ScholarshipSubmissionResponse = {
  ok: true;
  application: ScholarshipApplicationRecord;
  receipt: ScholarshipSubmissionReceipt;
};
