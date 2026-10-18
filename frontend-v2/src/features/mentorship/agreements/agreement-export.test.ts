import { describe, expect, it } from 'vitest';
import {
  AGREEMENT_EXPORT_LINK_TTL_MS,
  AGREEMENT_EXPORT_PRIVATE_FIELDS,
  AGREEMENT_EXPORT_RATE_LIMIT_MAX,
  AGREEMENT_EXPORT_RATE_LIMIT_WINDOW_MS,
  agreementExportError,
  buildAgreementExportBundle,
  canParticipantExportAgreement,
  createAgreementExportState,
  downloadAgreementExport,
  isAgreementExportLinkExpired,
  requestAgreementExport,
} from './agreement-export';
import type {
  AgreementExportSource,
  AgreementExportState,
  AgreementParticipant,
} from './agreement-export';

const NOW = new Date('2026-05-01T10:00:00.000Z');

const MENTOR: AgreementParticipant = { userId: 'mentor-1', role: 'mentor' };
const MENTEE: AgreementParticipant = { userId: 'mentee-1', role: 'mentee' };

function source(overrides: Partial<AgreementExportSource> = {}): AgreementExportSource {
  return {
    agreementId: 'agreement-1',
    engagementId: 'engagement-1',
    participants: [MENTOR, MENTEE],
    terms: {
      version: 3,
      acceptedAt: '2026-04-01T09:00:00.000Z',
      goals: ['Ship a portfolio project'],
      sessionsPerMonth: 2,
      sessionMinutes: 60,
      startDate: '2026-04-01',
      endDate: '2026-06-30',
      communicationChannel: 'video',
      confidentiality: true,
      paymentTerms: 'Paid monthly',
      internalNotes: 'INTERNAL-TERMS-SECRET',
    },
    amendments: [
      {
        id: 'amendment-2',
        baseVersion: 1,
        proposedBy: MENTEE.userId,
        proposedAt: '2026-04-10T09:00:00.000Z',
        reason: 'Add a second session each month',
        changes: { sessionsPerMonth: 2, goals: ['Ship a portfolio project', 'Write a case study'] },
        status: 'accepted',
        acceptedBy: [MENTEE.userId, MENTOR.userId],
        internalNote: 'INTERNAL-AMENDMENT-SECRET',
      },
    ],
    approvals: [
      {
        id: 'approval-1',
        participantId: MENTOR.userId,
        role: 'mentor',
        version: 3,
        decision: 'accepted',
        decidedAt: '2026-04-01T09:30:00.000Z',
        internalNote: 'INTERNAL-APPROVAL-SECRET',
      },
      {
        id: 'approval-2',
        participantId: MENTEE.userId,
        role: 'mentee',
        version: 3,
        decision: 'accepted',
        decidedAt: '2026-04-01T10:00:00.000Z',
      },
    ],
    sessions: [
      {
        id: 'session-2',
        startedAt: '2026-04-20T10:00:00.000Z',
        durationMinutes: 60,
        status: 'completed',
        privateNote: 'INTERNAL-SESSION-SECRET',
      },
      {
        id: 'session-1',
        startedAt: '2026-04-05T10:00:00.000Z',
        durationMinutes: 45,
        status: 'cancelled',
        privateNote: 'INTERNAL-CANCELLED-SECRET',
      },
      {
        id: 'session-3',
        startedAt: '2026-04-27T10:00:00.000Z',
        durationMinutes: 0,
        status: 'no-show',
      },
    ],
    financials: {
      currency: 'USDC',
      agreedMinor: 50_000,
      paidMinor: 30_000,
      refundedMinor: 5_000,
    },
    ...overrides,
  };
}

function request(
  state: AgreementExportState,
  input: Partial<Parameters<typeof requestAgreementExport>[1]> = {},
) {
  return requestAgreementExport(state, {
    agreement: source(),
    actorId: MENTEE.userId,
    now: NOW,
    idFactory: () => 'job-1',
    tokenFactory: () => 'token-1',
    ...input,
  });
}

describe('agreement export authorization', () => {
  it('denies a principal who is not a participant and audits the attempt', () => {
    const outcome = request(createAgreementExportState(), { actorId: 'stranger' });

    expect(outcome.result).toEqual({
      ok: false,
      error: agreementExportError('NOT_A_PARTICIPANT'),
    });
    expect(outcome.state.jobs).toHaveLength(0);
    expect(outcome.state.audit).toEqual([
      expect.objectContaining({
        actorId: 'stranger',
        action: 'request',
        outcome: 'denied',
        reason: 'NOT_A_PARTICIPANT',
      }),
    ]);
  });

  it('resolves only declared participants', () => {
    expect(canParticipantExportAgreement(source(), MENTOR.userId)).toEqual(MENTOR);
    expect(canParticipantExportAgreement(source(), MENTEE.userId)).toEqual(MENTEE);
    expect(canParticipantExportAgreement(source(), 'guardian-1')).toBeUndefined();
  });

  it('rejects malformed agreement records with a stable error', () => {
    const outcome = request(createAgreementExportState(), {
      agreement: source({ financials: { currency: 'USDC', agreedMinor: -1, paidMinor: 0, refundedMinor: 0 } }),
    });

    expect(outcome.result).toEqual({
      ok: false,
      error: agreementExportError('INVALID_AGREEMENT'),
    });
  });

  it('rejects unsupported formats before generating a record', () => {
    const outcome = request(createAgreementExportState(), {
      format: 'pdf' as never,
    });

    expect(outcome.result).toEqual({
      ok: false,
      error: agreementExportError('INVALID_FORMAT'),
    });
  });
});

