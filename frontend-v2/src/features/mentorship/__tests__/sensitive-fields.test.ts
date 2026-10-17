import { describe, expect, it } from 'vitest';
import {
  REDACTION_MARKER,
  auditAccess,
  authorizeFieldAccess,
  canDecrypt,
  containsSensitiveData,
  redactError,
  redactRecord,
  rotateKey,
  SENSITIVE_FIELDS,
} from '../privacy/sensitive-fields';

describe('MENTOR-110 sensitive field protection', () => {
  it('covers every advertised sensitive field class', () => {
    expect(SENSITIVE_FIELDS).toEqual(
      expect.arrayContaining([
        'providerToken',
        'identityRef',
        'privateNote',
        'preciseLocation',
        'evidenceKey',
        'payoutDetails',
      ]),
    );
  });

  it('redacts plaintext from nested records and detects leakage', () => {
    const record = {
      sessionId: 'ses-1',
      providerToken: 'tok_live_super_secret',
      nested: { privateNote: 'sensitive note', payoutDetails: { iban: 'DE00' } },
    };
    expect(containsSensitiveData(record)).toBe(true);
    const redacted = redactRecord(record);
    expect(redacted.providerToken).toBe(REDACTION_MARKER);
    expect(redacted.nested.privateNote).toBe(REDACTION_MARKER);
    expect(redacted.nested.payoutDetails).toBe(REDACTION_MARKER);
    expect(JSON.stringify(redacted)).not.toContain('tok_live_super_secret');
    expect(JSON.stringify(redacted)).not.toContain('sensitive note');
  });

  it('redacts secrets out of error messages and stacks', () => {
    const error = new Error('failed with tok_live_abcdefghijklmnop1234');
    const safe = redactError(error);
    expect(safe.message).not.toContain('tok_live_abcdefghijklmnop1234');
    expect(safe.message).toContain(REDACTION_MARKER);
  });

  it('is deny-by-default with least privilege and audits attempts', () => {
    expect(authorizeFieldAccess(undefined, 'read')).toMatchObject({ allowed: false });
    expect(authorizeFieldAccess('mentor', 'rotate')).toMatchObject({ allowed: false });
    expect(authorizeFieldAccess('mentee', 'write')).toMatchObject({ allowed: true });
    expect(authorizeFieldAccess('administrator', 'rotate')).toMatchObject({ allowed: true });
    const log = auditAccess([], 'admin-1', 'administrator', 'providerToken', 'read');
    expect(log).toHaveLength(1);
    expect(log[0]).toMatchObject({ actor: 'admin-1', field: 'providerToken', allowed: true });
    const denied = auditAccess([], 'mentor-1', 'mentor', 'payoutDetails', 'rotate');
    expect(denied[0].allowed).toBe(false);
  });

  it('rotates keys while retaining decryptability of prior data', () => {
    const ring = { activeVersion: 1, versions: [1] };
    const rotated = rotateKey(ring, new Date('2026-10-17T00:00:00.000Z'));
    expect(rotated.activeVersion).toBe(2);
    expect(rotated.versions).toEqual([1, 2]);
    expect(canDecrypt(rotated, 1)).toBe(true);
    expect(canDecrypt(rotated, 2)).toBe(true);
    expect(canDecrypt(rotated, 3)).toBe(false);
  });
});
