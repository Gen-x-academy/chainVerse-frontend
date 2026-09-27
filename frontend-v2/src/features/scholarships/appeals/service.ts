import { apiClient } from '@/src/lib/api-client';
import type {
  Appeal,
  AppealDecisionRecord,
  SubmitAppealPayload,
  DecideAppealPayload,
} from './types';

export const appealService = {
  create: (payload: SubmitAppealPayload): Promise<Appeal> =>
    apiClient.post<Appeal>('/scholarships/appeals', payload),

  get: (appealId: string): Promise<Appeal> =>
    apiClient.get<Appeal>(`/scholarships/appeals/${encodeURIComponent(appealId)}`),

  listByApplication: (applicationId: string): Promise<Appeal[]> =>
    apiClient.get<Appeal[]>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/appeals`
    ),

  submit: (appealId: string): Promise<Appeal> =>
    apiClient.post<Appeal>(`/scholarships/appeals/${encodeURIComponent(appealId)}/submit`, {}),

  withdraw: (appealId: string, reason: string): Promise<Appeal> =>
    apiClient.post<Appeal>(`/scholarships/appeals/${encodeURIComponent(appealId)}/withdraw`, {
      reason,
    }),

  decide: (payload: DecideAppealPayload): Promise<AppealDecisionRecord> =>
    apiClient.post<AppealDecisionRecord>(
      `/scholarships/appeals/${encodeURIComponent(payload.appealId)}/decisions`,
      payload
    ),

  getDecisions: (appealId: string): Promise<AppealDecisionRecord[]> =>
    apiClient.get<AppealDecisionRecord[]>(
      `/scholarships/appeals/${encodeURIComponent(appealId)}/decisions`
    ),
};
