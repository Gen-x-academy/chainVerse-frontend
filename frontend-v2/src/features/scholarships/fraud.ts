/**
 * Scholarship fraud signals (issues #1146 and #1147).
 *
 * Flags likely duplicate applicants, reused documents, manipulated evidence,
 * and coordinated submissions, and identifies unusual payout destinations,
 * rapid wallet changes, repeated failures, duplicate ledger references, and
 * suspicious splits. Every signal is explainable, protects sensitive evidence,
 * never auto-rejects, and always routes to a human review that can be appealed.
 */

import { apiClient } from '@/src/lib/api-client';

export type FraudSignalCode =
  | 'UNUSUAL_DESTINATION'
  | 'RAPID_WALLET_CHANGE'
  | 'REPEATED_PAYOUT_FAILURE'
  | 'DUPLICATE_LEDGER_REFERENCE'
  | 'SUSPICIOUS_SPLIT'
  | 'DUPLICATE_APPLICANT'
  | 'REUSED_DOCUMENT'
  | 'MANIPULATED_EVIDENCE'
  | 'COORDINATED_SUBMISSION';

export type FraudSeverity = 'low' | 'medium' | 'high';

export type FraudSignal = {
  code: FraudSignalCode;
  severity: FraudSeverity;
  /** Human-readable, explainable evidence. */
  evidence: string[];
  /** Signals inform a human reviewer; they never auto-reject. */
  requiresHumanReview: true;
};

export type PayoutIntent = {
  id: string;
  awardId: string;
  destination: string;
  amount: number;
  asset: string;
  submittedAt: string;
  ledgerRef?: string;
  failed?: boolean;
  splitFrom?: string;
};

export type WalletHistoryEntry = {
  awardId: string;
  destination: string;
  changedAt: string;
};

export type ApplicantRecord = {
  id: string;
  applicantId: string;
  identityHash: string;
  documentHashes: string[];
  submittedAt: string;
  deviceFingerprint?: string;
};

export type FraudSummary = {
  total: number;
  score: number;
  bySeverity: Record<FraudSeverity, number>;
  requiresHumanReview: true;
};

export const HIGH_RISK_PAYOUT_SCORE = 60;
export const AUTO_PAUSE_SCORE = 80;
export const REPEATED_FAILURE_THRESHOLD = 3;
export const MIN_COORDINATED_SUBMISSIONS = 3;
export const RAPID_WALLET_CHANGE_WINDOW_MS = 24 * 60 * 60 * 1000;
export const COORDINATION_WINDOW_MS = 60 * 60 * 1000;

const SEVERITY_SCORE: Record<FraudSeverity, number> = { low: 10, medium: 25, high: 45 };

function signal(code: FraudSignalCode, severity: FraudSeverity, evidence: string[]): FraudSignal {
  return { code, severity, evidence, requiresHumanReview: true };
}

export function detectPayoutAnomalies(input: {
  intent: PayoutIntent;
  walletHistory: WalletHistoryEntry[];
  recentIntents: PayoutIntent[];
  ledgerRefs: string[];
  now?: Date;
}): FraudSignal[] {
  const now = input.now ?? new Date();
  const { intent, walletHistory, recentIntents, ledgerRefs } = input;
  const signals: FraudSignal[] = [];

  const destinationUses = walletHistory.filter(
    (entry) => entry.destination === intent.destination
  ).length;
  if (destinationUses < 2) {
    signals.push(
      signal('UNUSUAL_DESTINATION', 'medium', [
        `Destination has only ${destinationUses} prior use(s) in this program.`,
      ])
    );
  }

  const latestChange = walletHistory
    .filter((entry) => entry.awardId === intent.awardId)
    .map((entry) => Date.parse(entry.changedAt))
    .filter((timestamp) => !Number.isNaN(timestamp))
    .sort((left, right) => right - left)[0];

  if (latestChange !== undefined && now.getTime() - latestChange <= RAPID_WALLET_CHANGE_WINDOW_MS) {
    signals.push(
      signal('RAPID_WALLET_CHANGE', 'high', [
        `Award ${intent.awardId} changed its payout destination within 24 hours of this attempt.`,
      ])
    );
  }

  const failures = recentIntents.filter(
    (candidate) => candidate.awardId === intent.awardId && candidate.failed
  ).length;
  if (failures >= REPEATED_FAILURE_THRESHOLD) {
    signals.push(
      signal('REPEATED_PAYOUT_FAILURE', 'medium', [
        `${failures} failed payout attempts for award ${intent.awardId}.`,
      ])
    );
  }

  if (intent.ledgerRef) {
    const duplicates = ledgerRefs.filter((ref) => ref === intent.ledgerRef).length;
    if (duplicates > 1) {
      signals.push(
        signal('DUPLICATE_LEDGER_REFERENCE', 'high', [
          `Ledger reference ${intent.ledgerRef} appears ${duplicates} times.`,
        ])
      );
    }
  }

  if (intent.splitFrom) {
    signals.push(
      signal('SUSPICIOUS_SPLIT', 'medium', [
        `Payout ${intent.id} is a split of payout ${intent.splitFrom}.`,
      ])
    );
  }

  return signals;
}

