/**
 * Sponsor impact reporting (issue #1159).
 *
 * Reports recipients, funded learning, completion, credentials, and aggregate
 * outcomes without overstating causality. Small groups are suppressed so an
 * individual learner cannot be inferred, and sponsors never receive the ability
 * to drill into an unauthorized student's data.
 */

import { apiClient } from '@/src/lib/api-client';
import { FUNNEL_DEFINITIONS_VERSION } from './analytics';

/** Groups smaller than this are suppressed to protect individual learners. */
export const SMALL_GROUP_THRESHOLD = 5;

export type SponsorImpactRow = {
  sponsorId: string;
  programId: string;
  studentId: string;
  fundedAmount: number;
  completed: boolean;
  credentialIssued: boolean;
};

export type SponsorImpactMetrics = {
  recipients: number | null;
  fundedLearners: number | null;
  completions: number | null;
  credentialsIssued: number | null;
  aggregateOutcomeRate: number | null;
};

export type SponsorImpactReport = {
  sponsorId: string;
  programId: string;
  generatedAt: string;
  definitionsVersion: string;
  smallGroupSuppressed: boolean;
  metrics: SponsorImpactMetrics;
  notes: string[];
};

export type SponsorImpactViewer = {
  id: string;
  role: 'sponsor' | 'reviewer' | 'support' | 'student';
};

function suppressedMetrics(): SponsorImpactMetrics {
  return {
    recipients: null,
    fundedLearners: null,
    completions: null,
    credentialsIssued: null,
    aggregateOutcomeRate: null,
  };
}

export function buildSponsorImpactReport(
  rows: SponsorImpactRow[],
  input: { sponsorId: string; programId: string; now?: Date }
): SponsorImpactReport {
  const now = input.now ?? new Date();
  const scoped = rows.filter(
    (row) => row.sponsorId === input.sponsorId && row.programId === input.programId
  );

  const base = {
    sponsorId: input.sponsorId,
    programId: input.programId,
    generatedAt: now.toISOString(),
    definitionsVersion: FUNNEL_DEFINITIONS_VERSION,
  };

  if (scoped.length < SMALL_GROUP_THRESHOLD) {
    return {
      ...base,
      smallGroupSuppressed: true,
      metrics: suppressedMetrics(),
      notes: [
        `Aggregate metrics are suppressed because fewer than ${SMALL_GROUP_THRESHOLD} recipients match this scope.`,
      ],
    };
  }

  const recipients = new Set(scoped.map((row) => row.studentId)).size;
  const completed = scoped.filter((row) => row.completed).length;
  const credentials = scoped.filter((row) => row.credentialIssued).length;

  return {
    ...base,
    smallGroupSuppressed: false,
    metrics: {
      recipients,
      fundedLearners: recipients,
      completions: completed,
      credentialsIssued: credentials,
      aggregateOutcomeRate: Number((completed / recipients).toFixed(4)),
    },
    notes: [
      'Outcomes are descriptive and do not establish that the scholarship caused the result.',
    ],
  };
}

/** Sponsors may never drill into individual student rows. */
export function canDrillIntoStudent(viewer: SponsorImpactViewer, row: SponsorImpactRow): boolean {
  if (viewer.role === 'student') return viewer.id === row.studentId;
  if (viewer.role === 'sponsor') return false;
  return true;
}

export const scholarshipImpactService = {
  report: (parameters: { sponsorId: string; programId: string }): Promise<SponsorImpactReport> => {
    const query = new URLSearchParams(parameters);
    return apiClient.get<SponsorImpactReport>(`/scholarships/impact?${query.toString()}`);
  },
};
