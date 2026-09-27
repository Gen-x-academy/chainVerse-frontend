import { apiClient } from '@/src/lib/api-client';
import type { CommitteeDecision, CastVotePayload, RecusePayload } from './types';

export const committeeDecisionService = {
  get: (decisionId: string): Promise<CommitteeDecision> =>
    apiClient.get<CommitteeDecision>(
      `/scholarships/committee-decisions/${encodeURIComponent(decisionId)}`
    ),

  listByApplication: (applicationId: string): Promise<CommitteeDecision[]> =>
    apiClient.get<CommitteeDecision[]>(
      `/scholarships/applications/${encodeURIComponent(applicationId)}/committee-decisions`
    ),

  create: (applicationId: string, aggregateVersion: string): Promise<CommitteeDecision> =>
    apiClient.post<CommitteeDecision>('/scholarships/committee-decisions', {
      applicationId,
      aggregateVersion,
    }),

  castVote: (payload: CastVotePayload): Promise<CommitteeDecision> =>
    apiClient.post<CommitteeDecision>(
      `/scholarships/committee-decisions/${encodeURIComponent(payload.committeeDecisionId)}/votes`,
      payload
    ),

  recuse: (payload: RecusePayload): Promise<CommitteeDecision> =>
    apiClient.post<CommitteeDecision>(
      `/scholarships/committee-decisions/${encodeURIComponent(payload.committeeDecisionId)}/recusals`,
      payload
    ),

  finalise: (decisionId: string): Promise<CommitteeDecision> =>
    apiClient.post<CommitteeDecision>(
      `/scholarships/committee-decisions/${encodeURIComponent(decisionId)}/finalise`,
      {}
    ),

  void: (decisionId: string, reason: string): Promise<CommitteeDecision> =>
    apiClient.post<CommitteeDecision>(
      `/scholarships/committee-decisions/${encodeURIComponent(decisionId)}/void`,
      { reason }
    ),
};
