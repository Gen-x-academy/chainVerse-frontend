import { describe, expect, it } from 'vitest';
import { validateSupportingDocument } from '../documents';

describe('supporting document validation', () => {
  it('accepts an allowed PDF within the transcript limit', () => {
    expect(validateSupportingDocument('transcript', {
      name: 'transcript.pdf',
      size: 1024,
      type: 'application/pdf',
    })).toEqual({ valid: true });
  });

  it('rejects unsupported types and oversized files', () => {
    expect(validateSupportingDocument('incomeEvidence', {
      name: 'evidence.exe',
      size: 1024,
      type: 'application/x-msdownload',
    }).valid).toBe(false);
    expect(validateSupportingDocument('incomeEvidence', {
      name: 'evidence.pdf',
      size: 11 * 1024 * 1024,
      type: 'application/pdf',
    }).valid).toBe(false);
  });
});
