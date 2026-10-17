import { apiClient } from '@/src/lib/api-client';
import type { MentorshipSloEvaluation, MentorshipSloSample } from './types';

const SECRET_PATTERN = /(token|secret|password|api[_-]?key|key)=/i;

export function sanitizeCorrelationId(correlationId: string): string {
  const trimmed = correlationId.trim();
  if (!trimmed) return 'unknown';
  if (SECRET_PATTERN.test(trimmed)) return 'redacted';
  return trimmed.replace(/[^A-Za-z0-9._:-]/g, '').slice(0, 64);
}

export const mentorshipSloService = {
  evaluate: (): Promise<MentorshipSloEvaluation[]> =>
    apiClient.get<MentorshipSloEvaluation[]>('/mentorship/slo/evaluations'),

  sample: (sample: MentorshipSloSample): Promise<{ accepted: boolean }> =>
    apiClient.post<{ accepted: boolean }>('/mentorship/slo/samples', {
      ...sample,
      correlationId: sample.correlationId ? sanitizeCorrelationId(sample.correlationId) : undefined,
    }),
};

export * from './types';