describe('agreement export contents', () => {
  it('exports accepted terms, amendments, approvals, session summary and financial summary', () => {
    const outcome = request(createAgreementExportState());
    expect(outcome.result.ok).toBe(true);
    if (!outcome.result.ok) return;

    const { bundle } = outcome.result.value.job;
    expect(bundle.schemaVersion).toBe(1);
    expect(bundle.generatedFor).toEqual({ participantId: MENTEE.userId, role: 'mentee' });
    expect(bundle.terms).toMatchObject({
      version: 3,
      goals: ['Ship a portfolio project'],
      sessionsPerMonth: 2,
      sessionMinutes: 60,
      communicationChannel: 'video',
      confidentiality: true,
      paymentTerms: 'Paid monthly',
    });
    expect(bundle.amendments).toEqual([
      expect.objectContaining({
        id: 'amendment-2',
        baseVersion: 1,
        status: 'accepted',
        acceptedBy: [MENTEE.userId, MENTOR.userId],
        changes: {
          sessionsPerMonth: 2,
          goals: ['Ship a portfolio project', 'Write a case study'],
        },
      }),
    ]);
    expect(bundle.approvals).toEqual([
      expect.objectContaining({ id: 'approval-1', version: 3, decision: 'accepted' }),
      expect.objectContaining({ id: 'approval-2', version: 3, decision: 'accepted' }),
    ]);
    expect(bundle.sessions).toMatchObject({
      total: 3,
      completed: 1,
      cancelled: 1,
      noShow: 1,
      scheduled: 0,
      completedMinutes: 60,
      firstStartedAt: '2026-04-05T10:00:00.000Z',
      lastStartedAt: '2026-04-27T10:00:00.000Z',
    });
    expect(bundle.sessions.items.map((session) => session.id)).toEqual([
      'session-1',
      'session-2',
      'session-3',
    ]);
    expect(bundle.financials).toEqual({
      currency: 'USDC',
      agreedMinor: 50_000,
      paidMinor: 30_000,
      refundedMinor: 5_000,
      outstandingMinor: 25_000,
    });
    expect(bundle.privacy).toEqual({
      privateNotesExcluded: true,
      excludedFields: [...AGREEMENT_EXPORT_PRIVATE_FIELDS],
    });
  });

  it('never serializes private notes or unknown fields', () => {
    const bundle = buildAgreementExportBundle(source(), MENTEE, NOW);
    const serialized = JSON.stringify(bundle);

    expect(serialized).not.toContain('INTERNAL-TERMS-SECRET');
    expect(serialized).not.toContain('INTERNAL-APPROVAL-SECRET');
    expect(serialized).not.toContain('INTERNAL-AMENDMENT-SECRET');
    expect(serialized).not.toContain('INTERNAL-SESSION-SECRET');
    expect(serialized).not.toContain('INTERNAL-CANCELLED-SECRET');
    expect(serialized).not.toContain('"privateNote":');
    expect(serialized).not.toContain('"internalNote":');
    expect(serialized).not.toContain('"internalNotes":');
  });

  it('strips unknown amendment change keys at runtime', () => {
    const withUnknown = source({
      amendments: [
        {
          ...source().amendments![0],
          changes: {
            sessionsPerMonth: 2,
            internalNote: 'INTERNAL-CHANGE-SECRET',
          } as never,
        },
      ],
    });

    const bundle = buildAgreementExportBundle(withUnknown, MENTEE, NOW);
    expect(bundle.amendments[0].changes).toEqual({ sessionsPerMonth: 2 });
  });
});

