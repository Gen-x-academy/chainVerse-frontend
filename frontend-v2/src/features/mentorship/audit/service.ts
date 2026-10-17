import { apiClient } from '@/src/lib/api-client';
import type {
  MentorshipAuditEvent,
  MentorshipAuditEventInput,
} from './types';

export const mentorshipAuditLogService = {
  list: (params: { tenantId?: string; actor?: string; from?: string; to?: string } = {}): Promise<
    MentorshipAuditEvent[]
  > => {
    const query = new URLSearchParams();
    if (params.tenantId) query.set('tenantId', params.tenantId);
    if (params.actor) query.set('actor', params.actor);
    if (params.from) query.set('from', params.from);
    if (params.to) query.set('to', params.to);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return apiClient.get<MentorshipAuditEvent[]>(`/mentorship/audit-events${suffix}`);
  },

  record: (input: MentorshipAuditEventInput): Promise<MentorshipAuditEvent> =>
    apiClient.post<MentorshipAuditEvent>('/mentorship/audit-events', input),

  export: (params: { tenantId: string; from: string; to: string }): Promise<Blob> => {
    const query = new URLSearchParams(params);
    return apiClient.get<Blob>(`/mentorship/audit-events/export?${query.toString()}`);
  },
};

export * from './types';