export function detectIdentityAbuse(input: {
  applicants: ApplicantRecord[];
  manipulatedDocumentHashes?: string[];
}): FraudSignal[] {
  const { applicants } = input;
  const manipulated = new Set(input.manipulatedDocumentHashes ?? []);
  const signals: FraudSignal[] = [];

  const identityGroups = new Map<string, string[]>();
  const documentGroups = new Map<string, string[]>();

  for (const applicant of applicants) {
    const identities = identityGroups.get(applicant.identityHash) ?? [];
    identities.push(applicant.id);
    identityGroups.set(applicant.identityHash, identities);

    for (const documentHash of applicant.documentHashes) {
      const documents = documentGroups.get(documentHash) ?? [];
      documents.push(applicant.id);
      documentGroups.set(documentHash, documents);
    }
  }

  for (const [identityHash, ids] of identityGroups) {
    if (ids.length > 1) {
      signals.push(
        signal('DUPLICATE_APPLICANT', 'high', [
          `Identity ${identityHash} appears in ${ids.length} applications: ${ids.join(', ')}.`,
        ])
      );
    }
  }

  for (const [documentHash, ids] of documentGroups) {
    if (ids.length > 1) {
      signals.push(
        signal('REUSED_DOCUMENT', 'high', [
          `Document ${documentHash} is attached to ${ids.length} applications.`,
        ])
      );
    }
    if (manipulated.has(documentHash)) {
      signals.push(
        signal('MANIPULATED_EVIDENCE', 'high', [
          `Document ${documentHash} matches known manipulated evidence.`,
        ])
      );
    }
  }

  const byDevice = new Map<string, ApplicantRecord[]>();
  for (const applicant of applicants) {
    if (!applicant.deviceFingerprint) continue;
    const group = byDevice.get(applicant.deviceFingerprint) ?? [];
    group.push(applicant);
    byDevice.set(applicant.deviceFingerprint, group);
  }

  for (const group of byDevice.values()) {
    const timestamps = group
      .map((applicant) => Date.parse(applicant.submittedAt))
      .filter((timestamp) => !Number.isNaN(timestamp))
      .sort((left, right) => left - right);
    const span = timestamps.length > 1 ? timestamps[timestamps.length - 1] - timestamps[0] : 0;
    if (group.length >= MIN_COORDINATED_SUBMISSIONS && span <= COORDINATION_WINDOW_MS) {
      signals.push(
        signal('COORDINATED_SUBMISSION', 'medium', [
          `${group.length} applications were submitted from the same device within an hour.`,
        ])
      );
    }
  }

  return signals;
}

export function scoreFraudSignals(signals: FraudSignal[]): number {
  return Math.min(
    100,
    signals.reduce((total, current) => total + SEVERITY_SCORE[current.severity], 0)
  );
}

/** High-risk payouts pause for review — they are never rejected automatically. */
export function shouldPausePayout(signals: FraudSignal[]): boolean {
  return signals.some((current) => current.severity === 'high') || scoreFraudSignals(signals) >= AUTO_PAUSE_SCORE;
}

/** Replaces long identifiers so logs and screenshots never carry sensitive evidence. */
export function redactFraudEvidence(evidence: string[]): string[] {
  return evidence.map((line) => line.replace(/\b[0-9a-f]{16,}\b/gi, '[redacted]'));
}

const SENSITIVE_EVIDENCE_KEY = /biometric|fingerprint|identityhash|documenthash|passport|ssn/i;

export function assertNoSensitiveEvidence(keys: string[]): string[] {
  return keys.filter((key) => SENSITIVE_EVIDENCE_KEY.test(key));
}

export function summarizeFraudSignals(signals: FraudSignal[]): FraudSummary {
  return {
    total: signals.length,
    score: scoreFraudSignals(signals),
    bySeverity: {
      low: signals.filter((signalItem) => signalItem.severity === 'low').length,
      medium: signals.filter((signalItem) => signalItem.severity === 'medium').length,
      high: signals.filter((signalItem) => signalItem.severity === 'high').length,
    },
    requiresHumanReview: true,
  };
}

export const scholarshipFraudService = {
  applicationSignals: (applicationId: string): Promise<FraudSignal[]> =>
    apiClient.get<FraudSignal[]>(`/scholarships/applications/${applicationId}/fraud-signals`),

  payoutAlerts: (awardId: string): Promise<FraudSignal[]> =>
    apiClient.get<FraudSignal[]>(`/scholarships/awards/${awardId}/payout-alerts`),

  resolveAlert: (
    alertId: string,
    payload: { decision: 'cleared' | 'escalated'; note: string }
  ): Promise<{ id: string; decidedAt: string }> =>
    apiClient.post<{ id: string; decidedAt: string }>(
      `/scholarships/fraud-alerts/${alertId}/resolve`,
      payload
    ),
};
