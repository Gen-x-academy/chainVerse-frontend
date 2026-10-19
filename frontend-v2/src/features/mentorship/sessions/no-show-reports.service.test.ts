import { beforeEach, describe, expect, it, vi } from 'vitest';

const post = vi.fn();
vi.mock('@/src/lib/api-client', () => ({ apiClient: { post: (...args: unknown[]) => post(...args), get: vi.fn() } }));

import {
  noShowReportService,
  submitNoShowReport,
  submitNoShowResolution,
  submitNoShowResponse,
  type CreateNoShowReportRequest,
  type NoShowReportResponse,
} from './no-show-reports.service';

const request: CreateNoShowReportRequest = {
  type: 'mentor',
  statement: 'The mentor never joined the call',
  evidence: [{ kind: 'note', text: 'Waited 15 minutes' }],
  idempotencyKey: 'noshow-key-0001',
};

const response = (replayed: boolean, merged = false): NoShowReportResponse => ({
  replayed,
  merged,
  report: { reportId: 'nsr-1' } as NoShowReportResponse['report'],
});

const analytics = () => post.mock.calls.filter(([path]) => path === '/mentorship/analytics/events');

function respondWith(body: NoShowReportResponse) {
  post.mockImplementation((path: string) =>
    Promise.resolve(path === '/mentorship/analytics/events' ? undefined : body),
  );
}

beforeEach(() => {
  post.mockReset();
});

describe('noShowReportService', () => {
  it('posts a report with the key in the body and the header', async () => {
    post.mockResolvedValue(response(false));
    await noShowReportService.create('ses/1', request);
    expect(post).toHaveBeenCalledWith('/mentorship/sessions/ses%2F1/no-show-reports', request, {
      headers: { 'Idempotency-Key': 'noshow-key-0001' },
    });
  });

  it('posts a response and a resolution to their own endpoints', async () => {
    post.mockResolvedValue(response(false));
    await noShowReportService.respond('nsr/1', { statement: 'I was there', evidence: [] });
    await noShowReportService.resolve('nsr/1', { outcome: 'dismiss' });
    expect(post).toHaveBeenNthCalledWith(1, '/mentorship/no-show-reports/nsr%2F1/responses', { statement: 'I was there', evidence: [] });
    expect(post).toHaveBeenNthCalledWith(2, '/mentorship/no-show-reports/nsr%2F1/resolution', { outcome: 'dismiss' });
  });
});

describe('no-show analytics', () => {
  it('records one event per step without statements, evidence or notes', async () => {
    respondWith(response(false));
    await submitNoShowReport('ses-1', request, 'actor-1');
    await submitNoShowResponse('nsr-1', { statement: 'I was there', evidence: [] }, 'actor-2');
    await submitNoShowResolution('nsr-1', { outcome: 'dismiss', note: 'Checked the logs' }, 'actor-3');

    const events = analytics().map(([, body]) => body as Record<string, unknown>);
    expect(events.map((event) => event.entityId)).toEqual(['nsr-1:reported', 'nsr-1:responded', 'nsr-1:resolved']);
    expect(events.every((event) => event.stage === 'session_no_show')).toBe(true);
    const serialised = JSON.stringify(events);
    for (const secret of ['never joined', 'Waited', 'I was there', 'logs']) expect(serialised).not.toContain(secret);
  });

  it('never counts a replay again, including a merged claim that was a replay', async () => {
    respondWith(response(true));
    await submitNoShowReport('ses-1', request, 'actor-1');
    await submitNoShowResponse('nsr-1', { statement: 'I was there', evidence: [] }, 'actor-2');
    await submitNoShowResolution('nsr-1', { outcome: 'dismiss' }, 'actor-3');
    expect(analytics()).toHaveLength(0);
  });

  it('counts a merged claim, which is a new fact', async () => {
    respondWith(response(false, true));
    await submitNoShowReport('ses-1', request, 'actor-1');
    expect(analytics()).toHaveLength(1);
  });

  it('records nothing for a failed request and ignores an analytics outage', async () => {
    post.mockRejectedValue(new Error('boom'));
    await expect(submitNoShowReport('ses-1', request, 'actor-1')).rejects.toThrow('boom');
    expect(analytics()).toHaveLength(0);

    post.mockReset();
    post.mockImplementation((path: string) =>
      path === '/mentorship/analytics/events' ? Promise.reject(new Error('down')) : Promise.resolve(response(false)),
    );
    await expect(submitNoShowReport('ses-1', request, 'actor-1')).resolves.toMatchObject({ replayed: false });
  });
});
