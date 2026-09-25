/**
 * Reference fixtures for Application Opening and Deadline Windows.
 */

import { buildApplicationWindow } from './domain';
import type {
  ApplicationWindow,
  SubmittedApplicationRecord,
} from './types';

export const mockApplicationWindows: ApplicationWindow[] = [
  buildApplicationWindow(
    {
      programId: 'prog-stellar-fellows-2026',
      programName: 'Stellar Developer Fellowship 2026',
      roundId: 'round-stellar-2026',
      name: 'Fall 2026 Main Application Window',
      description: 'Standard application opening and deadline window with 30-minute network grace period.',
      openDate: '2026-08-01',
      openTime: '09:00',
      closeDate: '2026-11-30',
      closeTime: '23:59',
      timeZone: 'Africa/Nairobi',
      gracePeriodMinutes: 30,
      lateSubmissionPolicy: 'strict_reject',
    },
    'win-stellar-fall-2026'
  ),

  buildApplicationWindow(
    {
      programId: 'prog-defi-scholars-2027',
      programName: 'Global DeFi Leaders Program 2027',
      roundId: 'round-defi-2027',
      name: 'Spring 2027 Priority Window',
      description: 'Priority scholarship application window with late waiver support.',
      openDate: '2026-10-15',
      openTime: '08:00',
      closeDate: '2027-01-15',
      closeTime: '17:00',
      timeZone: 'UTC',
      gracePeriodMinutes: 60,
      lateSubmissionPolicy: 'requires_waiver',
      lateCutoffDate: '2027-01-20',
      lateCutoffTime: '23:59',
    },
    'win-defi-spring-2027'
  ),

  buildApplicationWindow(
    {
      programId: 'prog-security-auditors-2026',
      programName: 'Smart Contract Auditor Grant',
      roundId: 'round-auditors-2026',
      name: 'Summer 2026 Intensive Window (Closed)',
      description: 'Completed summer cohort deadline window.',
      openDate: '2026-05-01',
      openTime: '00:00',
      closeDate: '2026-06-30',
      closeTime: '23:59',
      timeZone: 'America/New_York',
      gracePeriodMinutes: 15,
      lateSubmissionPolicy: 'allow_with_penalty',
      latePenaltyPercent: 15,
      lateCutoffDate: '2026-07-05',
      lateCutoffTime: '23:59',
    },
    'win-auditors-summer-2026'
  ),
];

export const mockSubmittedApplications: SubmittedApplicationRecord[] = [
  {
    id: 'app-sub-101',
    programId: 'prog-stellar-fellows-2026',
    roundId: 'round-stellar-2026',
    studentId: 'student-alpha-1',
    submittedAtUtc: '2026-11-20T14:30:00.000Z',
    receiptId: 'RCPT-2026-SUB101',
    status: 'submitted',
  },
  {
    id: 'app-sub-102',
    programId: 'prog-stellar-fellows-2026',
    roundId: 'round-stellar-2026',
    studentId: 'student-alpha-2',
    submittedAtUtc: '2026-11-28T18:45:00.000Z',
    receiptId: 'RCPT-2026-SUB102',
    status: 'submitted',
  },
  {
    id: 'app-sub-103',
    programId: 'prog-stellar-fellows-2026',
    roundId: 'round-stellar-2026',
    studentId: 'student-alpha-3',
    submittedAtUtc: '2026-11-30T20:45:00.000Z', // Submitted right near deadline
    receiptId: 'RCPT-2026-SUB103',
    status: 'submitted',
  },
];
