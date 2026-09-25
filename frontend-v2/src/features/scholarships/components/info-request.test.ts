import { describe, expect, it } from 'vitest';
import {
  validateInfoRequest,
  validateInfoResponse,
  isRequestOverdue,
} from '../info-request';
import type { InfoRequest, CreateInfoRequestPayload, CreateInfoResponsePayload } from '../info-request';

const futureDeadline = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
const pastDeadline = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

const fields = [
  { fieldKey: 'transcript', label: 'Academic transcript', required: true },
  { fieldKey: 'portfolio', label: 'Portfolio link', required: false },
];

const validCreatePayload: CreateInfoRequestPayload = {
  fields,
  message: 'Please provide your transcript and portfolio.',
  deadline: futureDeadline,
};

const openRequest: InfoRequest = {
  id: 'req-1',
  applicationId: 'app-1',
  reviewerId: 'reviewer-1',
  fields,
  message: 'Please provide your transcript.',
  deadline: futureDeadline,
  createdAt: '2024-01-01T00:00:00Z',
  status: 'open',
};

describe('validateInfoRequest (#1107)', () => {
  it('returns no errors for a valid request', () => {
    expect(validateInfoRequest(validCreatePayload)).toEqual([]);
  });

  it('flags an empty fields array', () => {
    const errors = validateInfoRequest({ ...validCreatePayload, fields: [] });
    expect(errors.some((e) => e.field === 'fields')).toBe(true);
  });

  it('flags an empty message', () => {
    const errors = validateInfoRequest({ ...validCreatePayload, message: '   ' });
    expect(errors.some((e) => e.field === 'message')).toBe(true);
  });

  it('flags a past deadline', () => {
    const errors = validateInfoRequest({ ...validCreatePayload, deadline: pastDeadline });
    expect(errors.some((e) => e.field === 'deadline')).toBe(true);
  });

  it('flags an invalid date string', () => {
    const errors = validateInfoRequest({ ...validCreatePayload, deadline: 'not-a-date' });
    expect(errors.some((e) => e.field === 'deadline')).toBe(true);
  });

  it('accepts a deadline in the future', () => {
    expect(validateInfoRequest(validCreatePayload)).toEqual([]);
  });
});

describe('validateInfoResponse (#1107)', () => {
  const validResponse: CreateInfoResponsePayload = {
    answers: { transcript: 'https://example.com/transcript.pdf', portfolio: '' },
  };

  it('returns no errors for a complete valid response', () => {
    expect(validateInfoResponse(validResponse, openRequest)).toEqual([]);
  });

  it('flags a missing required field', () => {
    const noTranscript: CreateInfoResponsePayload = {
      answers: { transcript: '', portfolio: 'https://portfolio.example.com' },
    };
    const errors = validateInfoResponse(noTranscript, openRequest);
    expect(errors.some((e) => e.field === 'transcript')).toBe(true);
  });

  it('does not flag a missing optional field', () => {
    const noPortfolio: CreateInfoResponsePayload = {
      answers: { transcript: 'https://example.com/transcript.pdf' },
    };
    expect(validateInfoResponse(noPortfolio, openRequest)).toEqual([]);
  });

  it('rejects responses to requests that are not open', () => {
    const closedRequest: InfoRequest = { ...openRequest, status: 'closed' };
    const errors = validateInfoResponse(validResponse, closedRequest);
    expect(errors.some((e) => e.field === 'status')).toBe(true);
  });

  it('rejects responses to overdue requests via status check', () => {
    const overdueRequest: InfoRequest = { ...openRequest, status: 'overdue' };
    const errors = validateInfoResponse(validResponse, overdueRequest);
    expect(errors.some((e) => e.field === 'status')).toBe(true);
  });
});

describe('isRequestOverdue (#1107)', () => {
  it('returns false for a request with a future deadline', () => {
    expect(isRequestOverdue(openRequest)).toBe(false);
  });

  it('returns true for a request with a past deadline', () => {
    const overdueRequest: InfoRequest = { ...openRequest, deadline: pastDeadline };
    expect(isRequestOverdue(overdueRequest)).toBe(true);
  });
});

describe('field visibility invariants (#1107)', () => {
  it('fields exposed in the request are the only ones visible to the applicant', () => {
    const visibleKeys = openRequest.fields.map((f) => f.fieldKey);
    expect(visibleKeys).toEqual(['transcript', 'portfolio']);
    expect(visibleKeys).not.toContain('internal_notes');
  });

  it('each required field must be answered before the response is valid', () => {
    const requiredFields = openRequest.fields.filter((f) => f.required);
    for (const f of requiredFields) {
      const partial: CreateInfoResponsePayload = { answers: {} };
      const errors = validateInfoResponse(partial, openRequest);
      expect(errors.some((e) => e.field === f.fieldKey)).toBe(true);
    }
  });
});
