import { apiClient } from '@/src/lib/api-client';
import type { CreateProgramPayload, MentorshipProgram } from './types';

const BASE = '/mentorship/programs';

export const programService = {
  list: () => apiClient.get<readonly MentorshipProgram[]>(`${BASE}`),

  get: (programId: string) =>
    apiClient.get<MentorshipProgram>(`${BASE}/${programId}`),

  create: (payload: CreateProgramPayload) =>
    apiClient.post<MentorshipProgram>(`${BASE}`, payload),

  publish: (programId: string) =>
    apiClient.post<{ programId: string }>(`${BASE}/${programId}/publish`, {}),
};
