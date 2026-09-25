import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { validateSupportingDocument } from '@/src/features/scholarships/documents';
import { decideIdempotentMutation, fingerprintRequest } from '@/src/features/scholarships/idempotency';
import { canPerform } from '@/src/features/scholarships/rbac';
import {
  decideInvitationUse,
  isWalletBoundToRecipient,
  type ScholarshipInvitation,
} from '@/src/features/scholarships/security';
import { signWebhookPayload, verifyWebhookSignature } from '@/src/features/scholarships/webhooks';

const invitation: ScholarshipInvitation = {
  id: 'invite-1',
  applicationId: 'application-1',
  recipientId: 'student-1',
  nonce: 'nonce-1',
  expiresAt: '2026-09-26T00:00:00.000Z',
};

describe('scholarship security abuse cases', () => {
  it('denies cross-tenant object authorization', () => {
    expect(
      canPerform(
        { userId: 'sponsor-1', role: 'sponsor', tenantId: 'sponsor-a' },
        { resource: 'application', tenantId: 'sponsor-b', ownerId: 'student-1' },
        'read'
      )
    ).toEqual({ allowed: false, reason: 'CROSS_TENANT_DENIED' });
  });

  it('rejects invitation replay, expiry, and recipient substitution', () => {
    const now = new Date('2026-09-25T12:00:00.000Z');
    expect(decideInvitationUse(invitation, 'student-1', now)).toEqual({ allowed: true });
    expect(decideInvitationUse({ ...invitation, consumedAt: now.toISOString() }, 'student-1', now)).toEqual({
      allowed: false,
      reason: 'ALREADY_CONSUMED',
    });
    expect(decideInvitationUse(invitation, 'student-2', now)).toEqual({
      allowed: false,
      reason: 'RECIPIENT_MISMATCH',
    });
    expect(decideInvitationUse({ ...invitation, expiresAt: '2026-09-25T11:59:59.000Z' }, 'student-1', now)).toEqual({
      allowed: false,
      reason: 'EXPIRED',
    });
  });

  it('rejects unsupported, empty, and oversized evidence before upload', () => {
    expect(validateSupportingDocument('transcript', new File(['script'], 'x.html', { type: 'text/html' })).valid).toBe(false);
    expect(validateSupportingDocument('transcript', new File([], 'empty.pdf', { type: 'application/pdf' })).valid).toBe(false);
    expect(validateSupportingDocument('transcript', { name: 'large.pdf', size: 10 * 1024 * 1024 + 1, type: 'application/pdf' }).valid).toBe(false);
  });

  it('keeps stored applicant content inert when rendered', () => {
    render(<p>{'<img src=x onerror=alert(1) />'}</p>);
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getByText('<img src=x onerror=alert(1) />')).toBeInTheDocument();
  });

  it('rejects forged and stale sponsor webhooks', async () => {
    const payload = JSON.stringify({ awardId: 'award-1', amount: 500 });
    const timestamp = '2026-09-25T12:00:00.000Z';
    const signature = await signWebhookPayload(payload, 'secret', timestamp);
    expect(await verifyWebhookSignature({ payload, secret: 'wrong-secret', timestamp, signature, now: new Date(timestamp) })).toBe(false);
    expect(await verifyWebhookSignature({ payload, secret: 'secret', timestamp: '2026-09-25T00:00:00.000Z', signature, now: new Date(timestamp) })).toBe(false);
  });

  it('binds wallet verification to both recipient and address', () => {
    expect(isWalletBoundToRecipient({
      requestedRecipientId: 'student-1',
      verifiedRecipientId: 'student-1',
      requestedWalletAddress: 'GABC',
      verifiedWalletAddress: 'GABC',
    })).toBe(true);
    expect(isWalletBoundToRecipient({
      requestedRecipientId: 'student-1',
      verifiedRecipientId: 'student-2',
      requestedWalletAddress: 'GABC',
      verifiedWalletAddress: 'GABC',
    })).toBe(false);
  });

  it('turns payment retries into a replay or payload conflict', () => {
    const request = {
      key: 'payout.execute:finance-1:award-1:nonce-1',
      actorId: 'finance-1',
      operation: 'payout.execute' as const,
      requestFingerprint: fingerprintRequest({ amount: '500', currency: 'USDC' }),
    };
    const record = {
      ...request,
      outcome: 'intent-1',
      createdAt: '2026-09-25T11:00:00.000Z',
      expiresAt: '2026-09-26T11:00:00.000Z',
    };
    expect(decideIdempotentMutation(record, request, new Date('2026-09-25T12:00:00.000Z'))).toEqual({
      action: 'replay',
      outcome: 'intent-1',
    });
    expect(decideIdempotentMutation(record, {
      ...request,
      requestFingerprint: fingerprintRequest({ amount: '900', currency: 'USDC' }),
    }, new Date('2026-09-25T12:00:00.000Z'))).toEqual({
      action: 'conflict',
      reason: 'PAYLOAD_MISMATCH',
    });
  });
});