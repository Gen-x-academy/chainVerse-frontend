import { describe, expect, it } from 'vitest';
import {
  assertNoSensitiveEvidence,
  AUTO_PAUSE_SCORE,
  detectIdentityAbuse,
  detectPayoutAnomalies,
  redactFraudEvidence,
  scoreFraudSignals,
  shouldPausePayout,
  summarizeFraudSignals,
  type ApplicantRecord,
  type PayoutIntent,
  type WalletHistoryEntry,
} from '@/src/features/scholarships/fraud';

const now = new Date('2026-09-24T12:00:00.000Z');

const intent: PayoutIntent = {
  id: 'intent-1',
  awardId: 'award-1',
  destination: 'GNEWDESTINATIONAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
  amount: 500,
  asset: 'XLM',
  submittedAt: '2026-09-24T11:00:00.000Z',
  ledgerRef: 'ledger-ref-1',
};

describe('payout anomaly detection (#1147)', () => {
  it('flags an unusual destination, a rapid wallet change, and a suspicious split', () => {
    const history: WalletHistoryEntry[] = [
      { awardId: 'award-1', destination: 'GOLDDESTINATION', changedAt: '2026-09-24T11:30:00.000Z' },
    ];

    const signals = detectPayoutAnomalies({
      intent: { ...intent, splitFrom: 'intent-0' },
      walletHistory: history,
      recentIntents: [],
      ledgerRefs: ['ledger-ref-1'],
      now,
    });

    const codes = signals.map((signal) => signal.code);
    expect(codes).toContain('UNUSUAL_DESTINATION');
    expect(codes).toContain('RAPID_WALLET_CHANGE');
    expect(codes).toContain('SUSPICIOUS_SPLIT');
  });

  it('flags repeated failures and duplicate ledger references', () => {
    const failed: PayoutIntent[] = [
      { ...intent, id: 'intent-a', failed: true },
      { ...intent, id: 'intent-b', failed: true },
      { ...intent, id: 'intent-c', failed: true },
    ];

    const signals = detectPayoutAnomalies({
      intent,
      walletHistory: [
        { awardId: 'award-1', destination: intent.destination, changedAt: '2026-08-01T00:00:00.000Z' },
        { awardId: 'award-2', destination: intent.destination, changedAt: '2026-08-02T00:00:00.000Z' },
      ],
      recentIntents: failed,
      ledgerRefs: ['ledger-ref-1', 'ledger-ref-1'],
      now,
    });

    const codes = signals.map((signal) => signal.code);
    expect(codes).toContain('REPEATED_PAYOUT_FAILURE');
    expect(codes).toContain('DUPLICATE_LEDGER_REFERENCE');
    expect(codes).not.toContain('UNUSUAL_DESTINATION');
  });

  it('never auto-rejects and only pauses high-risk payouts', () => {
    const mediumOnly = detectPayoutAnomalies({
      intent,
      walletHistory: [],
      recentIntents: [],
      ledgerRefs: [],
      now,
    });

    expect(mediumOnly.length).toBeGreaterThan(0);
    expect(mediumOnly.every((signal) => signal.requiresHumanReview)).toBe(true);
    expect(shouldPausePayout(mediumOnly)).toBe(false);

    const withHighRisk = detectPayoutAnomalies({
      intent,
      walletHistory: [
        { awardId: 'award-1', destination: 'GOLDDESTINATION', changedAt: '2026-09-24T11:30:00.000Z' },
      ],
      recentIntents: [],
      ledgerRefs: [],
      now,
    });

    expect(shouldPausePayout(withHighRisk)).toBe(true);
    expect(AUTO_PAUSE_SCORE).toBe(80);
  });
});

describe('duplicate identity and document abuse (#1146)', () => {
  const applicants: ApplicantRecord[] = [
    { id: 'app-1', applicantId: 'student-1', identityHash: 'identity-a', documentHashes: ['doc-a'], submittedAt: '2026-09-24T10:00:00.000Z', deviceFingerprint: 'device-1' },
    { id: 'app-2', applicantId: 'student-2', identityHash: 'identity-a', documentHashes: ['doc-a', 'doc-b'], submittedAt: '2026-09-24T10:20:00.000Z', deviceFingerprint: 'device-1' },
    { id: 'app-3', applicantId: 'student-3', identityHash: 'identity-c', documentHashes: [], submittedAt: '2026-09-24T10:40:00.000Z', deviceFingerprint: 'device-1' },
  ];

  it('flags duplicate applicants, reused documents and coordinated submissions', () => {
    const signals = detectIdentityAbuse({ applicants });
    const codes = signals.map((signal) => signal.code);

    expect(codes).toContain('DUPLICATE_APPLICANT');
    expect(codes).toContain('REUSED_DOCUMENT');
    expect(codes).toContain('COORDINATED_SUBMISSION');
    expect(signals.every((signal) => signal.requiresHumanReview)).toBe(true);
  });

  it('flags known manipulated evidence', () => {
    const signals = detectIdentityAbuse({
      applicants,
      manipulatedDocumentHashes: ['doc-b'],
    });

    expect(signals.map((signal) => signal.code)).toContain('MANIPULATED_EVIDENCE');
  });

  it('scores, summarizes and protects sensitive evidence', () => {
    const signals = detectIdentityAbuse({ applicants });
    expect(scoreFraudSignals(signals)).toBeGreaterThan(0);

    const summary = summarizeFraudSignals(signals);
    expect(summary.total).toBe(signals.length);
    expect(summary.requiresHumanReview).toBe(true);

    expect(redactFraudEvidence(['identity abcdef0123456789abcdef0123456789 reused'])[0]).toContain(
      '[redacted]'
    );
    expect(assertNoSensitiveEvidence(['reason', 'documentHash', 'biometricTemplate'])).toEqual([
      'documentHash',
      'biometricTemplate',
    ]);
  });
});
