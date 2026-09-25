/**
 * Reference fixtures for Duplicate Prevention and Application Merges.
 */

import type {
  DuplicateCluster,
  ExistingApplicationSummary,
  ProgramUniquenessRule,
} from './types';

export const mockUniquenessRules: ProgramUniquenessRule[] = [
  {
    programId: 'prog-stellar-fellows-2026',
    scope: 'one_per_program_lifetime',
    maxApplicationsPerApplicant: 1,
    allowDraftResumption: true,
    lockTimeoutSeconds: 60,
  },
  {
    programId: 'prog-defi-scholars-2027',
    scope: 'one_per_round',
    maxApplicationsPerApplicant: 1,
    allowDraftResumption: true,
    lockTimeoutSeconds: 30,
  },
];

export const mockExistingApplications: ExistingApplicationSummary[] = [
  {
    id: 'app-dup-1',
    programId: 'prog-stellar-fellows-2026',
    roundId: 'round-stellar-2026',
    studentId: 'student-chidi-1',
    submittedAt: '2026-09-10T10:00:00.000Z',
    status: 'submitted',
    statementSummary:
      'Initial application focusing on Soroban smart contract development for African logistics networks.',
    requestedAmountCents: 250000,
    documents: [
      {
        id: 'doc-chidi-transcript',
        applicationId: 'app-dup-1',
        kind: 'transcript',
        fileName: 'chidi-transcript-official.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024 * 400,
        status: 'available',
        scanStatus: 'clean',
        uploadedAt: '2026-09-10T09:30:00.000Z',
        accessLogged: true,
      },
    ],
    receiptId: 'RCPT-2026-CHIDI-1',
    idempotencyKey: 'application.submit:student-chidi-1:round-stellar-2026:nonce-a',
  },
  {
    id: 'app-dup-2',
    programId: 'prog-stellar-fellows-2026',
    roundId: 'round-stellar-2026',
    studentId: 'student-chidi-1',
    submittedAt: '2026-09-12T14:15:00.000Z',
    status: 'under_review',
    statementSummary:
      'Revised application with expanded portfolio details on cross-border payments protocol architecture.',
    requestedAmountCents: 300000,
    documents: [
      {
        id: 'doc-chidi-portfolio',
        applicationId: 'app-dup-2',
        kind: 'portfolio',
        fileName: 'soroban-code-samples.zip',
        contentType: 'application/zip',
        sizeBytes: 1024 * 850,
        status: 'available',
        scanStatus: 'clean',
        uploadedAt: '2026-09-12T14:00:00.000Z',
        accessLogged: true,
      },
    ],
    receiptId: 'RCPT-2026-CHIDI-2',
    idempotencyKey: 'application.submit:student-chidi-1:round-stellar-2026:nonce-b',
  },
  {
    id: 'app-dup-3',
    programId: 'prog-defi-scholars-2027',
    roundId: 'round-defi-2027',
    studentId: 'student-amina-2',
    submittedAt: '2026-09-15T11:20:00.000Z',
    status: 'submitted',
    statementSummary:
      'Applying for decentralized finance scholarship to build algorithmic liquidity systems.',
    requestedAmountCents: 400000,
    documents: [],
    receiptId: 'RCPT-2026-AMINA-1',
  },
];

export const mockDuplicateClusters: DuplicateCluster[] = [
  {
    clusterId: 'cluster-chidi-stellar',
    studentId: 'student-chidi-1',
    studentName: 'Chidi Okonkwo',
    studentEmail: 'chidi.o@example.edu',
    programId: 'prog-stellar-fellows-2026',
    programName: 'Stellar Developer Fellowship 2026',
    applications: [mockExistingApplications[0], mockExistingApplications[1]],
    duplicateConfidence: 'exact_student_match',
    detectedAt: '2026-09-13T08:00:00.000Z',
  },
];
