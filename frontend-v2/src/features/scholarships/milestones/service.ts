import { apiClient } from '@/src/lib/api-client';
import type {
  AssignVerifierPayload,
  MilestoneEvidence,
  RecordDecisionPayload,
  SubmitEvidencePayload,
  SubmitEvidenceResult,
  VerifierDecision,
} from './types';

export const milestoneEvidenceService = {
  submit: (payload: SubmitEvidencePayload): Promise<SubmitEvidenceResult> =>
    apiClient.post<SubmitEvidenceResult>(
      '/scholarships/milestones/evidence',
      payload
    ),

  getByMilestone: (milestoneId: string): Promise<MilestoneEvidence[]> =>
    apiClient.get<MilestoneEvidence[]>(
      `/scholarships/milestones/${milestoneId}/evidence`
    ),

  getById: (evidenceId: string): Promise<MilestoneEvidence> =>
    apiClient.get<MilestoneEvidence>(
      `/scholarships/milestones/evidence/${evidenceId}`
    ),
};

export const milestoneVerifierService = {
  assign: (payload: AssignVerifierPayload): Promise<void> =>
    apiClient.post<void>(
      '/scholarships/milestones/evidence/assign-verifier',
      payload
    ),

  recordDecision: (payload: RecordDecisionPayload): Promise<VerifierDecision> =>
    apiClient.post<VerifierDecision>(
      '/scholarships/milestones/evidence/decision',
      payload
    ),

  getDecisions: (evidenceId: string): Promise<VerifierDecision[]> =>
    apiClient.get<VerifierDecision[]>(
      `/scholarships/milestones/evidence/${evidenceId}/decisions`
    ),
};