describe('agreement export rate limiting and idempotency', () => {
  it('allows the configured number of exports then returns a retry window', () => {
    let state = createAgreementExportState();
    for (let index = 0; index < AGREEMENT_EXPORT_RATE_LIMIT_MAX; index += 1) {
      const outcome = request(state, {
        now: new Date(NOW.getTime() + index * 1000),
        idFactory: () => `job-${index}`,
        tokenFactory: () => `token-${index}`,
      });
      expect(outcome.result.ok).toBe(true);
      state = outcome.state;
    }

    const limited = request(state, {
      now: new Date(NOW.getTime() + 10_000),
      idFactory: () => 'job-limited',
      tokenFactory: () => 'token-limited',
    });

    expect(limited.result).toEqual({
      ok: false,
      error: agreementExportError('RATE_LIMITED', AGREEMENT_EXPORT_RATE_LIMIT_WINDOW_MS - 10_000),
    });
    expect(limited.state.jobs).toHaveLength(AGREEMENT_EXPORT_RATE_LIMIT_MAX);
    expect(limited.state.audit.at(-1)).toMatchObject({
      action: 'request',
      outcome: 'denied',
      reason: 'RATE_LIMITED',
    });
  });

  it('returns the same job for a retried idempotency key without new effects', () => {
    const first = request(createAgreementExportState(), { idempotencyKey: 'retry-key' });
    expect(first.result.ok).toBe(true);
    if (!first.result.ok) return;

    const retry = request(first.state, {
      idempotencyKey: 'retry-key',
      now: new Date(NOW.getTime() + 5_000),
      idFactory: () => 'job-2',
      tokenFactory: () => 'token-2',
    });

    expect(retry.result.ok).toBe(true);
    if (!retry.result.ok) return;
    expect(retry.result.value.job).toBe(first.result.value.job);
    expect(retry.state.jobs).toHaveLength(1);
    expect(retry.state.audit).toHaveLength(1);
  });

  it('does not let a retried idempotency key bypass the rate limit for other requests', () => {
    let state = createAgreementExportState();
    for (let index = 0; index < AGREEMENT_EXPORT_RATE_LIMIT_MAX; index += 1) {
      state = request(state, {
        now: new Date(NOW.getTime() + index * 1000),
        idFactory: () => `job-${index}`,
        tokenFactory: () => `token-${index}`,
      }).state;
    }

    const retried = request(state, {
      idempotencyKey: 'new-key',
      now: new Date(NOW.getTime() + 10_000),
      idFactory: () => 'job-limited',
      tokenFactory: () => 'token-limited',
    });

    expect(retried.result.ok).toBe(false);
    if (retried.result.ok) return;
    expect(retried.result.error.code).toBe('RATE_LIMITED');
  });
});

describe('agreement export download links', () => {
  it('downloads a ready bundle once and records the audit entry', () => {
    const requested = request(createAgreementExportState());
    expect(requested.result.ok).toBe(true);
    if (!requested.result.ok) return;

    const downloaded = downloadAgreementExport(requested.state, {
      token: requested.result.value.job.downloadToken,
      actorId: MENTEE.userId,
      now: new Date(NOW.getTime() + 1000),
    });
    expect(downloaded.result.ok).toBe(true);
    if (!downloaded.result.ok) return;
    expect(downloaded.result.value.bundle).toEqual(requested.result.value.job.bundle);
    expect(downloaded.result.value.job.downloadedAt).toBe('2026-05-01T10:00:01.000Z');
    expect(downloaded.state.audit.at(-1)).toMatchObject({
      action: 'download',
      outcome: 'success',
    });

    const retry = downloadAgreementExport(downloaded.state, {
      token: requested.result.value.job.downloadToken,
      actorId: MENTEE.userId,
      now: new Date(NOW.getTime() + 2000),
    });
    expect(retry.result.ok).toBe(true);
    expect(retry.state).toBe(downloaded.state);
    expect(retry.state.audit).toHaveLength(downloaded.state.audit.length);
  });

  it('rejects an expired link and marks the job expired', () => {
    const requested = request(createAgreementExportState());
    expect(requested.result.ok).toBe(true);
    if (!requested.result.ok) return;

    const expired = downloadAgreementExport(requested.state, {
      token: requested.result.value.job.downloadToken,
      actorId: MENTEE.userId,
      now: new Date(NOW.getTime() + AGREEMENT_EXPORT_LINK_TTL_MS),
    });

    expect(expired.result).toEqual({
      ok: false,
      error: agreementExportError('LINK_EXPIRED'),
    });
    expect(expired.state.jobs[0].status).toBe('expired');
    expect(expired.state.audit.at(-1)).toMatchObject({
      action: 'download',
      outcome: 'denied',
      reason: 'LINK_EXPIRED',
    });
  });

  it('rejects another participant using the link', () => {
    const requested = request(createAgreementExportState());
    expect(requested.result.ok).toBe(true);
    if (!requested.result.ok) return;

    const denied = downloadAgreementExport(requested.state, {
      token: requested.result.value.job.downloadToken,
      actorId: MENTOR.userId,
      now: new Date(NOW.getTime() + 1000),
    });

    expect(denied.result).toEqual({
      ok: false,
      error: agreementExportError('LINK_NOT_OWNED'),
    });
    expect(denied.state.audit.at(-1)).toMatchObject({
      outcome: 'denied',
      reason: 'LINK_NOT_OWNED',
    });
  });

  it('rejects an unknown token', () => {
    const denied = downloadAgreementExport(createAgreementExportState(), {
      token: 'missing',
      actorId: MENTEE.userId,
      now: NOW,
    });

    expect(denied.result).toEqual({
      ok: false,
      error: agreementExportError('LINK_NOT_FOUND'),
    });
  });

  it('treats the exact expiry instant as expired', () => {
    const job = { expiresAt: NOW.toISOString() };
    expect(isAgreementExportLinkExpired(job, NOW)).toBe(true);
    expect(isAgreementExportLinkExpired(job, new Date(NOW.getTime() - 1))).toBe(false);
  });
});
